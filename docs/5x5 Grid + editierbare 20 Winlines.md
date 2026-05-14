# ✅ Festlegung: 5x5 Grid + editierbare 20 Winlines

Wir definieren jede Zelle mit einer festen ID:

```
[01][02][03][04][05]
[06][07][08][09][10]
[11][12][13][14][15]
[16][17][18][19][20]
[21][22][23][24][25]
````

Jede Winline besteht dann aus 5 Positionen, also eine Position pro Reel/Spalte.

Beispiel:
```
{
  "id": 1,
  "name": "Top Line",
  "positions": [1, 2, 3, 4, 5],
  "type": "straight",
  "enabled": true
}
```

## 🎰 GEARS CLASH — 20 FESTE WINLINES

```
[
  { "id": 1, "name": "Top Line", "positions": [1,2,3,4,5], "type": "straight", "enabled": true },
  { "id": 2, "name": "Upper Mid", "positions": [6,7,8,9,10], "type": "straight", "enabled": true },
  { "id": 3, "name": "Center Line", "positions": [11,12,13,14,15], "type": "straight", "enabled": true },
  { "id": 4, "name": "Lower Mid", "positions": [16,17,18,19,20], "type": "straight", "enabled": true },
  { "id": 5, "name": "Bottom Line", "positions": [21,22,23,24,25], "type": "straight", "enabled": true },

  { "id": 6, "name": "Downward Diagonal", "positions": [1,7,13,19,25], "type": "diagonal", "enabled": true },
  { "id": 7, "name": "Upward Diagonal", "positions": [21,17,13,9,5], "type": "diagonal", "enabled": true },

  { "id": 8, "name": "Soft Wave Upper", "positions": [6,12,8,14,10], "type": "zigzag", "enabled": true },
  { "id": 9, "name": "Soft Wave Lower", "positions": [16,12,18,14,20], "type": "zigzag", "enabled": true },
  { "id": 10, "name": "Center V", "positions": [11,7,13,9,15], "type": "v", "enabled": true },
  { "id": 11, "name": "Center Inverted V", "positions": [11,17,13,19,15], "type": "v", "enabled": true },

  { "id": 12, "name": "Upper Aggressive Zigzag", "positions": [1,7,3,9,5], "type": "zigzag", "enabled": true },
  { "id": 13, "name": "Lower Aggressive Zigzag", "positions": [21,17,23,19,25], "type": "zigzag", "enabled": true },
  { "id": 14, "name": "Upper M Pattern", "positions": [6,2,8,4,10], "type": "zigzag", "enabled": true },
  { "id": 15, "name": "Lower W Pattern", "positions": [16,22,18,24,20], "type": "zigzag", "enabled": true },

  { "id": 16, "name": "Crusher Pattern", "positions": [6,12,18,14,10], "type": "industrial", "enabled": true },
  { "id": 17, "name": "Reverse Crusher", "positions": [16,12,8,14,20], "type": "industrial", "enabled": true },
  { "id": 18, "name": "Gear Rotation Left", "positions": [11,7,3,9,15], "type": "industrial", "enabled": true },
  { "id": 19, "name": "Gear Rotation Right", "positions": [11,17,23,19,15], "type": "industrial", "enabled": true },
  { "id": 20, "name": "Core Reactor", "positions": [1,7,13,9,15], "type": "hero", "enabled": true }
]
```

## 🛠️ Admin-Tool-Idee

Im Admin-Tool sollte man später:

- Winlines aktivieren/deaktivieren
- Namen ändern
- Positionen per Klick im 5x5 Grid auswählen
- Typ ändern: straight, diagonal, zigzag, v, industrial, hero
- Farbe/FX pro Linie festlegen
- RTP-Testsimulation laufen lassen
- Vorschau der Linie im Grid anzeigen

Wichtig: Eine gültige Winline muss immer genau 5 Felder haben — eines pro Spalte.

Also z. B.:
```
Spalte 1 → ein Feld
Spalte 2 → ein Feld
Spalte 3 → ein Feld
Spalte 4 → ein Feld
Spalte 5 → ein Feld
```
Damit bleibt es sauber animierbar und technisch einfach.
