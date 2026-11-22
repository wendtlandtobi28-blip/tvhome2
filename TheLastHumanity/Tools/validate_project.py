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
    for name in ("HalfLength", "HalfWidth", "WallHeight", "PortalX"):
        m = re.search(rf"{name}\s*=\s*([0-9.]+)f", text)
        if m:
            consts[name] = float(m.group(1))
    return consts


def column_positions(half_width: float) -> list[tuple[float, float]]:
    # muss zu ATLHHallBuilder::BuildHall passen (i * 550 + 275, +-(HalfWidth - 220))
    return [(i * 550.0 + 275.0, s * (half_width - 220.0)) for i in range(-3, 4) for s in (-1, 1)]


def auto_location(index: int, count: int, half_length: float) -> tuple[float, float]:
    # muss zu ATLHHallBuilder::GetAutoLocation passen
    start_x = -half_length + 600.0
    end_x = half_length - 800.0
    step = (end_x - start_x) / (count - 1) if count > 1 else 0.0
    return (start_x + index * step, -450.0 if index % 2 == 0 else 450.0)


VALID_MONUMENTS = {"feuer", "obelisk", "zikkurat", "kugel", "bogen", "turm", "keiner"}
MONUMENT_RADIUS = 260.0  # groesste Monumentausdehnung um (0, 0)
PORTAL_CLEARANCE = 450.0


