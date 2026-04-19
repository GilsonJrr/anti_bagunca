import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  Beef,
  Carrot,
  Cookie,
  CupSoda,
  Milk,
  Minus,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingCart,
  Snowflake,
  Trash2,
  Wheat,
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DespensaStackParamList } from "../navigation/DespensaStackNavigator";
import { BarcodeScannerModal } from "../components/BarcodeScannerModal";
import {
  FAB_SCROLL_PADDING_BOTTOM,
  FloatingAddButton,
} from "../components/FloatingAddButton";
import { DespensaSubScreenNav } from "../components/DespensaSubScreenNav";
import { useActiveHouseId } from "../hooks/useActiveHouseId";
import type {
  FridgeCategory,
  FridgeItemRow,
  StorageZone,
} from "../lib/fridgeService";
import type { ScanFillResult } from "../lib/productBarcodeLookup";
import { shadow2xl, shadowMd, shadowSm } from "../lib/nativeShadow";
import {
  addFridgeItem,
  consumeFridgeItem,
  countFridgeByStatus,
  deleteFridgeItem,
  endOfDayMs,
  getExpiryBadgeLabel,
  getExpiryStatus,
  getStorageZone,
  subscribeFridgeItems,
  updateFridgeItem,
} from "../lib/fridgeService";
import { useToast } from "../providers/ToastProvider";

type DespensaHomeProps = NativeStackScreenProps<DespensaStackParamList, "DespensaHome">;

const PRIMARY = "#2D5AF0";
const NAVY = "#0f172a";

const CATEGORY_LABEL: Record<FridgeCategory, string> = {
  laticinios: "Laticínios",
  vegetais: "Vegetais",
  congelados: "Congelados",
  carnes: "Carnes e ovos",
  graos: "Grãos e massas",
  bebidas: "Bebidas",
  doces_snacks: "Doces e snacks",
  outros: "Outros",
};

const CATEGORY_ORDER: FridgeCategory[] = [
  "laticinios",
  "vegetais",
  "congelados",
  "carnes",
  "graos",
  "bebidas",
  "doces_snacks",
  "outros",
];

const STORAGE_LABEL: Record<StorageZone, string> = {
  geladeira: "Geladeira",
  despensa: "Despensa",
  outros: "Outros",
};

const STORAGE_CHIPS: { key: "all" | StorageZone; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "geladeira", label: "Geladeira" },
  { key: "despensa", label: "Despensa" },
  { key: "outros", label: "Outros" },
];

const CATEGORY_CHIPS: { key: "all" | FridgeCategory; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "laticinios", label: "Laticínios" },
  { key: "vegetais", label: "Vegetais" },
  { key: "congelados", label: "Congelados" },
  { key: "carnes", label: "Carnes" },
  { key: "graos", label: "Grãos" },
  { key: "bebidas", label: "Bebidas" },
  { key: "doces_snacks", label: "Doces" },
  { key: "outros", label: "Outros" },
];

function CategoryIcon({
  cat,
  size = 22,
}: {
  cat: FridgeCategory;
  size?: number;
}) {
  const c = PRIMARY;
  switch (cat) {
    case "laticinios":
      return <Milk size={size} color={c} />;
    case "vegetais":
      return <Carrot size={size} color="#ea580c" />;
    case "congelados":
      return <Snowflake size={size} color={c} />;
    case "carnes":
      return <Beef size={size} color="#b91c1c" />;
    case "graos":
      return <Wheat size={size} color="#a16207" />;
    case "bebidas":
      return <CupSoda size={size} color="#0369a1" />;
    case "doces_snacks":
      return <Cookie size={size} color="#c2410c" />;
    default:
      return <Package size={size} color="#64748b" />;
  }
}

function leftBarClass(status: "expired" | "expiring" | "ok"): string {
  if (status === "expired") return "bg-red-500";
  if (status === "expiring") return "bg-amber-400";
  return "bg-emerald-500";
}

function badgeClass(status: "expired" | "expiring" | "ok"): string {
  if (status === "expired") return "bg-red-100";
  if (status === "expiring") return "bg-amber-100";
  return "bg-emerald-100";
}

