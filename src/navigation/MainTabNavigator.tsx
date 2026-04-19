import type { NavigatorScreenParams } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Home,
  ListTodo,
  Package,
  ShoppingCart,
  Trophy,
} from "lucide-react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DespensaStackParamList } from "./DespensaStackNavigator";
import { DespensaStackNavigator } from "./DespensaStackNavigator";
import { HomeScreen } from "../screens/HomeScreen";
import { ShoppingListScreen } from "../screens/compras/ShoppingListScreen";
import { TasksScreen } from "../screens/tasks/TasksScreen";
import { NiveisScreen } from "../screens/niveis/NiveisScreen";

export type MainTabParamList = {
  Inicio: undefined;
  Despensa: NavigatorScreenParams<DespensaStackParamList>;
  Compras: undefined;
  Tarefas: undefined;
  Niveis: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const PRIMARY = "#2D5AF0";

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "ios" ? 8 : 12);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: "#94a3b8",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e2e8f0",
          paddingTop: 8,
          paddingBottom: bottomPad,
          height: 58 + bottomPad,
        },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          tabBarLabel: "Início",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Despensa"
        component={DespensaStackNavigator}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Package size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Compras"
        component={ShoppingListScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <ShoppingCart size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Tarefas"
        component={TasksScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <ListTodo size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Niveis"
        component={NiveisScreen}
        options={{
          tabBarLabel: "Níveis",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Trophy size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
