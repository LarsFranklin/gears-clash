import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: '.',
    };
  }

  return {
    build: {
      emptyOutDir: true,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'GearsClash',
        formats: ['es', 'iife'],
        fileName: (format) =>
          format === 'es' ? 'gears-clash.es.js' : 'gears-clash.iife.js',
      },
      rollupOptions: {
        output: {
          /** Ein ESM-Bundle ohne Pixi-Code-Splitting — Host-Import bleibt eine Datei. */
          inlineDynamicImports: true,
          assetFileNames: 'style[extname]',
        },
      },
      cssCodeSplit: false,
    },
  };
});
