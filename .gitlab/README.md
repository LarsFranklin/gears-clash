# GitLab Issue Templates & Boards (Gears Clash)

Dieser Ordner enthält strukturierte Vorlagen für GitLab-Issues. Sie werden im GitLab-Web-Interface automatisch angeboten, wenn ein neues Issue erstellt wird (`franklin-slots/gears-clash`).

## Issue-Titel (Pflicht)

**`[Präfix] - Kurztitel`** — z. B. `[Bug] - …`, `[Task] - …`, `[Review] - <Modul>`, `[Fixes] - <Modul>` (Sammel). Verweis auf Eltern-/Review-Issue: **`[Parent] - #IID`** in der Beschreibung. Details: `.cursor/rules/gitlab-conventions.mdc`.

## Verfügbare Templates

| Template | Wann verwenden | Label |
|----------|---------------|-------|
| **[Bug.md](issue_templates/Bug.md)** | Fehler, Abstürze, falsches Verhalten | `type::bug` |
| **[Task.md](issue_templates/Task.md)** | Konkrete Aufgaben, Implementierungen | `type::task` |
| **[Issue.md](issue_templates/Issue.md)** | Übergeordnete Problemfelder mit mehreren Sub-Issues | `type::issue` |
| **[Epic.md](issue_templates/Epic.md)** | Große Feature-Blöcke mit mehreren Tasks | `type::epic` |
| **[Incident.md](issue_templates/Incident.md)** | Kritische Ausfälle, Datenverlust, Blocker | `type::incident` |

## Standard-Labels

### Typ-Labels (`type::`)

| Label | Farbe | Beschreibung |
|-------|-------|--------------|
| `type::bug` | `#CC0000` (rot) | Fehler und Bugs |
| `type::task` | `#0052CC` (blau) | Konkrete Aufgaben und Implementierungen |
| `type::feature` | `#428BCA` (hellblau) | Neue Funktionalität |
| `type::epic` | `#6B3FA0` (lila) | Große Feature-Blöcke mit mehreren Tasks |
| `type::incident` | `#D94612` (orange) | Kritische Ausfälle und Blocker |
| `type::issue` | `#CCAC00` (gelb) | Übergeordnete Problemfelder |
| `type::enhancement` | `#5CB85C` (grün) | Verbesserung bestehender Features |
| `type::chore` | `#7F8C8D` (grau) | Wartung, Refactoring, Dependencies |
| `type::docs` | `#F0AD4E` (orange-gelb) | Dokumentation |

### Prioritäts-Labels (`priority::`)

| Label | Farbe | Beschreibung |
|-------|-------|--------------|
| `priority::critical` | `#CC0000` (rot) | Sofort beheben |
| `priority::high` | `#D94612` (orange) | Nächster Sprint |
| `priority::medium` | `#CCAC00` (gelb) | Eingeplant |
| `priority::low` | `#009933` (grün) | Irgendwann |

### Status-Labels (`status::`) — für Issue Boards

| Label | Farbe | Beschreibung |
|-------|-------|--------------|
| `status::in-progress` | `#3498DB` (blau) | In Bearbeitung |
| `status::review` | `#9B59B6` (lila) | Im Review |
| `status::blocked` | `#E74C3C` (rot) | Blockiert durch Abhängigkeit |

### Modul- / Feature-Labels (Pflicht: eines davon pro Issue)

Empfohlene Bereich-Labels für Gears Clash. Farben sind Vorschläge — beim Anlegen final wählen.

#### `module::*` — technische Bereiche (Code-Pfade)

| Label | Bereich |
|-------|---------|
| `module::core` | `src/core/` — SlotEngine, ReelEngine, PayoutEngine, BonusEngine, SymbolRegistry |
| `module::renderer` | `src/renderer/` — PixiSlotRenderer, ReelColumn, Animationen, Symbole |
| `module::adapters` | `src/adapters/` — GameApiAdapter, HttpGameApiAdapter, MockGameApiAdapter, errors |
| `module::ui` | `src/ui/` — HudController, ButtonController, BonusOverlayController |
| `module::config` | `src/config/` — Types, defaultGameConfig, assetManifest, gameConfig.schema.json |
| `module::build` | Vite/TS-Build, `package.json`, `scripts/`, `tsconfig*.json` |
| `module::demo` | `index.html`, `src/demo/` — lokale Vorschau |
| `module::ci` | `.gitlab-ci.yml`, Pipelines, Releases |
| `module::docs` | README, `.gitlab/`, `.cursor/skills/` |

