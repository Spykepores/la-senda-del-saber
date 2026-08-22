import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { useChat } from "@/hooks/useChat";
import { useGlobalChat } from "@/hooks/useDuel";
import type { ChatMessage } from "@/hooks/useChat";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search, Send, ArrowLeft, Users, Hash, User, Radio, WifiOff,
  Globe, MessageCircle, X, Volume2, VolumeX, Bell, BellOff
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Conversation {
  id: string;
  type: "user" | "room";
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread: number;
  online?: boolean;
  isPrivate?: boolean;
}

function getInitials(name: string) {
  return name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";
}

function getAvatarColor(id: number) {
  const colors = [
    "bg-amber-600", "bg-yellow-600", "bg-orange-600", "bg-emerald-600",
    "bg-teal-600", "bg-cyan-600", "bg-sky-600", "bg-indigo-600",
    "bg-violet-600", "bg-purple-600", "bg-fuchsia-600", "bg-rose-600",
  ];
  return colors[id % colors.length];
}

function formatChatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return format(d, "EEE", { locale: es });
  return format(d, "dd/MM", { locale: es });
}

function formatMessageTime(dateStr: string) {
  return format(new Date(dateStr), "HH:mm", { locale: es });
}

function formatMessageDate(dateStr: string) {
  return format(new Date(dateStr), "EEEE d MMMM", { locale: es });
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; items: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const dateKey = format(new Date(msg.createdAt), "yyyy-MM-dd", { locale: es });
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      groups.push({ date: dateKey, items: [] });
    }
    groups[groups.length - 1].items.push(msg);
  }
  return groups;
}

