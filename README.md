# AntiBagunça

App React Native com [Expo](https://expo.dev) (SDK 54): despensa, lista de compras, tarefas, refeições e configurações da casa, com Firebase (Auth, Realtime Database, Storage) e login Google opcional.

## Requisitos

- **Node.js** (LTS recomendado, ex.: 20.x)
- **npm** (vem com o Node)
- Conta **[Expo](https://expo.dev)** (para EAS Build / Submit)
- Para testar em dispositivo: **Expo Go** ou build de desenvolvimento
- Para emuladores: **Android Studio** (Android) e, no macOS, **Xcode** (iOS)

## Instalação e ambiente local

```bash
git clone <url-do-repositório>
cd anti_bagunca
npm install
```

### Variáveis de ambiente

1. Copie o modelo e preencha com os dados do **Firebase** (Console → Configurações do projeto) e, se usar, **Google OAuth**:

   ```bash
   cp .env.example .env
   ```

2. Edite `.env` com todas as variáveis `EXPO_PUBLIC_*` necessárias (ver `.env.example`).

3. **Não commite** `.env` (já está no `.gitignore`). Reinicie o bundler após alterar variáveis.

### Firebase Android (`google-services.json`)

1. No Firebase Console, abra o app Android com o package `com.antibagunca.app`.
2. Baixe `google-services.json` e coloque em:

   `credentials/android/google-services.json`

3. Esse caminho está referenciado em `app.config.js` (`android.googleServicesFile`).

### Verificação rápida

```bash
npx expo-doctor
npx tsc --noEmit
```

## Rodar o app em desenvolvimento

```bash
npm start
```

- **Tecla `a`** — Android (emulador ou USB com depuração)
- **Tecla `i`** — iOS (somente no macOS, com Xcode)
- **Tecla `w`** — Web
- Ou: `npm run android` / `npm run ios` / `npm run web`

O Metro carrega variáveis de `.env` automaticamente (Expo).

## EAS (Expo Application Services)

O projeto usa **EAS Build** para gerar binários na nuvem. Configuração em `eas.json` e ligação ao projeto Expo em `app.config.js` (`extra.eas.projectId`, `owner`).

### Primeira vez na máquina

```bash
npx eas-cli login
```

Se o repositório for novo, associe o app ao projeto Expo (já feito neste repo em geral):

```bash
npx eas-cli init
```

Com `app.config.js` dinâmico, o CLI pode pedir ajustes manuais já refletidos no repositório (`owner`, `extra.eas.projectId`).

### Variáveis na build na nuvem

O `app.config.js` injeta Firebase/Google a partir de `process.env.EXPO_PUBLIC_*`. Em builds **EAS**, o `.env` local **não** sobe automaticamente: defina as mesmas variáveis no painel do projeto em [expo.dev](https://expo.dev) (**Environment variables**) ou via CLI de ambiente do EAS, para o `app.config.js` ser avaliado corretamente no servidor de build.

### Perfis de build (`eas.json`)

| Perfil        | Uso |
|---------------|-----|
| **preview**   | Testes internos: Android gera **APK**; iOS para distribuição interna (conforme credenciais). |
| **production**| Loja: Android **AAB** (Google Play); iOS para App Store / TestFlight. |

Comandos úteis (equivalentes estão em `package.json`):

```bash
# Preview (teste em time / APK)
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios   --profile preview

# Produção (lojas)
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios   --profile production
npx eas-cli build --platform all   --profile production
```

Scripts npm: `build:android:preview`, `build:ios:production`, `build:all:production`, etc.

### Credenciais

- Na primeira build, o EAS ajuda a criar ou enviar **keystore** (Android) e **certificados** (iOS).
- **Google Sign-In no Android release:** após a keystore de release existir, registre o **SHA-1** no Firebase Console (Configurações do projeto → app Android) para o login Google funcionar na build de loja.

### Enviar às lojas (EAS Submit)

Com build de produção pronta e contas configuradas (Google Play API / App Store Connect):

```bash
npm run submit:android
npm run submit:ios
```

Ajuste `eas.json` → `submit.production` se precisar de `ascAppId`, trilha da Play, etc.

## Versões para nova release

Atualize em `app.config.js` (e alinhe com as lojas):

- **`version`** — versão visível ao usuário (ex.: `1.0.1`).
- **`ios.buildNumber`** — incrementar a cada upload na App Store Connect.
- **`android.versionCode`** — inteiro que **sempre aumenta** na Play Store.

Com `eas.json` → `cli.appVersionSource`: `local`, esses valores vêm do config local.

## Gerar pastas nativas localmente (opcional)

O fluxo normal é **managed** + EAS Build (sem commit de `/android` e `/ios`). Para abrir no Android Studio/Xcode localmente:

```bash
npm run prebuild
```

As pastas `android/` e `ios/` são geradas e estão no `.gitignore`.

## Ícones e splash

Arquivos em `assets/`:

- `icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png`

Referências em `app.config.js`. Use PNG quadrados (ícone recomendado **1024×1024**). Depois de trocar imagens, faça **nova build nativa** para ver no instalador.

## Stack principal

- Expo SDK 54 · React Native · TypeScript  
- React Navigation · TanStack Query · NativeWind (Tailwind)  
- Firebase (JS SDK) · expo-camera · expo-image-picker · Google (expo-auth-session)

## Documentação útil

- [Expo](https://docs.expo.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)
- [Variáveis de ambiente no EAS](https://docs.expo.dev/eas/environment-variables/)
