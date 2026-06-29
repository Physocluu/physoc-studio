# PhySoc — Monthly "What's On" calendar 


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
- `YEAR` still drives the month name lookup internally so it's just no longer printed
  on the poster. Keep setting it correctly when you edit the block.
- Titles auto-truncate past ~26 chars, meta past ~40 

