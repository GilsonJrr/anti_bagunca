import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Brush,
  Check,
  Flame,
  Gift,
  Settings,
  Star,
  Trophy,
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
import Svg, { Circle, G } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AuthedStackParamList } from "../../navigation/AuthenticatedNavigator";
import type { MainTabParamList } from "../../navigation/MainTabNavigator";
import {
  getLevelFromPoints,
  subscribeHouseMemberIds,
  subscribeHouseMemberPointsMap,
  subscribeHouseTasks,
  subscribeMemberPoints,
  type HouseTaskRow,
} from "../../lib/dashboardService";
import { getExpiryStatus, subscribeFridgeItems, type FridgeItemRow } from "../../lib/fridgeService";
import { isRealtimeDatabaseConfigured } from "../../lib/firebase";
import { shadowSm } from "../../lib/nativeShadow";
import { useActiveHouseId } from "../../hooks/useActiveHouseId";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";

const PRIMARY = "#2D5AF0";

type TabKey = "visao" | "missoes" | "ranking";

type NiveisProps = BottomTabScreenProps<MainTabParamList, "Niveis">;

function seasonLabelPt(): string {
  const m = new Date().getMonth();
  if (m >= 5 && m <= 7) return "Temporada de Inverno";
  if (m >= 8 && m <= 10) return "Temporada de Primavera";
  if (m === 11 || m <= 1) return "Temporada de Verão";
  return "Temporada de Outono";
}

