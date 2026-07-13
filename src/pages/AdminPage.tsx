import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, BookOpen, Calendar, Trophy, Users, BarChart3,
  Plus, Edit2, Trash2, LayoutDashboard
} from "lucide-react";

type AdminTab = "dashboard" | "questions" | "seasons" | "events";

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);

  // tRPC queries
  const dashboardQuery = trpc.admin.dashboard.useQuery(undefined, { enabled: activeTab === "dashboard" });
  const questionsQuery = trpc.questions.list.useQuery({});
  const seasonsQuery = trpc.seasons.list.useQuery({});
  const eventsQuery = trpc.events.list.useQuery({});
  const statsQuery = trpc.admin.stats.useQuery(undefined, { enabled: activeTab === "dashboard" });

  // tRPC mutations
  const utils = trpc.useUtils();
  const createQuestion = trpc.questions.create.useMutation({ onSuccess: () => { utils.questions.list.invalidate(); setShowQuestionForm(false); } });
  const deleteQuestion = trpc.questions.delete.useMutation({ onSuccess: () => utils.questions.list.invalidate() });
  const createSeason = trpc.seasons.create.useMutation({ onSuccess: () => { utils.seasons.list.invalidate(); setShowSeasonForm(false); } });
  const deleteSeason = trpc.seasons.delete.useMutation({ onSuccess: () => utils.seasons.list.invalidate() });
  const createEvent = trpc.events.create.useMutation({ onSuccess: () => { utils.events.list.invalidate(); setShowEventForm(false); } });
  const deleteEvent = trpc.events.delete.useMutation({ onSuccess: () => utils.events.list.invalidate() });

  const [formData, setFormData] = useState<{
    category: "genealogy" | "parables" | "stories" | "prophecy" | "doctrine" | "characters" | "books";
    difficulty: "easy" | "medium" | "hard";
    question: string; option1: string; option2: string; option3: string; option4: string;
    correctAnswer: number; explanation: string; seasonId: number | undefined;
  }>({
    category: "genealogy", difficulty: "medium",
    question: "", option1: "", option2: "", option3: "", option4: "",
    correctAnswer: 0, explanation: "", seasonId: undefined,
  });
  const [seasonForm, setSeasonForm] = useState({
    bookName: "", bookDisplay: "", weeks: 4, description: "", color: "#4F46E5",
  });
  const [eventForm, setEventForm] = useState({
    title: "", description: "", type: "duel" as const,
    startDate: "", endDate: "", reward: "", isActive: true,
  });

  const tabs: { id: AdminTab; label: string; icon: typeof Shield }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "questions", label: "Preguntas", icon: BookOpen },
    { id: "seasons", label: "Temporadas", icon: Calendar },
    { id: "events", label: "Eventos", icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-indigo-950 text-white">
      {/* Header */}
      <div className="bg-indigo-900/50 border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-400" />
            <h1 className="text-xl font-bold">Panel de Administracion</h1>
          </div>
          <div className="text-sm text-white/60">
            {user?.name} (Admin)
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-amber-500 text-indigo-950"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {dashboardQuery.data && [
                { label: "Usuarios", value: dashboardQuery.data.counts.users, icon: Users, color: "text-blue-400" },
                { label: "Preguntas", value: dashboardQuery.data.counts.questions, icon: BookOpen, color: "text-green-400" },
                { label: "Temporadas", value: dashboardQuery.data.counts.seasons, icon: Calendar, color: "text-purple-400" },
                { label: "Desafios", value: dashboardQuery.data.counts.challenges, icon: Trophy, color: "text-amber-400" },
                { label: "Eventos", value: dashboardQuery.data.counts.events, icon: BarChart3, color: "text-pink-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <stat.icon className={`w-6 h-6 ${stat.color} mb-2`} />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-white/50 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Question Stats */}
            {statsQuery.data && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <h3 className="font-bold text-lg mb-4">Por Categoria</h3>
                  {statsQuery.data.byCategory.map(cat => (
                    <div key={cat.category} className="flex justify-between py-2 border-b border-white/5">
                      <span className="text-white/70 capitalize">{cat.category}</span>
                      <span className="font-mono font-bold text-amber-400">{cat.count}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                  <h3 className="font-bold text-lg mb-4">Por Dificultad</h3>
                  {statsQuery.data.byDifficulty.map(d => (
                    <div key={d.difficulty} className="flex justify-between py-2 border-b border-white/5">
                      <span className="text-white/70 capitalize">{d.difficulty}</span>
                      <span className="font-mono font-bold text-amber-400">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Questions */}
        {activeTab === "questions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Gestion de Preguntas</h2>
              <button
                onClick={() => setShowQuestionForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition"
              >
                <Plus className="w-4 h-4" /> Nueva Pregunta
              </button>
            </div>

            {/* Question Form Modal */}
            {showQuestionForm && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQuestionForm(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-indigo-900 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto border border-white/20" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-4">Nueva Pregunta</h3>
                  <div className="space-y-3">
                    <select className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value as any }))}>
                      {["genealogy", "parables", "stories", "prophecy", "doctrine", "characters", "books"].map(c => <option key={c} value={c} className="bg-indigo-900">{c}</option>)}
                    </select>
                    <select className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" value={formData.difficulty} onChange={e => setFormData(p => ({ ...p, difficulty: e.target.value as any }))}>
                      {["easy", "medium", "hard"].map(d => <option key={d} value={d} className="bg-indigo-900">{d}</option>)}
                    </select>
                    <textarea placeholder="Pregunta" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={formData.question} onChange={e => setFormData(p => ({ ...p, question: e.target.value }))} />
                    {["option1", "option2", "option3", "option4"].map((opt, i) => (
                      <input key={opt} type="text" placeholder={`Opcion ${i + 1}`} className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={(formData as any)[opt]} onChange={e => setFormData(p => ({ ...p, [opt]: e.target.value }))} />
                    ))}
                    <select className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" value={formData.correctAnswer} onChange={e => setFormData(p => ({ ...p, correctAnswer: Number(e.target.value) }))}>
                      {[0, 1, 2, 3].map(i => <option key={i} value={i} className="bg-indigo-900">Opcion correcta: {i + 1}</option>)}
                    </select>
                    <textarea placeholder="Explicacion (opcional)" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={formData.explanation} onChange={e => setFormData(p => ({ ...p, explanation: e.target.value }))} />
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => { createQuestion.mutate(formData); }} className="flex-1 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Guardar</button>
                      <button onClick={() => setShowQuestionForm(false)} className="flex-1 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition">Cancelar</button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {questionsQuery.data?.map(q => (
                <div key={q.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 capitalize">{q.category}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 capitalize">{q.difficulty}</span>
                    </div>
                    <p className="text-sm truncate">{q.question}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => { setFormData({ category: q.category, difficulty: q.difficulty, question: q.question, option1: q.option1, option2: q.option2, option3: q.option3, option4: q.option4, correctAnswer: q.correctAnswer, explanation: q.explanation ?? "", seasonId: q.seasonId ?? undefined }); setShowQuestionForm(true); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/20 transition">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => { if (confirm("Eliminar pregunta?")) deleteQuestion.mutate({ id: q.id }); }} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Seasons */}
        {activeTab === "seasons" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Gestion de Temporadas</h2>
              <button onClick={() => setShowSeasonForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">
                <Plus className="w-4 h-4" /> Nueva Temporada
              </button>
            </div>

            {showSeasonForm && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSeasonForm(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-indigo-900 rounded-2xl p-6 w-full max-w-md border border-white/20" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-4">Nueva Temporada</h3>
                  <div className="space-y-3">
                    <input placeholder="Nombre del libro (ej: genesis)" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={seasonForm.bookName} onChange={e => setSeasonForm(p => ({ ...p, bookName: e.target.value }))} />
                    <input placeholder="Nombre mostrado (ej: Genesis)" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={seasonForm.bookDisplay} onChange={e => setSeasonForm(p => ({ ...p, bookDisplay: e.target.value }))} />
                    <input type="number" placeholder="Semanas" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={seasonForm.weeks} onChange={e => setSeasonForm(p => ({ ...p, weeks: Number(e.target.value) }))} />
                    <textarea placeholder="Descripcion" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={seasonForm.description} onChange={e => setSeasonForm(p => ({ ...p, description: e.target.value }))} />
                    <input type="color" className="w-full p-1 rounded-lg bg-white/10 border border-white/20" value={seasonForm.color} onChange={e => setSeasonForm(p => ({ ...p, color: e.target.value }))} />
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => createSeason.mutate(seasonForm)} className="flex-1 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Guardar</button>
                      <button onClick={() => setShowSeasonForm(false)} className="flex-1 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition">Cancelar</button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            <div className="space-y-2">
              {seasonsQuery.data?.map(s => (
                <div key={s.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color || "#4F46E5" }} />
                    <div>
                      <p className="font-bold">{s.bookDisplay}</p>
                      <p className="text-sm text-white/50">{s.weeks} semanas {s.isActive && "• Activa"}</p>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm("Eliminar temporada?")) deleteSeason.mutate({ id: s.id }); }} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Events */}
        {activeTab === "events" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Gestion de Eventos</h2>
              <button onClick={() => setShowEventForm(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">
                <Plus className="w-4 h-4" /> Nuevo Evento
              </button>
            </div>

            {showEventForm && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEventForm(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-indigo-900 rounded-2xl p-6 w-full max-w-md border border-white/20" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold mb-4">Nuevo Evento</h3>
                  <div className="space-y-3">
                    <input placeholder="Titulo" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} />
                    <textarea placeholder="Descripcion" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} />
                    <select className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" value={eventForm.type} onChange={e => setEventForm(p => ({ ...p, type: e.target.value as any }))}>
                      {["duel", "tournament", "special", "daily"].map(t => <option key={t} value={t} className="bg-indigo-900 capitalize">{t}</option>)}
                    </select>
                    <input type="datetime-local" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" onChange={e => setEventForm(p => ({ ...p, startDate: e.target.value }))} />
                    <input type="datetime-local" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white" onChange={e => setEventForm(p => ({ ...p, endDate: e.target.value }))} />
                    <textarea placeholder="Recompensa JSON (opcional)" className="w-full p-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40" value={eventForm.reward} onChange={e => setEventForm(p => ({ ...p, reward: e.target.value }))} />
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => createEvent.mutate(eventForm)} className="flex-1 py-2 bg-amber-500 text-indigo-950 rounded-xl font-bold hover:bg-amber-400 transition">Guardar</button>
                      <button onClick={() => setShowEventForm(false)} className="flex-1 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition">Cancelar</button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            <div className="space-y-2">
              {eventsQuery.data?.map(ev => (
                <div key={ev.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex justify-between items-center">
                  <div>
                    <div className="flex gap-2 mb-1">
                      <span className="font-bold">{ev.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 capitalize">{ev.type}</span>
                      {ev.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Activo</span>}
                    </div>
                    <p className="text-sm text-white/50">{ev.description}</p>
                  </div>
                  <button onClick={() => { if (confirm("Eliminar evento?")) deleteEvent.mutate({ id: ev.id }); }} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
