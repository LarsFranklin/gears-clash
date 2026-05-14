# Lizenz

`gears-clash-game` ist aktuell **`UNLICENSED`** (siehe `package.json` → `"license"`).

Solange keine andere Lizenz beim Release explizit gesetzt wird, gilt:

- **Alle Rechte vorbehalten.** Quellcode, Schema, Assets und Dokumentation dürfen ohne ausdrückliche schriftliche Genehmigung der Inhaber nicht kopiert, verbreitet, modifiziert oder kommerziell genutzt werden.
- Keine Nutzungs-, Vertriebs- oder Distributionsrechte werden implizit erteilt.

## Vor dem ersten externen Release

Vor der Veröffentlichung an Hosts oder Drittanbieter ist eine endgültige Lizenz-Entscheidung erforderlich:

- **Proprietär (Empfehlung für kommerzielle Distribution):** Lizenz-Text als `LICENSE`-Datei ergänzen, `package.json` → `"license"` z. B. auf `"SEE LICENSE IN LICENSE"` setzen.
- **Open Source (z. B. MIT / Apache-2.0):** SPDX-Identifier in `package.json` → `"license"` setzen und passende Lizenz-Datei ergänzen.

Bis dahin gelten die Repository-internen Konventionen aus `.cursor/rules/deploy-safety.mdc` (Releases / Tags nur nach ausdrücklicher Anweisung).
