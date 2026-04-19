import { onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { getFirebaseDatabase, isRealtimeDatabaseConfigured } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";

export function useActiveHouseId(): { houseId: string | null; loading: boolean } {
  const { user } = useAuth();
  const [houseId, setHouseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isRealtimeDatabaseConfigured()) {
      setHouseId(null);
      setLoading(false);
      return;
    }
    const db = getFirebaseDatabase();
    const r = ref(db, `users/${user.uid}/activeHouseId`);
    const unsub = onValue(r, (snap) => {
      setHouseId(snap.val() ?? null);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  return { houseId, loading };
}
