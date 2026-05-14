---
name: gitlab-integration
description: GitLab-Integration via MCP – Issues finden, erstellen, verwalten, Labels nutzen. Nutzen bei "Issue erstellen", "Bug melden", "Issues anzeigen", "GitLab", "Bugs finden", "offene Tasks".
---

# GitLab-Integration

Dieser Skill beschreibt, wie Agents den GitLab MCP-Server nutzen, um Issues, Merge Requests, Labels und Meilensteine im Repo `franklin-slots/gears-clash` zu verwalten.

## Voraussetzungen

- GitLab MCP-Server muss in Cursor konfiguriert sein
- `.cursor/settings.json` muss `"plugins": { "gitlab": { "enabled": true } }` enthalten
- Issue Templates liegen in `.gitlab/issue_templates/` (Bug, Task, Issue, Epic, Incident)
- Aktuelles Projekt: **`franklin-slots/gears-clash`** — siehe `project-scope.mdc`

## Issue Templates

Siehe `.gitlab/README.md` für die vollständige Beschreibung. Kurzfassung:

| Typ | Template | Label | Wann |
|-----|----------|-------|------|
| Bug | Bug.md | `type::bug` | Fehler, Abstürze, falsches Verhalten |
| Task | Task.md | `type::task` | Konkrete Aufgaben, Implementierungen |
| Issue | Issue.md | `type::issue` | Übergeordnete Problemfelder |
| Epic | Epic.md | `type::epic` | Große Feature-Blöcke |
| Incident | Incident.md | `type::incident` | Kritische Ausfälle |

## Issues suchen und filtern

### Offene Issues anzeigen

```
list_issues mit:
  - project_id: "franklin-slots/gears-clash"
  - state: "opened"
  - scope: "all"
```

### Nach Label filtern

```
list_issues mit:
  - project_id: "franklin-slots/gears-clash"
  - labels: ["type::bug"]
  - state: "opened"
```

### Eigene Issues

```
my_issues mit:
  - state: "opened"
```

## Modul-Review (Ausnahme von „erst fragen")

Wenn der Nutzer ein Review per **`/modul-review`** (oder `GC-REVIEW`) startet und `Issue: auto` nutzt:

- **Haupt-Review-Issue:** Titel **`[Review] - <Modulname>`**, Labels `type::task` + `priority::medium` + passendes `module::*`.
- **Findings:** Titel z. B. **`[Bug] - …`**, in der Beschreibung **`[Parent] - #<IID>`**. Alle Titel: Schema in `gitlab-conventions.mdc`.

Siehe `REVIEW.md` und `.gitlab/README.md` → Abschnitt „Modul-Review".

## Issues erstellen

### Wichtige Regeln

1. **Immer den Nutzer fragen** bevor ein Issue erstellt wird — **außer** bei expliziten Triggern wie `/modul-review`, `/bugfix-request`, `/feature-request`.
2. **Passendes Template wählen** (Bug, Task, Issue, Epic, Incident).
3. **Alle relevanten Felder ausfüllen** — leere Platzhalter-Kommentare entfernen.
4. **Labels über API setzen** (`labels: ["type::bug", ...]`) — nicht das `/label` am Ende des Templates verlassen.
5. **Reproduktionsschritte bei Bugs** — immer angeben.
6. **Akzeptanzkriterien bei Tasks/Features** — immer definieren.

### Bug erstellen

```
create_issue mit:
  - project_id: "franklin-slots/gears-clash"
  - title: "[Bug] - <Kurztitel>"
  - description: Inhalt aus Bug.md-Template ausfüllen
  - labels: ["type::bug", "priority::*", "module::*"]
  - milestone_id: <ID des aktuellen Milestones>
```

### Task erstellen

```
create_issue mit:
  - project_id: "franklin-slots/gears-clash"
  - title: "[Task] - <Kurztitel>"
  - description: Inhalt aus Task.md-Template
  - labels: ["type::task", "priority::*", "module::*"]
  - milestone_id: <ID>
```

### Epic erstellen

```
create_issue mit:
  - project_id: "franklin-slots/gears-clash"
  - title: "[Epic] - <Themenbereich>"
  - description: Inhalt aus Epic.md-Template
  - labels: ["type::epic", "priority::*", "module::*"]
```

## Bugs automatisch erkennen

Wenn der Agent während der Arbeit einen Bug findet:

1. **Bug dokumentieren** – Was genau ist das Problem? Reproduktionsschritte?
2. **Nutzer informieren** – „Ich habe einen Bug gefunden: [Beschreibung]. Soll ich dafür ein GitLab-Issue erstellen?"
3. **Nur nach Bestätigung** – Issue mit Bug-Template erstellen.
4. **Verlinken** – Wenn der Bug mit einem bestehenden Issue zusammenhängt, verlinken.