def is_latin1(text: str) -> bool:
    try:
        text.encode("latin-1")
        return True
    except UnicodeEncodeError:
        return False


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
    # Quelldateien und Gesamtdatei synchron?
    kap_dir = ROOT / "Content" / "Data" / "kapitel"
    if kap_dir.exists():
        src = [json.loads(f.read_text(encoding="utf-8")) for f in sorted(kap_dir.glob("kap*.json"))]
        same = [c["id"] for c in sorted(src, key=lambda c: c["number"])] == [c["id"] for c in data.get("chapters", [])] and \
            sum(len(c["infoPoints"]) for c in src) == sum(len(c["infoPoints"]) for c in data.get("chapters", []))
        check(same, "content_de.json entspricht den Kapiteldateien", "content_de.json veraltet - 'python3 Tools/merge_content.py' ausfuehren")

    check(isinstance(data.get("ui"), dict) and data["ui"], "Abschnitt 'ui' vorhanden", "Abschnitt 'ui' fehlt")
    chapters = data.get("chapters", [])
    check(isinstance(chapters, list) and chapters, f"{len(chapters)} Kapitel vorhanden", "Keine Kapitel")

    ids: set[str] = set()
    numbers = []
    content_errors_before = len(errors)
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
        if ch.get("available") and not (12 <= len(points) <= 15):
            errors.append(f"Kapitel {cid}: {len(points)} Erinnerungen, erwartet 12-15")
        for field in ("title", "era"):
            if not is_latin1(str(ch.get(field, ""))):
                errors.append(f"Kapitel {cid}: '{field}' enthaelt Zeichen ausserhalb Latin-1 (3D-Schrift)")
        theme = ch.get("theme")
        if not isinstance(theme, dict):
            errors.append(f"Kapitel {cid}: 'theme' fehlt")
        else:
            for col in ("floor", "wall", "column", "torch"):
                v = theme.get(col)
                if not (isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) and 0 <= x <= 1 for x in v)):
                    errors.append(f"Kapitel {cid}: theme.{col} muss [r, g, b] mit Werten 0..1 sein")
            if theme.get("monument") not in VALID_MONUMENTS:
                errors.append(f"Kapitel {cid}: theme.monument ungueltig ({theme.get('monument')})")
            if theme.get("columnShape") not in ("rund", "eckig"):
                errors.append(f"Kapitel {cid}: theme.columnShape muss 'rund' oder 'eckig' sein")
        for p in points:
            pid = p.get("id", "")
            if pid in ids:
                errors.append(f"Doppelte ID: {pid}")
            ids.add(pid)
            for field in ("id", "title", "short", "long", "kind"):
                if not str(p.get(field, "")).strip():
                    errors.append(f"Erinnerung {pid or '?'}: Feld '{field}' fehlt/leer")
            if p.get("kind") not in ("fakt", "fiktion"):
                errors.append(f"Erinnerung {pid}: 'kind' muss 'fakt' oder 'fiktion' sein")
            if len(p.get("short", "")) >= len(p.get("long", "")):
                errors.append(f"Erinnerung {pid}: Kurzfassung ist nicht kuerzer als die ausfuehrliche Fassung")
            if len(p.get("short", "")) > 260:
                warnings.append(f"Erinnerung {pid}: Kurzfassung hat {len(p['short'])} Zeichen (Ziel <= 260)")
            if not is_latin1(p.get("title", "")):
                errors.append(f"Erinnerung {pid}: Titel enthaelt Zeichen ausserhalb Latin-1 (3D-Schrift)")
        arts = ch.get("artifacts", [])
        if len(arts) != 4:
            errors.append(f"Kapitel {cid}: {len(arts)} Artefakte, erwartet 4")
        for a in arts:
            if a.get("id") in ids:
                errors.append(f"Doppelte ID: {a.get('id')}")
            ids.add(a.get("id"))
            if not (a.get("title") and a.get("text")):
                errors.append(f"Artefakt {a.get('id')}: Titel oder Text fehlt")
        echo = ch.get("echo") or {}
        if not (echo.get("name") and echo.get("role") and len(echo.get("lines", [])) >= 3):
            errors.append(f"Kapitel {cid}: Zeitzeugen-Echo unvollstaendig (Name, Rolle, mind. 3 Zeilen)")
        elif not is_latin1(echo["name"]):
            errors.append(f"Kapitel {cid}: Echo-Name ausserhalb Latin-1 (3D-Schrift)")
        quiz = ch.get("quiz", [])
        if len(quiz) != 3:
            errors.append(f"Kapitel {cid}: {len(quiz)} Wissensfragen, erwartet 3")
        for q in quiz:
            opts = q.get("options", [])
            if not q.get("q") or len(opts) != 3 or not isinstance(q.get("correct"), int) or not (0 <= q["correct"] < len(opts)):
                errors.append(f"Kapitel {cid}: Wissensfrage fehlerhaft: {q.get('q', '?')[:40]}")
            if len(set(opts)) != len(opts):
                errors.append(f"Kapitel {cid}: doppelte Antwortmoeglichkeit in '{q.get('q', '')[:40]}'")
    if len(errors) == content_errors_before:
        passed.append("Alle Kapitel: Pflichtfelder, Erinnerungen (12-15), Artefakte (4), Echo, Wissensfragen (3), Themen in Ordnung")

    ending = data.get("ending", {})
    check(bool(str(ending.get("title", "")).strip()) and bool(str(ending.get("text", "")).strip()),
          "Abspann (ending) vorhanden", "Abspann 'ending' mit 'title' und 'text' fehlt")
    total = sum(len(c.get("infoPoints", [])) for c in chapters)
    passed.append(f"{total} Erinnerungen, {sum(len(c.get('artifacts', [])) for c in chapters)} Artefakte, "
                  f"{sum(len(c.get('quiz', [])) for c in chapters)} Wissensfragen insgesamt")
    check(numbers == list(range(1, len(numbers) + 1)), "Kapitelnummern fortlaufend ab 1",
          f"Kapitelnummern nicht fortlaufend: {numbers}")
    check(any(c.get("available") for c in chapters), "Mindestens ein spielbares Kapitel",
          "Kein Kapitel ist spielbar ('available': true)")
    return data


