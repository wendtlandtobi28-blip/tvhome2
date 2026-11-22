#!/usr/bin/env python3
"""
Erzeugt aus den gemeinsamen Quellen die lauffaehige Browser-Version:
  - js/content_de.js  aus ../TheLastHumanity/Content/Data/content_de.json (einzige Inhaltsquelle)
  - index.html        = page.html in einem vollstaendigen HTML-Dokument (Doppelklick, offline, GitHub Pages)

Aufruf:  python3 tools/build.py   (aus dem Ordner TheLastHumanity_Web)
"""
import json
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent
SOURCE = WEB.parent / "TheLastHumanity" / "Content" / "Data" / "content_de.json"

data = json.loads(SOURCE.read_text(encoding="utf-8"))
js = ("/* Automatisch erzeugt aus TheLastHumanity/Content/Data/content_de.json - nicht von Hand bearbeiten.\n"
      "   Neu erzeugen: python3 tools/build.py */\n"
      "window.TLH_CONTENT = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
(WEB / "js" / "content_de.js").write_text(js, encoding="utf-8")

page = (WEB / "page.html").read_text(encoding="utf-8")
head_end = page.index("</style>") + len("</style>")
index = ("<!doctype html>\n<html lang=\"de\">\n<head>\n<meta charset=\"utf-8\">\n"
         "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
         + page[:head_end] + "\n</head>\n<body>\n" + page[head_end:].lstrip("\n") + "</body>\n</html>\n")
(WEB / "index.html").write_text(index, encoding="utf-8")

print(f"js/content_de.js: {len(data['chapters'])} Kapitel, "
      f"{sum(len(c['infoPoints']) for c in data['chapters'])} Erkenntnisse, {len(data['ui'])} UI-Texte")
print("index.html erzeugt")
