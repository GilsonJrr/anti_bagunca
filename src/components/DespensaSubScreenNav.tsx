import type { NavigationProp } from "@react-navigation/native";
import { Pressable, Text, View } from "react-native";
import type { DespensaStackParamList } from "../navigation/DespensaStackNavigator";

const NAVY = "#0f172a";

type Props = {
  active: "despensa" | "refeicoes";
  navigation: NavigationProp<DespensaStackParamList>;
};

export function DespensaSubScreenNav({ active, navigation }: Props) {
  return (
    <View className="flex-row gap-2 px-5 pb-3 pt-1">
      <Pressable
        onPress={() => navigation.navigate("DespensaHome")}
        className="flex-1 rounded-2xl border py-2.5"
        style={
          active === "despensa"
            ? { backgroundColor: NAVY, borderColor: NAVY }
            : { borderColor: "#e2e8f0", backgroundColor: "#fff" }
        }
      >
        <Text
          className="text-center text-sm font-semibold"
          style={{ color: active === "despensa" ? "#fff" : "#475569" }}
        >
          Despensa
        </Text>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("RefeicoesProntas")}
        className="flex-1 rounded-2xl border py-2.5"
        style={
          active === "refeicoes"
            ? { backgroundColor: NAVY, borderColor: NAVY }
            : { borderColor: "#e2e8f0", backgroundColor: "#fff" }
        }
      >
        <Text
          className="text-center text-sm font-semibold"
          style={{ color: active === "refeicoes" ? "#fff" : "#475569" }}
        >
          Refeições prontas
        </Text>
      </Pressable>
    </View>
  );
}
