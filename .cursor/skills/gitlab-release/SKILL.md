---
name: gitlab-release
description: Release auf GitLab veröffentlichen (Release anlegen, Release-Notes aus geschlossenen Issues, optionale Assets). Nutzen bei "Release auf GitLab", "Version veröffentlichen", "v0.x.0 Release".
---

# GitLab Release veröffentlichen

## Wann diesen Skill nutzen

- Nutzer sagt: „Release auf GitLab veröffentlichen", „neue Version auf GitLab releasen", „v0.2.0 als Release anlegen".
- Nach einer Versionserhöhung in `package.json`, wenn der Nutzer den Release explizit veröffentlichen will.

## Wichtig: KEIN Pflicht-Changelog im Repo

Gears Clash pflegt **keinen** dauerhaften `CHANGELOG.md`. Release-Notes werden aus den **auf dem Milestone geschlossenen GitLab-Issues** generiert.

## Ablauf

### 1. Version prüfen

Quelle der Wahrheit: `package.json` → Feld `version` (z. B. `0.2.0`). Tag wird daraus abgeleitet → `v0.2.0`.

### 2. Milestone identifizieren

Der Milestone in GitLab heißt im Regelfall genau wie der Tag, z. B. `v0.2.0`.

```
list_milestones mit:
  - project_id: "franklin-slots/gears-clash"
  - state: "active"
```

→ Den Milestone wählen, der zur veröffentlichten Version passt. Bei Unsicherheit den Nutzer fragen.

### 3. Release-Notes aus Issues bauen

```
list_issues mit:
  - project_id: "franklin-slots/gears-clash"
  - milestone: "v0.2.0"
  - state: "closed"
  - per_page: 100
```

Notes nach `type::*` gruppieren — empfohlene Reihenfolge:

```markdown
## Features
- #IID - [Feature] - …
- #IID - [Epic]    - …

## Verbesserungen
- #IID - [Enhancement] - …

## Bugfixes
- #IID - [Bug]      - …
- #IID - [Incident] - …

## Wartung
- #IID - [Task]  - …
- #IID - [Chore] - …
- #IID - [Docs]  - …
```

Vor dem Anlegen den Vorschlag dem Nutzer zur Freigabe zeigen.

### 4. GitLab Release erstellen (via MCP)

```
create_release mit:
  - project_id: "franklin-slots/gears-clash"
  - tag_name: "v0.2.0"
  - name: "v0.2.0"
  - description: <vorbereiteter Markdown-Text aus Schritt 3>
  - ref: "main"
  - milestones: ["v0.2.0"]
```

### 5. Optionale Release-Assets

Falls Build-Artefakte (z. B. `dist/`-ZIP oder npm-Pack) angehängt werden sollen und Links/Upload geklärt sind:

```
create_release mit:
  - assets:
      links:
        - name: "gears-clash-game-0.2.0.tgz"
          url:  "https://…"
          link_type: "package"
```

### 6. Optional: GitLab Package Registry / npm

Nur ausführen, wenn der Nutzer den Upload-Befehl explizit anstößt und die Tokens vorbereitet sind:

```powershell
# Beispiel — exakte Skripte ergänzen, sobald sie im Repo existieren
$env:GITLAB_TOKEN = "<token>"
npm pack
# … Upload-Schritt entsprechend Registry-Konfiguration
```

## Was der Agent kann vs. nicht kann

| Aktion | Via MCP möglich? |
|--------|------------------|
| Release erstellen | Ja (`create_release`) |
| Tag erstellen | Ja (typisch über `create_release` mit `ref`) |
| Release-Notizen setzen | Ja (`description`) |
| Asset-Links hinzufügen | Ja (`assets.links`) |
| Dateien direkt hochladen | Oft nein – ggf. im Web-Interface |
| Package Registry / npm Upload | Nur mit Token / vorhandenem Skript |

## Verhalten des Agents

- **Build ausführen:** Nur nach ausdrücklicher Bestätigung des Nutzers (`npm run build`).
- **Tag/Release erstellen:** Nutzer fragen, bevor der Release angelegt wird; Notes-Vorschlag vorzeigen.
- **Push:** Vor dem Push warnen, dass GitLab ggf. Pipelines auslöst.

## Verwandte Dateien

- `package.json` – Quelle der Versionsnummer
- `.gitlab/README.md` – Issue-/Label-Konventionen
- `.cursor/skills/gitlab-integration/SKILL.md` – MCP-Tooling
