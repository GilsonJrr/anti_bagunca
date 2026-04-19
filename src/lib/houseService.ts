import { get, onValue, push, ref, remove, set, update } from "firebase/database";
import type { Database } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseDatabase, getFirebaseStorageInstance } from "./firebase";

const INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type HouseModules = {
  geladeira: boolean;
  refeicoes: boolean;
  compras: boolean;
  tarefas: boolean;
};

export type ReminderSlot = {
  enabled: boolean;
  time: string;
};

/** Preferências de notificação na UI (persistidas em `settings`). */
export type HouseNotificationPrefs = {
  /** Liga avisos de vencimento próximo (espelha `reminders.vencimentos.enabled`). */
  expiryReminderEnabled: boolean;
  /** Avisar quantos dias antes (ex.: 2). */
  expiryDaysBefore: number;
  assignedTasks: boolean;
  shoppingList: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: HouseNotificationPrefs = {
  expiryReminderEnabled: true,
  expiryDaysBefore: 2,
  assignedTasks: true,
  shoppingList: false,
};

export type HouseSettings = {
  setupCompleted: boolean;
  modules: HouseModules;
  reminders: {
    resumo_dia: ReminderSlot;
    vencimentos: ReminderSlot;
  };
  gamified_goals: {
    zero_desperdicio: boolean;
    super_organizado: boolean;
  };
  notificationPrefs?: HouseNotificationPrefs;
};

export const DEFAULT_HOUSE_SETTINGS: HouseSettings = {
  setupCompleted: false,
  modules: {
    geladeira: true,
    refeicoes: true,
    compras: false,
    tarefas: false,
  },
  reminders: {
    resumo_dia: { enabled: true, time: "08:00" },
    vencimentos: { enabled: true, time: "18:00" },
  },
  gamified_goals: {
    zero_desperdicio: true,
    super_organizado: false,
  },
};

function randomInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return code;
}

