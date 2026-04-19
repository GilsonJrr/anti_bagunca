import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveScanToProduct, type ScanFillResult } from "../lib/productBarcodeLookup";

const PRIMARY = "#2D5AF0";

const BARCODE_TYPES = [
  "qr",
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "itf14",
  "datamatrix",
  "pdf417",
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onFilled: (result: ScanFillResult) => void;
  onError: (message: string) => void;
};

export function BarcodeScannerModal({ visible, onClose, onFilled, onError }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const busy = useRef(false);
  const lastKey = useRef<string>("");
  const lastAt = useRef(0);

  useEffect(() => {
    if (!visible) {
      busy.current = false;
      setIsProcessing(false);
      lastKey.current = "";
    }
  }, [visible]);

  const handleBarcode = useCallback(
    async (data: string, type: string) => {
      const now = Date.now();
      const key = `${type}:${data}`;
      if (busy.current) return;
      if (key === lastKey.current && now - lastAt.current < 900) return;
      lastKey.current = key;
      lastAt.current = now;

      busy.current = true;
      setIsProcessing(true);
      try {
        const result = await resolveScanToProduct(data, type);
        onFilled(result);
        onClose();
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        busy.current = false;
        setIsProcessing(false);
      }
    },
    [onClose, onError, onFilled]
  );

  if (Platform.OS === "web") {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-black">
        {!permission?.granted ? (
          <SafeAreaView className="flex-1 items-center justify-center bg-neutral-900 px-6">
            <Ionicons name="camera-outline" size={56} color="#94a3b8" />
            <Text className="mt-4 text-center text-base text-white">
              Precisamos da câmera para ler códigos de barras e QR.
            </Text>
            <Pressable
              className="mt-6 rounded-2xl px-8 py-4"
              style={{ backgroundColor: PRIMARY }}
              onPress={() => requestPermission()}
            >
              <Text className="font-semibold text-white">Permitir câmera</Text>
            </Pressable>
            <Pressable className="mt-4 py-3" onPress={onClose}>
              <Text className="font-semibold text-slate-400">Cancelar</Text>
            </Pressable>
          </SafeAreaView>
        ) : (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              active={!isProcessing}
              barcodeScannerSettings={{
                barcodeTypes: [...BARCODE_TYPES],
              }}
              onBarcodeScanned={({ data, type }) => {
                void handleBarcode(data, type);
              }}
            />
            <SafeAreaView
              className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4"
              edges={["top"]}
            >
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-black/50"
                onPress={onClose}
                accessibilityLabel="Fechar scanner"
              >
                <X size={26} color="#fff" />
              </Pressable>
            </SafeAreaView>
            <View className="absolute bottom-10 left-0 right-0 items-center px-6">
              <Text className="text-center text-sm text-white/90">
                Aponte para o código de barras do produto ou para um QR Code.
              </Text>
              <Text className="mt-1 text-center text-xs text-white/60">
                Alimentos: busca automática na base Open Food Facts quando possível.
              </Text>
            </View>
          </>
        )}
        {isProcessing ? (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
