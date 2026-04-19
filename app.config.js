/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: "AntiBagunça",
    slug: "antibagunca",
    owner: "gilson_jrj",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "antibagunca",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.antibagunca.app",
      buildNumber: "1",
    },
    android: {
      package: "com.antibagunca.app",
      versionCode: 1,
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-font",
      [
        "expo-image-picker",
        {
          photosPermission:
            "O AntiBagunça precisa acessar suas fotos para adicionar a imagem da casa.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "O AntiBagunça usa a câmera para ler códigos de barras e QR na despensa.",
          microphonePermission:
            "O microfone não é usado para leitura de códigos; permissão opcional do sistema.",
          recordAudioAndroid: false,
        },
      ],
      "@react-native-community/datetimepicker",
    ],
    extra: {
      eas: {
        projectId: "b83ed3d7-fc30-41fb-851b-64dfbfa75e65",
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
      firebaseDatabaseUrl: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "",
      googleExpoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ?? "",
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    },
  },
};
