// Entrada ligera para DESARROLLO: solo el servidor WebSocket (chat + presencia).
// No carga tRPC, DB ni variables de entorno, asi funciona siempre con `npm run dev:all`.
import { startWebSocketServer } from "./websocket";

const port = Number(process.env.WS_PORT) || 3001;
startWebSocketServer(port, "0.0.0.0");
