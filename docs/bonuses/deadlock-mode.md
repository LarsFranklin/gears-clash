# Deadlock Mode (`deadlock_mode`)

**Single Source of Truth** für Produkt, UX und Abstimmung mit Server-Mathematik — **nur** Deadlock Mode. Andere Boni: [heist-run.md](heist-run.md), [gears-clash.md](gears-clash.md).

**Payload:** `DeadlockModePayload` (`phase`, `lives`, `collectedSymbols`, `remainingSpins`) — siehe `src/config/types.ts`. `DeadlockCollectedSymbol`: `reel`, `row`, `symbolId`, optional `multiplier`.

---

## 1. Namensgebung

| Ebene | Festlegung |
|--------|----------------|
| **Anzeigename** | **Deadlock Mode** |
| **Technische ID** | `deadlock_mode` |
| **Scatter-Symbol (Config)** | `bonus_deadlock_mode` (`bonusId: 'deadlock_mode'`) |

---

## 2. Produktpositionierung

- **Rolle:** der **seltenste** und **potenziell stärkste** der drei Bonus-Features — höchste Multiplier-Spitzen, höchste Varianz.
- **Stufe:** über **Gears-Clash-Freispielen** und **Heist Run** (siehe [gears-clash.md §2](gears-clash.md), [heist-run.md §2](heist-run.md)).
- **Gegenüber Heist Run:** deutlich **seltener** und **stärker** ausgelegt (Markt-Vergleich nur illustrativ: Buy-Ins für sehr volatile „Top“-Features liegen in kommerziellen Slots oft **eine bis zwei Größenordnungen** über moderaten Freispiel-Features — **kein** Bezug zu einem konkreten Fremd-Titel oder RTP).
- **Ton:** klarer **High-Risk-/High-Reward**-Block; authentischer Casino-Slot, kein Arcade-Spam.

---

## 3. Auslösebedingung (Base Game)

- **Grid:** 5×5 wie im Basisspiel.
- **Scatter:** gleiche **Trigger-Logik** wie bei den anderen Bonus-Features dieses Spiels: **mindestens 3** Deadlock-Scatter in **einem** Spin starten den Bonus (positionsbasiert über das Grid — Detailabgleich mit globaler Scatter-Regel im Projekt).
- **Während der Session:** nur `bonus_deadlock_mode` als Bonus-Scatter auf den Strips — [cross-cutting-bonus-rules.md](cross-cutting-bonus-rules.md).
- **Kein klassischer „nur Freispiele“-Bonus:** nach dem Start läuft zuerst die **Collection-Phase** (Leben, Spezial-Symbole), danach **Overdrive** mit echten Freispielen (siehe **§5–§8**).

---

## 4. Phasenüberblick

| Phase | Name (Payload) | Kurzbeschreibung |
|--------|----------------|------------------|
| **1** | `collection` | 5×5 mit **nur drei** Symboltypen + Leben-Logik; Sammeln von **Wild-Anzahl** und **additiven** Multiplier-Werten. |
| **2** | `overdrive` | **8** Freispiele (fix) wie der normale Slot, plus garantierte Wilds aus Phase 1 und globaler Multiplier; optional **Retrigger** (+4 FS) nur in dieser Phase (§6.6). |

---

## 5. Phase 1 — Collection

### 5.1 Spielfeld & Symbolik

- **Layout:** weiterhin **5×5**; visuell und logisch ein **eigenes** Set an Symbolen (nicht die normale Paytable der Basiswalzen).
- **Pro Rasterzelle genau ein Symbol** — kein gleichzeitiges „kaputtes Gear + Wild“ auf derselben Koordinate.
- **Genau drei** relevante Symbolkategorien (Assets teils bereits vorhanden — konkrete `symbolId`-Namen in Math/Art-Tabelle nachpflegen):
  1. **Kaputtes / graues Gear** — „**Null**“: trägt **nichts** zur Sammlung bei; zählt als **Fehlwurf** für die Leben-Logik (siehe §5.3).
  2. **Wild-Gear** — wird zur **Wild-Zählung** gesammelt (jede sichtbare Wild-Zelle erhöht den Pool um 1, sofern Server so definiert).
  3. **Multiplier-Gear** — trägt einen **numerischen** Multiplier-Wert (z. B. 2, 4, 6, 8, …). Es gibt **kein** einzelnes fixes Multiplier-Symbol, sondern **verschiedene** Werte mit **eigenen** Landewahrscheinlichkeiten (Math).

