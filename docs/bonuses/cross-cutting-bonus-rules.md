# Bonus-übergreifende Regeln

Gilt für **alle** Bonus-Sessions mit Freispielen bzw. phasenweise gebündelten Spins (`gears_clash`, `heist_run`, `deadlock_mode` …).

---

## 1. Scatter-Strip-Isolation (keine Fremd-Bonus-Scatter)

- Sobald **ein** Bonus-Feature aktiv ist (Session läuft), dürfen auf den Walzen / im für diese Session gültigen **Symbol-Pool** **nur** die **Bonus-Scatter** landen, die **dieses** Feature auslösen bzw. retriggern.
- **Alle anderen** Bonus-Scatter-Symbole (andere `bonusId` / andere `symbolId`s) werden aus dem **Pool / den Strips** **entfernt** bzw. **nicht ausgespielt** — damit es **keine** widersprüchlichen Doppel-Trigger gibt (z. B. 3× Heist-Scatter während Deadlock).
- **Retrigger:** Es bleibt **nur** der Scatter des **aktuellen** Modus relevant (z. B. nur `bonus_heist_run` während Heist Run).

**Konfig-Referenz (Beispiele):**

| Bonus | Typische Scatter-`symbolId` |
|--------|-----------------------------|
| Heist Run | `bonus_heist_run` |
| Deadlock Mode | `bonus_deadlock_mode` |
| Gears Clash (Freispiel-Bonus) | `bonus_gears_clash` |

---

## 2. Schnittstelle zu „Gears Clash“ während anderer Modi

- Die **Kampf-/Expand-Mechanik** (Full-Reel-Wild nach Regeln in [gears-clash.md](gears-clash.md)) kann in **anderen** Sessions vorkommen, wenn der **Server** das Spin-Ergebnis so setzt — **ohne** dass dafür zwingend das Scatter-Symbol `bonus_gears_clash` auf dem Strip liegen muss (z. B. Feature-Flag / separates Listen-Symbol laut Math).
- **Bonus-Scatter-Isolation** betrifft **nur** die **konkurrierenden Scatter-Typen** der drei Haupt-Boni, nicht automatisch jedes erdenkliche Feature-Symbol — Details klärt **Backend** mit Math.

---

## 3. Verknüpfte Dokumente

- [heist-run.md](heist-run.md)  
- [deadlock-mode.md](deadlock-mode.md)  
- [gears-clash.md](gears-clash.md)
