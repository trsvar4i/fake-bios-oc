import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** В dev-режиме /api/* обслуживает тот же обработчик, что и функция Vercel (api/_lib/handler.ts). */
function devApi(): Plugin {
  return {
    name: "kestrel-dev-api",
    configureServer(server) {
      Object.assign(process.env, loadEnv("development", process.cwd(), ""));
      server.middlewares.use("/api", async (req, res) => {
        try {
          const { handle } = await server.ssrLoadModule("/api/_lib/handler.ts");
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
          const request = new Request(`http://${req.headers.host}/api${req.url}`, {
            method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
          });
          const response: Response = await handle(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end("dev api error");
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  // относительные пути: сборка работает и на GitHub Pages (/fake-bios-oc/), и локально
  base: "./",
  server: { port: 8137, strictPort: true },
});
