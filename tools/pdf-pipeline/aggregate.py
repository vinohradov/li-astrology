#!/usr/bin/env python3
"""
Phase 2 — Token reconciliation.

Walks an extraction inventory (output of extract.py), aggregates unique colors,
common drawing dimensions, and known images. Produces a Markdown report at
<inventory>/tokens.md and a JSON sidecar at <inventory>/tokens.json.

Usage:
    python aggregate.py <inventory-dir>
"""

import sys
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def is_near_white(h, threshold=240):
    if not h:
        return True
    r, g, b = hex_to_rgb(h)
    return r >= threshold and g >= threshold and b >= threshold


def is_near_black(h, threshold=20):
    if not h:
        return False
    r, g, b = hex_to_rgb(h)
    return r <= threshold and g <= threshold and b <= threshold


def color_family(h):
    """Crude hue/lightness binning for grouping."""
    if not h:
        return "transparent"
    r, g, b = hex_to_rgb(h)
    if r > 240 and g > 240 and b > 240:
        return "white"
    if r < 20 and g < 20 and b < 20:
        return "black"
    # max + min for HSL-ish lightness
    mx, mn = max(r, g, b), min(r, g, b)
    L = (mx + mn) / 2 / 255
    if mx == mn:
        hue = 0
    elif mx == r:
        hue = (60 * ((g - b) / (mx - mn)) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / (mx - mn)) + 120
    else:
        hue = 60 * ((r - g) / (mx - mn)) + 240
    # bin
    if mx - mn < 15:
        return "neutral"
    if 300 <= hue or hue < 30:
        bucket = "pink/red"
    elif 30 <= hue < 60:
        bucket = "orange"
    elif 60 <= hue < 80:
        bucket = "yellow"
    elif 80 <= hue < 170:
        bucket = "green"
    elif 170 <= hue < 260:
        bucket = "blue"
    else:
        bucket = "purple"
    tone = "dark" if L < 0.35 else "mid" if L < 0.65 else "light"
    return f"{bucket} · {tone}"


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)

    inv_dir = Path(sys.argv[1]).resolve()
    page_files = sorted(inv_dir.glob("page*.json"))
    if not page_files:
        print(f"No page*.json found in {inv_dir}", file=sys.stderr)
        sys.exit(1)

    fill_counter = Counter()
    stroke_counter = Counter()
    drawing_size_counter = Counter()
    drawing_shapes = Counter()
    drawing_widths = Counter()
    text_size_counter = Counter()
    text_font_counter = Counter()
    text_colors = Counter()
    drawing_color_by_size = defaultdict(Counter)
    page_sizes = set()

    image_records = []  # (page, asset, w_pt, h_pt, xref)

    for pf in page_files:
        data = json.loads(pf.read_text())
        page_num = data["page"]
        page_sizes.add((data["size_pt"]["w"], data["size_pt"]["h"]))

        for d in data["drawings"]:
            fill_counter[d["fill"]] += 1
            stroke_counter[d["stroke"]] += 1
            drawing_shapes[d["shape"]] += 1
            if d["stroke_width"]:
                drawing_widths[round(d["stroke_width"], 2)] += 1
            bbox = d["bbox"]
            if bbox:
                # bucket sizes into rough categories
                w = bbox["w"]
                h = bbox["h"]
                area = w * h
                if area < 25:
                    size_bucket = "tiny (<5×5pt)"
                elif area < 200:
                    size_bucket = "small (≤14×14pt)"
                elif area < 5_000:
                    size_bucket = "medium (≤70×70pt)"
                elif area < 50_000:
                    size_bucket = "large (≤220×220pt)"
                else:
                    size_bucket = "huge (>220×220pt)"
                drawing_size_counter[size_bucket] += 1
                if d["fill"]:
                    drawing_color_by_size[size_bucket][d["fill"]] += 1

        for s in data["text_spans"]:
            text_size_counter[round(s["size"], 1)] += 1
            text_font_counter[s["font"]] += 1
            text_colors[s["color"]] += 1

        for im in data["images"]:
            image_records.append({
                "page": page_num,
                "asset": im.get("asset"),
                "xref": im.get("xref"),
                "bbox": im.get("bbox"),
                "px": (im.get("width_px"), im.get("height_px")),
            })

    # ---- summarize ----
    def top(counter, n=20, drop_none=True):
        items = [(k, v) for k, v in counter.most_common() if not (drop_none and k is None)]
        return items[:n]

    out = {
        "source_inventory": str(inv_dir),
        "page_count": len(page_files),
        "page_sizes_pt": sorted(page_sizes),
        "fills": [{"color": c, "count": n, "family": color_family(c)} for c, n in top(fill_counter, 40)],
        "strokes": [{"color": c, "count": n, "family": color_family(c)} for c, n in top(stroke_counter, 40)],
        "drawing_shapes": dict(drawing_shapes.most_common()),
        "stroke_widths": dict(drawing_widths.most_common(10)),
        "drawing_size_buckets": dict(drawing_size_counter.most_common()),
        "large_drawing_top_colors": {
            bucket: [{"color": c, "count": n, "family": color_family(c)}
                     for c, n in top(cc, 8) if not is_near_white(c)]
            for bucket, cc in drawing_color_by_size.items()
            if bucket in ("large (≤220×220pt)", "huge (>220×220pt)", "medium (≤70×70pt)")
        },
        "text_sizes_pt": dict(text_size_counter.most_common()),
        "text_fonts": dict(text_font_counter.most_common()),
        "text_colors": [{"color": c, "count": n} for c, n in top(text_colors, 10)],
        "images": image_records,
    }

    (inv_dir / "tokens.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2)
    )

    # ---- markdown report ----
    md = []
    md.append(f"# Token inventory — {inv_dir.name}\n")
    md.append(f"- Pages: **{len(page_files)}**")
    md.append(f"- Page sizes (pt): {', '.join(f'{w:g}×{h:g}' for w, h in sorted(page_sizes))}\n")

    md.append("## Top fill colors (skipping near-white)\n")
    md.append("| Hex | Family | Count |")
    md.append("|---|---|---|")
    for c, n in top(fill_counter, 30):
        if not c or is_near_white(c):
            continue
        md.append(f"| `{c}` | {color_family(c)} | {n} |")
    md.append("")

    md.append("## Top stroke colors (skipping near-white)\n")
    md.append("| Hex | Family | Count |")
    md.append("|---|---|---|")
    for c, n in top(stroke_counter, 20):
        if not c or is_near_white(c):
            continue
        md.append(f"| `{c}` | {color_family(c)} | {n} |")
    md.append("")

    md.append("## Drawing shapes\n")
    md.append("| Shape | Count |")
    md.append("|---|---|")
    for k, v in drawing_shapes.most_common():
        md.append(f"| {k} | {v} |")
    md.append("")

    md.append("## Stroke widths (pt)\n")
    md.append("| Width | Count |")
    md.append("|---|---|")
    for w, n in drawing_widths.most_common(10):
        md.append(f"| {w} | {n} |")
    md.append("")

    md.append("## Drawing size distribution\n")
    md.append("| Bucket | Count |")
    md.append("|---|---|")
    for k, v in drawing_size_counter.most_common():
        md.append(f"| {k} | {v} |")
    md.append("")

    md.append("## Top colors for medium / large drawings (likely pills, cards, decoration)\n")
    for bucket in ("medium (≤70×70pt)", "large (≤220×220pt)", "huge (>220×220pt)"):
        cc = drawing_color_by_size.get(bucket)
        if not cc:
            continue
        md.append(f"### {bucket}")
        md.append("| Hex | Family | Count |")
        md.append("|---|---|---|")
        for c, n in top(cc, 10):
            if not c or is_near_white(c):
                continue
            md.append(f"| `{c}` | {color_family(c)} | {n} |")
        md.append("")

    if text_size_counter:
        md.append("## Text sizes (pt)\n")
        md.append("| Size | Count |")
        md.append("|---|---|")
        for sz, n in sorted(text_size_counter.items(), key=lambda x: -x[1])[:15]:
            md.append(f"| {sz} | {n} |")
        md.append("")

    if text_font_counter:
        md.append("## Fonts in use\n")
        md.append("| Font | Count |")
        md.append("|---|---|")
        for f, n in text_font_counter.most_common():
            md.append(f"| `{f}` | {n} |")
        md.append("")
    else:
        md.append("## Fonts in use\n")
        md.append("_None — text has been converted to vector paths in this PDF._\n")

    md.append("## Extracted images\n")
    md.append("| Page | Asset | Px size | Position (pt) |")
    md.append("|---|---|---|---|")
    for im in image_records:
        bb = im["bbox"] or {}
        pos = f"x={bb.get('x','?')}, y={bb.get('y','?')}, w={bb.get('w','?')}, h={bb.get('h','?')}" if bb else "?"
        px = im["px"]
        px_str = f"{px[0]}×{px[1]}" if px[0] else "?"
        md.append(f"| {im['page']} | `{im['asset'] or '(failed)'}` | {px_str} | {pos} |")
    md.append("")

    (inv_dir / "tokens.md").write_text("\n".join(md))

    print(f"Wrote {inv_dir/'tokens.md'}")
    print(f"Wrote {inv_dir/'tokens.json'}")
    print()
    print(f"== Quick summary for {inv_dir.name} ==")
    print(f"  pages: {len(page_files)}")
    print(f"  unique fills: {sum(1 for c in fill_counter if c)}")
    print(f"  unique strokes: {sum(1 for c in stroke_counter if c)}")
    print(f"  top 5 non-white fills:")
    shown = 0
    for c, n in fill_counter.most_common():
        if c and not is_near_white(c):
            print(f"    {c}  ({color_family(c):>15})  × {n}")
            shown += 1
            if shown >= 5:
                break


if __name__ == "__main__":
    main()
