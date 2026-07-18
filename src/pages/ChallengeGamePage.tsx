import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useChallengeSealsGame, SEALS_TO_BREAK } from "@/hooks/useChallengeSealsGame";
import { useChallenge, useChallengeChat, useForfeitDuel } from "@/hooks/useDuel";
import { CATEGORIES } from "@/types/game";
import PageHeader from "@/components/PageHeader";
import {
  Zap, Hourglass, Flag, CheckCircle, XCircle, Crown, RotateCcw,
  Send, Lock, MessageSquare, Users, Radio, Copy, Check, Hash, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6
} from "lucide-react";

function cName(id: string) { return CATEGORIES.find(c => c.id === id)?.name || id; }
function cColor(id: string) { return CATEGORIES.find(c => c.id === id)?.color || '#4F46E5'; }

// Dice icon based on value
function DiceIcon({ value, className }: { value: number; className?: string }) {
  switch (value) {
    case 1: return <Dice1 className={className} />;
    case 2: return <Dice2 className={className} />;
    case 3: return <Dice3 className={className} />;
    case 4: return <Dice4 className={className} />;
    case 5: return <Dice5 className={className} />;
    case 6: return <Dice6 className={className} />;
    default: return <div className={className}>?</div>;
  }
}

export default function ChallengeGamePage() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);
  const { user } = useAuth();

  const { data: challenge, isLoading: challengeLoading } = useChallenge(cid);

  const uid = user?.id ?? 0;
  const isChallenger = challenge ? challenge.challengerId === uid : false;
  const oppName = challenge
    ? (isChallenger
        ? (challenge.opponentName || (challenge.opponentId ? `Jugador #${challenge.opponentId}` : "Esperando rival..."))
        : challenge.challengerName)
    : "Rival";

  const isJoining = challenge ? (challenge.challengerId !== uid && challenge.opponentId === uid) : false;
  const cInfo = challenge
    ? { cId: challenge.challengerId, cName: challenge.challengerName, oId: challenge.opponentId || 0, oName: challenge.opponentName || "Rival", isJoining }
    : undefined;

  const game = useChallengeSealsGame(cid, uid, cInfo);

  const [rollingDice, setRollingDice] = useState(false);
  const [diceAnimValue, setDiceAnimValue] = useState(1);

  const { messages, send } = useChallengeChat(cid);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [forfeitConfirm, setForfeitConfirm] = useState(false);

  const [spinAngle, setSpinAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);

  // La pregunta llega del servidor via el hook (validacion server-side)
  const question = game.question;
  const [selected, setSelected] = useState<number | null>(null);
  const [showExp, setShowExp] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const timerPct = game.isMyTurn && game.phase === "question" ? game.timerPct : 100;
  const timerColor = timerPct > 50 ? "#10B981" : timerPct > 25 ? "#F59E0B" : "#EF4444";

  const myB = game.myState ? Object.values(game.myState.seals).filter(v => v >= SEALS_TO_BREAK).length : 0;
  const oppB = game.oppState ? Object.values(game.oppState.seals).filter(v => v >= SEALS_TO_BREAK).length : 0;

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

  const startTurn = () => {
    game.startTurn();
    const mySeals = game.myState?.seals || {};
    const avail = CATEGORIES.filter(c => (mySeals[c.id] || 0) < SEALS_TO_BREAK);
    const pool = avail.length > 0 ? avail : CATEGORIES;
    const target = pool[Math.floor(Math.random() * pool.length)];

    let angle = 0;
    const extraSpins = 3 + Math.floor(Math.random() * 3);
    const targetIdx = CATEGORIES.findIndex(c => c.id === target.id);
    const anglePer = 360 / CATEGORIES.length;
    const finalAngle = extraSpins * 360 + (360 - targetIdx * anglePer);

    setSpinning(true);

    const start = Date.now();
    const dur = 2500;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      angle = eased * finalAngle;
      setSpinAngle(angle);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setSpinning(false);
        game.onRouletteComplete(target.id);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  };

  const handleRollDice = () => {
    if (rollingDice || game.myDice) return;
    setRollingDice(true);
    let count = 0;
    const animInterval = setInterval(() => {
      setDiceAnimValue(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 10) {
        clearInterval(animInterval);
        const finalValue = game.rollDice();
        setDiceAnimValue(finalValue);
        setRollingDice(false);
      }
    }, 100);
  };

  const forfeitMut = useForfeitDuel();
  const handleForfeit = () => {
    game.forfeit();
    forfeitMut.mutate(cid);
  };

  const copyCode = () => {
    if (challenge?.syncCode) {
      navigator.clipboard.writeText(challenge.syncCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const waitingForOpponent = challenge && challenge.status !== "active" && challenge.status !== "completed";

  if (!user) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white"><div className="animate-pulse">Cargando sesion...</div></div>;
  if (challengeLoading) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white"><div className="animate-pulse">Cargando desafio...</div></div>;
  if (!challenge) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white px-4"><div className="text-center max-w-sm"><XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" /><h2 className="text-2xl font-bold mb-2">Desafio no encontrado</h2><Link to="/challenges" className="inline-block px-6 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Volver</Link></div></div>;

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col">
      <PageHeader
        title={`Desafio #${cid}`}
        rightContent={
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${game.isFinished ? "bg-amber-500/20 text-amber-400" : waitingForOpponent ? "bg-blue-500/20 text-blue-400" : game.isMyTurn ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
              {game.isFinished ? "Finalizado" : waitingForOpponent ? "Esperando" : game.isMyTurn ? "Tu turno" : "Turno rival"}
            </span>
            <span className="flex items-center gap-1 text-green-400 text-xs">
              <Radio className="w-3 h-3 animate-pulse" />
              <span className="hidden sm:inline">Sync</span>
            </span>
          </div>
        }
      />

      {waitingForOpponent && challenge.syncCode && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-3">
            <Hash className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-300">Codigo de sala:</span>
            <span className="text-lg font-bold text-green-400 tracking-widest font-mono">{challenge.syncCode}</span>
            <button onClick={copyCode} className="ml-2 p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-green-400" />}
            </button>
            <span className="text-xs text-green-300/60 ml-2">{copied ? "Copiado!" : "Comparte este codigo"}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-5xl mx-auto w-full overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">

          {game.phase === "dice_roll" && !game.isFinished && !waitingForOpponent && (
            <div className="text-center py-10">
              <h2 className="text-2xl font-bold mb-2">Tira los dados!</h2>
              <p className="text-white/50 text-sm mb-6">El jugador con el numero mas alto comienza</p>
              <div className="flex justify-center items-center gap-8 mb-8">
                <div className="text-center">
                  <p className="text-xs text-white/50 mb-2">Tu</p>
                  <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                    {game.myDice ? (
                      <DiceIcon value={game.myDice} className="w-16 h-16 text-amber-400" />
                    ) : (
                      <DiceIcon value={diceAnimValue} className={`w-16 h-16 ${rollingDice ? "text-amber-400 animate-bounce" : "text-white/30"}`} />
                    )}
                  </div>
                  {game.myDice && <p className="text-xl font-bold text-amber-400 mt-2">{game.myDice}</p>}
                </div>
                <div className="text-2xl font-bold text-white/30">VS</div>
                <div className="text-center">
                  <p className="text-xs text-white/50 mb-2">{oppName}</p>
                  <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                    {game.oppDice ? (
                      <DiceIcon value={game.oppDice} className="w-16 h-16 text-red-400" />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center text-white/30 text-4xl">?</div>
                    )}
                  </div>
                  {game.oppDice && <p className="text-xl font-bold text-red-400 mt-2">{game.oppDice}</p>}
                </div>
              </div>
              {game.diceRolled && game.diceWinnerId !== undefined && (
                <div className="mb-6">
                  {game.diceWinnerId === uid ? (
                    <div className="bg-green-500/20 rounded-xl p-4 border border-green-500/30">
                      <p className="text-green-400 font-bold text-lg">Ganaste el sorteo!</p>
                      <p className="text-white/50 text-sm">Tu turno para comenzar</p>
                    </div>
                  ) : (
                    <div className="bg-red-500/20 rounded-xl p-4 border border-red-500/30">
                      <p className="text-red-400 font-bold text-lg">{oppName} gano el sorteo</p>
                      <p className="text-white/50 text-sm">Espera tu turno...</p>
                    </div>
                  )}
                </div>
              )}
              {game.myDice && game.oppDice && game.myDice === game.oppDice && (
                <div className="mb-6 bg-yellow-500/20 rounded-xl p-4 border border-yellow-500/30">
                  <p className="text-yellow-400 font-bold text-lg">Empate!</p>
                  <p className="text-white/50 text-sm">Tiran de nuevo...</p>
                </div>
              )}
              {!game.myDice && (
                <button onClick={handleRollDice} disabled={rollingDice}
                  className="px-8 py-4 bg-amber-500 text-indigo-950 rounded-2xl font-bold text-lg hover:bg-amber-400 transition disabled:opacity-50"
                  style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                  {rollingDice ? "Tirando..." : "Tirar Dado"}
                </button>
              )}
              {game.myDice && !game.oppDice && (
                <div className="flex items-center justify-center gap-2 text-white/50">
                  <Hourglass className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Esperando que {oppName} tire...</span>
                </div>
              )}
            </div>
          )}

          {waitingForOpponent && !game.isFinished && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Esperando rival</h2>
              {challenge.syncCode && (
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 max-w-xs mx-auto mb-4">
                  <p className="text-xs text-white/50 mb-2">COMPARTE ESTE CODIGO</p>
                  <p className="text-4xl font-bold text-amber-400 tracking-[0.3em] font-mono mb-2">{challenge.syncCode}</p>
                  <button onClick={copyCode} className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition text-sm flex items-center justify-center gap-2">
                    {copied ? <><Check className="w-4 h-4" /> Copiado al portapapeles</> : <><Copy className="w-4 h-4" /> Copiar codigo</>}
                  </button>
                </div>
              )}
              <p className="text-white/40 text-xs max-w-xs mx-auto mb-4">
                El otro jugador debe ir a "Desafios Online" y presionar "Unirse por Codigo"
              </p>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 max-w-sm mx-auto">
                <p className="text-xs text-white/50 mb-1">Creado por</p>
                <p className="font-bold text-sm">{challenge.challengerName}</p>
                <p className="text-xs text-white/40 mt-1">Estado: {challenge.status === "pending" ? "Esperando que acepten" : "Activo"}</p>
                {challenge.roomName && <p className="text-xs text-amber-400 mt-1">Sala: {challenge.roomName}</p>}
              </div>
            </div>
          )}

          {game.isFinished && (
            <div className="text-center py-8 space-y-4">
              {game.state?.winnerId === uid ? (<><Crown className="w-16 h-16 text-amber-400 mx-auto mb-3" /><h2 className="text-3xl font-bold text-amber-400">Ganaste!</h2><p className="text-white/60">Rompiste todos los sellos!</p></>)
               : game.state?.forfeitBy === uid ? (<><Flag className="w-16 h-16 text-white/40 mx-auto mb-3" /><h2 className="text-2xl font-bold text-white/60">Te retiraste</h2></>)
               : (<><XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" /><h2 className="text-2xl font-bold text-white">{oppName} gano</h2></>)}
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 max-w-md mx-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-xs text-white/50">Tu ({myB} sellos)</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-2">
                      {CATEGORIES.map(c => { const v = game.myState?.seals[c.id] || 0; const b = v >= SEALS_TO_BREAK; return <div key={c.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${b ? "bg-amber-500 text-indigo-950" : v >= 1 ? "bg-amber-500/30 text-amber-400 border border-amber-500/30" : "bg-white/10 text-white/20"}`}>{b ? "\u2713" : v}</div>; })}</div>
                    <p className="text-xs text-white/40 mt-1">{game.myState?.correctCount || 0}\u2713 {game.myState?.wrongCount || 0}\u2717</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-white/50">{oppName} ({oppB} sellos)</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-2">
                      {CATEGORIES.map(c => { const v = game.oppState?.seals[c.id] || 0; const b = v >= SEALS_TO_BREAK; return <div key={c.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${b ? "bg-red-500 text-white" : v >= 1 ? "bg-red-500/30 text-red-400 border border-red-500/30" : "bg-white/10 text-white/20"}`}>{b ? "\u2713" : v}</div>; })}</div>
                    <p className="text-xs text-white/40 mt-1">{game.oppState?.correctCount || 0}\u2713 {game.oppState?.wrongCount || 0}\u2717</p>
                  </div>
                </div>
              </div>
              <Link to="/challenges" className="inline-block px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition text-sm font-medium">Volver a Desafios</Link>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && !game.isMyTurn && game.phase !== "dice_roll" && (
            <div className="text-center py-16">
              <Hourglass className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Turno de {oppName}</h2>
              <p className="text-white/50 text-sm">Esperando que responda...</p>
              <p className="text-white/40 text-xs mt-2">Cuando falle, sera tu turno</p>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && game.isMyTurn && game.phase === "waiting" && (
            <div className="text-center py-16">
              <Zap className="w-16 h-16 text-amber-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-4">Es tu turno!</h2>
              <button onClick={startTurn}
                className="px-8 py-4 bg-amber-500 text-indigo-950 rounded-2xl font-bold text-lg hover:bg-amber-400 transition"
                style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                <RotateCcw className="w-5 h-5 inline mr-2" />Girar Ruleta
              </button>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && game.phase === "roulette" && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-white/50 text-sm mb-4">{spinning ? "Girando..." : "Categoria seleccionada"}</p>
              <div className="relative w-64 h-64">
                <div className="w-full h-full rounded-full border-4 border-white/20 relative" style={{ transform: `rotate(${spinAngle}deg)`, background: 'conic-gradient(from 0deg, #92400E 0deg 51deg, #14B8A6 51deg 103deg, #3B82F6 103deg 154deg, #7C3AED 154deg 206deg, #6B7280 206deg 257deg, #F59E0B 257deg 309deg, #8B5CF6 309deg 360deg)' }} />
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-amber-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-indigo-900 border-2 border-amber-400 flex items-center justify-center text-amber-400 font-bold text-xl">?</div>
              </div>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && game.phase === "question" && !question && (
            <div className="text-center py-16">
              <Hourglass className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-pulse" />
              <p className="text-white/50 text-sm">Cargando pregunta...</p>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && game.phase === "question" && question && (
            <div className="max-w-lg mx-auto">
              <div className="flex justify-center mb-4">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={timerColor} strokeWidth="3" strokeDasharray={`${timerPct}, 100`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold" style={{ color: timerColor }}>{Math.ceil(game.timeLeft / 1000)}</span>
                  </div>
                </div>
              </div>
              <div className="text-center mb-3"><span className="text-xs text-white/50">Tu turno | Sellos: {myB}/7</span></div>
              <div className="rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: `${cColor(question.category)}33`, borderBottom: `2px solid ${cColor(question.category)}66` }}>
                  <span className="text-white font-semibold text-sm">{cName(question.category)}</span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: question.difficulty === 'easy' ? '#10B98133' : question.difficulty === 'medium' ? '#F59E0B33' : '#EF444433', color: question.difficulty === 'easy' ? '#34D399' : question.difficulty === 'medium' ? '#FBBF24' : '#F87171' }}>
                    {question.difficulty === 'easy' ? 'Facil' : question.difficulty === 'medium' ? 'Medio' : 'Dificil'}
                  </span>
                </div>
                <div className="px-5 py-4"><h3 className="text-white text-lg font-semibold leading-snug">{question.question}</h3></div>
                <div className="px-5 flex flex-col gap-2 mb-4">
                  {question.options.map((opt, idx) => {
                    const sel = selected === idx;
                    const cor = idx === question.correctAnswer;
                    let bg = 'rgba(255,255,255,0.08)', border = 'rgba(255,255,255,0.15)';
                    if (showExp) { if (cor) { bg = '#10B981'; border = '#10B981'; } else if (sel) { bg = '#EF4444'; border = '#EF4444'; } else { bg = 'rgba(255,255,255,0.05)'; border = 'rgba(255,255,255,0.1)'; }}
                    else if (sel) { bg = '#4F46E5'; border = '#4F46E5'; }
                    return (
                      <button key={idx} onClick={() => handleAnswer(idx)} disabled={showExp}
                        className="w-full py-3 px-4 rounded-xl border-2 text-left font-medium transition-all text-white hover:scale-[1.02]" style={{ backgroundColor: bg, borderColor: border }}>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                            {showExp && cor ? '\u2713' : showExp && sel ? '\u2717' : String.fromCharCode(65 + idx)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {showExp && (
                  <div className="px-5 pb-5">
                    <div className="rounded-xl p-4" style={{ backgroundColor: selected === question.correctAnswer ? '#10B98122' : '#EF444422', border: `1px solid ${selected === question.correctAnswer ? '#10B98166' : '#EF444466'}` }}>
                      <p className={`font-semibold text-sm mb-1 ${selected === question.correctAnswer ? 'text-emerald-400' : 'text-red-400'}`}>
                        {selected === question.correctAnswer ? '\u00a1Correcto! Continuas...' : '\u00a1Incorrecto! Cediste el turno...'}
                      </p>
                      <p className="text-white/70 text-sm">{question.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!waitingForOpponent && !game.isFinished && game.phase === "result" && (
            <div className="text-center py-16">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-400 mb-2">\u00a1Correcto!</h2>
              <p className="text-white/50 text-sm">Siguiente pregunta...</p>
            </div>
          )}
        </div>

        <div className="w-64 border-l border-white/10 flex flex-col bg-indigo-900/30 hidden md:flex">
          {challenge.syncCode && (
            <div className="p-3 border-b border-white/10 bg-green-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-green-400/60">CODIGO DE SALA</p>
                  <p className="text-sm font-bold text-green-400 tracking-widest font-mono">{challenge.syncCode}</p>
                </div>
                <button onClick={copyCode} className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition">
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-green-400" />}
                </button>
              </div>
            </div>
          )}

          <div className="p-3 border-b border-white/10">
            <p className="text-xs font-bold text-green-400 mb-2">Tu progreso ({myB}/7)</p>
            <div className="grid grid-cols-7 gap-1">
              {CATEGORIES.map(c => { const v = game.myState?.seals[c.id] || 0; const b = v >= SEALS_TO_BREAK; return <div key={c.id} title={c.name} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${b ? "bg-amber-500 text-indigo-950" : v >= 1 ? "bg-amber-500/30 text-amber-400 border border-amber-500/30" : "bg-white/10 text-white/20"}`}>{b ? "\u2713" : v}</div>; })}</div>
            <p className="text-[10px] text-white/30 mt-1">{game.myState?.correctCount || 0}\u2713 {game.myState?.wrongCount || 0}\u2717</p>
          </div>
          <div className="p-3 border-b border-white/10">
            <p className="text-xs font-bold text-red-400 mb-2">{oppName} ({oppB}/7)</p>
            <div className="grid grid-cols-7 gap-1">
              {CATEGORIES.map(c => { const v = game.oppState?.seals[c.id] || 0; const b = v >= SEALS_TO_BREAK; return <div key={c.id} title={c.name} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${b ? "bg-red-500 text-white" : v >= 1 ? "bg-red-500/30 text-red-400 border border-red-500/30" : "bg-white/10 text-white/20"}`}>{b ? "\u2713" : v}</div>; })}</div>
            <p className="text-[10px] text-white/30 mt-1">{game.oppState?.correctCount || 0}\u2713 {game.oppState?.wrongCount || 0}\u2717</p>
          </div>
          <div className="p-3 border-b border-white/10">
            <div className={`text-xs font-bold ${waitingForOpponent ? "text-blue-400" : game.isMyTurn ? "text-green-400" : "text-yellow-400"}`}>
              {waitingForOpponent ? "Esperando rival" : game.isMyTurn ? "Tu turno" : `Turno de ${oppName}`}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 flex items-center gap-1"><MessageSquare className="w-3 h-3 text-amber-400" />Chat</span>
              <span className="text-[10px] text-white/30 flex items-center gap-1"><Radio className="w-2 h-2 text-green-400" />Sync</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
              {messages.length === 0 && <div className="text-center py-4"><Lock className="w-5 h-5 text-white/10 mx-auto mb-1" /><p className="text-white/20 text-[10px]">Chat privado</p></div>}
              {messages.map((m: any) => (
                <div key={m.id || m.timestamp} className={m.senderId === uid ? "text-right" : "text-left"}>
                  <span className="text-[9px] text-white/30">{m.senderName}</span>
                  <div className={`inline-block px-2 py-1 rounded-lg text-xs max-w-[180px] break-words ${m.senderId === uid ? "bg-amber-500 text-indigo-950 rounded-br-none font-medium" : "bg-white/10 text-white rounded-bl-none"}`}>{m.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-white/10">
              <div className="flex gap-1">
                <input type="text" placeholder="Escribe..." value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && chatInput.trim() && (send(uid, user?.name || "Tu", chatInput), setChatInput(""))}
                  className="flex-1 p-1.5 rounded-md bg-white/10 border border-white/20 text-white text-xs placeholder-white/40 focus:outline-none focus:border-amber-500/50" />
                <button onClick={() => chatInput.trim() && (send(uid, user?.name || "Tu", chatInput), setChatInput(""))} disabled={!chatInput.trim()} className="p-1.5 rounded-md bg-amber-500 text-indigo-950 hover:bg-amber-400 transition disabled:opacity-50"><Send className="w-3 h-3" /></button>
              </div>
            </div>
          </div>

          {!waitingForOpponent && !game.isFinished && (
            <div className="p-3 border-t border-white/10">
              <button onClick={() => setForfeitConfirm(true)} className="w-full flex items-center justify-center gap-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition text-xs font-medium"><Flag className="w-3 h-3" /> Rendirse</button>
            </div>
          )}
        </div>
      </div>

      {forfeitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setForfeitConfirm(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-indigo-900 rounded-2xl p-6 max-w-xs w-full border border-white/10 text-center" onClick={e => e.stopPropagation()}>
            <Flag className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">Rendirse?</h3>
            <p className="text-white/50 text-sm mb-4">Si te retiras, {oppName} ganara.</p>
            <div className="flex gap-2">
              <button onClick={() => setForfeitConfirm(false)} className="flex-1 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/20 transition">Cancelar</button>
              <button onClick={() => { handleForfeit(); setForfeitConfirm(false); }} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-400 transition">Retirarse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
