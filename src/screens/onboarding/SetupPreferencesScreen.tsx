import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  ArrowLeft,
  Bell,
  Check,
  ListTodo,
  Refrigerator,
  Shield,
  ShoppingCart,
  Timer,
  Trophy,
  UtensilsCrossed,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AuthedStackParamList } from "../../navigation/AuthenticatedNavigator";
import { shadowSm } from "../../lib/nativeShadow";
import {
  DEFAULT_HOUSE_SETTINGS,
  type HouseModules,
  type HouseSettings,
  saveHouseSettings,
} from "../../lib/houseService";
import { isRealtimeDatabaseConfigured } from "../../lib/firebase";
import { useToast } from "../../providers/ToastProvider";

function ProgressBar() {
  return (
    <View className="mt-4 flex-row gap-2">
      <View className="h-1 flex-1 rounded-full bg-blue-500" />
      <View className="h-1 flex-1 rounded-full bg-blue-500" />
    </View>
  );
}

type ModuleKey = keyof HouseModules;

const MODULES: { key: ModuleKey; label: string; Icon: typeof Refrigerator }[] = [
  { key: "geladeira", label: "Despensa", Icon: Refrigerator },
  { key: "refeicoes", label: "Refeições", Icon: UtensilsCrossed },
  { key: "compras", label: "Compras", Icon: ShoppingCart },
  { key: "tarefas", label: "Tarefas", Icon: ListTodo },
];

type SetupPreferencesProps = NativeStackScreenProps<AuthedStackParamList, "SetupPreferences">;

