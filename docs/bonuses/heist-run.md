# Heist Run (`heist_run`)

**Single Source of Truth** für Produkt, UX und Abstimmung mit Server-Mathematik — **nur** Heist Run. Andere Boni: eigene Dateien unter `docs/bonuses/`.

---

## 0. Hinweis zu Schreibweise / Transkription

Im Team-Text kann „Highstrun“ o. Ä. vorkommen — **gemeint ist immer „Heist Run“** (Heist + engl. *run*). Kein separater Name „Heist One“ o. ä.

---

## 1. Namensgebung

| Ebene | Festlegung |
|--------|----------------|
| **Anzeigename** | **Heist Run** |
| **Scatter-Branding** | **Heist** (Lesbarkeit auf dem Scatter-Symbol) |
| **Technische ID** | `heist_run` (API, Schema, TypeScript `BonusId`) |
| **Symbol-ID (Config)** | `bonus_heist_run` (`bonusId: 'heist_run'`) |

---

## 2. Produktpositionierung

- **Rolle:** eher **kleiner / häufigerer** Bonus als die anderen beiden Features; moderate Auszahlung, kein alleiniger Jackpot-Hook.
- **Stufe unter den drei Haupt-Boni:** eher die **niedrigste** typische Auszahlungs-/Spitzenstufe — unter **Gears-Clash-Freispielen** und unter **Deadlock Mode** (siehe [gears-clash.md §2](gears-clash.md), [deadlock-mode.md §2](deadlock-mode.md)).
- **Ton:** authentischer **Casino-Slot**, kein Arcade-Dauerbonus.

---

## 3. Scatter-Symbol „Heist“

- **Visuell:** Zahnrad mit Tresor-Bezug, klar als Scatter; Schriftzug **„Heist“**.
- **Landewahrscheinlichkeiten:** liegen in der **Server-Math**. Im **Basisspiel** und **während Heist Run** gelten für **normale** Symbole dieselben **Gewichte** wie im Hauptspiel (kein separates Bonus-Reelset nur für Heist Run). **Ausnahme:** Während einer **aktiven** Heist-Run-Session sind **andere** Bonus-Scatter (`bonus_gears_clash`, `bonus_deadlock_mode`) **nicht** im Strip — siehe [cross-cutting-bonus-rules.md](cross-cutting-bonus-rules.md).

---

## 4. Auslösebedingung (Base Game)

- **Grid:** 5×5 (25 Positionen); Scatter zählen **positionsbasiert** über das gesamte Grid.
- **Minimum:** **3** Heist-Scatter in **einem** Spin → Heist Run startet.
- **Mehr als 3** im auslösenden Spin: mehr **initiale** Free Spins (siehe §6).

---

## 5. Verteilung der Scatter (Base Game)

- Scatter in **jeder** Spalte und **jeder** Reihe möglich (Zufall laut Math).
- Mehrere Scatter **in derselben Spalte** sind erlaubt; Design-Intention: 1 pro Spalte häufiger als 2, 2 häufiger als 3 — **kein** hartes Verbot für 2–3 in einer Spalte.

---

## 6. Initiale Free Spins (Auslösung im Base Game)

Zusätzliche Scatter erhöhen nur die **Anzahl Free Spins** (+2 pro Scatter über 3). **Cap** bei der Auslösung: praktisch ab **6** Scatter „extrem selten“; Produkt-Maximum für die **Startzahl** wie folgt:

| Heist-Scatter (ein Spin) | Initiale Free Spins |
|--------------------------|---------------------|
| **3** | **8** |
| **4** | **10** |
| **5** | **12** |
| **6** | **14** |
| **7+** | **14** (Hard Cap — identisch zu **6** Scatter) |

- **Produktregel:** Ab **7** Heist-Scatter im **auslösenden** Base-Spin gibt es **keine** weiteren initialen Free Spins über **14** hinaus (**gleiche Startzahl wie bei 6**).

