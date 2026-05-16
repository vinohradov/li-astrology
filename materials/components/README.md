# Components

Empty for now. This is where the **reusable design components** extracted from
`../design-library/` will live, once the component library is built.

Target layout (see [`../PDF_DESIGN_SYSTEM.md`](../PDF_DESIGN_SYSTEM.md) §6):

```
components/
├── README.md          ← visual index (this file, eventually rewritten)
├── tokens.css         ← single source of truth for colors/fonts/spacing
├── pill-top.html      ← one self-contained example per component
├── pill-top.png       ← rendered preview (so you can browse visually)
├── cover-block.html
├── cover-block.png
├── item-label.html
├── item-label.png
└── …
```

Until that exists, the reference implementation in
[`../documents/professional-purpose/`](../documents/professional-purpose/) is
the source of truth — every component currently used lives inside that single
HTML file with inline CSS.

See [`../PDF_DESIGN_SYSTEM.md`](../PDF_DESIGN_SYSTEM.md) §3 for the full list
of **built** vs **not-yet-built** components.
