**Titel (Pflicht):** `[Bug] - <Kurzbeschreibung>` — siehe `.gitlab/README.md`

---

## Fehlerbeschreibung

<!-- Kurze, aktive Beschreibung: Was ist kaputt? -->

---

### Reproduktionsschritte

1.
2.
3.

**Reproduzierbarkeit:** <!-- Immer / Gelegentlich / Einmalig -->

---

### Erwartetes vs. Tatsächliches Verhalten

| | Beschreibung |
|---|---|
| **Erwartet** | <!-- Was sollte passieren? --> |
| **Tatsächlich** | <!-- Was ist stattdessen passiert? --> |

---

### Systemumgebung

| Feld | Wert |
|------|------|
| Modul / Bereich | <!-- z. B. core/ReelEngine, renderer/PixiSlotRenderer, adapters/HttpGameApiAdapter --> |
| Build | <!-- npm run dev / npm run build / IIFE / ESM-Embed (Host) --> |
| Browser / OS | <!-- z. B. Chrome 132 auf Windows 11 --> |
| Pixi-Version | <!-- aus package.json (aktuell ^8.6.6) --> |
| Vite / TS | <!-- aus package.json --> |

---

### Betroffene Bereiche

| Bereich | Datei / Modul | Funktion |
|---------|--------------|----------|
| | | |

---

### Logs & Anhänge

```
[Hier Konsolen-Logs / Stacktrace einfügen]
```

---

### Definition of Done

- [ ] Fehler reproduziert und Root Cause identifiziert
- [ ] Fix implementiert und fehlerfrei
- [ ] Keine neuen Fehler in verwandten Bereichen (Engines / Renderer / Adapter)
- [ ] Public API unverändert (oder Doku angepasst)
- [ ] `npm run build` läuft sauber durch
- [ ] Lokal (Demo) und mind. ein Host-Szenario (IIFE oder ESM) getestet

---

/label ~"type::bug"
