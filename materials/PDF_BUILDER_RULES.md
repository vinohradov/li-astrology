# PDF Builder Rules

> Authoritative design rules from Anastasia (the author). When these rules
> conflict with anything inferred from the existing PDFs in
> `design-library/`, **these rules win**. The visual ground truth from the
> design library is reference inspiration; this file is the contract.
>
> Source: customer brief, 2026-05-19.
> Originally written to describe the "Компенсаторика" deck; the author
> wants this style applied to all new styled materials going forward.

---

## 1. Color palette

Single colour family — cherry / pink / dusty, from dark to light:

| Role                                       | Hex (brief) | Hex (extracted) | Use this |
|--------------------------------------------|-------------|-----------------|----------|
| Headings + main body text                  | `#3D1F2D`   | **`#4c272f`**   | extracted |
| Pill buttons, bullets, accents             | `#B8878F`   | **`#b291a0`**   | extracted |
| Card background                            | `#F2ECEC`   | (not present in Кармические — see below) | TBD |
| Page background                            | `#FFFFFF`   | `#ffffff`       | both     |
| Hairline (orbital rings, dividers)         | —           | `#d1d3d4` @ 0.5pt | extracted |

> **Why two columns?** The "brief" column is what Anastasia wrote from
> memory in her spec. The "extracted" column is what we actually pulled
> out of `design-library/Кармические узлы.pdf` and `Стихии и кресты .pdf`
> with `tools/pdf-pipeline/`. They're close but not identical. **Matching
> the extracted values is what makes the output look like her PDFs.**
> See `components/tokens.json` for the full machine-readable inventory.

> **Card background gap:** Кармические узлы does **not** use a flat-color
> rounded card anywhere — no `#F2ECEC` (or any other light pink) rounded
> rect appears as a fill. Visual "card" effects come either from embedded
> gradient images (see `components/assets/cover-bg-pink-gradient.png`) or
> the content just sits on the white page with no container. The brief's
> `#F2ECEC` cards may apply to newer "Компенсаторика" material we
> haven't seen. **Ask Anastasia** whether new bonus materials should use
> the no-card Кармические model or the with-card Компенсаторика model.

**Monochrome.** Stay inside this family — no greens, blues, oranges in the
chrome. Different lightness values of the same hue are how we create
hierarchy, not different hues.

---

## 2. Typography

Base font: **Montserrat** — confirmed from real text spans in
`design-library/урок 1.pdf` (`Montserrat-Regular`, `Montserrat-SemiBold`,
`Montserrat-Bold`). The brief said "Montserrat or Raleway"; the actual
library is Montserrat.

| Element                                  | Style                                              |
|------------------------------------------|----------------------------------------------------|
| Section headers                          | Sans-serif, **Bold**, **UPPERCASE**, ~14–16px, letter-spacing +2–3px |
| Body text inside cards                   | Sans-serif, Regular, ~12–13px                      |
| Bold terms inline                        | Sans-serif, **Bold**, same color as body, inline   |
| Bullet terms (e.g. `ПРИНЯТИЕ`)           | **Bold**, **UPPERCASE**, dusty-pink `#B8878F`      |
| Italic subheadings                       | *Italic*, ~13px                                    |
| Quotes / story passages                  | *Italic*, ~12px                                    |

Notes:
- Sizes above are described as on-screen pixel sizes. Translate to print
  with `px ÷ 96 × 72` (≈ `× 0.75`) → header ~10.5–12pt, body ~9–9.75pt.
  We allow ~10% upscale for print readability — see §8 implementation.
- Quotes use Russian guillemets «…», not straight `"…"`.

---

## 3. Cards & blocks

### 3.1 Info card
- `border-radius: 12–16px`
- Background `#F2ECEC` (light pink-beige)
- **No hard border.** A very faint shadow or none at all.
- Inner padding ~20px.

### 3.2 Section-header pill
- Pill shape: `border-radius: 50px`
- Fill: dusty pink `#B8878F`
- Text: white, **Bold**, **UPPERCASE**
- Width: ~50–60% of content area, centered horizontally.

### 3.3 Bulleted list
- Small round dots in dusty pink `#B8878F`.
- Term — **Bold**, **UPPERCASE**, dusty-pink.
- After an em-dash — regular dark body text.

  Example:
  > • **ПРИНЯТИЕ** — спокойное согласие с тем, что есть.

---

## 4. Layout & grid

- Single column, vertical scroll.
- Side margins ~16–20px (we use 18mm A4 ≈ 19px → matches).
- Large gaps between sections (~30–40px).
- Section headers always **centered**.
- Cards span the full content width.
- **Page numbers:** small circle with the page number in dusty pink,
  centered at the bottom of every page.

---

## 5. General principles

- **Monochromatic** — one hue, many lightnesses.
- **Lots of air**, minimalism.
- Level numbering goes inline as bold text — **not** as a separate
  numbered list.
- Quotes use angle brackets «…».
- Author signature — italic, small, **centered at top of the page**.