## Issues verwalten

### Issue aktualisieren / schließen

```
update_issue mit:
  - issue_iid: "123"
  - state_event: "close" (oder "reopen")
  - labels: ["type::bug", "priority::high"]
```

### Kommentar hinzufügen

```
create_issue_note mit:
  - issue_iid: "123"
  - body: "Fix implementiert in !456"
```

## Labels verwalten

### Standard-Labels (siehe `.gitlab/README.md`)

```
create_label:
  - name: "type::bug",        color: "#CC0000"
  - name: "type::task",       color: "#0052CC"
  - name: "type::feature",    color: "#428BCA"
  - name: "type::epic",       color: "#6B3FA0"
  - name: "type::incident",   color: "#D94612"
  - name: "type::issue",      color: "#CCAC00"
  - name: "type::enhancement",color: "#5CB85C"
  - name: "type::chore",      color: "#7F8C8D"
  - name: "type::docs",       color: "#F0AD4E"
  - name: "priority::critical", color: "#CC0000"
  - name: "priority::high",     color: "#D94612"
  - name: "priority::medium",   color: "#CCAC00"
  - name: "priority::low",      color: "#009933"
  - name: "status::in-progress",color: "#3498DB"
  - name: "status::review",     color: "#9B59B6"
  - name: "status::blocked",    color: "#E74C3C"
```

### Modul-Labels für Gears Clash

Empfohlene `module::*` / `feature::*`-Labels (siehe `.gitlab/README.md`):

- `module::core` (SlotEngine, ReelEngine, PayoutEngine, BonusEngine, SymbolRegistry)
- `module::renderer` (PixiSlotRenderer, ReelColumn, Animationen)
- `module::adapters` (GameApiAdapter, HttpGameApiAdapter, MockGameApiAdapter)
- `module::ui` (HudController, ButtonController, BonusOverlayController)
- `module::config` (defaultGameConfig, types, gameConfig.schema.json, assetManifest)
- `module::build` (Vite, tsc, scripts, package.json)
- `module::demo` (index.html, src/demo/main.ts)
- `feature::base-game` (Standard-Spin-Flow)
- `feature::bonus-gears-clash` (Gears Clash Bonus)
- `feature::bonus-heist-run` (Heist Run Bonus)
- `feature::bonus-deadlock-mode` (Deadlock Mode Bonus)
- `feature::host-integration` (HostAdapter-Callbacks, IIFE/ESM-Distribution)

## Merge Requests

### MR erstellen

```
create_merge_request mit:
  - title: "feat: [Beschreibung]"
  - source_branch: "feature/xyz"
  - target_branch: "main"
  - description: "Closes #123\n\n## Änderungen\n- ..."
```

## Best Practices

1. **Conventional Commits** – `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` als Prefix.
2. **Issue-Referenzen** – `#123` in Commits und MR-Descriptions.
3. **Kleine MRs** – Fokussierte Änderungen, leichter zu reviewen.
4. **Vollständige Labels** – Jedes Issue braucht mindestens: `type::*` + `priority::*` + `module::*` (oder `feature::*`).
5. **Milestone zuweisen** – Jedes Issue dem aktuellen Entwicklungs-Milestone zuweisen.
6. **Nicht automatisch Issues erstellen** – Immer zuerst den Nutzer fragen.
   - **Ausnahme:** Modul-Review (`REVIEW.md`), `/bugfix-request`, `/feature-request` — Nutzer hat den Workflow explizit gestartet.

## Issue bearbeiten (Assignee, Meilenstein, Dates, Time Tracking)

Wenn ein Issue **aktiv umgesetzt** oder der explizite Modus läuft (`/issue-work`, `GC-ISSUE`, optional `Milestone:` / `Version:`, siehe `issue-execution-trigger.mdc`):

- Skill **`issue-execution-management`** befolgen: Assignee, **Milestone** (`milestone_id` zu Release-Ziel), Start/Due-Date und Time Tracking (spent time) vor Abschluss prüfen bzw. setzen.

## Pflicht-Checkliste für jedes Issue

Vor dem Abschluss einer Issue-Erstellung (einzeln oder im Batch) immer prüfen:

- [ ] `type::*` Label gesetzt (bug, task, feature, enhancement, ...)
- [ ] `priority::*` Label gesetzt (critical, high, medium, low)
- [ ] `module::*` oder `feature::*` Label gesetzt
- [ ] Milestone zugewiesen (aktueller Entwicklungs-Milestone)
- [ ] Verlinkung zu übergeordnetem Issue (falls Sub-Issue): `[Parent] - #IID`
- [ ] Beschreibung vollständig (Problem, Datei/Zeile, Lösungsvorschlag)
