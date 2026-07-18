// Desarrollo: levanta Vite (frontend) + servidor WebSocket (chat/presencia) en paralelo.
// Uso: npm run dev:all
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

mkdirSync(path.join(root, "dist-dev"), { recursive: true });

// 1. Empaquetar SOLO el servidor WS (dependencia unica: ws) - rapido y sin env.
//    El banner createRequire es OBLIGATORIO: ws usa require() de modulos node internos.
await build({
  entryPoints: [path.join(root, "api/ws-dev.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: path.join(root, "dist-dev/ws-dev.js"),
  banner: {
    js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});

// 2. Iniciar WebSocket server (puerto 3001, accesible en red local)
const wsServer = spawn(process.execPath, [path.join(root, "dist-dev", "ws-dev.js")], {
  stdio: "inherit",
  env: process.env,
});
wsServer.on("error", (err) => console.error("[dev] Error iniciando WebSocket:", err.message));

// 3. Iniciar Vite accesible en red local (puerto 5173).
//    Se invoca node node_modules/vite/bin/vite.js: funciona igual en Windows, Linux y Mac.
//    (Hacer spawn de npx.cmd / npx.ps1 falla con EINVAL en Windows.)
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(viteBin)) {
  console.error("[dev] No se encontro Vite en node_modules. Ejecuta primero: npm install");
  wsServer.kill();
  process.exit(1);
}
const vite = spawn(process.execPath, [viteBin, "--host"], { stdio: "inherit", cwd: root });
vite.on("error", (err) => console.error("[dev] Error iniciando Vite:", err.message));

function shutdown() {
  wsServer.kill();
  vite.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