export function SetupPreferencesScreen({ navigation, route }: SetupPreferencesProps) {
  const { showToast } = useToast();
  const houseId = route.params?.houseId;
  const [modules, setModules] = useState<HouseModules>(DEFAULT_HOUSE_SETTINGS.modules);
  const [resumoOn, setResumoOn] = useState(DEFAULT_HOUSE_SETTINGS.reminders.resumo_dia.enabled);
  const [vencOn, setVencOn] = useState(DEFAULT_HOUSE_SETTINGS.reminders.vencimentos.enabled);
  const [zeroWaste, setZeroWaste] = useState(DEFAULT_HOUSE_SETTINGS.gamified_goals.zero_desperdicio);
  const [superOrg, setSuperOrg] = useState(DEFAULT_HOUSE_SETTINGS.gamified_goals.super_organizado);
  const [busy, setBusy] = useState(false);

  function toggleModule(key: ModuleKey) {
    setModules((m) => ({ ...m, [key]: !m[key] }));
  }

  async function finish() {
    if (!houseId) {
      showToast({
        type: "error",
        title: "Sessão",
        message: "Casa não encontrada. Volte e crie ou entre em uma casa.",
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

    const settings: HouseSettings = {
      setupCompleted: true,
      modules,
      reminders: {
        resumo_dia: { enabled: resumoOn, time: "08:00" },
        vencimentos: { enabled: vencOn, time: "18:00" },
      },
      gamified_goals: {
        zero_desperdicio: zeroWaste,
        super_organizado: superOrg,
      },
    };

    setBusy(true);
    try {
      await saveHouseSettings(houseId, settings);
      showToast({
        type: "success",
        title: "Tudo certo",
        message: "Preferências salvas na sua casa.",
      });
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro ao salvar",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    if (!houseId) {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      return;
    }
    if (!isRealtimeDatabaseConfigured()) {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      return;
    }
    setBusy(true);
    try {
      await saveHouseSettings(houseId, {
        ...DEFAULT_HOUSE_SETTINGS,
        setupCompleted: true,
      });
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1 px-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="flex-row items-center justify-between pt-2">
          {navigation.canGoBack() ? (
            <Pressable
              className="h-11 w-11 items-center justify-center rounded-full bg-white"
              style={shadowSm}
              onPress={() => navigation.goBack()}
            >
              <ArrowLeft size={22} color="#0f172a" />
            </Pressable>
          ) : (
            <View className="h-11 w-11" />
          )}
          <Pressable onPress={handleSkip} disabled={busy}>
            <Text className="text-base font-medium text-blue-500">Pular</Text>
          </Pressable>
        </View>

        <ProgressBar />

        <Text className="mt-6 text-3xl font-bold text-slate-900">O que vamos organizar? ✨</Text>
        <Text className="mt-2 text-base text-slate-500">
          Escolha módulos, lembretes e metas para sua casa.
        </Text>

        <Text className="mb-3 mt-8 text-sm font-semibold text-slate-800">1. Módulos da Casa</Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {MODULES.map(({ key, label, Icon }) => {
            const on = modules[key];
            return (
              <Pressable
                key={key}
                onPress={() => toggleModule(key)}
                className={`w-[48%] rounded-2xl border-2 bg-white p-4 active:opacity-90 ${
                  on ? "border-blue-500" : "border-slate-200"
                }`}
              >
                <View
                  className={`mb-3 h-10 w-10 items-center justify-center rounded-xl ${
                    on ? "bg-blue-500" : "bg-slate-100"
                  }`}
                >
                  <Icon size={22} color={on ? "#fff" : "#475569"} />
                </View>
                <Text className={`text-sm font-semibold ${on ? "text-blue-600" : "text-slate-700"}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mb-3 mt-10 text-sm font-semibold text-slate-800">2. Lembretes Diários</Text>
        <View className="gap-3">
          <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Bell size={20} color="#3b82f6" />
              </View>
              <View>
                <Text className="font-semibold text-slate-900">Resumo do Dia</Text>
                <Text className="text-sm text-slate-500">Notificar às 08:00</Text>
              </View>
            </View>
            <Switch
              value={resumoOn}
              onValueChange={setResumoOn}
              trackColor={{ false: "#e2e8f0", true: "#93c5fd" }}
              thumbColor={resumoOn ? "#3b82f6" : "#f4f4f5"}
            />
          </View>
          <View className="flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Timer size={20} color="#3b82f6" />
              </View>
              <View>
                <Text className="font-semibold text-slate-900">Vencimentos</Text>
                <Text className="text-sm text-slate-500">Notificar às 18:00</Text>
              </View>
            </View>
            <Switch
              value={vencOn}
              onValueChange={setVencOn}
              trackColor={{ false: "#e2e8f0", true: "#93c5fd" }}
              thumbColor={vencOn ? "#3b82f6" : "#f4f4f5"}
            />
          </View>
        </View>

        <Text className="mb-3 mt-10 text-sm font-semibold text-slate-800">3. Metas Gamificadas</Text>
        <View className="gap-3">
          <Pressable
            onPress={() => setZeroWaste((v) => !v)}
            className={`flex-row items-center justify-between rounded-2xl border-2 bg-white p-4 ${
              zeroWaste ? "border-blue-500" : "border-slate-200"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <Trophy size={24} color="#d97706" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-900">Zero Desperdício</Text>
                <Text className="text-sm text-slate-500">Manter a despensa sem vencidos</Text>
              </View>
            </View>
            <View
              className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                zeroWaste ? "border-blue-500 bg-blue-500" : "border-slate-300"
              }`}
            >
              {zeroWaste ? <Check size={18} color="#fff" /> : null}
            </View>
          </Pressable>

          <Pressable
            onPress={() => setSuperOrg((v) => !v)}
            className={`flex-row items-center justify-between rounded-2xl border-2 bg-white p-4 ${
              superOrg ? "border-blue-500" : "border-slate-200"
            }`}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <Shield size={24} color="#059669" />
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-slate-900">Super Organizado</Text>
                <Text className="text-sm text-slate-500">Concluir todas tarefas semanais</Text>
              </View>
            </View>
            <View
              className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
                superOrg ? "border-blue-500 bg-blue-500" : "border-slate-300"
              }`}
            >
              {superOrg ? <Check size={18} color="#fff" /> : null}
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-[#f9fafb] px-6 pb-8 pt-4">
        <Pressable
          onPress={finish}
          disabled={busy}
          className="items-center rounded-2xl bg-[#0f172a] py-4 active:opacity-90"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-bold text-white">Concluir Configuração ✓</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
