// CampanhaDemo - composition Remotion adaptada ao angulo "Migracao Sem Trauma"
// (campanha-demo Taxa Zero). Reaproveita theme + helpers (SceneWrapper, WordByWord, DotsOverlay)
// do projeto Remotion. Composta inline para nao tocar nas scenes do AdVideo original.
import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, interFamily, monoFamily } from "./theme";
import { DotsOverlay, SceneWrapper, WordByWord } from "./components";

// --- Scene 1: Hook ---
const Hook: React.FC = () => (
  <SceneWrapper>
    <WordByWord
      text="Vai perder vendas migrando?"
      delay={6}
      style={{
        fontFamily: interFamily,
        fontWeight: 900,
        color: COLORS.cloud,
        fontSize: 90,
        lineHeight: 1.05,
        letterSpacing: "-1.5px",
        textAlign: "center",
        maxWidth: 900,
      }}
    />
  </SceneWrapper>
);

// --- Scene 2: Answer ---
const Answer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, durationInFrames: 24, config: { damping: 200 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  return (
    <SceneWrapper slide>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          fontSize: 380,
          lineHeight: 0.95,
          letterSpacing: "-12px",
          color: COLORS.cloud,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        Não<span style={{ color: COLORS.blue }}>.</span>
      </div>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 500,
          fontSize: 48,
          color: COLORS.mist,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        O time conduz.
      </div>
    </SceneWrapper>
  );
};

// --- Scene 3: Offer (0%) ---
const Offer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, durationInFrames: 26, config: { damping: 200 } });
  const zeroScale = interpolate(s, [0, 1], [0.4, 1]);
  return (
    <SceneWrapper>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 800,
          color: COLORS.cloud,
          fontSize: 52,
          letterSpacing: "-1px",
          marginBottom: 8,
        }}
      >
        Taxa Zero.
      </div>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          color: COLORS.blue,
          fontSize: 320,
          lineHeight: 1,
          letterSpacing: "-8px",
          transform: `scale(${zeroScale})`,
          transformOrigin: "center",
        }}
      >
        0%
      </div>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 700,
          color: COLORS.cloud,
          fontSize: 62,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        por 3 meses
      </div>
      <div
        style={{
          fontFamily: monoFamily,
          fontWeight: 500,
          color: COLORS.mist,
          fontSize: 26,
          marginTop: 28,
          textAlign: "center",
          maxWidth: 880,
          lineHeight: 1.4,
        }}
      >
        ou até R$ 300 mil em vendas · R$ 1,99 por transação · PIX D+10 · cartão D+30
      </div>
    </SceneWrapper>
  );
};

// --- Scene 4: Proof (95%) ---
const Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, durationInFrames: 26, config: { damping: 200 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  return (
    <SceneWrapper slide>
      <div
        style={{
          fontFamily: monoFamily,
          fontWeight: 700,
          color: COLORS.sky,
          fontSize: 28,
          letterSpacing: 4,
          marginBottom: 12,
        }}
      >
        PROVA-ÂNCORA
      </div>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          color: COLORS.blue,
          fontSize: 320,
          lineHeight: 1,
          letterSpacing: "-8px",
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        95%
      </div>
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 700,
          color: COLORS.cloud,
          fontSize: 56,
          marginTop: 12,
          textAlign: "center",
        }}
      >
        de aprovação no cartão
      </div>
    </SceneWrapper>
  );
};

// --- Scene 5: CTA ---
const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const logoO = interpolate(
    frame,
    [durationInFrames - 28, durationInFrames - 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <SceneWrapper>
      <WordByWord
        text="Solicitar convite."
        delay={6}
        stagger={5}
        style={{
          fontFamily: interFamily,
          fontWeight: 900,
          color: COLORS.cloud,
          fontSize: 96,
          letterSpacing: "-2px",
          textAlign: "center",
        }}
      />
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 500,
          color: COLORS.mist,
          fontSize: 36,
          marginTop: 24,
          textAlign: "center",
        }}
      >
        Para quem sabe que é Selet.
      </div>
      <Img
        src={staticFile("logo-4selet-light.png")}
        style={{ width: 240, marginTop: 56, opacity: logoO }}
      />
    </SceneWrapper>
  );
};

export const CampanhaDemo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(125% 125% at 50% 28%, ${COLORS.darker} 0%, ${COLORS.darkest} 100%)`,
      }}
    >
      <DotsOverlay />
      <Sequence durationInFrames={96}>
        <Hook />
      </Sequence>
      <Sequence from={86} durationInFrames={100}>
        <Answer />
      </Sequence>
      <Sequence from={176} durationInFrames={130}>
        <Offer />
      </Sequence>
      <Sequence from={296} durationInFrames={100}>
        <Proof />
      </Sequence>
      <Sequence from={386} durationInFrames={64}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
