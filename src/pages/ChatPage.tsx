import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import PageHeader from "@/components/PageHeader";
import {
  Send, Hash, Lock, Plus, User, Users, MessageCircle,
  Radio, ArrowLeft, Globe
} from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const userId = user?.id || Number(localStorage.getItem("senda_user_id")) || 0;
  const userName = user?.name || localStorage.getItem("senda_user_name") || "Invitado";

  const chat = useChat(userId, userName);
  const [input, setInput] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    chat.sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return;
    chat.createRoom(newRoomName.trim(), newRoomPrivate).then((room) => {
      setShowNewRoom(false);
      setNewRoomName("");
      setNewRoomPrivate(false);
      if (room) chat.joinRoom(room.slug);
    }).catch(() => {
      alert("Error creando sala");
    });
  };

  const currentRoomName = chat.activeRoom === "global"
    ? "Chat Global"
    : chat.activeRoom === "dm"
    ? (chat.privateRecipient ? `Privado con ${chat.privateRecipient}` : "Mensajes Privados")
    : chat.publicRooms.find(r => r.slug === chat.activeRoom)?.name || chat.activeRoom;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col">
      <PageHeader title="Chat" />

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* SIDEBAR */}
        {sidebarOpen && (
          <div className="w-72 bg-[#1E293B] border-r border-white/10 flex flex-col">
            {/* Connection status */}
            <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10">
              <Radio className={`w-4 h-4 ${chat.connected ? "text-green-400" : "text-red-400"}`} />
              <span className={`text-xs ${chat.connected ? "text-green-400" : "text-red-400"}`}>
                {chat.connected ? "Conectado" : "Desconectado"}
              </span>
            </div>

            {/* User info */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#F59E0B] flex items-center justify-center text-sm font-bold text-[#0F172A]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium truncate">{userName}</span>
            </div>

            {/* Rooms section */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Salas</span>
                <button
                  onClick={() => setShowNewRoom(!showNewRoom)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Crear sala"
                >
                  <Plus className="w-4 h-4 text-[#F59E0B]" />
                </button>
              </div>

              {/* Global room */}
              <button
                onClick={() => chat.joinRoom("global")}
                className={`w-full px-4 py-2 flex items-center gap-2 text-sm transition-colors ${
                  chat.activeRoom === "global" ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "text-white/70 hover:bg-white/5"
                }`}
              >
                <Globe className="w-4 h-4" />
                Chat Global
              </button>

              {/* Public rooms */}
              {chat.publicRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => chat.joinRoom(room.slug)}
                  className={`w-full px-4 py-2 flex items-center gap-2 text-sm transition-colors ${
                    chat.activeRoom === room.slug ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <Hash className="w-4 h-4" />
                  <span className="truncate">{room.name}</span>
                </button>
              ))}

              {/* Join by code */}
              <button
                onClick={() => setShowJoinCode(!showJoinCode)}
                className="w-full px-4 py-2 flex items-center gap-2 text-sm text-white/50 hover:bg-white/5 transition-colors"
              >
                <Lock className="w-4 h-4" />
                Unirse por codigo
              </button>

              {/* Online users */}
              <div className="mt-4 px-3 py-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-white/50" />
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  En linea ({chat.onlineUsers.length})
                </span>
              </div>
              {chat.onlineUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => chat.openPrivateChat(u.id)}
                  className={`w-full px-4 py-2 flex items-center gap-2 text-sm transition-colors ${
                    chat.activeRoom === "dm" && chat.privateRecipient === u.id
                      ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                      : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span className="truncate">{u.name}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 ml-auto" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col bg-[#0F172A]">
          {/* Chat header */}
          <div className="h-14 border-b border-white/10 flex items-center px-4 gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              {sidebarOpen ? <ArrowLeft className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
            </button>
            {chat.activeRoom === "dm" ? (
              <Lock className="w-4 h-4 text-[#F59E0B]" />
            ) : (
              <Hash className="w-4 h-4 text-[#F59E0B]" />
            )}
            <span className="font-semibold text-sm">{currentRoomName}</span>
            {chat.publicRooms.find(r => r.slug === chat.activeRoom)?.isPrivate && (
              <span className="text-xs bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded">Privada</span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chat.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-white/30">
                <MessageCircle className="w-12 h-12 mb-3" />
                <p className="text-sm">No hay mensajes aun</p>
                <p className="text-xs mt-1">Se el primero en escribir</p>
              </div>
            )}
            {chat.messages.map((msg) => {
              const isMine = msg.senderId === userId;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] ${isMine ? "order-2" : "order-1"}`}>
                    {!isMine && (
                      <span className="text-xs text-white/50 ml-1">{msg.senderName}</span>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        isMine
                          ? "bg-[#F59E0B] text-[#0F172A] rounded-br-sm"
                          : "bg-[#1E293B] text-white rounded-bl-sm border border-white/10"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className={`text-[10px] text-white/30 mt-0.5 block ${isMine ? "text-right mr-1" : "ml-1"}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 bg-[#1E293B] rounded-2xl px-4 py-2 border border-white/10">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-2 rounded-xl transition-colors ${
                  input.trim() ? "bg-[#F59E0B] text-[#0F172A] hover:bg-[#F59E0B]/80" : "bg-white/5 text-white/20"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      {showNewRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewRoom(false)} />
          <div className="relative bg-[#1E293B] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-lg font-bold mb-4">Crear Sala</h3>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Nombre de la sala"
              className="w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#F59E0B] mb-3"
            />
            <label className="flex items-center gap-2 text-sm text-white/70 mb-4">
              <input
                type="checkbox"
                checked={newRoomPrivate}
                onChange={(e) => setNewRoomPrivate(e.target.checked)}
                className="rounded"
              />
              Sala privada (requiere codigo de invitacion)
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewRoom(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                className="flex-1 py-2 rounded-xl bg-[#F59E0B] text-[#0F172A] font-semibold hover:bg-[#F59E0B]/80 text-sm transition-colors disabled:opacity-50"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join by Code Modal */}
      {showJoinCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowJoinCode(false)} />
          <div className="relative bg-[#1E293B] rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-lg font-bold mb-4">Unirse por Codigo</h3>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Codigo de 6 caracteres"
              maxLength={6}
              className="w-full bg-[#0F172A] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#F59E0B] mb-4 tracking-widest uppercase text-center"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowJoinCode(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowJoinCode(false);
                  setJoinCode("");
                }}
                disabled={joinCode.length < 6}
                className="flex-1 py-2 rounded-xl bg-[#F59E0B] text-[#0F172A] font-semibold hover:bg-[#F59E0B]/80 text-sm transition-colors disabled:opacity-50"
              >
                Unirse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
