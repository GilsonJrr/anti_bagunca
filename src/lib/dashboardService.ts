import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import { getFirebaseDatabase } from "./firebase";

export type TaskPriority = "high" | "medium" | "low";

export type HouseTask = {
  title: string;
  assigneeName: string;
  points: number;
  completed: boolean;
  createdAt: number;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  frequencyLabel?: string;
  /** Fim do dia do prazo (ms), como em despensa. */
  dueDate?: number;
  completedAt?: number;
  completedByName?: string;
  /** Quem marcou como concluída (para desmarcar e reverter XP só o mesmo usuário). */
  completedByUid?: string;
};

export type HouseTaskRow = HouseTask & { id: string };

type TaskStored = Omit<HouseTaskRow, "id">;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export type HouseStats = {
  mealsCount: number;
  purchasesCount: number;
};

const LEVEL_SEGMENT = 500;

const LEVEL_TITLES = [
  "Iniciante",
  "Organizado",
  "Casa em dia",
  "Super Organizado",
  "Lenda doméstica",
];

export function getLevelFromPoints(points: number): {
  level: number;
  title: string;
  currentInSegment: number;
  segmentMax: number;
} {
  const safe = Math.max(0, Math.floor(points));
  const level = Math.floor(safe / LEVEL_SEGMENT) + 1;
  const currentInSegment = safe % LEVEL_SEGMENT;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? `Nível ${level}`;
  return {
    level,
    title,
    currentInSegment,
    segmentMax: LEVEL_SEGMENT,
  };
}

export function subscribeMemberPoints(
  houseId: string,
  uid: string,
  callback: (points: number) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/memberPoints/${uid}`);
  return onValue(r, (snap) => {
    const v = snap.val();
    callback(typeof v === "number" ? v : Number(v) || 0);
  });
}

/** Pontos por membro (`uid` → pontos). Usado para ranking e nível da casa (coop). */
export function subscribeHouseMemberPointsMap(
  houseId: string,
  callback: (map: Record<string, number>) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/memberPoints`);
  return onValue(r, (snap) => {
    const val = snap.val() as Record<string, unknown> | null;
    if (!val) {
      callback({});
      return;
    }
    const map: Record<string, number> = {};
    for (const [uid, v] of Object.entries(val)) {
      map[uid] = typeof v === "number" ? v : Number(v) || 0;
    }
    callback(map);
  });
}

/** UIDs dos membros da casa (chaves em `houses/{id}/members`). */
export function subscribeHouseMemberIds(
  houseId: string,
  callback: (uids: string[]) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/members`);
  return onValue(r, (snap) => {
    const val = snap.val() as Record<string, true> | null;
    if (!val) {
      callback([]);
      return;
    }
    callback(Object.keys(val));
  });
}

export function subscribeHouseTasks(
  houseId: string,
  callback: (tasks: HouseTaskRow[]) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/tasks`);
  return onValue(r, (snap) => {
    const val = snap.val() as Record<string, TaskStored> | null | undefined;
    if (!val) {
      callback([]);
      return;
    }
    const tasks: HouseTaskRow[] = Object.entries(val).map(([id, t]) => ({
      id,
      ...t,
    }));
    callback(tasks.sort((a, b) => b.createdAt - a.createdAt));
  });
}

export function subscribeHouseStats(
  houseId: string,
  callback: (stats: HouseStats) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/stats`);
  return onValue(r, (snap) => {
    const v = snap.val() as Partial<HouseStats> | null;
    callback({
      mealsCount: typeof v?.mealsCount === "number" ? v.mealsCount : 0,
      purchasesCount: typeof v?.purchasesCount === "number" ? v.purchasesCount : 0,
    });
  });
}

/** Opcional: incrementa pontos do membro (ex.: ao concluir tarefa). */
export async function addMemberPoints(houseId: string, uid: string, delta: number): Promise<void> {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/memberPoints/${uid}`);
  const snap = await get(r);
  const cur = Number(snap.val()) || 0;
  await set(r, Math.max(0, cur + delta));
}

/** Só quem concluiu pode desmarcar; tarefas antigas sem `completedByUid` não permitem desmarcar. */
export function canCurrentUserUncompleteTask(task: HouseTaskRow, currentUid: string): boolean {
  if (!task.completed) return false;
  if (!task.completedByUid) return false;
  return task.completedByUid === currentUid;
}

export async function addHouseTask(
  houseId: string,
  task: Omit<HouseTask, "createdAt" | "completed">
): Promise<string> {
  const db = getFirebaseDatabase();
  const newRef = push(ref(db, `houses/${houseId}/tasks`));
  const id = newRef.key;
  if (!id) throw new Error("Falha ao criar tarefa.");
  const payload: HouseTask = {
    ...task,
    completed: false,
    createdAt: Date.now(),
  };
  await set(newRef, stripUndefined(payload as unknown as Record<string, unknown>));
  return id;
}

export async function updateHouseTask(
  houseId: string,
  taskId: string,
  patch: Partial<
    Pick<
      HouseTask,
      | "title"
      | "assigneeName"
      | "points"
      | "priority"
      | "estimatedMinutes"
      | "frequencyLabel"
      | "dueDate"
    >
  >
): Promise<void> {
  const db = getFirebaseDatabase();
  await update(
    ref(db, `houses/${houseId}/tasks/${taskId}`),
    stripUndefined(patch as unknown as Record<string, unknown>)
  );
}

export async function deleteHouseTask(houseId: string, taskId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `houses/${houseId}/tasks/${taskId}`));
}

export async function setTaskCompleted(
  houseId: string,
  taskId: string,
  completed: boolean,
  opts?: {
    uid?: string;
    memberPointsDelta?: number;
    completedByName?: string;
  }
): Promise<void> {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/tasks/${taskId}`);
  if (completed) {
    await update(r, {
      completed: true,
      completedAt: Date.now(),
      completedByName: opts?.completedByName ?? null,
      completedByUid: opts?.uid ?? null,
    });
    if (opts?.uid && opts.memberPointsDelta && opts.memberPointsDelta > 0) {
      await addMemberPoints(houseId, opts.uid, opts.memberPointsDelta);
    }
  } else {
    const snap = await get(r);
    const task = snap.val() as TaskStored | null;
    if (!task?.completed) return;

    const actor = opts?.uid;
    if (!actor) {
      throw new Error("Usuário não identificado para desmarcar a tarefa.");
    }

    const completerUid = task.completedByUid;
    if (completerUid && completerUid !== actor) {
      throw new Error("Só quem concluiu pode desmarcar esta tarefa.");
    }
    if (!completerUid) {
      throw new Error(
        "Esta tarefa foi concluída antes do registro de quem completou. Não é possível desmarcar."
      );
    }

    const pts = typeof task.points === "number" ? task.points : Number(task.points) || 0;

    await update(r, {
      completed: false,
      completedAt: null,
      completedByName: null,
      completedByUid: null,
    });

    if (pts > 0) {
      await addMemberPoints(houseId, completerUid, -pts);
    }
  }
}
