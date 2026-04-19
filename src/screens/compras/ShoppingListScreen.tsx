import { Ionicons } from "@expo/vector-icons";
import {
  Check,
  Minus,
  Plus,
  Search,
  Share2,
  ShoppingCart,
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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarcodeScannerModal } from "../../components/BarcodeScannerModal";
import {
  FAB_SCROLL_PADDING_BOTTOM,
  FloatingAddButton,
  SCROLL_PADDING_WITHOUT_FAB,
} from "../../components/FloatingAddButton";
import { useActiveHouseId } from "../../hooks/useActiveHouseId";
import { shadowSm } from "../../lib/nativeShadow";
import {
  buildFridgeShoppingSuggestions,
  type FridgeShoppingSuggestion,
} from "../../lib/fridgeShoppingSuggestions";
import type { FridgeItemRow } from "../../lib/fridgeService";
import { subscribeFridgeItems } from "../../lib/fridgeService";
import type { ScanFillResult } from "../../lib/productBarcodeLookup";
import {
  addShoppingItem,
  clearPurchasedItems,
  deleteShoppingItem,
  subscribeShoppingItems,
  updateShoppingItem,
  type ShoppingCategory,
  type ShoppingItemRow,
} from "../../lib/shoppingListService";
import { useToast } from "../../providers/ToastProvider";

const PRIMARY = "#2D5AF0";
const NAVY = "#0f172a";

const CATEGORY_LABEL: Record<ShoppingCategory, string> = {
  hortifruti: "HORTIFRUTI",
  limpeza: "LIMPEZA",
  mercearia: "MERCEARIA",
  bebidas: "BEBIDAS",
  higiene: "HIGIENE",
  outros: "OUTROS",
};

const CATEGORY_ORDER: ShoppingCategory[] = [
  "hortifruti",
  "mercearia",
  "bebidas",
  "limpeza",
  "higiene",
  "outros",
];

const CATEGORY_DOT: Record<ShoppingCategory, string> = {
  hortifruti: "bg-emerald-500",
  limpeza: "bg-blue-500",
  mercearia: "bg-amber-500",
  bebidas: "bg-sky-500",
  higiene: "bg-violet-500",
  outros: "bg-slate-400",
};

const UNITS = ["un", "kg", "g", "l", "ml", "cx", "pct"];

