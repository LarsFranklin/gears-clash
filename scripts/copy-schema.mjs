import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'src/config/gameConfig.schema.json');
const dest = resolve(root, 'dist/gameConfig.schema.json');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
