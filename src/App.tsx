import { Routes, Route } from "react-router";
import { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameState } from '@/hooks/useGameState';
import { useAuth } from '@/hooks/useAuth';
import { MainMenu } from '@/components/MainMenu';
import { ModeSelect } from '@/components/ModeSelect';
import { PlayerSetup } from '@/components/PlayerSetup';
import { SealHub } from '@/components/SealHub';
import { RouletteWheel } from '@/components/RouletteWheel';
import { QuestionPanel } from '@/components/QuestionPanel';
import { RushMode } from '@/components/RushMode';
import { DuelMode } from '@/components/DuelMode';
import { VictoryScreen } from '@/components/VictoryScreen';
import { LeaderboardScreen } from '@/components/Leaderboard';
import { SettingsScreen } from '@/components/SettingsScreen';
import { TutorialScreen } from '@/components/TutorialScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { GalleryScreen } from '@/components/GalleryScreen';
import { AdminRoute } from '@/components/AdminRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import NotFound from '@/pages/NotFound';
import AdminPage from '@/pages/AdminPage';
import ChallengeLobbyPage from '@/pages/ChallengeLobbyPage';
import ChallengeGamePage from '@/pages/ChallengeGamePage';
import ChatPage from '@/pages/ChatPage';
import './App.css';

