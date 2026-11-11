import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2020', chunkSizeWarningLimit: 4000, assetsInlineLimit: 100000000, cssCodeSplit: false },
  test: { include: ['tests/**/*.test.ts'] },
});
