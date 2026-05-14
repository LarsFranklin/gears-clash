# Ideen — Mechaniken für spätere Slots / Erweiterungen

Diese Datei ist **keine** Single Source of Truth für einen konkreten Bonus in Gears Clash. Sie sammelt **optionale** Mechaniken, die **aktuell nicht** im festgelegten Umfang von Heist Run (oder anderen festgeschriebenen Modi) vorgesehen sind, aber für **spätere Versionen** oder **andere Slot-Titel** diskutiert werden können.

---

## 1. Sticky Wild + Multiplier pro Zelle

**Idee:** Wie ein normales Sticky-Zell-Wild, aber die Zelle trägt einen **persistierenden Multiplier** (z. B. x2, x3), der bis zum Ende der Bonusrunde auf Gewinne wirkt, die diese Zelle nutzen.

**Heute in Gears Clash (Heist Run):** **Nicht** vorgesehen — Heist Run nutzt **einfache** Sticky-Zell-Wilds **ohne** Multiplier (siehe `docs/bonuses/heist-run.md` §9).

**Technische Anmerkung:** `HeistRunStickyWild` in `src/config/types.ts` erlaubt optional `multiplier` — für **Heist Run v1** Produkt: **nicht** einsetzen; Feld bleibt für andere Builds oder spätere Spezifikationen verfügbar.

---

## 2. Weitere Sammelpunkte (Platzhalter)

- Retrigger-Caps pro Session (Hard-Limit auf Anzahl +4-Events).
- „Super-Retrigger“ mit anderer Belohnung als +4 FS.
- Bonus-Kauf / Feature-Buy (Regulierung beachten).

---

*Bei Übernahme einer Idee in ein echtes Feature: eigenes Bonus-Dokument oder eigenes Slot-GDD anlegen und diese Datei nur als Archiv/Ideenpool nutzen.*
