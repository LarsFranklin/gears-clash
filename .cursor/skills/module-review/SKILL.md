---
name: module-review
description: Systematisches Feature/Modul-Review mit GitLab-Integration. Nutzen bei "Review", "/modul-review", "GC-REVIEW", "Code prüfen", "Modul analysieren".
---

# Modul-Review

Dieser Skill beschreibt den vollständigen Ablauf eines systematischen Feature- oder Modul-Reviews mit automatischer GitLab-Issue-Erstellung.

## Trigger

Das Review wird ausgelöst durch:

- **`/modul-review [Feature-Name]`**
- **`GC-REVIEW [Feature-Name]`** (Projektkürzel)

Konfiguriert in `.cursor/rules/review-trigger.mdc`.

**Issue-Titel:** **`[Präfix] - Kurztitel`**. Review-Hauptissue: **`[Review] - <Modulname>`**. Sub-Issues: **`[Parent] - #<IID>`** in der Beschreibung.

## Ablauf-Referenz

Der gesamte Reviewprozess ist in `REVIEW.md` im Projektroot definiert. **Beim Start eines Reviews IMMER zuerst `REVIEW.md` vollständig lesen.**

## Kurzübersicht des Prozesses

### 1. Vorbereitung

1. `REVIEW.md` lesen
2. Review-Issue finden oder erstellen (siehe `review-auto-issue.mdc`)
3. Relevante Skills laden (z. B. `pixi-slot-renderer`, `slot-game-architecture` je nach Modul)

### 2. Analyse (Schritte 1–6 aus REVIEW.md)

1. **Kontext erfassen** – Dateien, Abhängigkeiten, Engines, Renderer, Adapter
2. **Code-Analyse** – Jede Datei einzeln und vollständig einlesen
3. **IST-Zustand** – Übersicht aller Funktionen, Klassen, Events, States
4. **Architektur prüfen** – Trennung Engine/Renderer/UI/Adapter, Public API, Dateigröße
5. **Fehlerbehandlung prüfen** – `try/catch`, Fehler-Events, `hostAdapter.onError`
6. **Konsistenz prüfen** – Benennung, `gc-*`-CSS-Konvention, Event-Namen

### 3. Dokumentation (Schritt 7 aus REVIEW.md)

Findings werden kategorisiert und als GitLab-Issues erstellt:

| Kategorie | Issue-Behandlung |
|-----------|------------------|
| Klein | Alle in ein gemeinsames Issue bündeln: `[Fixes] - <Modul>` (`type::bug` + `priority::low`) |
| Mittel | Eigenes Issue pro Finding |
| Groß | Eigenes Issue pro Finding, Fix über Planungsmodus |

**Jedes Issue braucht:**

- Labels: `type::*` + `priority::*` + `module::*` (oder `feature::*`)
- Milestone: aktueller Entwicklungs-Milestone
- Verlinkung: `[Parent] - #IID` zum Review-Issue in der Beschreibung
- Beschreibung: Datei, Zeile, Problem, Lösungsvorschlag

### 4. Abschluss-Prüfung (Schritt 8 aus REVIEW.md – PFLICHT!)

Am Ende MUSS jedes erstellte Issue einzeln geprüft werden:

- [ ] Labels vollständig (`type` + `priority` + `module`/`feature`)?
- [ ] Milestone zugewiesen?
- [ ] Mit Review-Issue verlinkt (`[Parent] - #IID`)?
- [ ] Beschreibung verständlich mit Datei/Zeile/Problem/Lösung?

**Das Review gilt erst als abgeschlossen, wenn alle Issues diese Prüfung bestanden haben.**

## Grundregeln

1. **Dokumentation vor Fix** – Erst Issue erstellen, dann fixen
2. **Geplant vor umgesetzt** – Fixes im Planungsmodus vorbereiten
3. **„Fix me"-Freigabe** – Nach Dokumentation darf autonom gefixt werden
4. **Zwei Perspektiven** – Isoliert (Modul) + App-Kontext (Integration in `GearsClashGame.runSpin`)

## Verwandte Dateien

- `REVIEW.md` – Vollständiger Reviewprozess
- `.cursor/rules/review-trigger.mdc` – Trigger-Erkennung
- `.cursor/rules/review-auto-issue.mdc` – Automatische Issue-Suche/Erstellung
- `.cursor/skills/gitlab-integration/SKILL.md` – GitLab-Tooling
- `.cursor/skills/slot-game-architecture/SKILL.md` – Architektur-Referenz für Engine/Renderer/Adapter
- `.cursor/skills/pixi-slot-renderer/SKILL.md` – Pixi-spezifische Patterns
