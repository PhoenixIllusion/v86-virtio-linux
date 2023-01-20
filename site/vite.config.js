// vite.config.js
import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['xterm'],
      output: {
        paths: {
          'xterm': 'https://cdn.skypack.dev/xterm'
        },
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
              return "vendor"; // all other package goes here
          }
          if (id.includes("v86")) {
            return "v86";
          }
        }
      },
    },
  }
})