function msUntilNextUtcMidnight(): number {
  const now = new Date();
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(0, 0, 0, 0);
  return Math.max(0, end.getTime() - now.getTime());
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatPts(n: number): string {
  return `${n.toLocaleString("pt-BR")} pts`;
}

function memberShortName(uid: string, currentUid: string | undefined, selfName: string): string {
  if (uid === currentUid) return selfName;
  return `Membro ···${uid.slice(-4)}`;
}

function LevelRing({
  progress,
  size,
  stroke,
}: {
  progress: number;
  size: number;
  stroke: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;
  const p = Math.min(1, Math.max(0, progress));
  const dashOffset = c * (1 - p);

  return (
    <Svg width={size} height={size}>
      <G transform={`rotate(-90 ${cx} ${cy})`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke="#e2e8f0"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={PRIMARY}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

export function NiveisScreen({ navigation }: NiveisProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { houseId, loading: houseLoading } = useActiveHouseId();

  const [tab, setTab] = useState<TabKey>("visao");
  const [myPoints, setMyPoints] = useState(0);
  const [memberPoints, setMemberPoints] = useState<Record<string, number>>({});
  const [memberUids, setMemberUids] = useState<string[]>([]);
  const [tasks, setTasks] = useState<HouseTaskRow[]>([]);
  const [fridgeItems, setFridgeItems] = useState<FridgeItemRow[]>([]);

  useEffect(() => {
    if (!houseId || !user) return;
    const u1 = subscribeMemberPoints(houseId, user.uid, setMyPoints);
    const u2 = subscribeHouseMemberPointsMap(houseId, setMemberPoints);
    const u3 = subscribeHouseMemberIds(houseId, setMemberUids);
    const u4 = subscribeHouseTasks(houseId, setTasks);
    const u5 = subscribeFridgeItems(houseId, setFridgeItems);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [houseId, user]);

  const selfName = useMemo(
    () => user?.displayName ?? user?.email?.split("@")[0] ?? "Você",
    [user]
  );

  const houseTotalPoints = useMemo(() => {
    let sum = 0;
    const uids = memberUids.length > 0 ? memberUids : Object.keys(memberPoints);
    for (const uid of uids) {
      sum += memberPoints[uid] ?? 0;
    }
    return sum;
  }, [memberPoints, memberUids]);

  const houseLevel = useMemo(() => getLevelFromPoints(houseTotalPoints), [houseTotalPoints]);
  const progressHouse = houseLevel.currentInSegment / houseLevel.segmentMax;

  const ranking = useMemo(() => {
    const uids = memberUids.length > 0 ? memberUids : Object.keys(memberPoints);
    const rows = uids.map((uid) => ({
      uid,
      points: memberPoints[uid] ?? 0,
      level: getLevelFromPoints(memberPoints[uid] ?? 0).level,
    }));
    rows.sort((a, b) => b.points - a.points);
    return rows;
  }, [memberPoints, memberUids]);

  const tasksCompletedToday = useMemo(() => {
    const now = Date.now();
    return tasks.filter(
      (t) => t.completed && t.completedAt && isSameLocalDay(t.completedAt, now)
    ).length;
  }, [tasks]);

  const missionTasksTarget = 3;
  const missionTasksProgress = Math.min(missionTasksTarget, tasksCompletedToday);

  const fridgeAttention = useMemo(() => {
    let n = 0;
    for (const it of fridgeItems) {
      if (getExpiryStatus(it.expiryDate) !== "ok") n++;
    }
    return n;
  }, [fridgeItems]);

  const missionExpiryDone = fridgeItems.length === 0 || fridgeAttention === 0;

  const hoursToReset = Math.max(1, Math.ceil(msUntilNextUtcMidnight() / 3600000));

  const streakDays = myPoints > 0 ? 7 : 0;
  const titleBadge =
    houseLevel.level >= 5 ? "Mestre" : houseLevel.level >= 3 ? "Organizado" : "Iniciante";

  const onSettings = useCallback(() => {
    navigation.getParent<NativeStackNavigationProp<AuthedStackParamList>>()?.navigate("Settings");
  }, [navigation]);

  const onClaimMission = useCallback(() => {
    if (missionTasksProgress < missionTasksTarget) {
      showToast({
        type: "info",
        title: "Missão",
        message: `Conclua ${missionTasksTarget} tarefas hoje para resgatar.`,
      });
      return;
    }
    showToast({
      type: "success",
      title: "Missão",
      message: "Recompensa em breve — continue assim!",
    });
  }, [missionTasksProgress, missionTasksTarget, showToast]);

  if (!isRealtimeDatabaseConfigured()) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-slate-600">
            Configure o Firebase (Realtime Database) para ver níveis e ranking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (houseLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white" edges={["top"]}>
        <ActivityIndicator color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!houseId) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f7fa]" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-slate-600">
            Entre em uma casa para ver níveis, missões e ranking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ringSize = 200;
  const stroke = 12;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-5 pt-2">
          <View className="flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-2">
              <Text className="text-xl font-black uppercase tracking-wide text-slate-900">
                Níveis
              </Text>
              <Text className="mt-0.5 text-sm text-slate-500">{seasonLabelPt()}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View
                className="flex-row items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5"
                style={shadowSm}
              >
                <Star size={16} color={PRIMARY} fill={PRIMARY} />
                <Text className="text-sm font-bold" style={{ color: PRIMARY }}>
                  {formatPts(myPoints)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={onSettings}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-50"
              >
                <Settings size={20} color="#64748b" />
              </Pressable>
            </View>
          </View>

          <View className="mt-4 flex-row items-center justify-between">
            <View className="flex-row">
              {ranking.slice(0, 3).map((row, i) => (
                <View
                  key={row.uid}
                  className={`h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-200 ${
                    i > 0 ? "-ml-3" : ""
                  }`}
                >
                  {row.uid === user?.uid && user?.photoURL ? (
                    <Image source={{ uri: user.photoURL }} className="h-full w-full" />
                  ) : (
                    <Text className="text-xs font-bold text-slate-600">
                      {memberShortName(row.uid, user?.uid, selfName).charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View className="mt-5 flex-row border-b border-slate-100">
            {(
              [
                ["visao", "Visão geral"],
                ["missoes", "Missões"],
                ["ranking", "Ranking"],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                className="mr-6 pb-3"
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
              >
                <Text
                  className={`text-xs font-bold uppercase tracking-wide ${
                    tab === key ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {label}
                </Text>
                {tab === key ? (
                  <View className="mt-2 h-0.5 rounded-full" style={{ backgroundColor: PRIMARY }} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>

        {tab === "visao" ? (
          <>
            <View className="mt-2 px-5">
              <View className="mb-4 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nível da casa
                </Text>
                <View className="rounded-full bg-emerald-100 px-2.5 py-1">
                  <Text className="text-[10px] font-bold uppercase text-emerald-800">
                    Modo coop
                  </Text>
                </View>
              </View>

              <View className="items-center">
                <View className="relative items-center justify-center">
                  <LevelRing progress={progressHouse} size={ringSize} stroke={stroke} />
                  <View
                    className="absolute items-center justify-center"
                    style={{ width: ringSize, height: ringSize, top: 0, left: 0 }}
                  >
                    <Text className="text-3xl font-black text-slate-900">
                      Nível {houseLevel.level}
                    </Text>
                    <Text className="mt-1 text-sm font-semibold" style={{ color: PRIMARY }}>
                      {Math.round(progressHouse * 100)}% para Nv. {houseLevel.level + 1}
                    </Text>
                  </View>
                </View>

                <View className="mt-8 w-full flex-row justify-between px-2">
                  <View className="items-center">
                    <View className="h-16 w-16 items-center justify-center rounded-full bg-orange-50">
                      <Flame size={28} color="#ea580c" />
                    </View>
                    <Text className="mt-2 text-lg font-bold text-slate-900">{streakDays} Dias</Text>
                    <Text className="text-[11px] text-slate-500">Ofensiva</Text>
                  </View>
                  <View className="items-center">
                    <View className="h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                      <Trophy size={28} color="#d97706" />
                    </View>
                    <Text className="mt-2 text-lg font-bold text-slate-900">{titleBadge}</Text>
                    <Text className="text-[11px] text-slate-500">Título atual</Text>
                  </View>
                  <View className="items-center">
                    <View className="h-16 w-16 items-center justify-center rounded-full bg-violet-50">
                      <Gift size={28} color="#7c3aed" />
                    </View>
                    <Text className="mt-2 text-lg font-bold text-slate-900">3 Baús</Text>
                    <Text className="text-[11px] text-slate-500">Por abrir</Text>
                  </View>
                </View>
              </View>
            </View>

            <View className="mt-10 px-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Missões diárias
                </Text>
                <Text className="text-xs text-slate-400">Atualiza em {hoursToReset}h</Text>
              </View>

              <View className="rounded-2xl border border-slate-100 bg-white p-4" style={shadowSm}>
                <View className="flex-row items-center gap-3">
                  <View className="h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
                    <Brush size={22} color="#94a3b8" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-slate-900">Concluir 3 tarefas</Text>
                    <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${(missionTasksProgress / missionTasksTarget) * 100}%`,
                          backgroundColor: PRIMARY,
                        }}
                      />
                    </View>
                    <Text className="mt-1 text-xs text-slate-500">
                      {missionTasksProgress}/{missionTasksTarget} concluídas
                    </Text>
                  </View>
                  <Pressable
                    onPress={onClaimMission}
                    className="rounded-full px-3 py-2"
                    style={{ backgroundColor: `${PRIMARY}18` }}
                  >
                    <View className="flex-row items-center gap-1">
                      <Star size={14} color={PRIMARY} fill={PRIMARY} />
                      <Text className="text-sm font-bold" style={{ color: PRIMARY }}>
                        +50
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View className="my-4 h-px bg-slate-100" />

                {missionExpiryDone ? (
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                      <Check size={22} color="#059669" strokeWidth={3} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-slate-400 line-through">
                        Checar vencimentos
                      </Text>
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                        <View className="h-full w-full rounded-full bg-emerald-500" />
                      </View>
                      <Text className="mt-1 text-xs font-semibold text-emerald-600">Resgatado!</Text>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50">
                      <Brush size={22} color="#94a3b8" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-slate-900">Checar vencimentos</Text>
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <View
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${Math.min(100, fridgeItems.length ? (1 - fridgeAttention / fridgeItems.length) * 100 : 0)}%` }}
                        />
                      </View>
                      <Text className="mt-1 text-xs text-slate-500">
                        {fridgeAttention} item(ns) precisam de atenção
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View className="mt-8 px-5">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ranking da casa
                </Text>
                <Pressable onPress={() => setTab("ranking")}>
                  <Text className="text-xs font-semibold" style={{ color: PRIMARY }}>
                    Ver todos ›
                  </Text>
                </Pressable>
              </View>

              <View className="gap-3">
                {ranking.slice(0, 3).map((row, idx) => {
                  const rank = idx + 1;
                  const rankColor =
                    rank === 1 ? "#eab308" : rank === 2 ? PRIMARY : "#ea580c";
                  return (
                    <View
                      key={row.uid}
                      className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3"
                      style={shadowSm}
                    >
                      <Text className="w-6 text-center text-lg font-black" style={{ color: rankColor }}>
                        {rank}
                      </Text>
                      <View className="relative">
                        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                          {row.uid === user?.uid && user?.photoURL ? (
                            <Image source={{ uri: user.photoURL }} className="h-full w-full" />
                          ) : (
                            <Text className="font-bold text-slate-600">
                              {memberShortName(row.uid, user?.uid, selfName).charAt(0)}
                            </Text>
                          )}
                        </View>
                        {rank === 1 ? (
                          <View className="absolute -right-1 -top-1 rounded-full bg-amber-100 px-1">
                            <Text className="text-[10px]">👑</Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold text-slate-900" numberOfLines={1}>
                          {memberShortName(row.uid, user?.uid, selfName)}
                          {row.uid === user?.uid ? (
                            <Text className="font-normal text-slate-500"> (Você)</Text>
                          ) : null}
                        </Text>
                        <Text className="text-xs text-slate-500">Nível {row.level}</Text>
                      </View>
                      <Text className="text-sm font-bold text-slate-800">{formatPts(row.points)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {tab === "missoes" ? (
          <View className="mt-4 px-5">
            <Text className="text-sm text-slate-600">
              As missões diárias reiniciam à meia-noite. Complete tarefas na aba Tarefas e mantenha a despensa em dia.
            </Text>
            <View className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <Text className="font-semibold text-slate-900">Progresso de hoje</Text>
              <Text className="mt-2 text-3xl font-black" style={{ color: PRIMARY }}>
                {tasksCompletedToday}/{missionTasksTarget}
              </Text>
              <Text className="mt-1 text-sm text-slate-500">tarefas concluídas</Text>
            </View>
            <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-4" style={shadowSm}>
              <Text className="font-semibold text-slate-900">Vencimentos</Text>
              <Text className="mt-2 text-sm text-slate-600">
                {missionExpiryDone
                  ? "Nenhum item crítico na despensa — missão cumprida."
                  : `Há ${fridgeAttention} item(ns) que precisam de atenção na despensa.`}
              </Text>
            </View>
          </View>
        ) : null}

        {tab === "ranking" ? (
          <View className="mt-4 px-5">
            {ranking.map((row, idx) => {
              const rank = idx + 1;
              const rankColor =
                rank === 1 ? "#eab308" : rank === 2 ? PRIMARY : rank === 3 ? "#ea580c" : "#64748b";
              return (
                <View
                  key={row.uid}
                  className="mb-3 flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3"
                  style={shadowSm}
                >
                  <Text className="w-8 text-center text-xl font-black" style={{ color: rankColor }}>
                    {rank}
                  </Text>
                  <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                    {row.uid === user?.uid && user?.photoURL ? (
                      <Image source={{ uri: user.photoURL }} className="h-full w-full" />
                    ) : (
                      <Text className="font-bold text-slate-600">
                        {memberShortName(row.uid, user?.uid, selfName).charAt(0)}
                      </Text>
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-slate-900" numberOfLines={1}>
                      {memberShortName(row.uid, user?.uid, selfName)}
                      {row.uid === user?.uid ? (
                        <Text className="font-normal text-slate-500"> (Você)</Text>
                      ) : null}
                    </Text>
                    <Text className="text-xs text-slate-500">Nível {row.level}</Text>
                  </View>
                  <Text className="text-sm font-bold text-slate-800">{formatPts(row.points)}</Text>
                </View>
              );
            })}
            {ranking.length === 0 ? (
              <Text className="text-center text-slate-500">Nenhum membro com pontos ainda.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
