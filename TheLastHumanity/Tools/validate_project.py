#!/usr/bin/env python3
"""
Statische Projektpruefung fuer THE LAST HUMANITY.

Prueft alles, was OHNE Unreal Engine pruefbar ist:
  1. Inhaltsdatei (JSON): Syntax, Pflichtfelder, eindeutige IDs, Positionen
  2. UI-Texte: jeder im C++-Code verwendete Schluessel existiert in der JSON-Datei
  3. C++-Quelltexte: nur ASCII, generated.h-Einbindung, Klammerbilanz,
     projektinterne #include-Pfade existieren
  4. Projektdateien: .uproject ist gueltiges JSON, Modulname stimmt

Ersetzt KEINE Kompilierung mit Unreal Build Tool!

Aufruf:  python3 Tools/validate_project.py   (aus dem Ordner TheLastHumanity)
Exitcode 0 = alle Pruefungen bestanden.
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Source" / "TheLastHumanity"
CONTENT = ROOT / "Content" / "Data" / "content_de.json"

errors: list[str] = []
warnings: list[str] = []
passed: list[str] = []


def check(cond: bool, ok_msg: str, err_msg: str) -> bool:
    if cond:
        passed.append(ok_msg)
    else:
        errors.append(err_msg)
    return cond


# ---------------------------------------------------------------- Hallenmasse
def hall_constants() -> dict[str, float]:
    text = (SRC / "World" / "TLHHallBuilder.h").read_text(encoding="utf-8")
    consts = {}
    for name in ("HalfLength", "HalfWidth", "WallHeight"):
        m = re.search(rf"{name}\s*=\s*([0-9.]+)f", text)
        if m:
            consts[name] = float(m.group(1))
    return consts


def column_positions(half_width: float) -> list[tuple[float, float]]:
    # muss zu ATLHHallBuilder::BuildHall passen (i * 550 + 275, +-(HalfWidth - 220))
    return [(i * 550.0 + 275.0, s * (half_width - 220.0)) for i in range(-3, 4) for s in (-1, 1)]


def start_location() -> tuple[float, float]:
    text = (SRC / "Core" / "TLHGameMode.h").read_text(encoding="utf-8")
    m = re.search(r"GetStartLocation\(\)\s*\{\s*return FVector\(([-0-9.]+)f,\s*([-0-9.]+)f", text)
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)


# ---------------------------------------------------------------- 1. Inhalte
def validate_content() -> dict:
    try:
        data = json.loads(CONTENT.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Inhaltsdatei ist kein gueltiges JSON: {exc}")
        return {}
    passed.append("Inhaltsdatei ist gueltiges UTF-8-JSON")

    check(isinstance(data.get("ui"), dict) and data["ui"], "Abschnitt 'ui' vorhanden", "Abschnitt 'ui' fehlt")
    chapters = data.get("chapters", [])
    check(isinstance(chapters, list) and chapters, f"{len(chapters)} Kapitel vorhanden", "Keine Kapitel")

    hall = hall_constants()
    hl, hw = hall.get("HalfLength", 0), hall.get("HalfWidth", 0)
    cols = column_positions(hw)
    start = start_location()

    ids: set[str] = set()
    numbers = []
    for ch in chapters:
        cid = ch.get("id", "")
        for field in ("id", "title", "era", "summary"):
            if not str(ch.get(field, "")).strip():
                errors.append(f"Kapitel {cid or '?'}: Feld '{field}' fehlt/leer")
        if cid in ids:
            errors.append(f"Doppelte ID: {cid}")
        ids.add(cid)
        numbers.append(ch.get("number"))
        points = ch.get("infoPoints", [])
        if ch.get("available") and not points:
            errors.append(f"Kapitel {cid} ist spielbar, hat aber keine Informationspunkte")

        locs = []
        for p in points:
            pid = p.get("id", "")
            if pid in ids:
                errors.append(f"Doppelte ID: {pid}")
            ids.add(pid)
            for field in ("id", "title", "short", "long", "kind"):
                if not str(p.get(field, "")).strip():
                    errors.append(f"Infopunkt {pid or '?'}: Feld '{field}' fehlt/leer")
            if p.get("kind") not in ("fakt", "fiktion"):
                errors.append(f"Infopunkt {pid}: 'kind' muss 'fakt' oder 'fiktion' sein")
            if len(p.get("short", "")) >= len(p.get("long", "")):
                errors.append(f"Infopunkt {pid}: Kurzfassung ist nicht kuerzer als die ausfuehrliche Fassung")
            if len(p.get("short", "")) > 260:
                warnings.append(f"Infopunkt {pid}: Kurzfassung hat {len(p['short'])} Zeichen (Ziel <= 260)")
            loc = p.get("location")
            if not (isinstance(loc, list) and len(loc) == 3 and all(isinstance(v, (int, float)) for v in loc)):
                errors.append(f"Infopunkt {pid}: 'location' muss [x, y, z] sein")
                continue
            x, y = loc[0], loc[1]
            if abs(x) > hl - 100 or abs(y) > hw - 100:
                errors.append(f"Infopunkt {pid}: Position {loc} liegt ausserhalb/zu nah an der Hallenwand")
            for cx, cy in cols:
                if math.hypot(x - cx, y - cy) < 120:
                    errors.append(f"Infopunkt {pid}: kollidiert mit Saeule bei ({cx}, {cy})")
            if math.hypot(x - start[0], y - start[1]) < 150:
                errors.append(f"Infopunkt {pid}: zu nah am Startpunkt")
            locs.append((pid, x, y))

        for i in range(len(locs)):
            for j in range(i + 1, len(locs)):
                d = math.hypot(locs[i][1] - locs[j][1], locs[i][2] - locs[j][2])
                if d < 400:
                    errors.append(f"Infopunkte {locs[i][0]} und {locs[j][0]} nur {d:.0f} cm auseinander (< 400)")

    check(numbers == list(range(1, len(numbers) + 1)), "Kapitelnummern fortlaufend ab 1",
          f"Kapitelnummern nicht fortlaufend: {numbers}")
    check(any(c.get("available") for c in chapters), "Mindestens ein spielbares Kapitel",
          "Kein Kapitel ist spielbar ('available': true)")
    if not any(e.startswith("Infopunkt") or e.startswith("Doppelte") or e.startswith("Kapitel ") for e in errors):
        passed.append("Alle Infopunkte: Pflichtfelder, Kennzeichnung, Positionen und Abstaende in Ordnung")
    return data


# ---------------------------------------------------------------- 2. UI-Schluessel
def validate_ui_keys(data: dict) -> None:
    ui = data.get("ui", {})
    used: set[str] = set()
    key_re = re.compile(r'TEXT\("([a-z]+\.[a-z_]+)"\)')
    for f in SRC.rglob("*.cpp"):
        used |= set(key_re.findall(f.read_text(encoding="utf-8")))
    missing = sorted(used - set(ui))
    unused = sorted(set(ui) - used)
    check(not missing, f"Alle {len(used)} im Code verwendeten UI-Schluessel existieren",
          f"UI-Schluessel fehlen in der JSON-Datei: {missing}")
    if unused:
        warnings.append(f"Unbenutzte UI-Schluessel: {unused}")
    for key, value in ui.items():
        n_used = len(re.findall(r"\{(\d+)\}", value))
        if key in ("hud.interact", "hud.interact_again") and n_used != 1:
            errors.append(f"UI-Text {key} braucht genau einen Platzhalter {{0}}")
        if key in ("info.chapter", "chapters.heading", "chapters.discovered") and n_used != 2:
            errors.append(f"UI-Text {key} braucht Platzhalter {{0}} und {{1}}")


# ---------------------------------------------------------------- 3. C++
def strip_code(text: str) -> str:
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r'"(\\.|[^"\\])*"', '""', text)
    text = re.sub(r"'(\\.|[^'\\])'", "''", text)
    return text


def validate_cpp() -> None:
    files = sorted(list(SRC.rglob("*.h")) + list(SRC.rglob("*.cpp")) + list((ROOT / "Source").glob("*.cs"))
                   + list(SRC.glob("*.cs")))
    check(len(files) > 0, f"{len(files)} Quelltextdateien gefunden", "Keine Quelltexte gefunden")
    ascii_ok = brace_ok = gen_ok = inc_ok = True
    for f in files:
        raw = f.read_bytes()
        rel = f.relative_to(ROOT)
        try:
            raw.decode("ascii")
        except UnicodeDecodeError:
            ascii_ok = False
            errors.append(f"{rel}: enthaelt Nicht-ASCII-Zeichen (Umlaute gehoeren in die JSON-Datei)")
        text = raw.decode("utf-8", errors="replace")
        code = strip_code(text)
        for o, c in ("{}", "()", "[]"):
            if code.count(o) != code.count(c):
                brace_ok = False
                errors.append(f"{rel}: Klammerbilanz {o}{c} stimmt nicht ({code.count(o)} / {code.count(c)})")
        if f.suffix == ".h" and re.search(r"^\s*(UCLASS|USTRUCT|UENUM)\s*\(", text, re.M):
            gen = f'#include "{f.stem}.generated.h"'
            includes = re.findall(r'^\s*#include\s+"[^"]+"', text, re.M)
            if not includes or includes[-1].strip() != gen:
                gen_ok = False
                errors.append(f"{rel}: '{gen}' fehlt oder ist nicht das letzte #include")
        for inc in re.findall(r'^\s*#include\s+"([^"]+)"', text, re.M):
            if inc.endswith(".generated.h"):
                continue
            top = inc.split("/")[0]
            if top in ("Core", "World", "UI", "Save") or inc == "TheLastHumanity.h":
                if not (SRC / inc).exists():
                    inc_ok = False
                    errors.append(f"{rel}: #include \"{inc}\" verweist auf fehlende Projektdatei")
        if f.suffix == ".cpp" and f.parent != SRC:
            own = f.with_suffix(".h")
            if not own.exists():
                errors.append(f"{rel}: zugehoerige Headerdatei fehlt")
    if ascii_ok:
        passed.append("Alle C++/C#-Quelltexte sind reines ASCII")
    if brace_ok:
        passed.append("Klammerbilanz {} () [] in allen Quelltexten ausgeglichen")
    if gen_ok:
        passed.append("generated.h-Einbindung in allen reflektierten Headern korrekt")
    if inc_ok:
        passed.append("Alle projektinternen #include-Pfade existieren")


# ---------------------------------------------------------------- 4. Projekt
def validate_project_files() -> None:
    try:
        up = json.loads((ROOT / "TheLastHumanity.uproject").read_text(encoding="utf-8"))
        names = [m.get("Name") for m in up.get("Modules", [])]
        check(names == ["TheLastHumanity"], ".uproject gueltig, Modul 'TheLastHumanity' eingetragen",
              f".uproject: unerwartete Module {names}")
    except Exception as exc:  # noqa: BLE001
        errors.append(f".uproject ist kein gueltiges JSON: {exc}")
    ini = (ROOT / "Config" / "DefaultEngine.ini").read_text(encoding="utf-8")
    check("GlobalDefaultGameMode=/Script/TheLastHumanity.TLHGameMode" in ini,
          "DefaultEngine.ini verweist auf TLHGameMode", "DefaultEngine.ini: GlobalDefaultGameMode fehlt/falsch")
    game_ini = (ROOT / "Config" / "DefaultGame.ini").read_text(encoding="utf-8")
    check('DirectoriesToAlwaysStageAsNonUFS=(Path="Data")' in game_ini,
          "Inhaltsordner Data wird beim Packen mitgeliefert", "DefaultGame.ini: Data wird nicht mitgeliefert")


def main() -> int:
    data = validate_content()
    if data:
        validate_ui_keys(data)
    validate_cpp()
    validate_project_files()

    print("=== THE LAST HUMANITY - statische Projektpruefung ===")
    for p in passed:
        print(f"  [OK]      {p}")
    for w in warnings:
        print(f"  [WARNUNG] {w}")
    for e in errors:
        print(f"  [FEHLER]  {e}")
    print(f"--- {len(passed)} bestanden, {len(warnings)} Warnungen, {len(errors)} Fehler ---")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
