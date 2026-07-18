import { GAME_CATEGORIES, SEALS_TO_BREAK, QUESTION_TIME_MS } from "./types";
import type { GameServer, GameState, PlayerInfo, QuestionData, WheelResult, ScoreUpdate } from "./types";
import { spinWheel } from "./wheel";

// ============================================================
// LOGICA DEL JUEGO
// ============================================================

// ---- DADOS ----
export function rollDice(server: GameServer, roomId: string, playerId: number): { allRolled: boolean; game: GameState | undefined } {
  const game = server.games.get(roomId);
  const room = server.rooms.get(roomId);
  if (!game || !room) return { allRolled: false, game: undefined };

  const player = server.players.get(playerId);
  if (!player || player.diceValue) return { allRolled: false, game };

  player.diceValue = Math.floor(Math.random() * 6) + 1;

  // Verificar si todos tiraron
  const allPlayers = room.players.map((id) => server.players.get(id)).filter((p): p is PlayerInfo => !!p);
  const allRolled = allPlayers.length >= 2 && allPlayers.every((p) => p.diceValue !== undefined);

  if (allRolled) {
    game.diceRolled = true;
    const p1 = allPlayers[0];
    const p2 = allPlayers[1];

    if ((p1.diceValue || 0) > (p2.diceValue || 0)) {
      game.turn = 0; // p1 empieza
      game.phase = "playing";
    } else if ((p2.diceValue || 0) > (p1.diceValue || 0)) {
      game.turn = 1; // p2 empieza
      game.phase = "playing";
    } else {
      // Empate - resetear dados
      allPlayers.forEach((p) => (p.diceValue = undefined));
      game.diceRolled = false;
    }
  }

  return { allRolled, game };
}

// ---- RULETA ----
export function spinRoulette(server: GameServer, roomId: string, playerId: number): { result: WheelResult | null; game: GameState | undefined } {
  const game = server.games.get(roomId);
  if (!game) return { result: null, game: undefined };

  const player = server.players.get(playerId);
  if (!player) return { result: null, game };

  const result = spinWheel(player.seals);

  game.currentCategory = result.category;
  game.wheelAngle = result.angle;
  game.wheelResult = result.category;
  game.phase = "question";
  game.timer = QUESTION_TIME_MS / 1000;
  game.timerActive = true;

  return { result, game };
}

// ---- PROCESAR RESPUESTA ----
export function processAnswer(
  server: GameServer,
  roomId: string,
  playerId: number,
  correct: boolean
): { game: GameState | undefined; player: PlayerInfo | undefined; finished: boolean } {
  const game = server.games.get(roomId);
  const room = server.rooms.get(roomId);
  if (!game || !room) return { game: undefined, player: undefined, finished: false };

  const player = server.players.get(playerId);
  if (!player) return { game, player: undefined, finished: false };

  const allPlayers = room.players.map((id) => server.players.get(id)).filter((p): p is PlayerInfo => !!p);

  if (correct) {
    const cat = game.currentCategory;
    if (cat) {
      player.seals[cat] = (player.seals[cat] || 0) + 1;
      player.brokenCount = Object.values(player.seals).filter((v) => v >= SEALS_TO_BREAK).length;
      player.score += 100;
    }
    player.correctCount++;
    game.lastAnswerCorrect = true;

    // Verificar victoria
    if (player.brokenCount >= GAME_CATEGORIES.length) {
      game.phase = "finished";
      game.winnerId = playerId;
      game.winReason = "all_seals";
      room.state = "finished";
      game.timerActive = false;
      return { game, player, finished: true };
    }

    game.phase = "result";
  } else {
    player.wrongCount++;
    player.score = Math.max(0, player.score - 25);
    game.lastAnswerCorrect = false;

    // Cambiar turno
    const currentIdx = room.players.indexOf(playerId);
    const nextIdx = (currentIdx + 1) % room.players.length;
    game.turn = nextIdx;
    game.phase = "playing";
    game.timerActive = false;
  }

  return { game, player, finished: false };
}

// ---- CONTINUAR DESPUES DE RESULTADO CORRECTO ----
export function continueAfterCorrect(server: GameServer, roomId: string): GameState | undefined {
  const game = server.games.get(roomId);
  if (!game) return undefined;

  if (game.phase === "result") {
    game.phase = "roulette";
    game.timerActive = false;
  }

  return game;
}

// ---- RENDIRSE ----
export function processForfeit(server: GameServer, roomId: string, playerId: number): GameState | undefined {
  const game = server.games.get(roomId);
  const room = server.rooms.get(roomId);
  if (!game || !room) return undefined;

  const otherId = room.players.find((id) => id !== playerId);
  game.winnerId = otherId || null;
  game.phase = "forfeit";
  game.forfeitBy = playerId;
  game.winReason = "forfeit";
  room.state = "finished";
  game.timerActive = false;

  return game;
}

// ---- TIMER ----
export function decrementTimer(server: GameServer, roomId: string): GameState | undefined {
  const game = server.games.get(roomId);
  if (!game || !game.timerActive) return game;

  game.timer -= 1;
  if (game.timer <= 0) {
    game.timer = 0;
    game.timerActive = false;

    // Tiempo agotado = respuesta incorrecta
    const room = server.rooms.get(roomId);
    if (room) {
      const currentPlayerId = room.players[game.turn];
      if (currentPlayerId) {
        const player = server.players.get(currentPlayerId);
        if (player) {
          player.wrongCount++;
          game.lastAnswerCorrect = false;
          const currentIdx = room.players.indexOf(currentPlayerId);
          const nextIdx = (currentIdx + 1) % room.players.length;
          game.turn = nextIdx;
          game.phase = "playing";
        }
      }
    }
  }

  return game;
}

// ---- SCORE UPDATE ----
export function buildScoreUpdate(server: GameServer, playerId: number): ScoreUpdate | undefined {
  const player = server.players.get(playerId);
  if (!player) return undefined;
  return {
    playerId,
    seals: player.seals,
    brokenCount: player.brokenCount,
    correctCount: player.correctCount,
    wrongCount: player.wrongCount,
    score: player.score,
  };
}

// ---- RECONEXION: ESTADO COMPLETO ----
export function buildFullState(server: GameServer, roomId: string): any {
  const game = server.games.get(roomId);
  const room = server.rooms.get(roomId);
  if (!game || !room) return null;

  const players = room.players
    .map((id) => server.players.get(id))
    .filter((p): p is PlayerInfo => !!p);

  return {
    game: { ...game },
    players: players.map((p) => ({ ...p })),
    room: { ...room },
  };
}

// ---- READY STATUS ----
export function setPlayerReady(server: GameServer, roomId: string, playerId: number): boolean {
  const player = server.players.get(playerId);
  if (!player) return false;
  player.ready = true;
  return true;
}

export function allPlayersReady(server: GameServer, roomId: string): boolean {
  const room = server.rooms.get(roomId);
  if (!room) return false;
  return room.players.every((id) => server.players.get(id)?.ready);
}