function GameApp() {
  const { user, logout } = useAuth();
  const game = useGameState();

  const handleSelectMode = useCallback((mode: 'solo' | 'rush' | 'online') => {
    game.setMode(mode);
    if (mode === 'rush') {
      game.setupPlayers(['Jugador 1']);
      game.startRushMode();
    } else if (mode === 'online') {
      // Online mode navigates to challenges (handled in ModeSelect)
      return;
    } else {
      game.goToScreen('playerSetup');
    }
  }, [game]);

  const handleStartGame = useCallback((names: string[]) => {
    game.setupPlayers(names);
    game.startGameTimer();
    game.goToScreen('sealHub');
  }, [game]);

  const handleSpin = useCallback(() => {
    game.spinRoulette();
  }, [game]);

  const handleAnswer = useCallback((index: number) => {
    game.answerQuestion(index);
  }, [game]);

  const handleContinue = useCallback(() => {
    game.continueAfterAnswer();
  }, [game]);

  const handleVictoryHome = useCallback(() => {
    game.resetGame();
    game.goToScreen('menu');
  }, [game]);

  const handleRematch = useCallback(() => {
    const names = game.players.map(p => p.name);
    game.resetGame();
    game.setupPlayers(names);
    game.startGameTimer();
    game.goToScreen('sealHub');
  }, [game]);

  return (
    <div className="min-h-screen bg-indigo-950 overflow-hidden">
      <AnimatePresence mode="wait">
        {/* MAIN MENU */}
        {game.screen === 'menu' && (
          <motion.div key="menu" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <MainMenu
              onPlay={() => game.goToScreen('modeSelect')}
              onLeaderboard={() => game.goToScreen('leaderboard')}
              onSettings={() => game.goToScreen('settings')}
              onTutorial={() => game.goToScreen('tutorial')}
              onLogout={logout}
              user={user}
            />
          </motion.div>
        )}

        {/* MODE SELECT */}
        {game.screen === 'modeSelect' && (
          <motion.div key="modeSelect" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModeSelect onSelectMode={handleSelectMode} onBack={() => game.goToScreen('menu')} />
          </motion.div>
        )}

        {/* PLAYER SETUP */}
        {game.screen === 'playerSetup' && (
          <motion.div key="playerSetup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PlayerSetup onStart={handleStartGame} onBack={() => game.goToScreen('modeSelect')} />
          </motion.div>
        )}

        {/* SEAL HUB */}
        {game.screen === 'sealHub' && game.currentPlayer && (
          <motion.div key="sealHub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SealHub
              player={game.currentPlayer}
              elapsedTime={game.elapsedTime}
              onSpin={handleSpin}
              onProfile={() => game.goToScreen('profile')}
              onGallery={() => game.goToScreen('gallery')}
              onLeaderboard={() => game.goToScreen('leaderboard')}
              onSettings={() => game.goToScreen('settings')}
            />
          </motion.div>
        )}

        {/* ROULETTE */}
        {game.isSpinning && (
          <RouletteWheel isSpinning={game.isSpinning} targetCategory={game.rouletteCategory} />
        )}

        {/* QUESTION */}
        {game.screen === 'question' && game.currentQuestion && game.currentPlayer && (
          <motion.div key="question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <QuestionPanel
              question={game.currentQuestion}
              currentPlayer={game.currentPlayer}
              showExplanation={game.showExplanation}
              answeredCorrectly={game.answeredCorrectly}
              selectedAnswer={game.selectedAnswer}
              availableOptions={game.availableOptions}
              onAnswer={handleAnswer}
              onContinue={handleContinue}
            />
          </motion.div>
        )}

        {/* DUEL MODE */}
        {game.screen === 'duelQuestion' && game.currentQuestion && game.players.length > 0 && (
          <motion.div key="duel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DuelMode
              question={game.currentQuestion}
              players={game.players}
              onAnswer={handleAnswer}
              onContinue={handleContinue}
            />
          </motion.div>
        )}

        {/* RUSH MODE */}
        {game.screen === 'rushMode' && (
          <motion.div key="rush" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RushMode
              question={game.currentQuestion}
              score={game.rushScore}
              timeLeft={game.rushTimeLeft}
              questionsAnswered={0}
              onAnswer={handleAnswer}
              onEnd={() => game.goToScreen('victory')}
            />
          </motion.div>
        )}

        {/* VICTORY */}
        {game.screen === 'victory' && game.winner && (
          <motion.div key="victory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <VictoryScreen
              winner={game.winner}
              players={game.players}
              elapsedTime={game.elapsedTime}
              onHome={handleVictoryHome}
              onRematch={handleRematch}
            />
          </motion.div>
        )}

        {/* PROFILE */}
        {game.screen === 'profile' && game.currentPlayer && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ProfileScreen player={game.currentPlayer} onBack={() => game.goToScreen('sealHub')} />
          </motion.div>
        )}

        {/* GALLERY */}
        {game.screen === 'gallery' && game.currentPlayer && (
          <motion.div key="gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GalleryScreen unlockedIds={game.currentPlayer.galleryUnlocked} onBack={() => game.goToScreen('sealHub')} />
          </motion.div>
        )}

        {/* LEADERBOARD */}
        {game.screen === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LeaderboardScreen entries={game.leaderboard} onBack={() => game.goToScreen('sealHub')} />
          </motion.div>
        )}

        {/* SETTINGS */}
        {game.screen === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SettingsScreen
              soundEnabled={game.soundEnabled}
              musicEnabled={false}
              difficulty={game.difficulty}
              onToggleSound={game.toggleSound}
              onToggleMusic={() => {}}
              onSetDifficulty={game.setDifficulty}
              onResetLeaderboard={() => game.setLeaderboard([])}
              onBack={() => game.goToScreen(game.players.length > 0 ? 'sealHub' : 'menu')}
            />
          </motion.div>
        )}

        {/* TUTORIAL */}
        {game.screen === 'tutorial' && (
          <motion.div key="tutorial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TutorialScreen onBack={() => game.goToScreen('menu')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rank Up Notification */}
      <AnimatePresence>
        {game.rankUpNotif && (
          <motion.div key="rankup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-4"
            onClick={() => game.setRankUpNotif(null)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.5, y: -50 }}
              className="relative text-center p-8 rounded-3xl max-w-sm w-full"
              style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: `2px solid ${game.rankUpNotif.newRank.color}`, boxShadow: `0 0 60px ${game.rankUpNotif.newRank.color}44` }}
              onClick={(e) => e.stopPropagation()}>
              <motion.div animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }} className="text-6xl mb-4">
                {game.rankUpNotif.newRank.symbol}
              </motion.div>
              <motion.h2 className="text-3xl font-bold mb-2"
                style={{ color: game.rankUpNotif.newRank.color, textShadow: `0 0 20px ${game.rankUpNotif.newRank.color}66` }}>
                !Subiste de Rango!
              </motion.h2>
              <div className="flex items-center justify-center gap-3 my-4">
                <span className="text-white/50 text-lg line-through">{game.rankUpNotif.oldRank.name}</span>
                <motion.span animate={{ x: [0, 5, 0] }} className="text-2xl text-white/50">&rarr;</motion.span>
                <span className="text-xl font-bold" style={{ color: game.rankUpNotif.newRank.color }}>{game.rankUpNotif.newRank.name}</span>
              </div>
              <p className="text-white/70 text-lg font-semibold mb-1">{game.rankUpNotif.newRank.symbol} {game.rankUpNotif.newRank.name}</p>
              <p className="text-white/50 text-sm mb-6">{game.rankUpNotif.newRank.description}</p>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => game.setRankUpNotif(null)}
                className="py-3 px-8 rounded-2xl font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${game.rankUpNotif.newRank.color}, ${game.rankUpNotif.newRank.color}88)` }}>
                !Continuar!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GameApp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/challenges" element={<ChallengeLobbyPage />} />
      <Route path="/challenge/:id" element={<ChallengeGamePage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
