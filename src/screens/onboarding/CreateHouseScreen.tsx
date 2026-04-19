import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Home,
  Info,
  LayoutGrid,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AuthedStackParamList } from "../../navigation/AuthenticatedNavigator";
import { isRealtimeDatabaseConfigured } from "../../lib/firebase";
import { shadowSm, shadowXl } from "../../lib/nativeShadow";
import {
  createHouseForUser,
  requestJoinHouseByInviteCode,
  subscribeUserPendingJoinRequest,
} from "../../lib/houseService";
import { useActiveHouseId } from "../../hooks/useActiveHouseId";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <View className="mt-4 flex-row gap-2">
      <View className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-blue-500" : "bg-slate-200"}`} />
      <View className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-blue-500" : "bg-slate-200"}`} />
    </View>
  );
}

type CreateHouseProps = NativeStackScreenProps<AuthedStackParamList, "CreateHouse">;

export function CreateHouseScreen({ navigation }: CreateHouseProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { houseId } = useActiveHouseId();
  const [houseName, setHouseName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [pendingJoinHint, setPendingJoinHint] = useState<{ houseId: string } | null>(null);
  /** Quando o admin aprovar, este houseId deve coincidir com `activeHouseId` para ir ao Loading. */
  const joinTargetHouseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeUserPendingJoinRequest(user.uid, (data) => {
      setPendingJoinHint(data);
      if (data?.houseId) joinTargetHouseIdRef.current = data.houseId;
    });
  }, [user]);

  useEffect(() => {
    if (!houseId || !joinTargetHouseIdRef.current) return;
    if (houseId !== joinTargetHouseIdRef.current) return;
    joinTargetHouseIdRef.current = null;
    navigation.reset({ index: 0, routes: [{ name: "Loading" }] });
  }, [houseId, navigation]);

  useEffect(() => {
    if (!pendingJoinHint && !houseId && joinTargetHouseIdRef.current) {
      joinTargetHouseIdRef.current = null;
    }
  }, [pendingJoinHint, houseId]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast({
        type: "error",
        title: "Permissão",
        message: "Precisamos de acesso à galeria para a foto da casa.",
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function handleNext() {
    if (!user) return;
    if (!isRealtimeDatabaseConfigured()) {
      showToast({
        type: "error",
        title: "Realtime Database",
        message:
          "Adicione EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env (Firebase Console > Realtime Database) e reinicie o app.",
      });
      return;
    }
    if (!houseName.trim()) {
      showToast({
        type: "error",
        title: "Nome da casa",
        message: "Informe um nome para continuar.",
      });
      return;
    }
    setBusy(true);
    try {
      const { houseId, photoUploadFailed } = await createHouseForUser(
        user.uid,
        houseName.trim(),
        photoUri
      );
      if (photoUploadFailed) {
        showToast({
          type: "info",
          title: "Foto não enviada",
          message:
            "Ative o Firebase Storage (Console > Storage) e ajuste as regras para usuários autenticados. A casa foi criada sem foto.",
        });
      }
      navigation.navigate("SetupPreferences", { houseId });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  /** Avança para o passo 2 com nome padrão — o onboarding só termina na Home após "Concluir" na segunda tela. */
  async function handleSkip() {
    if (!user) return;
    if (!isRealtimeDatabaseConfigured()) {
      showToast({
        type: "error",
        title: "Realtime Database",
        message: "Configure EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env.",
      });
      return;
    }
    setBusy(true);
    try {
      const { houseId } = await createHouseForUser(user.uid, "Minha casa", null);
      navigation.navigate("SetupPreferences", { houseId });
    } catch (e) {
      showToast({
        type: "error",
        title: "Erro",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user) return;
    if (!isRealtimeDatabaseConfigured()) {
      showToast({
        type: "error",
        title: "Realtime Database",
        message: "Configure EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env.",
      });
      return;
    }
    setBusy(true);
    try {
      const result = await requestJoinHouseByInviteCode(user.uid, inviteInput, {
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      });
      setJoinOpen(false);
      setInviteInput("");
      if (result.syncedMembership) {
        showToast({
          type: "success",
          title: "Conectado",
          message: "Sua conta foi sincronizada com esta casa.",
        });
        navigation.reset({ index: 0, routes: [{ name: "Loading" }] });
        return;
      }
      if (result.alreadyInHouse) {
        showToast({
          type: "info",
          title: "Pronto",
          message: "Você já está nesta casa.",
        });
        navigation.reset({ index: 0, routes: [{ name: "Loading" }] });
        return;
      }
      joinTargetHouseIdRef.current = result.houseId;
      showToast({
        type: "success",
        title: "Solicitação enviada",
        message: "O administrador da casa precisa aprovar na tela inicial.",
      });
    } catch (e) {
      showToast({
        type: "error",
        title: "Convite",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f9fafb]" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <View className="flex-row items-center justify-between pt-2">
            {navigation.canGoBack() ? (
              <Pressable
                className="h-11 w-11 items-center justify-center rounded-full bg-white"
                style={shadowSm}
                onPress={() => navigation.goBack()}
              >
                <ArrowLeft size={22} color="#0f172a" />
              </Pressable>
            ) : (
              <View className="h-11 w-11" />
            )}
            <Pressable onPress={handleSkip} disabled={busy}>
              <Text className="text-base font-medium text-blue-500">Pular</Text>
            </Pressable>
          </View>

          <ProgressBar step={1} />

          <Text className="mt-6 text-3xl font-bold text-slate-900">Crie sua Casa 🏠</Text>
          <Text className="mt-2 text-base text-slate-500">
            Configure o espaço para sua família ou colegas de quarto.
          </Text>

          <View className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={pickImage}
                className="h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-200 bg-slate-50"
              >
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Camera size={28} color="#64748b" />
                )}
              </Pressable>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900">Foto da Casa</Text>
                <Text className="mt-1 text-sm text-slate-500">Opcional, mas recomendado</Text>
              </View>
            </View>

            <Text className="mb-2 mt-6 text-sm font-medium text-slate-800">Nome da Casa</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Home size={20} color="#64748b" />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900"
                placeholder="Ex: Apartamento 402"
                placeholderTextColor="#94a3b8"
                value={houseName}
                onChangeText={setHouseName}
              />
            </View>
          </View>

          <View className="my-8 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-xs font-semibold uppercase tracking-wider text-slate-400">OU</Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          {pendingJoinHint && !houseId ? (
            <View className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <Text className="text-sm font-semibold text-amber-900">Aguardando aprovação</Text>
              <Text className="mt-1 text-sm text-amber-900/85">
                O administrador precisa aceitar seu pedido na tela inicial do app. Você pode fechar o app e
                aguardar.
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => setJoinOpen(true)}
            disabled={Boolean(pendingJoinHint && !houseId)}
            className={`rounded-3xl border-2 border-dashed border-slate-300 bg-white p-5 active:opacity-90 ${pendingJoinHint && !houseId ? "opacity-50" : ""}`}
          >
            <View className="flex-row items-center gap-4">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <LayoutGrid size={24} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-900">Entrar com código</Text>
                <Text className="mt-1 text-sm text-slate-500">
                  Peça o código ao admin. Ele aprova seu pedido na tela inicial.
                </Text>
              </View>
            </View>
          </Pressable>

          <View className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/80 p-4">
            <View className="flex-row gap-3">
              <View className="mt-0.5">
                <Info size={20} color="#2563eb" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-blue-900">Como funciona?</Text>
                <Text className="mt-2 text-sm leading-relaxed text-blue-900/80">
                  • <Text className="font-semibold">Admin:</Text> quem cria a casa gerencia membros e
                  configurações.{"\n"}• <Text className="font-semibold">Morador:</Text> pode adicionar
                  tarefas, compras e ganhar pontos.{"\n"}• Tudo sincroniza em tempo real para todos os
                  membros!
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View className="border-t border-slate-200 bg-[#f9fafb] px-6 pb-6 pt-4">
          <Pressable
            onPress={handleNext}
            disabled={busy}
            className="flex-row items-center justify-center rounded-2xl bg-[#0f172a] py-4 active:opacity-90"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text className="text-base font-bold text-white">Próximo Passo</Text>
                <Text className="ml-2 text-base font-bold text-white">→</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={joinOpen} transparent animationType="fade">
        <View className="flex-1 justify-center px-6">
          <Pressable className="absolute inset-0 bg-black/40" onPress={() => setJoinOpen(false)} />
          <View className="relative z-10 w-full max-w-sm self-center rounded-3xl bg-white p-6" style={shadowXl}>
            <Text className="text-lg font-bold text-slate-900">Código da casa</Text>
            <Text className="mt-1 text-sm text-slate-500">
              O administrador recebe um aviso na tela inicial e precisa aprovar antes de você entrar.
            </Text>
            <TextInput
              className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-semibold tracking-widest text-slate-900"
              placeholder="ABC123"
              placeholderTextColor="#94a3b8"
              autoCapitalize="characters"
              value={inviteInput}
              onChangeText={setInviteInput}
            />
            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="flex-1 items-center rounded-2xl border border-slate-200 py-3"
                onPress={() => setJoinOpen(false)}
              >
                <Text className="font-semibold text-slate-700">Cancelar</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-2xl bg-blue-500 py-3"
                onPress={handleJoin}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Enviar pedido</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
