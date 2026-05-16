# Templates — drop new content here

Drop a new `.txt` or `.docx` file here when you want it styled into a PDF.

## What happens next

1. The file is analyzed against the [component library](../components/) —
   each block (heading, paragraph, sign-list, callout, outro pitch, …) is
   matched to a known component.
2. Anything unmatched gets flagged in a **gap report** for human review
   (see [`../PDF_DESIGN_SYSTEM.md`](../PDF_DESIGN_SYSTEM.md) §4).
3. After review, the document moves into its own folder under
   [`../documents/<slug>/`](../documents/) with the rendered `.html` and
   `.pdf` alongside the source.

## What this folder is NOT for

- Not for HTML templates — those live (will live) in `../components/`.
- Not for the finished output — that goes to `../documents/<slug>/`.
- Not for source design PDFs from Anastasia — those go to
  `../design-library/`.

## Naming

Use the document's natural Russian/English name for the source file. The
pipeline will generate a kebab-case slug for the destination folder
(e.g., `ПРОФЕССИОНАЛЬНОЕ ПРЕДНАЗНАЧЕНИЕ.txt` → `professional-purpose/`).
