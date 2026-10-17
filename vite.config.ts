import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  const tools = mode === 'tools';
  if (command === 'serve') {
    return {
      root: '.',
      server: {
        port: tools ? 5174 : 5173,
        strictPort: true,
      },
    };
  }

  return {
    build: {
      emptyOutDir: true,
      sourcemap: true,
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
          /**
           * Named-Exports — IIFE-Konsumenten greifen auf `GearsClash.GearsClashGame`,
           * `GearsClash.MockGameApiAdapter`, … zu. Kein ungewollter `default`-Wrapper.
           */
          exports: 'named',
        },
      },
      cssCodeSplit: false,
    },
  };
});