### 5.2 Sammel-Logik Multiplier (additiv)

- Jede eingesammelte Multiplier-Zahl wird zur **Gesamt-Summe** Phase 1 addiert.  
  **Beispiel:** gesammelt **2** und später **8** → Gesamt-Multiplier für Phase 2 = **10** (**2 + 8**), **nicht** 2×8.
- **Mehrere Multiplier in derselben Collection-Runde:** alle Werte dieser Runde werden **sofort** zur laufenden Gesamt-Summe **addiert** (mehrere Multiplier-Zellen in einem Spin sind erlaubt und sollen **können**, müssen aber nicht — normale Slot-Varianz).
- **Multiplikation** mit Gewinnen erfolgt **erst in Phase 2** (Gesamt-Faktor aus Phase 1 — siehe §6.4).

### 5.3 Leben (Lives)

- **Start:** **3 Leben**.
- **Leben -1:** in einer Collection-**Runde** liegen **ausschließlich** kaputte Gears (also **kein** Wild-Gear und **kein** Multiplier-Gear zur Sammlung) — „leerer“ Spin nur aus Null-Symbolen.
- **Leben zurück auf 3:** sobald in einer Runde **mindestens ein** Wild-Gear **oder** mindestens ein Multiplier-Gear **gesammelt** wird (Treffer), werden die Leben **auf 3 zurückgesetzt** (Reset-on-Hit).
- **Ende Phase 1:** **0 Leben** — die Leben wurden durch **aufeinanderfolgende** Runden ohne Wild- und ohne Multiplier-Treffer aufgebraucht (konkret: **dreimal hintereinander** nur kaputte Gears / keine Sammlung von Wild oder Multiplier, entsprechend 3 Leben verbraucht). Danach beginnt **Phase 2 (Overdrive)**.

*Hinweis: „wie drei Free Spins“ ist nur didaktisch — fachlich zählen **Leben** und **Treffer-Resets**, nicht eine fixe Spin-Anzahl.*

### 5.4 Gesammelter Wild-Pool

- Über die gesamte Collection-Phase werden **alle** eingesammelten Wilds **gezählt** (Beispiel: **6** Wilds).
- **0 Wilds** nach Phase 1: **kann** vorkommen, soll aber **sehr selten** sein. **Produktintention:** Math legt Gewichte so an, dass Spieler **typischerweise einige** Wilds sammelt (auch wenige reichen); Zustand **0 Wilds** soll **weitgehend vermieden** werden. Tritt **0 Wilds** dennoch ein, läuft Overdrive mit **keinen** garantierten Bonus-Wilds, aber weiter mit dem **gesammelten** Multiplier (bzw. ×1 wenn auch kein Multiplier — §6.4).
- Die **Positionen** aus Phase 1 dienen der **Server-/Speicherlogik** (`collectedSymbols`); für Phase 2 ist das Produktziel: **Anzahl** der garantierten Wilds = gesammelte Wild-Anzahl (siehe §6.3).

---

## 6. Phase 2 — Overdrive (Freispiele)

### 6.1 Charakter

- **Klassische Freispiele** des Deadlock-Modus: normale Walzenlogik, **alle regulären Symbole** und **alle regulären Winline-Regeln** wie im Basisspiel — **plus** garantierte Wilds (sofern Anzahl > 0) und **globaler** Multiplier.

### 6.2 Anzahl Freispiele (Start)

- **Immer genau 8** Overdrive-Freispiele beim **Eintritt** in Phase 2 (fix, unabhängig von Scatter-Anzahl über 3 und unabhängig von der Höhe der Sammlung — Stand Produkt).

### 6.3 Garantierte Wilds (nicht sticky)

