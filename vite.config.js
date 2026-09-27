import { resolve } from 'path';
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function copyFolder(src, destBase, outDir) {
  const entries = readdirSync(src);
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(outDir, destBase, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyFolder(srcPath, join(destBase, entry), outDir);
    } else {
      mkdirSync(join(outDir, destBase), { recursive: true });
      copyFileSync(srcPath, destPath);
    }
  }
}

function staticCopyPlugin(targets) {
  return {
    name: 'static-copy',
    closeBundle() {
      for (const { src, dest } of targets) {
        const outDir = resolve(__dirname, 'dist');
        copyFolder(resolve(__dirname, src), dest, outDir);
        console.log(`✓ Copied ${src} → dist/${dest}`);
      }
    }
  };
}

export default defineConfig({
  root: './',
  base: './',
  publicDir: false,
  plugins: [
    staticCopyPlugin([
      { src: 'images', dest: 'images' },
      { src: 'css', dest: 'css' },
    ])
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        dashboard: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        products: resolve(__dirname, 'products.html'),
        orders: resolve(__dirname, 'orders.html'),
        invoice: resolve(__dirname, 'invoice.html'),
      },
    },
  },
  server: {
    port: 3001,
    open: false,
  },
});
