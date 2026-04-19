import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import {
  ArrowLeft,
  Beef,
  Calendar,
  Carrot,
  ChevronRight,
  Copy,
  CupSoda,
  FileDown,
  ListTodo,
  MoreVertical,
  Plus,
  Shield,
  ShoppingCart,
  Trash2,
  UserPlus,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AuthedStackParamList } from "../navigation/AuthenticatedNavigator";
import { shadowSm, shadowXl } from "../lib/nativeShadow";
import {
  leaveHouse,
  requestJoinHouseByInviteCode,
  resolveInviteCodeToHouseId,
  restoreUserToHouse,
  subscribeHouseSettingsMerged,
  subscribeHouseSummary,
  updateHouseNotificationPrefs,
  type HouseNotificationPrefs,
  type HouseSettings,
  type HouseSummary,
} from "../lib/houseService";
import { isRealtimeDatabaseConfigured } from "../lib/firebase";
import { useActiveHouseId } from "../hooks/useActiveHouseId";
import { useAuth } from "../providers/AuthProvider";
import { useToast } from "../providers/ToastProvider";

const PRIMARY = "#2D5AF0";
const NAVY = "#0f172a";

type Props = NativeStackScreenProps<AuthedStackParamList, "Settings">;

const FRIDGE_CATEGORY_CHIPS: { key: string; label: string; Icon: typeof Carrot }[] = [
  { key: "vegetais", label: "Hortifruti", Icon: Carrot },
  { key: "bebidas", label: "Bebidas", Icon: CupSoda },
  { key: "carnes", label: "Carnes", Icon: Beef },
];

const TASK_CATEGORY_CHIPS: { key: string; label: string }[] = [
  { key: "limpeza", label: "Limpeza" },
  { key: "organizacao", label: "Organização" },
  { key: "compras", label: "Compras" },
];

function memberLabel(uid: string, selfUid: string | undefined, userName: string): string {
  if (uid === selfUid) return `${userName} (Você)`;
  return `Membro ···${uid.slice(-4)}`;
}

