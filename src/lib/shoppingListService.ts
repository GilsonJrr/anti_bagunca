import { onValue, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";

export type ShoppingCategory =
  | "hortifruti"
  | "limpeza"
  | "mercearia"
  | "bebidas"
  | "higiene"
  | "outros";

export type ShoppingItem = {
  name: string;
  category: ShoppingCategory;
  quantity: number;
  unit: string;
  purchased: boolean;
  /** Texto em sugestões (ex.: “Acabando na geladeira”) */
  hint?: string;
  /** Exibir na faixa “Sugestões inteligentes” */
  isSmartSuggestion?: boolean;
  addedByName?: string;
  createdAt: number;
};

export type ShoppingItemRow = ShoppingItem & { id: string };

const itemsPath = (houseId: string) => `houses/${houseId}/shoppingList/items`;

/** RTDB rejects `undefined`; omit keys instead of writing undefined. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * Partial update: optional string fields use `null` to remove when cleared (undefined → delete in DB).
 */
function shoppingPatchForUpdate(
  patch: Partial<
    Pick<
      ShoppingItem,
      | "name"
      | "category"
      | "quantity"
      | "unit"
      | "purchased"
      | "hint"
      | "isSmartSuggestion"
      | "addedByName"
    >
  >
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) {
      if (k === "hint" || k === "addedByName") out[k] = null;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function subscribeShoppingItems(
  houseId: string,
  callback: (items: ShoppingItemRow[]) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, itemsPath(houseId));
  return onValue(r, (snap) => {
    const val = snap.val() as Record<string, ShoppingItem> | null;
    if (!val) {
      callback([]);
      return;
    }
    callback(
      Object.entries(val).map(([id, data]) => ({
        id,
        ...data,
      }))
    );
  });
}

export async function addShoppingItem(
  houseId: string,
  item: Omit<ShoppingItem, "createdAt">
): Promise<string> {
  const db = getFirebaseDatabase();
  const newRef = push(ref(db, itemsPath(houseId)));
  const id = newRef.key;
  if (!id) throw new Error("Falha ao criar item.");
  const payload: ShoppingItem = { ...item, createdAt: Date.now() };
  await set(newRef, stripUndefined(payload as unknown as Record<string, unknown>));
  return id;
}

export async function updateShoppingItem(
  houseId: string,
  itemId: string,
  patch: Partial<
    Pick<
      ShoppingItem,
      | "name"
      | "category"
      | "quantity"
      | "unit"
      | "purchased"
      | "hint"
      | "isSmartSuggestion"
      | "addedByName"
    >
  >
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `${itemsPath(houseId)}/${itemId}`), shoppingPatchForUpdate(patch));
}

export async function deleteShoppingItem(houseId: string, itemId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `${itemsPath(houseId)}/${itemId}`));
}

export async function clearPurchasedItems(houseId: string, purchasedIds: string[]): Promise<void> {
  const db = getFirebaseDatabase();
  await Promise.all(purchasedIds.map((id) => remove(ref(db, `${itemsPath(houseId)}/${id}`))));
}
