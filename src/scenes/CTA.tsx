import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, interFamily } from "../theme";
import { SceneWrapper, WordByWord } from "../components";

const ArrowUp: React.FC = () => {
  const frame = useCurrentFrame();
  const ty = interpolate(frame, [0, 50], [90, -40], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 18, 50, 64], [0, 0.22, 0.22, 0.1]);
  return (
    <div style={{ position: "absolute", transform: `translateY(${ty}px)`, opacity: o }}>
      <svg width="380" height="540" viewBox="0 0 380 540">
        <path
          d="M190 30 L330 220 L240 220 L240 510 L140 510 L140 220 L50 220 Z"
          fill={COLORS.blue}
        />
      </svg>
    </div>
  );
};

export const CTA: React.FC = () => {
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
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", zIndex: 0 }}>
        <ArrowUp />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", zIndex: 1 }}>
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
            fontSize: 40,
            marginTop: 22,
          }}
        >
          Para quem sabe que é Selet.
        </div>
        <Img
          src={staticFile("logo-4selet-light.png")}
          style={{ width: 260, marginTop: 60, opacity: logoO }}
        />
      </AbsoluteFill>
    </SceneWrapper>
  );
};
