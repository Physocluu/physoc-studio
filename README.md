# PhySoc — Monthly "What's On" calendar (v3)

A flexible monthly events template blending the **academic** side of the identity
(Space Grotesk headings, atom mark, IBM Plex Mono meta) with the **social** side
(Baloo 2 titles, rounded cards, bright colour-coded type tags). The contour-line
background and dark glowing footer are pulled from the real social-post template.

v3 simplifies the header (no "PHYSICS SOCIETY" / session-year line — just the
logo lockup and the month title) and boosts footer legibility (larger, bolder
handle + link line, lines eased back behind the text).

## Files
- `physoc_whatson_story.png` / `.svg` — 1080×1920 story/portrait (~5–8 events)
- `physoc_whatson_square.png` / `.svg` — 1080×1080 feed post (~3–5 events)
- `physoc_calendar.py` — the generator you reuse each month

PNGs are post-ready; SVGs are editable in Figma (standard Space Grotesk / Baloo 2 /
IBM Plex Mono families + weights).

## Update each month
Edit the block at the bottom of `physoc_calendar.py` and run. Rows auto-stack and
re-balance for any number of events — adding/removing a slot is just editing the list.

```python
MONTH, YEAR = 10, 2026
FOOTER = "dark"     # "dark" (lines glow on a dark band) or "light" (lines on paper)
EVENTS = [
    {"day":9,"weekday":"Thu","title":"Quantum Computing Talk",
     "time":"18:00","place":"Roger Stevens LT 20","type":"talk"},
]
```
```
python3 physoc_calendar.py --fmt both --footer dark
python3 physoc_calendar.py --footer light      # try the lighter footer
```

## Event types (social ⇄ academic)
`social` lime · `workshop` mint · `trip` leaf · `careers` ink · `talk` forest.

## Notes
- `YEAR` still drives the month name lookup internally — it's just no longer printed
  on the poster. Keep setting it correctly when you edit the block.
- Footer reads "FULL DETAILS · LINK IN BIO" — swap in your Linktree, or drop a QR into
  the footer band for a print version.
- Titles auto-truncate past ~26 chars, meta past ~40 — keep them punchy.

