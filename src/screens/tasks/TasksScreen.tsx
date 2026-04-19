import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Check,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Star,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FAB_SCROLL_PADDING_BOTTOM,
  FloatingAddButton,
} from "../../components/FloatingAddButton";
import { useActiveHouseId } from "../../hooks/useActiveHouseId";
import { shadowSm } from "../../lib/nativeShadow";
import {
  addHouseTask,
  canCurrentUserUncompleteTask,
  deleteHouseTask,
  setTaskCompleted,
  subscribeHouseTasks,
  subscribeMemberPoints,
  updateHouseTask,
  type HouseTaskRow,
  type TaskPriority,
} from "../../lib/dashboardService";
import { endOfDayMs, startOfDayMs } from "../../lib/fridgeService";
import {
  countPendingHoje,
  filterTasksForTab,
  type TaskTab,
} from "../../lib/taskTabFilters";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";

const PRIMARY = "#2D5AF0";
const NAVY = "#0f172a";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "ALTA PRIORIDADE",
  medium: "MÉDIA",
  low: "BAIXA",
};

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; text: string }> = {
  high: { bg: "bg-red-100", text: "text-red-700" },
  medium: { bg: "bg-amber-100", text: "text-amber-800" },
  low: { bg: "bg-sky-100", text: "text-sky-800" },
};

const FREQ_OPTIONS = ["Diário", "Semanal", "Uma vez"];

function isSameDayMs(a: number, b: number): boolean {
  return startOfDayMs(a) === startOfDayMs(b);
}

