---
name: issue-execution-management
description: Verbindlicher Ablauf beim Bearbeiten von Issues – Assignee, Meilenstein/Version, Start/Due-Dates, Time Tracking. Nutzen bei "Issue bearbeiten", "/issue-work", "GC-ISSUE", "Milestone", "Release", "Version".
---

# Issue Execution Management

Dieser Skill stellt sicher, dass bei der Bearbeitung von GitLab-Issues organisatorische Pflichtfelder immer gepflegt werden.

## Trigger (explizit, wie Modul-Review)

Der **explizite Issue-Arbeitsmodus** wird ausgelöst durch:

- **`/issue-work`** — optional mit Issue-Referenz, z. B. `/issue-work #42` oder `/issue-work https://…/issues/42`
- **`GC-ISSUE`** — Projektkürzel für Gears Clash
- **Optional im selben Prompt:** Ziel-Meilenstein/Version, z. B. `Milestone: v0.2.0`, `Version: 0.3`, „für Release **v0.3**", „Issues für Meilenstein **x**"

Konfiguriert in `.cursor/rules/issue-execution-trigger.mdc`.

**Bei einem dieser Trigger:** diesen Skill **vollständig** lesen; Issue-Referenz **und** (falls genannt) Ziel-Meilenstein aus der Nachricht ableiten — fehlt die Referenz, nach IID/Link fragen; fehlt der Meilenstein bei Release-Arbeit, nach dem Ziel-Meilenstein fragen.

## Wann nutzen

Nutze diesen Skill immer, wenn ein Issue:

- gestartet wird
- aktiv bearbeitet wird
- pausiert oder übergeben wird
- abgeschlossen wird

Typische Trigger: „Issue bearbeiten", „Task anfangen", „Bug fixen", „Review-Issues abarbeiten", „offene Tickets", **`/issue-work`**, **`GC-ISSUE`**, „für Version … / Meilenstein …".

## Pflichtfelder pro Issue

Für jedes bearbeitete Issue müssen diese Punkte erfüllt sein:

1. **Assignee gesetzt**
   - Genau eine verantwortliche Person während aktiver Bearbeitung.
   - Bei Übergabe Assignee aktiv umstellen.

2. **Meilenstein / Version (Release-Ziel)**
   - In GitLab: **Milestone** = Release-Meilenstein (z. B. `v0.2.0`).
   - Jedes Issue einem passenden Meilenstein zuweisen (`milestone_id` über API), konsistent zu `gitlab-conventions.mdc`.
   - Arbeitet die Session **für einen bestimmten Meilenstein** (z. B. „wir räumen alles für **v0.3** auf"), müssen alle bearbeiteten Issues **diesen Meilenstein** haben — fehlt er, setzen; passt er nicht, mit dem Nutzer klären und ggf. umziehen.
   - Meilenstein-Titel in GitLab folgen `vMAJOR.MINOR.PATCH` — bei Unsicherheit `list_milestones` nutzen, um Titel und ID zu finden.

3. **Dates gepflegt**
   - `Start Date` setzen, sobald mit der Arbeit begonnen wird.
   - `Due Date` setzen oder aktualisieren, sobald ein Zieltermin bekannt ist.

4. **Time Tracking gepflegt**
   - Gearbeitete Zeit regelmäßig protokollieren (`add spent time` / `time spent`).
   - Nur reale Arbeitszeit buchen, keine Schätzwerte als Ist-Zeit.

## Standard-Ablauf

1. Issue öffnen und kurz Scope prüfen.
2. Assignee prüfen/setzen.
3. Meilenstein prüfen/setzen (Ziel-Version / Release; bei Release-Fokus explizit abstimmen).
4. Start Date setzen (falls noch leer und Arbeit beginnt).
5. Due Date prüfen/setzen.
6. Arbeit durchführen.
7. Nach Arbeitsblock Zeit buchen (Time Tracking).
8. Vor Statuswechsel/Abschluss Pflichtfelder erneut prüfen.

## Definition of Done (Issue-Administration)

Ein Issue gilt aus Administrationssicht nur dann als sauber bearbeitet, wenn:

- Assignee korrekt gesetzt ist
- Meilenstein zum Release-Ziel passt (oder bewusst gesetzt/verschoben)
- Start- und Due-Date gesetzt oder bewusst aktualisiert wurden
- Arbeitszeit im Time Tracking erfasst wurde

## Agent-Verhalten

- Fehlen diese Felder, muss der Agent sie vor Abschluss der Bearbeitung ergänzen.
- Wenn Informationen fehlen (z. B. Due Date oder Ziel-Meilenstein unklar), aktiv beim Nutzer nachfragen.
- Kein „Issue fertig", solange Assignee, Meilenstein (Release-Ziel), Dates und Time Tracking nicht geprüft wurden.

## Verwandte Dateien

- `.cursor/rules/issue-execution-management.mdc` — immer gültige Pflichtregel (Assignee, Dates, Time Tracking, Meilenstein)
- `.cursor/rules/issue-execution-trigger.mdc` — Slash/Kürzel für expliziten Modus
- `.cursor/rules/gitlab-conventions.mdc` — Milestone, Labels, Issue-Titel
- `.cursor/skills/gitlab-integration/SKILL.md` — GitLab MCP (Issues aktualisieren, `milestone_id`, Notizen, Time spent wo unterstützt)
