import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const palette = {
  background: "#0B0B0B",
  surface: "#111111",
  surfaceElevated: "#1A1A1A",
  primary: "#22C55E",
  primaryDark: "#16A34A",
  accent: "#4ADE80",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1A1AA",
  border: "#27272A",
  warning: "#F59E0B",
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const fadeUp = (frame: number, start: number, fps: number, distance = 40) => {
  const progress = spring({
    fps,
    frame: Math.max(0, frame - start),
    config: {
      damping: 200,
      stiffness: 180,
      mass: 0.9,
    },
    durationInFrames: fps,
  });

  return {
    opacity: clamp(progress),
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const BackgroundGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const drift = interpolate(frame, [0, 540], [0, -80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -120,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: `translateY(${drift}px)`,
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -180,
          right: -80,
          width: width * 0.48,
          height: width * 0.48,
          borderRadius: "999px",
          background: "radial-gradient(circle, rgba(34,197,94,0.28) 0%, rgba(34,197,94,0.06) 45%, transparent 72%)",
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -220,
          left: -120,
          width: width * 0.56,
          height: width * 0.56,
          borderRadius: "999px",
          background: "radial-gradient(circle, rgba(74,222,128,0.22) 0%, rgba(74,222,128,0.04) 48%, transparent 72%)",
          filter: "blur(30px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(11,11,11,0.38) 0%, ${palette.background} 82%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at top left, rgba(255,255,255,0.06), transparent 34%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: width * 0.08,
          top: height * 0.14,
          width: 14,
          height: 14,
          borderRadius: 99,
          backgroundColor: palette.primary,
          boxShadow: "0 0 28px rgba(34,197,94,0.45)",
        }}
      />
    </AbsoluteFill>
  );
};

const BrandChip: React.FC<{ label: string; frameOffset?: number }> = ({
  label,
  frameOffset = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = fadeUp(frame, frameOffset, fps, 16);

  return (
    <div
      style={{
        ...reveal,
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 18px",
        borderRadius: 999,
        border: `1px solid rgba(34,197,94,0.3)`,
        backgroundColor: "rgba(17,17,17,0.86)",
        color: palette.textPrimary,
        fontSize: 24,
        fontWeight: 700,
        letterSpacing: 0,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          backgroundColor: palette.primary,
          boxShadow: "0 0 18px rgba(34,197,94,0.48)",
        }}
      />
      {label}
    </div>
  );
};

const PhoneShell: React.FC<{
  children: React.ReactNode;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
}> = ({ children, x = 0, y = 0, scale = 1, rotate = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const floatY = interpolate(
    Math.sin(frame / (fps * 0.7)),
    [-1, 1],
    [-10, 10],
  );

  return (
    <div
      style={{
        position: "absolute",
        width: 360,
        height: 720,
        borderRadius: 42,
        backgroundColor: "#050505",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 28px 90px rgba(0,0,0,0.45)",
        overflow: "hidden",
        transform: `translate(${x}px, ${y + floatY}px) scale(${scale}) rotate(${rotate}deg)`,
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
          backgroundColor: "#0A0A0A",
          zIndex: 4,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 18,
          background: "linear-gradient(180deg, rgba(17,17,17,0.98), rgba(8,8,8,1))",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const AppCard: React.FC<{
  title: string;
  subtitle: string;
  accent?: string;
  width?: string | number;
}> = ({ title, subtitle, accent = palette.primary, width = "100%" }) => (
  <div
    style={{
      width,
      borderRadius: 24,
      padding: 20,
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          backgroundColor: accent,
        }}
      />
      <span
        style={{
          color: palette.textSecondary,
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {subtitle}
      </span>
    </div>
    <div
      style={{
        color: palette.textPrimary,
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.12,
      }}
    >
      {title}
    </div>
  </div>
);

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const title = fadeUp(frame, 10, fps, 30);
  const body = fadeUp(frame, 24, fps, 24);
  const phone = fadeUp(frame, 16, fps, 36);

  return (
    <AbsoluteFill style={{ padding: "64px 72px" }}>
      <BackgroundGrid />
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: 560,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <BrandChip label="Akademi" frameOffset={8} />
          <div
            style={{
              ...title,
              color: palette.textPrimary,
              fontSize: 86,
              fontWeight: 800,
              lineHeight: 0.96,
              letterSpacing: 0,
            }}
          >
            Study smarter.
            <br />
            Stay exam ready.
          </div>
          <div
            style={{
              ...body,
              color: palette.textSecondary,
              fontSize: 28,
              lineHeight: 1.42,
              maxWidth: 520,
            }}
          >
            Akademi helps students solve assignments, organize verified materials,
            and prepare with an AI tutor that feels focused and personal.
          </div>
        </div>

        <div style={{ ...phone, position: "relative", width: 430, height: 760 }}>
          <PhoneShell x={10} y={0} scale={1.08} rotate={-5}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 34 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  color: palette.textPrimary,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700 }}>Good evening</div>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    color: palette.textSecondary,
                    fontSize: 15,
                  }}
                >
                  Kingsley
                </div>
              </div>
              <AppCard
                title="National Maths Competition"
                subtitle="Challenge live"
              />
              <div style={{ display: "flex", gap: 14 }}>
                <AppCard title="Library" subtitle="Verified materials" width={150} />
                <AppCard title="Exam Prep" subtitle="Mock tests" accent={palette.warning} width={150} />
              </div>
              <AppCard title="AI Tutor session" subtitle="PHY 108 in progress" />
            </div>
          </PhoneShell>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SolveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const block = fadeUp(frame, 0, fps, 20);
  const chip1 = fadeUp(frame, 12, fps, 18);
  const chip2 = fadeUp(frame, 18, fps, 18);
  const chip3 = fadeUp(frame, 24, fps, 18);

  return (
    <AbsoluteFill style={{ padding: "72px 80px" }}>
      <BackgroundGrid />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 44,
        }}
      >
        <PhoneShell x={20} y={20} scale={0.94} rotate={-2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 46 }}>
            <div style={{ color: palette.textPrimary, fontSize: 34, fontWeight: 700 }}>
              Solve faster
            </div>
            <div
              style={{
                borderRadius: 28,
                padding: 18,
                backgroundColor: palette.surfaceElevated,
                border: `1px solid ${palette.border}`,
              }}
            >
              <div style={{ color: palette.textSecondary, fontSize: 15, marginBottom: 12 }}>
                Camera capture
              </div>
              <div
                style={{
                  height: 220,
                  borderRadius: 22,
                  background:
                    "linear-gradient(135deg, rgba(34,197,94,0.18), rgba(255,255,255,0.04))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.textPrimary,
                  fontSize: 52,
                  fontWeight: 700,
                }}
              >
                x² + y²
              </div>
            </div>
            <AppCard title="Step-by-step explanation" subtitle="Whiteboard replay" />
          </div>
        </PhoneShell>

        <div
          style={{
            ...block,
            display: "flex",
            flexDirection: "column",
            gap: 22,
            width: 560,
          }}
        >
          <BrandChip label="Assignments" frameOffset={0} />
          <div
            style={{
              color: palette.textPrimary,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 0.98,
            }}
          >
            Snap the question.
            <br />
            Understand the method.
          </div>
          <div
            style={{
              color: palette.textSecondary,
              fontSize: 28,
              lineHeight: 1.38,
            }}
          >
            From camera capture to step-by-step guidance, Akademi helps students
            move from confusion to clear working.
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div style={{ ...chip1, ...pillStyle(palette.primary) }}>Capture</div>
            <div style={{ ...chip2, ...pillStyle(palette.accent) }}>Understand</div>
            <div style={{ ...chip3, ...pillStyle(palette.warning) }}>Practice</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LibraryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = fadeUp(frame, 0, fps, 22);
  const right = fadeUp(frame, 16, fps, 22);

  return (
    <AbsoluteFill style={{ padding: "72px 80px" }}>
      <BackgroundGrid />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            ...left,
            display: "flex",
            flexDirection: "column",
            gap: 22,
            width: 540,
          }}
        >
          <BrandChip label="Library" frameOffset={0} />
          <div
            style={{
              color: palette.textPrimary,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 0.98,
            }}
          >
            Verified materials.
            <br />
            Clean study flow.
          </div>
          <div
            style={{
              color: palette.textSecondary,
              fontSize: 28,
              lineHeight: 1.38,
            }}
          >
            Course-code filtering, approved uploads, and a reading experience
            built for repeated revision.
          </div>
        </div>

        <div style={{ ...right, position: "relative", width: 420, height: 720 }}>
          <PhoneShell x={10} y={-10} scale={0.98} rotate={3}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 44 }}>
              <div style={{ color: palette.textPrimary, fontSize: 34, fontWeight: 700 }}>
                Library
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <FilterChip label="All" active />
                <FilterChip label="PHY 108" />
                <FilterChip label="MTH 102" />
              </div>
              <MaterialRow title="PHY 101 MATERIAL" code="PHY 108" />
              <MaterialRow title="300 PHYSICS FORMULAS" code="PHY 108" />
              <MaterialRow title="MTH 102 REVISION GUIDE" code="MTH 102" />
            </div>
          </PhoneShell>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TutorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = fadeUp(frame, 0, fps, 22);
  const phoneReveal = fadeUp(frame, 12, fps, 24);
  const bubbleReveal = fadeUp(frame, 24, fps, 18);

  return (
    <AbsoluteFill style={{ padding: "72px 80px" }}>
      <BackgroundGrid />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            ...left,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            width: 520,
          }}
        >
          <BrandChip label="AI Tutor" frameOffset={0} />
          <div
            style={{
              color: palette.textPrimary,
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 0.98,
            }}
          >
            Learn like
            <br />
            someone is actually
            <br />
            teaching you.
          </div>
          <div
            style={{
              color: palette.textSecondary,
              fontSize: 28,
              lineHeight: 1.38,
            }}
          >
            Spoken guidance, checkpoints, reteaching, and a rhythm that keeps
            students active instead of passive.
          </div>
        </div>

        <div style={{ ...phoneReveal, position: "relative", width: 420, height: 720 }}>
          <PhoneShell x={0} y={0} scale={1} rotate={-1.5}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 44 }}>
              <div style={{ color: palette.textPrimary, fontSize: 34, fontWeight: 700 }}>
                AI Tutor
              </div>
              <div
                style={{
                  padding: 22,
                  borderRadius: 28,
                  backgroundColor: palette.surface,
                  border: `1px solid ${palette.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ color: palette.textPrimary, fontSize: 28, fontWeight: 700 }}>
                  Physical Quantities
                </div>
                <div style={{ color: palette.textSecondary, fontSize: 22, lineHeight: 1.35 }}>
                  Every science begins with measurement. In physics, anything that
                  can be measured is called a physical quantity.
                </div>
              </div>
              <div
                style={{
                  ...bubbleReveal,
                  padding: 18,
                  borderRadius: 24,
                  backgroundColor: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.24)",
                  color: palette.textPrimary,
                  fontSize: 22,
                  lineHeight: 1.34,
                }}
              >
                Can you mention two physical quantities around you right now?
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ ...pillStyle(palette.primary), fontSize: 20 }}>Live voice</div>
                <div style={{ ...pillStyle(palette.accent), fontSize: 20 }}>Checkpoint</div>
              </div>
            </div>
          </PhoneShell>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = fadeUp(frame, 8, fps, 24);
  const buttonReveal = fadeUp(frame, 22, fps, 18);
  const logoScale = spring({
    fps,
    frame,
    config: {
      damping: 200,
      stiffness: 180,
    },
  });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <BackgroundGrid />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 30,
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${interpolate(logoScale, [0, 1], [0.78, 1])})`,
          }}
        >
          <Img
            src={staticFile("akademi-logo-icon.png")}
            style={{ width: 70, height: 70, objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            ...reveal,
            color: palette.textPrimary,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 0.98,
            textAlign: "center",
          }}
        >
          Akademi
          <br />
          built for serious study
        </div>
        <div
          style={{
            color: palette.textSecondary,
            fontSize: 28,
            lineHeight: 1.36,
            maxWidth: 700,
            textAlign: "center",
          }}
        >
          Solve assignments, revise smarter, and stay ready for the next exam.
        </div>
        <div
          style={{
            ...buttonReveal,
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 28px",
            borderRadius: 999,
            backgroundColor: palette.primary,
            color: "#041109",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          Download Akademi
        </div>
      </div>
    </AbsoluteFill>
  );
};

