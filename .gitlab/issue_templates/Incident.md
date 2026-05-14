**Titel (Pflicht):** `[Incident] - <Kurztitel>`

---

## Incident: [Kurztitel]

<!-- Aktive, prägnante Beschreibung: Was ist wo ausgefallen / kritisch fehlerhaft? -->

---

### Schweregrad & Status

| Feld | Wert |
|------|------|
| Schweregrad | <!-- Kritisch / Hoch / Mittel --> |
| Status | <!-- Aktiv / Mitigiert / Behoben --> |
| Entdeckt am | <!-- YYYY-MM-DD HH:MM --> |

---

### Impact

| Bereich | Auswirkung |
|---------|------------|
| Betroffene Hosts | <!-- z. B. Laravel-Demo, Standalone IIFE, Mock --> |
| Betroffene Module | <!-- core / renderer / adapters / ui / build --> |
| Build-Variante | <!-- ESM / IIFE / dev --> |
| Plattform | <!-- Browser, OS, Mobile? --> |

---

### Reproduktionsschritte

1.
2.
3.

---

### Root Cause Analyse

**Ursache:**

| Bereich | Datei | Modul / Funktion |
|---------|-------|------------------|
| | | |

---

### Fix & Verifikation

**Fix-Beschreibung:**

**Getestet in:**
- [ ] Lokale Demo (`npm run dev`)
- [ ] `npm run build` + IIFE manuell geladen
- [ ] Host-Szenario (Laravel/React/Blade)

---

### Incident-Abschluss

- [ ] Root Cause identifiziert und dokumentiert
- [ ] Fix implementiert und verifiziert
- [ ] Public API unverändert oder bewusst angepasst (Doku/Schema)
- [ ] Präventions-Maßnahmen als Tasks erfasst (Tests, Guard-Rails)

---

/label ~"type::incident"