# ---------------------------------------------------------------- 2. UI-Schluessel
def validate_ui_keys(data: dict) -> None:
    ui = data.get("ui", {})
    used: set[str] = set()
    key_re = re.compile(r'TEXT\("([a-z]+\.[a-z_]+)"\)')
    for f in SRC.rglob("*.cpp"):
        used |= set(key_re.findall(f.read_text(encoding="utf-8")))
    web_src = ROOT.parent / "TheLastHumanity_Web" / "src"
    if web_src.exists():
        web_used = set()
        for f in web_src.glob("*.js"):
            web_used |= set(re.findall(r"T\('([a-z]+\.[a-z_]+)'", f.read_text(encoding="utf-8")))
        web_missing = sorted(web_used - set(ui))
        check(not web_missing, f"Browser-Version: alle {len(web_used)} verwendeten UI-Schluessel existieren",
              f"Browser-Version: UI-Schluessel fehlen: {web_missing}")
        used |= web_used
    missing = sorted(used - set(ui))
    unused = sorted(set(ui) - used)
    check(not missing, f"Alle {len(used)} im Code verwendeten UI-Schluessel existieren",
          f"UI-Schluessel fehlen in der JSON-Datei: {missing}")
    if unused:
        warnings.append(f"Unbenutzte UI-Schluessel: {unused}")
    expected = {
        "hud.interact": 1, "hud.interact_again": 1, "chapters.locked": 1,
        "info.chapter": 2, "chapters.heading": 2, "chapters.discovered": 2, "chapters.complete": 2,
        "chapters.total": 2, "hud.portal_locked": 2, "hud.portal_next": 2, "portal.label_next": 2,
        "toast.chapter": 2, "ending.stats": 2, "hud.chapter": 4,
    }
    for key, value in ui.items():
        n_used = len(set(re.findall(r"\{(\d+)\}", value)))
        want = expected.get(key, 0)
        if n_used != want:
            errors.append(f"UI-Text {key}: {n_used} Platzhalter, erwartet {want}")
    for key in ("portal.label_next", "portal.label_end"):
        if key in ui and not is_latin1(ui[key]):
            errors.append(f"UI-Text {key} wird als 3D-Schrift gezeigt und muss Latin-1 sein")


# ---------------------------------------------------------------- 2b. Story (Browser-Version)
def validate_story() -> None:
    p = ROOT / "Content" / "Data" / "story_de.json"
    if not p.exists():
        return
    try:
        st = json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"story_de.json ist kein gueltiges JSON: {exc}")
        return
    chars = st.get("characters", {})
    bad = [(k, l.get("who")) for k, lines in st.get("dialogues", {}).items() for l in lines if l.get("who") not in chars or not l.get("text")]
    check(not bad, f"Story: {sum(len(v) for v in st.get('dialogues', {}).values())} Dialogzeilen mit bekannten Sprechern",
          f"Story: Dialogzeilen mit unbekanntem Sprecher/leerem Text: {bad[:5]}")
    for key in ("kommandantin_start", "kommandantin_wait", "kommandantin_report", "kommandantin_final"):
        if key not in st.get("dialogues", {}):
            errors.append(f"Story: Dialog '{key}' fehlt")
    check(len(st.get("abilities", [])) == 6, "Story: 6 Faehigkeiten definiert", "Story: es muessen genau 6 Faehigkeiten sein")
    world = ROOT.parent / "TheLastHumanity_Web" / "src" / "world.js"
    if world.exists():
        m = re.search(r"crystals: \[(.*?)\]\s*\n", world.read_text(encoding="utf-8"))
        n_pos = len(re.findall(r"\[-?\d+, -?\d+\]", m.group(1))) if m else -1
        check(n_pos == len(st.get("crystals", [])), f"Story: {n_pos} Kristallpositionen = {len(st.get('crystals', []))} Kristalltexte",
              f"Story: Kristallpositionen ({n_pos}) und Kristalltexte ({len(st.get('crystals', []))}) passen nicht zusammen")
    sq = st.get("sidequests", [])
    bad_sq = []
    for q in sq:
        t = q.get("task", {})
        ok = q.get("giver") in chars and q.get("intro") and q.get("done") and t.get("type") in ("fetch", "deliver", "visit") and t.get("label")
        if t.get("type") in ("fetch", "visit"):
            ok = ok and isinstance(t.get("pos"), list) and len(t["pos"]) == 2 and (t["pos"][0] ** 2 + t["pos"][1] ** 2) ** 0.5 < 44
        if t.get("type") == "deliver":
            ok = ok and t.get("to") in chars and t.get("to") != q.get("giver")
        for l in q.get("intro", []) + q.get("done", []):
            ok = ok and l.get("who") in chars
        if not ok:
            bad_sq.append(q.get("id"))
    check(sq and not bad_sq, f"Story: {len(sq)} Nebenquests vollstaendig", f"Story: fehlerhafte Nebenquests {bad_sq}")
    ids = [l["id"] for l in st.get("landmarks", [])]
    check(sorted(ids) == ["archivtor", "aussicht", "denkmal"], "Story: 3 Wahrzeichen", f"Story: Wahrzeichen {ids}")


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
    validate_story()
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