function formatHace(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return "Agora há pouco";
  if (m < 60) return `Há ${m} min`;
  if (h < 24) return `Há ${h} ${h === 1 ? "hora" : "horas"}`;
  if (d < 7) return `Há ${d} ${d === 1 ? "dia" : "dias"}`;
  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function effectivePriority(t: HouseTaskRow): TaskPriority {
  return t.priority ?? "medium";
}

export function TasksScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { houseId, loading: houseLoading } = useActiveHouseId();
  const [tasks, setTasks] = useState<HouseTaskRow[]>([]);
  const [points, setPoints] = useState(0);
  const [tab, setTab] = useState<TaskTab>("hoje");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HouseTaskRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formPoints, setFormPoints] = useState("10");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formMinutes, setFormMinutes] = useState("20");
  const [formFreq, setFormFreq] = useState("Semanal");
  const [formDue, setFormDue] = useState(() => {
    const d = new Date();
    return d;
  });

  useEffect(() => {
    if (!houseId) return;
    const u1 = subscribeHouseTasks(houseId, setTasks);
    const u2 = user ? subscribeMemberPoints(houseId, user.uid, setPoints) : () => {};
    return () => {
      u1();
      u2();
    };
  }, [houseId, user]);

  const q = query.trim().toLowerCase();

  const filteredByTab = useMemo(
    () => filterTasksForTab(tasks, tab),
    [tasks, tab]
  );

  const visiblePending = useMemo(() => {
    if (!q) return filteredByTab;
    return filteredByTab.filter((t) => t.title.toLowerCase().includes(q));
  }, [filteredByTab, q]);

  const pendingHojeCount = useMemo(() => countPendingHoje(tasks), [tasks]);

  const completedToday = useMemo(() => {
    const now = Date.now();
    return tasks.filter(
      (t) =>
        t.completed &&
        t.completedAt != null &&
        isSameDayMs(t.completedAt, now)
    );
  }, [tasks]);

  const history = useMemo(() => {
    const now = Date.now();
    return [...tasks]
      .filter(
        (t) =>
          t.completed &&
          t.completedAt != null &&
          !isSameDayMs(t.completedAt, now)
      )
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 12);
  }, [tasks]);

  const openNew = useCallback(() => {
    setEditing(null);
    setFormTitle("");
    setFormAssignee(user?.displayName ?? user?.email?.split("@")[0] ?? "Família");
    setFormPoints("10");
    setFormPriority("medium");
    setFormMinutes("20");
    setFormFreq("Semanal");
    setFormDue(new Date());
    setShowDate(false);
    setModalOpen(true);
  }, [user]);

  const openEdit = useCallback((t: HouseTaskRow) => {
    setEditing(t);
    setFormTitle(t.title);
    setFormAssignee(t.assigneeName);
    setFormPoints(String(t.points));
    setFormPriority(effectivePriority(t));
    setFormMinutes(String(t.estimatedMinutes ?? 20));
    setFormFreq(t.frequencyLabel ?? "Semanal");
    setFormDue(new Date(t.dueDate ?? Date.now()));
    setShowDate(false);
    setModalOpen(true);
  }, []);

  const handleSave = async () => {
    if (!houseId) return;
    const title = formTitle.trim();
    if (!title) {
      showToast({ type: "error", title: "Título", message: "Informe o nome da tarefa." });
      return;
    }
    const pts = Math.max(0, parseInt(formPoints, 10) || 0);
    const mins = Math.max(1, parseInt(formMinutes, 10) || 15);
    const due = endOfDayMs(formDue.getTime());
    setSaving(true);
    try {
      if (editing) {
        await updateHouseTask(houseId, editing.id, {
          title,
          assigneeName: formAssignee.trim() || "—",
          points: pts,
          priority: formPriority,
          estimatedMinutes: mins,
          frequencyLabel: formFreq,
          dueDate: due,
        });
        showToast({ type: "success", title: "Atualizado", message: title });
      } else {
        await addHouseTask(houseId, {
          title,
          assigneeName: formAssignee.trim() || "—",
          points: pts,
          priority: formPriority,
          estimatedMinutes: mins,
          frequencyLabel: formFreq,
          dueDate: due,
        });
        showToast({ type: "success", title: "Tarefa criada", message: title });
      }
      setModalOpen(false);
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (t: HouseTaskRow) => {
    if (!houseId || !user) return;
    const next = !t.completed;
    if (!next) {
      if (!canCurrentUserUncompleteTask(t, user.uid)) {
        showToast({
          type: "error",
          title: "Não é possível desmarcar",
          message: t.completedByUid
            ? "Só quem concluiu pode desmarcar."
            : "Tarefas concluídas antes desta atualização não podem ser desmarcadas.",
        });
        return;
      }
    }
    try {
      await setTaskCompleted(
        houseId,
        t.id,
        next,
        next
          ? {
              uid: user.uid,
              memberPointsDelta: t.points,
              completedByName:
                user.displayName ?? user.email?.split("@")[0] ?? "Membro",
            }
          : { uid: user.uid }
      );
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onDelete = (t: HouseTaskRow) => {
    if (!houseId) return;
    Alert.alert("Excluir tarefa", `Remover "${t.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteHouseTask(houseId, t.id);
            setModalOpen(false);
            showToast({ type: "info", title: "Removida", message: t.title });
          } catch (e) {
            showToast({
              type: "error",
              title: "Erro",
              message: e instanceof Error ? e.message : String(e),
            });
          }
        },
      },
    ]);
  };

  if (houseLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={["top"]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!houseId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-8" edges={["top"]}>
        <Text className="text-center text-base text-slate-600">
          Nenhuma casa ativa. Conclua o onboarding para ver tarefas.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className="border-b border-slate-100 px-5 pb-3 pt-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-2xl font-bold tracking-tight text-slate-900">TAREFAS</Text>
            <Text className="mt-1 text-sm text-slate-500">
              {pendingHojeCount}{" "}
              {pendingHojeCount === 1 ? "tarefa pendente hoje" : "tarefas pendentes hoje"}
            </Text>
          </View>
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ backgroundColor: `${PRIMARY}22` }}
          >
            <Star size={16} color={PRIMARY} fill={PRIMARY} />
            <Text className="text-sm font-bold" style={{ color: PRIMARY }}>
              {points} pts
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <View className="flex-row gap-2">
            {(["A", "B", "C"] as const).map((x, i) => (
              <View
                key={i}
                className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100"
              >
                <Text className="text-xs font-bold text-slate-600">{x}</Text>
              </View>
            ))}
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() =>
                showToast({ type: "info", title: "Filtros", message: "Em breve." })
              }
              className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white"
            >
              <Filter size={20} color="#64748b" />
            </Pressable>
            <View className="h-10 flex-1 max-w-[140px] flex-row items-center rounded-full border border-slate-200 bg-[#f8fafc] px-3">
              <Search size={18} color="#94a3b8" />
              <TextInput
                className="ml-2 flex-1 py-2 text-sm text-slate-900"
                placeholder="Buscar..."
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
              />
            </View>
          </View>
        </View>

        <View className="mt-5 flex-row border-b border-slate-100">
          {(
            [
              ["hoje", "HOJE"],
              ["semana", "ESTA SEMANA"],
              ["pendentes", "PENDENTES"],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                className="mr-6 pb-3"
                style={
                  active
                    ? { borderBottomWidth: 3, borderBottomColor: NAVY }
                    : { borderBottomWidth: 3, borderBottomColor: "transparent" }
                }
              >
                <Text
                  className={`text-xs font-bold tracking-wide ${
                    active ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-[#f8fafc] px-5 pt-4"
        contentContainerStyle={{ paddingBottom: FAB_SCROLL_PADDING_BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        {visiblePending.length > 0 ? (
          <View className="mb-6 gap-3">
            {visiblePending.map((t) => (
              <TaskCard key={t.id} task={t} onToggle={() => toggleComplete(t)} onPress={() => openEdit(t)} />
            ))}
          </View>
        ) : (
          <View className="mb-6 items-center rounded-2xl border border-dashed border-slate-200 bg-white py-12">
            <Text className="text-center text-sm text-slate-500">
              Nenhuma tarefa neste período.
            </Text>
          </View>
        )}

        {completedToday.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-teal-600">
              ✓ Concluídas hoje
            </Text>
            <View className="gap-2">
              {completedToday.map((t) => {
                const canUnmark = user ? canCurrentUserUncompleteTask(t, user.uid) : false;
                return (
                <View
                  key={t.id}
                  className="rounded-2xl border border-teal-100 bg-white px-4 py-3"
                  style={shadowSm}
                >
                  <View className="flex-row items-start gap-3">
                    {canUnmark ? (
                      <Pressable onPress={() => toggleComplete(t)} hitSlop={8}>
                        <View className="h-6 w-6 items-center justify-center rounded-md border-2 border-emerald-500 bg-emerald-500">
                          <Check size={14} color="#fff" strokeWidth={3} />
                        </View>
                      </Pressable>
                    ) : (
                      <View className="h-6 w-6 items-center justify-center rounded-md border-2 border-slate-200 bg-slate-100">
                        <Check size={14} color="#94a3b8" strokeWidth={3} />
                      </View>
                    )}
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-slate-400 line-through">{t.title}</Text>
                      <Text className="mt-1 text-xs text-slate-500">{t.assigneeName}</Text>
                      <Text className="mt-1 text-xs font-semibold text-emerald-600">
                        +{t.points} pts ganhos
                      </Text>
                    </View>
                  </View>
                </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {history.length > 0 ? (
          <View className="mb-8">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              Histórico
            </Text>
            <View className="gap-3">
              {history.map((t) => (
                <View key={`${t.id}-h`} className="border-l-2 border-slate-200 pl-3">
                  <Text className="text-sm text-slate-700">
                    <Text className="font-semibold">{t.completedByName ?? "Alguém"}</Text> concluiu{" "}
                    <Text className="font-medium">{t.title}</Text>
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-400">
                    {t.completedAt != null ? formatHace(t.completedAt) : ""} · +{t.points} pts
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <FloatingAddButton onPress={openNew} />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="max-h-[90%] rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <Text className="text-xl font-bold" style={{ color: NAVY }}>
              {editing ? "Editar tarefa" : "Nova tarefa"}
            </Text>
            <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
              <Text className="mb-1 text-sm font-medium text-slate-700">Título</Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="Ex.: Lavar banheiros"
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">Responsável</Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                value={formAssignee}
                onChangeText={setFormAssignee}
              />
              <View className="mb-3 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">Pontos</Text>
                  <TextInput
                    className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                    keyboardType="number-pad"
                    value={formPoints}
                    onChangeText={setFormPoints}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">Minutos</Text>
                  <TextInput
                    className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                    keyboardType="number-pad"
                    value={formMinutes}
                    onChangeText={setFormMinutes}
                  />
                </View>
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">Prioridade</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setFormPriority(p)}
                    className={`rounded-full px-3 py-2 ${
                      formPriority === p ? "" : "border border-slate-200 bg-white"
                    }`}
                    style={formPriority === p ? { backgroundColor: NAVY } : undefined}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        formPriority === p ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {PRIORITY_LABEL[p]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">Frequência</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {FREQ_OPTIONS.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => setFormFreq(f)}
                    className={`rounded-full px-3 py-2 ${
                      formFreq === f ? "" : "border border-slate-200 bg-white"
                    }`}
                    style={formFreq === f ? { backgroundColor: NAVY } : undefined}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        formFreq === f ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">Prazo (dia)</Text>
              <Pressable
                onPress={() => setShowDate(true)}
                className="mb-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5"
              >
                <Text className="text-base text-slate-900">
                  {formDue.toLocaleDateString("pt-BR")}
                </Text>
              </Pressable>
              {showDate ? (
                <>
                  <DateTimePicker
                    value={formDue}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, d) => {
                      if (Platform.OS === "android") setShowDate(false);
                      if (d) setFormDue(d);
                    }}
                  />
                  {Platform.OS === "ios" ? (
                    <Pressable onPress={() => setShowDate(false)} className="mt-2 self-end py-2">
                      <Text className="font-semibold" style={{ color: PRIMARY }}>
                        OK
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            {editing ? (
              <Pressable className="mb-3 items-center py-2" onPress={() => onDelete(editing)}>
                <Text className="font-semibold text-red-600">Excluir tarefa</Text>
              </Pressable>
            ) : null}
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-2xl border border-slate-200 py-4"
                onPress={() => setModalOpen(false)}
              >
                <Text className="font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl py-4"
                style={{ backgroundColor: PRIMARY }}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function TaskCard({
  task,
  onToggle,
  onPress,
}: {
  task: HouseTaskRow;
  onToggle: () => void;
  onPress: () => void;
}) {
  const pr = effectivePriority(task);
  const st = PRIORITY_STYLE[pr];
  const mins = task.estimatedMinutes ?? 20;
  const freq = task.frequencyLabel ?? "Semanal";
  const initial = (task.assigneeName || "?").charAt(0).toUpperCase();
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4" style={shadowSm}>
      <View className="flex-row items-start gap-3">
        <Pressable onPress={onToggle} hitSlop={8} className="pt-0.5">
          <View className="h-6 w-6 items-center justify-center rounded-md border-2 border-slate-300 bg-white" />
        </Pressable>
        <Pressable onPress={onPress} className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className={`rounded-full px-2 py-0.5 ${st.bg}`}>
              <Text className={`text-[10px] font-bold ${st.text}`}>{PRIORITY_LABEL[pr]}</Text>
            </View>
            <View className="flex-row items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
              <Clock size={12} color="#64748b" />
              <Text className="text-[10px] font-semibold text-slate-600">{mins} min</Text>
            </View>
          </View>
          <Text className="mt-2 text-base font-bold text-slate-900">{task.title}</Text>
          <View className="mt-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-slate-200">
                <Text className="text-[10px] font-bold text-slate-600">{initial}</Text>
              </View>
              <Text className="text-sm text-slate-600">{task.assigneeName}</Text>
              <View className="flex-row items-center gap-1">
                <RefreshCw size={12} color="#94a3b8" />
                <Text className="text-xs text-slate-500">{freq}</Text>
              </View>
            </View>
            <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${PRIMARY}18` }}>
              <Text className="text-xs font-bold" style={{ color: PRIMARY }}>
                +{task.points} pts
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
