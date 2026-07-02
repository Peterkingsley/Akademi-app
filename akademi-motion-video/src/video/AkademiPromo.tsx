import React from "react";
import {AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig} from "remotion";
import {AnimatedText, BrandMark, PhoneShell, Pill, ProgressRing, SceneWrapper, StudyCard} from "./components";
import {crossFade, fadeUp, scaleIn, sceneProgress, slideIn, springIn} from "./motion";
import {palette} from "./theme";

const SCENE_1_START = 0;
const SCENE_1_DURATION = 150;
const SCENE_2_START = 150;
const SCENE_2_DURATION = 210;
const SCENE_3_START = 360;
const SCENE_3_DURATION = 240;
const SCENE_4_START = 600;
const SCENE_4_DURATION = 300;
const SCENE_5_START = 900;
const SCENE_5_DURATION = 300;
const SCENE_6_START = 1200;
const SCENE_6_DURATION = 360;
const SCENE_7_START = 1560;
const SCENE_7_DURATION = 240;

const DeskScene: React.FC = () => {
  const frame = useCurrentFrame();

  /* Timeline: 0:00-0:05 / frames 0-149
     Visible: dark desk world with scattered study pressure cards
     Background: opacity 0 -> 1 over frames 0-30
     Cards:
     - PDF card: x -80 -> 0, opacity 0 -> 1, frames 18-44, easeOutCubic
     - Assignment card: x 80 -> 0, opacity 0 -> 1, frames 28-54
     - Exam card: scale 0.92 -> 1, opacity 0 -> 1, frames 40-68
     - Notes card: y 60 -> 0, opacity 0 -> 1, frames 52-82
     - Group chat card: y -50 -> 0, opacity 0 -> 1, frames 66-96
     Text: appears at 0:03 / frame 90
     Text animation: opacity 0 -> 1, y 30 -> 0, frames 90-126
     Transition out: subtle fade from frames 138-149
  */

  return (
    <SceneWrapper glow="left" fadeOutFrom={138}>
      <div style={sceneShellStyle()}>
        <div style={{position: "relative", width: 1180, height: 620}}>
          <div
            style={{
              ...deskBaseStyle,
              opacity: interpolate(frame, [0, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
          <div style={{position: "absolute", left: 90, top: 88, ...slideIn(frame, 18, 26, -80, 0)}}>
            <StudyCard
              title="Lecture PDF"
              subtitle="54 pages, still confusing"
              eyebrow="Material"
              width={250}
            />
          </div>
          <div style={{position: "absolute", right: 110, top: 110, ...slideIn(frame, 28, 26, 80, 0)}}>
            <StudyCard
              title="Assignment due"
              subtitle="Submit before 11:59 PM"
              eyebrow="Urgent"
              tone="warning"
              width={250}
            />
          </div>
          <div style={{position: "absolute", left: 470, top: 50, ...scaleIn(frame, 40, 28, 0.92)}}>
            <StudyCard
              title="Exam in 6 days"
              subtitle="PHY 108 • MTH 102 • GST 101"
              eyebrow="Countdown"
              tone="warning"
              width={250}
            />
          </div>
          <div style={{position: "absolute", left: 210, bottom: 96, ...slideIn(frame, 52, 30, 0, 60)}}>
            <StudyCard
              title="Copied notes"
              subtitle="I wrote everything down, but it still isn’t clear."
              eyebrow="Lecture notes"
              width={290}
            />
          </div>
          <div style={{position: "absolute", right: 180, bottom: 120, ...slideIn(frame, 66, 30, 0, -50)}}>
            <StudyCard
              title="Class group"
              subtitle="Who understands this topic? I am lost."
              eyebrow="WhatsApp"
              width={290}
            />
          </div>
          <div
            style={{
              position: "absolute",
              left: 84,
              bottom: 38,
              width: 650,
              ...fadeUp(frame, 90, 36, 30),
            }}
          >
            <AnimatedText
              title="Learning should not feel this scattered."
              body="Students are trying. The problem is that study pressure comes from too many directions at once."
              titleStyle={{fontSize: 74, maxWidth: 760}}
              bodyStyle={{maxWidth: 700}}
            />
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const ProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_2_START;
  const copySwap = crossFade(local, 78, 12);

  /* Timeline: 0:05-0:12 / frames 150-359
     Visible: overwhelmed phone dashboard and layered study pressure
     Phone: y 120 -> 0, opacity 0 -> 1, frames 8-44
     Cards inside phone: subtle pulse using scale 1 -> 1.02 -> 1 across scene
     Copy 1: frame 36 visible first, full opacity by frame 66
     Copy 2: crossfade begins frame 78, 12-frame overlap
     Background grid drifts upward throughout scene
     Transition out: copy holds while phone remains stable; no accidental overlap
  */

  const pulse = 1 + Math.sin(local / 18) * 0.01;

  return (
    <SceneWrapper glow="right">
      <div style={sceneShellStyle()}>
        <div style={{display: "flex", width: 1160, alignItems: "center", justifyContent: "space-between"}}>
          <div style={{width: 520, display: "flex", flexDirection: "column", gap: 18}}>
            <div style={{...fadeUp(local, 36, 30, 24), opacity: copySwap.fadeOut}}>
              <AnimatedText
                title="Most students are not failing because they are not trying."
                body="They are putting in hours, but effort alone does not fix a broken learning flow."
                titleStyle={{fontSize: 70}}
              />
            </div>
            <div style={{...fadeUp(local, 78, 30, 24), opacity: copySwap.fadeIn}}>
              <AnimatedText
                title="They are struggling because learning is scattered, unclear, and lonely."
                body="Too many materials. Too little guidance. Too much pressure with nobody helping the ideas connect."
                titleStyle={{fontSize: 62}}
              />
            </div>
          </div>
          <div style={{...slideIn(local, 8, 36, 0, 120)}}>
            <PhoneShell>
              <div style={{display: "flex", flexDirection: "column", gap: 16, marginTop: 42, transform: `scale(${pulse})`}}>
                <div style={{color: palette.textPrimary, fontSize: 32, fontWeight: 760}}>Today</div>
                <StudyCard title="Assignment due" subtitle="Thermodynamics problem set" eyebrow="Task" tone="warning" />
                <StudyCard title="Exam in 6 days" subtitle="PHY 108 • 3 major topics unread" eyebrow="Countdown" tone="warning" />
                <StudyCard title="Unread materials" subtitle="Lecture note • past questions • revision guide" eyebrow="Library" />
                <StudyCard title="I still don’t understand this topic" subtitle="Physical quantities again?" eyebrow="Student thought" />
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const WhyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_3_START;
  const bgScale = interpolate(local, [0, SCENE_3_DURATION], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Timeline: 0:12-0:20 / frames 360-599
     Visible: scattered cards reorganize into one clean system
     Background: scale 1 -> 1.04 over whole scene
     Card paths:
     - left card: x -220 -> -260, y -40 -> 0, scale .95 -> 1, frames 30-120
     - center card: x 180 -> 0, y 80 -> 0, scale .95 -> 1, frames 30-120
     - right card: x 60 -> 260, y -120 -> 0, scale .95 -> 1, frames 30-120
     Glow: center green radial increases opacity from 0.12 -> 0.32
     Text:
     - frame 18: "So we built Akademi."
     - frame 78: supporting copy fades in beneath
  */

  const leftProgress = sceneProgress(local, 30, 90);
  const centerProgress = sceneProgress(local, 30, 90);
  const rightProgress = sceneProgress(local, 30, 90);

  return (
    <SceneWrapper glow="center">
      <div style={{...sceneShellStyle(), transform: `scale(${bgScale})`}}>
        <div style={{width: 1180, display: "flex", flexDirection: "column", gap: 42}}>
          <div style={{display: "flex", flexDirection: "column", gap: 16, width: 760}}>
            <div style={fadeUp(local, 18, 24, 24)}>
              <AnimatedText
                title="So we built Akademi."
                body="One place for the study moments that usually scatter everywhere."
                titleStyle={{fontSize: 80}}
              />
            </div>
          </div>
          <div style={{position: "relative", width: 1100, height: 300}}>
            <div
              style={{
                position: "absolute",
                left: 400,
                top: 18,
                width: 300,
                height: 240,
                borderRadius: 999,
                background: "radial-gradient(circle, rgba(34,197,94,0.28), rgba(34,197,94,0.06) 48%, transparent 72%)",
                filter: "blur(32px)",
                opacity: interpolate(centerProgress, [0, 1], [0.12, 0.32]),
              }}
            />
            <div
              style={{
                position: "absolute",
                left: interpolate(leftProgress, [0, 1], [80, 110]),
                top: interpolate(leftProgress, [0, 1], [50, 90]),
                opacity: leftProgress,
                transform: `translate(${interpolate(leftProgress, [0, 1], [-220, -260])}px, ${interpolate(leftProgress, [0, 1], [-40, 0])}px) scale(${interpolate(leftProgress, [0, 1], [0.95, 1])})`,
              }}
            >
              <StudyCard title="Solve assignments" subtitle="Camera to method to confidence" eyebrow="Pillar one" tone="green" width={300} />
            </div>
            <div
              style={{
                position: "absolute",
                left: 400,
                top: 90,
                opacity: centerProgress,
                transform: `translate(${interpolate(centerProgress, [0, 1], [180, 0])}px, ${interpolate(centerProgress, [0, 1], [80, 0])}px) scale(${interpolate(centerProgress, [0, 1], [0.95, 1])})`,
              }}
            >
              <StudyCard title="Study verified materials" subtitle="Organized by course, semester, and purpose" eyebrow="Pillar two" width={300} />
            </div>
            <div
              style={{
                position: "absolute",
                right: 120,
                top: 90,
                opacity: rightProgress,
                transform: `translate(${interpolate(rightProgress, [0, 1], [60, 260])}px, ${interpolate(rightProgress, [0, 1], [-120, 0])}px) scale(${interpolate(rightProgress, [0, 1], [0.95, 1])})`,
              }}
            >
              <StudyCard title="Learn with AI tutor" subtitle="Guidance, checkpoints, reteaching" eyebrow="Pillar three" tone="green" width={300} />
            </div>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const SolveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_4_START;
  const scanY = interpolate(local, [90, 135], [0, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Timeline: 0:20-0:30 / frames 600-899
     Visible: assignment solving flow inside phone
     Phone enters from right edge with slight hold, then shifts left by 36px near scene end
     Question card visible by frames 18-42
     Scan line: y 0 -> 220, frames 90-135
     Explanation lines:
     - line 1: y 24 -> 0 opacity 0 -> 1, frames 138-162
     - line 2: frames 152-176
     - line 3: frames 166-190
     Checkpoint card visible by frames 206-236
     Left copy lines appear in stagger: frames 24, 74, 124
  */

  return (
    <SceneWrapper glow="right">
      <div style={sceneShellStyle()}>
        <div style={{display: "flex", width: 1160, alignItems: "center", justifyContent: "space-between"}}>
          <div style={{width: 460, display: "flex", flexDirection: "column", gap: 16}}>
            <div style={fadeUp(local, 24, 24, 20)}>
              <AnimatedText title="Snap the question." titleStyle={{fontSize: 72}} />
            </div>
            <div style={fadeUp(local, 74, 24, 20)}>
              <AnimatedText title="Understand the method." titleStyle={{fontSize: 72}} />
            </div>
            <div style={fadeUp(local, 124, 24, 20)}>
              <AnimatedText title="Practice until it makes sense." titleStyle={{fontSize: 70}} />
            </div>
          </div>
          <div
            style={{
              ...slideIn(local, 18, 34, 110, 0),
              transform: `${slideIn(local, 18, 34, 110, 0).transform} translateX(${interpolate(local, [240, 300], [0, -36], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            <PhoneShell>
              <div style={{display: "flex", flexDirection: "column", gap: 16, marginTop: 42}}>
                <div style={{color: palette.textPrimary, fontSize: 32, fontWeight: 760}}>Solve</div>
                <StudyCard title="Given \(x^2 + y^2 = 25\), find y when x = 3." eyebrow="Question capture" subtitle="Mathematics • algebra" />
                <div
                  style={{
                    position: "absolute",
                    top: 140 + scanY,
                    left: 24,
                    width: 314,
                    height: 3,
                    backgroundColor: palette.primary,
                    boxShadow: "0 0 18px rgba(34,197,94,0.72)",
                    opacity: local >= 90 ? 1 : 0,
                  }}
                />
                <StudyCard title="Step by step" eyebrow="Explanation" style={{gap: 14}}>
                  <div style={{...fadeUp(local, 138, 24, 24), color: palette.textSecondary, fontSize: 18}}>Square the known value: \(3^2 = 9\)</div>
                  <div style={{...fadeUp(local, 152, 24, 24), color: palette.textSecondary, fontSize: 18}}>Substitute into the equation: \(9 + y^2 = 25\)</div>
                  <div style={{...fadeUp(local, 166, 24, 24), color: palette.textSecondary, fontSize: 18}}>Rearrange: \(y^2 = 16\), so \(y = 4\)</div>
                </StudyCard>
                <div style={fadeUp(local, 206, 30, 22)}>
                  <StudyCard title="Now try this" subtitle="What changes if x = 4 instead?" eyebrow="Checkpoint" tone="green" />
                </div>
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const LibraryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_5_START;
  const progress = interpolate(local, [180, 252], [0, 0.72], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* Timeline: 0:30-0:40 / frames 900-1199
     Visible: organized library + exam prep
     Phone enters with library content already structured
     Filter chip "PHY 108" activates by frame 36
     Material rows:
     - row1 frames 54-84 y 40 -> 0 opacity 0 -> 1
     - row2 frames 78-108
     - row3 frames 102-132
     Exam prep block and progress ring frames 174-234
     Copy changes emphasis from disorder to organization
  */

  return (
    <SceneWrapper glow="center">
      <div style={sceneShellStyle()}>
        <div style={{display: "flex", width: 1160, alignItems: "center", justifyContent: "space-between"}}>
          <div style={{width: 470, display: "flex", flexDirection: "column", gap: 20}}>
            <div style={fadeUp(local, 18, 24, 20)}>
              <AnimatedText
                title="Your materials should not be buried in random places."
                body="Akademi keeps them organized by course, semester, and purpose."
                titleStyle={{fontSize: 62}}
              />
            </div>
          </div>
          <div style={slideIn(local, 8, 30, 60, 0)}>
            <PhoneShell>
              <div style={{display: "flex", flexDirection: "column", gap: 16, marginTop: 42}}>
                <div style={{color: palette.textPrimary, fontSize: 32, fontWeight: 760}}>Library</div>
                <div style={{display: "flex", gap: 10}}>
                  <Pill label="All" />
                  <div style={scaleIn(local, 36, 18, 0.94)}>
                    <Pill label="PHY 108" active tone="green" />
                  </div>
                  <Pill label="MTH 102" />
                  <Pill label="GST 101" />
                </div>
                <div style={slideIn(local, 54, 30, 0, 40)}>
                  <StudyCard title="Verified lecture note" subtitle="Core concepts and class structure" eyebrow="PHY 108" tone="green" />
                </div>
                <div style={slideIn(local, 78, 30, 0, 40)}>
                  <StudyCard title="Past questions" subtitle="Repeated patterns and likely exam angles" eyebrow="Exam prep" />
                </div>
                <div style={slideIn(local, 102, 30, 0, 40)}>
                  <StudyCard title="Revision guide" subtitle="Last-minute summaries when time is tight" eyebrow="Review" />
                </div>
                <div style={fadeUp(local, 174, 30, 26)}>
                  <StudyCard title="Exam Prep" subtitle="Structured revision for the next test" eyebrow="Readiness" tone="warning">
                    <ProgressRing progress={progress} label="overall prep complete" />
                  </StudyCard>
                </div>
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const TutorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_6_START;

  /* Timeline: 0:40-0:52 / frames 1200-1559
     Visible: AI tutor as teacher, not chatbot
     Phone floats subtly; no exaggerated motion
     AI message block 1: frames 24-72
     AI message block 2: frames 84-126
     Checkpoint card: green border, frames 138-174
     Student response bubble: x 60 -> 0, opacity 0 -> 1, frames 194-226
     AI encouragement bubble: x -40 -> 0, opacity 0 -> 1, frames 236-270
     Side text:
     - "Not just answers." frame 44
     - "Teaching. Checkpoints. Reteaching." frame 94
     End glow increases frames 318-348 for transition to brand close
  */

  const endGlow = interpolate(local, [318, 348], [0.18, 0.36], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneWrapper glow="right">
      <div
        style={{
          position: "absolute",
          left: 860,
          top: 120,
          width: 280,
          height: 280,
          borderRadius: 999,
          background: `radial-gradient(circle, rgba(34,197,94,${endGlow}) 0%, rgba(34,197,94,0.05) 52%, transparent 74%)`,
          filter: "blur(24px)",
        }}
      />
      <div style={sceneShellStyle()}>
        <div style={{display: "flex", width: 1160, alignItems: "center", justifyContent: "space-between"}}>
          <div style={{width: 430, display: "flex", flexDirection: "column", gap: 18}}>
            <div style={fadeUp(local, 44, 24, 18)}>
              <AnimatedText title="Not just answers." titleStyle={{fontSize: 70}} />
            </div>
            <div style={fadeUp(local, 94, 24, 18)}>
              <AnimatedText title="Teaching. Checkpoints. Reteaching." titleStyle={{fontSize: 62}} />
            </div>
            <div style={fadeUp(local, 150, 24, 18)}>
              <AnimatedText
                body="The goal is not to make students stare at AI text. The goal is to make understanding feel guided and active."
                bodyStyle={{fontSize: 28}}
              />
            </div>
          </div>
          <div style={slideIn(local, 10, 34, 80, 0)}>
            <PhoneShell>
              <div style={{display: "flex", flexDirection: "column", gap: 14, marginTop: 42}}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                  <div style={{color: palette.textPrimary, fontSize: 32, fontWeight: 760}}>AI Tutor</div>
                  <Pill label="Live" active tone="green" />
                </div>
                <StudyCard title="Physical Quantities" subtitle="PHY 108" eyebrow="Current topic" tone="green" />
                <div style={fadeUp(local, 24, 28, 18)}>
                  <StudyCard title="Every science begins with measurement..." subtitle="In physics, anything that can be measured is called a physical quantity." eyebrow="Tutor" />
                </div>
                <div style={fadeUp(local, 84, 28, 18)}>
                  <StudyCard title="Examples include length, time, mass, and temperature." subtitle="These are the ideas students meet before formulas start to make sense." eyebrow="Tutor" />
                </div>
                <div style={fadeUp(local, 138, 30, 20)}>
                  <StudyCard title="Can you mention two physical quantities around you?" eyebrow="Checkpoint" tone="green" style={{border: `1px solid ${palette.primary}`}} />
                </div>
                <div
                  style={{
                    ...slideIn(local, 194, 32, 60, 0),
                    alignSelf: "flex-end",
                    maxWidth: 220,
                    backgroundColor: "rgba(34,197,94,0.14)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 22,
                    padding: "14px 16px",
                    color: palette.textPrimary,
                    fontSize: 18,
                    lineHeight: 1.3,
                  }}
                >
                  Length and time?
                </div>
                <div
                  style={{
                    ...slideIn(local, 236, 32, -40, 0),
                    maxWidth: 250,
                    backgroundColor: palette.cardSoft,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 22,
                    padding: "14px 16px",
                    color: palette.textPrimary,
                    fontSize: 18,
                    lineHeight: 1.3,
                  }}
                >
                  Good. Now let’s connect that to units.
                </div>
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>
    </SceneWrapper>
  );
};

const FinalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - SCENE_7_START;
  const {fps} = useVideoConfig();

  /* Timeline: 0:52-1:00 / frames 1560-1799
     Visible: centered brand close with soft glow
     Logo:
     - scale 0.8 -> 1 using spring, frames 0-36
     Title:
     - opacity 0 -> 1, y 24 -> 0, frames 18-50
     Subtitle:
     - opacity 0 -> 1, y 24 -> 0, starts 8 frames after title, frames 26-58
     CTA:
     - y 18 -> 0 opacity 0 -> 1, frames 42-78
     End fade:
     - black overlay opacity 0 -> 1 over final 12 frames, 1788-1799
  */

  return (
    <SceneWrapper glow="center">
      <div style={centerShellStyle()}>
        <div style={{display: "flex", flexDirection: "column", alignItems: "center", gap: 20, position: "relative", zIndex: 2}}>
          <div style={springIn(local, 0, fps, 0.8)}>
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: 34,
                border: "1px solid rgba(255,255,255,0.08)",
                backgroundColor: "rgba(255,255,255,0.03)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BrandMark size={74} />
            </div>
          </div>
          <div style={fadeUp(local, 18, 32, 24)}>
            <AnimatedText
              title="Akademi"
              align="center"
              titleStyle={{fontSize: 86}}
              style={{alignItems: "center"}}
            />
          </div>
          <div style={fadeUp(local, 26, 32, 24)}>
            <AnimatedText
              body="Built for students who are trying."
              align="center"
              bodyStyle={{fontSize: 30}}
              style={{alignItems: "center"}}
            />
          </div>
          <div style={fadeUp(local, 42, 36, 18)}>
            <AnimatedText
              body="Study smarter. Stay exam ready."
              align="center"
              bodyStyle={{fontSize: 34, color: palette.textPrimary, fontWeight: 760}}
              style={{alignItems: "center"}}
            />
          </div>
          <div style={fadeUp(local, 54, 36, 18)}>
            <div
              style={{
                padding: "16px 28px",
                borderRadius: 999,
                backgroundColor: palette.primary,
                color: "#07120B",
                fontSize: 25,
                fontWeight: 800,
              }}
            >
              Download Akademi
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#000000",
            opacity: interpolate(local, [228, 240], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>
    </SceneWrapper>
  );
};

const sceneShellStyle = (): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "62px 70px",
  zIndex: 2,
});

const centerShellStyle = (): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2,
});

const deskBaseStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 38,
  background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
  border: `1px solid ${palette.border}`,
  boxShadow: "0 26px 90px rgba(0,0,0,0.32)",
};

export const AkademiPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{fontFamily: "Inter, Arial, sans-serif", backgroundColor: palette.background}}>
      <Sequence from={SCENE_1_START} durationInFrames={SCENE_1_DURATION}>
        <DeskScene />
      </Sequence>
      <Sequence from={SCENE_2_START} durationInFrames={SCENE_2_DURATION}>
        <ProblemScene />
      </Sequence>
      <Sequence from={SCENE_3_START} durationInFrames={SCENE_3_DURATION}>
        <WhyScene />
      </Sequence>
      <Sequence from={SCENE_4_START} durationInFrames={SCENE_4_DURATION}>
        <SolveScene />
      </Sequence>
      <Sequence from={SCENE_5_START} durationInFrames={SCENE_5_DURATION}>
        <LibraryScene />
      </Sequence>
      <Sequence from={SCENE_6_START} durationInFrames={SCENE_6_DURATION}>
        <TutorScene />
      </Sequence>
      <Sequence from={SCENE_7_START} durationInFrames={SCENE_7_DURATION}>
        <FinalScene />
      </Sequence>
    </AbsoluteFill>
  );
};
