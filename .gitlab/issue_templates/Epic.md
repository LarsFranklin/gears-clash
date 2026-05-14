**Titel (Pflicht):** `[Epic] - <Themenbereich>`

---

## Epic: [Themenbereich]

<!-- Kurze, klare Benennung des übergeordneten Themas. -->

---

### Zielsetzung

<!-- Was soll am Ende dieses Epics erreicht sein? (z. B. „Heist-Run-Bonus voll integriert: Engine, Renderer, Overlay, Mock") -->

---

### Betroffene Bereiche

| Bereich | Rolle im Epic |
|---------|---------------|
| | |

---

### Verknüpfte Issues

**Tasks:**
- #<!-- IID --> — <!-- Titel -->

**Bugs:**
- #<!-- IID --> — <!-- Titel -->

---

### Fortschritt / Roadmap

- [ ] **Phase 1:** Analyse & Architektur-Design (Engines/Renderer/Adapter-Schnitt)
- [ ] **Phase 2:** Datenmodell & Public-API-Skizze (`config/types.ts`, ggf. Schema)
- [ ] **Phase 3:** Engine-/Adapter-Implementierung
- [ ] **Phase 4:** Renderer / UI-Integration
- [ ] **Phase 5:** Mock + Beispiel-Spin-Daten
- [ ] **Phase 6:** Review, Build, README/Schema-Doku

---

### Definition of Done (Epic-Ebene)

- [ ] Alle verknüpften Issues geschlossen
- [ ] End-to-End in der Demo (`npm run dev`) verifiziert
- [ ] Public API erweitert/exportiert (`src/index.ts`, IIFE-Global, README)
- [ ] Schichten-Konventionen eingehalten

---

/label ~"type::epic"
