# Components Library

Reusable design components for building styled course PDFs.

**Authority:** [`tokens.json`](tokens.json) (machine-readable, extracted from
`../design-library/`) > [`../PDF_BUILDER_RULES.md`](../PDF_BUILDER_RULES.md)
(human spec) > anything else.

## Files

| File | Purpose |
|---|---|
| [`tokens.css`](tokens.css) | CSS custom properties — single source of truth for colours, sizes, fonts. Every component references these. |
| [`tokens.json`](tokens.json) | Machine-readable tokens + provenance (which PDF, how many uses) |
| [`components.css`](components.css) | All component classes |
| [`showcase.html`](showcase.html) | One-stop visual gallery — open in browser to see every component |
| [`showcase.pdf`](showcase.pdf) | Same, rendered for offline review |
| `showcase-page-N.png` | Page-by-page previews of the showcase |
| `assets/` | Photoreal planets + zodiac wheel + cover backgrounds, extracted from `../design-library/Кармические узлы.pdf` |

## Visual showcase

> Open `showcase.html` in a browser, or page through `showcase-page-*.png`.

- Page 1 — `pill-top`, `doc-title` + `doc-subtitle`, `section` group, `item-label` intro
- Page 2 — `item-label--filled`, `glyph-sash`, `inline-note`
- Page 3 — `callout`, `bullet-list-rail`, `bullet-term-list`
- Page 4 — `planet-decor` (Venus / Moon / Saturn), `outro`, `divider`
- Page 5 — `handle`, `cover` (full mini-preview with real zodiac wheel + bg)

## Component inventory

### Built ✅

| Class | Description | Variants |
|---|---|---|
| `.pill-top` + `.pill-top--row` | Top-of-page badge | (none yet) |
| `.cover`, `.cover-title`, `.cover-sub`, `.cover-author`, `.cover-handle` | Full cover layout | (none yet) |
| `.cover-bg-network` | Full-bleed line-network cover background | — |
| `.cover-bg-gradient` | Full-bleed soft-pink corner gradient | — |
| `.cover-wheel`, `.cover-wheel.left` | Half zodiac wheel bleeding off page edge | left, right |
| `.doc-title` + `.doc-subtitle` | In-page title + strapline | — |
| `.section-mark` + `.section` + `.section-note` | Section break group | — |
| `.item` + `.item-label` (+ `.item-label--filled`) | Sign/planet entry with glyph + name | light card (default), solid accent |
| `.lead` | Body paragraph | — |
| `.inline-note` | Italic intro paragraph in accent | — |
| `.glyph-sash` | Horizontal divider with glyph row | — |
| `.callout` (+ `.label`) | Light card / info box | — |
| `.outro` (+ `.outro-mark`) | End-of-doc course pitch box | — |
| `.bullet-list-rail` | List with vertical mauve rail through dots | — |
| `.bullet-term-list` (+ `.term`) | Bold accent term — em-dash — body | — |
| `.entity-table` (+ `.entity-cell` + `.content-cell` + `.entity-col`) | 2-column reference table: glyph + name &#124; description. Header row repeats across page breaks; rows kept together. | `--filled-head` (solid accent header) |
| `.planet-decor` | Photoreal planet + dashed orbital ring + 2 nodes | venus, moon, saturn (via image src); `--right-bleed`, `--left-bleed`, `--large` |
| `.divider` | Hairline rule with dot caps | — |
| `.handle` | End-of-doc footer with @li_astrology_ | — |
| `.mid-doc-pill` | Dusty-pink solid pill used as in-body section header | multi-line supported |
| `.sign-pill` (+ `.name` + `.ruler`) | Pill with bold uppercase name + small subtitle line | — |
| `.two-col-list` (+ `.col` + `<h4>`) | Two-column bulleted lists side-by-side (e.g. Плюсы / Минусы) | — |
| `.definition-list` (+ `.def` + `.def-term` + `.def-hint`) | Glossary block: bold caps term + italic hint — body | — |
| `.numbered-list-badge` | Numbered list with mauve square badges containing white digit | — |
| `.key-value-list` (+ `.kv-row` + `.kv-key`) | Bold mauve label + value, no bullets | — |
| `.subhead-label` | Bold caps left-aligned header for inline lists (`ЛУННЫЕ ФУНКЦИИ ПСИХИКИ:`) | — |
| `.subhead-aspect` | Left-aligned mauve uppercase h3-style (aspect names, modes) | — |
| `.callout--centered` | Variant of callout — bold centered emphasis line | modifier on `.callout` |

### Not yet built ❌

| Wanted | Where it appears | Notes |
|---|---|---|
| `numbered-list` (plain) | `design-library/Стихии и кресты .pdf` p2 | Plain decimal numbered list (no badge) with sub-bullets. Use `.numbered-list-badge` for now or add native `<ol>` style. |
| `chart-callout` | `design-library/урок 3.pdf` p2 | Small labeled callouts pointing at a chart with leader lines. Composite, low reuse — defer until needed. |
| `page-footer-circle` | All large PDFs | Page number in dusty-pink circle. **Blocked** — needs Puppeteer/Playwright; Chrome CLI ignores `--print-to-pdf-footer-template`. |
| `running-author-header` | Anastasia's brief §5 | Italic small author signature at top of every page. Same blocker. |

## How to use

In any document HTML:

```html
<head>
  <link rel="stylesheet" href="../../components/tokens.css">
  <link rel="stylesheet" href="../../components/components.css">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:..." rel="stylesheet">
</head>
<body>
  <div class="pill-top--row"><div class="pill-top">МОЙ МАТЕРИАЛ</div></div>
  <h1 class="doc-title">Заголовок</h1>
  <div class="doc-subtitle">Подзаголовок</div>

  <h2 class="section">Раздел</h2>
  <div class="item">
    <div class="item-label"><span class="glyph">♈</span><span class="name">Овен</span></div>
    <p class="item-text">…</p>
  </div>

  <div class="callout">
    <p class="label">Например:</p>
    <p>Пояснение…</p>
  </div>

  <div class="outro">
    <p>Финальная подача курса…</p>
  </div>
  <div class="handle"><span class="star">✦</span><strong>@li_astrology_</strong><span class="star">✦</span></div>
</body>
```

Then render with headless Chrome:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="output.pdf" \
  "file://$(pwd)/document.html"
```

## Provenance

All design tokens are **extracted from**, not invented:

- Палитра (#4c272f ink, #b291a0 accent): aggregated drawing fills across
  `Кармические узлы.pdf` (~12,500 uses of ink) and confirmed cross-doc in
  `Стихии и кресты .pdf` + `урок 1.pdf`.
- Font (Montserrat Regular/SemiBold/Bold): pulled from real text spans in
  `урок 1.pdf` — the only PDF in the library where text wasn't converted
  to outline paths.
- Asset images: bit-for-bit copies of the originals embedded in
  `Кармические узлы.pdf`. Run `tools/pdf-pipeline/extract.py` on any PDF
  to extract images from it.

See `tokens.json` for the full provenance trail.
