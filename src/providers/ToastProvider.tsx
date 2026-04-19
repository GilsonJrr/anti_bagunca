import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastType = "success" | "error" | "info";

export type ToastPayload = {
  type: ToastType;
  message: string;
  title?: string;
  durationMs?: number;
};

type ToastItem = ToastPayload & { id: string };

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Cores em `style` — evita className dinâmico + shadow no NativeWind (quebra contexto do React Navigation). */
const COLORS: Record<ToastType, { bg: string; border: string; title: string; text: string }> = {
  success: {
    bg: "#ecfdf5",
    border: "#a7f3d0",
    title: "#064e3b",
    text: "#065f46",
  },
  error: {
    bg: "#fef2f2",
    border: "#fecaca",
    title: "#7f1d1d",
    text: "#991b1b",
  },
  info: {
    bg: "#f8fafc",
    border: "#e2e8f0",
    title: "#0f172a",
    text: "#334155",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [opacity, translateY]);

  const palette = COLORS[toast.type];

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View
        style={{
          maxWidth: "100%",
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <View style={{ minWidth: 0, flex: 1 }}>
            {toast.title ? (
              <Text style={{ fontSize: 14, fontWeight: "600", color: palette.title }}>{toast.title}</Text>
            ) : null}
            <Text
              style={{
                marginTop: toast.title ? 2 : 0,
                fontSize: 14,
                lineHeight: 20,
                color: palette.text,
              }}
            >
              {toast.message}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={onDismiss}
            style={{ borderRadius: 999, backgroundColor: "rgba(0,0,0,0.05)", paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#475569" }}>✕</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (payload: ToastPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const durationMs = payload.durationMs ?? 4200;
      const item: ToastItem = { ...payload, id };
      setToasts((prev) => [...prev.slice(-2), item]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 999999,
          elevation: 999999,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
