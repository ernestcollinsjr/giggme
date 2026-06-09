# Native Push Notification Sounds

Custom sounds played when a push notification arrives on iOS / Android.
These files are bundled into the native app — they are **not** served from
the web. The web/PWA build uses `/public/sounds/*.mp3` instead.

The available sounds are `chime`, `bell`, and `ding`. The performer's
choice is stored in `notification_preferences.sound_type`. The
`send-push-notification` edge function reads that value and includes it in
the push payload as:

- iOS (APNs):     `aps.sound = "<type>.caf"`
- Android (FCM):  `android.sound = "<type>"` (filename without extension)

## One-time setup (after `npx cap add ios` / `npx cap add android`)

### iOS

1. Copy the `.caf` files into the iOS project:
   ```bash
   cp native-assets/sounds/ios/*.caf ios/App/App/
   ```
2. Open `ios/App/App.xcworkspace` in Xcode.
3. Drag `chime.caf`, `bell.caf`, `ding.caf` into the `App` target in the
   Project Navigator. In the dialog, check **Copy items if needed** and
   **Add to target: App**.
4. Build & run. The sound name in the push payload (`chime.caf`) must
   match a file in the app bundle.

### Android

1. Create the raw resources folder and copy the `.mp3` files:
   ```bash
   mkdir -p android/app/src/main/res/raw
   cp native-assets/sounds/android/*.mp3 android/app/src/main/res/raw/
   ```
   Filenames must be lowercase letters / digits / underscores only —
   `chime.mp3`, `bell.mp3`, `ding.mp3` all qualify.
2. Rebuild the Android app. FCM will resolve `sound: "chime"` against
   `res/raw/chime.mp3`.

## Re-sync after any change

```bash
npx cap sync
```

## Adding a new sound

1. Add the source `.wav`, then encode both formats:
   ```bash
   ffmpeg -i mysound.wav -c:a pcm_s16le -f caf native-assets/sounds/ios/mysound.caf
   ffmpeg -i mysound.wav -c:a libmp3lame -b:a 96k native-assets/sounds/android/mysound.mp3
   cp native-assets/sounds/android/mysound.mp3 public/sounds/mysound.mp3
   ```
2. Add `'mysound'` to the `SoundType` union in `src/hooks/useSoundPreference.ts`.
3. Add it to the `SOUND_TYPES` array in `src/components/NotificationPreferences.tsx`.
4. Re-run the iOS / Android install steps above for the new file.
