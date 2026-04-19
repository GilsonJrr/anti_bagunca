import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Flame,
  Pencil,
  Search,
  Settings2,
  Snowflake,
  UtensilsCrossed,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FAB_SCROLL_PADDING_BOTTOM,
  FloatingAddButton,
} from "../../components/FloatingAddButton";
import { DespensaSubScreenNav } from "../../components/DespensaSubScreenNav";
import { useActiveHouseId } from "../../hooks/useActiveHouseId";
import type { DespensaStackParamList } from "../../navigation/DespensaStackNavigator";
import { endOfDayMs, getExpiryBadgeLabel, getExpiryStatus, startOfDayMs } from "../../lib/fridgeService";
import {
  addReadyMeal,
  consumeOnePortion,
  daysRemainingLabel,
  filterReadyMeals,
  quickSuggestionMeals,
  type ReadyMealRow,
  type ReadyMealStorage,
  subscribeReadyMeals,
  updateReadyMeal,
} from "../../lib/readyMealsService";
import { shadowSm } from "../../lib/nativeShadow";
import { useToast } from "../../providers/ToastProvider";

type RefeicoesProps = NativeStackScreenProps<DespensaStackParamList, "RefeicoesProntas">;

const PRIMARY = "#2D5AF0";
const NAVY = "#0f172a";

type FilterChip = "todas" | ReadyMealStorage | "almoco_janta";

const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "geladeira", label: "Geladeira" },
  { key: "freezer", label: "Freezer" },
  { key: "almoco_janta", label: "Almoço/Janta" },
];

