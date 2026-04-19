import type { FridgeCategory, FridgeItemRow } from "./fridgeService";
import {
  getExpiryBadgeLabel,
  getExpiryStatus,
  startOfDayMs,
} from "./fridgeService";
import type { ShoppingCategory } from "./shoppingListService";

const DAY_MS = 86_400_000;

const DISCRETE_UNITS = new Set([
  "un",
  "unid",
  "und",
  "pct",
  "cx",
  "duzia",
  "dúzia",
  "un.",
]);

/** Mapeia tipo da despensa → categoria da lista de compras. */
export function fridgeCategoryToShoppingCategory(
  c: FridgeCategory
): ShoppingCategory {
  switch (c) {
    case "vegetais":
      return "hortifruti";
    case "bebidas":
      return "bebidas";
    case "laticinios":
    case "congelados":
    case "graos":
    case "doces_snacks":
      return "mercearia";
    case "carnes":
      return "outros";
    default:
      return "outros";
  }
}

function daysFromToday(expiryDate: number): number {
  const today = startOfDayMs(Date.now());
  const expDay = startOfDayMs(expiryDate);
  return Math.round((expDay - today) / DAY_MS);
}

function isLowQuantity(quantity: number, unit: string): boolean {
  const u = unit.trim().toLowerCase();
  if (quantity <= 1) return true;
  if (quantity <= 2 && DISCRETE_UNITS.has(u)) return true;
  return false;
}

function needsSuggestion(it: FridgeItemRow): boolean {
  if (isLowQuantity(it.quantity, it.unit)) return true;
  const st = getExpiryStatus(it.expiryDate);
  if (st !== "ok") return true;
  const d = daysFromToday(it.expiryDate);
  return d >= 0 && d <= 7;
}

function buildHint(it: FridgeItemRow): string {
  const parts: string[] = [];
  if (isLowQuantity(it.quantity, it.unit)) {
    parts.push(`Pouca quantidade (${it.quantity} ${it.unit})`);
  }
  const st = getExpiryStatus(it.expiryDate);
  if (st === "expired") {
    parts.push("Vencido na despensa");
  } else if (st === "expiring") {
    parts.push(getExpiryBadgeLabel(it.expiryDate));
  } else {
    const d = daysFromToday(it.expiryDate);
    if (d >= 0 && d <= 7) {
      parts.push(
        d === 0 ? "Vence hoje" : `Vence em ${d} ${d === 1 ? "dia" : "dias"}`
      );
    }
  }
  return parts.join(" · ");
}

function score(it: FridgeItemRow): number {
  let s = 0;
  const st = getExpiryStatus(it.expiryDate);
  if (st === "expired") s += 120;
  else if (st === "expiring") s += 90;
  else {
    const d = daysFromToday(it.expiryDate);
    if (d >= 0 && d <= 7) s += 55 - Math.min(d, 7) * 4;
  }
  if (isLowQuantity(it.quantity, it.unit)) s += 30;
  return s;
}

export type FridgeShoppingSuggestion = {
  fridgeItemId: string;
  name: string;
  hint: string;
  category: ShoppingCategory;
  score: number;
};

/**
 * Itens da despensa/geladeira que merecem lembrete na lista: pouca quantidade ou validade crítica / próxima (até 7 dias).
 * Exclui nomes já presentes em `excludeNamesLower` (lista pendente).
 */
export function buildFridgeShoppingSuggestions(
  fridge: FridgeItemRow[],
  excludeNamesLower: Set<string>
): FridgeShoppingSuggestion[] {
  const out: FridgeShoppingSuggestion[] = [];
  for (const it of fridge) {
    const key = it.name.trim().toLowerCase();
    if (!key || excludeNamesLower.has(key)) continue;
    if (!needsSuggestion(it)) continue;
    out.push({
      fridgeItemId: it.id,
      name: it.name.trim(),
      hint: buildHint(it),
      category: fridgeCategoryToShoppingCategory(it.category),
      score: score(it),
    });
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"));
  return out;
}