const pillStyle = (accent: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.04)",
  border: `1px solid ${accent}33`,
  color: palette.textPrimary,
  fontSize: 22,
  fontWeight: 700,
});

const FilterChip: React.FC<{ label: string; active?: boolean }> = ({
  label,
  active = false,
}) => (
  <div
    style={{
      padding: "10px 16px",
      borderRadius: 999,
      backgroundColor: active ? palette.primary : "rgba(255,255,255,0.04)",
      color: active ? "#07120B" : palette.textSecondary,
      fontSize: 17,
      fontWeight: 700,
      border: active ? "none" : `1px solid ${palette.border}`,
    }}
  >
    {label}
  </div>
);

const MaterialRow: React.FC<{ title: string; code: string }> = ({ title, code }) => (
  <div
    style={{
      borderRadius: 24,
      backgroundColor: palette.surface,
      border: `1px solid ${palette.border}`,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div style={{ color: palette.textPrimary, fontSize: 24, fontWeight: 700 }}>
      {title}
    </div>
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ ...miniTagStyle(), color: palette.primary }}>{code}</div>
      <div style={{ ...miniTagStyle(), color: palette.accent }}>Verified</div>
    </div>
  </div>
);

const miniTagStyle = (): React.CSSProperties => ({
  padding: "6px 10px",
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.04)",
  fontSize: 14,
  fontWeight: 700,
});

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: introOpacity, fontFamily: "Inter, Arial, sans-serif" }}>
      <Sequence durationInFrames={120}>
        <IntroScene />
      </Sequence>
      <Sequence from={105} durationInFrames={120}>
        <SolveScene />
      </Sequence>
      <Sequence from={210} durationInFrames={120}>
        <LibraryScene />
      </Sequence>
      <Sequence from={315} durationInFrames={120}>
        <TutorScene />
      </Sequence>
      <Sequence from={420} durationInFrames={120}>
        <FinalScene />
      </Sequence>
    </AbsoluteFill>
  );
};