async function ensureUniqueInviteCode(db: Database): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomInviteCode();
    const snap = await get(ref(db, `inviteCodes/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error("Não foi possível gerar um código de convite. Tente novamente.");
}

export async function getOnboardingStatus(uid: string): Promise<{
  activeHouseId: string | null;
  setupComplete: boolean;
}> {
  const db = getFirebaseDatabase();
  const houseIdSnap = await get(ref(db, `users/${uid}/activeHouseId`));
  const activeHouseId = (houseIdSnap.val() as string | null | undefined) ?? null;
  if (!activeHouseId) {
    return {
      activeHouseId: null,
      setupComplete: false,
    };
  }
  const settingsSnap = await get(ref(db, `houses/${activeHouseId}/settings`));
  const settings = settingsSnap.val() as HouseSettings | null;
  return {
    activeHouseId,
    setupComplete: Boolean(settings?.setupCompleted),
  };
}

export async function uploadHousePhoto(houseId: string, localUri: string): Promise<string> {
  const storage = getFirebaseStorageInstance();
  const fileRef = storageRef(storage, `houses/${houseId}/photo.jpg`);
  const res = await fetch(localUri);
  const blob = await res.blob();
  await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(fileRef);
}

export type CreateHouseResult = {
  houseId: string;
  /** true se havia foto mas o upload no Storage falhou (casa criada sem foto). */
  photoUploadFailed: boolean;
};

export async function createHouseForUser(
  uid: string,
  name: string,
  photoUri: string | null
): Promise<CreateHouseResult> {
  const db = getFirebaseDatabase();
  const houseRef = push(ref(db, "houses"));
  const houseId = houseRef.key;
  if (!houseId) throw new Error("Falha ao criar casa.");

  let photoUrl: string | null = null;
  let photoUploadFailed = false;
  if (photoUri) {
    try {
      photoUrl = await uploadHousePhoto(houseId, photoUri);
    } catch {
      photoUploadFailed = true;
    }
  }

  const inviteCode = await ensureUniqueInviteCode(db);

  await set(houseRef, {
    name: name.trim(),
    photoUrl,
    adminId: uid,
    inviteCode,
    members: { [uid]: true },
    createdAt: Date.now(),
  });

  await set(ref(db, `inviteCodes/${inviteCode}`), houseId);
  await set(ref(db, `users/${uid}/activeHouseId`), houseId);
  await set(ref(db, `users/${uid}/onboardingStep`), 2);

  return { houseId, photoUploadFailed };
}

export async function joinHouseByInviteCode(uid: string, code: string): Promise<string> {
  const normalized = code.trim().toUpperCase().replace(/\s/g, "");
  if (normalized.length < 4) {
    throw new Error("Informe um código válido.");
  }
  const db = getFirebaseDatabase();
  const codeSnap = await get(ref(db, `inviteCodes/${normalized}`));
  if (!codeSnap.exists()) {
    throw new Error("Código não encontrado.");
  }
  const houseId = codeSnap.val() as string;
  await update(ref(db, `houses/${houseId}/members`), { [uid]: true });
  await set(ref(db, `users/${uid}/activeHouseId`), houseId);
  await set(ref(db, `users/${uid}/onboardingStep`), 2);
  for (let i = 0; i < 20; i++) {
    const check = await get(ref(db, `users/${uid}/activeHouseId`));
    if (check.val() === houseId) {
      return houseId;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return houseId;
}

/** Pedido de entrada aguardando aprovação do admin (`houses/{houseId}/pendingJoinRequests/{uid}`). */
export type PendingJoinRequestRow = {
  email: string | null;
  displayName: string | null;
  createdAt: number;
};

export type RequestJoinHouseResult = {
  houseId: string;
  /** Já tinha `activeHouseId` igual à casa do código */
  alreadyInHouse?: boolean;
  /** Era membro em `houses/.../members` mas sem `activeHouseId` — foi corrigido */
  syncedMembership?: boolean;
};

/** Resolve o código de convite para `houseId` (sem alterar dados). */
export async function resolveInviteCodeToHouseId(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase().replace(/\s/g, "");
  if (normalized.length < 4) {
    throw new Error("Informe um código válido.");
  }
  const db = getFirebaseDatabase();
  const codeSnap = await get(ref(db, `inviteCodes/${normalized}`));
  if (!codeSnap.exists()) {
    throw new Error("Código não encontrado.");
  }
  return codeSnap.val() as string;
}

/** Recoloca o usuário na casa após falha (ex.: saiu e o pedido falhou). */
export async function restoreUserToHouse(uid: string, houseId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await update(ref(db, `houses/${houseId}/members`), { [uid]: true });
  await set(ref(db, `users/${uid}/activeHouseId`), houseId);
  await set(ref(db, `users/${uid}/onboardingStep`), 2);
}

/**
 * Solicita entrada na casa pelo código (admin aprova na Home).
 * Corrige estado órfão (membro sem `activeHouseId`) em vez de falhar.
 */
export async function requestJoinHouseByInviteCode(
  uid: string,
  code: string,
  profile: { email: string | null; displayName: string | null }
): Promise<RequestJoinHouseResult> {
  const db = getFirebaseDatabase();
  const targetHouseId = await resolveInviteCodeToHouseId(code);

  const activeSnap = await get(ref(db, `users/${uid}/activeHouseId`));
  const currentActive = activeSnap.val() as string | undefined | null;

  if (currentActive === targetHouseId) {
    return { houseId: targetHouseId, alreadyInHouse: true };
  }
  if (currentActive) {
    throw new Error("Saia da casa atual em Configurações antes de solicitar entrar em outra.");
  }

  const memberSnap = await get(ref(db, `houses/${targetHouseId}/members/${uid}`));
  if (memberSnap.exists()) {
    await set(ref(db, `users/${uid}/activeHouseId`), targetHouseId);
    await set(ref(db, `users/${uid}/onboardingStep`), 2);
    return { houseId: targetHouseId, syncedMembership: true };
  }

  const userPendingSnap = await get(ref(db, `users/${uid}/pendingJoinRequest`));
  if (userPendingSnap.exists()) {
    throw new Error("Você já tem uma solicitação pendente. Aguarde a resposta do administrador.");
  }
  const pendingSnap = await get(ref(db, `houses/${targetHouseId}/pendingJoinRequests/${uid}`));
  if (pendingSnap.exists()) {
    throw new Error("Sua solicitação já está pendente.");
  }
  const createdAt = Date.now();
  await set(ref(db, `houses/${targetHouseId}/pendingJoinRequests/${uid}`), {
    email: profile.email,
    displayName: profile.displayName,
    createdAt,
  });
  await set(ref(db, `users/${uid}/pendingJoinRequest`), {
    houseId: targetHouseId,
    createdAt,
  });
  return { houseId: targetHouseId };
}

export function subscribeHousePendingJoinRequests(
  houseId: string,
  callback: (data: Record<string, PendingJoinRequestRow & { uid: string }>) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/pendingJoinRequests`);
  return onValue(r, (snap) => {
    const v = snap.val() as
      | Record<string, { email?: string | null; displayName?: string | null; createdAt?: number }>
      | null;
    if (!v) {
      callback({});
      return;
    }
    const out: Record<string, PendingJoinRequestRow & { uid: string }> = {};
    for (const uid of Object.keys(v)) {
      const row = v[uid];
      out[uid] = {
        uid,
        email: row.email ?? null,
        displayName: row.displayName ?? null,
        createdAt: row.createdAt ?? 0,
      };
    }
    callback(out);
  });
}

