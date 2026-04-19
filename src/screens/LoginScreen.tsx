import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { FontAwesome5 } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Lock, Mail } from "lucide-react-native";
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
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { sendPasswordReset, signInWithEmail } from "../lib/auth";
import { isFirebaseConfigured } from "../lib/firebase";
import { useToast } from "../providers/ToastProvider";

type LoginProps = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: LoginProps) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => signInWithEmail(email, password),
    onSuccess: (cred) => {
      showToast({
        type: "success",
        title: "Bem-vindo!",
        message: `Conectado como ${cred.user.email ?? "usuário"}.`,
      });
    },
    onError: (e: Error) => {
      showToast({
        type: "error",
        title: "Não foi possível entrar",
        message: e.message ?? String(e),
      });
    },
  });

  const forgotMutation = useMutation({
    mutationFn: () => sendPasswordReset(email),
    onSuccess: () => {
      showToast({
        type: "info",
        title: "E-mail enviado",
        message: "Verifique sua caixa de entrada para redefinir a senha.",
      });
    },
    onError: (e: Error) => {
      showToast({
        type: "error",
        title: "Erro",
        message: e.message ?? String(e),
      });
    },
  });

  function handleEmailLogin() {
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
    loginMutation.mutate();
  }

  function handleForgot() {
    if (!isFirebaseConfigured()) {
      showToast({
        type: "error",
        title: "Configuração",
        message: "Configure o Firebase (.env) antes de recuperar a senha.",
      });
      return;
    }
    if (!email.trim()) {
      showToast({
        type: "error",
        title: "E-mail",
        message: "Informe seu e-mail acima para recuperar a senha.",
      });
      return;
    }
    forgotMutation.mutate();
  }

  function handleApple() {
    showToast({
      type: "info",
      title: "Apple",
      message:
        "Ative o provedor Apple no Firebase e configure Sign in with Apple no iOS para habilitar este botão.",
    });
  }

  const busy = loginMutation.isPending || forgotMutation.isPending;

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
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 8 }}
        >
          {navigation.canGoBack() ? (
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
          ) : (
            <View className="mb-6 h-11" />
          )}

          <Text className="text-3xl font-bold leading-tight text-slate-900">
            Bem-vindo de volta! 👋
          </Text>
          <Text className="mt-2 text-base text-slate-500">
            Entre para continuar organizando sua casa e ganhando pontos.
          </Text>

          <View className="mt-8">
            <Text className="mb-2 text-sm font-medium text-slate-800">E-mail ou Telefone</Text>
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
                placeholder="••••••••"
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

          <Pressable className="mt-2 self-end" onPress={handleForgot} disabled={busy}>
            <Text className="text-sm font-medium text-blue-600">Esqueceu a senha?</Text>
          </Pressable>

          <Pressable
            className="mt-6 items-center rounded-2xl bg-[#0f172a] py-4 active:opacity-90"
            onPress={handleEmailLogin}
            disabled={busy}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-bold text-white">Entrar na AntiBagunça</Text>
            )}
          </Pressable>

          <View className="my-8 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="text-xs font-medium uppercase tracking-wider text-slate-400">
              OU CONTINUE COM
            </Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          <View className="gap-3">
            <GoogleSignInButton
              onSignedIn={(userEmail) => {
                showToast({
                  type: "success",
                  title: "Google",
                  message: `Conectado como ${userEmail || "usuário"}.`,
                });
              }}
            />

            <Pressable
              className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5 active:opacity-90"
              onPress={handleApple}
            >
              <FontAwesome5 name="apple" size={22} color="#000000" />
              <Text className="ml-2 text-base font-medium text-slate-800">Apple</Text>
            </Pressable>
          </View>

          <View className="mt-10 flex-row flex-wrap items-center justify-center gap-1">
            <Text className="text-center text-sm text-slate-500">Ainda não tem uma conta?</Text>
            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text className="text-sm font-semibold text-blue-600">Cadastre-se</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
