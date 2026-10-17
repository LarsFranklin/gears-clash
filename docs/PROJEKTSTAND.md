# Projektstand — Gears Clash

Gears Clash ist ein eigenes Slot-Produkt. Es hat mit anderen Projekten nichts zu tun. Dieser Stand beschreibt nur dieses Repository.

## Phase

Frühe Produktion. Die Spielregeln, die drei Bonus-Modi und der 5×5-Client existieren. Die Maschine wird visuell überarbeitet, damit sie wie ein Slot-Schrank wirkt und nicht wie eine Webseite mit einem Canvas in der Mitte. Die Optik ist nicht abgenommen. Am Rahmen gibt es noch viele offene Schritte.

Eine spätere Einbettung in Otz 69 ist möglich. Aktuell besteht dazu kein Zusammenhang: kein gemeinsamer Code, keine gemeinsame Ausgabe, keine Abhängigkeit.

## Was jetzt im Baum liegt

- Der Schrank wird aus einzelnen Bildern zusammengesetzt (Ecken, Leisten, Platte, Schmuck), nicht aus einer einzigen Rahmendatei.
- Das 5×5-Raster sitzt im Innenfenster und läuft bis an die Messingkante. Die großen schwarzen Restflächen neben dem Raster sind geschlossen.
- Balance, Einsatz, Gewinn und Spin liegen im unteren Streifen desselben Rahmens.
- Die Spieleransicht (Port 5173) zeigt die Maschine ohne Werkzeuge. Die Entwickleransicht (Port 5174) behält die Werkzeuge.
- Die Wild-Animation legt kein halbtransparentes schwarzes Feld mehr über das Raster.

## Was noch offen ist

Der Rahmen ist besser, aber nicht fertig. Ecken und Leisten sind weiterhin einzelne Bilder und wirken an den Stößen zusammengesetzt. Das obere Zahnrad kann die erste Symbolreihe noch schneiden. Die Konsole ist eine Bucht im Rahmen, noch keine eingelassenen Anzeigen. Die Rahmenbilder werden voraussichtlich neu erzeugt und enger zusammengesetzt. Dafür sind viele einzelne Schritte nötig. Die Überarbeitung läuft als eigener Strang in diesem Repository.

## Meilensteine

Geführt im GitHub-Project [Gears Clash](https://github.com/users/LarsFranklin/projects/3).

| Meilenstein | Inhalt |
|-------------|--------|
| [M1 — Schrank und Raster](https://github.com/LarsFranklin/gears-clash/milestone/1) | Innenfenster, 5×5 bis zur Messingkante, keine schwarzen Restflächen |
| [M2 — Rahmenbilder neu](https://github.com/LarsFranklin/gears-clash/milestone/2) | Einzelteile neu erzeugen und als eine Maschine zusammensetzen |
| [M3 — Konsole im Rahmen](https://github.com/LarsFranklin/gears-clash/milestone/3) | Werte und Spin als Flächen des Schranks |
| [M4 — Spieleransicht abnahmefähig](https://github.com/LarsFranklin/gears-clash/milestone/4) | Nur die Maschine auf dem Spielerport |
| [M5 — Einbettung vorbereiten](https://github.com/LarsFranklin/gears-clash/milestone/5) | Paket später einbettbar machen, aktuell ohne Host |

## Quelle

Code und dieser Stand liegen in `LarsFranklin/gears-clash`. Auszahlungen bleiben serverseitig. Der Client zeigt, was der Server liefert.
