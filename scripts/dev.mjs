// Desarrollo: levanta Vite (frontend) + servidor WebSocket (chat/presencia) en paralelo.
// Uso: npm run dev:all
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { mkdirSync } from "node:fs";

mkdirSync("dist-dev", { recursive: true });

// 1. Empaquetar SOLO el servidor WS (dependencia unica: ws) - rapido y sin env
await build({
  entryPoints: ["api/ws-dev.ts"],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: "dist-dev/ws-dev.js",
  logLevel: "info",
});

// 2. Iniciar WebSocket server (puerto 3001, accesible en red local)
const wsServer = spawn(process.execPath, ["dist-dev/ws-dev.js"], {
  stdio: "inherit",
  env: process.env,
});

// 3. Iniciar Vite (puerto 5173)
const viteCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const vite = spawn(viteCmd, ["vite", "--host"], { stdio: "inherit" });

function shutdown() {
  wsServer.kill();
  vite.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
