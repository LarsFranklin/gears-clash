# Gears Clash — Slot Frame Design Template

## Technische Spezifikationen

### Empfohlene Bildgröße
- **Breite:** 1024px (oder 2048px für Retina)
- **Höhe:** ~1024px (Verhältnis ~1:1, leicht hochkant erlaubt)
- **Format:** PNG mit Transparenz (RGBA)

### Das 5×5 Raster-Loch

Das Frame-PNG muss ein **transparentes Rechteck** in der Mitte haben, wo die Symbole sichtbar werden.

**Normierte Position** (in % der Bildgröße):
| Eigenschaft | Wert | Bei 1024px |
|-------------|------|------------|
| **X (links)** | 8.5% | ~87px |
| **Y (oben)** | 14.8% | ~152px |
| **Breite** | 83% | ~850px |
| **Höhe** | 78% | ~799px |

→ Das transparente Loch beginnt ca. **87px** vom linken Rand und **152px** von oben, ist etwa **850×799px** groß.

### Zellstruktur im Loch

- **5 Spalten × 5 Reihen** = 25 Zellen
- Optionales Gitter/Trenner zwischen Zellen: **2–4px** Stege
- Zellen können abgerundete Ecken haben (**Radius: 8–12px**)

---

## Layer-Struktur für Photoshop

```
📁 gears-clash-frame.psd
├── 🔒 [Background] — Transparenz oder Arbeitsfarbe
├── 📁 Frame-Außen
│   ├── Basis-Metallplatte (Messing/Bronze/Stahl)
│   ├── Nieten/Schrauben (Ecken + Seiten)
│   ├── Rohre/Leitungen (Steampunk-Deko)
│   └── Zahnräder (dekorativ, Ecken)
├── 📁 Frame-Innen (um das Loch)
│   ├── Innerer Rand (Messingkante)
│   ├── Gitter-Stege (5×5 Trenner) — OPTIONAL
│   └── Schatteneffekt nach innen
├── 📁 Seitenelemente
│   ├── Links: Manometer/Anzeigen
│   └── Rechts: Manometer/Anzeigen
├── 📁 Oberer Bereich
│   ├── Zentrales Zahnrad/Logo
│   └── Rohre nach außen
└── 📁 Unterer Bereich
    ├── Leuchtanzeige/Display
    └── Deko-Zahnräder
```

---

## Stil-Richtlinien

### Farbpalette (Steampunk/Industrial)
| Element | Hex-Farbe | Beschreibung |
|---------|-----------|--------------|
| Messing (hell) | `#c9a227` | Akzente, Highlights |
| Messing (mittel) | `#8a7858` | Hauptflächen |
| Messing (dunkel) | `#5a4828` | Schatten |
| Bronze | `#b87333` | Warm, Rohre |
| Stahl (hell) | `#7a7a7a` | Kühl, Kontrast |
| Stahl (dunkel) | `#3a3a3a` | Basis |
| Akzent Gold | `#f0d878` | Leuchtende Stellen |
| Schatten | `#1a1810` | Tiefe, Ränder |

### Texturen
- Gebürstetes Metall
- Patina / Oxidation (Grünspan-Akzente)
- Nieten-Muster
- Schraubenlöcher

### Lichtführung
- Hauptlicht von **oben-links** (45°)
- Warmer Schein von **Mitte-oben** (wie von einer Lampe)
- Weiche Schatten nach **rechts-unten**

---

## ChatGPT / DALL-E Prompt

Kopiere diesen Prompt für die KI-Bildgenerierung:

```
Create a steampunk slot machine frame overlay PNG with transparent center.

SPECIFICATIONS:
- Square format (1024x1024 pixels)
- Transparent rectangular hole in center for 5x5 symbol grid
- The transparent area starts at ~8.5% from left, ~15% from top
- Transparent area is ~83% wide and ~78% tall
- Style: Industrial steampunk, brass/bronze/copper metals

FRAME ELEMENTS:
- Thick brass border with rivets at corners
- Decorative gears at top-center and bottom corners
- Vertical copper pipes on left and right sides
- Pressure gauges on left and right (analog dials)
- Top: Large ornate gear centerpiece
- Bottom: Glowing amber indicator panel
- Metal texture: brushed brass with patina accents

LIGHTING:
- Warm ambient glow from top-center
- Metallic reflections on brass surfaces
- Subtle shadows giving depth
- Small glowing elements (gauges, indicator)

COLOR PALETTE:
- Primary: Brass (#c9a227, #8a7858)
- Secondary: Copper/Bronze (#b87333)
- Accents: Steel gray (#5a5a5a)
- Glow: Warm amber (#f0d878)
- Background of frame (NOT the hole): Dark metal (#1a1810)

IMPORTANT:
- The CENTER must be COMPLETELY TRANSPARENT (alpha = 0)
- No grid lines inside the transparent area
- Clean edges around the transparent hole
- Ornate but not cluttered design
- Professional casino slot machine quality
```

---

## Einzelkomponenten für Eigenbau

Falls du Teile einzeln generieren/erstellen willst:

### 1. Ecken (4× benötigt)
```
Steampunk corner bracket, brass metal with rivets, 
45-degree angle, gear decoration, transparent background, 
256x256px, industrial style
```

### 2. Seitenleisten (2× vertikal)
```
Vertical steampunk pipe assembly, copper pipes with valves,
pressure gauge, brass fittings, transparent background,
128x512px, industrial style
```

### 3. Oberer Rahmen
```
Steampunk header bar, ornate brass with central gear medallion,
pipes extending to sides, riveted edges, transparent background,
1024x200px, industrial style
```

### 4. Unterer Rahmen
```
Steampunk footer bar, brass with glowing amber display panel,
small decorative gears at corners, riveted edges, transparent background,
1024x150px, industrial style
```

### 5. Manometer / Gauge (2×)
```
Vintage pressure gauge, brass frame, glass dome, 
analog needle dial, steampunk style, transparent background,
200x200px
```

---

## Test-Checkliste

Bevor du das Frame verwendest:

- [ ] Transparenz: Ist das 5×5-Loch **komplett transparent** (Alpha = 0)?
- [ ] Größe: Ist das Bild mindestens **1024×1024px**?
- [ ] Kanten: Sind die Ränder des Lochs **sauber** (keine Farbsäume)?
- [ ] Proportionen: Passt das Loch zu den Werten in `slotFrameSkin.ts`?
- [ ] Export: PNG-24 mit Transparenz, kein JPG!

---

## Dateien

Nach dem Export speichern als:
```
public/assets/slot_frame.png
```

Die Konfiguration anpassen in:
```
src/renderer/slotFrameSkin.ts
```
