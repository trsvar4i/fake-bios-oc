import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // относительные пути: сборка работает и на GitHub Pages (/fake-bios-oc/), и локально
  base: "./",
  server: { port: 8137, strictPort: true },
});
