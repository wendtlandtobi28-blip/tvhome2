#!/usr/bin/env python3
"""
Baut Content/Data/content_de.json aus den Quelldateien:
  Content/Data/basis_de.json        (Sprache, UI-Texte, Abspann)
  Content/Data/kapitel/kapNN.json   (je ein Kapitel: Erinnerungen, Artefakte, Echo, Wissensfragen)

Aufruf:  python3 Tools/merge_content.py   (aus dem Ordner TheLastHumanity)
"""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "Content" / "Data"
basis = json.loads((DATA / "basis_de.json").read_text(encoding="utf-8"))
chapters = []
for f in sorted((DATA / "kapitel").glob("kap*.json")):
    ch = json.loads(f.read_text(encoding="utf-8"))
    if "reuse" in ch and ch["reuse"]:
        raise SystemExit(f"{f.name}: Feld 'reuse' ist noch nicht aufgeloest")
    ch.pop("reuse", None)
    ch.setdefault("available", True)
    chapters.append(ch)
chapters.sort(key=lambda c: c["number"])
out = {"schemaVersion": 3, "language": basis.get("language", "de"), "ui": basis["ui"], "ending": basis["ending"], "chapters": chapters}
(DATA / "content_de.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
n = sum(len(c["infoPoints"]) for c in chapters)
print(f"content_de.json: {len(chapters)} Kapitel, {n} Erinnerungen, "
      f"{sum(len(c.get('artifacts', [])) for c in chapters)} Artefakte, {sum(len(c.get('quiz', [])) for c in chapters)} Wissensfragen")