function formatPrepLabel(prepMs: number): string {
  const today = startOfDayMs(Date.now());
  const prepDay = startOfDayMs(prepMs);
  if (prepDay === today) return "Hoje";
  return new Date(prepMs).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function toneFromExpiry(expiryDate: number): "red" | "orange" | "blue" {
  const s = getExpiryStatus(expiryDate);
  if (s === "expired") return "red";
  if (s === "expiring") return "orange";
  return "blue";
}

function MealToneBadge({ expiryDate }: { expiryDate: number }) {
  const label = getExpiryBadgeLabel(expiryDate);
  const tone = toneFromExpiry(expiryDate);
  const bg =
    tone === "red"
      ? "bg-red-100"
      : tone === "orange"
        ? "bg-orange-100"
        : "bg-emerald-100";
  const tx =
    tone === "red"
      ? "text-red-700"
      : tone === "orange"
        ? "text-orange-800"
        : "text-emerald-800";
  return (
    <View className={`rounded-full px-2.5 py-1 ${bg}`}>
      <Text className={`text-xs font-semibold ${tx}`}>{label}</Text>
    </View>
  );
}

export function RefeicoesProntasScreen({ navigation }: RefeicoesProps) {
  const { houseId, loading: houseLoading } = useActiveHouseId();
  const { showToast } = useToast();
  const [meals, setMeals] = useState<ReadyMealRow[]>([]);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<FilterChip>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReadyMealRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDatePrep, setShowDatePrep] = useState(false);
  const [showDateVal, setShowDateVal] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPortions, setFormPortions] = useState("1");
  const [formStorage, setFormStorage] = useState<ReadyMealStorage>("geladeira");
  const [formAlmoco, setFormAlmoco] = useState(false);
  const [formPrep, setFormPrep] = useState(() => new Date());
  const [formExpiry, setFormExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d;
  });

  useEffect(() => {
    if (!houseId) return;
    return subscribeReadyMeals(houseId, setMeals);
  }, [houseId]);

  const filtered = useMemo(
    () => filterReadyMeals(meals, chip, query),
    [meals, chip, query]
  );

  const suggestions = useMemo(() => quickSuggestionMeals(meals), [meals]);

  const geladeiraList = useMemo(
    () => filtered.filter((m) => m.storage === "geladeira"),
    [filtered]
  );
  const freezerList = useMemo(
    () => filtered.filter((m) => m.storage === "freezer"),
    [filtered]
  );

  const openNew = useCallback(() => {
    setEditing(null);
    setFormName("");
    setFormPortions("1");
    setFormStorage("geladeira");
    setFormAlmoco(false);
    setFormPrep(new Date());
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setFormExpiry(d);
    setShowDatePrep(false);
    setShowDateVal(false);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((m: ReadyMealRow) => {
    setEditing(m);
    setFormName(m.name);
    setFormPortions(String(m.portions));
    setFormStorage(m.storage);
    setFormAlmoco(m.almocoJanta);
    setFormPrep(new Date(m.prepDate));
    setFormExpiry(new Date(m.expiryDate));
    setShowDatePrep(false);
    setShowDateVal(false);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  const handleSave = async () => {
    if (!houseId) return;
    const name = formName.trim();
    if (!name) {
      showToast({ type: "error", title: "Nome", message: "Informe o nome." });
      return;
    }
    const portions = Math.max(1, parseInt(formPortions, 10) || 1);
    setSaving(true);
    try {
      const prep = endOfDayMs(formPrep.getTime());
      const exp = endOfDayMs(formExpiry.getTime());
      if (editing) {
        await updateReadyMeal(houseId, editing.id, {
          name,
          portions,
          prepDate: prep,
          expiryDate: exp,
          storage: formStorage,
          almocoJanta: formAlmoco,
        });
        showToast({ type: "success", title: "Atualizado", message: name });
      } else {
        await addReadyMeal(houseId, {
          name,
          portions,
          prepDate: prep,
          expiryDate: exp,
          storage: formStorage,
          almocoJanta: formAlmoco,
        });
        showToast({ type: "success", title: "Refeição salva", message: name });
      }
      closeModal();
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

  const onConsume = async (m: ReadyMealRow) => {
    if (!houseId) return;
    try {
      await consumeOnePortion(houseId, m);
      showToast({ type: "success", title: "Consumido 1 porção", message: m.name });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onDefrost = async (m: ReadyMealRow) => {
    if (!houseId) return;
    try {
      await updateReadyMeal(houseId, m.id, { storage: "geladeira" });
      showToast({
        type: "info",
        title: "Descongelando",
        message: `${m.name} movido para a geladeira.`,
      });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
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
          Nenhuma casa ativa. Conclua o onboarding.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <DespensaSubScreenNav active="refeicoes" navigation={navigation} />
      <View className="border-b border-slate-100 bg-white px-5 pb-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-[26px] font-bold leading-tight" style={{ color: NAVY }}>
              Refeições prontas
            </Text>
            <Text className="mt-1 text-sm leading-5 text-slate-500">
              Marmitas, sobras e preparos — por local e validade.
            </Text>
          </View>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white"
            style={shadowSm}
            onPress={() =>
              showToast({ type: "info", title: "Filtros", message: "Em breve." })
            }
          >
            <Settings2 size={20} color="#475569" />
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-3.5" style={shadowSm}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            className="ml-3 flex-1 text-base text-slate-900"
            placeholder="Buscar refeições..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
          contentContainerStyle={{ gap: 10, paddingRight: 8 }}
        >
          {FILTER_CHIPS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setChip(c.key)}
              className={`rounded-full border px-4 py-3 ${
                chip === c.key ? "border-transparent" : "border-slate-200 bg-white"
              }`}
              style={chip === c.key ? { backgroundColor: NAVY } : undefined}
            >
              <Text
                className={`text-center text-sm font-semibold ${
                  chip === c.key ? "text-white" : "text-slate-700"
                }`}
              >
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1 bg-[#f8fafc] px-5 pt-4"
        contentContainerStyle={{ paddingBottom: FAB_SCROLL_PADDING_BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        {suggestions.length > 0 && chip === "todas" && !query.trim() ? (
          <View className="mb-6">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Sugestões de consumo rápido
              </Text>
              <View className="rounded-full bg-red-50 px-2 py-1">
                <Text className="text-[10px] font-bold uppercase text-red-700">
                  Vencem em breve
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {suggestions.slice(0, 6).map((m) => (
                <View
                  key={m.id}
                  className="w-[200px] overflow-hidden rounded-2xl border border-slate-100 bg-white p-3"
                  style={shadowSm}
                >
                  <View className="mb-2 h-12 w-12 items-center justify-center rounded-xl bg-slate-50">
                    <UtensilsCrossed size={24} color={PRIMARY} />
                  </View>
                  <MealToneBadge expiryDate={m.expiryDate} />
                  <Text className="mt-2 text-base font-semibold text-slate-900" numberOfLines={2}>
                    {m.name}
                  </Text>
                  <Text className="mt-1 text-xs text-slate-500">
                    {m.storage === "geladeira" ? "Geladeira" : "Freezer"} • {m.portions}{" "}
                    {m.portions === 1 ? "porção" : "porções"}
                  </Text>
                  <Pressable
                    onPress={() => onConsume(m)}
                    className="mt-3 flex-row items-center justify-center gap-1 rounded-xl py-2"
                    style={{ backgroundColor: `${PRIMARY}18` }}
                  >
                    <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                      ✓ Consumir
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {geladeiraList.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Na geladeira
            </Text>
            {geladeiraList.map((m) => (
              <MealListCard
                key={m.id}
                meal={m}
                onEdit={() => openEdit(m)}
                onConsume={() => onConsume(m)}
                onDefrost={undefined}
              />
            ))}
          </View>
        ) : null}

        {freezerList.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              No freezer
            </Text>
            {freezerList.map((m) => (
              <MealListCard
                key={m.id}
                meal={m}
                onEdit={() => openEdit(m)}
                onConsume={() => onConsume(m)}
                onDefrost={() => onDefrost(m)}
              />
            ))}
          </View>
        ) : null}

        {filtered.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-center text-[15px] text-slate-500">
              {meals.length === 0
                ? "Nenhuma refeição cadastrada. Toque em + para adicionar."
                : "Nenhum resultado com esses filtros."}
            </Text>
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
              {editing ? "Editar refeição" : "Nova refeição"}
            </Text>
            <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
              <Text className="mb-1 text-sm font-medium text-slate-700">Nome</Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                value={formName}
                onChangeText={setFormName}
                placeholder="Ex: Lasanha, marmita..."
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">Porções</Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                keyboardType="number-pad"
                value={formPortions}
                onChangeText={setFormPortions}
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">Onde está</Text>
              <View className="mb-3 flex-row gap-2">
                {(["geladeira", "freezer"] as ReadyMealStorage[]).map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setFormStorage(k)}
                    className={`flex-1 rounded-2xl border py-3 ${
                      formStorage === k ? "" : "border-slate-200 bg-white"
                    }`}
                    style={formStorage === k ? { backgroundColor: NAVY, borderColor: NAVY } : undefined}
                  >
                    <Text
                      className={`text-center text-sm font-semibold ${
                        formStorage === k ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {k === "geladeira" ? "Geladeira" : "Freezer"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => setFormAlmoco((v) => !v)}
                className="mb-3 flex-row items-center gap-2"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded border ${
                    formAlmoco ? "" : "border-slate-300 bg-white"
                  }`}
                  style={formAlmoco ? { backgroundColor: PRIMARY, borderColor: PRIMARY } : undefined}
                >
                  {formAlmoco ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                </View>
                <Text className="text-sm text-slate-700">Almoço / jantar</Text>
              </Pressable>
              <Text className="mb-1 text-sm font-medium text-slate-700">Preparo</Text>
              <Pressable
                onPress={() => setShowDatePrep(true)}
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5"
              >
                <Text className="text-base">{formPrep.toLocaleDateString("pt-BR")}</Text>
              </Pressable>
              {showDatePrep ? (
                <DateTimePicker
                  value={formPrep}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    if (Platform.OS === "android") setShowDatePrep(false);
                    if (d) setFormPrep(d);
                  }}
                />
              ) : null}
              <Text className="mb-1 text-sm font-medium text-slate-700">Validade</Text>
              <Pressable
                onPress={() => setShowDateVal(true)}
                className="mb-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5"
              >
                <Text className="text-base">{formExpiry.toLocaleDateString("pt-BR")}</Text>
              </Pressable>
              {showDateVal ? (
                <DateTimePicker
                  value={formExpiry}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_, d) => {
                    if (Platform.OS === "android") setShowDateVal(false);
                    if (d) setFormExpiry(d);
                  }}
                />
              ) : null}
            </ScrollView>
            <View className="mt-2 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-2xl border border-slate-200 py-4"
                onPress={closeModal}
              >
                <Text className="font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl py-4"
                style={{ backgroundColor: PRIMARY }}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Salvar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function MealListCard({
  meal,
  onEdit,
  onConsume,
  onDefrost,
}: {
  meal: ReadyMealRow;
  onEdit: () => void;
  onConsume: () => void;
  onDefrost?: () => void;
}) {
  const status = getExpiryStatus(meal.expiryDate);
  const timeColor =
    status === "expired"
      ? "text-red-600"
      : status === "expiring"
        ? "text-amber-700"
        : meal.storage === "freezer"
          ? "text-blue-700"
          : "text-emerald-600";
  const timeText =
    meal.storage === "freezer" ? daysRemainingLabel(meal.expiryDate) : getExpiryBadgeLabel(meal.expiryDate);

  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4" style={shadowSm}>
      <Pressable onPress={onEdit} className="flex-row gap-3 active:opacity-90">
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
          <UtensilsCrossed size={28} color={PRIMARY} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-base font-semibold text-slate-900" numberOfLines={2}>
              {meal.name}
            </Text>
            <Text className={`max-w-[100px] text-right text-xs font-semibold ${timeColor}`}>
              {timeText}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-slate-500">
            Prep: {formatPrepLabel(meal.prepDate)} • Val:{" "}
            {new Date(meal.expiryDate).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
            })}
          </Text>
          <View className="mt-2 flex-row items-center gap-2">
            {meal.storage === "geladeira" ? (
              <View className="flex-row items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                <Snowflake size={12} color="#64748b" />
                <Text className="text-[10px] font-medium text-slate-600">Geladeira</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5">
                <Snowflake size={12} color={PRIMARY} />
                <Text className="text-[10px] font-medium text-blue-800">Freezer</Text>
              </View>
            )}
            <View className="rounded-full bg-slate-100 px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-slate-700">
                {meal.portions} {meal.portions === 1 ? "porção" : "porções"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
      <View className="mt-3 flex-row gap-2">
        {onDefrost ? (
          <Pressable
            onPress={onDefrost}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border border-slate-200 py-2.5"
          >
            <Flame size={16} color="#64748b" />
            <Text className="text-sm font-semibold text-slate-700">Descongelar</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onEdit}
            className="flex-1 flex-row items-center justify-center gap-1 rounded-xl border border-slate-200 py-2.5"
          >
            <Pencil size={16} color="#64748b" />
            <Text className="text-sm font-semibold text-slate-700">Editar</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onConsume}
          className="flex-1 flex-row items-center justify-center gap-1 rounded-xl py-2.5"
          style={{ backgroundColor: PRIMARY }}
        >
          <UtensilsCrossed size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">Consumir 1</Text>
        </Pressable>
      </View>
    </View>
  );
}
