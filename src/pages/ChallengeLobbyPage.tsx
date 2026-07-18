import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router";
import {
  useCreateDuel, useJoinDuel, useAcceptDuel, useRejectDuel,
  useOnlinePlayers,
  usePublicChallenges, useMyChallenges,
  exportChallengeState, importChallengeState,
} from "@/hooks/useDuel";
import { useWebSocketChat } from "@/hooks/useWebSocketChat";
import {
  Swords, Zap, Users, Plus, ArrowRight, User, Target,
  Hourglass, Check, Send, MessageSquare, X, Upload, Download, Hash, Wifi, WifiOff
} from "lucide-react";
import { getChallengeByCode } from "@/lib/sync";
import PageHeader from "@/components/PageHeader";

export default function ChallengeLobbyPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<"public" | "players" | "mine">("public");
  const [roomName, setRoomName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [syncCode, setSyncCode] = useState("");
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [createError, setCreateError] = useState("");
  const [sentId, setSentId] = useState<number | null>(null);

  // Hooks
  const createMut = useCreateDuel();
  const joinMut = useJoinDuel();
  const acceptMut = useAcceptDuel();
  const rejectMut = useRejectDuel();

  // Online players
  const onlinePlayers = useOnlinePlayers(user?.id || 0, user?.name || "Jugador");

  // Public and my challenges (localStorage reactive)
  const publicChallenges = usePublicChallenges(user?.id || 0);
  const myChallenges = useMyChallenges(user?.id || 0);

  // Global chat via WebSocket
  const { messages: globalMessages, send: sendGlobal, connected: wsConnected } = useWebSocketChat("global");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [globalMessages]);

  if (authLoading) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white animate-pulse">Cargando...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white px-4">
        <div className="text-center max-w-sm">
          <Swords className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Desafios Online</h2>
          <p className="text-white/60 mb-6">Inicia sesion para retar a otros jugadores.</p>
          <Link to="/login" className="inline-block px-6 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Iniciar Sesion</Link>
        </div>
      </div>
    );
  }

  const myId = user.id;
  const myName = user.name || `Jugador #${myId}`;

  const activeDuels = myChallenges.filter((d: any) => d.status === "active");
  const pendingOutgoing = myChallenges.filter((d: any) => d.status === "pending" && d.challengerId === myId);
  const incomingChallenges = myChallenges.filter((d: any) => d.status === "pending" && d.opponentId === myId);
  const hasActive = activeDuels.length > 0;

  // ===================== ACTIONS =====================

  const handleRetar = async (opponent: { id: number; name: string }) => {
    try {
      await createMut.mutateAsync({ opponentId: opponent.id });
      setSentId(opponent.id);
      setTimeout(() => setSentId(null), 2000);
    } catch (e: any) {
      alert(e.message || "Error al crear desafio");
    }
  };

  const handleCrearSala = async () => {
    setCreateError("");
    if (!showCreateForm) { setShowCreateForm(true); return; }
    try {
      const name = roomName.trim() || `Sala de ${myName}`;
      const result = await createMut.mutateAsync({ name });
      setRoomName("");
      setShowCreateForm(false);
      window.location.hash = `#/challenge/${result.id}`;
    } catch (e: any) {
      setCreateError(e.message || "Error al crear sala");
    }
  };

  const handleAceptar = async (challengeId: number) => {
    try { await acceptMut.mutateAsync({ challengeId }); window.location.hash = `#/challenge/${challengeId}`; }
    catch (e: any) { alert(e.message || "Error"); }
  };

  const handleRechazar = async (challengeId: number) => {
    try { await rejectMut.mutateAsync(challengeId); }
    catch (e: any) { alert(e.message || "Error"); }
  };

  const handleUnirse = async (challengeId: number) => {
    try { await joinMut.mutateAsync({ challengeId }); window.location.hash = `#/challenge/${challengeId}`; }
    catch (e: any) { alert(e.message || "Error"); }
  };

  const handleJugar = (id: number) => { window.location.hash = `#/challenge/${id}`; };

  const handleJoinByCode = () => {
    setJoinError("");
    if (!syncCode || syncCode.length < 6) { setJoinError("Codigo invalido"); return; }
    const challenge = getChallengeByCode(syncCode);
    if (!challenge) { setJoinError("Codigo no encontrado"); return; }
    if (challenge.opponentId && challenge.opponentId !== 0) { setJoinError("Sala llena"); return; }
    handleUnirse(challenge.id);
    setSyncCode("");
    setShowJoinCode(false);
  };

  const handleExport = (challengeId: number) => {
    const data = exportChallengeState(challengeId);
    if (data) {
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `senda_sala_${challengeId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = importChallengeState(ev.target?.result as string);
        if (result.success && result.challengeId) window.location.hash = `#/challenge/${result.challengeId}`;
        else alert(result.error || "Error al importar");
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex">
      {/* MAIN */}
      <div className="flex-1 flex flex-col">
        <div className="max-w-3xl mx-auto w-full px-6 py-6">
          {/* Header */}
          <PageHeader title="Desafios Online" />

          {/* User Card */}
          <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-2xl p-4 border border-amber-500/20 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/30 flex items-center justify-center"><User className="w-5 h-5 text-amber-400" /></div>
                <div><p className="font-bold">{myName}</p><p className="text-xs text-white/50">ID: #{myId}</p></div>
              </div>
              <div className="text-right"><p className="text-xs text-white/50">Activos: {activeDuels.length}</p></div>
            </div>
          </div>

          {/* Online Players */}
          {onlinePlayers.length > 0 && (
            <div className="mb-4 bg-green-500/10 rounded-xl p-3 border border-green-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-bold text-green-400">Jugadores en linea ({onlinePlayers.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onlinePlayers.map((p: any) => (
                  <button key={p.id} onClick={() => handleRetar(p)} disabled={sentId === p.id || hasActive}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-xs hover:bg-green-500/30 transition disabled:opacity-50">
                    <div className="w-2 h-2 rounded-full bg-green-400" />{p.name}<Swords className="w-3 h-3 ml-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create Room */}
          <div className="mb-4">
            {showCreateForm ? (
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <label className="text-sm font-bold text-white/70 mb-2 block">Nombre de la sala</label>
                <div className="flex gap-2">
                  <input type="text" value={roomName} onChange={e => { setRoomName(e.target.value); setCreateError(""); }} placeholder={`Sala de ${myName}`}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 text-sm" />
                  <button onClick={handleCrearSala} disabled={hasActive || createMut.isPending}
                    className="px-6 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold text-sm hover:bg-amber-400 transition disabled:opacity-50 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> {createMut.isPending ? "..." : "Crear"}
                  </button>
                </div>
                {createError && <p className="text-red-400 text-xs mt-2">{createError}</p>}
                <button onClick={() => { setShowCreateForm(false); setCreateError(""); }} className="mt-2 text-xs text-white/40 hover:text-white/60">Cancelar</button>
              </div>
            ) : (
              <button onClick={handleCrearSala} disabled={hasActive}
                className="w-full py-3 bg-amber-500 text-indigo-950 rounded-2xl font-bold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" /> {hasActive ? "Ya tienes un desafio activo" : "Crear Sala Abierta"}
              </button>
            )}
          </div>

          {/* Join by Code */}
          <div className="mb-4">
            {showJoinCode ? (
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <label className="text-sm font-bold text-white/70 mb-2 block">Codigo de sala (6 digitos)</label>
                <div className="flex gap-2">
                  <input type="text" value={syncCode} onChange={e => setSyncCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 text-sm text-center tracking-widest font-mono text-lg" />
                  <button onClick={handleJoinByCode} disabled={joinMut.isPending}
                    className="px-6 py-3 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-400 transition disabled:opacity-50 flex items-center gap-1">
                    <ArrowRight className="w-4 h-4" /> {joinMut.isPending ? "..." : "Unirse"}
                  </button>
                </div>
                {joinError && <p className="text-red-400 text-xs mt-2">{joinError}</p>}
                <button onClick={() => { setShowJoinCode(false); setJoinError(""); }} className="mt-2 text-xs text-white/40 hover:text-white/60">Cancelar</button>
              </div>
            ) : (
              <button onClick={() => setShowJoinCode(true)}
                className="w-full py-3 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition flex items-center justify-center gap-2">
                <Hash className="w-5 h-5" /> Unirse por Codigo
              </button>
            )}
          </div>

          {/* Export/Import */}
          <div className="flex gap-2 mb-6">
            <button onClick={handleImport} className="flex-1 py-2 bg-white/5 text-white/70 rounded-xl text-sm hover:bg-white/10 transition flex items-center justify-center gap-1.5">
              <Upload className="w-4 h-4" /> Importar Sala
            </button>
            {activeDuels.length > 0 && (
              <button onClick={() => handleExport(activeDuels[0].id)} className="flex-1 py-2 bg-white/5 text-white/70 rounded-xl text-sm hover:bg-white/10 transition flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> Exportar Sala
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto">
            <button onClick={() => setTab("public")} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${tab === "public" ? "bg-amber-500 text-indigo-950" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
              <Target className="w-4 h-4 inline mr-1" />Publicos ({publicChallenges.length})
            </button>
            <button onClick={() => setTab("players")} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${tab === "players" ? "bg-amber-500 text-indigo-950" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
              <Users className="w-4 h-4 inline mr-1" />Jugadores ({onlinePlayers.length})
            </button>
            <button onClick={() => setTab("mine")} className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition ${tab === "mine" ? "bg-amber-500 text-indigo-950" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
              <Swords className="w-4 h-4 inline mr-1" />Mis Desafios ({myChallenges.length})
            </button>
          </div>

          {/* PUBLIC ROOMS */}
          {tab === "public" && (
            <div className="space-y-3">
              {publicChallenges.length === 0 ? (
                <div className="text-center py-12 text-white/40"><Target className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No hay salas abiertas</p><p className="text-xs mt-1">Crea una para que otros se unan</p></div>
              ) : publicChallenges.map((d: any) => (
                <div key={d.id} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm">{d.roomName || `Sala de ${d.challengerName}`}</p>
                      <p className="text-xs text-white/50">Por: {d.challengerName} | #{d.id} | Codigo: <span className="text-amber-400 font-mono">{d.syncCode}</span></p>
                    </div>
                    <button onClick={() => handleUnirse(d.id)} disabled={hasActive || joinMut.isPending}
                      className="px-4 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold text-sm hover:bg-amber-400 transition disabled:opacity-50 flex items-center gap-1">
                      <ArrowRight className="w-4 h-4" /> {joinMut.isPending ? "..." : "Unirse"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PLAYERS + INCOMING */}
          {tab === "players" && (
            <div className="space-y-3">
              {onlinePlayers.length === 0 ? (
                <div className="text-center py-12 text-white/40"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No hay jugadores en linea</p><p className="text-xs mt-1">Los jugadores apareceran cuando inicien sesion</p></div>
              ) : (
                <div className="grid gap-2">
                  {onlinePlayers.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10 hover:border-amber-500/30 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm relative">
                          {p.name.charAt(0).toUpperCase()}
                          {p.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-indigo-950" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-1">
                            {p.name}<span className="text-white/40 font-normal text-xs">#{p.id}</span>
                            {p.online && <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-full">En linea</span>}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleRetar(p)} disabled={sentId === p.id || hasActive}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition flex items-center gap-1.5 ${sentId === p.id ? "bg-green-500 text-white" : "bg-amber-500 text-indigo-950 hover:bg-amber-400"} disabled:opacity-50`}>
                        {sentId === p.id ? (<><Check className="w-4 h-4" /> Enviado</>) : (<><Swords className="w-4 h-4" /> Retar</>)}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {incomingChallenges.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-bold text-green-400 flex items-center gap-1"><Swords className="w-4 h-4" />Te retaron</h3>
                  {incomingChallenges.map((d: any) => (
                    <div key={d.id} className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                      <p className="font-bold text-sm mb-2">{d.challengerName} te retó</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleRechazar(d.id)} disabled={rejectMut.isPending}
                          className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold text-sm hover:bg-red-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1">
                          <X className="w-4 h-4" /> Rechazar
                        </button>
                        <button onClick={() => handleAceptar(d.id)} disabled={hasActive || acceptMut.isPending}
                          className="flex-1 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-400 transition disabled:opacity-50 flex items-center justify-center gap-1">
                          <Check className="w-4 h-4" /> Aceptar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MIS DESAFIOS */}
          {tab === "mine" && (
            <div className="space-y-4">
              {activeDuels.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-400 mb-2">Activos</h3>
                  {activeDuels.map((d: any) => (
                    <div key={d.id} className="mb-2">
                      <button onClick={() => handleJugar(d.id)} className="block w-full text-left bg-gradient-to-r from-amber-500/10 to-transparent rounded-xl p-4 border border-amber-500/20 hover:bg-amber-500/20 transition">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm">{d.challengerName} vs {d.opponentName || "???"}</p>
                            <p className="text-xs text-white/50">#{d.id} | Codigo: <span className="text-amber-400 font-mono">{d.syncCode}</span></p>
                          </div>
                          <div className="flex items-center gap-2 text-amber-400"><Zap className="w-5 h-5 animate-pulse" /><span className="text-xs font-bold">Jugar</span></div>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pendingOutgoing.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-yellow-400 mb-2">Enviados</h3>
                  {pendingOutgoing.map((d: any) => (
                    <div key={d.id} className="bg-white/5 rounded-xl p-4 border border-white/10 mb-2">
                      <p className="font-bold text-sm">Retaste a <span className="text-amber-400">{d.opponentName || `Jugador #${d.opponentId}`}</span></p>
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1 mt-1"><Hourglass className="w-3 h-3" /> Pendiente</span>
                    </div>
                  ))}
                </div>
              )}
              {incomingChallenges.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-400 mb-2">Recibidos</h3>
                  {incomingChallenges.map((d: any) => (
                    <div key={d.id} className="bg-green-500/10 rounded-xl p-4 border border-green-500/20 mb-2">
                      <p className="font-bold text-sm mb-2">{d.challengerName} te retó</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleRechazar(d.id)} disabled={rejectMut.isPending}
                          className="flex-1 py-2 bg-red-500/20 text-red-400 rounded-xl font-bold text-sm hover:bg-red-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1">
                          <X className="w-4 h-4" /> Rechazar
                        </button>
                        <button onClick={() => handleAceptar(d.id)} disabled={hasActive || acceptMut.isPending}
                          className="flex-1 py-2 bg-green-500 text-white rounded-xl font-bold text-sm hover:bg-green-400 transition disabled:opacity-50 flex items-center justify-center gap-1">
                          <Check className="w-4 h-4" /> Aceptar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeDuels.length === 0 && pendingOutgoing.length === 0 && incomingChallenges.length === 0 && (
                <div className="text-center py-12 text-white/40"><Swords className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No tienes desafios</p></div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GLOBAL CHAT SIDEBAR */}
      <div className="w-72 border-l border-white/10 bg-indigo-900/20 flex flex-col hidden lg:flex">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold">Chat Global</span>
          <span className="text-[10px] text-white/40 ml-auto flex items-center gap-1">
            {wsConnected ? <Wifi className="w-2.5 h-2.5 text-blue-400" /> : <WifiOff className="w-2.5 h-2.5 text-yellow-400" />}
            {globalMessages.length} msgs
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {globalMessages.length === 0 && (
            <div className="text-center py-8 text-white/30"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-xs">Chat global</p><p className="text-[10px]">Escribe un mensaje</p></div>
          )}
          {globalMessages.map((m: any) => (
            <div key={m.id} className={m.senderId === myId ? "text-right" : "text-left"}>
              <span className="text-[9px] text-white/30">{m.senderName}</span>
              <div className={`inline-block px-2.5 py-1.5 rounded-lg text-xs max-w-[200px] break-words ${m.senderId === myId ? "bg-amber-500 text-indigo-950 rounded-br-none font-medium" : "bg-white/10 text-white rounded-bl-none"}`}>{m.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 border-t border-white/10">
          <div className="flex gap-2">
            <input type="text" placeholder="Escribe..." value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && chatInput.trim() && (sendGlobal(myId, myName, chatInput), setChatInput(""))}
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-500/50" />
            <button onClick={() => chatInput.trim() && (sendGlobal(myId, myName, chatInput), setChatInput(""))} disabled={!chatInput.trim()}
              className="p-2 rounded-xl bg-amber-500 text-indigo-950 hover:bg-amber-400 transition disabled:opacity-50"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
