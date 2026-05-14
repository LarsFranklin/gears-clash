FEATURE / MODUL REVIEW

> **Cursor-Trigger:** **`/modul-review`** plus Modul-Name (z. B. `/modul-review PixiSlotRenderer`).
> Optional: **`GC-REVIEW`** als Projektkürzel.
>
> **Issue-Titel:** **`[Präfix] - Kurztitel`** — Review-Hauptissue z. B. **`[Review] - PixiSlotRenderer`**. Tabelle: `gitlab-conventions.mdc` / `.gitlab/README.md`.
> **Unter-Issues:** in der Beschreibung **`[Parent] - #<IID>`**.

Projekt: Gears Clash (`gears-clash-game`)
GitLab: `franklin-slots/gears-clash`
Feature / Modul: [Name]
Issue: auto

---

## Ziel

Alle Fehler, Inkonsistenzen sowie Architektur- und Schichten-Probleme systematisch finden, einschätzen, dokumentieren und priorisieren — speziell mit Blick auf die unverhandelbaren Prinzipien:

- Keine Echtgeld-/Win-Logik im Client (Server hat die Wahrheit).
- Public API in `src/index.ts` ist die Vertragsfläche.
- Engine-/Renderer-/UI-/Adapter-Trennung bleibt sauber.

---

## Grundregeln

1. **Dokumentation vor Fix.**
   Jeder Bug und jede Inkonsistenz wird zuerst als Kommentar im Review-Issue oder als verlinktes Sub-Issue dokumentiert. Erst danach wird gefixt. Ausnahmen: triviale Korrekturen (Typos, offensichtlich falsche Funktionsnamen).

2. **Geplant vor umgesetzt.**
   Jeder Fix wird im Planungsmodus vorgeplant. Vor Umsetzung wird der Plan geprüft auf Korrektheit, korrekte Interpretation des Problems, Halluzinationen, Typos und typische AI-Fehler.

3. **„Fix me"-Freigabe.**
   Sobald ein Bug im Issue dokumentiert ist (als Kommentar oder eigenes Issue), darf er als `type::task` + `priority::*` gelabelt werden. Ab dann darf autonom gefixt werden.

4. **Zwei Betrachtungsweisen.**
   Jedes Modul wird in zwei Perspektiven reviewed:

   - A) **Isoliert** — das Modul für sich (Dateien, Logik, Struktur, Pixi-Patterns, Adapter-Vertrag).
   - B) **App-Kontext** — als Teil von `GearsClashGame.runSpin`/`mount`/`destroy` mit Fokus auf Schicht-Schnittstellen, Events (`emitter`), HostAdapter-Callbacks und Public API.

---

## Reviewprozess

### 1. Kontext erfassen

- Welches Modul / welche Dateien gehören zum Feature?
- Abhängigkeiten klären: Engines (`SlotEngine`, `ReelEngine`, `PayoutEngine`, `BonusEngine`, `SymbolRegistry`), Renderer (`PixiSlotRenderer`, `ReelColumn`, `AssetLoader`), UI (`HudController`, `ButtonController`, `BonusOverlayController`), Adapter (`GameApiAdapter`, `HttpGameApiAdapter`, `MockGameApiAdapter`).
- Konfiguration: `defaultGameConfig`, `assetManifest`, `gameConfig.schema.json`.

### 2. Vollständige Code-Analyse

Jede relevante Datei vollständig und einzeln einlesen. Keine Datei überspringen.
Reihenfolge empfohlen:

- Adapter (Wahrheits-Quelle) → Engines → Renderer → UI
- Konfiguration: `config/types.ts`, `defaultGameConfig.ts`, `assetManifest.ts`, `gameConfig.schema.json`
- Public API: `src/index.ts`, IIFE-Globalobjekt
- Build: `vite.config.ts`, `tsconfig.build.json`, `scripts/copy-schema.mjs`, `package.json`

### 3. IST-Zustand erfassen

- Funktionen, Klassen, Hooks, Konstanten, Events
- Adapter-Methoden, ihre Eingaben/Ausgaben (`SpinRequest`, `SpinResult`, `BonusSessionPayload`)
- Konfig-Felder (`GameConfig`, `AnimationConfig`, …) und ihre Default-Werte
- Renderer-Hooks (`PixiSlotRendererHooks.onSound/onShake`)
- Public API in `src/index.ts`

