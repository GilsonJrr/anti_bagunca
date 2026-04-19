import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";
import { shadowLg } from "../lib/nativeShadow";

const PRIMARY = "#2D5AF0";

/** Diâmetro do botão flutuante (px). */
export const FAB_SIZE = 56;

/** Distância do FAB até a barra de abas (borda inferior da área da tela). */
export const FAB_BOTTOM_OFFSET = 10;

const SCROLL_EXTRA = 24;

/**
 * `paddingBottom` recomendado para o `ScrollView` quando o FAB está visível,
 * para o último conteúdo não ficar atrás do botão.
 */
export const FAB_SCROLL_PADDING_BOTTOM = FAB_SIZE + FAB_BOTTOM_OFFSET + SCROLL_EXTRA;

/** Quando o FAB está oculto (ex.: modo mercado na lista de compras). */
export const SCROLL_PADDING_WITHOUT_FAB = 72;

type Props = {
  onPress: () => void;
  /** Se `false`, não renderiza (mantém um único componente nas telas). */
  visible?: boolean;
};

export function FloatingAddButton({ onPress, visible = true }: Props) {
  if (!visible) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Adicionar"
      className="absolute right-5 z-10 items-center justify-center rounded-full"
      style={{
        bottom: FAB_BOTTOM_OFFSET,
        width: FAB_SIZE,
        height: FAB_SIZE,
        backgroundColor: PRIMARY,
        ...shadowLg,
      }}
      onPress={onPress}
    >
      <Plus size={28} color="#fff" strokeWidth={2.5} />
    </Pressable>
  );
}
