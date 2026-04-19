import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation } from "@tanstack/react-query";
import {
  Bell,
  Beef,
  Carrot,
  CheckSquare,
  Cookie,
  CupSoda,
  ListTodo,
  Milk,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Snowflake,
  Star,
  UserPlus,
  UtensilsCrossed,
  Wheat,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AuthedStackParamList } from "../navigation/AuthenticatedNavigator";
import type { MainTabParamList } from "../navigation/MainTabNavigator";
import { shadowSm } from "../lib/nativeShadow";
import { signOutUser } from "../lib/auth";
import {
  canCurrentUserUncompleteTask,
  getLevelFromPoints,
  setTaskCompleted,
  subscribeHouseStats,
  subscribeHouseTasks,
  subscribeMemberPoints,
  type HouseStats,
  type HouseTaskRow,
} from "../lib/dashboardService";
import {
  getExpiryBadgeLabel,
  getExpiryStatus,
  subscribeFridgeItems,
  type FridgeCategory,
  type FridgeItemRow,
} from "../lib/fridgeService";
import {
  subscribeReadyMeals,
  type ReadyMealRow,
} from "../lib/readyMealsService";
import { isRealtimeDatabaseConfigured } from "../lib/firebase";
import {
  approvePendingJoinRequest,
  getHouseNameForUser,
  rejectPendingJoinRequest,
  subscribeHousePendingJoinRequests,
  subscribeHouseSummary,
  type HouseSummary,
  type PendingJoinRequestRow,
} from "../lib/houseService";
import { useActiveHouseId } from "../hooks/useActiveHouseId";
import { useAuth } from "../providers/AuthProvider";
import { useToast } from "../providers/ToastProvider";

const PRIMARY = "#2D5AF0";

function ItemPreviewIcon({ cat }: { cat: FridgeCategory }) {
  const c = PRIMARY;
  switch (cat) {
    case "laticinios":
      return <Milk size={22} color={c} />;
    case "vegetais":
      return <Carrot size={22} color="#ea580c" />;
    case "congelados":
      return <Snowflake size={22} color={c} />;
    case "carnes":
      return <Beef size={22} color="#b91c1c" />;
    case "graos":
      return <Wheat size={22} color="#a16207" />;
    case "bebidas":
      return <CupSoda size={22} color="#0369a1" />;
    case "doces_snacks":
      return <Cookie size={22} color="#c2410c" />;
    default:
      return <Package size={22} color="#64748b" />;
  }
}

