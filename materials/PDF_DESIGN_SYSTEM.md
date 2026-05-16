# PDF Design System & Generation Pipeline

> Living doc for the styled-PDF work in `materials/`. Read this first before
> touching any document in this folder or building a new one.

---

## 0. TL;DR

- We have a set of beautifully designed Russian-language astrology PDFs in
  `materials/design-library/` (covers + lesson materials). They share a
  coherent mauve / burgundy / pink design language.
- The end goal is a **pipeline**: drop a plain `.txt` (or `.docx`) into
  `materials/templates/`, run an analyzer that maps each block to a known
  **design component**, surface gaps for human review, then render to a PDF
  that visually belongs to the same family — output to
  `materials/documents/<slug>/`.
- Renderer is **HTML + headless Chrome**. No LaTeX, no Word styles.
- The first finished output is
  `materials/documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.pdf`
  — use it as the reference implementation while the component library is
  still being extracted.

---

## 1. Folder layout

```
materials/
├── PDF_DESIGN_SYSTEM.md        ← this file (the source of truth)
│
├── design-library/             ← READ-ONLY reference designs
│   │                              (Anastasia's existing styled PDFs we
│   │                               mine for components)
│   ├── урок 1.pdf … урок 9.pdf
│   ├── Аспекты солнца и луны.pdf
│   ├── Аспекты_к_другим_личным_планетам_.pdf
│   ├── Самоучитель по аспектам.pdf
│   ├── Кармические узлы.pdf
│   ├── Стихии и кресты .pdf
│   ├── Как_построить_натальную_карту.pdf
│   ├── ДЗ - Солнце и Луна.pdf
│   └── ZET.pdf
│
├── components/                 ← (FUTURE) extracted reusable components
│   └── README.md                  Each component: .html + .png preview +
│                                  short note on which design-library PDFs
│                                  it appears in.
│
├── templates/                  ← INPUT — drop new .txt/.docx files here
│   └── README.md                  for styling. Pipeline picks them up,
│                                  matches to components, surfaces gaps,
│                                  then emits to documents/<slug>/.
│
└── documents/                  ← FINISHED documents, one folder per doc
    └── professional-purpose/      with source + html + pdf alongside.
        ├── ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.txt    (author source)
        ├── ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.docx   (author source, same content)
        ├── ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.html   (intermediate, styled)
        └── ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.pdf    (final deliverable)
```

### Conventions
- **Document folder slugs** under `documents/` use lowercase kebab-case Latin
  (e.g., `professional-purpose/`), so they're terminal-friendly.
- **Files inside** keep the natural Russian name — the final PDF inherits
  it, which matters when sharing with students.
- **Source content** (`.txt` / `.docx`) and **build artifacts** (`.html` /
  `.pdf`) live side-by-side per document. Source is authoritative; if they
  drift, the `.docx` from Anastasia wins.
- **`design-library/` is read-only.** Don't edit those PDFs — they are
  the visual ground truth.

---

## 2. Reference implementation

### 2.1 Files
- **Source content:**
  `documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.txt`
  + `.docx` (same content)
- **Styled HTML:**
  `documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.html`
  (single self-contained file — CSS inline, fonts via Google Fonts CDN)
- **Rendered PDF:**
  `documents/professional-purpose/ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.pdf`
  (~10 pages, A4)

### 2.2 Render command
Run from the document's own folder:

```sh
cd materials/documents/professional-purpose
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.pdf" \
  "file://$(pwd)/ПРОФЕССИОНАЛЬНОЕ%20ПРЕДНАЗНАЧЕНИЕ.html"
```

### 2.3 Tool dependencies
- **Headless Chrome** — already on the system at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- **Poppler (`pdftoppm`)** — installed via Homebrew. Used to **inspect**
  source PDFs by rendering pages to PNG so we can read the design (and to
  preview our own output during development).

---

## 3. Design tokens

