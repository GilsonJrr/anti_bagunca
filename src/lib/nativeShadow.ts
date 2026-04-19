import type { ViewStyle } from "react-native";

/** Sombras via `style` — evita `shadow-*` no NativeWind, que pode disparar erro falso de contexto de navegação (expo/expo#38423). */
export const shadowSm: ViewStyle = {
  elevation: 2,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
};

export const shadowMd: ViewStyle = {
  elevation: 4,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
};

export const shadowLg: ViewStyle = {
  elevation: 6,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
};

export const shadowXl: ViewStyle = {
  elevation: 8,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 16,
};

export const shadow2xl: ViewStyle = {
  elevation: 12,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.14,
  shadowRadius: 24,
};
