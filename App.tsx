import "./global.css";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerJoinGateRef } from "./src/lib/registerJoinGate";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { rootNavigationRef } from "./src/navigation/rootNavigationRef";
import { AuthProvider, useAuth } from "./src/providers/AuthProvider";
import { QueryProvider } from "./src/providers/QueryProvider";
import { ToastProvider } from "./src/providers/ToastProvider";

function AuthNavigationSync({ navReady }: { navReady: boolean }) {
  const { user, initializing, registrationJoinPending } = useAuth();

  useEffect(() => {
    if (!navReady) return;
    if (!rootNavigationRef.isReady()) return;

    if (initializing) {
      rootNavigationRef.reset({ index: 0, routes: [{ name: "Splash" }] });
    } else if (user) {
      if (registrationJoinPending || registerJoinGateRef.current) return;
      rootNavigationRef.reset({ index: 0, routes: [{ name: "Main" }] });
    } else {
      rootNavigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
    }
  }, [navReady, user, initializing, registrationJoinPending]);

  return null;
}

export default function App() {
  const [navReady, setNavReady] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={rootNavigationRef} onReady={() => setNavReady(true)}>
          <QueryProvider>
            <ToastProvider>
              <AuthProvider>
                <AuthNavigationSync navReady={navReady} />
                <RootNavigator />
              </AuthProvider>
            </ToastProvider>
          </QueryProvider>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