### 3.1 Color palette
| Role               | Hex       | Used for                                      |
|--------------------|-----------|-----------------------------------------------|
| `--plum-900`       | `#2d1b26` | H1/H2 titles, brand-dark text                 |
| `--plum-800`       | `#3a2530` | Body strong, `<strong>`                       |
| `--plum-700`       | `#5e2a3b` | Top pill background, `<em>`                   |
| `--plum-600`       | `#6b2f44` | Reserved (deeper accents)                     |
| `--mauve-500`      | `#9c5871` | Sub-headers, glyphs, subtitle, footer         |
| `--mauve-400`      | `#b07a8e` | Section glyph rows                            |
| `--mauve-300`      | `#d4a8b8` | Dividers, dotted ends, wheel ring             |
| `--mauve-200`      | `#e5c9d3` | Cover decoration, spokes, secondary lines     |
| `--pink-100`       | `#f5e6eb` | Item-pill background                          |
| `--pink-50`        | `#faeef2` | Callout / outro box background                |
| `--ink`            | `#3a2530` | Body                                          |
| `--ink-soft`       | `#4a3340` | Author meta                                   |

### 3.2 Typography
- **Body:** Inter 400/500/600/700/800 (Google Fonts).
- **Symbols / glyphs:** Noto Sans Symbols 2 → fallback Apple Symbols → Segoe UI Symbol.
- **Body size:** 11.5pt, line-height 1.55, `text-align: justify; hyphens: auto;`.
- **Titles:** uppercase, letter-spacing 0.02–0.06em depending on size.
- **Page:** A4, margins 18mm all sides (cover) / 18mm all sides (content).

---

## 4. Component library (current state)

Each component below lives in the reference HTML
(`documents/professional-purpose/*.html`). When extracted into a real
library under `components/`, each should get: (a) a CSS class, (b) a sample
render PNG, (c) a usage note.

### Built ✅

| ID                | What it is                                                      | Source ref in `design-library/`         |
|-------------------|------------------------------------------------------------------|------------------------------------------|
| `pill-top`        | Burgundy top pill, "БОНУСНЫЙ МАТЕРИАЛ" / "УРОК N: …" badge       | `урок 1.pdf` p1, `Стихии и кресты .pdf` p1 |
| `cover-block`     | Title + subtitle + decorative wheel + author + handle            | `Кармические узлы.pdf` p1, `Самоучитель по аспектам.pdf` p1 |
| `zodiac-wheel`    | CSS-only 12-glyph wheel (two rings + 12 spokes + center dot)     | New (echoes wheel illustration on covers) |
| `cover-decor-corner` | Faint radial lines top-right & bottom-left of cover           | `Кармические узлы.pdf` p1 (background lines) |
| `doc-title` / `doc-subtitle` | Centered uppercase title + mauve subtitle               | All урок / Аспекты PDFs                  |
| `section`         | Centered uppercase section header                                | "ОСНОВНЫЕ ПРАВИЛА АСТРОЛОГА" — `урок 1.pdf` p2 |
| `section-mark`    | Tiny centered glyph row above a section                          | New (extends the design)                 |
| `section-note`    | Italic mauve centered subtitle under a section                   | "(это делает программа…)" — `Стихии и кресты .pdf` p2 |
| `item` + `item-label` | Sign/planet pill with **glyph + name** in mauve              | `Кармические узлы.pdf` p3 zodiac table   |
| `glyph-sash`      | Horizontal row of 12 zodiac / 10 planet glyphs between sections  | New                                      |
| `callout`         | Light-pink rounded info box                                      | "Например:" — `урок 1.pdf` p1 bottom     |
| `outro`           | Pink rounded box, course pitch + bold course name                | New (echoes callout style)               |
| `divider`         | Mauve bar with dot caps                                          | New                                      |
| `handle`          | Centered `@li_astrology_` footer wrapped in `✦`                  | `Кармические узлы.pdf` p1 handle         |

### Seen in source PDFs but not yet built ❌
> These are the next things to extract when growing the library.

