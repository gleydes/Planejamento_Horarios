import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BarChart3,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Dumbbell,
  Edit2,
  FileText,
  Filter,
  Wallet,
  Heading1,
  Lightbulb,
  ListTodo,
  List,
  ListChecks,
  MoreHorizontal,
  Plus,
  Quote,
  Search,
  Sparkles,
  StickyNote,
  Target,
  Trash2,
  TrendingUp,
  X,
  Volume2,
  Vibrate,
  Minus,
  ArrowUp,
  ArrowDown,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { auth, db, firebaseConfigured } from "./firebase";

type Category = "Trabalho" | "Pessoal" | "Saúde" | "Estudo" | "Lazer" | "Outro";
type Priority = "Alta" | "Média" | "Baixa";
type View = "Dashboard" | "Dia" | "Semana" | "Inteligente" | "Academia" | "Finanças" | "Notas";
type NoteBlockType = "paragraph" | "heading" | "bullet" | "checklist" | "quote" | "divider";

interface NoteBlock {
  id: string;
  type: NoteBlockType;
  text: string;
  checked?: boolean;
}

interface PlannerNote {
  id: string;
  title: string;
  blocks: NoteBlock[];
  createdAt: string;
  updatedAt: string;
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

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
  alarmEnabled?: boolean;
  alarmSound?: boolean;
  alarmVibration?: boolean;
}

interface GymExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
}

interface GymPlan {
  id: string;
  name: string;
  day: number;
  exercises: GymExercise[];
}

type FinanceType = "Receita" | "Despesa";
type FinanceRecurrence = "Nenhuma" | "Mensal";

interface FinanceTransaction {
  id: string;
  title: string;
  type: FinanceType;
  amount: number;
  category: string;
  date: string;
  dueDate: string;
  paid: boolean;
  recurrence: FinanceRecurrence;
}

interface FinanceBudget {
  id: string;
  month: string;
  category: string;
  amount: number;
}

type NotificationPermissionState = NotificationPermission | "unsupported";

const STORAGE_KEY = "meu-planner:activities:v1";
const NOTES_STORAGE_KEY = "meu-planner:notes:v1";
const categories: Category[] = ["Trabalho", "Pessoal", "Saúde", "Estudo", "Lazer", "Outro"];
const views: { label: View; icon: typeof CalendarDays }[] = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Dia", icon: Calendar },
  { label: "Semana", icon: CalendarDays },
  { label: "Inteligente", icon: Sparkles },
  { label: "Academia", icon: Dumbbell },
  { label: "Finanças", icon: Wallet },
  { label: "Notas", icon: FileText },
];
const dayLabels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const financeCategories: Record<FinanceType, string[]> = {
  Receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  Despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Contas", "Outros"],
};

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

function isNoteBlock(value: unknown): value is NoteBlock {
  if (typeof value !== "object" || value === null) return false;
  const block = value as Record<string, unknown>;
  return typeof block.id === "string"
    && ["paragraph", "heading", "bullet", "checklist", "quote", "divider"].includes(String(block.type))
    && typeof block.text === "string"
    && (block.checked === undefined || typeof block.checked === "boolean");
}

function isPlannerNote(value: unknown): value is PlannerNote {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string"
    && typeof note.title === "string"
    && Array.isArray(note.blocks)
    && note.blocks.every(isNoteBlock)
    && typeof note.createdAt === "string"
    && typeof note.updatedAt === "string";
}

function readStoredNotes(): PlannerNote[] {
  const stored = window.localStorage.getItem(NOTES_STORAGE_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isPlannerNote)) {
    throw new Error("As notas salvas não estão em um formato válido.");
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
    && typeof task.notes === "string"
    && (task.alarmEnabled === undefined || typeof task.alarmEnabled === "boolean")
    && (task.alarmSound === undefined || typeof task.alarmSound === "boolean")
    && (task.alarmVibration === undefined || typeof task.alarmVibration === "boolean");
}

function isGymExercise(value: unknown): value is GymExercise {
  if (typeof value !== "object" || value === null) return false;
  const exercise = value as Record<string, unknown>;
  return typeof exercise.id === "string"
    && typeof exercise.name === "string"
    && typeof exercise.sets === "number"
    && Number.isInteger(exercise.sets)
    && exercise.sets > 0
    && typeof exercise.reps === "string"
    && typeof exercise.weight === "string"
    && typeof exercise.rest === "string";
}

function isGymPlan(value: unknown): value is GymPlan {
  if (typeof value !== "object" || value === null) return false;
  const plan = value as Record<string, unknown>;
  return typeof plan.id === "string"
    && typeof plan.name === "string"
    && typeof plan.day === "number"
    && Number.isInteger(plan.day)
    && plan.day >= 0
    && plan.day < 7
    && Array.isArray(plan.exercises)
    && plan.exercises.every(isGymExercise);
}

function isFinanceTransaction(value: unknown): value is FinanceTransaction {
  if (typeof value !== "object" || value === null) return false;
  const transaction = value as Record<string, unknown>;
  if (transaction.type !== "Receita" && transaction.type !== "Despesa") return false;
  return typeof transaction.id === "string"
    && typeof transaction.title === "string"
    && typeof transaction.amount === "number"
    && Number.isFinite(transaction.amount)
    && transaction.amount > 0
    && typeof transaction.category === "string"
    && financeCategories[transaction.type].includes(transaction.category)
    && isDateKey(transaction.date)
    && (transaction.dueDate === "" || isDateKey(transaction.dueDate))
    && typeof transaction.paid === "boolean"
    && ["Nenhuma", "Mensal"].includes(String(transaction.recurrence));
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isFinanceBudget(value: unknown): value is FinanceBudget {
  if (typeof value !== "object" || value === null) return false;
  const budget = value as Record<string, unknown>;
  return typeof budget.id === "string"
    && typeof budget.month === "string"
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(budget.month)
    && typeof budget.category === "string"
    && financeCategories.Despesa.includes(budget.category)
    && typeof budget.amount === "number"
    && Number.isFinite(budget.amount)
    && budget.amount > 0;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, amount: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(year, monthIndex - 1 + amount, 1);
  return monthKey(shifted);
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthIndex - 1, 1));
}

function nextMonthlyDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const nextMonth = new Date(year, month, 1);
  const lastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}min`;
}

function createGymExercise(): GymExercise {
  return { id: createId(), name: "", sets: 3, reps: "8-12", weight: "", rest: "60s" };
}

function GymPlanModal({ plan, onClose, onSave }: {
  plan: GymPlan | null;
  onClose: () => void;
  onSave: (plan: GymPlan) => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [day, setDay] = useState(plan?.day ?? new Date().getDay());
  const [exercises, setExercises] = useState<GymExercise[]>(plan?.exercises.length ? plan.exercises : [createGymExercise()]);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedExercises = exercises
      .filter((exercise) => exercise.name.trim())
      .map((exercise) => ({ ...exercise, name: exercise.name.trim() }));
    if (!name.trim()) {
      setError("Informe um nome para o treino.");
      return;
    }
    if (!cleanedExercises.length) {
      setError("Adicione pelo menos um exercício ao treino.");
      return;
    }
    onSave({ id: plan?.id ?? createId(), name: name.trim(), day, exercises: cleanedExercises });
  }

  function updateExercise(id: string, changes: Partial<Omit<GymExercise, "id">>) {
    setExercises((current) => current.map((exercise) => exercise.id === id ? { ...exercise, ...changes } : exercise));
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="activity-modal gym-modal" role="dialog" aria-modal="true" aria-labelledby="gym-modal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">PLANEJAMENTO DE TREINO</span><h2 id="gym-modal-title">{plan ? "Editar treino" : "Novo treino"}</h2></div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        </div>
        <form className="activity-form" onSubmit={submit}>
          <label className="form-field"><span>Nome do treino</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Treino A — superiores" autoFocus /></label>
          <label className="form-field"><span>Dia da semana</span><select value={day} onChange={(event) => setDay(Number(event.target.value))}>{dayLabels.map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>
          <div className="gym-exercises-heading"><strong>Exercícios</strong><button type="button" className="button button-quiet" onClick={() => setExercises((current) => [...current, createGymExercise()])}><Plus size={14} />Adicionar exercício</button></div>
          <div className="gym-exercise-fields">
            {exercises.map((exercise, index) => (
              <div className="gym-exercise-form" key={exercise.id}>
                <label className="form-field gym-exercise-name"><span>Exercício {index + 1}</span><input value={exercise.name} onChange={(event) => updateExercise(exercise.id, { name: event.target.value })} placeholder="Ex.: Supino reto" /></label>
                <label className="form-field"><span>Séries</span><input type="number" min="1" max="99" value={exercise.sets} onChange={(event) => updateExercise(exercise.id, { sets: Math.max(1, Number(event.target.value)) })} /></label>
                <label className="form-field"><span>Repetições</span><input value={exercise.reps} onChange={(event) => updateExercise(exercise.id, { reps: event.target.value })} placeholder="8-12" /></label>
                <label className="form-field"><span>Carga</span><input value={exercise.weight} onChange={(event) => updateExercise(exercise.id, { weight: event.target.value })} placeholder="Opcional" /></label>
                <label className="form-field"><span>Descanso</span><input value={exercise.rest} onChange={(event) => updateExercise(exercise.id, { rest: event.target.value })} placeholder="60s" /></label>
                {exercises.length > 1 && <button type="button" className="icon-button delete-action gym-remove-exercise" onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))} aria-label={`Remover exercício ${index + 1}`}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{plan ? "Salvar treino" : "Criar treino"}</button></div>
        </form>
      </section>
    </div>
  );
}

function FinanceTransactionModal({ transaction, onClose, onSave }: {
  transaction: FinanceTransaction | null;
  onClose: () => void;
  onSave: (transaction: FinanceTransaction) => void;
}) {
  const [title, setTitle] = useState(transaction?.title ?? "");
  const [type, setType] = useState<FinanceType>(transaction?.type ?? "Despesa");
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "");
  const [category, setCategory] = useState(transaction?.category ?? financeCategories.Despesa[0]);
  const [date, setDate] = useState(transaction?.date ?? localDateKey(new Date()));
  const [dueDate, setDueDate] = useState(transaction?.dueDate ?? "");
  const [recurrence, setRecurrence] = useState<FinanceRecurrence>(transaction?.recurrence ?? "Nenhuma");
  const [error, setError] = useState("");

  function changeType(nextType: FinanceType) {
    setType(nextType);
    if (!financeCategories[nextType].includes(category)) setCategory(financeCategories[nextType][0]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount.replace(",", "."));
    if (!title.trim()) {
      setError("Informe uma descrição para o lançamento.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    onSave({
      id: transaction?.id ?? createId(),
      title: title.trim(),
      type,
      amount: Math.round(parsedAmount * 100) / 100,
      category,
      date,
      dueDate,
      paid: transaction?.paid ?? false,
      recurrence,
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="activity-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-modal-title">
        <div className="modal-heading">
          <div><span className="eyebrow">ORGANIZAÇÃO FINANCEIRA</span><h2 id="finance-modal-title">{transaction ? "Editar lançamento" : "Novo lançamento"}</h2></div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
        </div>
        <form className="activity-form" onSubmit={submit}>
          <div className="form-row">
            <label className="form-field"><span>Tipo</span><select value={type} onChange={(event) => changeType(event.target.value as FinanceType)}><option>Despesa</option><option>Receita</option></select></label>
            <label className="form-field"><span>Valor (R$)</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label>
          </div>
          <label className="form-field"><span>Descrição</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Conta de energia" autoFocus /></label>
          <label className="form-field"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{financeCategories[type].map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="form-row">
            <label className="form-field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="form-field"><span>Vencimento (opcional)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          </div>
          <label className="form-field"><span>Recorrência</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as FinanceRecurrence)}><option>Nenhuma</option><option>Mensal</option></select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{transaction ? "Salvar alterações" : "Adicionar lançamento"}</button></div>
        </form>
      </section>
    </div>
  );
}

function FinanceBudgetPanel({ month, budgets, spending, onSave }: {
  month: string;
  budgets: FinanceBudget[];
  spending: Record<string, number>;
  onSave: (category: string, amount: number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const budgetKey = budgets.map((budget) => `${budget.category}:${budget.amount}`).join("|");

  useEffect(() => {
    setDrafts(Object.fromEntries(financeCategories.Despesa.map((category) => [
      category,
      String(budgets.find((budget) => budget.category === category)?.amount ?? ""),
    ])));
  }, [month, budgetKey]);

  return (
    <section className="panel finance-budget-panel">
      <div className="finance-section-heading"><div><span className="eyebrow">CONTROLE DO MÊS</span><h2>Limites por categoria</h2></div></div>
      <div className="finance-budget-list">{financeCategories.Despesa.map((category) => {
        const budget = budgets.find((item) => item.category === category);
        const spent = spending[category] ?? 0;
        const limit = budget?.amount ?? 0;
        const percentage = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
        return <div className="finance-budget-row" key={category}>
          <div className="finance-budget-label"><strong>{category}</strong><span>{limit ? `${formatCurrency(spent)} de ${formatCurrency(limit)}` : `${formatCurrency(spent)} gastos`}</span></div>
          <div className={`finance-budget-progress ${limit && spent > limit ? "over-budget" : ""}`}><span style={{ width: `${percentage}%` }} /></div>
          <label className="finance-budget-input"><span>Limite R$</span><input aria-label={`Limite mensal para ${category}`} type="number" min="0" step="0.01" value={drafts[category] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [category]: event.target.value }))} onBlur={() => {
            const value = Number((drafts[category] ?? "").replace(",", "."));
            if (Number.isFinite(value) && value >= 0 && value !== limit) onSave(category, Math.round(value * 100) / 100);
          }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="Sem limite" /></label>
        </div>;
      })}</div>
      <p className="finance-budget-hint">Os limites são salvos ao sair do campo. Use 0 para remover um limite.</p>
    </section>
  );
}

function requestVibration(pattern: number[]) {
  if (!("vibrate" in navigator)) return false;
  try {
    return navigator.vibrate(pattern);
  } catch (error) {
    console.error("Não foi possível iniciar a vibração do alarme.", error);
    return false;
  }
}

function createNoteBlock(type: NoteBlockType = "paragraph"): NoteBlock {
  return { id: createId(), type, text: "", ...(type === "checklist" ? { checked: false } : {}) };
}

function createNote(): PlannerNote {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "",
    blocks: [createNoteBlock()],
    createdAt: now,
    updatedAt: now,
  };
}

function formatNoteTime(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "agora";
  const todayKey = localDateKey(new Date());
  if (localDateKey(parsed) === todayKey) return formatDate(parsed, { hour: "2-digit", minute: "2-digit" });
  return formatDate(parsed, { day: "numeric", month: "short" });
}

function NoteEditor({
  note,
  onUpdate,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onMoveBlock,
  onDelete,
}: {
  note: PlannerNote;
  onUpdate: (changes: Partial<Pick<PlannerNote, "title">>) => void;
  onAddBlock: (type: NoteBlockType, afterId?: string) => string;
  onUpdateBlock: (blockId: string, changes: Partial<Pick<NoteBlock, "text" | "checked">>) => void;
  onRemoveBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  useEffect(() => {
    for (const element of Object.values(blockRefs.current)) {
      if (!element) continue;
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [note.id, note.blocks]);

  function addBlock(type: NoteBlockType) {
    const blockId = onAddBlock(type, focusedBlockId ?? note.blocks[note.blocks.length - 1]?.id);
    window.requestAnimationFrame(() => blockRefs.current[blockId]?.focus());
  }

  function handleBlockKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>, block: NoteBlock) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const blockId = onAddBlock(block.type === "divider" ? "paragraph" : block.type, block.id);
      window.requestAnimationFrame(() => blockRefs.current[blockId]?.focus());
    } else if (event.key === "Backspace" && !block.text && note.blocks.length > 1) {
      event.preventDefault();
      const currentIndex = note.blocks.findIndex((item) => item.id === block.id);
      const previousBlock = note.blocks[currentIndex - 1];
      onRemoveBlock(block.id);
      window.requestAnimationFrame(() => {
        if (previousBlock) blockRefs.current[previousBlock.id]?.focus();
      });
    }
  }

  return (
    <section className="notes-editor-panel" aria-label="Editor de notas">
      <div className="notes-editor-topbar">
        <div className="notes-breadcrumb"><FileText size={14} /><span>Minhas notas</span><ChevronRight size={13} /><strong>{note.title.trim() || "Sem título"}</strong></div>
        <div className="notes-editor-actions">
          <span className="note-save-state"><Check size={13} />Salvo automaticamente</span>
          <button className="icon-button note-delete-button" onClick={onDelete} aria-label="Excluir nota" title="Excluir nota"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="note-canvas">
        <span className="note-page-icon"><StickyNote size={25} /></span>
        <input className="note-title-input" value={note.title} onChange={(event) => onUpdate({ title: event.target.value })} placeholder="Sem título" aria-label="Título da nota" maxLength={120} />
        <div className="note-meta-line">Editado {formatNoteTime(note.updatedAt)}</div>

        <div className="note-blocks">
          {note.blocks.map((block, index) => (
            <div key={block.id} className={`note-block note-block-${block.type} ${focusedBlockId === block.id ? "is-focused" : ""}`}>
              {block.type === "divider" ? (
                <>
                  <div className="note-divider-block" role="separator" />
                  <div className="note-block-actions">
                    <button className="icon-button" onClick={() => onMoveBlock(block.id, -1)} disabled={index === 0} aria-label="Mover bloco para cima"><ArrowUp size={13} /></button>
                    <button className="icon-button" onClick={() => onMoveBlock(block.id, 1)} disabled={index === note.blocks.length - 1} aria-label="Mover bloco para baixo"><ArrowDown size={13} /></button>
                    <button className="icon-button" onClick={() => onRemoveBlock(block.id)} aria-label="Excluir divisor"><X size={13} /></button>
                  </div>
                </>
              ) : (
                <>
                  {block.type === "bullet" && <span className="note-bullet" aria-hidden="true">•</span>}
                  {block.type === "checklist" && <button className={`note-checklist-button ${block.checked ? "checked" : ""}`} aria-label={block.checked ? "Marcar item como pendente" : "Marcar item como concluído"} onClick={() => onUpdateBlock(block.id, { checked: !block.checked })}>{block.checked && <Check size={12} />}</button>}
                  {block.type === "quote" && <Quote className="note-quote-icon" size={16} aria-hidden="true" />}
                  <textarea
                    ref={(element) => { blockRefs.current[block.id] = element; }}
                    value={block.text}
                    rows={1}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId((current) => current === block.id ? null : current)}
                    onChange={(event) => {
                      onUpdateBlock(block.id, { text: event.target.value });
                      event.target.style.height = "auto";
                      event.target.style.height = `${event.target.scrollHeight}px`;
                    }}
                    onKeyDown={(event) => handleBlockKeyDown(event, block)}
                    className={block.checked ? "checked-text" : ""}
                    placeholder={block.type === "heading" ? "Título da seção" : block.type === "quote" ? "Escreva uma citação..." : index === 0 ? "Comece a escrever ou escolha um bloco abaixo..." : "Escreva algo..."}
                    aria-label={block.type === "heading" ? "Título da seção" : block.type === "checklist" ? "Item de checklist" : block.type === "bullet" ? "Item com marcador" : block.type === "quote" ? "Citação" : "Parágrafo"}
                  />
                  <div className="note-block-actions">
                    <button className="icon-button" onClick={() => onMoveBlock(block.id, -1)} disabled={index === 0} aria-label="Mover bloco para cima"><ArrowUp size={13} /></button>
                    <button className="icon-button" onClick={() => onMoveBlock(block.id, 1)} disabled={index === note.blocks.length - 1} aria-label="Mover bloco para baixo"><ArrowDown size={13} /></button>
                    <button className="icon-button" onClick={() => onRemoveBlock(block.id)} disabled={note.blocks.length === 1} aria-label="Excluir bloco"><X size={13} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="note-insert-toolbar" aria-label="Adicionar bloco">
          <span>Adicionar bloco</span>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("paragraph")} title="Parágrafo"><Plus size={14} /><span>Texto</span></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("heading")} title="Título"><Heading1 size={15} /><span>Título</span></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("bullet")} title="Lista com marcadores"><List size={15} /><span>Lista</span></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("checklist")} title="Checklist"><ListChecks size={15} /><span>Tarefa</span></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("quote")} title="Citação"><Quote size={14} /><span>Citação</span></button>
          <button onMouseDown={(event) => event.preventDefault()} onClick={() => addBlock("divider")} title="Divisor"><Minus size={15} /><span>Divisor</span></button>
        </div>
      </div>
    </section>
  );
}

function TaskForm({
  task,
  onClose,
  onSave,
  onAlarmEnable,
  onTestAlarm,
  onRequestNotifications,
  notificationPermission,
}: {
  task: PlannerTask | null;
  onClose: () => void;
  onSave: (task: PlannerTask) => void;
  onAlarmEnable: () => void;
  onTestAlarm: (sound: boolean, vibration: boolean) => void;
  onRequestNotifications: () => void;
  notificationPermission: NotificationPermissionState;
}) {
  const today = localDateKey(new Date());
  const [title, setTitle] = useState(task?.title ?? "");
  const [date, setDate] = useState(task?.date ?? today);
  const [time, setTime] = useState(task?.time ?? "09:00");
  const [duration, setDuration] = useState(String(task?.duration ?? 60));
  const [category, setCategory] = useState<Category>(task?.category ?? "Trabalho");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "Média");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [alarmEnabled, setAlarmEnabled] = useState(task?.alarmEnabled ?? false);
  const [alarmSound, setAlarmSound] = useState(task?.alarmSound ?? true);
  const [alarmVibration, setAlarmVibration] = useState(task?.alarmVibration ?? true);

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
      alarmEnabled,
      alarmSound,
      alarmVibration,
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
          <section className="alarm-settings" aria-labelledby="alarm-settings-title">
            <label className="alarm-toggle">
              <input
                type="checkbox"
                checked={alarmEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setAlarmEnabled(enabled);
                  if (enabled) onAlarmEnable();
                }}
              />
              <span className="alarm-toggle-icon"><BellRing size={17} /></span>
              <span className="alarm-toggle-copy">
                <strong id="alarm-settings-title">Lembrete no horário da atividade</strong>
                <small>Receba um aviso na hora de começar</small>
              </span>
            </label>
            {alarmEnabled && (
              <div className="alarm-options">
                <label className="alarm-option">
                  <input type="checkbox" checked={alarmSound} onChange={(event) => setAlarmSound(event.target.checked)} />
                  <Volume2 size={15} />
                  <span>Som</span>
                </label>
                <label className="alarm-option">
                  <input type="checkbox" checked={alarmVibration} onChange={(event) => setAlarmVibration(event.target.checked)} />
                  <Vibrate size={15} />
                  <span>Vibração</span>
                </label>
                <button type="button" className="test-alarm-button" onClick={() => onTestAlarm(alarmSound, alarmVibration)}>
                  Testar aviso
                </button>
                {notificationPermission === "default" && (
                  <button type="button" className="notification-permission-button" onClick={onRequestNotifications}>
                    Permitir notificações
                  </button>
                )}
                {notificationPermission === "denied" && (
                  <p className="alarm-notification-note">Notificações bloqueadas. Você pode liberá-las nas configurações do navegador.</p>
                )}
                {notificationPermission === "granted" && (
                  <span className="notification-enabled"><Check size={12} />Notificações permitidas</span>
                )}
                {notificationPermission === "unsupported" && (
                  <p className="alarm-notification-note">Este navegador não oferece notificações.</p>
                )}
                <p className="alarm-limit-note">O app precisa estar aberto para verificar o horário. Se ficar suspenso por mais de 2 minutos, o aviso pode não tocar. Notificações dependem das permissões e configurações do aparelho; com o app fechado, não há garantia.</p>
              </div>
            )}
          </section>
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
          {task.alarmEnabled && <span className="task-alarm-label"><BellRing size={12} />Alarme</span>}
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

function InstallHelpDialog({
  canInstall,
  onClose,
  onInstall,
}: {
  canInstall: boolean;
  onClose: () => void;
  onInstall: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-modal-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">SEMPRE À MÃO</span>
            <h2 id="install-modal-title">Instale o Plan-ner</h2>
            <p>Tenha um atalho no seu dispositivo e abra o app como um programa.</p>
          </div>
          <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Fechar instruções">
            <X size={19} />
          </button>
        </div>
        <div className="install-platforms">
          <article className="install-platform"><span>1</span><div><strong>Android ou computador</strong><p>{canInstall ? "Toque em Instalar agora e confirme no aviso do navegador." : "Abra o menu do navegador (⋮) e escolha “Instalar app” ou “Instalar página”."}</p></div></article>
          <article className="install-platform"><span>2</span><div><strong>iPhone ou iPad</strong><p>No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.</p></div></article>
        </div>
        <p className="install-secure-note">A instalação precisa de internet na primeira visita e de um endereço seguro (HTTPS).</p>
        <div className="form-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>Agora não</button>
          {canInstall && <button type="button" className="button button-primary" onClick={onInstall}><Download size={15} />Instalar agora</button>}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [signInPending, setSignInPending] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [notes, setNotes] = useState<PlannerNote[]>([]);
  const [gymPlans, setGymPlans] = useState<GymPlan[]>([]);
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>([]);
  const [financeBudgets, setFinanceBudgets] = useState<FinanceBudget[]>([]);
  const [activeView, setActiveView] = useState<View>("Dashboard");
  const [activeCategory, setActiveCategory] = useState<Category | "Todas">("Todas");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstallHelpOpen, setIsInstallHelpOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(
    () => "Notification" in window ? Notification.permission : "unsupported",
  );
  const [storageReady, setStorageReady] = useState(false);
  const [notesReady, setNotesReady] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [gymReady, setGymReady] = useState(false);
  const [gymError, setGymError] = useState("");
  const [editingGymPlan, setEditingGymPlan] = useState<GymPlan | null>(null);
  const [isGymFormOpen, setIsGymFormOpen] = useState(false);
  const [financeReady, setFinanceReady] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [financeMonth, setFinanceMonth] = useState(monthKey(new Date()));
  const [editingFinanceTransaction, setEditingFinanceTransaction] = useState<FinanceTransaction | null>(null);
  const [isFinanceFormOpen, setIsFinanceFormOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [storageError, setStorageError] = useState("");
  const [migrationAvailable, setMigrationAvailable] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [toast, setToast] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const firedAlarmsRef = useRef(new Set<string>());
  const syncedTasksRef = useRef<Map<string, string> | null>(null);
  const syncedNotesRef = useRef<Map<string, string> | null>(null);
  const syncedGymPlansRef = useRef<Map<string, string> | null>(null);
  const syncedFinanceTransactionsRef = useRef<Map<string, string> | null>(null);
  const syncedFinanceBudgetsRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setTasks([]);
      setNotes([]);
      setGymPlans([]);
      setFinanceTransactions([]);
      setFinanceBudgets([]);
      setStorageReady(false);
      setNotesReady(false);
      setGymReady(false);
      setFinanceReady(false);
      setStorageError("");
      setNotesError("");
      setGymError("");
      setFinanceError("");
      setMigrationAvailable(false);
      syncedTasksRef.current = null;
      syncedNotesRef.current = null;
      syncedGymPlansRef.current = null;
      syncedFinanceTransactionsRef.current = null;
      syncedFinanceBudgetsRef.current = null;
    }, (error) => {
      console.error("Não foi possível verificar a sessão do Plan-ner.", error);
      setAuthError("Não foi possível verificar seu acesso. Recarregue a página e tente novamente.");
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    setStorageReady(false);
    setNotesReady(false);
    setGymReady(false);
    setFinanceReady(false);
    let tasksLoaded = false;
    let notesLoaded = false;
    let tasksEmpty = false;
    let notesEmpty = false;

    function checkLegacyData() {
      if (!tasksLoaded || !notesLoaded || !tasksEmpty || !notesEmpty) return;
      try {
        setMigrationAvailable(readStoredTasks().length > 0 || readStoredNotes().length > 0);
      } catch (error) {
        console.error("Não foi possível verificar os dados locais antigos.", error);
        setStorageError("Há dados antigos neste dispositivo que não puderam ser verificados para importação.");
      }
    }

    const stopTasks = onSnapshot(
      collection(db, "users", user.uid, "activities"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          setStorageError("Conecte-se à internet para carregar e sincronizar suas atividades.");
          return;
        }
        const stored = snapshot.docs.map((item) => item.data());
        if (!stored.every(isPlannerTask)) {
          setStorageError("Existem atividades inválidas na nuvem. Os dados não foram carregados.");
          return;
        }
        const loadedTasks = stored as PlannerTask[];
        syncedTasksRef.current = new Map(loadedTasks.map((task) => [task.id, JSON.stringify(task)]));
        setTasks(loadedTasks);
        setStorageError("");
        tasksLoaded = true;
        tasksEmpty = snapshot.empty;
        setStorageReady(true);
        checkLegacyData();
      },
      (error) => {
        console.error("Não foi possível carregar as atividades do Firestore.", error);
        setStorageError("Não foi possível acessar suas atividades na nuvem. Confira a conexão e as regras do Firestore.");
      },
    );
    const stopNotes = onSnapshot(
      collection(db, "users", user.uid, "notes"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          setNotesError("Conecte-se à internet para carregar e sincronizar suas notas.");
          return;
        }
        const stored = snapshot.docs.map((item) => item.data());
        if (!stored.every(isPlannerNote)) {
          setNotesError("Existem notas inválidas na nuvem. As notas não foram carregadas.");
          return;
        }
        const loadedNotes = stored as PlannerNote[];
        syncedNotesRef.current = new Map(loadedNotes.map((note) => [note.id, JSON.stringify(note)]));
        setNotes(loadedNotes);
        setSelectedNoteId((current) => current && loadedNotes.some((note) => note.id === current)
          ? current
          : loadedNotes[0]?.id ?? null);
        setNotesError("");
        notesLoaded = true;
        notesEmpty = snapshot.empty;
        setNotesReady(true);
        checkLegacyData();
      },
      (error) => {
        console.error("Não foi possível carregar as notas do Firestore.", error);
        setNotesError("Não foi possível acessar suas notas na nuvem. Confira a conexão e as regras do Firestore.");
      },
    );
    const stopGymPlans = onSnapshot(
      collection(db, "users", user.uid, "gymPlans"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          setGymError("Conecte-se à internet para carregar e sincronizar seus treinos.");
          return;
        }
        const stored = snapshot.docs.map((item) => item.data());
        if (!stored.every(isGymPlan)) {
          setGymError("Existem treinos inválidos na nuvem. Os treinos não foram carregados.");
          return;
        }
        const loadedPlans = stored as GymPlan[];
        syncedGymPlansRef.current = new Map(loadedPlans.map((plan) => [plan.id, JSON.stringify(plan)]));
        setGymPlans(loadedPlans);
        setGymError("");
        setGymReady(true);
      },
      (error) => {
        console.error("Não foi possível carregar os treinos do Firestore.", error);
        setGymError("Não foi possível acessar seus treinos na nuvem. Confira a conexão e as regras do Firestore.");
      },
    );
    let transactionsLoaded = false;
    let budgetsLoaded = false;
    const updateFinanceReady = () => setFinanceReady(transactionsLoaded && budgetsLoaded);
    const stopFinanceTransactions = onSnapshot(
      collection(db, "users", user.uid, "financeTransactions"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          setFinanceError("Conecte-se à internet para carregar e sincronizar seus dados financeiros.");
          return;
        }
        const stored = snapshot.docs.map((item) => item.data());
        if (!stored.every(isFinanceTransaction)) {
          setFinanceError("Existem lançamentos financeiros inválidos na nuvem. Os dados não foram carregados.");
          return;
        }
        const loaded = stored as FinanceTransaction[];
        syncedFinanceTransactionsRef.current = new Map(loaded.map((item) => [item.id, JSON.stringify(item)]));
        setFinanceTransactions(loaded);
        transactionsLoaded = true;
        setFinanceError("");
        updateFinanceReady();
      },
      (error) => {
        console.error("Não foi possível carregar os lançamentos financeiros do Firestore.", error);
        setFinanceError("Não foi possível acessar seus dados financeiros na nuvem. Confira a conexão e as regras do Firestore.");
      },
    );
    const stopFinanceBudgets = onSnapshot(
      collection(db, "users", user.uid, "financeBudgets"),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache) {
          setFinanceError("Conecte-se à internet para carregar e sincronizar seus limites financeiros.");
          return;
        }
        const stored = snapshot.docs.map((item) => item.data());
        if (!stored.every(isFinanceBudget)) {
          setFinanceError("Existem limites financeiros inválidos na nuvem. Os dados não foram carregados.");
          return;
        }
        const loaded = stored as FinanceBudget[];
        syncedFinanceBudgetsRef.current = new Map(loaded.map((item) => [item.id, JSON.stringify(item)]));
        setFinanceBudgets(loaded);
        budgetsLoaded = true;
        setFinanceError("");
        updateFinanceReady();
      },
      (error) => {
        console.error("Não foi possível carregar os limites financeiros do Firestore.", error);
        setFinanceError("Não foi possível acessar seus limites financeiros na nuvem. Confira a conexão e as regras do Firestore.");
      },
    );

    return () => {
      stopTasks();
      stopNotes();
      stopGymPlans();
      stopFinanceTransactions();
      stopFinanceBudgets();
    };
  }, [user]);

  useEffect(() => {
    const firestore = db;
    if (!user || !firestore || !storageReady || !syncedTasksRef.current) return;
    const previous = syncedTasksRef.current;
    const current = new Map(tasks.map((task) => [task.id, JSON.stringify(task)]));
    const changes = tasks.filter((task) => previous.get(task.id) !== JSON.stringify(task));
    const removed = [...previous.keys()].filter((id) => !current.has(id));
    const writes = [
      ...changes.map((task) => setDoc(doc(firestore, "users", user.uid, "activities", task.id), task)),
      ...removed.map((id) => deleteDoc(doc(firestore, "users", user.uid, "activities", id))),
    ];
    if (!writes.length) return;
    void Promise.all(writes).then(() => {
      syncedTasksRef.current = current;
      setStorageError("");
    }).catch((error: unknown) => {
      console.error("Não foi possível sincronizar as atividades com o Firestore.", error);
      setStorageError("Não foi possível sincronizar as atividades. Suas alterações podem não ter sido salvas.");
    });
  }, [tasks, user, storageReady]);

  useEffect(() => {
    const firestore = db;
    if (!user || !firestore || !notesReady || !syncedNotesRef.current) return;
    const previous = syncedNotesRef.current;
    const current = new Map(notes.map((note) => [note.id, JSON.stringify(note)]));
    const changes = notes.filter((note) => previous.get(note.id) !== JSON.stringify(note));
    const removed = [...previous.keys()].filter((id) => !current.has(id));
    const writes = [
      ...changes.map((note) => setDoc(doc(firestore, "users", user.uid, "notes", note.id), note)),
      ...removed.map((id) => deleteDoc(doc(firestore, "users", user.uid, "notes", id))),
    ];
    if (!writes.length) return;
    void Promise.all(writes).then(() => {
      syncedNotesRef.current = current;
      setNotesError("");
    }).catch((error: unknown) => {
      console.error("Não foi possível sincronizar as notas com o Firestore.", error);
      setNotesError("Não foi possível sincronizar as notas. Suas alterações podem não ter sido salvas.");
    });
  }, [notes, user, notesReady]);

  useEffect(() => {
    const firestore = db;
    if (!user || !firestore || !gymReady || !syncedGymPlansRef.current) return;
    const previous = syncedGymPlansRef.current;
    const current = new Map(gymPlans.map((plan) => [plan.id, JSON.stringify(plan)]));
    const changes = gymPlans.filter((plan) => previous.get(plan.id) !== JSON.stringify(plan));
    const removed = [...previous.keys()].filter((id) => !current.has(id));
    const writes = [
      ...changes.map((plan) => setDoc(doc(firestore, "users", user.uid, "gymPlans", plan.id), plan)),
      ...removed.map((id) => deleteDoc(doc(firestore, "users", user.uid, "gymPlans", id))),
    ];
    if (!writes.length) return;
    void Promise.all(writes).then(() => {
      syncedGymPlansRef.current = current;
      setGymError("");
    }).catch((error: unknown) => {
      console.error("Não foi possível sincronizar os treinos com o Firestore.", error);
      setGymError("Não foi possível sincronizar os treinos. Suas alterações podem não ter sido salvas.");
    });
  }, [gymPlans, user, gymReady]);

  useEffect(() => {
    const firestore = db;
    if (!user || !firestore || !financeReady || !syncedFinanceTransactionsRef.current) return;
    const previous = syncedFinanceTransactionsRef.current;
    const current = new Map(financeTransactions.map((item) => [item.id, JSON.stringify(item)]));
    const changes = financeTransactions.filter((item) => previous.get(item.id) !== JSON.stringify(item));
    const removed = [...previous.keys()].filter((id) => !current.has(id));
    const writes = [
      ...changes.map((item) => setDoc(doc(firestore, "users", user.uid, "financeTransactions", item.id), item)),
      ...removed.map((id) => deleteDoc(doc(firestore, "users", user.uid, "financeTransactions", id))),
    ];
    if (!writes.length) return;
    void Promise.all(writes).then(() => {
      syncedFinanceTransactionsRef.current = current;
      setFinanceError("");
    }).catch((error: unknown) => {
      console.error("Não foi possível sincronizar os lançamentos financeiros com o Firestore.", error);
      setFinanceError("Não foi possível sincronizar seus lançamentos. Suas alterações podem não ter sido salvas.");
    });
  }, [financeTransactions, user, financeReady]);

  useEffect(() => {
    const firestore = db;
    if (!user || !firestore || !financeReady || !syncedFinanceBudgetsRef.current) return;
    const previous = syncedFinanceBudgetsRef.current;
    const current = new Map(financeBudgets.map((item) => [item.id, JSON.stringify(item)]));
    const changes = financeBudgets.filter((item) => previous.get(item.id) !== JSON.stringify(item));
    const removed = [...previous.keys()].filter((id) => !current.has(id));
    const writes = [
      ...changes.map((item) => setDoc(doc(firestore, "users", user.uid, "financeBudgets", item.id), item)),
      ...removed.map((id) => deleteDoc(doc(firestore, "users", user.uid, "financeBudgets", id))),
    ];
    if (!writes.length) return;
    void Promise.all(writes).then(() => {
      syncedFinanceBudgetsRef.current = current;
      setFinanceError("");
    }).catch((error: unknown) => {
      console.error("Não foi possível sincronizar os limites financeiros com o Firestore.", error);
      setFinanceError("Não foi possível sincronizar seus limites. Suas alterações podem não ter sido salvas.");
    });
  }, [financeBudgets, user, financeReady]);

  useEffect(() => {
    try {
      const storedAlarms = window.sessionStorage.getItem("meu-planner:fired-alarms:v1");
      if (storedAlarms) {
        const parsed: unknown = JSON.parse(storedAlarms);
        if (Array.isArray(parsed) && parsed.every((key) => typeof key === "string")) {
          firedAlarmsRef.current = new Set(parsed);
        }
      }
    } catch (error) {
      console.error("Não foi possível restaurar os alarmes já exibidos nesta sessão.", error);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsInstalled(true);
      setIsInstallHelpOpen(false);
      setToast("Plan-ner foi instalado.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    function checkAlarms() {
      const now = Date.now();
      for (const task of tasks) {
        if (!task.alarmEnabled || task.completed) continue;
        const alarmTime = new Date(`${task.date}T${task.time}:00`).getTime();
        const lateness = now - alarmTime;
        const alarmKey = `${task.id}:${task.date}:${task.time}`;
        if (lateness < 0 || lateness > 120_000 || firedAlarmsRef.current.has(alarmKey)) continue;

        firedAlarmsRef.current.add(alarmKey);
        try {
          window.sessionStorage.setItem("meu-planner:fired-alarms:v1", JSON.stringify([...firedAlarmsRef.current]));
        } catch (error) {
          console.error("Não foi possível salvar o registro do alarme exibido.", error);
        }
        deliverAlarm(task);
      }
    }

    checkAlarms();
    const interval = window.setInterval(checkAlarms, 5_000);
    return () => window.clearInterval(interval);
  }, [tasks, storageReady, notificationPermission]);

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
  const monthlyFinanceTransactions = useMemo(() => financeTransactions
    .filter((transaction) => transaction.date.slice(0, 7) === financeMonth)
    .sort((first, second) => (first.dueDate || first.date).localeCompare(second.dueDate || second.date)), [financeTransactions, financeMonth]);
  const monthBudgets = financeBudgets.filter((budget) => budget.month === financeMonth);
  const monthIncome = monthlyFinanceTransactions.filter((transaction) => transaction.type === "Receita").reduce((total, transaction) => total + transaction.amount, 0);
  const monthExpenses = monthlyFinanceTransactions.filter((transaction) => transaction.type === "Despesa").reduce((total, transaction) => total + transaction.amount, 0);
  const monthPaidIncome = monthlyFinanceTransactions.filter((transaction) => transaction.type === "Receita" && transaction.paid).reduce((total, transaction) => total + transaction.amount, 0);
  const monthPaidExpenses = monthlyFinanceTransactions.filter((transaction) => transaction.type === "Despesa" && transaction.paid).reduce((total, transaction) => total + transaction.amount, 0);
  const monthDueTransactions = monthlyFinanceTransactions.filter((transaction) => transaction.dueDate && !transaction.paid);
  const categorySpending = monthlyFinanceTransactions.reduce<Record<string, number>>((totals, transaction) => {
    if (transaction.type === "Despesa") totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amount;
    return totals;
  }, {});
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null;
  const visibleNotes = useMemo(() => notes
    .filter((note) => `${note.title} ${note.blocks.map((block) => block.text).join(" ")}`.toLocaleLowerCase("pt-BR").includes(noteSearch.toLocaleLowerCase("pt-BR")))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt)), [notes, noteSearch]);

  function createNewNote() {
    const note = createNote();
    setNotes((current) => [note, ...current]);
    setSelectedNoteId(note.id);
    setActiveView("Notas");
    setNoteSearch("");
  }

  function updateSelectedNote(changes: Partial<Pick<PlannerNote, "title">>) {
    if (!selectedNote) return;
    setNotes((current) => current.map((note) => note.id === selectedNote.id
      ? { ...note, ...changes, updatedAt: new Date().toISOString() }
      : note));
  }

  function addNoteBlock(type: NoteBlockType, afterId?: string) {
    if (!selectedNote) return "";
    const block = createNoteBlock(type);
    setNotes((current) => current.map((note) => {
      if (note.id !== selectedNote.id) return note;
      const blocks = [...note.blocks];
      const position = afterId ? blocks.findIndex((item) => item.id === afterId) + 1 : blocks.length;
      blocks.splice(position > 0 ? position : blocks.length, 0, block);
      return { ...note, blocks, updatedAt: new Date().toISOString() };
    }));
    return block.id;
  }

  function updateNoteBlock(blockId: string, changes: Partial<Pick<NoteBlock, "text" | "checked">>) {
    if (!selectedNote) return;
    setNotes((current) => current.map((note) => note.id === selectedNote.id
      ? {
        ...note,
        blocks: note.blocks.map((block) => block.id === blockId ? { ...block, ...changes } : block),
        updatedAt: new Date().toISOString(),
      }
      : note));
  }

  function removeNoteBlock(blockId: string) {
    if (!selectedNote) return;
    setNotes((current) => current.map((note) => {
      if (note.id !== selectedNote.id) return note;
      const blocks = note.blocks.filter((block) => block.id !== blockId);
      return {
        ...note,
        blocks: blocks.length ? blocks : [createNoteBlock()],
        updatedAt: new Date().toISOString(),
      };
    }));
  }

  function moveNoteBlock(blockId: string, direction: -1 | 1) {
    if (!selectedNote) return;
    setNotes((current) => current.map((note) => {
      if (note.id !== selectedNote.id) return note;
      const blocks = [...note.blocks];
      const index = blocks.findIndex((block) => block.id === blockId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= blocks.length) return note;
      [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
      return { ...note, blocks, updatedAt: new Date().toISOString() };
    }));
  }

  function deleteNote(note: PlannerNote) {
    if (!window.confirm(`Excluir a nota "${note.title.trim() || "Sem título"}"? Esta ação não pode ser desfeita.`)) return;
    const remaining = notes.filter((item) => item.id !== note.id);
    setNotes(remaining);
    const nextNote = remaining[0];
    setSelectedNoteId(nextNote?.id ?? null);
    setToast("Nota excluída.");
  }

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

  async function prepareAlarmAudio() {
    if (!("AudioContext" in window)) {
      return false;
    }

    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
      return audioContextRef.current.state === "running";
    } catch (error) {
      console.error("Não foi possível preparar o áudio do alarme.", error);
      return false;
    }
  }

  async function playAlarmSound() {
    const audioReady = await prepareAlarmAudio();
    const context = audioContextRef.current;
    if (!audioReady || !context || context.state !== "running") return false;

    [660, 880, 660].forEach((frequency, index) => {
      const start = context.currentTime + index * 0.25;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
    return true;
  }

  function deliverAlarm(task: PlannerTask) {
    if (task.alarmSound) void playAlarmSound();
    if (task.alarmVibration) requestVibration([250, 120, 250]);

    setToast(`Hora de começar: ${task.title}`);
    if (notificationPermission !== "granted") return;

    const notificationOptions: NotificationOptions = {
      body: `Sua atividade começa agora${task.time ? `, às ${task.time}` : ""}.`,
      icon: `${import.meta.env.BASE_URL}icons/planner-192.png`,
      tag: `meu-planner-${task.id}`,
      silent: true,
    };

    const showNotification = async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.showNotification(task.title, notificationOptions);
      } else {
        new Notification(task.title, notificationOptions);
      }
    };
    void showNotification().catch((error: unknown) => {
      console.error("Não foi possível exibir a notificação do alarme.", error);
      setToast("O alarme tocou, mas não foi possível mostrar a notificação.");
    });
  }

  async function testAlarm(sound: boolean, vibration: boolean) {
    const soundStarted = sound ? await playAlarmSound() : false;
    const vibrationStarted = vibration && requestVibration([180, 100, 180]);
    if (!sound && !vibration) {
      setToast("Ative som ou vibração para testar o alarme.");
    } else if (!sound && !vibrationStarted) {
      setToast("Este dispositivo não oferece vibração pelo navegador.");
    } else if (sound && !soundStarted && vibrationStarted) {
      setToast("A vibração funcionou, mas o som não pôde ser iniciado.");
    } else if (sound && !soundStarted) {
      setToast("O som não pôde ser iniciado. Verifique as permissões do dispositivo.");
    } else if (vibration && !vibrationStarted && soundStarted) {
      setToast("O som funcionou, mas este dispositivo não ofereceu vibração.");
    } else {
      setToast("Teste do alarme iniciado.");
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setToast("Este navegador não oferece notificações.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setToast(permission === "granted"
        ? "Notificações permitidas."
        : "Permissão não concedida. O som e a vibração continuam disponíveis com o app aberto.");
    } catch (error) {
      console.error("Não foi possível solicitar permissão para notificações.", error);
      setToast("Não foi possível solicitar permissão para notificações.");
    }
  }

  function openCreate() {
    setEditingTask(null);
    setIsFormOpen(true);
  }

  function openGymPlan(plan: GymPlan | null = null) {
    setEditingGymPlan(plan);
    setIsGymFormOpen(true);
  }

  function saveGymPlan(plan: GymPlan) {
    setGymPlans((current) => {
      const exists = current.some((item) => item.id === plan.id);
      return exists ? current.map((item) => item.id === plan.id ? plan : item) : [...current, plan];
    });
    setIsGymFormOpen(false);
    setEditingGymPlan(null);
    setToast(editingGymPlan ? "Treino atualizado com sucesso." : "Treino criado com sucesso.");
  }

  function openFinanceTransaction(transaction: FinanceTransaction | null = null) {
    setEditingFinanceTransaction(transaction);
    setIsFinanceFormOpen(true);
  }

  function saveFinanceTransaction(transaction: FinanceTransaction) {
    setFinanceTransactions((current) => {
      const exists = current.some((item) => item.id === transaction.id);
      return exists ? current.map((item) => item.id === transaction.id ? transaction : item) : [...current, transaction];
    });
    setIsFinanceFormOpen(false);
    setEditingFinanceTransaction(null);
    setToast(editingFinanceTransaction ? "Lançamento atualizado." : "Lançamento adicionado.");
  }

  function removeFinanceTransaction(transaction: FinanceTransaction) {
    if (!window.confirm(`Excluir "${transaction.title}"? Esta ação não pode ser desfeita.`)) return;
    setFinanceTransactions((current) => current.filter((item) => item.id !== transaction.id));
    setToast("Lançamento excluído.");
  }

  function toggleFinancePaid(transaction: FinanceTransaction) {
    setFinanceTransactions((current) => {
      const updated = { ...transaction, paid: !transaction.paid };
      const next = current.map((item) => item.id === transaction.id ? updated : item);
      if (transaction.paid || transaction.recurrence !== "Mensal") return next;
      const nextDate = nextMonthlyDate(transaction.date);
      const nextId = `recurring-${transaction.id}-${nextDate}`;
      if (next.some((item) => item.id === nextId)) return next;
      const nextDueDate = transaction.dueDate ? nextMonthlyDate(transaction.dueDate) : "";
      return [...next, { ...transaction, id: nextId, date: nextDate, dueDate: nextDueDate, paid: false }];
    });
    setToast(transaction.paid ? "Lançamento reaberto." : "Lançamento marcado como pago/recebido.");
  }

  function saveFinanceBudget(category: string, amount: number) {
    const id = `budget-${financeMonth}-${category.toLowerCase()}`;
    setFinanceBudgets((current) => amount === 0
      ? current.filter((budget) => budget.id !== id)
      : current.some((budget) => budget.id === id)
        ? current.map((budget) => budget.id === id ? { ...budget, amount } : budget)
        : [...current, { id, month: financeMonth, category, amount }]);
  }

  function removeGymPlan(plan: GymPlan) {
    if (!window.confirm(`Excluir o treino "${plan.name}"? Esta ação não pode ser desfeita.`)) return;
    setGymPlans((current) => current.filter((item) => item.id !== plan.id));
    setToast("Treino excluído.");
  }

  async function installApp() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setToast("Siga as instruções do navegador para concluir a instalação.");
    } catch (error) {
      console.error("Não foi possível iniciar a instalação do Plan-ner.", error);
      setToast("Não foi possível iniciar. Tente pelo menu do navegador.");
    } finally {
      setInstallPrompt(null);
      setIsInstallHelpOpen(false);
    }
  }

  function openEdit(task: PlannerTask) {
    setEditingTask(task);
    setIsFormOpen(true);
  }

  async function continueWithGoogle() {
    if (!auth) return;
    setSignInPending(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error("Não foi possível entrar com o Google.", error);
      setAuthError("Não foi possível entrar com o Google. Confira sua conexão e tente novamente.");
    } finally {
      setSignInPending(false);
    }
  }

  async function leaveAccount() {
    if (!auth) return;
    try {
      await signOut(auth);
      setAccountMenuOpen(false);
    } catch (error) {
      console.error("Não foi possível sair da conta.", error);
      setStorageError("Não foi possível sair agora. Tente novamente.");
    }
  }

  async function importLocalData() {
    if (!user || !db) return;
    let localTasks: PlannerTask[];
    let localNotes: PlannerNote[];
    try {
      localTasks = readStoredTasks();
      localNotes = readStoredNotes();
    } catch (error) {
      console.error("Não foi possível preparar a importação dos dados antigos.", error);
      setStorageError("Os dados antigos deste dispositivo não puderam ser lidos.");
      return;
    }
    if (!localTasks.length && !localNotes.length) {
      setMigrationAvailable(false);
      return;
    }
    if (!window.confirm(`Importar ${localTasks.length} atividade(s) e ${localNotes.length} nota(s) deste dispositivo para a conta ${user.email ?? "Google"}? Os dados locais serão apagados após a confirmação de envio.`)) return;

    setMigrationPending(true);
    try {
      const entries = [
        ...localTasks.map((item) => ({ collectionName: "activities", id: item.id, data: item })),
        ...localNotes.map((item) => ({ collectionName: "notes", id: item.id, data: item })),
      ];
      for (let index = 0; index < entries.length; index += 400) {
        const batch = writeBatch(db);
        for (const entry of entries.slice(index, index + 400)) {
          batch.set(doc(db, "users", user.uid, entry.collectionName, entry.id), entry.data);
        }
        await batch.commit();
      }

      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(NOTES_STORAGE_KEY);
      syncedTasksRef.current = new Map(localTasks.map((task) => [task.id, JSON.stringify(task)]));
      syncedNotesRef.current = new Map(localNotes.map((note) => [note.id, JSON.stringify(note)]));
      setTasks(localTasks);
      setNotes(localNotes);
      setSelectedNoteId(localNotes[0]?.id ?? null);
      setMigrationAvailable(false);
      setStorageError("");
      setNotesError("");
      setToast("Dados antigos importados para sua conta.");
    } catch (error) {
      console.error("Não foi possível importar os dados antigos para o Firestore.", error);
      setStorageError("A importação não foi concluída. Os dados locais foram mantidos.");
    } finally {
      setMigrationPending(false);
    }
  }

  const greetingDate = formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" });
  const greeting = getGreeting();
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));

  if (!authReady) {
    return <main className="auth-shell"><div className="auth-card"><span className="loading-spinner" />Verificando sua conta...</div></main>;
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <span className="auth-brand-mark"><CalendarDays size={23} /></span>
          <span className="eyebrow">SUA ROTINA, EM UM SÓ LUGAR</span>
          <h1>Bem-vindo ao Plan-ner</h1>
          <p className="auth-description">Entre com sua conta Google para acessar suas atividades, notas, treinos e dados financeiros com privacidade, em todos os seus dispositivos.</p>
          <div className="auth-security"><ShieldCheck size={18} /><span>Seus dados ficam separados por conta e protegidos pelas regras de acesso.</span></div>
          {!firebaseConfigured && <p className="auth-setup-message" role="alert">O acesso ainda não foi configurado. Consulte o README para conectar o projeto Firebase.</p>}
          {authError && <p className="auth-error" role="alert">{authError}</p>}
          <button className="button button-primary google-signin" onClick={() => void continueWithGoogle()} disabled={!firebaseConfigured || signInPending}>
            {signInPending ? <span className="loading-spinner" /> : <span className="google-letter" aria-hidden="true">G</span>}
            {signInPending ? "Conectando..." : "Continuar com o Google"}
          </button>
          <p className="auth-footnote">Ao continuar, você usa sua conta Google para entrar. O Plan-ner não vê sua senha.</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveView("Dashboard"); }} aria-label="Plan-ner, ir para dashboard">
          <span className="brand-mark"><CalendarDays size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Plan-ner</strong><small>Organize sua vida</small></span>
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
            {user.photoURL
              ? <img className="avatar profile-photo" src={user.photoURL} alt="" />
              : <span className="avatar">{(user.displayName || user.email || "P").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}
            <span className="profile-text"><strong>{user.displayName || "Meu espaço"}</strong><small>{user.email || "Conta Google"}</small></span>
            <button className="profile-more" onClick={() => setAccountMenuOpen((open) => !open)} aria-label="Opções da conta" aria-expanded={accountMenuOpen}><MoreHorizontal size={17} /></button>
            {accountMenuOpen && <div className="account-menu"><button onClick={() => void leaveAccount()}><LogOut size={15} />Sair da conta</button></div>}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveView("Dashboard"); }}>
            <span className="brand-mark"><CalendarDays size={20} /></span><span className="brand-copy"><strong>Plan-ner</strong></span>
          </a>
          {!isInstalled && <button className="button button-install mobile-install" onClick={() => setIsInstallHelpOpen(true)}><Download size={15} />Instalar</button>}
          <button className="icon-button mobile-account" onClick={() => void leaveAccount()} aria-label="Sair da conta"><LogOut size={16} /></button>
          <button className="button button-primary mobile-add" onClick={activeView === "Notas" ? createNewNote : activeView === "Academia" ? () => openGymPlan() : activeView === "Finanças" ? () => openFinanceTransaction() : openCreate}><Plus size={16} />{activeView === "Notas" ? "Nota" : activeView === "Academia" ? "Treino" : activeView === "Finanças" ? "Lançamento" : "Nova"}</button>
        </header>

        <div className="page-wrap">
          <header className="page-header">
            <div>
              <span className="eyebrow">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span>
              <h1>{activeView}</h1>
              <p>{activeView === "Dashboard" ? "Visão geral das suas atividades" : activeView === "Inteligente" ? "Ideias práticas para uma rotina mais leve" : activeView === "Semana" ? "Uma visão clara da sua semana" : activeView === "Academia" ? "Organize seus treinos e acompanhe seus exercícios" : activeView === "Finanças" ? "Acompanhe receitas, despesas e vencimentos" : activeView === "Notas" ? "Anote ideias, organize pensamentos e planeje seus projetos" : "Organize suas atividades do dia"}</p>
            </div>
            <div className="page-header-actions">
              {!isInstalled && <button className="button button-install desktop-install" onClick={() => setIsInstallHelpOpen(true)}><Download size={16} />Instalar app</button>}
              {activeView === "Finanças"
                ? <button className="button button-primary desktop-add" onClick={() => openFinanceTransaction()}><Plus size={18} strokeWidth={2.5} />Novo lançamento</button>
                : activeView === "Academia"
                ? <button className="button button-primary desktop-add" onClick={() => openGymPlan()}><Plus size={18} strokeWidth={2.5} />Novo treino</button>
                : activeView === "Notas"
                ? <button className="button button-primary desktop-add" onClick={createNewNote}><Plus size={18} strokeWidth={2.5} />Nova nota</button>
                : <button className="button button-primary desktop-add" onClick={openCreate}><Plus size={18} strokeWidth={2.5} />Nova atividade</button>}
            </div>
          </header>

          {migrationAvailable && <div className="migration-banner">
            <p>Encontramos atividades e notas antigas salvas neste dispositivo. Você pode importá-las para sua conta Google; os dados locais serão removidos após o envio.</p>
            <button className="button button-primary" disabled={migrationPending} onClick={() => void importLocalData()}>{migrationPending ? "Importando..." : "Importar dados"}</button>
          </div>}
          {storageError && <div role="alert" className="storage-alert"><span>{storageError}</span></div>}

          {!storageReady ? (
            <div className="loading-state"><span className="loading-spinner" />Carregando suas atividades...</div>
          ) : (
            <>
              {activeView !== "Notas" && activeView !== "Academia" && activeView !== "Finanças" && <div className="mobile-categories" aria-label="Filtrar atividades por categoria">
                <button className={activeCategory === "Todas" ? "selected" : ""} onClick={() => setActiveCategory("Todas")}>Todas</button>
                {categories.map((category) => <button key={category} className={activeCategory === category ? `selected ${categoryClass[category]}` : categoryClass[category]} onClick={() => setActiveCategory(category)}><i />{category}</button>)}
              </div>}
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

              {activeView === "Academia" && (
                <section className="gym-view">
                  <div className="gym-intro panel">
                    <span className="gym-intro-icon"><Dumbbell size={22} /></span>
                    <div><span className="eyebrow">SEU PLANO DE TREINO</span><h2>Treine no seu ritmo.</h2><p>Organize seus exercícios por dia, com séries, repetições, carga e descanso.</p></div>
                    <button className="button button-primary gym-intro-add" onClick={() => openGymPlan()}><Plus size={16} />Novo treino</button>
                  </div>
                  {gymError && <div className="storage-alert" role="alert">{gymError}</div>}
                  {!gymReady ? <div className="loading-state"><span className="loading-spinner" />Carregando seus treinos...</div> : gymPlans.length === 0 ? (
                    <div className="panel gym-empty">
                      <span className="gym-empty-icon"><Dumbbell size={25} /></span>
                      <h3>Seu próximo treino começa aqui.</h3>
                      <p>Crie sua rotina e organize os exercícios da semana.</p>
                      <button className="button button-primary" onClick={() => openGymPlan()}><Plus size={16} />Criar primeiro treino</button>
                    </div>
                  ) : (
                    <div className="gym-week-grid">
                      {dayLabels.map((day, dayIndex) => {
                        const dayPlans = gymPlans.filter((plan) => plan.day === dayIndex);
                        return <section className="gym-day-column" key={day}>
                          <div className="gym-day-heading"><h3>{day}</h3><span>{dayPlans.length}</span></div>
                          {dayPlans.length ? dayPlans.map((plan) => (
                            <article className="panel gym-plan-card" key={plan.id}>
                              <div className="gym-plan-heading">
                                <h4>{plan.name}</h4>
                                <div><button className="icon-button" onClick={() => openGymPlan(plan)} aria-label={`Editar ${plan.name}`}><Edit2 size={15} /></button><button className="icon-button delete-action" onClick={() => removeGymPlan(plan)} aria-label={`Excluir ${plan.name}`}><Trash2 size={15} /></button></div>
                              </div>
                              <ul className="gym-exercise-list">{plan.exercises.map((exercise) => (
                                <li key={exercise.id}>
                                  <strong>{exercise.name}</strong>
                                  <span>{exercise.sets} séries × {exercise.reps} repetições{exercise.weight ? ` · ${exercise.weight}` : ""}</span>
                                  {exercise.rest && <small><Clock3 size={12} />Descanso: {exercise.rest}</small>}
                                </li>
                              ))}</ul>
                            </article>
                          )) : <p className="gym-day-empty">Sem treino planejado</p>}
                        </section>;
                      })}
                    </div>
                  )}
                </section>
              )}

              {activeView === "Finanças" && (
                <section className="finance-view">
                  <div className="finance-month-toolbar">
                    <button className="icon-button" onClick={() => setFinanceMonth((month) => shiftMonth(month, -1))} aria-label="Mês anterior"><ChevronLeft size={19} /></button>
                    <h2>{formatMonth(financeMonth)}</h2>
                    <button className="icon-button" onClick={() => setFinanceMonth((month) => shiftMonth(month, 1))} aria-label="Próximo mês"><ChevronRight size={19} /></button>
                    {financeMonth !== monthKey(new Date()) && <button className="button button-quiet finance-current-month" onClick={() => setFinanceMonth(monthKey(new Date()))}>Este mês</button>}
                  </div>
                  {financeError && <div className="storage-alert" role="alert">{financeError}</div>}
                  {!financeReady ? <div className="loading-state"><span className="loading-spinner" />Carregando suas finanças...</div> : (
                    <>
                      <div className="finance-summary-grid">
                        <article className="panel finance-summary-card income-card"><span>Receitas previstas</span><strong>{formatCurrency(monthIncome)}</strong><small>{formatCurrency(monthPaidIncome)} recebidas</small></article>
                        <article className="panel finance-summary-card expense-card"><span>Despesas previstas</span><strong>{formatCurrency(monthExpenses)}</strong><small>{formatCurrency(monthPaidExpenses)} pagas</small></article>
                        <article className={`panel finance-summary-card balance-card ${monthIncome - monthExpenses < 0 ? "negative" : ""}`}><span>Saldo previsto</span><strong>{formatCurrency(monthIncome - monthExpenses)}</strong><small>Saldo realizado: {formatCurrency(monthPaidIncome - monthPaidExpenses)}</small></article>
                        <article className="panel finance-summary-card due-card"><span>Contas em aberto</span><strong>{monthDueTransactions.length}</strong><small>{monthDueTransactions.filter((item) => item.dueDate < today).length} vencida(s)</small></article>
                      </div>
                      <div className="finance-layout">
                        <section className="panel finance-transactions">
                          <div className="finance-section-heading">
                            <div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Lançamentos do mês</h2></div>
                            <button className="button button-primary" onClick={() => openFinanceTransaction()}><Plus size={15} />Adicionar</button>
                          </div>
                          {monthlyFinanceTransactions.length ? <div className="finance-transaction-list">{monthlyFinanceTransactions.map((transaction) => (
                            <article className="finance-transaction-row" key={transaction.id}>
                              <span className={`finance-transaction-icon ${transaction.type === "Receita" ? "income" : "expense"}`}>{transaction.type === "Receita" ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}</span>
                              <div className="finance-transaction-copy"><strong>{transaction.title}</strong><span>{transaction.category} · {formatDate(new Date(`${transaction.date}T12:00:00`), { day: "numeric", month: "short" })}{transaction.recurrence === "Mensal" && <span className="finance-recurring">Mensal</span>}</span>{transaction.dueDate && <small>Vencimento: {formatDate(new Date(`${transaction.dueDate}T12:00:00`), { day: "numeric", month: "short" })}</small>}</div>
                              <strong className={`finance-transaction-amount ${transaction.type === "Receita" ? "income" : "expense"}`}>{transaction.type === "Receita" ? "+" : "−"} {formatCurrency(transaction.amount)}</strong>
                              <span className={`finance-paid-state ${transaction.paid ? "paid" : transaction.dueDate && transaction.dueDate < today ? "late" : "pending"}`}>{transaction.paid ? transaction.type === "Receita" ? "Recebida" : "Paga" : transaction.dueDate && transaction.dueDate < today ? "Vencida" : "Em aberto"}</span>
                              <div className="finance-transaction-actions">
                                <button className="icon-button" onClick={() => toggleFinancePaid(transaction)} aria-label={transaction.paid ? "Reabrir lançamento" : "Marcar como pago ou recebido"} title={transaction.paid ? "Reabrir" : "Marcar como pago/recebido"}><Check size={15} /></button>
                                <button className="icon-button" onClick={() => openFinanceTransaction(transaction)} aria-label={`Editar ${transaction.title}`}><Edit2 size={14} /></button>
                                <button className="icon-button delete-action" onClick={() => removeFinanceTransaction(transaction)} aria-label={`Excluir ${transaction.title}`}><Trash2 size={14} /></button>
                              </div>
                            </article>
                          ))}</div> : <div className="finance-empty"><Wallet size={23} /><strong>Nenhum lançamento neste mês.</strong><span>Adicione uma receita ou despesa para começar.</span><button className="button button-primary" onClick={() => openFinanceTransaction()}><Plus size={15} />Adicionar lançamento</button></div>}
                        </section>
                        <FinanceBudgetPanel month={financeMonth} budgets={monthBudgets} spending={categorySpending} onSave={saveFinanceBudget} />
                      </div>
                    </>
                  )}
                </section>
              )}

              {activeView === "Notas" && (
                <section className="notes-workspace">
                  <aside className="notes-list-panel" aria-label="Lista de notas">
                    <div className="notes-list-heading">
                      <div><span className="eyebrow">ESPAÇO PESSOAL</span><h2>Minhas notas</h2></div>
                      <button className="icon-button note-add-button" onClick={createNewNote} aria-label="Criar nova nota" title="Criar nova nota"><Plus size={17} /></button>
                    </div>
                    <label className="notes-search">
                      <Search size={15} />
                      <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Buscar nas notas..." aria-label="Buscar nas notas" />
                      {noteSearch && <button onClick={() => setNoteSearch("")} aria-label="Limpar busca"><X size={13} /></button>}
                    </label>
                    <div className="notes-list">
                      {!notesReady ? (
                        <div className="notes-list-empty">Carregando notas...</div>
                      ) : notesError ? (
                        <div className="notes-list-error" role="alert">{notesError}</div>
                      ) : visibleNotes.length ? visibleNotes.map((note) => (
                        <button key={note.id} className={`note-list-item ${selectedNote?.id === note.id ? "selected" : ""}`} onClick={() => setSelectedNoteId(note.id)}>
                          <FileText size={16} />
                          <span><strong>{note.title.trim() || "Sem título"}</strong><small>{formatNoteTime(note.updatedAt)}</small></span>
                          <ChevronRight size={14} className="note-list-chevron" />
                        </button>
                      )) : (
                        <div className="notes-list-empty">{noteSearch ? "Nenhuma nota encontrada." : "Suas notas aparecerão aqui."}</div>
                      )}
                    </div>
                    <div className="notes-list-footer"><FileText size={13} />{notes.length} {notes.length === 1 ? "nota salva" : "notas salvas"} na sua conta</div>
                  </aside>
                  {notesError ? (
                    <div className="notes-empty-canvas" role="alert"><FileText size={25} /><h2>Notas indisponíveis</h2><p>{notesError}</p></div>
                  ) : selectedNote ? (
                    <NoteEditor
                      key={selectedNote.id}
                      note={selectedNote}
                      onUpdate={updateSelectedNote}
                      onAddBlock={addNoteBlock}
                      onUpdateBlock={updateNoteBlock}
                      onRemoveBlock={removeNoteBlock}
                      onMoveBlock={moveNoteBlock}
                      onDelete={() => deleteNote(selectedNote)}
                    />
                  ) : (
                    <div className="notes-empty-canvas">
                      <span className="notes-empty-icon"><FileText size={26} /></span>
                      <h2>Um lugar para suas ideias.</h2>
                      <p>Crie uma nota para começar a escrever seus pensamentos, listas e planos.</p>
                      <button className="button button-primary" onClick={createNewNote}><Plus size={16} />Criar minha primeira nota</button>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            {activeView === "Dashboard" && <><span>Feito para deixar sua rotina mais leve.</span><span className="footer-date"><span />Dados na sua conta</span></>}
            <span className="footer-credit">Desenvolvido por Gleydes Oliveira</span>
          </footer>
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação móvel">
        {views.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveView(label)} className={activeView === label ? "active" : ""} aria-label={label}><Icon size={19} /><span>{label === "Inteligente" ? "Smart" : label}</span></button>)}
      </nav>

      {isFormOpen && <TaskForm
        task={editingTask}
        onClose={() => { setIsFormOpen(false); setEditingTask(null); }}
        onSave={saveTask}
        onAlarmEnable={() => { void prepareAlarmAudio(); }}
        onTestAlarm={testAlarm}
        onRequestNotifications={() => { void requestNotifications(); }}
        notificationPermission={notificationPermission}
      />}
      {isGymFormOpen && <GymPlanModal
        key={editingGymPlan?.id ?? "new-gym-plan"}
        plan={editingGymPlan}
        onClose={() => { setIsGymFormOpen(false); setEditingGymPlan(null); }}
        onSave={saveGymPlan}
      />}
      {isFinanceFormOpen && <FinanceTransactionModal
        key={editingFinanceTransaction?.id ?? "new-finance-transaction"}
        transaction={editingFinanceTransaction}
        onClose={() => { setIsFinanceFormOpen(false); setEditingFinanceTransaction(null); }}
        onSave={saveFinanceTransaction}
      />}
      {isInstallHelpOpen && <InstallHelpDialog canInstall={installPrompt !== null} onClose={() => setIsInstallHelpOpen(false)} onInstall={installApp} />}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}
