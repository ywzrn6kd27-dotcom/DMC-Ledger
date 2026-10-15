import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps asset paths relative so the build works on GitHub Pages
// whether it is served from a project subpath or a custom domain.
export default defineConfig({
  base: './',
  plugins: [react()],
});
