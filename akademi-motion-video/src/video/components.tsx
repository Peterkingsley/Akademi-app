import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {palette} from "./theme";

export const SceneWrapper: React.FC<{
  children: React.ReactNode;
  glow?: "none" | "left" | "center" | "right";
  fadeOutFrom?: number;
  fadeOutDuration?: number;
}> = ({children, glow = "none", fadeOutFrom, fadeOutDuration = 12}) => {
  const frame = useCurrentFrame();
  const opacity =
    typeof fadeOutFrom === "number"
      ? interpolate(frame, [fadeOutFrom, fadeOutFrom + fadeOutDuration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const glowPosition =
    glow === "left"
      ? {left: -80, top: 120}
      : glow === "center"
        ? {left: 430, top: 160}
        : glow === "right"
          ? {right: -60, top: 120}
          : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        opacity,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: `translateY(${interpolate(frame, [0, 1800], [0, -110], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
          opacity: 0.3,
        }}
      />
      {glowPosition ? (
        <div
          style={{
            position: "absolute",
            ...glowPosition,
            width: 420,
            height: 420,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(34,197,94,0.28) 0%, rgba(34,197,94,0.06) 46%, transparent 72%)",
            filter: "blur(24px)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(6,6,6,0.96) 86%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const AnimatedText: React.FC<{
  title?: string;
  body?: string;
  align?: "left" | "center";
  titleStyle?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}> = ({title, body, align = "left", titleStyle, bodyStyle, style}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 18,
      textAlign: align,
      ...style,
    }}
  >
    {title ? (
      <div
        style={{
          color: palette.textPrimary,
          fontSize: 68,
          lineHeight: 0.98,
          fontWeight: 800,
          letterSpacing: 0,
          ...titleStyle,
        }}
      >
        {title}
      </div>
    ) : null}
    {body ? (
      <div
        style={{
          color: palette.textSecondary,
          fontSize: 28,
          lineHeight: 1.38,
          ...bodyStyle,
        }}
      >
        {body}
      </div>
    ) : null}
  </div>
);

export const Pill: React.FC<{
  label: string;
  active?: boolean;
  tone?: "green" | "neutral" | "warning";
  style?: React.CSSProperties;
}> = ({label, active = false, tone = "neutral", style}) => {
  const color =
    tone === "warning" ? palette.warning : tone === "green" ? palette.primary : palette.border;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "9px 16px",
        borderRadius: 999,
        backgroundColor: active ? palette.primary : "rgba(255,255,255,0.04)",
        color: active ? "#07120B" : tone === "green" ? palette.primary : palette.textSecondary,
        border: active ? "none" : `1px solid ${color}`,
        fontSize: 17,
        fontWeight: 700,
        ...style,
      }}
    >
      {label}
    </div>
  );
};

export const StudyCard: React.FC<{
  title: string;
  subtitle?: string;
  eyebrow?: string;
  tone?: "green" | "warning" | "neutral";
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({
  title,
  subtitle,
  eyebrow,
  tone = "neutral",
  width = "100%",
  height,
  style,
  children,
}) => {
  const accent =
    tone === "warning" ? palette.warning : tone === "green" ? palette.primary : palette.textSecondary;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 26,
        padding: 20,
        backgroundColor: palette.card,
        border: `1px solid ${palette.border}`,
        boxShadow: `0 16px 40px ${palette.shadow}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...style,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            color: accent,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: accent,
            }}
          />
          {eyebrow}
        </div>
      ) : null}
      <div
        style={{
          color: palette.textPrimary,
          fontSize: 27,
          fontWeight: 750,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            color: palette.textSecondary,
            fontSize: 18,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {children}
    </div>
  );
};

export const PhoneShell: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({children, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const floatY = interpolate(Math.sin(frame / (fps * 0.75)), [-1, 1], [-8, 8]);

  return (
    <div
      style={{
        width: 362,
        height: 714,
        borderRadius: 42,
        backgroundColor: "#050505",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 28px 90px rgba(0,0,0,0.45)",
        overflow: "hidden",
        transform: `translateY(${floatY}px)`,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          width: 110,
          height: 24,
          marginLeft: -55,
          borderRadius: 14,
          backgroundColor: "#0B0B0B",
          zIndex: 3,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 18,
          background: "linear-gradient(180deg, rgba(19,19,19,0.98), rgba(9,9,9,1))",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  label?: string;
}> = ({progress, size = 96, label}) => {
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - circumference * progress;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.primary}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{display: "flex", flexDirection: "column", gap: 4}}>
        <div style={{color: palette.textPrimary, fontSize: 28, fontWeight: 800}}>
          {Math.round(progress * 100)}%
        </div>
        {label ? (
          <div style={{color: palette.textSecondary, fontSize: 16}}>{label}</div>
        ) : null}
      </div>
    </div>
  );
};

export const BrandMark: React.FC<{size?: number}> = ({size = 76}) => (
  <Img
    src={staticFile("akademi-logo-icon.png")}
    style={{width: size, height: size, objectFit: "contain"}}
  />
);