export function subscribeUserPendingJoinRequest(
  uid: string,
  callback: (data: { houseId: string; createdAt: number } | null) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `users/${uid}/pendingJoinRequest`);
  return onValue(r, (snap) => {
    const v = snap.val() as { houseId?: string; createdAt?: number } | null;
    if (!v?.houseId) {
      callback(null);
      return;
    }
    callback({ houseId: v.houseId, createdAt: v.createdAt ?? 0 });
  });
}

export async function approvePendingJoinRequest(
  houseId: string,
  requesterUid: string,
  adminUid: string
): Promise<void> {
  const db = getFirebaseDatabase();
  const houseSnap = await get(ref(db, `houses/${houseId}`));
  const adminId = (houseSnap.val() as { adminId?: string } | null)?.adminId;
  if (!adminId || adminId !== adminUid) {
    throw new Error("Apenas o administrador pode aprovar.");
  }
  const pendingSnap = await get(ref(db, `houses/${houseId}/pendingJoinRequests/${requesterUid}`));
  if (!pendingSnap.exists()) {
    throw new Error("Solicitação não encontrada.");
  }
  await update(ref(db, `houses/${houseId}/members`), { [requesterUid]: true });
  await set(ref(db, `users/${requesterUid}/activeHouseId`), houseId);
  await set(ref(db, `users/${requesterUid}/onboardingStep`), 2);
  await remove(ref(db, `houses/${houseId}/pendingJoinRequests/${requesterUid}`));
  await remove(ref(db, `users/${requesterUid}/pendingJoinRequest`));
}

export async function rejectPendingJoinRequest(
  houseId: string,
  requesterUid: string,
  adminUid: string
): Promise<void> {
  const db = getFirebaseDatabase();
  const houseSnap = await get(ref(db, `houses/${houseId}`));
  const adminId = (houseSnap.val() as { adminId?: string } | null)?.adminId;
  if (!adminId || adminId !== adminUid) {
    throw new Error("Apenas o administrador pode recusar.");
  }
  await remove(ref(db, `houses/${houseId}/pendingJoinRequests/${requesterUid}`));
  await remove(ref(db, `users/${requesterUid}/pendingJoinRequest`));
}

export async function saveHouseSettings(houseId: string, settings: HouseSettings): Promise<void> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `houses/${houseId}/settings`));
  const prev = mergeHouseSettingsRaw(snap.val() as HouseSettings | null);
  const next: HouseSettings = {
    ...prev,
    ...settings,
    modules: { ...prev.modules, ...settings.modules },
    reminders: {
      resumo_dia: { ...prev.reminders.resumo_dia, ...settings.reminders.resumo_dia },
      vencimentos: { ...prev.reminders.vencimentos, ...settings.reminders.vencimentos },
    },
    gamified_goals: { ...prev.gamified_goals, ...settings.gamified_goals },
    notificationPrefs: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...prev.notificationPrefs,
      ...settings.notificationPrefs,
    },
  };
  await set(ref(db, `houses/${houseId}/settings`), next);
}

