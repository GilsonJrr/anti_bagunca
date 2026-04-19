import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";

export type FridgeCategory =
  | "laticinios"
  | "vegetais"
  | "congelados"
  | "carnes"
  | "graos"
  | "bebidas"
  | "doces_snacks"
  | "outros";

/** Onde o item fica guardado dentro da despensa (geladeira é um dos locais). */
export type StorageZone = "geladeira" | "despensa" | "outros";

export type FridgeItem = {
  name: string;
  category: FridgeCategory;
  location: string;
  quantity: number;
  unit: string;
  /** fim do dia de validade (timestamp ms) */
  expiryDate: number;
  createdAt: number;
  /** Se ausente, considera-se “despensa” (exceto migrações antigas). */
  storage?: StorageZone;
};

export type FridgeItemRow = FridgeItem & { id: string };

export function getStorageZone(item: FridgeItemRow): StorageZone {
  return item.storage ?? "despensa";
}

const DAY_MS = 86_400_000;

export function startOfDayMs(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(t: number): number {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Status visual: vencido | vence em até 2 dias (inclusive) | ok */
export function getExpiryStatus(expiryDate: number): "expired" | "expiring" | "ok" {
  const expEnd = endOfDayMs(expiryDate);
  const todayStart = startOfDayMs(Date.now());
  if (expEnd < todayStart) return "expired";
  const expDayStart = startOfDayMs(expiryDate);
  const daysFromToday = Math.round((expDayStart - todayStart) / DAY_MS);
  if (daysFromToday <= 2) return "expiring";
  return "ok";
}

export function getExpiryBadgeLabel(expiryDate: number): string {
  const status = getExpiryStatus(expiryDate);
  if (status === "expired") return "Vencido";
  const today = startOfDayMs(Date.now());
  const expDay = startOfDayMs(expiryDate);
  const diffDays = Math.round((expDay - today) / DAY_MS);
  if (diffDays === 0) return "Vence hoje";
  if (diffDays === 1) return "Vence amanhã";
  if (diffDays === 2) return "Em 2 dias";
  return "Em dia";
}

export function countFridgeByStatus(items: FridgeItemRow[]): {
  expired: number;
  expiring: number;
  ok: number;
} {
  let expired = 0;
  let expiring = 0;
  let ok = 0;
  for (const it of items) {
    const s = getExpiryStatus(it.expiryDate);
    if (s === "expired") expired++;
    else if (s === "expiring") expiring++;
    else ok++;
  }
  return { expired, expiring, ok };
}

/** Itens da despensa no RTDB (antes o nó se chamava `fridge`). */
const itemsPath = (houseId: string) => `houses/${houseId}/despensa/items`;
const legacyFridgeItemsPath = (houseId: string) => `houses/${houseId}/fridge/items`;

/**
 * Migra uma vez `fridge/items` → `despensa/items` (mescla por id; dados em despensa têm prioridade).
 * Idempotente: com `fridge/items` vazio não faz nada.
 */
export async function migrateLegacyFridgeItemsToDespensa(houseId: string): Promise<void> {
  const db = getFirebaseDatabase();
  const oldRef = ref(db, legacyFridgeItemsPath(houseId));
  const newRef = ref(db, itemsPath(houseId));
  const oldSnap = await get(oldRef);
  if (!oldSnap.exists()) return;
  const oldVal = oldSnap.val() as Record<string, FridgeItem>;
  const newSnap = await get(newRef);
  const newVal = (newSnap.val() as Record<string, FridgeItem> | null) ?? {};
  const merged: Record<string, FridgeItem> = { ...oldVal, ...newVal };
  await set(newRef, merged);
  await remove(oldRef);
}

export function subscribeFridgeItems(
  houseId: string,
  callback: (items: FridgeItemRow[]) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, itemsPath(houseId));
  let innerUnsub: (() => void) | null = null;
  let cancelled = false;

  migrateLegacyFridgeItemsToDespensa(houseId).finally(() => {
    if (cancelled) return;
    innerUnsub = onValue(r, (snap) => {
      const val = snap.val() as Record<string, FridgeItem> | null;
      if (!val) {
        callback([]);
        return;
      }
      const rows: FridgeItemRow[] = Object.entries(val).map(([id, data]) => ({
        id,
        ...data,
      }));
      callback(rows);
    });
  });

  return () => {
    cancelled = true;
    innerUnsub?.();
  };
}

export async function addFridgeItem(houseId: string, item: Omit<FridgeItem, "createdAt">): Promise<string> {
  const db = getFirebaseDatabase();
  const newRef = push(ref(db, itemsPath(houseId)));
  const id = newRef.key;
  if (!id) throw new Error("Falha ao criar item.");
  const payload: FridgeItem = {
    ...item,
    createdAt: Date.now(),
  };
  await set(newRef, payload);
  return id;
}

export async function updateFridgeItem(
  houseId: string,
  itemId: string,
  patch: Partial<
    Pick<FridgeItem, "quantity" | "name" | "location" | "category" | "unit" | "expiryDate" | "storage">
  >
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `${itemsPath(houseId)}/${itemId}`), patch);
}

export async function deleteFridgeItem(houseId: string, itemId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `${itemsPath(houseId)}/${itemId}`));
}

export async function consumeFridgeItem(houseId: string, item: FridgeItemRow): Promise<void> {
  if (item.quantity <= 1) {
    await deleteFridgeItem(houseId, item.id);
  } else {
    await updateFridgeItem(houseId, item.id, { quantity: item.quantity - 1 });
  }
}