function BadgeFridge({
  label,
  tone,
}: {
  label: string;
  tone: "red" | "orange" | "blue";
}) {
  const bg =
    tone === "red"
      ? "bg-red-100"
      : tone === "orange"
        ? "bg-orange-100"
        : "bg-blue-100";
  const text =
    tone === "red"
      ? "text-red-700"
      : tone === "orange"
        ? "text-orange-700"
        : "text-blue-700";
  return (
    <View className={`rounded-full px-2.5 py-1 ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{label}</Text>
    </View>
  );
}

function badgeToneFromExpiry(expiryDate: number): "red" | "orange" | "blue" {
  const s = getExpiryStatus(expiryDate);
  if (s === "expired") return "red";
  if (s === "expiring") return "orange";
  return "blue";
}

type HomeTabProps = BottomTabScreenProps<MainTabParamList, "Inicio">;

export function HomeScreen({ navigation }: HomeTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { houseId, loading: houseLoading } = useActiveHouseId();

  const [houseName, setHouseName] = useState<string | null>(null);
  const [items, setItems] = useState<FridgeItemRow[]>([]);
  const [readyMeals, setReadyMeals] = useState<ReadyMealRow[]>([]);
  const [points, setPoints] = useState(0);
  const [tasks, setTasks] = useState<HouseTaskRow[]>([]);
  const [stats, setStats] = useState<HouseStats>({ mealsCount: 0, purchasesCount: 0 });
  const [houseSummary, setHouseSummary] = useState<HouseSummary | null>(null);
  const [pendingJoins, setPendingJoins] = useState<
    Record<string, PendingJoinRequestRow & { uid: string }>
  >({});
  const [joinActionUid, setJoinActionUid] = useState<string | null>(null);

  const isHouseAdmin = Boolean(user && houseSummary?.adminId && user.uid === houseSummary.adminId);

  useEffect(() => {
    if (!user || !isRealtimeDatabaseConfigured()) return;
    let cancelled = false;
    getHouseNameForUser(user.uid)
      .then((name) => {
        if (!cancelled) setHouseName(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!houseId || !user) return;
    const u1 = subscribeFridgeItems(houseId, setItems);
    const u2 = subscribeMemberPoints(houseId, user.uid, setPoints);
    const u3 = subscribeHouseTasks(houseId, setTasks);
    const u4 = subscribeHouseStats(houseId, setStats);
    const u5 = subscribeReadyMeals(houseId, setReadyMeals);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [houseId, user]);

  useEffect(() => {
    if (!houseId || !isRealtimeDatabaseConfigured()) return;
    return subscribeHouseSummary(houseId, setHouseSummary);
  }, [houseId]);

  useEffect(() => {
    if (!houseId || !isHouseAdmin) {
      setPendingJoins({});
      return;
    }
    return subscribeHousePendingJoinRequests(houseId, setPendingJoins);
  }, [houseId, isHouseAdmin]);

  const levelInfo = useMemo(() => getLevelFromPoints(points), [points]);
  const progressPct = (levelInfo.currentInSegment / levelInfo.segmentMax) * 100;

  const fridgeAttentionCount = useMemo(() => {
    let n = 0;
    for (const it of items) {
      const s = getExpiryStatus(it.expiryDate);
      if (s !== "ok") n++;
    }
    return n;
  }, [items]);

  const fridgePreview = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.expiryDate - b.expiryDate);
    return sorted.slice(0, 2);
  }, [items]);

  const mealsAttentionCount = useMemo(() => {
    let n = 0;
    for (const m of readyMeals) {
      if (getExpiryStatus(m.expiryDate) !== "ok") n++;
    }
    return n;
  }, [readyMeals]);

  const mealsPreview = useMemo(() => {
    const sorted = [...readyMeals].sort((a, b) => a.expiryDate - b.expiryDate);
    return sorted.slice(0, 2);
  }, [readyMeals]);

  const tasksDone = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);
  const tasksVisible = useMemo(() => {
    const open = tasks.filter((t) => !t.completed);
    const done = tasks.filter((t) => t.completed);
    return [...open, ...done].slice(0, 6);
  }, [tasks]);

  const openSettings = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<AuthedStackParamList>>()?.navigate("Settings");
  }, [navigation]);

  const handleApproveJoin = useCallback(
    async (requesterUid: string) => {
      if (!houseId || !user) return;
      setJoinActionUid(requesterUid);
      try {
        await approvePendingJoinRequest(houseId, requesterUid, user.uid);
        showToast({
          type: "success",
          title: "Membro aprovado",
          message: "A pessoa já pode usar a casa.",
        });
      } catch (e) {
        showToast({
          type: "error",
          title: "Erro",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setJoinActionUid(null);
      }
    },
    [houseId, user, showToast]
  );

  const handleRejectJoin = useCallback(
    async (requesterUid: string) => {
      if (!houseId || !user) return;
      setJoinActionUid(requesterUid);
      try {
        await rejectPendingJoinRequest(houseId, requesterUid, user.uid);
        showToast({
          type: "info",
          title: "Pedido recusado",
          message: "A pessoa pode enviar outro pedido com o código se quiser.",
        });
      } catch (e) {
        showToast({
          type: "error",
          title: "Erro",
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setJoinActionUid(null);
      }
    },
    [houseId, user, showToast]
  );

  const toggleTask = useCallback(
    async (task: HouseTaskRow) => {
      if (!houseId || !user) return;
      const next = !task.completed;
      if (!next) {
        if (!canCurrentUserUncompleteTask(task, user.uid)) {
          showToast({
            type: "error",
            title: "Não é possível desmarcar",
            message: task.completedByUid
              ? "Só quem concluiu pode desmarcar."
              : "Tarefas concluídas antes desta atualização não podem ser desmarcadas.",
          });
          return;
        }
      }
      try {
        await setTaskCompleted(
          houseId,
          task.id,
          next,
          next
            ? {
                uid: user.uid,
                memberPointsDelta: task.points,
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
    },
    [houseId, showToast, user]
  );

  const logoutMutation = useMutation({
    mutationFn: () => signOutUser(),
    onSuccess: () => {
      showToast({
        type: "info",
        title: "Até logo",
        message: "Você saiu da conta.",
      });
    },
    onError: (e: Error) => {
      showToast({
        type: "error",
        title: "Erro ao sair",
        message: e.message ?? String(e),
      });
    },
  });

  const familyLabel = houseName ?? "Sua casa";

  const initials =
    user?.displayName
      ?.split(" ")
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "?";

  if (houseLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f7fa]" edges={["top"]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f7fa]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center justify-between px-5 pt-2">
          <View className="flex-row items-center gap-3">
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                className="h-12 w-12 rounded-full border border-slate-200"
              />
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <Text className="text-base font-bold text-slate-600">{initials}</Text>
              </View>
            )}
            <View>
              <Text className="text-sm text-slate-500">Bem-vindo(a) de volta,</Text>
              <Text className="text-xl font-bold text-slate-900">{familyLabel}</Text>
            </View>
          </View>
          <Pressable
            className="relative h-11 w-11 items-center justify-center rounded-full bg-white"
            style={shadowSm}
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Configurações da casa"
          >
            <Settings size={22} color="#475569" />
          </Pressable>
        </View>

        {isHouseAdmin && Object.keys(pendingJoins).length > 0 ? (
          <View className="mx-5 mt-4">
            <View className="mb-2 flex-row items-center gap-2">
              <Bell size={18} color={PRIMARY} />
              <Text className="text-sm font-bold text-slate-800">Pedidos para entrar na casa</Text>
            </View>
            {Object.entries(pendingJoins).map(([uid, row]) => {
              const label =
                row.displayName?.trim() ||
                row.email?.trim() ||
                `Usuário ···${uid.slice(-4)}`;
              const busyThis = joinActionUid === uid;
              return (
                <View
                  key={uid}
                  className="mb-3 rounded-2xl border border-blue-100 bg-white p-4"
                  style={shadowSm}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${PRIMARY}22` }}
                    >
                      <UserPlus size={20} color={PRIMARY} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-slate-900">{label}</Text>
                      {row.email ? (
                        <Text className="mt-0.5 text-xs text-slate-500">{row.email}</Text>
                      ) : null}
                      <Text className="mt-1 text-xs text-slate-400">Quer entrar nesta casa com o código</Text>
                    </View>
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => void handleRejectJoin(uid)}
                      disabled={busyThis}
                      className="flex-1 items-center rounded-xl border border-slate-200 py-2.5"
                    >
                      {busyThis ? (
                        <ActivityIndicator size="small" color="#64748b" />
                      ) : (
                        <Text className="text-sm font-semibold text-slate-600">Recusar</Text>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => void handleApproveJoin(uid)}
                      disabled={busyThis}
                      className="flex-1 items-center rounded-xl py-2.5"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {busyThis ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-sm font-semibold text-white">Aceitar</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View className="mx-5 mt-5 rounded-2xl bg-blue-50 p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: PRIMARY }}
              >
                <Star size={22} color="#fff" fill="#fff" />
              </View>
              <View>
                <Text className="text-sm font-semibold text-slate-800">
                  Nível {levelInfo.level}: {levelInfo.title}
                </Text>
              </View>
            </View>
            <Text className="text-sm font-semibold text-slate-600">
              {levelInfo.currentInSegment} / {levelInfo.segmentMax} pts
            </Text>
          </View>
          <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/80">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, progressPct)}%`, backgroundColor: PRIMARY }}
            />
          </View>
        </View>

        <View className="mt-6 flex-row justify-between gap-2 px-5">
          {[
            { Icon: Plus, label: "Item" },
            { Icon: ListTodo, label: "Tarefa" },
            { Icon: ShoppingCart, label: "Compra" },
            { Icon: UtensilsCrossed, label: "Refeição" },
          ].map(({ Icon, label }) => (
            <Pressable
              key={label}
              onPress={() => {
                if (label === "Item") {
                  navigation.navigate("Despensa", { screen: "DespensaHome" });
                } else if (label === "Tarefa") {
                  navigation.navigate("Tarefas");
                } else if (label === "Refeição") {
                  navigation.navigate("Despensa", { screen: "RefeicoesProntas" });
                } else {
                  navigation.navigate("Compras");
                }
              }}
              className="flex-1 items-center rounded-2xl bg-white py-4"
              style={shadowSm}
            >
              <View
                className="mb-2 h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${PRIMARY}18` }}
              >
                <Icon size={22} color={PRIMARY} strokeWidth={2.25} />
              </View>
              <Text className="text-xs font-semibold text-slate-700">{label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-bold text-slate-900">Despensa</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Inclui geladeira e demais armários
              </Text>
            </View>
            <Pressable
              onPress={() =>
                navigation.navigate("Despensa", { screen: "DespensaHome" })
              }
              className="pt-0.5"
            >
              <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                Ver tudo
              </Text>
            </Pressable>
          </View>
          {!houseId ? (
            <Text className="text-sm text-slate-500">Conclua o onboarding para ver a despensa.</Text>
          ) : (
            <View className="rounded-2xl bg-white p-4" style={shadowSm}>
              <View className="flex-row items-start gap-2">
                <Text className="text-lg">🌡️</Text>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">
                    {fridgeAttentionCount} {fridgeAttentionCount === 1 ? "item" : "itens"} precisam
                    de atenção
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {fridgeAttentionCount > 0
                      ? "Consuma ou descarte nos próximos dias."
                      : "Tudo em dia por aqui."}
                  </Text>
                </View>
              </View>
              {fridgePreview.length > 0 ? (
                <View className="mt-4 gap-3 border-t border-slate-100 pt-4">
                  {fridgePreview.map((item) => (
                    <View key={item.id} className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <ItemPreviewIcon cat={item.category} />
                        <Text className="font-medium text-slate-800">{item.name}</Text>
                      </View>
                      <BadgeFridge
                        label={getExpiryBadgeLabel(item.expiryDate)}
                        tone={badgeToneFromExpiry(item.expiryDate)}
                      />
                    </View>
                  ))}
                </View>
              ) : items.length === 0 ? (
                <Text className="mt-3 text-sm text-slate-500">
                  Nenhum item cadastrado. Abra a aba Despensa e adicione.
                </Text>
              ) : null}
            </View>
          )}
        </View>

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-bold text-slate-900">Refeições prontas</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Marmitas e preparos na geladeira ou freezer
              </Text>
            </View>
            <Pressable
              onPress={() =>
                navigation.navigate("Despensa", { screen: "RefeicoesProntas" })
              }
              className="pt-0.5"
            >
              <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                Ver tudo
              </Text>
            </Pressable>
          </View>
          {!houseId ? (
            <Text className="text-sm text-slate-500">
              Conclua o onboarding para ver as refeições.
            </Text>
          ) : (
            <View className="rounded-2xl bg-white p-4" style={shadowSm}>
              <View className="flex-row items-start gap-2">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                  <UtensilsCrossed size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-slate-900">
                    {readyMeals.length}{" "}
                    {readyMeals.length === 1 ? "refeição cadastrada" : "refeições cadastradas"}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {mealsAttentionCount > 0
                      ? `${mealsAttentionCount} ${mealsAttentionCount === 1 ? "precisa" : "precisam"} de atenção na validade.`
                      : "Nada vencendo com urgência."}
                  </Text>
                </View>
              </View>
              {mealsPreview.length > 0 ? (
                <View className="mt-4 gap-3 border-t border-slate-100 pt-4">
                  {mealsPreview.map((meal) => (
                    <Pressable
                      key={meal.id}
                      onPress={() =>
                        navigation.navigate("Despensa", { screen: "RefeicoesProntas" })
                      }
                      className="flex-row items-center justify-between active:opacity-80"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
                          <UtensilsCrossed size={20} color={PRIMARY} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text className="font-medium text-slate-800" numberOfLines={1}>
                            {meal.name}
                          </Text>
                          <Text className="text-xs text-slate-500">
                            {meal.storage === "geladeira" ? "Geladeira" : "Freezer"} •{" "}
                            {meal.portions} {meal.portions === 1 ? "porção" : "porções"}
                          </Text>
                        </View>
                      </View>
                      <BadgeFridge
                        label={getExpiryBadgeLabel(meal.expiryDate)}
                        tone={badgeToneFromExpiry(meal.expiryDate)}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text className="mt-3 text-sm text-slate-500">
                  Nenhuma refeição ainda. Toque em “Refeição” nos atalhos ou abra Refeições prontas.
                </Text>
              )}
            </View>
          )}
        </View>

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900">Tarefas de Hoje</Text>
            <Text className="text-sm text-slate-500">
              {tasksDone} de {tasks.length} concluídas
            </Text>
          </View>
          {!houseId ? (
            <Text className="text-sm text-slate-500">Crie uma casa para usar tarefas.</Text>
          ) : tasksVisible.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-slate-200 bg-white p-6">
              <Text className="text-center text-sm text-slate-500">Nenhuma tarefa ainda.</Text>
            </View>
          ) : (
            <View className="rounded-2xl bg-white p-2" style={shadowSm}>
              {tasksVisible.map((task) => (
                <Pressable
                  key={task.id}
                  onPress={() => toggleTask(task)}
                  className="flex-row items-center gap-3 border-b border-slate-100 px-2 py-3 last:border-b-0"
                >
                  <CheckSquare size={22} color={task.completed ? PRIMARY : "#cbd5e1"} />
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}
                    >
                      {task.title}
                    </Text>
                    <Text className="mt-0.5 text-xs text-slate-500">{task.assigneeName}</Text>
                  </View>
                  <View className="rounded-full px-2 py-1" style={{ backgroundColor: `${PRIMARY}22` }}>
                    <Text className="text-xs font-bold" style={{ color: PRIMARY }}>
                      +{task.points} pts
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View className="mt-6 flex-row gap-3 px-5">
          <View className="flex-1 rounded-2xl bg-white p-4" style={shadowSm}>
            <View className="flex-row items-start justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <UtensilsCrossed size={20} color="#059669" />
              </View>
              <Text className="text-xl font-bold text-slate-900">{readyMeals.length}</Text>
            </View>
            <Text className="mt-3 font-semibold text-slate-800">Refeições</Text>
            <Text className="mt-1 text-xs text-slate-500">Cadastradas na casa</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white p-4" style={shadowSm}>
            <View className="flex-row items-start justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                <ShoppingCart size={20} color="#ea580c" />
              </View>
              <Text className="text-xl font-bold text-slate-900">{stats.purchasesCount}</Text>
            </View>
            <Text className="mt-3 font-semibold text-slate-800">Compras</Text>
            <Text className="mt-1 text-xs text-slate-500">Itens pendentes</Text>
          </View>
        </View>

        <Pressable
          className="mx-5 mt-8 flex-row items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 active:opacity-90"
          onPress={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text className="text-base font-semibold text-slate-600">Sair da conta</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
