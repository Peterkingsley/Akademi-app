import {Easing, interpolate, spring} from "remotion";

export const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

export const easeOutCubic = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOutSoft = Easing.bezier(0.45, 0, 0.2, 1);

export const sceneProgress = (
  frame: number,
  start: number,
  durationInFrames: number,
) => {
  return clamp(
    interpolate(frame, [start, start + durationInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeOutCubic,
    }),
  );
};

export const useSceneProgress = sceneProgress;

export const fadeUp = (
  frame: number,
  start: number,
  durationInFrames: number,
  fromY = 30,
) => {
  const progress = sceneProgress(frame, start, durationInFrames);
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [fromY, 0])}px)`,
  };
};

export const slideIn = (
  frame: number,
  start: number,
  durationInFrames: number,
  fromX = 0,
  fromY = 0,
) => {
  const progress = sceneProgress(frame, start, durationInFrames);
  return {
    opacity: progress,
    transform: `translate(${interpolate(progress, [0, 1], [fromX, 0])}px, ${interpolate(progress, [0, 1], [fromY, 0])}px)`,
  };
};

export const scaleIn = (
  frame: number,
  start: number,
  durationInFrames: number,
  fromScale = 0.92,
) => {
  const progress = sceneProgress(frame, start, durationInFrames);
  return {
    opacity: progress,
    transform: `scale(${interpolate(progress, [0, 1], [fromScale, 1])})`,
  };
};

export const crossFade = (
  frame: number,
  start: number,
  durationInFrames: number,
) => {
  const fadeIn = clamp(
    interpolate(frame, [start, start + durationInFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: easeInOutSoft,
    }),
  );

  return {
    fadeIn,
    fadeOut: 1 - fadeIn,
  };
};

export const springIn = (
  frame: number,
  start: number,
  fps: number,
  fromScale = 0.8,
) => {
  const progress = spring({
    fps,
    frame: Math.max(0, frame - start),
    config: {
      damping: 200,
      stiffness: 200,
      mass: 0.9,
    },
    durationInFrames: fps,
  });

  return {
    opacity: clamp(progress),
    transform: `scale(${interpolate(progress, [0, 1], [fromScale, 1])})`,
  };
};
