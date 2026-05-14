# Gears Clash — Multiplier-Battle (`gears_clash`)

**Single Source of Truth** für **Gears Clash** (technische ID `gears_clash`): Einzelspin-**Expand-/Kampf-Mechanik** sowie **Freispiel-Bonus** per Scatter.

**Payload:** `GearsClashPayload` in `src/config/types.ts` (`gearA`, `gearB`, optional `winnerReel`, `winnerMultiplier`).

**Scatter-Symbol (Config):** `bonus_gears_clash` (`bonusId: 'gears_clash'`).

**Bonus-übergreifend:** [cross-cutting-bonus-rules.md](cross-cutting-bonus-rules.md) (Scatter-Isolation während aktiver Sessions).

---

## 1. Symbol & Grundidee

- **Visuell:** Zwei **Zahnräder**, gegeneinander arbeitend, mit **Funken** / Spannung — „Clash“.
- **Raster:** Das Symbol kann im Basisspiel **überall** auf dem 5×5-Grid landen (Math).

---

## 2. Freispiel-Bonus-Session (Scatter → eigene Freispiele)

Eigenständige Bonus-Runde **nur** um Gears Clash — **mittlere** Auszahlungs-/Volatilitäts-Stufe zwischen **Heist Run** (eher kleiner) und **Deadlock Mode** (größter Block); v. a. wegen **Full-Reel-Wild** + **Multiplikator**, aber **ohne** Sticky-Sonderlogik.

### 2.1 Trigger

- **Mindestens 3×** Scatter `bonus_gears_clash` in **einem** Base-Spin (positionsbasiert wie andere Boni).
- Danach Start der **Gears-Clash-Freispiel-Session** (technisch weiter `gears_clash`).

### 2.2 Umfang & Ablauf

- **8** Freispiele beim **Start** der Session (fix, analog zur Zahl in den anderen Produkt-Dokus für 8er-Blöcke — Abgleich mit Server-`remainingSpins`).
- **Walzen / Gewichte:** wie **normales** Basisspiel (kein separates „Fantasy“-Reelset nur für diesen Modus), **außer** den in [cross-cutting-bonus-rules.md](cross-cutting-bonus-rules.md) beschriebenen **Scatter-Pool-Anpassungen** (nur noch `bonus_gears_clash` als Bonus-Scatter).
- **Kein Sticky**, keine zusätzliche Sonderlogik außer den in §2.3–§2.5 beschriebenen Punkten.

### 2.3 Erhöhte Auftrittsrate (nur „öfter da“, nicht „öfter gewonnen“)

- Während der Freispiele ist die **Wahrscheinlichkeit erhöht**, dass **Gears-Clash-relevante** Situationen auftreten (Symbol landet / Show startet nach den **gleichen** Regeln wie §3 — **keine** Erhöhung der **Gewinn-Wahrscheinlichkeit** des Kampfes an sich).
- **Nicht garantiert:** In **einzelnen** Runden kann **kein** Clash stattfinden; mehrere leere Runden sind erlaubt.
- **Mathematik:** konkrete Frequenz so wählen, dass es **weder** „zu OP“ noch „zu leer“ wirkt (Feintuning RTP/Volatilität).

### 2.4 Session-Garantien (Spieler-Fairness)

- Über die **8** Start-Freispiele hinweg muss **mindestens einmal** eine **Gears-Clash-Show** (Expand-Pfad nach §3, inkl. sichtbarer Kampf-Animation) **vorkommen** — **0** Clashes in der kompletten Session ist **unzulässig**.
- **Zusätzliche Intention:** Von den **tatsächlich** stattfindenden Clashes sollen **einige** (nicht zwingend alle) in **gewinnbringende** Expands mit Auszahlung münden, damit der Bonus „etwas zurückgibt“. Exakte Anteile: **Server-Math**.

### 2.5 Einzelspin-Logik unverändert

- Pro Spin gilt **unverändert** §3: Show und Full-Reel-Wild **nur**, wenn die **Linien-Logik** einen Gewinn mit Wild ermöglicht; sonst **kein** Expand trotz evtl. höherer **Lande**-Chance des Symbols.

### 2.6 Retrigger

- **Gleiche Logik wie Heist Run:** in **einer** Freispiel-Runde **≥3** passende Scatter → **+4** weitere Freispiele (**Cap pro Retrigger-Ereignis: +4**). Details: [heist-run.md §7](heist-run.md).
- **Kein** Neustart einer anderen Phase; nur zusätzliche Spins in derselben Session.

---

## 3. Auslösebedingung Einzelspin (wann die Full-Reel-Show startet)

1. Das Gears-Clash-Symbol ist Teil einer **Win-Line-Konstellation**, in der es **als Wild fungieren würde** (benachbarte Symbole würden mit diesem Symbol **nach Wild-Regel** einen gültigen Treffer ergeben).
2. **Nur dann** wird die **Expand-/Battle-Animation** ausgeführt und die betroffene Walze zum **Full-Reel-Wild mit Multiplier** aufgelöst.
3. Wenn **selbst als Full-Reel-Wild** **kein** Treffer auf **irgendeiner** Win-Line möglich wäre, bleibt es beim **normalen Symbol** ohne Expand-Show.

*Konkrete Win-Line-Definitionen: Winlines-Doku + Server-Math.*

---

## 4. Ablauf nach Auslösung (Kampf)

1. **Animation:** Kollision / Kampf; UX/Art kompakt.
2. **Mathematik:** **Einer** der beiden Gears / Multiplier **gewinnt immer** — nicht rein „höher gewinnt immer“; der **niedrigere** gewinnt **häufiger** (Hausbank-freundlich). Tabellen: Server-Math.
3. **Ergebnis:** betroffene Walze = **Wild** mit **gewonnenem** Multiplier.
4. **Gewinnauswertung:** Basisgewinne je Linie, dann **pro Linie** mit Multiplier gewichten; mehrere Linien → Feedback kann gestaffelt/beschleunigt sein.

---

## 5. Verhältnis zu Sticky-Wilds (Heist Run)

Siehe **[heist-run.md](heist-run.md) §10** — Kurzfassung:

- Full-Reel nur **eine Runde**; **kein** Full-Reel-Sticky.
- **Overlap** mit Heist-Stickies: eine Runde Overlay, danach Sticky-Zellen wieder wie zuvor.

---

## 6. Trust Boundary

- Gewinner-Multiplier, Walze, Beträge: **Server** final.
- **Client** nur Darstellung; **keine** eigene Multiplier-Mathematik.

---

## 7. Offene Punkte (Math / Art / API)

- [ ] Konkrete **Lande- vs. Expand-Wahrscheinlichkeiten** für Freispiel-Session vs. Base Game (§2.3–§2.4).
- [ ] Absicherung **„≥1 Show in 8 Spins“** und **„Anteil gewinnender Clashes“** in Simulations-Spezifikation.
- [ ] Mehrere Gears-Clash-Symbole in einem Spin; Reihenfolge mit anderen Features.
- [ ] Asset-/Sound-Spezifikation.

---

*Gears Clash bleibt eigenständige Mechanik/Marke ohne Fremd-Titel im Spiel.*