#### `feature::*` — fachliche Bereiche

| Label | Bereich |
|-------|---------|
| `feature::base-game` | Standard-Spin-Flow (5×5, Reels, Win-Feedback) |
| `feature::bonus-gears-clash` | Gears-Clash-Bonus |
| `feature::bonus-heist-run` | Heist-Run-Bonus |
| `feature::bonus-deadlock-mode` | Deadlock-Mode-Bonus |
| `feature::host-integration` | HostAdapter, IIFE/ESM-Distribution, Schema-Export |
| `feature::audio` | `GameSoundAdapter`, Sound-Hooks |

## Modul-Review (Hauptissues)

Titel: **`[Review] - <Name>`**. Sub-Issues: **`[Parent] - #<IID>`** in der Beschreibung. Details: [`REVIEW.md`](../REVIEW.md).

## Issue Board einrichten

Die `status::`-Labels bilden die **Spalten** des Issue Boards. Für ein Kanban-Board:

```
Open → In Progress → Review → Blocked → Closed
        (status::     (status::  (status::
        in-progress)  review)    blocked)
```

### Board im GitLab-Web-Interface konfigurieren

1. Projekt öffnen → **Plan** → **Issue Boards**
2. Auf **„New list"** klicken
3. Label `status::in-progress` auswählen → Liste erstellen
4. Wiederholen für `status::review` und `status::blocked`
5. Spalten per Drag & Drop in die richtige Reihenfolge bringen

### Weitere Board-Optionen

- **Board nach Typ:** Spalten mit `type::bug`, `type::task`, `type::feature`
- **Board nach Priorität:** Spalten mit `priority::critical` bis `priority::low`
- **Board nach Modul:** Spalten mit `module::core`, `module::renderer`, `module::adapters`, …

## Releases — kein Pflicht-Changelog

Wir pflegen **keinen** dauerhaften `CHANGELOG.md`. Stattdessen:

- Jedes Issue/Task/Bug bekommt einen Milestone (z. B. `v0.2.0`).
- Beim Release werden die **geschlossenen Issues dieses Milestones** als Release-Notes gruppiert (Skill `gitlab-release`).
- Damit ist die History dauerhaft in GitLab nachvollziehbar — ohne separate Changelog-Datei pflegen zu müssen.

## Für AI-Agents

Agents sollen diese Templates und Labels kennen und verwenden:

- **Bug gefunden?** → `Bug.md`-Template, Label `type::bug` + `priority::*` + `module::*`/`feature::*`
- **Neue Aufgabe?** → `Task.md`-Template, Label `type::task` + `priority::*` + `module::*`/`feature::*`
- **Größeres Feature planen?** → `Epic.md` als Rahmen, einzelne `Task.md` für die Schritte
- **Kritischer Ausfall?** → `Incident.md` mit Schweregrad und Zeitlinie
- **Bei expliziten Triggern** (`/bugfix-request`, `/feature-request`, `/modul-review`) wird das Issue **direkt** angelegt — siehe Skills im `.cursor/skills/`-Ordner.

### Agent-Verhalten bei Issue-Erstellung

1. Passendes Template anhand des Typs wählen.
2. Alle relevanten Felder ausfüllen (leere Platzhalter entfernen).
3. **Typ-Label** setzen (z. B. `type::bug`).
4. **Prioritäts-Label** setzen (z. B. `priority::high`).
5. **Modul- oder Feature-Label** setzen.
6. **Milestone** zuweisen (aktueller Entwicklungs-Milestone).
7. Bei Bugs: Reproduktionsschritte und erwartetes vs. tatsächliches Verhalten angeben.
8. Bei Tasks: Akzeptanzkriterien definieren.
9. **Immer den Nutzer fragen**, bevor ein Issue erstellt wird — außer bei expliziten Slash-Triggern.

### Agent-Verhalten bei Status-Änderung

- Issue beginnt ohne Status-Label (steht in „Open" im Board).
- Bei Arbeitsbeginn: `status::in-progress` setzen.
- Bei fertig / Review nötig: `status::review` setzen.
- Bei Blockade: `status::blocked` setzen + Kommentar mit Grund.
- Bei Abschluss: Issue schließen (verschwindet in „Closed").