- In **jeder** Overdrive-Runde erscheinen **mindestens** so viele **Wilds**, wie in Phase 1 gesammelt wurden (**0**, wenn nichts gesammelt — §5.4).
- **Platzierung:** pro Runde **neu zufällig** verteilt; **nicht sticky** — nur für diese eine Runde.
- **Darstellung / Timing:** Wilds **„eingestreut“**, bevor die übrigen Walzenpositionen zur Ruhe kommen — UX mit Renderer abstimmen.

### 6.4 Gewinnauswertung & Multiplier

- Nach Stop: **normale** Winlines (Basisgewinne wie im Hauptspiel).
- Gesamtfaktor aus Phase 1: **Summe aller** gesammelten Multiplier-Werte. Wurde **kein** Multiplier gesammelt, gilt **×1** (neutral).
- Die **Basisgewinne** der Runde (exakte Definition: Spin-Gesamt vs. pro Linie — **Math**/Server) werden mit diesem Faktor multipliziert.
- Wiederholung für **jede** Overdrive-Runde bis die **aktuell** gültige Rundenanzahl (inkl. Retrigger-Zuwächse, §6.6) erschöpft ist.

### 6.5 Abschluss

- Nach der letzten Overdrive-Runde: **große Gewinn-Summary** (Session-Gesamt), danach Ende des Bonus (Balance/Bonusbank gemäß Server-Vertrag).

### 6.6 Retrigger (nur Overdrive)

- **Nur in Phase 2** (`overdrive`). **Kein** Neustart von Phase 1 (Collection) und **kein** Zurücksetzen der bereits gesammelten Wild-/Multiplier-Werte.
- **Gleiche Regel wie Heist Run:** in **einer** Overdrive-Runde **mindestens 3** Deadlock-Scatter → **+4** weitere Overdrive-Freispiele (**Cap pro Retrigger-Ereignis: +4**, auch bei 4+ Scatter).
- **UX:** wie Heist Run — Scatter-Highlight wie im Basisspiel, Popup z. B. „+4 Free Spins“ (Details: [heist-run.md §7](heist-run.md)).
- Scatter-Wahrscheinlichkeiten: **Intention** wie Basisspiel / Heist (kein separates „nur für Deadlock“-Strip vorgeschrieben), sofern Math nicht bewusst anders parametriert.
- **Mehrfach-Retrigger:** jede weitere qualifizierende Runde vergibt erneut +4 FS; **kein** verbindliches Session-Cap in Produkt v1 (optional technisches Cap in Math — analog Heist Run).

---

## 7. Verhältnis zu anderen Features

- **Heist Run:** eigene SSOT; Retrigger-**Zahlen** (+4, Cap pro Event) sind **absichtlich angeglichen**, Ablauf aber nur in Deadlock-Overdrive.
- **Gears Clash:** nicht Teil dieser SSOT; Priorität bei Kollisionen → Backend.

---

## 8. Trust Boundary (Client vs. Server)

- **Server** liefert Phase, Leben, gesammelte Symbole, verbleibende Spins, Stop-Positionen, Gewinne und Multiplier — **final**.
- **Client** visualisiert nur; **keine** eigene Neuberechnung von Sammlung, Wild-Anzahl oder Multiplier-Produkt.

---

## 9. Offene Punkte (Copy / Art / Math / API)

- [ ] Konkrete **`symbolId`** und Asset-Pfade für die **drei** Collection-Symbole + Multiplier-Stufen-Tabelle (Wahrscheinlichkeiten; Schwerpunkt „selten 0 Wilds“).
- [ ] Exakte Server-Regel: **worauf** der Gesamt-Multiplier angewendet wird (Spin-Gesamt vs. pro Linie).
- [ ] Copy DE/EN: Phasen-Titel, Leben, Retrigger-Popup, Summary.
- [ ] API: Bonus-Session (Collection-Steps vs. gebündelt; Retrigger-`remainingSpins`).

---

*Workshop: Zahlbeispiele (6 Wilds, ×10) sind **Illustration**; **8** Overdrive-FS und Retrigger-Logik sind **produktfix**.*