export function ShoppingListScreen() {
  const { houseId, loading: houseLoading } = useActiveHouseId();
  const { showToast } = useToast();
  const [items, setItems] = useState<ShoppingItemRow[]>([]);
  const [fridgeItems, setFridgeItems] = useState<FridgeItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [mercadoMode, setMercadoMode] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<ShoppingCategory>("mercearia");
  const [formQty, setFormQty] = useState("1");
  const [formUnit, setFormUnit] = useState("un");
  const [formHint, setFormHint] = useState("");
  const [formSuggestion, setFormSuggestion] = useState(false);

  useEffect(() => {
    if (!houseId) return;
    return subscribeShoppingItems(houseId, setItems);
  }, [houseId]);

  useEffect(() => {
    if (!houseId) return;
    return subscribeFridgeItems(houseId, setFridgeItems);
  }, [houseId]);

  const q = query.trim().toLowerCase();

  const matchesQuery = useCallback(
    (it: ShoppingItemRow) => {
      if (!q) return true;
      return it.name.toLowerCase().includes(q);
    },
    [q]
  );

  const pending = useMemo(
    () => items.filter((i) => !i.purchased && matchesQuery(i)),
    [items, matchesQuery]
  );
  const purchased = useMemo(
    () => items.filter((i) => i.purchased && matchesQuery(i)),
    [items, matchesQuery]
  );

  const pendingCount = useMemo(() => items.filter((i) => !i.purchased).length, [items]);

  /** Pendentes que já estão na lista (exclui só “sugestão inteligente” ainda não confirmada com +). */
  const pendingOnListCount = useMemo(
    () => items.filter((i) => !i.purchased && !i.isSmartSuggestion).length,
    [items]
  );

  const pendingNameLower = useMemo(
    () => new Set(pending.map((i) => i.name.trim().toLowerCase()).filter(Boolean)),
    [pending]
  );

  const fridgeSuggestions = useMemo(
    () => buildFridgeShoppingSuggestions(fridgeItems, pendingNameLower),
    [fridgeItems, pendingNameLower]
  );

  const fridgeSuggestionsFiltered = useMemo(() => {
    if (!q) return fridgeSuggestions;
    return fridgeSuggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.hint.toLowerCase().includes(q)
    );
  }, [fridgeSuggestions, q]);

  const legacySmartSuggestions = useMemo(
    () => items.filter((i) => i.isSmartSuggestion && !i.purchased && matchesQuery(i)),
    [items, matchesQuery]
  );

  const legacySmartStrip = useMemo(() => {
    const fridgeNames = new Set(
      fridgeSuggestionsFiltered.map((s) => s.name.trim().toLowerCase())
    );
    return legacySmartSuggestions.filter(
      (i) => !fridgeNames.has(i.name.trim().toLowerCase())
    );
  }, [legacySmartSuggestions, fridgeSuggestionsFiltered]);

  const stripHasItems =
    fridgeSuggestionsFiltered.length > 0 || legacySmartStrip.length > 0;

  const byCategory = useMemo(() => {
    const map: Record<ShoppingCategory, ShoppingItemRow[]> = {
      hortifruti: [],
      limpeza: [],
      mercearia: [],
      bebidas: [],
      higiene: [],
      outros: [],
    };
    for (const it of pending) {
      if (it.isSmartSuggestion) continue;
      map[it.category].push(it);
    }
    return map;
  }, [pending]);

  const flatPendingRows = useMemo(
    () => CATEGORY_ORDER.flatMap((cat) => byCategory[cat]),
    [byCategory]
  );

  const openNew = useCallback(() => {
    setEditing(null);
    setFormName("");
    setFormCategory("mercearia");
    setFormQty("1");
    setFormUnit("un");
    setFormHint("");
    setFormSuggestion(false);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((it: ShoppingItemRow) => {
    setEditing(it);
    setFormName(it.name);
    setFormCategory(it.category);
    setFormQty(String(it.quantity));
    setFormUnit(it.unit);
    setFormHint(it.hint ?? "");
    setFormSuggestion(Boolean(it.isSmartSuggestion));
    setModalOpen(true);
  }, []);

  const applyScan = useCallback((r: ScanFillResult) => {
    setFormName(r.name);
    setFormCategory("mercearia");
    setEditing(null);
    setFormQty(r.quantity ?? "1");
    setFormUnit(r.unit ?? "un");
    setFormHint("");
    setFormSuggestion(false);
    setModalOpen(true);
  }, []);

  const handleSaveItem = async () => {
    if (!houseId) return;
    const name = formName.trim();
    if (!name) {
      showToast({ type: "error", title: "Nome", message: "Informe o nome do item." });
      return;
    }
    const qty = Math.max(0.01, parseFloat(formQty.replace(",", ".")) || 1);
    setSaving(true);
    try {
      if (editing) {
        await updateShoppingItem(houseId, editing.id, {
          name,
          category: formCategory,
          quantity: qty,
          unit: formUnit.trim() || "un",
          hint: formHint.trim() || undefined,
          isSmartSuggestion: formSuggestion,
        });
        showToast({ type: "success", title: "Atualizado", message: name });
      } else {
        await addShoppingItem(houseId, {
          name,
          category: formCategory,
          quantity: qty,
          unit: formUnit.trim() || "un",
          purchased: false,
          hint: formHint.trim() || undefined,
          isSmartSuggestion: formSuggestion,
        });
        showToast({ type: "success", title: "Item adicionado", message: name });
      }
      setModalOpen(false);
      setQuery("");
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

  const togglePurchased = async (it: ShoppingItemRow) => {
    if (!houseId) return;
    try {
      await updateShoppingItem(houseId, it.id, { purchased: !it.purchased });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onQtyDelta = async (it: ShoppingItemRow, delta: number) => {
    if (!houseId) return;
    const next = Math.max(0.01, it.quantity + delta);
    try {
      await updateShoppingItem(houseId, it.id, { quantity: next });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const addQuickFromSearch = async () => {
    const name = query.trim();
    if (!name || !houseId) return;
    try {
      await addShoppingItem(houseId, {
        name,
        category: "mercearia",
        quantity: 1,
        unit: "un",
        purchased: false,
      });
      setQuery("");
      showToast({ type: "success", title: "Adicionado", message: name });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const onClearPurchased = () => {
    const ids = items.filter((i) => i.purchased).map((i) => i.id);
    if (ids.length === 0) return;
    Alert.alert("Limpar comprados", `Remover ${ids.length} itens da lista?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: async () => {
          if (!houseId) return;
          try {
            await clearPurchasedItems(houseId, ids);
            showToast({ type: "info", title: "Lista atualizada", message: "Itens comprados removidos." });
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

  const addSuggestionToList = async (it: ShoppingItemRow) => {
    if (!houseId) return;
    try {
      await updateShoppingItem(houseId, it.id, { isSmartSuggestion: false });
      showToast({ type: "success", title: "Na lista", message: it.name });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const addFridgeSuggestionToList = async (s: FridgeShoppingSuggestion) => {
    if (!houseId) return;
    try {
      await addShoppingItem(houseId, {
        name: s.name,
        category: s.category,
        quantity: 1,
        unit: "un",
        purchased: false,
        hint: s.hint,
      });
      showToast({ type: "success", title: "Na lista", message: s.name });
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
          Nenhuma casa ativa. Conclua o onboarding para usar a lista de compras.
        </Text>
      </SafeAreaView>
    );
  }

  const m = mercadoMode;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <View className={`border-b border-slate-100 ${m ? "px-4 pb-2 pt-1" : "px-5 pb-3 pt-2"}`}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text
              className={`font-bold leading-tight ${m ? "text-[32px]" : "text-[26px]"}`}
              style={{ color: NAVY }}
            >
              {m ? "Compras" : "Lista de Compras"}
            </Text>
            <Text className={`mt-1 text-slate-500 ${m ? "text-lg" : "text-sm"}`}>
              {m
                ? `${pendingOnListCount} ${pendingOnListCount === 1 ? "item" : "itens"} na lista`
                : `${pendingCount} ${pendingCount === 1 ? "item pendente" : "itens pendentes"}`}
            </Text>
          </View>
          <View className="items-end">
            <Text
              className={`font-bold uppercase tracking-wide text-slate-400 ${m ? "text-xs" : "text-[10px]"}`}
            >
              Mercado
            </Text>
            <Switch
              value={mercadoMode}
              onValueChange={setMercadoMode}
              trackColor={{ false: "#e2e8f0", true: `${PRIMARY}88` }}
              thumbColor={mercadoMode ? PRIMARY : "#f4f4f5"}
            />
          </View>
        </View>

        <View
          className={`mt-3 flex-row items-center rounded-full border border-slate-200 bg-[#f8fafc] ${
            m ? "px-4 py-3" : "px-3 py-2"
          }`}
          style={shadowSm}
        >
          <Search size={m ? 26 : 20} color="#94a3b8" />
          <TextInput
            className={`ml-2 flex-1 text-slate-900 ${m ? "py-1 text-xl" : "py-2 text-base"}`}
            placeholder="Buscar ou adicionar..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={addQuickFromSearch}
            returnKeyType="done"
          />
          <Pressable
            className="p-2"
            onPress={() => {
              if (Platform.OS === "web") {
                showToast({
                  type: "info",
                  title: "Escanear",
                  message: "Use o app no celular para escanear códigos.",
                });
                return;
              }
              setScanOpen(true);
            }}
          >
            <Ionicons name="scan-outline" size={m ? 28 : 24} color={PRIMARY} />
          </Pressable>
          {query.trim() ? (
            <Pressable
              onPress={addQuickFromSearch}
              className={`rounded-full bg-slate-900 ${m ? "px-3.5 py-2" : "px-3 py-1.5"}`}
            >
              <Plus size={m ? 22 : 18} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        {!m ? (
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-200">
                <Text className="text-xs font-bold text-slate-600">A</Text>
              </View>
              <View className="h-2 w-2 rounded-full bg-emerald-500" />
              <Text className="text-xs text-slate-600">Online agora</Text>
            </View>
            <Pressable
              onPress={() =>
                showToast({ type: "info", title: "Compartilhar", message: "Em breve." })
              }
              className="flex-row items-center gap-1"
            >
              <Share2 size={16} color={PRIMARY} />
              <Text className="text-sm font-semibold" style={{ color: PRIMARY }}>
                Compartilhar
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        className={`flex-1 ${m ? "bg-white px-4 pt-3" : "bg-[#f8fafc] px-5 pt-4"}`}
        contentContainerStyle={{
          paddingBottom: m ? SCROLL_PADDING_WITHOUT_FAB : FAB_SCROLL_PADDING_BOTTOM,
        }}
        showsVerticalScrollIndicator={false}
      >
        {stripHasItems ? (
          <View className="mb-6">
            <Text
              className={`mb-1 font-bold uppercase tracking-wider text-slate-500 ${
                m ? "text-base" : "text-xs"
              }`}
            >
              Sugestões da despensa
            </Text>
            <Text className={`mb-3 text-slate-400 ${m ? "text-base" : "text-xs"}`}>
              Pouca quantidade ou validade próxima (até 7 dias)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: m ? 16 : 12 }}
            >
              {fridgeSuggestionsFiltered.map((s) => (
                <View
                  key={s.fridgeItemId}
                  className={`rounded-2xl border border-slate-100 bg-white ${
                    m ? "w-[260px] p-4" : "w-[180px] p-3"
                  }`}
                  style={shadowSm}
                >
                  <Text
                    className={`font-semibold text-slate-900 ${m ? "text-xl" : "text-base"}`}
                    numberOfLines={2}
                  >
                    {s.name}
                  </Text>
                  <Text
                    className={`mt-2 text-slate-500 ${m ? "text-base leading-snug" : "text-xs"}`}
                    numberOfLines={3}
                  >
                    {s.hint}
                  </Text>
                  <Pressable
                    onPress={() => addFridgeSuggestionToList(s)}
                    className={`mt-4 items-center justify-center self-end rounded-full ${
                      m ? "h-12 w-12" : "h-9 w-9"
                    }`}
                    style={{ backgroundColor: `${PRIMARY}18` }}
                  >
                    <Plus size={m ? 26 : 20} color={PRIMARY} />
                  </Pressable>
                </View>
              ))}
              {legacySmartStrip.map((it) => (
                <View
                  key={it.id}
                  className={`rounded-2xl border border-slate-100 bg-white ${
                    m ? "w-[260px] p-4" : "w-[180px] p-3"
                  }`}
                  style={shadowSm}
                >
                  <Text
                    className={`font-semibold text-slate-900 ${m ? "text-xl" : "text-base"}`}
                    numberOfLines={2}
                  >
                    {it.name}
                  </Text>
                  {it.hint ? (
                    <Text
                      className={`mt-2 text-slate-500 ${m ? "text-base leading-snug" : "text-xs"}`}
                      numberOfLines={3}
                    >
                      {it.hint}
                    </Text>
                  ) : (
                    <Text className={`mt-2 text-slate-400 ${m ? "text-sm" : "text-xs"}`}>
                      Sugestão manual
                    </Text>
                  )}
                  <Pressable
                    onPress={() => addSuggestionToList(it)}
                    className={`mt-4 items-center justify-center self-end rounded-full ${
                      m ? "h-12 w-12" : "h-9 w-9"
                    }`}
                    style={{ backgroundColor: `${PRIMARY}18` }}
                  >
                    <Plus size={m ? 26 : 20} color={PRIMARY} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {m ? (
          flatPendingRows.length > 0 ? (
            <View className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {flatPendingRows.map((it, idx) => (
                <ShoppingRow
                  key={it.id}
                  item={it}
                  isLast={idx === flatPendingRows.length - 1}
                  onToggle={() => togglePurchased(it)}
                  onPress={() => openEdit(it)}
                  onQtyDelta={(d) => onQtyDelta(it, d)}
                  mercado
                />
              ))}
            </View>
          ) : null
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const list = byCategory[cat];
            if (list.length === 0) return null;
            return (
              <View key={cat} className="mb-5">
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className={`h-2.5 w-2.5 rounded-full ${CATEGORY_DOT[cat]}`} />
                    <Text className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {CATEGORY_LABEL[cat]}
                    </Text>
                  </View>
                  <Text className="text-xs text-slate-400">
                    {list.length} {list.length === 1 ? "item" : "itens"}
                  </Text>
                </View>
                <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                  {list.map((it, idx) => (
                    <ShoppingRow
                      key={it.id}
                      item={it}
                      isLast={idx === list.length - 1}
                      onToggle={() => togglePurchased(it)}
                      onPress={() => openEdit(it)}
                      onQtyDelta={(d) => onQtyDelta(it, d)}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {!m && purchased.length > 0 ? (
          <View className="mb-6">
            <View className="mb-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Check size={18} color="#16a34a" strokeWidth={2.5} />
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Comprados
                </Text>
              </View>
              <Pressable onPress={onClearPurchased}>
                <Text className="text-sm font-semibold text-red-600">Limpar</Text>
              </Pressable>
            </View>
            <View className="overflow-hidden rounded-2xl border border-slate-100 bg-white opacity-95">
              {purchased.map((it, idx) => (
                <ShoppingRow
                  key={it.id}
                  item={it}
                  isLast={idx === purchased.length - 1}
                  onToggle={() => togglePurchased(it)}
                  onPress={() => openEdit(it)}
                  onQtyDelta={(d) => onQtyDelta(it, d)}
                  purchasedStyle
                />
              ))}
            </View>
          </View>
        ) : null}

        {m
          ? flatPendingRows.length === 0 &&
            !stripHasItems && (
              <View className="items-center py-16">
                <ShoppingCart size={m ? 56 : 48} color="#cbd5e1" />
                <Text
                  className={`mt-4 text-center text-slate-500 ${m ? "text-xl" : "text-[15px]"}`}
                >
                  Lista vazia. Use a busca acima para adicionar.
                </Text>
              </View>
            )
          : pending.length === 0 &&
            purchased.length === 0 &&
            !stripHasItems && (
              <View className="items-center py-16">
                <ShoppingCart size={48} color="#cbd5e1" />
                <Text className="mt-4 text-center text-[15px] text-slate-500">
                  Sua lista está vazia. Busque acima, toque em + ou use o escanear.
                </Text>
              </View>
            )}
      </ScrollView>

      <FloatingAddButton onPress={openNew} visible={!mercadoMode} />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end bg-black/40"
        >
          <View className="max-h-[88%] rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <Text className="text-xl font-bold" style={{ color: NAVY }}>
              {editing ? "Editar item" : "Novo item"}
            </Text>
            <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
              <Text className="mb-1 text-sm font-medium text-slate-700">
                Nome <Text className="text-sm font-semibold text-red-500">*</Text>
              </Text>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                value={formName}
                onChangeText={setFormName}
                placeholder="Nome do produto"
              />
              <Text className="mb-1 text-sm font-medium text-slate-700">Categoria</Text>
              <View className="mb-3 flex-row flex-wrap gap-2">
                {CATEGORY_ORDER.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setFormCategory(k)}
                    className={`rounded-full px-3 py-2 ${
                      formCategory === k ? "" : "border border-slate-200 bg-white"
                    }`}
                    style={formCategory === k ? { backgroundColor: NAVY } : undefined}
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
              <View className="mb-3 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">Qtd</Text>
                  <TextInput
                    className="rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                    keyboardType="decimal-pad"
                    value={formQty}
                    onChangeText={setFormQty}
                  />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-medium text-slate-700">Unidade</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    <View className="flex-row flex-wrap gap-2">
                      {UNITS.map((u) => (
                        <Pressable
                          key={u}
                          onPress={() => setFormUnit(u)}
                          className={`rounded-full px-3 py-2 ${
                            formUnit === u ? "" : "border border-slate-200 bg-white"
                          }`}
                          style={formUnit === u ? { backgroundColor: NAVY } : undefined}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              formUnit === u ? "text-white" : "text-slate-700"
                            }`}
                          >
                            {u}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
              <View className="mb-1 flex-row flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Text className="text-sm font-medium text-slate-700">Observação</Text>
                <Text className="text-xs font-normal text-slate-400">opcional</Text>
              </View>
              <TextInput
                className="mb-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3.5 text-base"
                value={formHint}
                onChangeText={setFormHint}
                placeholder="Ex.: Acabando na geladeira (pode ficar em branco)"
              />
              <Pressable
                onPress={() => setFormSuggestion((v) => !v)}
                className="mb-4 flex-row items-center gap-2"
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded border ${
                    formSuggestion ? "" : "border-slate-300 bg-white"
                  }`}
                  style={
                    formSuggestion ? { backgroundColor: PRIMARY, borderColor: PRIMARY } : undefined
                  }
                >
                  {formSuggestion ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                </View>
                <Text className="text-sm text-slate-700">Mostrar em sugestões inteligentes</Text>
              </Pressable>
            </ScrollView>
            {editing ? (
              <Pressable
                className="mb-3 items-center py-2"
                onPress={() => {
                  if (!houseId || !editing) return;
                  Alert.alert("Remover", `Excluir "${editing.name}"?`, [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Excluir",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteShoppingItem(houseId, editing.id);
                          setModalOpen(false);
                          showToast({ type: "info", title: "Removido", message: editing.name });
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
                }}
              >
                <Text className="font-semibold text-red-600">Excluir item</Text>
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
                onPress={handleSaveItem}
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

      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onFilled={applyScan}
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

function ShoppingRow({
  item,
  isLast,
  onToggle,
  onPress,
  onQtyDelta,
  purchasedStyle,
  mercado,
}: {
  item: ShoppingItemRow;
  isLast: boolean;
  onToggle: () => void;
  onPress: () => void;
  onQtyDelta: (d: number) => void;
  purchasedStyle?: boolean;
  mercado?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center gap-3 ${mercado ? "px-4 py-4" : "px-4 py-3"} ${
        !isLast ? "border-b border-slate-100" : ""
      }`}
    >
      <Pressable onPress={onToggle} hitSlop={8}>
        <View
          className={`items-center justify-center rounded-md border-2 ${
            mercado ? "h-9 w-9" : "h-6 w-6"
          } ${item.purchased ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"}`}
        >
          {item.purchased ? (
            <Check size={mercado ? 18 : 14} color="#fff" strokeWidth={3} />
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={onPress} className="min-w-0 flex-1">
        <Text
          className={`${mercado ? "text-xl font-semibold" : "font-medium"} ${
            purchasedStyle || item.purchased ? "text-slate-400 line-through" : "text-slate-900"
          }`}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        {item.hint ? (
          <Text
            className={`mt-1 text-slate-500 ${mercado ? "text-base" : "mt-0.5 text-xs"}`}
            numberOfLines={2}
          >
            {item.hint}
          </Text>
        ) : null}
      </Pressable>
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={() => onQtyDelta(-1)}
          className={`items-center justify-center rounded-lg border border-slate-200 bg-white ${
            mercado ? "h-11 w-11" : "h-8 w-8"
          }`}
        >
          <Minus size={mercado ? 20 : 16} color="#475569" />
        </Pressable>
        <Text
          className={`min-w-[40px] text-center font-semibold text-slate-800 ${
            mercado ? "text-xl" : "text-sm"
          }`}
        >
          {item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(1).replace(".", ",")}
        </Text>
        <Text className={`text-slate-500 ${mercado ? "w-9 text-base" : "w-7 text-xs"}`}>{item.unit}</Text>
        <Pressable
          onPress={() => onQtyDelta(1)}
          className={`items-center justify-center rounded-lg border border-slate-200 bg-white ${
            mercado ? "h-11 w-11" : "h-8 w-8"
          }`}
        >
          <Plus size={mercado ? 20 : 16} color="#475569" />
        </Pressable>
      </View>
    </View>
  );
}