Free Spins sind **kostenlos** (kein Einsatz pro Bonusrunde). **Gewinnbemessung** bezieht sich auf den **Einsatz des auslösenden Base-Spins** (klassisches Freispiel-Verhalten; final **Server**). **Gewichtung / Strip:** **identisch** zum Basisspiel (§3).

---

## 7. Retrigger während Heist Run

- **Bedingung:** In **einer** Free-Spin-Runde **mindestens 3** Heist-Scatter (gleiche Zählweise wie im Base Game).
- **Effekt:** **+4** weitere Free Spins — **unabhängig davon**, ob in dieser Runde 3, 4, 5 oder mehr Scatter liegen (**Cap pro Retrigger-Ereignis: +4**).
- **Wahrscheinlichkeit:** Scatter erscheinen während des Heist Run mit **derselben** Statistik wie im normalen Spiel (kein reduziertes Retrigger-Strip, sofern Math nicht bewusst anders parametriert).
- **UX bei Retrigger:**
  1. **Highlight-Animation** der auslösenden Scatter wie im Basisspiel (gleicher Ablauf wie „normal“).
  2. Kurzes **Popup** (z. B. „+4 Free Spins“ / „4 weitere Free Spins“).
- **Mehrfach-Retrigger:** Jede weitere Runde mit ≥3 Scatter löst erneut **+4** aus.
- **Session-Cap (Produkt v1):** **Kein** verbindliches Limit, wie oft im selben Heist Run retriggert werden darf. Aus **RTP-/Simulationsgründen** kann die **Math** ein technisches Cap definieren; das gehört in die **Math-Spezifikation** und ändert nicht die **+4 pro qualifizierender Runde** solange kein Cap greift.

---

## 8. Spielablauf & UX (Heist Run)

### 8.1 Intro

- Kurzes **Fullscreen- oder Overlay-Intro:** z. B. **„Heist Run“** + **konkrete Zahl** der gewährten Free Spins (aus §6, z. B. „8 Free Spins“).
- **Timer** einige Sekunden **oder** **Tap** zum Überspringen → danach **sofort erste** Free-Spin-Runde.

### 8.2 Free-Spin-Ablauf

- Nach dem Intro laufen die Free Spins **automatisch** durch (**kein** manueller Spin-Klick pro Runde).
- **Kein** Stoppen / Unterbrechen der Sequenz in v1 (kein Skill-Stop).

### 8.3 Free-Spin-Zähler (UI)

- Anzeige z. B. Label **„Free Spins“** + **verbleibende Anzahl** (Countdown: 8, 7, 6, …, **0** wenn keine mehr übrig).
- **Nicht** im Format „3 von 10“ — nur **Restanzahl**.

### 8.4 Gewinnbank & Abschluss

- Während des Heist Run werden Gewinne in einer **Bonusbank** / **Session-Summe** geführt (UI-Feld „gesammelt“ o. ä.).
- **Nach** der letzten Free-Spin-Runde: **zwingend** ein **Gewinn-Summary-Overlay** (Gesamtgewinn der Bonusrunde).
- Summary **ohne Auto-Timer** — bleibt, bis der Spieler **tippt** / klickt.
- **Erst nach** Schließen der Summary: **Balance** im Basisspiel aktualisieren (Gesamtbetrag der Bonusbank gutschreiben).

### 8.5 Visuelles (optional / später)

- Tresor-/Heist-Atmosphäre (Hintergrund); Symbol-Skin später möglich — **ohne** Änderung der Paytable, solange nicht separat beschlossen.

---

## 9. Sticky-Wild-Logik (Zell-Wilds, Heist Run)

### 9.1 Kern

- Landet ein **normales Wild** auf einer **einzelnen Zelle** `(reel, row)`, wird diese Zelle **sticky** bis **Ende** der Heist-Run-Session.
- **Keine Multiplikator-Stickies** in Heist Run v1 — nur **einfaches Wild** pro Zelle (siehe auch [ideas-future-slots-mechanics.md](../ideas-future-slots-mechanics.md) für spätere Ideen). Technisch kann ein Payload-Feld `multiplier` existieren; **Produkt Heist Run:** nicht genutzt.

