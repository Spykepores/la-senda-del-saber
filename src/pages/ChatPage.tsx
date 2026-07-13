import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalChat } from "@/hooks/useDuel";
import { MessageSquare, Send, ChevronLeft, Users } from "lucide-react";

export default function ChatPage() {
  const { user } = useAuth();
  const { messages, send } = useGlobalChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!user) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white px-4">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="text-white/60 mb-4">Inicia sesion para usar el chat global</p>
          <Link to="/login" className="px-6 py-3 bg-amber-500 text-indigo-950 rounded-xl font-bold">Iniciar Sesion</Link>
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (!input.trim()) return;
    send(user.id, user.name || `Jugador #${user.id}`, input.trim());
    setInput("");
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col">
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-white/60 hover:text-white transition"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /><span className="font-bold text-sm">Chat Global</span></div>
        <div className="w-8" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 text-white/30"><MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No hay mensajes aun</p><p className="text-xs">Se el primero en escribir</p></div>
        )}
        {messages.map((m: any) => (
          <div key={m.id || m.timestamp} className={m.senderId === user.id ? "text-right" : "text-left"}>
            <span className="text-[10px] text-white/30">{m.senderName}</span>
            <div className={`inline-block px-3 py-2 rounded-xl text-sm max-w-[70%] break-words ${m.senderId === user.id ? "bg-amber-500 text-indigo-950 rounded-br-none font-medium" : "bg-white/10 text-white rounded-bl-none"}`}>{m.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <input type="text" placeholder="Escribe un mensaje..." value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50" />
          <button onClick={handleSend} disabled={!input.trim()} className="p-3 bg-amber-500 text-indigo-950 rounded-xl hover:bg-amber-400 transition disabled:opacity-50"><Send className="w-5 h-5" /></button>
        </div>
      </div>
    </div>
  );
}
