# Dokumentation — Gears Clash

Überblick über die Markdown-Dokumente im Projekt.

## Bonus-Features (pro Modus eine Datei)

Ordner [`bonuses/`](bonuses/README.md) — Spezifikation und Produktlogik je Bonus-ID (`gears_clash`, `heist_run`, `deadlock_mode`).

| Datei | Bonus-ID | Kurzbeschreibung |
|--------|-----------|------------------|
| [bonuses/heist-run.md](bonuses/heist-run.md) | `heist_run` | Heist Run — SSOT: FS-Tabelle, Retrigger, Sticky, UX |
| [bonuses/gears-clash.md](bonuses/gears-clash.md) | `gears_clash` | Gears Clash — Freispiel-Bonus + Kampf/Full-Reel |
| [bonuses/deadlock-mode.md](bonuses/deadlock-mode.md) | `deadlock_mode` | Deadlock Mode — SSOT: Collection, Overdrive, Lives |
| [bonuses/cross-cutting-bonus-rules.md](bonuses/cross-cutting-bonus-rules.md) | — | Scatter-Isolation während Bonus-Sessions |

## Ideen-Pool (kein SSOT)

| Datei | Inhalt |
|--------|--------|
| [ideas-future-slots-mechanics.md](ideas-future-slots-mechanics.md) | Optionale Mechaniken (z. B. Sticky + Multiplier) für später / andere Slots |

## Slot-Design & Mathematik

| Datei | Thema |
|--------|--------|
| [gears_clash_slot_design_analysis_and_gameplay_direction.md](gears_clash_slot_design_analysis_and_gameplay_direction.md) | Gesamtrichtung, alle drei Boni in Kurzform |
| [gears_clash_symbol_tier_structure_final.md](gears_clash_symbol_tier_structure_final.md) | Symbol-Tiers |
| [5x5 Grid + editierbare 20 Winlines.md](5x5%20Grid%20+%20editierbare%2020%20Winlines.md) | Grid 5×5, Winlines |
| [gears_clash_responsive_desktop_mobile_strategy.md](gears_clash_responsive_desktop_mobile_strategy.md) | Responsive Desktop/Mobile |

---

*Hinweis: Auszahlungen und Bonus-Auslösung sind serverseitig definiert; der Client visualisiert nur die gelieferten Payloads (siehe `HeistRunPayload` u. a. in `src/config/types.ts`).*
