import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuthInstance, isFirebaseConfigured } from "../lib/firebase";

type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  /** Enquanto true, não navegar para Main (cadastro + entrar na casa por código no RTDB). */
  registrationJoinPending: boolean;
  setRegistrationJoinPending: (v: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [registrationJoinPending, setRegistrationJoinPending] = useState(false);

  useEffect(() => {
    if (!user) setRegistrationJoinPending(false);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setUser(null);
      setInitializing(false);
      return;
    }
    const auth = getFirebaseAuthInstance();
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const value = useMemo(
    () => ({ user, initializing, registrationJoinPending, setRegistrationJoinPending }),
    [user, initializing, registrationJoinPending]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
