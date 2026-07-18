import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useDuel } from "@/hooks/useDuel";
import { SEALS_TO_BREAK, CATEGORIES } from "@/types/game";
import { CATEGORIES as GAME_CATEGORIES } from "@/types/game";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES } from "@/types/game";
import type { Question } from "@/types/game";
import {
  Zap, Hourglass, Flag, CheckCircle, XCircle, Crown, RotateCcw,
  Send, Lock, MessageSquare, Users, Radio, Copy, Check, Hash, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

function cName(id: string) { return CATEGORIES.find(c => c.id === id)?.name || id; }
function cColor(id: string) { return CATEGORIES.find(c => c.id === id)?.color || '#4F46E5'; }

const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
const ROT = 0;

export default function ChallengeGamePage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const challengeId = Number(id) || 0;
  const userId = user?.id || Number(localStorage.getItem("senda_user_id")) || 0;
  const game = useDuel(challengeId, userId);

  const [msgInput, setMsgInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExp, setShowExp] = useState(false);
  const [rouletteAngle, setRouletteAngle] = useState(ROT);
  const [catFlash, setCatFlash] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoSpinDone, setAutoSpinDone] = useState(false);
  const [diceResult, setDiceResult] = useState<{mine: number; opp: number; show: boolean}>({mine: 0, opp: 0, show: false});
  const chatRef = useRef<HTMLDivElement>(null);

  const question = game.question;

  const state = game.state;
  const p1 = state?.p1;
  const p2 = state?.p2;
  const myId = userId;

  // Sync dice results
  useEffect(() => {
    if (game.myDice && game.oppDice && game.diceRolled) {
      setDiceResult({mine: game.myDice, opp: game.oppDice, show: true});
    }
  }, [game.myDice, game.oppDice, game.diceRolled]);

  // Reset autoSpin when phase changes from dice to waiting
  useEffect(() => {
    if (game.phase !== "dice_roll") setAutoSpinDone(false);
  }, [game.phase]);

  // Auto-spin roulette when entering roulette phase
  useEffect(() => {
    if (game.phase === "roulette" && game.isMyTurn && !autoSpinDone && !spinning) {
      setAutoSpinDone(true);
      setSpinning(true);
      const target = GAME_CATEGORIES[Math.floor(Math.random() * GAME_CATEGORIES.length)];
      const idx = GAME_CATEGORIES.indexOf(target);
      const angle = 1440 + idx * (360 / GAME_CATEGORIES.length) + Math.random() * (360 / GAME_CATEGORIES.length - 10) + 5;
      setRouletteAngle(rouletteAngle + angle);
      setCatFlash(target.id);
      setTimeout(() => {
        setSpinning(false);
        game.onRouletteComplete(target.id);
      }, 2500);
    }
  }, [game.phase, game.isMyTurn, autoSpinDone, spinning]);

  if (authLoading || game.isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Cargando duelo...</p>
        </div>
      </div>
    );
  }

  const handleAnswer = (idx: number) => {
    if (game.phase !== "question" || !game.isMyTurn || !question || showExp) return;
    setSelected(idx);
    setShowExp(true);
    const correct = idx === question.correctAnswer;

    setTimeout(() => {
      game.submitAnswer(idx);
      setSelected(null);
      setShowExp(false);
    }, correct ? 1200 : 2000);
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <PageHeader title="Duelo de Sellos" />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ... rest of JSX remains the same ... */}
      </div>
    </div>
  );
}
