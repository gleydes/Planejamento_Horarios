import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit2,
  Filter,
  Lightbulb,
  ListTodo,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";

type Category = "Trabalho" | "Pessoal" | "Saúde" | "Estudo" | "Lazer" | "Outro";
type Priority = "Alta" | "Média" | "Baixa";
type View = "Dashboard" | "Dia" | "Semana" | "Inteligente";

interface PlannerTask {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  category: Category;
  priority: Priority;
  completed: boolean;
  notes: string;
}

const STORAGE_KEY = "meu-planner:activities:v1";
const categories: Category[] = ["Trabalho", "Pessoal", "Saúde", "Estudo", "Lazer", "Outro"];
const views: { label: View; icon: typeof CalendarDays }[] = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Dia", icon: Calendar },
  { label: "Semana", icon: CalendarDays },
  { label: "Inteligente", icon: Sparkles },
];

const categoryClass: Record<Category, string> = {
  Trabalho: "work",
  Pessoal: "personal",
  Saúde: "health",
  Estudo: "study",
  Lazer: "leisure",
  Outro: "other",
};

const categoryDot: Record<Category, string> = {
  Trabalho: "#3478f6",
  Pessoal: "#8b5cf6",
  Saúde: "#10b981",
  Estudo: "#f59e0b",
  Lazer: "#ec4899",
  Outro: "#94a3b8",
};

const priorityClass: Record<Priority, string> = {
  Alta: "high",
  Média: "medium",
  Baixa: "low",
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readStoredTasks(): PlannerTask[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isPlannerTask)) {
    throw new Error("Os dados salvos não estão em um formato válido.");
  }
  return parsed;
}

function isPlannerTask(value: unknown): value is PlannerTask {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  return typeof task.id === "string"
    && typeof task.title === "string"
    && typeof task.date === "string"
    && typeof task.time === "string"
    && typeof task.duration === "number"
    && Number.isFinite(task.duration)
    && categories.includes(task.category as Category)
    && ["Alta", "Média", "Baixa"].includes(String(task.priority))
    && typeof task.completed === "boolean"
    && typeof task.notes === "string";
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}

