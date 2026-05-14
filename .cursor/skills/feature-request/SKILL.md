---
name: feature-request
description: Grobe Idee als strukturierten Feature Request ausarbeiten und in GitLab als Epic/Feature plus Tasks anlegen inkl. Labels; Meilenstein optional (auto, nachfragen oder Plan-Modus). Nutzen bei "/feature-request", "Feature Request", "Feature als Issues anlegen", "Backlog-Eintrag GitLab".
---

# Feature Request → strukturiert + GitLab-Issues

## Trigger

- **`/feature-request`** gefolgt von Rohtext, Stichpunkten oder teilweise ausgefüllter Vorlage (siehe unten).
- Optional in derselben Nachricht:
  - **`Meilenstein:`** / **`Milestone:`** / **`Version:`** + Ziel-Meilenstein (z. B. `v0.2.0`, Titel wie im GitLab-Milestone). **Weglassen ist erlaubt** — dann gilt die Regel unter „Meilenstein (optional)".
  - **`Modul:`** / **`feature::`** — Vorschlag für `module::*` oder `feature::*` (sonst ableiten und als **Annahme** kennzeichnen).
  - **`Umfang:`** `klein` | `mittel` | `groß` — steuert Epic vs. ein Feature-Issue vs. nur Tasks.

Konfiguriert in `.cursor/rules/feature-request-trigger.mdc`.

## Rolle des Agents

Du agierst als **Product Owner**, **Technical Writer** und **Software-Architekt**:

- Präzise, umsetzbare Formulierung; technisch sauber zum Gears-Clash-Stack passend (TypeScript, Vite, PixiJS, Adapter-Architektur — Codebase kurz prüfen, wenn nötig).
- **Keine kritischen Fakten erfinden.** Unklares als **Annahme** oder **offener Punkt** markieren.
- Ausgabe so strukturieren, dass Entwickler oder eine andere Session direkt implementieren können.

## Explizites Anlegen (kein „Soll ich Issues erstellen?")

Wer **`/feature-request`** sendet, will in der Regel **Tickets in GitLab**.
**Nicht** erneut pauschal nach Erstellung fragen — außer:

- **Meilenstein** bei **mehreren** offenen Kandidaten und **keiner** Nutzerangabe → **keine Issues anlegen**, bis geklärt (siehe „Meilenstein (optional)": Plan-Modus oder eine Rückfrage im Chat).
- **GitLab-Projekt** / `project_id` unklar → klären (Standard: `franklin-slots/gears-clash`).

Sonst: Issues anlegen wie unten beschrieben.

## Pflicht: Konventionen & Skills

- **`gitlab-conventions.mdc`** — Titel **`[Präfix] - Kurztitel`**, Labels; Meilenstein nach Möglichkeit setzen, aber **optional** (siehe unten).
- **`gitlab-integration`** — MCP: `list_milestones`, `list_issues`, `create_issue`, ggf. `update_issue`.
- Bei aktiver Umsetzung eines angelegten Issues: **`issue-execution-management`** (Assignee, Dates, Time Tracking).

### Labels (Minimum pro Issue)

- `type::*` — siehe Struktur unten.
- `priority::*` — aus Nutzerangabe oder aus Dringlichkeit/Umfang ableiten (**Annahme** nennen).
- `module::*` **oder** `feature::*` — Pflicht laut Konvention.

### Meilenstein (optional)

Der Meilenstein ist **nicht Pflicht**. Reihenfolge:

1. **Nutzer nennt** einen (`Meilenstein:` / `Milestone:` / `Version:`): `list_milestones` → passende **`milestone_id`** zuordnen (bei Treffer-Zweifel kurz nachfragen).
2. **Nutzer nennt keinen** — `list_milestones` (aktive / offene Meilensteine):
   - **Genau ein** offener Meilenstein → **automatisch** diesen setzen; in der Antwort kurz vermerken (*„Kein Meilenstein angegeben → verwendet: …"*).
   - **Keiner** vorhanden → Issues **ohne** `milestone_id` anlegen; in der Antwort vermerken (*„Kein Meilenstein im Projekt – Issues ohne Milestone."*).
   - **Mehrere** offene Meilensteine → **nicht raten**. Stattdessen:
     - **Plan-Modus:** Meilenstein-Optionen (Titel, ID, ggf. Fälligkeit) in den **Plan** schreiben und mit dem Nutzer **einen** auswählen lassen; **erst nach Bestätigung** Issues anlegen.
     - **Agent-Modus (Chat):** einmalig nummerierte Liste der Kandidaten posten und **explizit** nach der Wahl fragen; **erst nach Antwort** `create_issue` ausführen.

3. Wenn eine **`milestone_id`** feststeht, erhalten **alle** neuen Issues dieses Laufes dieselbe Zuweisung.

**Hinweis:** Steht die Meilenstein-Entscheidung aus (Punkt 2c), zählt das **nicht** als pauschales „Soll ich Issues erstellen?" — es ist die nötige Klärung einer fehlenden Pflichtangabe bei Mehrdeutigkeit.

### Doppelte Features vermeiden

Vor dem Anlegen: `list_issues` mit `search` auf Kernbegriffe des Kurztitels, `state: opened` — bei hoher Überschneidung Hinweis + nach **weiterem Issue** oder **bestehendem** fragen.

## Ausarbeitung (inhaltlich)

Aus den Rohinfos mindestens liefern (in der Antwort an den Nutzer **und** in den Issue-Beschreibungen verdichtet):

1. **Ziel & Nutzen** — warum, für wen, in welchem Spin-/Bonus-/Host-Flow.
2. **Gewünschtes Verhalten** — Kernfunktion, Eingaben/Ausgaben, UI/UX, Logik, Berechtigungen.
3. **Randfälle / Fehlerfälle** — explizit oder als offene Punkte.
4. **Funktionale & nicht-funktionale Anforderungen** (kurz).
5. **Akzeptanzkriterien** — Checkbox-Liste, testbar (z. B. „Spin-API antwortet mit X, Renderer zeigt Y").
6. **Technische Hinweise** — betroffene Layer (Core-Engine, Renderer, UI, Adapter), `GameConfig`-Felder, Schema-Änderungen, Public-API-Erweiterungen.
7. **Annahmen & offene Punkte** — eigenständiger Abschnitt.
8. **Empfohlene Umsetzungsreihenfolge** — für die späteren Task-Issues.

## GitLab-Struktur (Issues schneiden)

| Umfang | Eltern-Issue | Kinder |
|--------|-------------|--------|
| **Klein** | Ein Issue **`[Feature] - …`**, `type::feature` — volle Spec + Akzeptanzkriterien in einer Beschreibung | keine |
| **Mittel** | **`[Feature] - …`** oder **`[Epic] - …`** (`type::feature` bzw. `type::epic`) — Ziel, Kontext, Links | mehrere **`[Task] - …`**, `type::task` |
| **Groß** | **`[Epic] - …`**, `type::epic` | mehrere **`[Task] - …`**; optional erste Task „Analyse / Schnitt" |

In **jedem** Unter-Issue in der Beschreibung: **`[Parent] - #<IID>`** (IID des Eltern-Issues).

Nach Erstellung: Eltern-Beschreibung um Liste **„Verknüpfte Issues"** mit `#<IID> - Titel` ergänzen (`update_issue`), sobald alle IIDs bekannt sind.

Titel-Präfixe strikt wie `gitlab-conventions.mdc` (z. B. `[Feature] - Kurztitel`, `[Task] - Kurztitel`).

Beschreibungen an **`.gitlab/issue_templates/`** anlehnen (Epic.md / Task.md / bei reinem Feature an Issue.md-Struktur angelehnt, Titel aber `[Feature]`).

## Abschluss-Checkliste (Pflicht)

Vor Ende der Antwort prüfen und kurz bestätigen:

- [ ] Alle neuen Issues: Titel-Schema, `type` + `priority` + `module`/`feature`; **Milestone** gesetzt **oder** bewusst ausgelassen.
- [ ] Kinder mit `[Parent] - #IID`; Eltern mit verlinkter Task-Liste aktualisiert.
- [ ] Annahmen/offene Punkte für den Nutzer sichtbar.
- [ ] Links oder IIDs der angelegten Issues in der Chat-Antwort aufgeführt.

---

## Vorlage (optional an den Nutzer zum Ausfüllen)

```markdown
## Projektkontext
- **Bereich/Modul:** (core / renderer / adapters / ui / config / build / demo)
- **Tech-Hinweis (optional):**
- **Meilenstein (optional):**

## Rohwunsch
[Freitext – was soll her?]

## Problem / Bedarf
- Problem:
- Für wen:
- Kontext / Flow:

## Gewünschtes Verhalten
- Kern:
- UI/UX:
- Regeln / Berechtigungen:

## Priorität & Umfang
- Priorität: niedrig | mittel | hoch | kritisch
- Umfang: klein | mittel | groß
```

Der Agent übernimmt fehlende Kontextfelder nur als **Annahme** oder lässt sie offen.
