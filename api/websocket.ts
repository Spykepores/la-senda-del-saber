import { WebSocketServer, WebSocket } from "ws";

// ============================================================
// TIPOS
// ============================================================
type WSMessageType =
  | "join" | "leave" | "chat" | "ping" | "pong" | "presence"
  | "history" | "roomUsers" | "game" | "turn" | "roulette"
  | "question" | "answer" | "dice" | "forfeit" | "state";

interface WSMessage {
  type: WSMessageType;
  room?: string;
  senderId?: number;
  senderName?: string;
  content?: string;
  timestamp?: number;
  messages?: any[];
  users?: any[];
  state?: any;
  category?: string;
  question?: any;
  correct?: boolean;
  diceValue?: number;
}

interface ClientInfo {
  ws: WebSocket;
  rooms: Set<string>;
  userId: number;
  userName: string;
  lastPing: number;
}

interface GameState {
  roomId: string;
  players: Array<{
    id: number; name: string;
    seals: Record<string, number>;
    brokenCount: number;
    correctCount: number;
    wrongCount: number;
    totalTimeMs: number;
    diceValue?: number;
  }>;
  hostId: number;
  turnId: number;
  phase: "waiting" | "dice_roll" | "playing" | "roulette" | "question" | "result" | "finished" | "forfeit";
  winnerId?: number | null;
  currentCategory?: string;
  questionStartTime: number;
  forfeitBy?: number;
  winReason?: string;
  lastAnswerCorrect?: boolean;
  diceRolled: boolean;
  status: "open" | "playing" | "finished";
  createdAt: number;
}

// ============================================================
// ALMACENAMIENTO
// ============================================================
const clients = new Map<WebSocket, ClientInfo>();
const roomHistory = new Map<string, Array<{ senderId: number; senderName: string; content: string; timestamp: number }>>();
const gameRooms = new Map<string, GameState>();
const MAX_HISTORY = 100;
const CATEGORIES = ["historia","personajes","libros","ensenanzas","geografia","profecias","nuevo_testamento"];
const SEALS_TO_BREAK = 2;

// ============================================================
// UTILIDADES
// ============================================================
function broadcast(room: string, message: WSMessage, exclude?: WebSocket) {
  const data = JSON.stringify(message);
  for (const [, info] of clients) {
    if (info.rooms.has(room) && info.ws !== exclude && info.ws.readyState === WebSocket.OPEN) {
      info.ws.send(data);
    }
  }
}

// Broadcast INCLUYENDO al emisor (chat vuelve al emisor)
function broadcastAll(room: string, message: WSMessage) {
  const data = JSON.stringify(message);
  for (const [, info] of clients) {
    if (info.rooms.has(room) && info.ws.readyState === WebSocket.OPEN) info.ws.send(data);
  }
}

function addToHistory(room: string, msg: { senderId: number; senderName: string; content: string; timestamp: number }) {
  if (!roomHistory.has(room)) roomHistory.set(room, []);
  const h = roomHistory.get(room)!; h.push(msg);
  if (h.length > MAX_HISTORY) h.shift();
}

function getRoomUsers(room: string): Array<{ id: number; name: string }> {
  const users: Array<{ id: number; name: string }> = [];
  const seen = new Set<number>();
  for (const [, info] of clients) {
    if (info.rooms.has(room) && !seen.has(info.userId)) {
      seen.add(info.userId);
      users.push({ id: info.userId, name: info.userName });
    }
  }
  return users;
}

function sendRoomUsers(room: string) {
  broadcastAll(room, { type: "roomUsers", room, users: getRoomUsers(room) });
}

function getOrCreateRoom(roomId: string): GameState {
  if (!gameRooms.has(roomId)) {
    gameRooms.set(roomId, {
      roomId, players: [], hostId: 0, turnId: 0, phase: "waiting",
      questionStartTime: Date.now(), diceRolled: false,
      status: "open", createdAt: Date.now(),
    });
  }
  return gameRooms.get(roomId)!;
}

function sendGameState(room: string) {
  const state = gameRooms.get(room);
  if (state) broadcastAll(room, { type: "state", room, state });
}