function TaskForm({
  task,
  onClose,
  onSave,
}: {
  task: PlannerTask | null;
  onClose: () => void;
  onSave: (task: PlannerTask) => void;
}) {
  const today = localDateKey(new Date());
  const [title, setTitle] = useState(task?.title ?? "");
  const [date, setDate] = useState(task?.date ?? today);
  const [time, setTime] = useState(task?.time ?? "09:00");
  const [duration, setDuration] = useState(String(task?.duration ?? 60));
  const [category, setCategory] = useState<Category>(task?.category ?? "Trabalho");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "Média");
  const [notes, setNotes] = useState(task?.notes ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      id: task?.id ?? createId(),
      title: title.trim(),
      date,
      time,
      duration: Number(duration),
      category,
      priority,
      completed: task?.completed ?? false,
      notes: notes.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="activity-modal" role="dialog" aria-modal="true" aria-labelledby="activity-modal-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{task ? "ATUALIZE SUA ROTINA" : "PLANEJE SEU DIA"}</span>
            <h2 id="activity-modal-title">{task ? "Editar atividade" : "Nova atividade"}</h2>
            <p>Organize os detalhes e mantenha tudo em dia.</p>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Fechar formulário">
            <X size={19} />
          </button>
        </div>
        <form onSubmit={submit} className="activity-form">
          <label className="form-field form-field-full">
            <span>Nome da atividade</span>
            <input autoFocus required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Revisar planejamento semanal" />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Data</span>
              <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Horário</span>
              <input required type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>Duração (minutos)</span>
              <input required type="number" min="5" max="1440" step="5" value={duration} onChange={(event) => setDuration(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="priority-field">
            <legend>Prioridade</legend>
            <div className="priority-options">
              {(["Baixa", "Média", "Alta"] as Priority[]).map((item) => (
                <button key={item} type="button" className={`priority-option ${priority === item ? "selected" : ""} ${priorityClass[item]}`} onClick={() => setPriority(item)}>
                  <span className="priority-dot" />{item}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="form-field form-field-full">
            <span>Observações <small>opcional</small></span>
            <textarea rows={3} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Adicione algum detalhe importante..." />
          </label>
          <div className="form-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button>
            <button type="submit" className="button button-primary"><Check size={16} />{task ? "Salvar alterações" : "Criar atividade"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: PlannerTask;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`task-row ${task.completed ? "task-completed" : ""}`}>
      <time className="task-time">{task.time}</time>
      <span className={`task-marker ${categoryClass[task.category]}`} aria-hidden="true" />
      <button className={`task-check ${task.completed ? "checked" : ""}`} onClick={onToggle} aria-label={task.completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`}>
        {task.completed && <Check size={13} strokeWidth={3} />}
      </button>
      <div className="task-content">
        <div className="task-title-line">
          <h3>{task.title}</h3>
          <span className={`priority-label ${priorityClass[task.priority]}`}>{task.priority}</span>
        </div>
        {task.notes && <p className="task-notes">{task.notes}</p>}
        <div className="task-meta">
          <span className={`category-label ${categoryClass[task.category]}`}><i />{task.category}</span>
          <span><Clock3 size={12} />{formatDuration(task.duration)}</span>
        </div>
      </div>
      <div className="task-actions">
        <button className="icon-button" onClick={onEdit} aria-label={`Editar ${task.title}`} title="Editar"><Edit2 size={15} /></button>
        <button className="icon-button delete-action" onClick={onDelete} aria-label={`Excluir ${task.title}`} title="Excluir"><Trash2 size={15} /></button>
      </div>
    </article>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><CalendarDays size={23} /></span>
      <h3>Nenhuma atividade para hoje</h3>
      <p>Aproveite seu dia livre!</p>
      <button type="button" className="button button-soft" onClick={onAdd}><Plus size={16} />Adicionar primeira atividade</button>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [activeView, setActiveView] = useState<View>("Dashboard");
  const [activeCategory, setActiveCategory] = useState<Category | "Todas">("Todas");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      setTasks(readStoredTasks());
    } catch {
      setStorageError("Não foi possível carregar as atividades salvas neste navegador.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady || storageError) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      setStorageError("Não foi possível salvar. Verifique o espaço disponível no navegador.");
    }
  }, [tasks, storageReady, storageError]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const today = localDateKey(new Date());
  const todayTasks = useMemo(() => tasks.filter((task) => task.date === today).sort((a, b) => a.time.localeCompare(b.time)), [tasks, today]);
  const selectedTasks = useMemo(() => tasks.filter((task) => task.date === localDateKey(selectedDate) && (activeCategory === "Todas" || task.category === activeCategory)).sort((a, b) => a.time.localeCompare(b.time)), [tasks, selectedDate, activeCategory]);
  const totalToday = todayTasks.length;
  const completedToday = todayTasks.filter((task) => task.completed).length;
  const completedTotal = tasks.filter((task) => task.completed).length;
  const overdueCount = tasks.filter((task) => !task.completed && task.date < today).length;
  const highPriorityCount = tasks.filter((task) => !task.completed && task.priority === "Alta").length;
  const occupiedMinutes = todayTasks.reduce((total, task) => total + task.duration, 0);
  const progress = tasks.length ? Math.round((completedTotal / tasks.length) * 100) : 0;

  const visibleTodayTasks = activeCategory === "Todas" ? todayTasks : todayTasks.filter((task) => task.category === activeCategory);

  function saveTask(task: PlannerTask) {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id);
      return exists ? current.map((item) => item.id === task.id ? task : item) : [...current, task];
    });
    setSelectedDate(new Date(`${task.date}T12:00:00`));
    setIsFormOpen(false);
    setEditingTask(null);
    setToast(editingTask ? "Atividade atualizada com sucesso." : "Atividade criada com sucesso.");
  }

  function removeTask(task: PlannerTask) {
    if (!window.confirm(`Excluir "${task.title}"? Esta ação não pode ser desfeita.`)) return;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setToast("Atividade excluída.");
  }

  function toggleTask(task: PlannerTask) {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item));
    setToast(task.completed ? "Atividade reaberta." : "Atividade concluída!");
  }

  function openCreate() {
    setEditingTask(null);
    setIsFormOpen(true);
  }

  function openEdit(task: PlannerTask) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  const greetingDate = formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" });
  const greeting = getGreeting();
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveView("Dashboard"); }} aria-label="Meu Planner, ir para dashboard">
          <span className="brand-mark"><CalendarDays size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Meu Planner</strong><small>Organize sua vida</small></span>
        </a>

        <div className="sidebar-scroll">
          <p className="sidebar-label">MENU PRINCIPAL</p>
          <nav className="main-nav" aria-label="Navegação principal">
            {views.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => setActiveView(label)} className={`nav-item ${activeView === label ? "active" : ""}`}>
                <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
                {label === "Inteligente" && <span className="nav-new">IA</span>}
              </button>
            ))}
          </nav>

          <div className="sidebar-divider" />
          <div className="category-heading"><p className="sidebar-label">CATEGORIAS</p><Filter size={14} /></div>
          <div className="category-list">
            <button className={`category-filter ${activeCategory === "Todas" ? "selected" : ""}`} onClick={() => setActiveCategory("Todas")}>
              <span className="category-dot all-dot" />Todas <span className="category-count">{tasks.length}</span>
            </button>
            {categories.map((category) => (
              <button key={category} className={`category-filter ${activeCategory === category ? "selected" : ""}`} onClick={() => setActiveCategory(category)}>
                <span className="category-dot" style={{ backgroundColor: categoryDot[category] }} />{category}
                <span className="category-count">{tasks.filter((task) => task.category === category).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-summary">
            <div className="summary-top"><span className="summary-icon"><Target size={16} /></span><span>Seu progresso</span><MoreHorizontal size={17} /></div>
            <strong>{tasks.length} <small>{tasks.length === 1 ? "atividade" : "atividades"}</small></strong>
            <div className="summary-progress"><span style={{ width: `${progress}%` }} /></div>
            <div className="summary-foot"><span>{completedTotal} concluídas</span><span>{progress}%</span></div>
          </div>
          <div className="sidebar-profile">
            <span className="avatar">MP</span>
            <span className="profile-text"><strong>Meu espaço</strong><small>Plano pessoal</small></span>
            <MoreHorizontal size={17} className="profile-more" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveView("Dashboard"); }}>
            <span className="brand-mark"><CalendarDays size={20} /></span><span className="brand-copy"><strong>Meu Planner</strong></span>
          </a>
          <button className="button button-primary mobile-add" onClick={openCreate}><Plus size={16} />Nova</button>
        </header>

        <div className="page-wrap">
          <header className="page-header">
            <div>
              <span className="eyebrow">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span>
              <h1>{activeView}</h1>
              <p>{activeView === "Dashboard" ? "Visão geral das suas atividades" : activeView === "Inteligente" ? "Ideias práticas para uma rotina mais leve" : activeView === "Semana" ? "Uma visão clara da sua semana" : "Organize suas atividades do dia"}</p>
            </div>
            <button className="button button-primary desktop-add" onClick={openCreate}><Plus size={18} strokeWidth={2.5} />Nova atividade</button>
          </header>

          {storageError && <div role="alert" className="storage-alert"><span>{storageError}</span></div>}

          {!storageReady ? (
            <div className="loading-state"><span className="loading-spinner" />Carregando suas atividades...</div>
          ) : (
            <>
              <div className="mobile-categories" aria-label="Filtrar atividades por categoria">
                <button className={activeCategory === "Todas" ? "selected" : ""} onClick={() => setActiveCategory("Todas")}>Todas</button>
                {categories.map((category) => <button key={category} className={activeCategory === category ? `selected ${categoryClass[category]}` : categoryClass[category]} onClick={() => setActiveCategory(category)}><i />{category}</button>)}
              </div>
              {activeView === "Dashboard" && (
                <>
                  <section className="welcome-banner">
                    <div className="welcome-copy">
                      <span className="welcome-kicker"><Sparkles size={14} /> UM NOVO DIA, NOVAS POSSIBILIDADES</span>
                      <h2>{greeting}, vamos com calma e foco.</h2>
                      <p>Hoje é {greetingDate}. Um passo de cada vez faz a diferença.</p>
                    </div>
                    <div className="welcome-art" aria-hidden="true"><span className="welcome-orbit orbit-one" /><span className="welcome-orbit orbit-two" /><span className="welcome-sun"><Activity size={25} /></span><span className="welcome-spark spark-one" /><span className="welcome-spark spark-two" /></div>
                  </section>

                  <section className="stats-grid" aria-label="Indicadores do planner">
                    <article className="stat-card">
                      <div className="stat-heading"><span className="stat-icon blue"><ListTodo size={19} /></span><span className="stat-trend"><ArrowUpRight size={14} />Hoje</span></div>
                      <p className="stat-label">Tarefas hoje</p><strong className="stat-value">{totalToday}</strong>
                      <p className="stat-helper">{completedToday} de {totalToday} concluídas</p>
                      <div className="stat-progress"><span className="blue-fill" style={{ width: `${totalToday ? (completedToday / totalToday) * 100 : 0}%` }} /></div>
                    </article>
                    <article className="stat-card">
                      <div className="stat-heading"><span className="stat-icon purple"><Clock3 size={19} /></span><span className="stat-decoration"><ArrowDownRight size={14} /></span></div>
                      <p className="stat-label">Tempo ocupado</p><strong className="stat-value">{formatDuration(occupiedMinutes)}</strong>
                      <p className="stat-helper">Tempo planejado para hoje</p>
                    </article>
                    <article className="stat-card">
                      <div className="stat-heading"><span className="stat-icon red"><CalendarDays size={19} /></span>{overdueCount > 0 && <span className="stat-alert">Atenção</span>}</div>
                      <p className="stat-label">Atrasadas</p><strong className="stat-value">{overdueCount}</strong>
                      <p className="stat-helper">{overdueCount ? "Atividades aguardando você" : "Tudo em dia por aqui"}</p>
                    </article>
                    <article className="stat-card">
                      <div className="stat-heading"><span className="stat-icon orange"><Target size={19} /></span><span className="stat-decoration"><TrendingUp size={14} /></span></div>
                      <p className="stat-label">Alta prioridade</p><strong className="stat-value">{highPriorityCount}</strong>
                      <p className="stat-helper">Atividades pendentes</p>
                    </article>
                  </section>

                  <section className="dashboard-grid">
                    <article className="panel agenda-panel">
                      <div className="panel-heading">
                        <div className="panel-heading-title"><span className="panel-icon"><CalendarDays size={18} /></span><div><h2>Agenda de Hoje</h2><p>Suas atividades para {formatDate(new Date(), { day: "numeric", month: "long" })}</p></div></div>
                        <button className="text-button" onClick={() => { setActiveView("Dia"); setSelectedDate(new Date()); }}>Ver tudo <ArrowRight size={15} /></button>
                      </div>
                      {visibleTodayTasks.length === 0 ? <EmptyState onAdd={openCreate} /> : (
                        <div className="task-list">
                          {visibleTodayTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} onDelete={() => removeTask(task)} />)}
                        </div>
                      )}
                    </article>

                    <aside className="progress-panel panel">
                      <div className="panel-heading compact-heading"><div><h2>Progresso</h2><p>Seu ritmo geral</p></div><span className="progress-panel-icon"><TrendingUp size={17} /></span></div>
                      <div className="progress-ring-wrap">
                        <div className="progress-ring" style={{ background: `conic-gradient(#3478f6 ${progress * 3.6}deg, #edf1f7 0deg)` }}>
                          <div className="progress-ring-inner"><strong>{progress}%</strong><span>concluído</span></div>
                        </div>
                      </div>
                      <div className="progress-summary"><strong>{completedTotal} de {tasks.length} tarefas</strong><span>{tasks.length ? "Continue assim, você está indo bem!" : "Suas tarefas concluídas aparecem aqui."}</span></div>
                      <div className="progress-divider" />
                      <div className="progress-detail"><span className="detail-dot" />Concluídas <strong>{completedTotal}</strong></div>
                      <div className="progress-detail"><span className="detail-dot pending-dot" />Pendentes <strong>{tasks.length - completedTotal}</strong></div>
                    </aside>
                  </section>
                  <footer className="page-footer"><span>Feito para deixar sua rotina mais leve.</span><span className="footer-date"><span />Dados salvos neste dispositivo</span></footer>
                </>
              )}

              {activeView === "Dia" && (
                <section className="panel view-panel">
                  <div className="view-toolbar">
                    <div><span className="eyebrow">AGENDA DIÁRIA</span><h2>{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long" })}</h2><p>{selectedTasks.length} {selectedTasks.length === 1 ? "atividade planejada" : "atividades planejadas"}</p></div>
                    <div className="date-controls"><button className="icon-button" onClick={() => setSelectedDate((date) => shiftDate(date, -1))} aria-label="Dia anterior"><ChevronLeft size={19} /></button><button className="button button-quiet today-button" onClick={() => setSelectedDate(new Date())}>Hoje</button><button className="icon-button" onClick={() => setSelectedDate((date) => shiftDate(date, 1))} aria-label="Próximo dia"><ChevronRight size={19} /></button></div>
                  </div>
                  {selectedTasks.length === 0 ? <EmptyState onAdd={openCreate} /> : <div className="task-list day-task-list">{selectedTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task)} onEdit={() => openEdit(task)} onDelete={() => removeTask(task)} />)}</div>}
                </section>
              )}

              {activeView === "Semana" && (
                <section className="panel week-panel">
                  <div className="view-toolbar">
                    <div><span className="eyebrow">VISÃO SEMANAL</span><h2>{formatDate(weekStart, { day: "numeric", month: "short" })} — {formatDate(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}</h2><p>Suas atividades distribuídas ao longo da semana</p></div>
                    <div className="date-controls"><button className="icon-button" onClick={() => setSelectedDate((date) => shiftDate(date, -7))} aria-label="Semana anterior"><ChevronLeft size={19} /></button><button className="button button-quiet today-button" onClick={() => setSelectedDate(new Date())}>Esta semana</button><button className="icon-button" onClick={() => setSelectedDate((date) => shiftDate(date, 7))} aria-label="Próxima semana"><ChevronRight size={19} /></button></div>
                  </div>
                  <div className="week-grid">{weekDays.map((day) => {
                    const dayKey = localDateKey(day);
                    const dayTasks = tasks.filter((task) => task.date === dayKey && (activeCategory === "Todas" || task.category === activeCategory)).sort((a, b) => a.time.localeCompare(b.time));
                    return <button key={dayKey} className={`week-day ${dayKey === today ? "current-day" : ""} ${dayKey === localDateKey(selectedDate) ? "selected-day" : ""}`} onClick={() => { setSelectedDate(day); setActiveView("Dia"); }}>
                      <span className="week-day-name">{formatDate(day, { weekday: "short" })}</span><strong className="week-day-number">{formatDate(day, { day: "2-digit" })}</strong><span className="week-task-count">{dayTasks.length} {dayTasks.length === 1 ? "atividade" : "atividades"}</span>
                      <div className="week-task-list">{dayTasks.slice(0, 4).map((task) => <span key={task.id} className={`week-task-chip ${categoryClass[task.category]} ${task.completed ? "done-chip" : ""}`}><i />{task.time} {task.title}</span>)}{dayTasks.length > 4 && <span className="more-tasks">+{dayTasks.length - 4} atividades</span>}</div>
                      {dayTasks.length === 0 && <span className="week-empty">Dia livre</span>}
                    </button>;
                  })}</div>
                </section>
              )}

              {activeView === "Inteligente" && (
                <section className="smart-view">
                  <div className="smart-intro">
                    <div className="smart-icon"><Lightbulb size={23} /></div>
                    <div><span className="eyebrow">PLANEJAMENTO INTELIGENTE</span><h2>Encontre seu melhor ritmo.</h2><p>Sugestões baseadas nas atividades que você cadastrou.</p></div>
                  </div>
                  <div className="smart-grid">
                    <article className="panel smart-card"><span className="smart-card-icon blue"><Clock3 size={18} /></span><h3>Seu dia de hoje</h3><p>{totalToday ? `Você planejou ${formatDuration(occupiedMinutes)} de atividades para hoje. ${occupiedMinutes > 360 ? "Considere reservar pequenas pausas entre os compromissos." : "Há espaço para incluir pausas e imprevistos na sua rotina."}` : "Seu dia está livre. Que tal adicionar uma atividade importante para começar?"}</p><button className="text-button" onClick={() => { setActiveView("Dia"); setSelectedDate(new Date()); }}>Ver agenda <ArrowRight size={15} /></button></article>
                    <article className="panel smart-card"><span className="smart-card-icon orange"><Target size={18} /></span><h3>Priorize com intenção</h3><p>{highPriorityCount ? `Você tem ${highPriorityCount} ${highPriorityCount === 1 ? "atividade prioritária" : "atividades prioritárias"} pendente${highPriorityCount === 1 ? "" : "s"}. Começar por uma delas pode trazer mais tranquilidade.` : "Nenhuma atividade de alta prioridade pendente. Um bom momento para planejar com calma."}</p><button className="text-button" onClick={openCreate}>Planejar atividade <ArrowRight size={15} /></button></article>
                    <article className="panel smart-card"><span className="smart-card-icon purple"><TrendingUp size={18} /></span><h3>Seu progresso</h3><p>{tasks.length ? `${completedTotal} de ${tasks.length} atividades concluídas (${progress}%). Cada tarefa finalizada é um passo importante.` : "Seu progresso começa quando você registra sua primeira atividade."}</p><div className="smart-progress"><span style={{ width: `${progress}%` }} /></div></article>
                  </div>
                  <div className="smart-tip"><span><Sparkles size={17} /></span><p><strong>Uma dica para você</strong><br />Experimente dividir atividades grandes em etapas menores. Fica mais fácil começar — e celebrar cada avanço.</p></div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação móvel">
        {views.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveView(label)} className={activeView === label ? "active" : ""} aria-label={label}><Icon size={19} /><span>{label === "Inteligente" ? "Smart" : label}</span></button>)}
      </nav>

      {isFormOpen && <TaskForm task={editingTask} onClose={() => { setIsFormOpen(false); setEditingTask(null); }} onSave={saveTask} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}
