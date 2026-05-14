---
name: bugfix-request
description: Grobe Fehlerbeschreibung als Bug-Analyse strukturieren und in GitLab als Bug-Issue(s) anlegen inkl. Labels; Meilenstein optional (auto, ohne, Plan-Modus). Nutzen bei "/bugfix-request", "Bugfix Request", "Bug als Issue anlegen".
---

# Bugfix Request → Analyse + GitLab-Issues

## Trigger

- **`/bugfix-request`** gefolgt von Rohtext, Stichpunkten oder teilweise ausgefüllter Vorlage (siehe unten).
- Optional in derselben Nachricht:
  - **`Meilenstein:`** / **`Milestone:`** / **`Version:`** — wie beim Feature-Request; **weglassen erlaubt** (siehe „Meilenstein (optional)").
  - **`Modul:`** / **`feature::`** — Vorschlag für `module::*` oder `feature::*` (sonst ableiten, als **Annahme** kennzeichnen).
  - **`Priorität:`** / **`Priority:`** — z. B. `kritisch`, `hoch`, `mittel`, `niedrig` → `priority::*`.
  - **`Umfang:`** `klein` | `mittel` | `groß` — ein Bug-Ticket vs. Bug + Tasks (z. B. Engine/Renderer getrennt).

Konfiguriert in `.cursor/rules/bugfix-request-trigger.mdc`.

## Rolle des Agents

Du agierst als **Debugger**, **Software-Entwickler** und **technischer Analyst**:

- **Symptom**, **vermutete Ursache** und **konkreter Fix** klar trennen.
- **Keine Fakten erfinden** — Vermutungen als **Vermutung** / **Annahme** markieren.
- Lösungsschritte **praktikabel und nachvollziehbar**; Gears-Clash-Architektur (TypeScript, PixiJS, GameApiAdapter, HostAdapter, Engines) und Projektstruktur einbeziehen, wenn du dafür kurz im Repo nachsiehst.
- Bedenken: Bug kann **System-/Integrationskontext** haben (Renderer-State, Adapter-Antwort, State Machine, Animation-Timing).

## Explizites Anlegen (kein „Soll ich Issues erstellen?")

Wer **`/bugfix-request`** sendet, will in der Regel **GitLab-Bug-Tickets**.
**Nicht** pauschal nach Erstellung fragen — außer:

- **Meilenstein** bei **mehreren** offenen Kandidaten **ohne** Nutzerangabe → **keine Issues anlegen**, bis geklärt (Plan-Modus oder eine Rückfrage — wie Feature-Request).
- **GitLab-Projekt** / `project_id` unklar → klären (Standard: `franklin-slots/gears-clash`).

Sonst: Issues anlegen. (Ausnahme zur allgemeinen `gitlab-integration`-Regel „erst fragen".)

## Pflicht: Konventionen & Skills

- **`gitlab-conventions.mdc`** — Titel **`[Bug] - Kurztitel`**, Labels; Meilenstein **optional** (unten).
- **`gitlab-integration`** — MCP: `list_milestones`, `list_issues`, `create_issue`, `update_issue`.
- Bei Bearbeitung des Issues: **`issue-execution-management`** (soweit relevant).

### Labels (Minimum pro Issue)

- **`type::bug`** für Haupt-Bug-Issues; **`type::task`** nur für klar abgegrenzte Folge-Arbeiten (siehe Struktur).
- **`priority::*`** — aus Nutzerangabe oder aus Schwere/Dringlichkeit ableiten (**Annahme** nennen, falls geschätzt).
- **`module::*`** oder **`feature::*`** — Pflicht laut Konvention.

### Meilenstein (optional)

1. Nutzer nennt Meilenstein → `list_milestones` → zuordnen (Zweifel → kurz nachfragen).
2. Nutzer nennt keinen → `list_milestones`:
   - **Genau ein** offener → **automatisch** setzen, in der Antwort vermerken.
   - **Keiner** → Issues **ohne** Milestone; vermerken.
   - **Mehrere** → **nicht raten**; **Plan-Modus** (Optionen + Bestätigung) **oder** nummerierte Rückfrage im Chat → **erst danach** `create_issue`.
3. Gleiche `milestone_id` für alle Issues dieses Laufs, sobald feststeht.

### Doppelte Bugs vermeiden

Vor dem Anlegen: `list_issues` mit `labels: ["type::bug"]` oder `search` auf Schlüsselwörter, `state: opened` — bei hoher Überschneidung Hinweis und Abgleich mit dem Nutzer (bestehendes Issue nutzen vs. neu).

## Ausarbeitung (inhaltlich)

In der **Chat-Antwort** und **verdichtet in der Bug-Beschreibung** mindestens:

1. **Problembeschreibung** — präzise, für Dritte verständlich.
2. **Beobachtet vs. erwartet** — Ist/Soll, Häufigkeit, Schwere.
3. **Reproduktionsschritte** — nummeriert; wenn nicht reproduzierbar: Kontext „beobachtet bei …".
4. **Umgebung** — Browser, OS, Build (`npm run dev` / `npm run build` / IIFE / ESM-Embed), relevante Versionen (Pixi, Vite, TS).
5. **Logs / Fehlermeldungen** — zitiert oder Platzhalter, wenn Nutzer nichts lieferte.
6. **Technische Einordnung** — betroffene Layer (Core-Engine, Renderer, UI, Adapter), Regression/Vermutung, Race/Timing nur wenn belegt oder als **Vermutung**.
7. **Wahrscheinliche Ursachen** — sortiert; **sichere Fakten** vs. **Vermutungen** getrennt.
8. **Konkrete Fix-Schritte** — nummeriert, umsetzbar.
9. **Tests / Verifikation nach dem Fix** — checklistenartig.
10. **Risiken / Nebenwirkungen** — kurz.
11. **Auswirkungen & Workarounds** — Blocker, Dringlichkeit.
12. **Offene Punkte** — was noch geklärt werden muss.

## GitLab-Struktur (Issues schneiden)

An **`.gitlab/issue_templates/Bug.md`** ausrichten (Abschnitte, Tabellen). Labels über die API setzen (nicht über `/label` am Ende der Beschreibung).

| Umfang | Haupt-Issue | Kinder |
|--------|-------------|--------|
| **Klein** | Ein **`[Bug] - …`**, `type::bug` — volle Analyse, Repro, Fix-Vorschlag, DoD-Checkliste in einer Beschreibung | keine |
| **Mittel** | **`[Bug] - …`**, `type::bug` — Problem, Repro, Ursachen, Gesamtkontext | 1–3 **`[Task] - …`**, `type::task` für klar getrennte Arbeitspakete (z. B. Engine-Fix, Renderer-Fix, Adapter-Fix) |
| **Groß** | **`[Bug] - …`** als Sammel-/Tracking-Issue | mehrere **`[Task] - …`**; erste Task optional „Root Cause / Analyse" |

In **jedem** Task: **`[Parent] - #<IID>`** des Bug-Hauptissues.

Nach Erstellung: Bug-Beschreibung um **„Verknüpfte Tasks"** mit `#<IID> - Titel` ergänzen (`update_issue`).

Titel: immer **`[Bug] - …`** bzw. **`[Task] - …`** gemäß `gitlab-conventions.mdc`.

## Abschluss-Checkliste (Pflicht)

- [ ] Titel-Schema, `type` + `priority` + `module`/`feature`; **Milestone** gesetzt oder bewusst ausgelassen.
- [ ] Tasks mit `[Parent] - #IID`; Bug-Issue mit Task-Liste aktualisiert (falls Kinder).
- [ ] Fakten vs. Vermutungen für den Nutzer erkennbar.
- [ ] IIDs/Links der neuen Issues in der Antwort.

---

## Vorlage (optional zum Ausfüllen)

```markdown
## Kontext
- **Modul / Bereich:** (core / renderer / adapters / ui / config / build / demo)
- **Seit wann (optional):**
- **Meilenstein (optional):**
- **Priorität (optional):**

## Was passiert (Roh)
[Freitext]

## Ist vs. Soll
- Aktuell:
- Erwartet:
- Häufigkeit: immer | manchmal | selten | unklar
- Schwere: kosmetisch | störend | schwerwiegend | kritisch

## Reproduktion
1.
2.
3.

## Umgebung
- Browser / OS:
- Build: dev | preview | dist (ESM/IIFE) | host-eingebettet
- Pixi-Version / Vite-Version (falls bekannt):

## Logs / Hinweise
```

Der Agent ergänzt Fehlendes nur als **Annahme** oder lässt es als **offen**.
