import { endOfDayMs, startOfDayMs } from "./fridgeService";
import type { HouseTaskRow } from "./dashboardService";

export type TaskTab = "hoje" | "semana" | "pendentes";

export function startOfWeekMondayMs(now: number): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return startOfDayMs(d.getTime());
}

export function endOfWeekSundayMs(now: number): number {
  const start = startOfWeekMondayMs(now);
  const d = new Date(start);
  d.setDate(d.getDate() + 6);
  return endOfDayMs(d.getTime());
}

/** Hoje: vencidas ou com prazo até o fim de hoje. */
export function isInHojeTab(task: HouseTaskRow, now: number = Date.now()): boolean {
  if (task.completed || task.dueDate == null) return false;
  return task.dueDate <= endOfDayMs(now);
}

/** Esta semana: prazo depois de hoje e até o fim do domingo da semana atual. */
export function isInSemanaTab(task: HouseTaskRow, now: number = Date.now()): boolean {
  if (task.completed || task.dueDate == null) return false;
  const endToday = endOfDayMs(now);
  const endWeek = endOfWeekSundayMs(now);
  return task.dueDate > endToday && task.dueDate <= endWeek;
}

/** Pendentes: sem data ou com prazo depois desta semana. */
export function isInPendentesTab(task: HouseTaskRow, now: number = Date.now()): boolean {
  if (task.completed) return false;
  if (task.dueDate == null) return true;
  return task.dueDate > endOfWeekSundayMs(now);
}

export function filterTasksForTab(
  tasks: HouseTaskRow[],
  tab: TaskTab,
  now: number = Date.now()
): HouseTaskRow[] {
  const open = tasks.filter((t) => !t.completed);
  if (tab === "hoje") return open.filter((t) => isInHojeTab(t, now));
  if (tab === "semana") return open.filter((t) => isInSemanaTab(t, now));
  return open.filter((t) => isInPendentesTab(t, now));
}

export function countPendingHoje(tasks: HouseTaskRow[], now: number = Date.now()): number {
  return tasks.filter((t) => !t.completed && isInHojeTab(t, now)).length;
}
