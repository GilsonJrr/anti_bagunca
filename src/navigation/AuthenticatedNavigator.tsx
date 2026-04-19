import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { getOnboardingStatus } from "../lib/houseService";
import { isRealtimeDatabaseConfigured } from "../lib/firebase";
import { useAuth } from "../providers/AuthProvider";
import { MainTabNavigator } from "./MainTabNavigator";
import { CreateHouseScreen } from "../screens/onboarding/CreateHouseScreen";
import { SetupPreferencesScreen } from "../screens/onboarding/SetupPreferencesScreen";
import { HouseSettingsScreen } from "../screens/HouseSettingsScreen";

export type AuthedStackParamList = {
  Loading: undefined;
  Home: undefined;
  CreateHouse: undefined;
  SetupPreferences: { houseId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<AuthedStackParamList>();

type LoadingProps = NativeStackScreenProps<AuthedStackParamList, "Loading">;

function AuthedLoadingScreen({ navigation }: LoadingProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    let cancelled = false;

    async function run() {
      if (!isRealtimeDatabaseConfigured()) {
        if (!cancelled) {
          navigation.reset({ index: 0, routes: [{ name: "CreateHouse" }] });
        }
        return;
      }

      try {
        let s = await getOnboardingStatus(uid);
        if (cancelled) return;
        if (!s.activeHouseId) {
          await new Promise((r) => setTimeout(r, 450));
          if (cancelled) return;
          s = await getOnboardingStatus(uid);
        }
        if (s.activeHouseId) {
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: "CreateHouse" }] });
        }
      } catch {
        if (!cancelled) {
          navigation.reset({ index: 0, routes: [{ name: "CreateHouse" }] });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, navigation]);

  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <ActivityIndicator size="large" color="#0f172a" />
    </View>
  );
}

export function AuthenticatedNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Loading"
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      <Stack.Screen name="Loading" component={AuthedLoadingScreen} />
      <Stack.Screen name="CreateHouse" component={CreateHouseScreen} />
      <Stack.Screen name="SetupPreferences" component={SetupPreferencesScreen} />
      <Stack.Screen name="Home" component={MainTabNavigator} />
      <Stack.Screen name="Settings" component={HouseSettingsScreen} />
    </Stack.Navigator>
  );
}
