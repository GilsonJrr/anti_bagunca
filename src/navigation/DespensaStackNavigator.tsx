import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DespensaScreen } from "../screens/DespensaScreen";
import { RefeicoesProntasScreen } from "../screens/refeicoes/RefeicoesProntasScreen";

export type DespensaStackParamList = {
  DespensaHome: undefined;
  RefeicoesProntas: undefined;
};

const Stack = createNativeStackNavigator<DespensaStackParamList>();

export function DespensaStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DespensaHome" component={DespensaScreen} />
      <Stack.Screen name="RefeicoesProntas" component={RefeicoesProntasScreen} />
    </Stack.Navigator>
  );
}
