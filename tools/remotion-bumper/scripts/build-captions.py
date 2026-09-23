#!/usr/bin/env python3
"""Convert an mlx-whisper word-timestamp JSON into karaoke caption pages.

Each page is a short phrase (a few words) shown together; the active word is
highlighted in the player by comparing the current time against word start/end.

Output: src/captions.json  -> { fps, pages: [ {start, end, tokens:[{text,start,end}]} ] }
"""
import json
import sys
import re
from pathlib import Path

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("audio16k.json")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("src/captions.json")
# Hard cutoff: drop everything at/after this time (source audio dropped out at
# 81.7s; we end the reel cleanly at ~77s). Words starting >= cutoff are dropped.
CUTOFF = float(sys.argv[3]) if len(sys.argv) > 3 else 1e9

MAX_WORDS = 4          # max words per page
MAX_CHARS = 26         # max characters per page (big font fits ~this)
MAX_GAP = 0.7          # start a new page if silence gap exceeds this (s)
MAX_DUR = 2.6          # max page duration (s)

data = json.loads(SRC.read_text())

# Flatten all words across segments.
words = []
for seg in data.get("segments", []):
    for w in seg.get("words", []):
        text = w.get("word", "").strip()
        if not text:
            continue
        start = float(w["start"])
        end = float(w["end"])
        if start >= CUTOFF:
            continue
        if end <= start:  # zero-duration artefacts from hallucinated silence
            continue
        end = min(end, CUTOFF)
        words.append({"text": text, "start": start, "end": end})

pages = []
cur = []

def flush():
    global cur
    if not cur:
        return
    pages.append({
        "start": cur[0]["start"],
        "end": cur[-1]["end"],
        "tokens": cur,
    })
    cur = []

ENDS_SENTENCE = re.compile(r"[.!?…]$")

for i, w in enumerate(words):
    if cur:
        prev = cur[-1]
        gap = w["start"] - prev["end"]
        chars = sum(len(t["text"]) + 1 for t in cur) + len(w["text"])
        dur = w["end"] - cur[0]["start"]
        if (len(cur) >= MAX_WORDS or chars > MAX_CHARS or gap > MAX_GAP
                or dur > MAX_DUR or ENDS_SENTENCE.search(prev["text"])):
            flush()
    cur.append(w)
flush()

out = {"fps": 30, "pages": pages}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(f"{len(words)} words -> {len(pages)} pages -> {OUT}")
if pages:
    print("first page:", " ".join(t["text"] for t in pages[0]["tokens"]))
    print("last  page:", " ".join(t["text"] for t in pages[-1]["tokens"]))
