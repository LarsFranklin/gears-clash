# Gears Clash — Desktop & Mobile Strategy

## Ziel

**Gears Clash** soll kein reines Mobile-First-Spiel sein.

Stattdessen:

```txt
Desktop Premium Experience
+
Mobile Responsive Experience
```

Das Spiel muss auf Desktop und Mobile sauber funktionieren, darf aber auf Desktop deutlich größer, atmosphärischer und effektlastiger wirken.

---

# 1. Grundentscheidung

## Nicht Mobile First

Gears Clash wird nicht primär für kleine Handy-Screens entworfen.

## Stattdessen

```txt
Desktop first in presentation
Responsive in execution
```

Das bedeutet:

- Desktop bekommt die volle visuelle Erfahrung
- Mobile bekommt eine kompakte, stabile und gut lesbare Version
- beide Versionen nutzen dieselbe Core-Engine
- UI-Layout und FX-Level können sich unterscheiden

---

# 2. Warum Desktop wichtig ist

Gears Clash lebt von:

- Industrial / Factory Theme
- großen Maschinen
- Overdrive-Reactor-Fantasy
- Sparks, Smoke, Steam
- Screen Shake
- großen Win-Presentations
- animierten Hintergründen
- Multipliers und Full-Reel-Wilds

Diese Elemente wirken auf Desktop deutlich stärker.

---

# 3. Plattform-Fokus

| Plattform | Fokus |
|---|---|
| Desktop | Immersion, FX, Atmosphäre, große Präsentation |
| Mobile | Lesbarkeit, Geschwindigkeit, Touch-Bedienung, Performance |

---

# 4. Desktop Experience

## Zielgefühl

Desktop soll sich anfühlen wie:

```txt
Industrial Control Room
Reactor Machine
Premium Slot Console
```

---

## Desktop Layout Ideen

### Zentral

- großes 5x5 Slot Grid
- großer Game Frame
- animierter Hintergrund
- dominante Win Presentation

### Links

Mögliche Panels:

- Feature Status
- Reactor Status
- Active Gear Reels
- Bonus Progress
- Overheat Level

### Rechts

Mögliche Panels:

- Session Stats
- Biggest Win
- Win History
- Active Effects
- Current Multiplier

### Unten

- Spin Button
- Bet Controls
- Auto Spin
- Turbo / Overclock
- Balance / Win / Bet

---

# 5. Mobile Experience

## Zielgefühl

Mobile soll sein:

```txt
kompakt
klar
schnell
lesbar
stabil
```

---

## Mobile Layout Ideen

### Fokus

- Slot Grid im Zentrum
- kompakter HUD
- große Touchflächen
- wenig Nebenpanels

### UI

- wichtige Werte unten oder oben
- Menü als Overlay
- Bonusinformationen als kompakte Panels
- weniger permanente Sidebars

---

# 6. Wichtig: Desktop nicht einfach auf Mobile schrumpfen

Nicht:

```txt
Desktop UI nur kleiner skalieren
```

Sondern:

```txt
adaptives Layout
```

Mobile braucht eigene Layout-Regeln.

---

# 7. Responsive Layout Modes

## Empfohlene Layout-Modi

```txt
compact
standard
wide
ultrawide
```

---

## compact

Für:

- Smartphones
- kleine Browserfenster

Eigenschaften:

- keine Sidebars
- minimales HUD
- weniger FX
- größere Touch Buttons

---

## standard

Für:

- Tablets
- kleine Laptops
- normale Browserfenster

Eigenschaften:

- großes Grid
- kompakte Zusatzinfos
- normale FX

---

## wide

Für:

- Desktop Monitore
- Full HD / 1440p

Eigenschaften:

- Side Panels möglich
- großes Grid
- animierter Hintergrund
- stärkere FX

---

## ultrawide

Für:

- 21:9 / große Monitore
- Streaming / Creator Content

Eigenschaften:

- maximale Atmosphäre
- große Background-Flächen
- zusätzliche Panels
- volle FX

---

# 8. FX Quality Presets

Gears Clash sollte eigene FX-Qualitätsstufen unterstützen.

| Preset | Ziel |
|---|---|
| Low | Mobile Safe / schwache Geräte |
| Medium | Standard |
| High | Desktop |
| Ultra | High-End / Streaming |

---

## Low

- reduzierte Partikel
- weniger Smoke
- weniger Screen Shake
- keine teuren Blur-Effekte
- stabile FPS priorisieren

---

## Medium

- Standard-Partikel
- leichte Background-Animation
- moderate Win-FX

---

## High

- mehr Sparks
- mehr Smoke
- stärkere Lighting-FX
- größere Win-Presentations
- mehr Background Motion

---

## Ultra

