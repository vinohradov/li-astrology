#!/usr/bin/env python3
"""
Phase 1 — Mechanical inventory of a PDF.

Dumps per-page JSON containing:
- All text spans: text, font, size, color, bbox
- All vector drawings: type, fill, stroke, stroke_width, bbox
- All embedded raster images: bbox + extracted PNG path

Usage:
    python extract.py <input.pdf> <output-dir>

Example:
    python extract.py ../../materials/design-library/Кармические\\ узлы.pdf \\
        ./inventory/karmic
"""

import sys
import json
import re
from pathlib import Path

import fitz  # PyMuPDF


def int_rgb_to_hex(c):
    """fitz colors come as a single int (0xRRGGBB) or a tuple (r,g,b) 0..1.
    Normalize to '#RRGGBB' or None."""
    if c is None:
        return None
    if isinstance(c, (int,)):
        return f"#{c:06x}"
    if isinstance(c, (tuple, list)):
        if len(c) == 1:
            v = int(round(c[0] * 255))
            return f"#{v:02x}{v:02x}{v:02x}"
        if len(c) == 3:
            r, g, b = (int(round(x * 255)) for x in c)
            return f"#{r:02x}{g:02x}{b:02x}"
        if len(c) == 4:
            # CMYK — convert roughly to RGB for human reading
            cyan, mag, yel, k = c
            r = round(255 * (1 - cyan) * (1 - k))
            g = round(255 * (1 - mag) * (1 - k))
            b = round(255 * (1 - yel) * (1 - k))
            return f"#{r:02x}{g:02x}{b:02x}"
    return None


def bbox_to_dict(bbox):
    """Convert fitz Rect or 4-tuple to dict in PDF points."""
    if bbox is None:
        return None
    if hasattr(bbox, "x0"):
        return {
            "x": round(bbox.x0, 2),
            "y": round(bbox.y0, 2),
            "w": round(bbox.x1 - bbox.x0, 2),
            "h": round(bbox.y1 - bbox.y0, 2),
        }
    x0, y0, x1, y1 = bbox
    return {
        "x": round(x0, 2),
        "y": round(y0, 2),
        "w": round(x1 - x0, 2),
        "h": round(y1 - y0, 2),
    }


def extract_text_spans(page):
    """Return list of {text, font, size, weight, italic, color, bbox}."""
    spans = []
    page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:  # 0 == text block
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                font = span.get("font", "")
                flags = span.get("flags", 0)
                # font flags: 0x1 superscript, 0x2 italic, 0x4 serifed, 0x8 monospaced, 0x10 bold
                is_bold = bool(flags & 16) or "Bold" in font or "Black" in font or "Heavy" in font
                is_italic = bool(flags & 2) or "Italic" in font or "Oblique" in font
                color_int = span.get("color", 0)
                spans.append({
                    "text": span.get("text", ""),
                    "font": font,
                    "size": round(span.get("size", 0), 2),
                    "bold": is_bold,
                    "italic": is_italic,
                    "color": int_rgb_to_hex(color_int),
                    "bbox": bbox_to_dict(span.get("bbox")),
                })
    return spans


def extract_drawings(page):
    """Return list of vector drawings on the page."""
    drawings = []
    for d in page.get_drawings():
        # d keys: items, fill, color (stroke), width, opacity, fill_opacity, rect, type
        # type: 'f' (fill), 's' (stroke), 'fs' (both), 'clip'
        rect = d.get("rect")
        items = d.get("items", [])
        # check if path has curves (rounded corners) or just lines
        has_curves = any(it[0] == "c" for it in items)
        # very rough: rectangle if 4 lines or 1 'l' item; rounded rect if curves+lines
        kinds = [it[0] for it in items]
        if "re" in kinds and not has_curves:
            shape = "rect"
        elif has_curves and any(k == "l" for k in kinds):
            shape = "rounded-rect-or-shape"
        elif has_curves:
            shape = "curve"
        elif kinds and all(k == "l" for k in kinds):
            shape = "line" if len(items) == 1 else "polyline"
        else:
            shape = "path"

        drawings.append({
            "shape": shape,
            "type": d.get("type"),
            "fill": int_rgb_to_hex(d.get("fill")),
            "stroke": int_rgb_to_hex(d.get("color")),
            "stroke_width": round(d.get("width") or 0, 3),
            "fill_opacity": d.get("fill_opacity"),
            "stroke_opacity": d.get("stroke_opacity"),
            "has_curves": has_curves,
            "item_count": len(items),
            "bbox": bbox_to_dict(rect),
        })
    return drawings


def extract_images(page, out_dir, page_num):
    """Extract embedded raster images. Save PNGs, return metadata."""
    images = []
    # get_images() returns image refs; we need positions from page.get_image_info()
    info = page.get_image_info(xrefs=True)
    for idx, im in enumerate(info):
        xref = im.get("xref")
        if not xref:
            continue
        try:
            pix = fitz.Pixmap(page.parent, xref)
            if pix.n - pix.alpha >= 4:  # CMYK → convert to RGB
                pix = fitz.Pixmap(fitz.csRGB, pix)
            filename = f"page{page_num:02d}_img{idx:02d}_xref{xref}.png"
            out_path = out_dir / "assets" / filename
            out_path.parent.mkdir(parents=True, exist_ok=True)
            pix.save(out_path)
            pix = None
            images.append({
                "asset": filename,
                "xref": xref,
                "width_px": im.get("width"),
                "height_px": im.get("height"),
                "bbox": bbox_to_dict(im.get("bbox")),
                "transform": im.get("transform"),
            })
        except Exception as e:
            images.append({
                "asset": None,
                "xref": xref,
                "error": str(e),
                "bbox": bbox_to_dict(im.get("bbox")),
            })
    return images


def extract_page(page, page_num, out_dir):
    return {
        "page": page_num,
        "size_pt": {
            "w": round(page.rect.width, 2),
            "h": round(page.rect.height, 2),
        },
        "rotation": page.rotation,
        "text_spans": extract_text_spans(page),
        "drawings": extract_drawings(page),
        "images": extract_images(page, out_dir, page_num),
    }


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)

    src = Path(sys.argv[1]).expanduser().resolve()
    dst = Path(sys.argv[2]).expanduser().resolve()
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        sys.exit(1)
    dst.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(src)
    print(f"Opened {src.name} — {len(doc)} pages")

    summary = {
        "source": src.name,
        "page_count": len(doc),
        "pages": [],
    }

    for i, page in enumerate(doc):
        page_num = i + 1
        data = extract_page(page, page_num, dst)
        out_file = dst / f"page{page_num:02d}.json"
        out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        summary["pages"].append({
            "page": page_num,
            "spans": len(data["text_spans"]),
            "drawings": len(data["drawings"]),
            "images": len(data["images"]),
        })
        print(f"  p{page_num:02d} → {len(data['text_spans']):3d} spans, "
              f"{len(data['drawings']):3d} drawings, "
              f"{len(data['images']):2d} images")

    (dst / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nWrote inventory to {dst}")
    print(f"  page JSONs:     page01.json … page{len(doc):02d}.json")
    print(f"  asset images:   {dst}/assets/")
    print(f"  summary:        summary.json")


if __name__ == "__main__":
    main()