---

## 6. Planet imagery

When a planet appears as decoration on a page, it follows specific rules:

### 6.1 Style
- **Photorealistic** — real NASA imagery or high-quality 3D renders.
- Each planet has its own texture and tonal family:
  - Pink-grey rocky (Mars / Moon) — dusty pinks
  - Fiery red with veins (molten) — orange-red
  - Gas giant with rings (Saturn) — beige-brown bands
  - Yellow-orange (Venus / Sun) — warm gold
  - Dark blue with glow (Earth at night) — cool, dark

### 6.2 Orbital ring
- Around every planet: a thin **1px** circular ring (dotted or solid),
  slightly larger than the planet itself.
- Line colour: light grey or pink-grey.
- Two small dark-grey dots on the ring (~4–5px), like orbital nodes.
- Effect: the planet is "hanging" inside an orbit.

### 6.3 Background under the planet
- White or very light pink — **never** dark.

### 6.4 Placement
Placement is free, governed by composition not rigid rules. A planet can:
- Sit centered.
- Be offset left or right.
- Sit in the lower part of the page.
- Be cropped, bleeding off the right / left / bottom / corner edge.

### 6.5 Inviolable rules
- **Never overlaps text.** Always in free space.
- **Always** has the 1px orbital ring with two small dots.
- Background under the planet is **always light**.
- Appears **rarely** — every few pages, as a decorative pause.
- **Reasonably large** — not a small detail, but a notable element.

---

## 7. Mapping to current components

Where the rules confirm what we already had:

| Customer rule                  | Component in `PDF_DESIGN_SYSTEM.md` §4 |
|--------------------------------|-----------------------------------------|
| Section-header pill            | `pill-top` (palette change)             |
| Info card                      | `callout` (palette + radius change)     |
| Single column, large gaps      | Overall page layout                     |
| Italic mauve subheadings       | `section-note` (palette change)         |
| Bulleted list with bold term   | New variant of `bullet-list-rail`       |

Where the rules introduce **new** behaviour:

| Customer rule                  | What's needed                           |
|--------------------------------|-----------------------------------------|
| Page numbers (dusty-pink circle, centered bottom) | New `page-footer-circle` — implement via Chrome `--print-to-pdf-footer-template` or CSS `@page @bottom-center`. **Not yet built.** |
| Photorealistic planet decoration | New `bg-planet` component. Needs real planet imagery (asset pipeline). **Placeholder only for now.** |
| Author signature top-of-page   | New `author-top` — italic, small, centered above page content. |
| Bullet term with em-dash       | New `bullet-term-list` component.       |

Where the rules **override** earlier inferred tokens:

| Token              | Old (inferred from design-library) | New (customer-authoritative) |
|--------------------|-------------------------------------|------------------------------|
| Headings           | `#2d1b26`                           | `#3D1F2D`                    |
| Top pill bg        | `#5e2a3b` (burgundy)                | `#B8878F` (dusty pink)       |
| Accent / glyph     | `#9c5871` (mauve)                   | `#B8878F`                    |
| Card bg            | `#f5e6eb`                           | `#F2ECEC`                    |
| Body font          | Inter                               | Montserrat                   |

The earlier burgundy/plum pills (seen in `урок 1.pdf` etc.) are a previous
generation of the design. New work uses the dusty-pink palette below.

---

## 8. Implementation status (2026-05-19)

| Rule                                           | Status                                      |
|------------------------------------------------|---------------------------------------------|
| Colour palette (§1)                            | ✅ applied                                  |
| Sans-serif Montserrat (§2)                     | ✅ applied                                  |
| Typography sizes (§2)                          | ✅ applied (with mild print upscale)        |
| Card style (§3.1)                              | ✅ applied                                  |
| Pill style (§3.2)                              | ✅ applied                                  |
| Bullet-term list (§3.3)                        | ⚠️ component not built — no bullet lists in current doc, will add when needed |
| Section centering, gaps (§4)                   | ✅ applied                                  |
| Page-number circle (§4, last line)             | ❌ not yet — needs Chrome footer template work |
| Quotes as «…» (§5)                             | ✅ already correct                          |
| Author signature top of page (§5)              | ✅ applied on content pages                 |
| Photorealistic planets (§6)                    | ⚠️ placeholder CSS planet only — needs real assets |
| Orbital ring + 2 nodes (§6.2)                  | ✅ applied to placeholder                   |

**Next builds needed:** see the ❌ / ⚠️ rows above.

---

## 9. Where to find these in code

The reference implementation that follows these rules:
- HTML: `materials/documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.html`
- PDF:  `materials/documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.pdf`

The component inventory and rendering pipeline live in
[`PDF_DESIGN_SYSTEM.md`](PDF_DESIGN_SYSTEM.md). Tokens and component IDs
in that document are kept in sync with the rules here — if you find a
mismatch, this file (PDF_BUILDER_RULES.md) is the source of truth.
