import type { AssetManifest } from '../config/assetManifest';

/**
 * Lädt später Texturen/Sounds aus dem Manifest.
 * v1: keine echten Assets — Renderer nutzt Platzhalter-Grafiken.
 */
export class AssetLoader {
  constructor(private readonly manifest: AssetManifest) {}

  getManifest(): AssetManifest {
    return this.manifest;
  }
}
