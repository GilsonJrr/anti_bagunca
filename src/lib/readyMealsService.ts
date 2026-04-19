import { onValue, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";
import { endOfDayMs, getExpiryStatus, startOfDayMs } from "./fridgeService";

export type ReadyMealStorage = "geladeira" | "freezer";

export type ReadyMeal = {
  name: string;
  portions: number;
  prepDate: number;
  expiryDate: number;
  storage: ReadyMealStorage;
  /** Incluir no filtro “Almoço/Janta” */
  almocoJanta: boolean;
  createdAt: number;
};

export type ReadyMealRow = ReadyMeal & { id: string };

const mealsPath = (houseId: string) => `houses/${houseId}/readyMeals/items`;

export function subscribeReadyMeals(
  houseId: string,
  callback: (meals: ReadyMealRow[]) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, mealsPath(houseId));
  return onValue(r, (snap) => {
    const val = snap.val() as Record<string, ReadyMeal> | null;
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

export async function addReadyMeal(
  houseId: string,
  meal: Omit<ReadyMeal, "createdAt">
): Promise<string> {
  const db = getFirebaseDatabase();
  const newRef = push(ref(db, mealsPath(houseId)));
  const id = newRef.key;
  if (!id) throw new Error("Falha ao criar refeição.");
  await set(newRef, { ...meal, createdAt: Date.now() } satisfies ReadyMeal);
  return id;
}

export async function updateReadyMeal(
  houseId: string,
  mealId: string,
  patch: Partial<
    Pick<ReadyMeal, "name" | "portions" | "prepDate" | "expiryDate" | "storage" | "almocoJanta">
  >
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `${mealsPath(houseId)}/${mealId}`), patch);
}

export async function deleteReadyMeal(houseId: string, mealId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `${mealsPath(houseId)}/${mealId}`));
}

export async function consumeOnePortion(
  houseId: string,
  meal: ReadyMealRow
): Promise<void> {
  if (meal.portions <= 1) {
    await deleteReadyMeal(houseId, meal.id);
  } else {
    await updateReadyMeal(houseId, meal.id, { portions: meal.portions - 1 });
  }
}

export function filterReadyMeals(
  meals: ReadyMealRow[],
  chip: "todas" | ReadyMealStorage | "almoco_janta",
  query: string
): ReadyMealRow[] {
  const q = query.trim().toLowerCase();
  let list = meals;
  if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
  if (chip === "geladeira") list = list.filter((m) => m.storage === "geladeira");
  else if (chip === "freezer") list = list.filter((m) => m.storage === "freezer");
  else if (chip === "almoco_janta") list = list.filter((m) => m.almocoJanta);
  return list;
}

export function quickSuggestionMeals(meals: ReadyMealRow[]): ReadyMealRow[] {
  const soon = meals.filter((m) => getExpiryStatus(m.expiryDate) !== "ok");
  soon.sort((a, b) => a.expiryDate - b.expiryDate);
  return soon.slice(0, 8);
}

export function daysRemainingLabel(expiryDate: number): string {
  const today = startOfDayMs(Date.now());
  const exp = startOfDayMs(expiryDate);
  const days = Math.round((exp - today) / 86_400_000);
  if (days < 0) return "Vencido";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === 2) return "Em 2 dias";
  if (days < 30) return `${days} dias rest.`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "mês" : "meses"} rest.`;
}