function badgeTextClass(status: "expired" | "expiring" | "ok"): string {
  if (status === "expired") return "text-red-700";
  if (status === "expiring") return "text-amber-800";
  return "text-emerald-700";
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-3 ${selected ? "border-transparent" : "border-slate-200 bg-white"}`}
      style={selected ? { backgroundColor: NAVY } : undefined}
    >
      <Text
        className={`text-center text-sm font-semibold ${selected ? "text-white" : "text-slate-700"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function DespensaScreen({ navigation }: DespensaHomeProps) {
  const { houseId, loading: houseLoading } = useActiveHouseId();
  const { showToast } = useToast();
  const [items, setItems] = useState<FridgeItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [storageChip, setStorageChip] =
    useState<(typeof STORAGE_CHIPS)[number]["key"]>("all");
  const [categoryChip, setCategoryChip] =
    useState<(typeof CATEGORY_CHIPS)[number]["key"]>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  /** Após escanear sem data na base/QR: mostrar aviso forte até o usuário ajustar a validade. */
  const [expiryNotFromScan, setExpiryNotFromScan] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] =
    useState<FridgeCategory>("laticinios");
  const [formStorage, setFormStorage] = useState<StorageZone>("despensa");
  const [formLocation, setFormLocation] = useState("");
  const [formQty, setFormQty] = useState("1");
  const [formUnit, setFormUnit] = useState("unid");
  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });

  useEffect(() => {
    if (!houseId) return;
    return subscribeFridgeItems(houseId, setItems);
  }, [houseId]);

  const filtered = useMemo(() => {
    let list = items;
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q));
    if (storageChip !== "all") {
      list = list.filter((i) => getStorageZone(i) === storageChip);
    }
    if (categoryChip !== "all") {
      list = list.filter((i) => i.category === categoryChip);
    }
    return list;
  }, [items, query, storageChip, categoryChip]);

  const stats = useMemo(() => countFridgeByStatus(filtered), [filtered]);

  const { attention, byCategory } = useMemo(() => {
    const att: FridgeItemRow[] = [];
    const okByCat: Record<FridgeCategory, FridgeItemRow[]> = {
      laticinios: [],
      vegetais: [],
      congelados: [],
      carnes: [],
      graos: [],
      bebidas: [],
      doces_snacks: [],
      outros: [],
    };
    for (const it of filtered) {
      const st = getExpiryStatus(it.expiryDate);
      if (st !== "ok") att.push(it);
      else okByCat[it.category].push(it);
    }
    att.sort((a, b) => a.expiryDate - b.expiryDate);
    return { attention: att, byCategory: okByCat };
  }, [filtered]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormCategory("laticinios");
    setFormStorage("despensa");
    setFormLocation("");
    setFormQty("1");
    setFormUnit("unid");
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setFormDate(d);
  }, []);

  const closeItemModal = useCallback(() => {
    setAddOpen(false);
    setEditingItemId(null);
    setExpiryNotFromScan(false);
    setShowDate(false);
    resetForm();
  }, [resetForm]);

  const openAddModal = useCallback(() => {
    resetForm();
    setEditingItemId(null);
    setExpiryNotFromScan(false);
    setShowDate(false);
    setAddOpen(true);
  }, [resetForm]);

  const openEditModal = useCallback((it: FridgeItemRow) => {
    setFormName(it.name);
    setFormCategory(it.category);
    setFormStorage(getStorageZone(it));
    setFormLocation(it.location === "—" ? "" : it.location);
    setFormQty(String(it.quantity));
    setFormUnit(it.unit);
    setFormDate(new Date(it.expiryDate));
    setEditingItemId(it.id);
    setExpiryNotFromScan(false);
    setShowDate(false);
    setAddOpen(true);
  }, []);

  const applyScanResult = useCallback(
    (r: ScanFillResult) => {
      setFormName(r.name);
      setFormCategory(r.category);
      if (r.quantity) {
        const q = Math.max(
          1,
          Math.floor(parseFloat(r.quantity.replace(",", ".")) || 1),
        );
        setFormQty(String(q));
      }
      if (r.unit) setFormUnit(r.unit);
      if (r.expiryTimestampMs != null) {
        setFormDate(new Date(r.expiryTimestampMs));
      }
      if (r.storageSuggestion) {
        setFormStorage(r.storageSuggestion);
      }
      setExpiryNotFromScan(r.expiryTimestampMs == null);
      const tipo = r.typeLabel ? ` Tipo na base: ${r.typeLabel}.` : "";
      const valHint =
        r.expiryTimestampMs != null
          ? " Validade preenchida a partir da base ou do QR."
          : "";
      if (r.source === "openfoodfacts") {
        showToast({
          type: "success",
          title: "Produto encontrado",
          message: `Open Food Facts.${tipo}${valHint} A validade do seu lote costuma não vir no código — confira na embalagem.`,
        });
      } else if (r.source === "ean_unknown") {
        showToast({
          type: "info",
          title: "Código de barras",
          message:
            "Produto não encontrado na base. Ajuste o nome e a validade conforme a embalagem.",
        });
      } else {
        showToast({
          type: "info",
          title: "QR / texto",
          message: `Confira nome, tipo e validade antes de salvar.${valHint}`,
        });
      }
    },
    [showToast],
  );

  const handleSaveItem = async () => {
    if (!houseId) return;
    const name = formName.trim();
    if (!name) {
      showToast({
        type: "error",
        title: "Nome",
        message: "Informe o nome do item.",
      });
      return;
    }
    const qty = Math.max(1, parseInt(formQty, 10) || 1);
    const expiryDate = endOfDayMs(formDate.getTime());
    setSaving(true);
    try {
      if (editingItemId) {
        await updateFridgeItem(houseId, editingItemId, {
          name,
          category: formCategory,
          storage: formStorage,
          location: formLocation.trim() || "—",
          quantity: qty,
          unit: formUnit.trim() || "unid",
          expiryDate,
        });
        showToast({ type: "success", title: "Item atualizado", message: name });
      } else {
        await addFridgeItem(houseId, {
          name,
          category: formCategory,
          storage: formStorage,
          location: formLocation.trim() || "—",
          quantity: qty,
          unit: formUnit.trim() || "unid",
          expiryDate,
        });
        showToast({ type: "success", title: "Item adicionado", message: name });
      }
      closeItemModal();
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

  const onDelete = (it: FridgeItemRow) => {
    if (!houseId) return;
    Alert.alert("Remover", `Excluir "${it.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFridgeItem(houseId, it.id);
            showToast({ type: "info", title: "Removido", message: it.name });
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

  const onQtyDelta = async (it: FridgeItemRow, delta: number) => {
    if (!houseId) return;
    const next = it.quantity + delta;
    if (next < 1) return;
    try {
      await updateFridgeItem(houseId, it.id, { quantity: next });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onConsume = async (it: FridgeItemRow) => {
    if (!houseId) return;
    try {
      await consumeFridgeItem(houseId, it);
      showToast({ type: "success", title: "Consumido", message: it.name });
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
      <SafeAreaView
        className="flex-1 items-center justify-center bg-white"
        edges={["top"]}
      >
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!houseId) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-white px-8"
        edges={["top"]}
      >
        <Text className="text-center text-base text-slate-600">
          Nenhuma casa ativa. Conclua o onboarding para usar a despensa.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <DespensaSubScreenNav active="despensa" navigation={navigation} />
      <View className="border-b border-slate-100 bg-white px-5 pb-3 pt-1">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text
              className="text-[26px] font-bold leading-tight"
              style={{ color: NAVY }}
            >
              Despensa
            </Text>
            <Text className="mt-1 text-sm leading-5 text-slate-500">
              Itens da geladeira, armários e demais espaços — tudo organizado
              aqui.
            </Text>
          </View>
          <Pressable
            className="h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white"
            style={shadowSm}
            onPress={() =>
              showToast({
                type: "info",
                title: "Filtros",
                message: "Em breve.",
              })
            }
          >
            <Settings2 size={20} color="#475569" />
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-0" style={shadowSm}>
          <Search size={20} color="#94a3b8" />
          <TextInput
            className="ml-3 flex-1 text-base text-slate-900"
            placeholder="Buscar itens..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Onde guarda
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 8 }}
        >
          {STORAGE_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              selected={storageChip === c.key}
              onPress={() => setStorageChip(c.key)}
            />
          ))}
        </ScrollView>

        <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Tipo de alimento
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 8 }}
        >
          {CATEGORY_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              selected={categoryChip === c.key}
              onPress={() => setCategoryChip(c.key)}
            />
          ))}
        </ScrollView> */}
      </View>

      <View className="flex-row gap-2.5 bg-[#f8fafc] px-5 py-4">
        <View className="flex-1 rounded-2xl border border-red-100 bg-rose-50 px-2 py-3">
          <Text className="text-center text-2xl font-bold text-red-600">
            {stats.expired}
          </Text>
          <Text className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-red-700">
            Vencidos
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-amber-100 bg-amber-50 px-2 py-3">
          <Text className="text-center text-2xl font-bold text-amber-700">
            {stats.expiring}
          </Text>
          <Text className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Vencendo
          </Text>
        </View>
        <View className="flex-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-3">
          <Text className="text-center text-2xl font-bold text-emerald-600">
            {stats.ok}
          </Text>
          <Text className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Em dia
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-[#f8fafc] px-5 pt-2"
        contentContainerStyle={{ paddingBottom: FAB_SCROLL_PADDING_BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        {attention.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              Requer atenção
            </Text>
            {attention.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                onEdit={() => openEditModal(it)}
                onDelete={() => onDelete(it)}
                onQtyDelta={(d) => onQtyDelta(it, d)}
                onConsume={() => onConsume(it)}
                onCart={() =>
                  showToast({
                    type: "info",
                    title: "Compras",
                    message: "Lista de compras em breve.",
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {CATEGORY_ORDER.map((cat) => {
          const list = byCategory[cat];
          if (list.length === 0) return null;
          return (
            <View key={cat} className="mb-4">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABEL[cat]}
              </Text>
              {list.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  onEdit={() => openEditModal(it)}
                  onDelete={() => onDelete(it)}
                  onQtyDelta={(d) => onQtyDelta(it, d)}
                  onConsume={() => onConsume(it)}
                  onCart={() =>
                    showToast({
                      type: "info",
                      title: "Compras",
                      message: "Lista de compras em breve.",
                    })
                  }
                />
              ))}
            </View>
          );
        })}

        {filtered.length === 0 ? (
          <View className="items-center py-20">
            <Text className="text-center text-[15px] text-slate-500">
              {items.length === 0
                ? "Nenhum item na despensa. Toque em + para adicionar."
                : "Nenhum item com esses filtros."}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <FloatingAddButton onPress={openAddModal} />

      <Modal visible={addOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="max-h-[92%] rounded-t-3xl bg-white px-5 pb-8 pt-5" style={shadow2xl}>
            <Text className="text-xl font-bold" style={{ color: NAVY }}>
              {editingItemId ? "Editar item" : "Novo item na despensa"}
            </Text>
            <Text className="mt-1 text-sm text-slate-500">
              {editingItemId
                ? "Altere os dados e salve."
                : "Indique se está na geladeira ou em outro local da despensa."}
            </Text>
            {!editingItemId ? (
              <Pressable
                className="mt-4 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed py-3.5"
                style={{ borderColor: `${PRIMARY}55` }}
                onPress={() => {
                  if (Platform.OS === "web") {
                    showToast({
                      type: "info",
                      title: "Escanear",
                      message:
                        "No celular, use o app para ler códigos com a câmera.",
                    });
                    return;
                  }
                  setScanOpen(true);
                }}
              >
                <Ionicons name="scan-outline" size={22} color={PRIMARY} />
                <Text
                  className="text-[15px] font-semibold"
                  style={{ color: PRIMARY }}
                >
                  Escanear código de barras ou QR
                </Text>
              </Pressable>
            ) : null}
            <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Nome
              </Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base text-slate-900"
                placeholder="Ex: Arroz, iogurte..."
                value={formName}
                onChangeText={setFormName}
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Guardar em
              </Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {(["geladeira", "despensa", "outros"] as StorageZone[]).map(
                  (k) => (
                    <Pressable
                      key={k}
                      onPress={() => setFormStorage(k)}
                      className={`rounded-full px-3 py-2 ${
                        formStorage === k
                          ? ""
                          : "border border-slate-200 bg-white"
                      }`}
                      style={
                        formStorage === k
                          ? { backgroundColor: NAVY }
                          : undefined
                      }
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          formStorage === k ? "text-white" : "text-slate-700"
                        }`}
                      >
                        {STORAGE_LABEL[k]}
                      </Text>
                    </Pressable>
                  ),
                )}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Categoria
              </Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {CATEGORY_ORDER.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setFormCategory(k)}
                    className={`rounded-full px-3 py-2 ${
                      formCategory === k
                        ? ""
                        : "border border-slate-200 bg-white"
                    }`}
                    style={
                      formCategory === k ? { backgroundColor: NAVY } : undefined
                    }
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        formCategory === k ? "text-white" : "text-slate-700"
                      }`}
                    >
                      {CATEGORY_LABEL[k]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Local detalhado
              </Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base text-slate-900"
                placeholder="Ex: Prateleira de cima, gaveta..."
                value={formLocation}
                onChangeText={setFormLocation}
              />
              <View className="mb-3 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">
                    Qtd
                  </Text>
                  <TextInput
                    className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base text-slate-900"
                    keyboardType="number-pad"
                    value={formQty}
                    onChangeText={setFormQty}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">
                    Unidade
                  </Text>
                  <TextInput
                    className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base text-slate-900"
                    placeholder="unid, g..."
                    value={formUnit}
                    onChangeText={setFormUnit}
                  />
                </View>
              </View>
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Validade
              </Text>
              {expiryNotFromScan && !editingItemId ? (
                <View className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Text className="text-sm font-semibold text-amber-900">
                    Data de vencimento não veio do código
                  </Text>
                  <Text className="mt-1.5 text-sm leading-5 text-amber-950/90">
                    Não foi possível obter a validade automaticamente. O código
                    identifica o produto, não o lote da sua embalagem — informe
                    a data impressa na embalagem abaixo.
                  </Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  setShowDate(true);
                  setExpiryNotFromScan(false);
                }}
                className="mb-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5"
              >
                <Text className="text-base text-slate-900">
                  {formDate.toLocaleDateString("pt-BR")}
                </Text>
              </Pressable>
              {showDate ? (
                <>
                  <DateTimePicker
                    value={formDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, d) => {
                      if (Platform.OS === "android") setShowDate(false);
                      if (d) {
                        setFormDate(d);
                        setExpiryNotFromScan(false);
                      }
                    }}
                  />
                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => setShowDate(false)}
                      className="mt-2 self-end py-2"
                    >
                      <Text
                        className="font-semibold"
                        style={{ color: PRIMARY }}
                      >
                        OK
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </ScrollView>
            <View className="mt-2 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-2xl border border-slate-200 py-4"
                onPress={closeItemModal}
              >
                <Text className="font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl py-4"
                style={{ backgroundColor: PRIMARY }}
                onPress={handleSaveItem}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">
                    {editingItemId ? "Salvar alterações" : "Salvar"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onFilled={applyScanResult}
        onError={(msg) =>
          showToast({
            type: "error",
            title: "Scanner",
            message: msg,
          })
        }
      />
    </SafeAreaView>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
  onQtyDelta,
  onConsume,
  onCart,
}: {
  item: FridgeItemRow;
  onEdit: () => void;
  onDelete: () => void;
  onQtyDelta: (d: number) => void;
  onConsume: () => void;
  onCart: () => void;
}) {
  const status = getExpiryStatus(item.expiryDate);
  const badge = getExpiryBadgeLabel(item.expiryDate);
  const bar = leftBarClass(status);
  const bgBadge = badgeClass(status);
  const txBadge = badgeTextClass(status);
  const showStepper = item.unit !== "g" && item.unit !== "kg";
  const zone = getStorageZone(item);

  return (
    <View className="mb-3 overflow-hidden rounded-2xl border border-slate-100 bg-white" style={shadowMd}>
      <View className="flex-row">
        <View className={`w-[5px] ${bar}`} />
        <View className="flex-1 p-4">
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.name}`}
            className="active:opacity-80"
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-slate-50">
                  <CategoryIcon cat={item.category} />
                </View>
                <View className="max-w-[72%]">
                  <Text className="text-base font-semibold text-slate-900">
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    {STORAGE_LABEL[zone]} • {CATEGORY_LABEL[item.category]} •{" "}
                    {item.location}
                  </Text>
                </View>
              </View>
              <View className={`rounded-full px-2 py-1 ${bgBadge}`}>
                <Text className={`text-[10px] font-bold ${txBadge}`}>
                  {badge}
                </Text>
              </View>
            </View>

            <Text className="mt-3 text-sm text-slate-600">
              {item.quantity} {item.unit}
            </Text>
          </Pressable>

          <View className="mt-2 flex-row items-center justify-end gap-2">
            <Pressable
              onPress={onDelete}
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              accessibilityLabel="Excluir"
            >
              <Trash2 size={18} color="#64748b" />
            </Pressable>
            <Pressable
              onPress={onCart}
              className="h-9 w-9 items-center justify-center rounded-full bg-blue-50"
              accessibilityLabel="Compras"
            >
              <ShoppingCart size={18} color={PRIMARY} />
            </Pressable>
          </View>

          {showStepper ? (
            <View className="mt-3 flex-row items-center justify-between border-t border-slate-100 pt-3">
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => onQtyDelta(-1)}
                  className="h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white"
                >
                  <Minus size={18} color="#475569" />
                </Pressable>
                <Pressable onPress={onEdit}>
                  <Text className="min-w-[24px] text-center text-base font-semibold text-slate-900">
                    {item.quantity}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onQtyDelta(1)}
                  className="h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white"
                >
                  <Plus size={18} color="#475569" />
                </Pressable>
              </View>
              <Pressable
                onPress={onConsume}
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: `${PRIMARY}18` }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: PRIMARY }}
                >
                  Consumir
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-3 flex-row justify-end border-t border-slate-100 pt-3">
              <Pressable
                onPress={onConsume}
                className="rounded-xl px-4 py-2"
                style={{ backgroundColor: `${PRIMARY}18` }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: PRIMARY }}
                >
                  Consumir
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
