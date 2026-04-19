import { FontAwesome5 } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { signInWithGoogleIdToken } from "../lib/auth";
import { isFirebaseConfigured } from "../lib/firebase";
import { useToast } from "../providers/ToastProvider";

type Extra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

type Props = {
  onSignedIn: (email: string) => void;
};

function GoogleSignInConfigured({
  extra,
  onSignedIn,
}: {
  extra: Extra;
  onSignedIn: (email: string) => void;
}) {
  const { showToast } = useToast();
  const onSignedInRef = useRef(onSignedIn);
  onSignedInRef.current = onSignedIn;
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: extra.googleWebClientId,
    webClientId: extra.googleWebClientId,
    iosClientId: extra.googleIosClientId,
    androidClientId: extra.googleAndroidClientId,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params?.id_token;
    if (!idToken) {
      showToast({
        type: "error",
        title: "Google",
        message:
          "Não foi possível obter o id_token. Confira o redirect URI no Google Cloud e os Client IDs.",
      });
      return;
    }
    if (!isFirebaseConfigured()) {
      showToast({
        type: "error",
        title: "Firebase",
        message: "Configure as variáveis EXPO_PUBLIC_FIREBASE_* no .env.",
      });
      return;
    }
    signInWithGoogleIdToken(idToken)
      .then((cred) => onSignedInRef.current(cred.user.email ?? ""))
      .catch((e: Error) =>
        showToast({
          type: "error",
          title: "Erro no login Google",
          message: e.message ?? String(e),
        })
      );
  }, [response, showToast]);

  const ready = Boolean(request) && isFirebaseConfigured();

  return (
    <Pressable
      disabled={!ready}
      onPress={() => {
        if (!isFirebaseConfigured()) {
          showToast({
            type: "error",
            title: "Firebase",
            message: "Configure o Firebase antes de usar o login social.",
          });
          return;
        }
        promptAsync();
      }}
      className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
      style={!ready ? { opacity: 0.5 } : undefined}
    >
      {!request ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="#64748b" />
          <Text className="text-base font-medium text-slate-500">Google</Text>
        </View>
      ) : (
        <>
          <FontAwesome5 name="google" size={20} color="#4285F4" />
          <Text className="ml-2 text-base font-medium text-slate-800">Google</Text>
        </>
      )}
    </Pressable>
  );
}

export function GoogleSignInButton({ onSignedIn }: Props) {
  const { showToast } = useToast();
  const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

  if (!extra.googleWebClientId) {
    return (
      <Pressable
        onPress={() =>
          showToast({
            type: "info",
            title: "Google",
            message:
              "Defina EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no .env (cliente OAuth Web do Google Cloud) e reinicie o Expo.",
          })
        }
        className="flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
        style={{ opacity: 0.7 }}
      >
        <FontAwesome5 name="google" size={20} color="#4285F4" />
        <Text className="ml-2 text-base font-medium text-slate-800">Google</Text>
      </Pressable>
    );
  }

  return <GoogleSignInConfigured extra={extra} onSignedIn={onSignedIn} />;
}