- maximale FX
- intensive Overdrive-Animationen
- Screen Distortion
- starke Glow-Effekte
- Streaming-taugliche Präsentation

---

# 9. Mobile Performance Regeln

Mobile muss besonders beachten:

- Akkuverbrauch
- Temperatur
- Safari/iOS Stabilität
- Canvas-Größe
- Partikelmenge
- Textlesbarkeit
- Touch-Zonen

---

## Mobile Limitierungen

Auf Mobile reduzieren:

- Partikelzahl
- Blur
- Screen Shake
- Hintergrundbewegungen
- gleichzeitige FX-Layer

---

# 10. Desktop Performance Regeln

Desktop darf mehr darstellen:

- größere Canvas-Flächen
- mehr Partikel
- Hintergrundanimationen
- Side Panels
- größere Win Screens
- längere Bonus-Intros

Aber:

- FPS stabil halten
- Renderer sauber destroyen
- keine Memory Leaks
- Resize sauber behandeln

---

# 11. Technische Anforderungen

## Responsive Renderer

Der PixiJS Renderer muss:

- Containergröße beobachten
- Canvas dynamisch skalieren
- Aspect Ratio respektieren
- Grid niemals verzerren
- bei Resize sauber neu layouten

---

## Layout System

Das Game sollte intern anhand der Containergröße entscheiden:

```txt
compact / standard / wide / ultrawide
```

Beispiel:

```txt
width < 640px => compact
640px - 1024px => standard
1024px - 1600px => wide
>1600px => ultrawide
```

---

# 12. UI Layer Architektur

Gears Clash braucht klare Layer:

```txt
Background Layer
Game Grid Layer
FX Layer
Win Presentation Layer
HUD Layer
Menu Overlay Layer
Debug Layer
```

---

## Warum Layer wichtig sind

Damit:

- Menüs über dem Spiel liegen
- Win-Effekte nicht UI zerstören
- Bonus-Intros sauber abgespielt werden
- mobile und desktop UI getrennt skaliert werden können

---

# 13. Desktop UI Ideen

## Links Panel

Mögliche Inhalte:

- Reactor Status
- Overheat Level
- Active Gear Reels
- Bonus Progress

---

## Rechts Panel

Mögliche Inhalte:

- Current Multiplier
- Session Win
- Biggest Win
- Last Wins

---

## Bottom Bar

- Spin Button
- Bet Controls
- Auto Spin
- Turbo / Overclock
- Balance
- Win
- Menu

---

# 14. Mobile UI Ideen

## Main Screen

- Grid prominent
- Spin Button groß
- Balance / Bet / Win kompakt
- Menu Button
- Auto/Turbo über Overlay

---

## Mobile Overlay Menus

Menüs sollten als:

```txt
fullscreen oder bottom sheet
```

erscheinen.

---

# 15. Feature-spezifische Layouts

## gears_clash

Desktop:

- große Gear-Reel-Animationen
- side panels für Active Reels
- Overdrive FX

Mobile:

- Fokus auf Full-Reel-Wilds
- kleinere Zusatzanzeigen
- klare Multiplier-Anzeige

---

## heist_run

Desktop:

- Sticky Wilds mit starken Lock-FX
- Progress-Panel
- Total Win Panel

Mobile:

- kompakter Free Spins Counter
- Sticky Highlights

---

## deadlock_mode

Desktop:

- Collection Storage sichtbar
- Stability Charges groß dargestellt
- Overdrive Release als Event

Mobile:

- Collection Storage als kompakte Leiste
- Lives/Stability oben oder unten

---

# 16. Qualitätsziel

Das Spiel soll auf Desktop wirken wie:

```txt
Premium Slot + Industrial Game UI
```

Auf Mobile wie:

```txt
kompakter Premium Slot
```

---

# 17. Entwicklungsreihenfolge

## Phase 1

Responsive Layout System definieren.

## Phase 2

Desktop Layout verbessern.

## Phase 3

Mobile Layout separat optimieren.

## Phase 4

FX Quality Presets einbauen.

## Phase 5

Feature-spezifische Layouts ergänzen.

---

# 18. Cursor / Agent Hinweise

Wichtige Regeln für zukünftige Entwicklung:

- Nicht nur CSS skalieren, sondern Layout-Modi verwenden.
- Keine harte Mobile-First-Annahme.
- Desktop darf mehr UI und FX haben.
- Mobile muss stabil und lesbar bleiben.
- Renderer darf Grid nicht verzerren.
- FX müssen nach Qualität steuerbar sein.
- UI muss weiterhin framework-agnostisch bleiben.
- Keine Tailwind-Abhängigkeit im Package.
- gc-* CSS Prefix beibehalten.

---

# Ende

