import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();