export function HouseSettingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { houseId, loading: houseLoading } = useActiveHouseId();

  const [summary, setSummary] = useState<HouseSummary | null>(null);
  const [settings, setSettings] = useState<HouseSettings | null>(null);
  const [catTab, setCatTab] = useState<"geladeira" | "tarefas">("geladeira");
  const [busy, setBusy] = useState(false);
  const [joinAnotherOpen, setJoinAnotherOpen] = useState(false);
  const [joinAnotherCode, setJoinAnotherCode] = useState("");
  const [busyJoinAnother, setBusyJoinAnother] = useState(false);

  useEffect(() => {
    if (!houseId || !isRealtimeDatabaseConfigured()) return;
    const u1 = subscribeHouseSummary(houseId, setSummary);
    const u2 = subscribeHouseSettingsMerged(houseId, setSettings);
    return () => {
      u1();
      u2();
    };
  }, [houseId]);

  const prefs: HouseNotificationPrefs | null = settings?.notificationPrefs ?? null;

  const selfName = useMemo(
    () => user?.displayName ?? user?.email?.split("@")[0] ?? "Você",
    [user]
  );

  const isAdmin = useMemo(
    () => Boolean(user && summary?.adminId && user.uid === summary.adminId),
    [user, summary?.adminId]
  );

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const patchNotif = useCallback(
    async (patch: Partial<HouseNotificationPrefs>) => {
      if (!houseId) return;
      try {
        await updateHouseNotificationPrefs(houseId, patch);
      } catch (e) {
        showToast({
          type: "error",
          title: "Erro",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [houseId, showToast]
  );

  const copyCode = useCallback(async () => {
    const code = summary?.inviteCode;
    if (!code) {
      showToast({ type: "error", title: "Código", message: "Código indisponível." });
      return;
    }
    await Clipboard.setStringAsync(code);
    showToast({ type: "success", title: "Copiado", message: "Código da casa copiado." });
  }, [showToast, summary?.inviteCode]);

  const inviteShare = useCallback(async () => {
    const code = summary?.inviteCode;
    if (!code) return;
    try {
      await Share.share({
        message: `Entre na minha casa no AntiBagunça com o código: ${code}`,
      });
    } catch {
      showToast({ type: "info", title: "Convite", message: `Código: ${code}` });
    }
  }, [showToast, summary?.inviteCode]);

  const submitJoinAnotherHouse = useCallback(async () => {
    if (!user) return;
    const code = joinAnotherCode.trim();
    if (code.length < 4) {
      showToast({
        type: "error",
        title: "Código",
        message: "Informe o código completo da casa.",
      });
      return;
    }
    if (!isRealtimeDatabaseConfigured()) {
      showToast({
        type: "error",
        title: "Realtime Database",
        message: "Configure EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env.",
      });
      return;
    }
    setBusyJoinAnother(true);
    const previousHouseId = houseId;
    let leftFromHouseId: string | null = null;
    try {
      const targetHouseId = await resolveInviteCodeToHouseId(code);
      if (previousHouseId && targetHouseId === previousHouseId) {
        showToast({
          type: "info",
          title: "Mesma casa",
          message: "Você já está nesta casa. Nada a fazer.",
        });
        setJoinAnotherOpen(false);
        setJoinAnotherCode("");
        return;
      }
      if (previousHouseId) {
        await leaveHouse(user.uid, previousHouseId);
        leftFromHouseId = previousHouseId;
      }
      const result = await requestJoinHouseByInviteCode(user.uid, code, {
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      });
      setJoinAnotherOpen(false);
      setJoinAnotherCode("");
      if (result.syncedMembership) {
        showToast({
          type: "success",
          title: "Conta sincronizada",
          message: "Sua casa foi reconectada.",
        });
        navigation.reset({ index: 0, routes: [{ name: "Loading" }] });
        return;
      }
      if (result.alreadyInHouse) {
        showToast({
          type: "info",
          title: "Pronto",
          message: "Você já está nesta casa.",
        });
        navigation.reset({ index: 0, routes: [{ name: "Loading" }] });
        return;
      }
      showToast({
        type: "success",
        title: "Pedido enviado",
        message: "O administrador da outra casa verá na tela inicial do app para aprovar.",
      });
      navigation.reset({ index: 0, routes: [{ name: "CreateHouse" }] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (leftFromHouseId) {
        try {
          await restoreUserToHouse(user.uid, leftFromHouseId);
        } catch {
          showToast({
            type: "error",
            title: "Erro grave",
            message:
              "Não foi possível restaurar sua casa automaticamente. Entre de novo com o código da sua casa.",
          });
          return;
        }
      }
      showToast({
        type: "error",
        title: "Não foi possível",
        message: msg,
      });
    } finally {
      setBusyJoinAnother(false);
    }
  }, [showToast, user, houseId, joinAnotherCode, navigation]);

  const onLeaveHouse = useCallback(() => {
    if (!houseId || !user) return;
    Alert.alert(
      "Sair da casa",
      "Você será removido desta casa e precisará criar ou entrar em outra com um código.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair da casa",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await leaveHouse(user.uid, houseId);
              showToast({ type: "info", title: "Você saiu da casa", message: "Escolha criar ou entrar em outra casa." });
              navigation.reset({ index: 0, routes: [{ name: "CreateHouse" }] });
            } catch (e) {
              showToast({
                type: "error",
                title: "Erro",
                message: e instanceof Error ? e.message : String(e),
              });
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [houseId, navigation, showToast, user]);

  if (!isRealtimeDatabaseConfigured()) {
    return (
      <SafeAreaView className="flex-1 bg-[#f8fafc]" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-slate-600">Configure o Firebase para ver as configurações da casa.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (houseLoading || !houseId) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f8fafc]" edges={["top"]}>
        <ActivityIndicator color={PRIMARY} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f8fafc]" edges={["top"]}>
      <View className="flex-row items-center border-b border-slate-100 bg-white px-5 py-3">
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => navigation.goBack()}
          className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-slate-50"
        >
          <ArrowLeft size={22} color={NAVY} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-center text-2xl font-black uppercase tracking-tight text-slate-900">Casa</Text>
          <Text className="text-center text-sm text-slate-500">Configurações e membros</Text>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="border-b border-slate-100 bg-white px-5 pb-5 pt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} className="h-14 w-14 rounded-full border border-slate-200" />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-200">
                  <Text className="text-lg font-bold text-slate-600">{selfName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View>
                <Text className="text-lg font-bold text-slate-900">{selfName}</Text>
                <Text className="text-sm text-slate-500">{isAdmin ? "Administrador" : "Membro"}</Text>
              </View>
            </View>
            <View className="rounded-full border border-slate-200 bg-white px-3 py-2" style={shadowSm}>
              <Text className="text-xs font-semibold text-slate-700" numberOfLines={1}>
                {summary?.name ?? "Casa principal"}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-4 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Membros</Text>
            <Pressable onPress={inviteShare} className="flex-row items-center gap-1">
              <Plus size={16} color={PRIMARY} />
              <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                Convidar
              </Text>
            </Pressable>
          </View>

          <View className="gap-2">
            {(summary?.memberUids ?? []).map((uid) => {
              const admin = summary?.adminId === uid;
              return (
                <View
                  key={uid}
                  className="flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3"
                  style={shadowSm}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-slate-200">
                      <Text className="text-sm font-bold text-slate-600">
                        {memberLabel(uid, user?.uid, selfName).charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text className="font-semibold text-slate-900">
                        {memberLabel(uid, user?.uid, selfName)}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-1">
                        {admin ? (
                          <>
                            <Shield size={12} color={PRIMARY} />
                            <Text className="text-xs text-slate-500">Admin</Text>
                          </>
                        ) : (
                          <Text className="text-xs text-slate-500">Membro</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      showToast({ type: "info", title: "Membro", message: "Gerenciar membros em breve." })
                    }
                  >
                    <MoreVertical size={20} color="#94a3b8" />
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Pressable
            onPress={copyCode}
            className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-4"
            style={shadowSm}
          >
            <View>
              <Text className="font-semibold text-slate-900">Código da casa</Text>
              <Text className="mt-0.5 text-xs text-slate-500">Compartilhe para convidar</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-black tracking-widest text-slate-900">
                {summary?.inviteCode ?? "—"}
              </Text>
              <Copy size={20} color={PRIMARY} />
            </View>
          </Pressable>

          <Text className="mb-3 mt-8 text-xs font-bold uppercase tracking-wider text-slate-500">
            Entrar numa casa
          </Text>
          <Pressable
            onPress={() => setJoinAnotherOpen(true)}
            className="flex-row items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-4"
            style={shadowSm}
          >
            <View className="flex-row items-center gap-3 pr-2">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${PRIMARY}18` }}
              >
                <UserPlus size={20} color={PRIMARY} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-slate-900">Pedir entrada com código</Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  Outro administrador aprova na tela Início. Sair desta casa ao enviar.
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color="#cbd5e1" />
          </Pressable>
        </View>

        <View className="mt-8 px-5">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorias</Text>
            <Pressable onPress={() => showToast({ type: "info", title: "Categorias", message: "Edição em breve." })}>
              <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                Editar
              </Text>
            </Pressable>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setCatTab("geladeira")}
              className={`rounded-full px-4 py-2.5 ${catTab === "geladeira" ? "" : "border border-slate-200 bg-white"}`}
              style={catTab === "geladeira" ? { backgroundColor: NAVY } : undefined}
            >
              <Text
                className={`text-center text-sm font-bold ${catTab === "geladeira" ? "text-white" : "text-slate-700"}`}
              >
                Geladeira
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCatTab("tarefas")}
              className={`rounded-full px-4 py-2.5 ${catTab === "tarefas" ? "" : "border border-slate-200 bg-white"}`}
              style={catTab === "tarefas" ? { backgroundColor: NAVY } : undefined}
            >
              <Text
                className={`text-center text-sm font-bold ${catTab === "tarefas" ? "text-white" : "text-slate-700"}`}
              >
                Tarefas
              </Text>
            </Pressable>
          </View>

          <View className="mt-4 flex-row flex-wrap gap-4">
            {catTab === "geladeira"
              ? FRIDGE_CATEGORY_CHIPS.map(({ key, label, Icon }) => (
                  <View
                    key={key}
                    className="items-center rounded-2xl border border-slate-100 bg-white px-3 py-3"
                    style={{ width: "22%", minWidth: 72 }}
                  >
                    <View className="mb-2 h-12 w-12 items-center justify-center rounded-xl bg-slate-50">
                      <Icon size={24} color={PRIMARY} />
                    </View>
                    <Text className="text-center text-[11px] font-semibold text-slate-800">
                      {label}
                    </Text>
                  </View>
                ))
              : TASK_CATEGORY_CHIPS.map(({ key, label }) => (
                  <View
                    key={key}
                    className="items-center rounded-2xl border border-slate-100 bg-white px-3 py-3"
                    style={{ width: "22%", minWidth: 72 }}
                  >
                    <View className="mb-2 h-12 w-12 items-center justify-center rounded-xl bg-slate-50">
                      <ListTodo size={24} color={PRIMARY} />
                    </View>
                    <Text className="text-center text-[11px] font-semibold text-slate-800">
                      {label}
                    </Text>
                  </View>
                ))}
            <Pressable
              onPress={() => showToast({ type: "info", title: "Nova categoria", message: "Em breve." })}
              className="items-center rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-3"
              style={{ width: "22%", minWidth: 72 }}
            >
              <View className="mb-2 h-12 w-12 items-center justify-center rounded-xl bg-slate-50">
                <Plus size={24} color="#94a3b8" />
              </View>
              <Text className="text-center text-[11px] font-semibold text-slate-500">Nova</Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-8 px-5">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Notificações
          </Text>
          <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white" style={shadowSm}>
            <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Calendar size={20} color={PRIMARY} />
                </View>
                <View className="max-w-[72%]">
                  <Text className="font-semibold text-slate-900">Vencimento próximo</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    Avisar {prefs?.expiryDaysBefore ?? 2} dias antes
                  </Text>
                </View>
              </View>
              <Switch
                value={prefs?.expiryReminderEnabled ?? true}
                onValueChange={(v) => void patchNotif({ expiryReminderEnabled: v })}
                trackColor={{ false: "#e2e8f0", true: `${PRIMARY}88` }}
                thumbColor="#fff"
              />
            </View>
            <View className="flex-row items-center justify-between border-b border-slate-100 px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <ListTodo size={20} color={PRIMARY} />
                </View>
                <View className="max-w-[72%]">
                  <Text className="font-semibold text-slate-900">Tarefas atribuídas</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">Quando alguém te marcar</Text>
                </View>
              </View>
              <Switch
                value={prefs?.assignedTasks ?? true}
                onValueChange={(v) => void patchNotif({ assignedTasks: v })}
                trackColor={{ false: "#e2e8f0", true: `${PRIMARY}88` }}
                thumbColor="#fff"
              />
            </View>
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <ShoppingCart size={20} color={PRIMARY} />
                </View>
                <View className="max-w-[72%]">
                  <Text className="font-semibold text-slate-900">Lista de compras</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">Itens adicionados</Text>
                </View>
              </View>
              <Switch
                value={prefs?.shoppingList ?? false}
                onValueChange={(v) => void patchNotif({ shoppingList: v })}
                trackColor={{ false: "#e2e8f0", true: `${PRIMARY}88` }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        <View className="mt-8 px-5">
          <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Dados e privacidade
          </Text>
          <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white" style={shadowSm}>
            <Pressable
              onPress={() =>
                showToast({ type: "info", title: "Exportar", message: "Exportação em breve." })
              }
              className="flex-row items-center justify-between border-b border-slate-100 px-4 py-4"
            >
              <View className="flex-row items-center gap-3">
                <FileDown size={20} color="#64748b" />
                <Text className="font-semibold text-slate-900">Exportar dados da casa</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </Pressable>
            <Pressable
              onPress={onLeaveHouse}
              disabled={busy}
              className="flex-row items-center gap-3 px-4 py-4"
            >
              <Trash2 size={20} color="#dc2626" />
              <Text className="font-semibold text-red-600">Limpar dados / Sair da casa</Text>
            </Pressable>
          </View>
        </View>

        <Text className="mt-10 text-center text-xs text-slate-400">
          AntiBagunça v{appVersion}
        </Text>
      </ScrollView>

      <Modal visible={joinAnotherOpen} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-center px-6"
        >
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setJoinAnotherOpen(false)} />
          <View className="relative z-10 w-full max-w-sm self-center rounded-3xl bg-white p-6" style={shadowXl}>
            <Text className="text-lg font-bold text-slate-900">Pedir entrada com código</Text>
            <Text className="mt-1 text-sm text-slate-500">
              Digite o código da outra casa. Você sai desta casa; o administrador aprova na tela Início.
            </Text>
            <TextInput
              className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-semibold tracking-widest text-slate-900"
              placeholder="CÓDIGO"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              value={joinAnotherCode}
              onChangeText={(t) => setJoinAnotherCode(t.toUpperCase().replace(/\s/g, ""))}
            />
            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-2xl border border-slate-200 py-3"
                onPress={() => setJoinAnotherOpen(false)}
              >
                <Text className="font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl py-3"
                style={{ backgroundColor: PRIMARY }}
                onPress={() => void submitJoinAnotherHouse()}
                disabled={busyJoinAnother}
              >
                {busyJoinAnother ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Enviar pedido</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