export default function ChatModern() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const myName = user?.name ?? "Yo";

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [activeTab, setActiveTab] = useState<"users" | "rooms">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allUsers = [] } = trpc.users.list.useQuery();
  const { data: allRooms = [] } = trpc.chat.listRooms.useQuery();

  const {
    messages: roomMessages,
    send: sendRoomMsg,
    connected: wsConnected,
  } = useChat(selectedConv?.type === "room" ? selectedConv.id : null);

  const {
    messages: globalMessages,
    sendMessage: sendGlobal,
    wsConnected: globalWsConnected,
  } = useGlobalChat();

  const currentMessages = useMemo(() => {
    if (selectedConv?.type === "room") return roomMessages;
    return globalMessages;
  }, [selectedConv, roomMessages, globalMessages]);

  const sendCurrentMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (selectedConv?.type === "room") {
        await sendRoomMsg(myId, myName, content);
      } else if (selectedConv?.type === "user") {
        await sendGlobal(myId, myName, `@${selectedConv.id}:${content}`);
      } else {
        await sendGlobal(myId, myName, content);
      }
      setMessageInput("");
    },
    [selectedConv, myId, myName, sendRoomMsg, sendGlobal]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  useEffect(() => {
    if (selectedConv && !isMobile) {
      inputRef.current?.focus();
    }
  }, [selectedConv, isMobile]);

  const conversations = useMemo(() => {
    const items: Conversation[] = [];
    if (activeTab === "users") {
      for (const u of allUsers) {
        if (u.id === myId) continue;
        const existingMsgs = currentMessages.filter(
          (m: ChatMessage) =>
            (m.senderId === u.id && m.recipientId === myId) ||
            (m.senderId === myId && m.recipientId === u.id)
        );
        const lastMsg = existingMsgs[existingMsgs.length - 1];
        items.push({
          id: `user-${u.id}`,
          type: "user",
          name: u.name || `Usuario #${u.id}`,
          avatar: u.avatar || undefined,
          lastMessage: lastMsg ? lastMsg.content : undefined,
          lastMessageAt: lastMsg ? lastMsg.createdAt : undefined,
          unread: currentMessages.filter(
            (m: ChatMessage) => m.senderId === u.id && m.recipientId === myId && m.isPrivate
          ).length,
          online: true,
        });
      }
    } else {
      for (const room of allRooms) {
        const roomMsgs = roomMessages.filter((m: ChatMessage) => m.roomSlug === room.slug);
        const lastMsg = roomMsgs[roomMsgs.length - 1];
        items.push({
          id: room.slug,
          type: "room",
          name: room.name,
          lastMessage: lastMsg ? lastMsg.content : undefined,
          lastMessageAt: lastMsg ? lastMsg.createdAt : undefined,
          unread: roomMsgs.filter((m: ChatMessage) => m.senderId !== myId).length,
          isPrivate: room.isPrivate,
        });
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return items.filter((i) => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [activeTab, allUsers, allRooms, currentMessages, roomMessages, myId, searchQuery]);

  const activeName = selectedConv?.name ?? "Sala Publica";
  const showSidebar = !isMobile || !selectedConv;
  const showChat = !isMobile || !!selectedConv;

  return (
    <div className="flex h-screen w-full bg-[#0B1120] text-slate-100 overflow-hidden">
      {showSidebar && (
        <aside className={cn(
          "flex flex-col bg-[#0F172A] border-r border-slate-800/50",
          isMobile ? "absolute inset-0 z-50 w-full" : "w-[340px] min-w-[340px]"
        )}>
          <div className="p-4 pb-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" /> Chat
              </h2>
              <div className="flex items-center gap-1">
                <button onClick={() => setSoundEnabled(!soundEnabled)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors">
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <button onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors">
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {wsConnected || globalWsConnected ? (
                <><Radio className="w-3 h-3 text-emerald-400 animate-pulse" /><span className="text-emerald-400">En linea</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-400" /><span className="text-red-400">Sin conexion (polling HTTP)</span></>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input placeholder="Buscar usuario o sala..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-800/50 border-slate-700/50 text-sm placeholder:text-slate-500 focus-visible:ring-amber-500/30" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setActiveTab("users")} className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeTab === "users" ? "bg-amber-500/15 text-amber-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              )}><User className="w-3.5 h-3.5 inline mr-1" /> Usuarios</button>
              <button onClick={() => setActiveTab("rooms")} className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
                activeTab === "rooms" ? "bg-amber-500/15 text-amber-400" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
              )}><Hash className="w-3.5 h-3.5 inline mr-1" /> Salas</button>
            </div>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-0.5 pb-2">
              {activeTab === "users" && conversations.length === 0 && !searchQuery && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay usuarios registrados</p>
                  <p className="text-xs mt-1">Registrate para ver a otros jugadores</p>
                </div>
              )}
              {activeTab === "rooms" && allRooms.length === 0 && !searchQuery && (
                <div className="text-center py-8 text-slate-500 text-sm">
                  <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No hay salas disponibles</p>
                </div>
              )}
              {conversations.map((conv) => (
                <button key={conv.id} onClick={() => setSelectedConv(conv)} className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group",
                  selectedConv?.id === conv.id
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "hover:bg-slate-800/50 border border-transparent"
                )}>
                  <div className="relative flex-shrink-0">
                    {conv.avatar ? (
                      <img src={conv.avatar} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-slate-700" />
                    ) : (
                      <Avatar className={cn("w-11 h-11 border-2 border-slate-700", getAvatarColor(parseInt(conv.id.replace(/[^0-9]/g, "")) || 1))}>
                        <AvatarFallback className="text-xs font-bold text-white">{getInitials(conv.name)}</AvatarFallback>
                      </Avatar>
                    )}
                    {conv.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0F172A]" />
                    )}
                    {conv.unread > 0 && !conv.online && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[10px] font-bold text-black flex items-center justify-center">
                        {conv.unread > 9 ? "9+" : conv.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={cn("text-sm font-medium truncate", selectedConv?.id === conv.id ? "text-amber-300" : "text-slate-200")}>
                        {conv.name}
                      </h4>
                      {conv.lastMessageAt && (
                        <span className="text-[11px] text-slate-500 flex-shrink-0 ml-1">{formatChatTime(conv.lastMessageAt)}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage ?? "Sin mensajes aun"}</p>
                  </div>
                  {conv.unread > 0 && (
                    <div className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center flex-shrink-0 rounded-full">
                      {conv.unread > 99 ? "99+" : conv.unread}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-slate-800/50">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9 border-2 border-amber-500/30">
                <AvatarFallback className="bg-amber-600 text-white text-xs font-bold">{getInitials(myName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{myName}</p>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En linea
                </p>
              </div>
              <Link to="/" className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors" title="Volver al inicio">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </aside>
      )}
      {showChat && (
        <main className="flex-1 flex flex-col min-w-0 bg-[#0B1120]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 bg-[#0F172A]/80 backdrop-blur-sm">
            {isMobile && selectedConv && (
              <button onClick={() => setSelectedConv(null)} className="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="relative">
              <Avatar className={cn("w-10 h-10 border-2 border-slate-700", selectedConv ? getAvatarColor(parseInt(selectedConv.id.replace(/[^0-9]/g, "")) || 1) : "bg-amber-600")}>
                <AvatarFallback className="text-xs font-bold text-white">
                  {selectedConv ? getInitials(selectedConv.name) : <Globe className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              {selectedConv?.online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0F172A]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate">{activeName}</h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                {selectedConv?.type === "room" ? (
                  <><Users className="w-3 h-3" /> Sala publica</>
                ) : selectedConv?.type === "user" ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En linea</>
                ) : (
                  <><Globe className="w-3 h-3" /> Sala publica global</>
                )}
              </p>
            </div>
          </div>
          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-1">
              {!selectedConv && (
                <div className="text-center py-12">
                  <Globe className="w-16 h-16 mx-auto mb-4 text-amber-500/20" />
                  <h3 className="text-lg font-semibold text-slate-300 mb-1">Sala Publica</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto">
                    Chat global para todos los jugadores de La Senda del Saber. Unete a la conversacion!
                  </p>
                </div>
              )}
              {groupMessagesByDate(currentMessages).map((group) => (
                <div key={group.date}>
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-slate-800/70 text-slate-400 text-[11px] px-3 py-1 rounded-full">
                      {formatMessageDate(group.items[0]?.createdAt)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((msg: ChatMessage) => {
                      const isMine = msg.senderId === myId;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                          className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 relative group",
                            isMine ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-br-md" : "bg-slate-800 text-slate-100 rounded-bl-md"
                          )}>
                            {!isMine && selectedConv?.type !== "user" && (
                              <p className="text-[11px] font-semibold text-amber-400 mb-0.5">{msg.senderName}</p>
                            )}
                            <p className="text-sm leading-relaxed break-words">{msg.content}</p>
                            <div className={cn("flex items-center gap-1 mt-1", isMine ? "justify-end text-amber-200/70" : "justify-end text-slate-500")}>
                              <span className="text-[10px]">{formatMessageTime(msg.createdAt)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {currentMessages.length === 0 && selectedConv && (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-slate-500 text-sm">No hay mensajes aun</p>
                  <p className="text-slate-600 text-xs mt-1">Se el primero en escribir</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-slate-800/50 bg-[#0F172A]/80 backdrop-blur-sm">
            <form onSubmit={(e) => { e.preventDefault(); sendCurrentMessage(messageInput); }} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Input ref={inputRef} value={messageInput} onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={selectedConv ? `Mensaje para ${activeName}...` : "Escribe un mensaje en la sala publica..."}
                  className="bg-slate-800/70 border-slate-700/50 pr-10 py-5 text-sm placeholder:text-slate-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/30"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCurrentMessage(messageInput); } }} />
                {messageInput.length > 0 && (
                  <button type="button" onClick={() => setMessageInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button type="submit" disabled={!messageInput.trim()} className={cn(
                "h-10 w-10 p-0 rounded-xl transition-all",
                messageInput.trim() ? "bg-amber-500 hover:bg-amber-600 text-black" : "bg-slate-800 text-slate-600"
              )}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </main>
      )}
    </div>
  );
}