function removeClient(ws: WebSocket) {
  const info = clients.get(ws);
  if (!info) return;
  for (const room of info.rooms) {
    info.rooms.delete(room);
    const gr = gameRooms.get(room);
    if (gr) {
      gr.players = gr.players.filter((p) => p.id !== info.userId);
      if (gr.players.length === 0) gameRooms.delete(room);
      else if (gr.hostId === info.userId && gr.players.length > 0) gr.hostId = gr.players[0].id;
    }
    broadcast(room, { type: "presence", room, senderId: info.userId, senderName: info.userName, content: "disconnected", timestamp: Date.now() });
    sendRoomUsers(room);
    sendGameState(room);
  }
  clients.delete(ws);
}

// ============================================================
// SERVIDOR
// ============================================================
export function startWebSocketServer(port: number = 3001, host: string = "0.0.0.0") {
  const wss = new WebSocketServer({ port, host });
  console.log(`[WebSocket] Server running on ws://${host}:${port}`);

  // Heartbeat
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [ws, info] of clients) {
      if (now - info.lastPing > 60000) { ws.terminate(); removeClient(ws); }
      else if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);

  wss.on("connection", (ws) => {
    const info: ClientInfo = { ws, rooms: new Set(), userId: 0, userName: "Anonimo", lastPing: Date.now() };
    clients.set(ws, info);

    ws.on("message", (raw) => {
      try {
        const msg: WSMessage = JSON.parse(raw.toString());
        info.lastPing = Date.now();

        switch (msg.type) {
          // ---- JOIN ----
          case "join": {
            if (msg.room && msg.senderId && msg.senderName) {
              info.userId = msg.senderId;
              info.userName = msg.senderName;
              info.rooms.add(msg.room);

              const gr = getOrCreateRoom(msg.room);
              if (!gr.players.find((p) => p.id === msg.senderId)) {
                gr.players.push({ id: msg.senderId, name: msg.senderName, seals: Object.fromEntries(CATEGORIES.map((c) => [c, 0])), brokenCount: 0, correctCount: 0, wrongCount: 0, totalTimeMs: 0 });
                if (gr.players.length === 1) gr.hostId = msg.senderId;
                if (gr.players.length >= 2 && gr.status === "open") { gr.status = "playing"; gr.phase = "dice_roll"; }
              }

              // Enviar historial
              ws.send(JSON.stringify({ type: "history", room: msg.room, messages: roomHistory.get(msg.room) || [] }));
              // Enviar usuarios y estado
              sendRoomUsers(msg.room);
              sendGameState(msg.room);
              // Notificar a otros
              broadcast(msg.room, { type: "presence", room: msg.room, senderId: msg.senderId, senderName: msg.senderName, content: "joined", timestamp: Date.now() }, ws);
            }
            break;
          }

          // ---- LEAVE ----
          case "leave": {
            if (msg.room && info.userId) {
              info.rooms.delete(msg.room);
              const gr = gameRooms.get(msg.room);
              if (gr) { gr.players = gr.players.filter((p) => p.id !== info.userId); if (gr.players.length === 0) gameRooms.delete(msg.room); }
              broadcast(msg.room, { type: "presence", room: msg.room, senderId: info.userId, senderName: info.userName, content: "left", timestamp: Date.now() });
              sendRoomUsers(msg.room);
              sendGameState(msg.room);
            }
            break;
          }

          // ---- CHAT (validado con info.userId del servidor) ----
          case "chat": {
            if (msg.room && msg.content && info.userId) {
              const chatMsg: WSMessage = {
                type: "chat", room: msg.room,
                senderId: info.userId, senderName: info.userName, // SERVIDOR valida identidad
                content: msg.content, timestamp: Date.now(),
              };
              addToHistory(msg.room, { senderId: info.userId, senderName: info.userName, content: msg.content, timestamp: Date.now() });
              broadcastAll(msg.room, chatMsg); // INCLUYE al emisor
            }
            break;
          }

          // ---- DICE ----
          case "dice": {
            if (msg.room && info.userId) {
              const gr = gameRooms.get(msg.room);
              if (!gr) break;
              const p = gr.players.find((pl) => pl.id === info.userId);
              if (p && !p.diceValue) {
                p.diceValue = Math.floor(Math.random() * 6) + 1;
                const allRolled = gr.players.every((pl) => pl.diceValue);
                if (allRolled && gr.players.length >= 2) {
                  gr.diceRolled = true;
                  const p1 = gr.players[0], p2 = gr.players[1];
                  if ((p1.diceValue||0) > (p2.diceValue||0)) { gr.turnId = p1.id; gr.phase = "playing"; }
                  else if ((p2.diceValue||0) > (p1.diceValue||0)) { gr.turnId = p2.id; gr.phase = "playing"; }
                  else { gr.players.forEach((pl) => (pl.diceValue = undefined)); gr.diceRolled = false; }
                }
                sendGameState(msg.room);
              }
            }
            break;
          }

          // ---- ROULETTE ----
          case "roulette": {
            if (msg.room && info.userId) {
              const gr = gameRooms.get(msg.room);
              if (!gr) break;
              const mySeals = gr.players.find((pl) => pl.id === info.userId)?.seals || {};
              const avail = CATEGORIES.filter((c) => (mySeals[c]||0) < SEALS_TO_BREAK);
              const pool = avail.length > 0 ? CATEGORIES.map((c) => ({ id: c })).filter((c) => avail.includes(c.id)) : CATEGORIES.map((c) => ({ id: c }));
              const target = pool[Math.floor(Math.random() * pool.length)];
              gr.currentCategory = target.id;
              gr.phase = "question";
              gr.questionStartTime = Date.now();
              sendGameState(msg.room);
            }
            break;
          }

          // ---- ANSWER ----
          case "answer": {
            if (msg.room && info.userId && msg.correct !== undefined) {
              const gr = gameRooms.get(msg.room);
              if (!gr) break;
              const p = gr.players.find((pl) => pl.id === info.userId);
              if (!p) break;
              if (msg.correct) {
                const cat = gr.currentCategory;
                if (cat) { p.seals[cat] = (p.seals[cat]||0) + 1; p.brokenCount = Object.values(p.seals).filter((v) => v >= SEALS_TO_BREAK).length; }
                p.correctCount++;
                gr.lastAnswerCorrect = true;
                if (p.brokenCount >= CATEGORIES.length) { gr.phase = "finished"; gr.winnerId = info.userId; gr.winReason = "all_seals"; }
                else gr.phase = "result";
              } else {
                p.wrongCount++;
                gr.lastAnswerCorrect = false;
                const other = gr.players.find((pl) => pl.id !== info.userId);
                if (other) { gr.turnId = other.id; gr.phase = "playing"; }
              }
              sendGameState(msg.room);
            }
            break;
          }

          // ---- TURN ----
          case "turn": {
            if (msg.room && info.userId) {
              const gr = gameRooms.get(msg.room);
              if (gr && gr.phase === "result") { gr.phase = "roulette"; sendGameState(msg.room); }
            }
            break;
          }

          // ---- FORFEIT ----
          case "forfeit": {
            if (msg.room && info.userId) {
              const gr = gameRooms.get(msg.room);
              if (gr) {
                const other = gr.players.find((pl) => pl.id !== info.userId);
                gr.winnerId = other?.id || null; gr.phase = "forfeit"; gr.forfeitBy = info.userId;
                gr.winReason = "forfeit"; gr.status = "finished";
                sendGameState(msg.room);
              }
            }
            break;
          }

          // ---- PONG ----
          case "pong": { break; }
        }
      } catch { /* */ }
    });

    ws.on("close", () => removeClient(ws));
    ws.on("error", () => removeClient(ws));
  });

  wss.on("close", () => clearInterval(heartbeat));
  return wss;
}

export function getRoomState(room: string): GameState | undefined { return gameRooms.get(room); }
export function getAllRooms() { return Array.from(gameRooms.entries()).map(([id, r]) => ({ id, status: r.status, playerCount: r.players.length })); }