export async function getHouseNameForUser(uid: string): Promise<string | null> {
  const db = getFirebaseDatabase();
  const houseIdSnap = await get(ref(db, `users/${uid}/activeHouseId`));
  const houseId = houseIdSnap.val() as string | null | undefined;
  if (!houseId) return null;
  const houseSnap = await get(ref(db, `houses/${houseId}/name`));
  const name = houseSnap.val() as string | null | undefined;
  return name ?? null;
}

export type HouseSummary = {
  name: string | null;
  inviteCode: string | null;
  adminId: string | null;
  memberUids: string[];
};

export function subscribeHouseSummary(
  houseId: string,
  callback: (data: HouseSummary | null) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}`);
  return onValue(r, (snap) => {
    const v = snap.val() as {
      name?: string;
      inviteCode?: string;
      adminId?: string;
      members?: Record<string, true>;
    } | null;
    if (!v) {
      callback(null);
      return;
    }
    const members = v.members ? Object.keys(v.members) : [];
    callback({
      name: v.name ?? null,
      inviteCode: v.inviteCode ?? null,
      adminId: v.adminId ?? null,
      memberUids: members,
    });
  });
}

export function subscribeHouseSettingsMerged(
  houseId: string,
  callback: (settings: HouseSettings) => void
): () => void {
  const db = getFirebaseDatabase();
  const r = ref(db, `houses/${houseId}/settings`);
  return onValue(r, (snap) => {
    const raw = snap.val() as HouseSettings | null;
    callback(mergeHouseSettingsRaw(raw));
  });
}

function mergeHouseSettingsRaw(raw: HouseSettings | null): HouseSettings {
  const base = raw ?? DEFAULT_HOUSE_SETTINGS;
  return {
    ...DEFAULT_HOUSE_SETTINGS,
    ...base,
    modules: { ...DEFAULT_HOUSE_SETTINGS.modules, ...base.modules },
    reminders: {
      resumo_dia: { ...DEFAULT_HOUSE_SETTINGS.reminders.resumo_dia, ...base.reminders?.resumo_dia },
      vencimentos: {
        ...DEFAULT_HOUSE_SETTINGS.reminders.vencimentos,
        ...base.reminders?.vencimentos,
      },
    },
    gamified_goals: { ...DEFAULT_HOUSE_SETTINGS.gamified_goals, ...base.gamified_goals },
    notificationPrefs: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...base.notificationPrefs,
      expiryReminderEnabled:
        base.notificationPrefs?.expiryReminderEnabled ??
        base.reminders?.vencimentos?.enabled ??
        DEFAULT_NOTIFICATION_PREFS.expiryReminderEnabled,
    },
  };
}

export async function updateHouseNotificationPrefs(
  houseId: string,
  patch: Partial<HouseNotificationPrefs>
): Promise<void> {
  const db = getFirebaseDatabase();
  const snap = await get(ref(db, `houses/${houseId}/settings`));
  const merged = mergeHouseSettingsRaw(snap.val() as HouseSettings | null);
  const nextPrefs: HouseNotificationPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...merged.notificationPrefs,
    ...patch,
  };
  await set(ref(db, `houses/${houseId}/settings`), {
    ...merged,
    notificationPrefs: nextPrefs,
    reminders: {
      ...merged.reminders,
      vencimentos: {
        ...merged.reminders.vencimentos,
        enabled: nextPrefs.expiryReminderEnabled,
      },
    },
  });
}

/** Remove o usuário da casa e limpa a casa ativa (volta ao fluxo de criar/entrar). */
export async function leaveHouse(uid: string, houseId: string): Promise<void> {
  const db = getFirebaseDatabase();
  await remove(ref(db, `houses/${houseId}/members/${uid}`));
  await remove(ref(db, `users/${uid}/activeHouseId`));
}
