import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Hash, Lock, Mail } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { signUpWithEmail } from "../lib/auth";
import { isFirebaseConfigured, isRealtimeDatabaseConfigured } from "../lib/firebase";
import { joinHouseByInviteCode } from "../lib/houseService";
import { registerJoinGateRef } from "../lib/registerJoinGate";
import { useAuth } from "../providers/AuthProvider";
import { useToast } from "../providers/ToastProvider";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Register">;
};

type RegisterMutationVars = {
  email: string;
  password: string;
  inviteCode: string;
};

export function RegisterScreen({ navigation }: Props) {
  const { showToast } = useToast();
  const { setRegistrationJoinPending } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const registerMutation = useMutation({
    mutationFn: async (vars: RegisterMutationVars) => {
      const code = vars.inviteCode.trim();
      if (code) {
        registerJoinGateRef.current = true;
        setRegistrationJoinPending(true);
      }
      try {
        const cred = await signUpWithEmail(vars.email, vars.password);
        if (code) {
          try {
            await joinHouseByInviteCode(cred.user.uid, code);
          } catch (joinErr) {
            const reason = joinErr instanceof Error ? joinErr.message : String(joinErr);
            throw new Error(`JOIN_FAILED:${reason}`);
          }
        }
        return cred;
      } finally {
        if (code) {
          registerJoinGateRef.current = false;
          setRegistrationJoinPending(false);
        }
      }
    },
    onSuccess: (_data, variables) => {
      const joined = variables.inviteCode.trim().length > 0;
      showToast({
        type: "success",
        title: "Conta criada",
        message: joined
          ? "Você entrou na casa com o código de convite."
          : "Bem-vindo à AntiBagunça!",
      });
    },
    onError: (e: Error) => {
      const raw = e.message ?? String(e);
      if (raw.startsWith("JOIN_FAILED:")) {
        const reason = raw.slice("JOIN_FAILED:".length);
        showToast({
          type: "error",
          title: "Código da casa",
          message: `${reason} Sua conta foi criada; na próxima tela você pode entrar com outro código ou criar uma casa.`,
        });
        return;
      }
      showToast({
        type: "error",
        title: "Não foi possível cadastrar",
        message: raw,
      });
    },
  });

  function submit() {
    if (!isFirebaseConfigured()) {
      showToast({
        type: "error",
        title: "Configuração",
        message:
          "Crie um arquivo .env na raiz com EXPO_PUBLIC_FIREBASE_* (veja .env.example) e reinicie o Expo.",
      });
      return;
    }
    if (!email.trim() || !password) {
      showToast({
        type: "error",
        title: "Campos obrigatórios",
        message: "Informe e-mail e senha.",
      });
      return;
    }
    if (password.length < 6) {
      showToast({
        type: "error",
        title: "Senha",
        message: "A senha deve ter pelo menos 6 caracteres.",
      });
      return;
    }
    if (password !== confirm) {
      showToast({
        type: "error",
        title: "Senhas diferentes",
        message: "Confirme a mesma senha nos dois campos.",
      });
      return;
    }
    const code = inviteCode.trim();
    if (code) {
      if (code.replace(/\s/g, "").length < 4) {
        showToast({
          type: "error",
          title: "Código da casa",
          message: "Informe o código completo ou deixe o campo em branco.",
        });
        return;
      }
      if (!isRealtimeDatabaseConfigured()) {
        showToast({
          type: "error",
          title: "Realtime Database",
          message:
            "Para usar o código da casa, adicione EXPO_PUBLIC_FIREBASE_DATABASE_URL no .env (Console Firebase > Realtime Database) e reinicie o app.",
        });
        return;
      }
    }
    registerMutation.mutate({
      email: email.trim(),
      password,
      inviteCode,
    });
  }

  const busy = registerMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingBottom: 40,
            paddingTop: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            className="mb-6 h-11 w-11 items-center justify-center self-start rounded-full bg-white"
            style={{
              elevation: 2,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 3,
            }}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={22} color="#0f172a" />
          </Pressable>

          <Text className="text-3xl font-bold leading-tight text-slate-900">
            Crie sua conta
          </Text>
          <Text className="mt-2 text-base text-slate-500">
            Junte-se e comece a organizar sua casa com recompensas.
          </Text>

          <View className="mt-8">
            <Text className="mb-2 text-sm font-medium text-slate-800">E-mail</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Mail size={20} color="#64748b" />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900"
                placeholder="nome@exemplo.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium text-slate-800">Senha</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Lock size={20} color="#64748b" />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900"
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowPassword((s) => !s)}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#64748b" />
                ) : (
                  <Eye size={20} color="#64748b" />
                )}
              </Pressable>
            </View>
          </View>

          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium text-slate-800">Confirmar senha</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Lock size={20} color="#64748b" />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900"
                placeholder="Repita a senha"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={confirm}
                onChangeText={setConfirm}
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="mb-2 text-sm font-medium text-slate-800">Código da casa (opcional)</Text>
            <View className="flex-row items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <Hash size={20} color="#64748b" />
              <TextInput
                className="ml-3 flex-1 text-base text-slate-900"
                placeholder="Ex.: X7B9K2"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase().replace(/\s/g, ""))}
              />
            </View>
            <Text className="mt-2 text-xs leading-relaxed text-slate-500">
              Opcional: use o código que o admin da casa vê em Configurações para você já entrar nessa casa ao
              cadastrar.
            </Text>
          </View>

          <Pressable
            className="mt-8 items-center rounded-2xl bg-[#0f172a] py-4 active:opacity-90"
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Cadastrar</Text>
            )}
          </Pressable>

          <View className="mt-10 flex-row flex-wrap items-center justify-center gap-1">
            <Text className="text-center text-sm text-slate-500">Já tem uma conta?</Text>
            <Pressable onPress={() => navigation.navigate("Login")}>
              <Text className="text-sm font-semibold text-blue-600">Entrar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
