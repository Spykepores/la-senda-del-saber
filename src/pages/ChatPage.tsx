import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalChat } from "@/hooks/useDuel";
import { useOnlinePlayers } from "@/hooks/useDuel";
import { Link } from "react-router";
import {
  Send, ChevronLeft, MessageSquare, Users, Shield,
  Circle, Smile, Clock
} from "lucide-react";

// Simple emoji picker
const EMOJIS = ["😀", "😂", "😍", "🙏", "✝️", "📖", "❤️", "👍", "🔥", "✨", "🎉", "😊", "👏", "🌟", "💪", "😎", "🤗", "😇", "🙌", "🎵"];

export default function ChatPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { messages: globalMessages, send: sendGlobal } = useGlobalChat();
  const onlinePlayers = useOnlinePlayers(user?.id || 0, user?.name || "Jugador");

  const [chatInput, setChatInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white animate-pulse">
        Cargando...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white px-4">
        <div className="text-center max-w-sm">
          <MessageSquare className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Chat Global</h2>
          <p className="text-white/60 mb-6">Inicia sesion para chatear con otros jugadores.</p>
          <Link to="/login" className="inline-block px-6 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">
            Iniciar Sesion
          </Link>
        </div>
      </div>
    );
  }

  const myId = user.id;
  const myName = user.name || `Jugador #${myId}`;

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendGlobal(myId, myName, chatInput.trim());
    setChatInput("");
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addEmoji = (emoji: string) => {
    setChatInput((prev) => prev + emoji);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex">
      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-indigo-900/50 border-b border-white/10 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link to="/" className="flex items-center gap-1 text-white/60 hover:text-white transition text-sm">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="relative">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <Circle className="w-2.5 h-2.5 text-green-400 fill-green-400 absolute -bottom-0.5 -right-0.5" />
              </div>
              <span className="font-bold text-sm">Chat Global</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                <Circle className="w-1.5 h-1.5 fill-green-400" />
                {onlinePlayers.length + 1} en linea
              </span>
            </div>
            <span className="text-xs text-white/50 truncate max-w-[80px]">{myName}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {globalMessages.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">Bienvenido al Chat Global</p>
                <p className="text-sm text-white/40 mb-4">
                  Escribe un mensaje para comenzar a chatear con otros jugadores
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-white/30">
                  <Shield className="w-3 h-3 text-green-400" />
                  Filtro de palabras ofensivas activado
                </div>
              </div>
            )}

            {globalMessages.map((msg: any) => {
              const isMine = msg.senderId === myId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[75%] ${isMine ? "order-2" : "order-1"}`}>
                    {!isMine && (
                      <span className="text-[10px] text-amber-400/70 ml-2 font-medium">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm ${
                        isMine
                          ? "bg-amber-500 text-indigo-950 rounded-br-sm font-medium"
                          : "bg-white/10 text-white rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span
                      className={`text-[10px] text-white/30 mt-0.5 flex items-center gap-0.5 ${
                        isMine ? "justify-end mr-1" : "ml-1"
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-white/10 bg-indigo-900/30 px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="mb-2 p-2 bg-white/5 rounded-xl border border-white/10">
                <div className="flex flex-wrap gap-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => addEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-amber-400 transition"
              >
                <Smile className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={handleSend}
                disabled={!chatInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-indigo-950 hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-2">
              Chat con filtro de contenido • Se respetuoso con los demas jugadores
            </p>
          </div>
        </div>
      </div>

      {/* ONLINE PLAYERS SIDEBAR */}
      <div className="w-64 border-l border-white/10 bg-indigo-900/20 flex-col hidden lg:flex">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold">Jugadores en Linea</span>
          <span className="text-[10px] text-green-400 ml-auto flex items-center gap-1">
            <Circle className="w-1.5 h-1.5 fill-green-400" />
            {onlinePlayers.length + 1}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {/* Me */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-500/10">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-400 text-xs font-bold">
                {myName.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-indigo-950" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{myName}</p>
              <p className="text-[10px] text-green-400">Tu</p>
            </div>
          </div>

          {/* Other players */}
          {onlinePlayers.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-indigo-950" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{p.name}</p>
                <p className="text-[10px] text-green-400/70">En linea</p>
              </div>
            </div>
          ))}

          {onlinePlayers.length === 0 && (
            <div className="text-center py-6 text-white/30">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No hay otros jugadores</p>
              <p className="text-[10px]">Abre otra pestana para verlos</p>
            </div>
          )}
        </div>

        {/* Tip */}
        <div className="p-3 border-t border-white/10">
          <p className="text-[10px] text-white/30 text-center">
            Abre el juego en otra pestana del navegador para chatear entre cuentas
          </p>
        </div>
      </div>
    </div>
  );
}