### 9.2 Darstellung vs. Auswertung

- Unter einer **Sticky-Zelle** läuft die Walze weiter: es wird ein **Symbol** „mitgeführt“, damit die Rolle nicht leer wirkt.
- Für **Gewinnauswertung** gilt: das **Sticky-Wild** hat **Vorrang** — das darunterliegende Symbol wird **ignoriert** (zählt nicht).

### 9.3 Kollision Wild vs. anderes Symbol

- Würde theoretisch Wild und anderes Symbol **dieselbe** Zelle beanspruchen: **Wild gewinnt**; die **sticky** gesetzte Zelle **überwiegt** immer das „darunter“ rotierende Symbol.

### 9.4 Geltung ab Landung

- Sticky wirkt ab der **Runde des Landens** in **allen folgenden** Free Spins; nicht rückwirkend für frühere Runden.

### 9.5 Kein Full-Reel-Sticky (Heist-Zell-Wild)

- Sticky bezieht sich auf **eine Zelle**, nicht dauerhaft auf eine ganze Walze als Sticky-Full-Reel (siehe unten Gears Clash).

---

## 10. Gears Clash während Heist Run (Kurzreferenz)

Detaillierte Spezifikation des Features **Gears Clash** (`gears_clash`): **[gears-clash.md](gears-clash.md)** (Single Source of Truth für diesen Modus).

**Kurz für Heist Run:**

- **Bonus-Scatter-Isolation:** Während Heist Run sind **nur** `bonus_heist_run`-Scatters als Bonus-Scatter aktiv; siehe [cross-cutting-bonus-rules.md](cross-cutting-bonus-rules.md).
- Gears-Clash-**Kampf/Expand** kann weiterhin vorkommen, wenn der **Server** das ohne Landen von `bonus_gears_clash` auslöst (siehe **§2** dort); die **Show-Logik** bleibt [gears-clash.md §3–§4](gears-clash.md).
- Gears-Clash-Full-Reel ist **nicht** dauerhaft sticky; nach Show und Auszahlung ist der **Full-Reel-Effekt** vorbei.
- **Overlap mit Sticky:** Liegt auf einer Walze bereits ein **Sticky-Zell-Wild**, **überlagert** Gears Clash diese Zellen **nur für diese eine Runde** visuell/logisch für den Kampf/Full-Reel; **ab der nächsten Runde** gilt wieder das **unveränderte Sticky-Wild** auf der Zelle.
- Sticky-Zellen **fließen in die Gewinnbewertung** ein, wenn der Full-Reel-Wild größere / zusätzliche Treffer erzeugt (Server wertet final aus).

---

## 11. Trust Boundary (Client vs. Server)

- **Server** liefert u. a. `freeSpinsAwarded`, `currentSpin`, `stickyWilds`, Gewinne, Bonussumme — **final**.
- **Client** visualisiert und steuert Intro, Auto-Spin, Overlays, Zähler; **keine** eigene Neuberechnung von Auszahlungen oder Bonus-Outcomes.

---

## 12. Offene Punkte (Copy / Art / API)

Math-Kernfälle für Heist Run sind in **§6** (>6 Scatter = 14 FS) und **§7** (Retrigger ohne Produkt-Session-Cap) festgelegt.

- [ ] Exakte **Copy** DE/EN für Intro, Retrigger-Popup, Summary, Bonusbank-Label.
- [ ] **Art:** Scatter „Heist“, Tresor-Hintergrund, Popup-Layout.
- [ ] **API:** Bonusbank pro Spin vs. nur Endsumme (`SpinResult` / Bonus-Session); Abgleich mit Backend-Implementierung.

---

*Zuletzt abgestimmt mit Produkt-Workshop (Sprechtext / Transkription — Begriff immer **Heist Run**).*
