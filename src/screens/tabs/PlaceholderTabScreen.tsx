import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = { title: string };

export function PlaceholderTabScreen({ title }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#f5f7fa]" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-xl font-bold text-slate-800">{title}</Text>
        <Text className="mt-3 text-center text-base leading-relaxed text-slate-500">
          Esta área será conectada aos dados da sua casa em breve.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export function ComprasTabScreen() {
  return <PlaceholderTabScreen title="Compras" />;
}