| Wanted ID            | Where it appears                                             | Notes                                                       |
|----------------------|--------------------------------------------------------------|-------------------------------------------------------------|
| `bullet-list-rail`   | `Аспекты солнца и луны.pdf` p5 ("ОБЩАЯ ПРОРАБОТКА"), `Стихии и кресты .pdf` p2 ("Система баллов") | Bulleted list where dots are connected by a vertical mauve line |
| `two-col-list`       | `урок 2 (2).pdf` p1 (Плюсы/Минусы)                           | Two columns of bulleted lists side-by-side                  |
| `zodiac-table`       | `Кармические узлы.pdf` p3 ("ИНТЕРПРЕТАЦИЯ УЗЛОВ")            | Multi-column table: Sign-glyph cell + Skills cell + Sign-glyph cell + Tasks cell |
| `inline-note`        | `Кармические узлы.pdf` p2                                    | Italic intro paragraph in mauve, just below a heading       |
| `mid-doc-pill`       | `Стихии и кресты .pdf` p1 (top pill repeated mid-doc)        | The same `pill-top` reused as a section header on inner pages |
| `sign-pill-with-ruler` | `урок 2 (2).pdf` p1 (ОВЕН pill + "планета управитель — Марс, 1-й дом") | Pill with a small subtitle line beneath the bold name       |
| `callout-emphasis`   | `Стихии и кресты .pdf` p2 ("Та стихия, которая наберет больше баллов…") | Pink rounded line that's a single emphatic sentence, no border |
| `numbered-list`      | `Стихии и кресты .pdf` p2 ("1. Берёте 10 планет…")           | Decimal numbered list, indented sub-bullets                 |
| `page-footer`        | All large PDFs                                               | Centered page number + right-aligned `li_astrology_` handle |
| `bg-planet-watermark`| `Кармические узлы.pdf` p2 (Mars planet on right)             | Large semi-transparent planet image bleeding off page edge  |
| `chapter-cover`      | `Самоучитель по аспектам.pdf` p1                             | Variant of `cover-block` for full-course books              |

---

## 5. The pipeline (vision)

```
materials/templates/  (drop .txt or .docx here)
        │
        ▼
┌─────────────────────┐
│ 1. Parser           │   Splits text into semantic blocks:
│                     │   doc-title, section, item-label, paragraph,
│                     │   bullet-list, table, callout, outro …
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ 2. Component matcher│   For each block, picks a component from the
│                     │   library. Uses heuristics + the rules in §6.
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ 3. Gap report       │   Lists every block that didn't match a
│                     │   component, every rule that conflicts, every
│                     │   image/asset that's missing.
└─────────────────────┘
        │
        ▼  (human review — verify the mapping, accept / fix)
        │
┌─────────────────────┐
│ 4. HTML assembler   │   Concatenates component templates into one
│                     │   styled HTML file using shared design tokens.
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ 5. PDF render       │   Headless Chrome → final A4 PDF.
└─────────────────────┘
        │
        ▼
materials/documents/<slug>/   (.txt/.docx/.html/.pdf bundled together)
```

### 5.1 What each stage actually outputs
- **Parser:** a JSON tree, e.g. `[{type: 'doc-title', text: '…'}, {type: 'section', text: '…', items: [...]}]`.
- **Matcher:** the same tree annotated with `component: 'item-label'`, `variant: 'with-glyph'`.
- **Gap report:** human-readable Markdown — "Block 14 — looks like a 2-col table but no `two-col-list` template exists yet."
- **Assembler:** one `*.html` file in the new document's folder.
- **Renderer:** `*.pdf` next to the HTML.

### 5.2 Status
- Stage 4–5 work today via the reference implementation.
- Stages 1–3 don't exist yet — for now, the assembler is hand-written HTML.
  The pipeline becomes worth building once the second or third document
  reuses ≥80% of the same components.

---

## 6. Rules system (MUST / DON'T)

The pipeline needs a small rule DSL so the user can constrain output without
editing CSS. Initial categories:

### 6.1 Layout rules
- `MUST start on new page` — applies to any block (typically `section` or
  `chapter-cover`). Implemented via `page-break-before: always;`.
- `MUST stay together` — block can't be split across pages
  (`page-break-inside: avoid;`). Already used on every `item`.
- `MUST be the only thing on the page` — for `chapter-cover` and full-bleed
  illustrations.

### 6.2 Background / decoration rules
- `MUST have background: planet-watermark(<planet>)` — applies a
  `bg-planet-watermark` to the page.
- `MUST have corner-decor` — applies `cover-decor-corner` to a content page,
  not just the cover.

### 6.3 Style rules
- `DON'T use callout for paragraphs > N lines` — pink callouts get visually
  heavy past ~5 lines; long emphasis should use `outro` or plain emphasis.
- `DON'T put two pills back-to-back` — the eye reads them as competing
  headers.
- `DON'T center-align body paragraphs` — only titles, subtitles, and notes
  are centered. Body is justified.

