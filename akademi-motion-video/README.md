# Akademi Motion Video

This Remotion project contains the polished `AkademiPromo` launch video for Akademi.

## Video spec

- Format: `1280x720`
- Frame rate: `30fps`
- Duration: `1800 frames` = `60 seconds`
- Composition id: `AkademiPromo`

## Story structure

The video is built around the real reason Akademi exists:

1. Learning feels scattered
2. Students are trying, but the system is heavy
3. Akademi brings the study flow together
4. Assignments become clearer
5. Materials and exam prep become organized
6. AI Tutor feels like guidance, not just answers
7. The brand closes with a serious, hopeful finish

## Commands

Install dependencies:

```bash
npm install
```

Open the Remotion preview:

```bash
npm run dev
```

Lint and type-check:

```bash
npm run lint
```

Render the final MP4:

```bash
npm run render
```

Direct render command:

```bash
npx remotion render src/index.ts AkademiPromo out/akademi-promo.mp4 --timeout=120000 --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Important files

- `src/video/AkademiPromo.tsx`  
  Main timeline, scene timing, and scene-by-scene motion comments

- `src/video/components.tsx`  
  Reusable visual building blocks:
  - `SceneWrapper`
  - `AnimatedText`
  - `PhoneShell`
  - `StudyCard`
  - `Pill`
  - `ProgressRing`

- `src/video/motion.ts`  
  Shared animation helpers:
  - `fadeUp`
  - `slideIn`
  - `scaleIn`
  - `crossFade`
  - `useSceneProgress`

- `src/video/theme.ts`  
  Akademi palette and video dimensions

## Assets

The project currently uses:

- `public/akademi-logo-icon.png`

No additional assets are required to render the current version.

If you want a richer final cut later, the best optional additions would be:

- exact exported app screenshots
- custom voiceover
- licensed background music
- subtle sound design
