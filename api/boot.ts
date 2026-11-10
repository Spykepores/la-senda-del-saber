import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { oauthApp } from "./kimi/auth";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// OAuth de Kimi: expone GET /api/oauth/callback
app.route("/api/oauth", oauthApp);

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// Start servers
async function start() {
  const isDev = !env.isProduction;

  if (isDev) {
    // Desarrollo: WS en puerto separado 3001
    try {
      const { startWebSocketServer } = await import("./websocket/server");
      startWebSocketServer(3001);
    } catch (e) {
      console.warn("[WebSocket] Could not start:", e);
    }
  } else {
    // Produccion: WS + HTTP en el mismo servidor
    try {
      const http = await import("http");
      const { serveStaticFiles } = await import("./lib/vite");
      serveStaticFiles(app);

      const port = parseInt(process.env.PORT || "3000");
      const server = http.createServer(async (req, res) => {
        const response = await app.fetch(req as any);
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });

      // Attach WebSocket to same HTTP server
      const { startWebSocketServerOnExisting } = await import("./websocket/server");
      startWebSocketServerOnExisting(server);

      server.listen(port, () => {
        console.log(`Server running on http://localhost:${port}/`);
      });
      return;
    } catch (e) {
      console.warn("[WebSocket] Could not attach to HTTP server:", e);
    }
  }
}

start();