### 6.4 Content rules
- `MUST have author block on cover` — Анастасия Лисовская + `@li_astrology_`.
- `MUST end with outro pitch box on bonus / lesson materials` — the
  "Обучение астрологии" block.

### 6.5 How rules are expressed
Per-document YAML sidecar (proposal — not yet built):

```yaml
# materials/documents/professional-purpose/rules.yaml
rules:
  - target: section[text="Обучение астрологии"]
    must: [start_on_new_page]
  - target: item[name="Плутон"]
    must: [stay_together]
  - target: page[after=cover]
    must: [corner_decor]
```

---

## 7. Component library deliverable (when we build it)

Target folder layout under `components/`:

```
components/
├── README.md                  ← visual index, screenshots of every component
├── tokens.css                 ← :root color/spacing/font tokens, single source
├── pill-top.html              ← one self-contained example each
├── pill-top.png               ← rendered preview
├── cover-block.html
├── cover-block.png
└── …
```

The **visual index** (`components/README.md`) is the most important artifact.
It should let Anastasia visually pick components without reading code:
thumbnail + name + 1-line description + which `design-library/` PDFs use it.

Pipeline code (parser, matcher, assembler) lives outside `materials/` —
probably `tools/pdf-pipeline/` at the project root — to keep `materials/`
purely content.

---

## 8. Things to suggest / improve over time

> Claude — review this list each session and bring up anything still
> outstanding once the immediate task is done.

- **Page numbering & repeating footer.** The source PDFs all have a
  centered page number + right-aligned handle. Currently we only have a
  single end-of-doc handle. Add as a `@page` rule once we have multiple
  multi-page documents.
- **Display serif for titles?** Source titles look like sans, but a subtle
  contrast (e.g., a quiet display serif for the H1 only) could elevate
  cover pages further. Try and compare.
- **Per-course theming.** If `astro-z-0` and `aspekty-pro` ever need
  distinct accent colors, factor `--plum-700` etc. into per-course token
  files under `components/themes/`.
- **Asset pipeline for backgrounds.** `bg-planet-watermark` needs actual
  planet PNGs. Worth extracting them out of
  `design-library/Кармические узлы.pdf` once with `pdfimages`, save under
  `components/assets/planets/`.
- **Cyrillic font tightness.** Inter handles Cyrillic well but the bold
  weights look slightly heavier than the source. Try Manrope or Onest as
  alternatives if Anastasia notes a difference.
- **Glyph rendering on Linux.** If we ever render in CI (not local Mac
  Chrome), Apple Symbols won't be there — make sure Noto Sans Symbols 2
  is bundled or `@font-face`-loaded with a real `unicode-range` covering
  U+2600–U+26FF.
- **Source-of-truth for content.** Documents keep both `.docx` + `.txt`.
  Pick `.docx` (author's workflow) and have the parser convert at build
  time, so the two never drift.
- **Auto-detect glyph for sign/planet.** When the parser sees "Овен" /
  "Солнце" / etc., it should automatically attach the correct Unicode
  glyph — no need for the author to type it.
- **Sanity-check page count.** The pipeline should warn if a single
  document blows past ~25 pages — usually means a missed split into
  chapters.

---

## 9. Session log

> Append-only. Newest first.

### 2026-05-16 — Folder restructure
- **Renamed** `course_pdfs/` → `materials/`.
- **Reorganized** into four subfolders with clear roles:
  `design-library/` (read-only source PDFs), `components/` (future lib),
  `templates/` (input drop zone), `documents/` (finished per-doc bundles).
- **Moved** the in-flight ПРОФЕССИОНАЛЬНОЕ work into
  `documents/professional-purpose/`.
- **Added** placeholder READMEs to `components/` and `templates/` so future
  drops have clear instructions.
- **Updated** this doc throughout for the new paths and added §1 (Folder
  layout) as the orientation map.

### 2026-05-16 — Initial system extracted
- **Built:** `ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.{html,pdf}` from the matching
  `.txt` / `.docx`. 10 pages, A4.
- **Catalogued:** the components in §4 (built + not-yet-built).
- **Established:** color tokens, fonts, render command (§2–3).
- **Drafted:** the pipeline + rules vision (§5–6) — not yet implemented.
- **Open follow-ups:** see §8. Highest-value next step is building
  `bullet-list-rail` and `zodiac-table` (used widely in source PDFs) and
  starting `components/README.md` with sample renders.
