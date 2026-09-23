#!/usr/bin/env python3
"""Build a karaoke .ass subtitle file from captions.json (word timings).

Style: brand Montserrat ExtraBold, big centred captions sitting over the dark
shirt (~74% height). Words sweep from mauve (upcoming) to white (spoken) via
\\kf karaoke, with a wine outline + soft shadow for legibility over video.
"""
import json
import sys
from pathlib import Path

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src/captions.json")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("reel.ass")

data = json.loads(SRC.read_text())
pages = data["pages"]


def tc(t: float) -> str:
    if t < 0:
        t = 0
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,Montserrat ExtraBold,76,&H00FFFFFF,&H00A091B2,&H002C151A,&H96000000,0,0,0,0,100,100,0,0,1,5,3,2,90,90,470,1

[Events]
Format: Layer, Start, End, Style, MarginL, MarginR, MarginV, Effect, Text
"""

lines = [HEADER]
for i, p in enumerate(pages):
    start = float(p["start"])
    # Hold the line a touch past the last word, but never into the next page.
    end = float(p["end"]) + 0.30
    if i + 1 < len(pages):
        end = min(end, float(pages[i + 1]["start"]) + 0.02)

    parts = []
    prev_end = start
    for tok in p["tokens"]:
        gap = int(round((float(tok["start"]) - prev_end) * 100))
        if gap > 0:
            parts.append(f"{{\\kf{gap}}} ")  # silent gap on a nbsp
        dur = max(1, int(round((float(tok["end"]) - float(tok["start"])) * 100)))
        text = tok["text"].replace("{", "(").replace("}", ")")
        parts.append(f"{{\\kf{dur}}}{text} ")
        prev_end = float(tok["end"])

    body = "".join(parts).rstrip()
    lines.append(
        f"Dialogue: 0,{tc(start)},{tc(end)},Karaoke,90,90,470,,{body}"
    )

OUT.write_text("\n".join(lines) + "\n")
print(f"{len(pages)} pages -> {OUT}")