Diese Übersicht bildet den wahren, aktuellen Stand ab und dient als Referenz für alle weiteren Schritte.

### 4. Architektur prüfen

- **Schichten-Trennung:** keine Pixi-Imports in `core/`/`ui/`, keine Adapter-Imports in Engines/Renderer.
- **Public API:** alles, was extern genutzt wird, ist in `src/index.ts` exportiert; nichts „internes" leakt.
- **Datei-Größe:** Richtwert < 300 Zeilen.
- **State Machine:** `SlotEngine.canSpin/beginSpin/enterResolving/enterBonus/finishRound/setError/resetError` sind die einzigen Zustandsübergänge.
- **CSS-Prefix:** `gc-*`-Klassen, kein globales Styling.

### 5. Fehlerbehandlung prüfen

- `try/catch` in allen `async`-Operationen?
- Fehler werden über `emitter.emit('error', e)` und `hostAdapter.onError` weitergereicht?
- Adapter werfen die richtigen Fehlerklassen (`NetworkError`, `InvalidResponseError`, `InsufficientBalanceError`)?
- Renderer-Init-Fehler (z. B. WebGL nicht verfügbar) werden sauber propagiert?
- `SlotEngine.setError()` / `resetError()` wird aufgerufen?

### 6. Konsistenz prüfen

- Symbol-IDs in `defaultGameConfig.symbols`, `symbolWeights`, `bonusTriggers`, Mock-Daten und Renderer identisch (snake_case).
- Bonus-IDs konsistent: `gears_clash` | `heist_run` | `deadlock_mode`.
- Event-Namen aus `GameEventName` strikt verwendet.
- Doku (README, JSDoc) deckt sich mit der Implementierung.
- Keine doppelten Implementierungen desselben Features.

### 7. Fehler kategorisieren und dokumentieren

| Kategorie | Behandlung |
|-----------|------------|
| **Klein** | Sammelissue, Titel **`[Fixes] - <Modulname>`**, Label `type::bug` + `priority::low`, Beschreibung **`[Parent] - #…`** |
| **Mittel / Groß** | **`[Bug] - …`** / **`[Task] - …`** etc., **`[Parent] - #…`**; Fix über Planungsmodus vorbereiten |

### 8. Abschluss-Prüfung (Pflicht!)

Am Ende des Reviews MUSS eine vollständige Prüfung aller erstellten Issues durchgeführt werden. Jedes Issue wird einzeln geprüft auf:

- **Labels:** Mindestens `type::*` UND `priority::*` UND `module::*`/`feature::*` gesetzt?
- **Milestone:** Dem aktuellen Entwicklungs-Milestone (z. B. `v0.2.0`) zugewiesen?
- **Verlinkung:** Mit dem Review-Issue verlinkt (`[Parent] - #IID`)?
- **Titel:** Schema **`[Präfix] - Kurztitel`**?
- **Beschreibung:** Verständlich, mit Datei/Zeile, Problem und Lösungsvorschlag?

Erst wenn alle Issues diese Kriterien erfüllen, gilt das Review als abgeschlossen.

---

## Sonstige Regeln

- **Issue-Titel** immer **`[Präfix] - Kurztitel`** (`gitlab-conventions.mdc`).
- In GitLab Issues immer alle Labels korrekt setzen: `type::*` + `priority::*` + `module::*`/`feature::*`.
- Jedes Issue dem aktuellen Milestone zuweisen.
- Alle Fehler und Fixvorschläge müssen in Issues dokumentiert sein — wir pflegen **keinen** dauerhaften Changelog im Repo, die History entsteht aus den geschlossenen Issues pro Milestone.
- Ziel ist eine vollständige, strukturierte Erfassung aller technischen Probleme — historisch dokumentiert mit Reasoning, damit sie auch zu einem späteren Zeitpunkt nachvollziehbar abgearbeitet werden können.
- **NIEMALS** andere Projekte anfassen (siehe `project-scope.mdc`). Nur `franklin-slots/gears-clash`.
