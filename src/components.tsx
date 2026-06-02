import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "./theme";

export const SceneWrapper: React.FC<{
  children: React.ReactNode;
  slide?: boolean;
}> = ({ children, slide }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.ease),
    }
  );
  const opacity = Math.min(fadeIn, fadeOut);
  const translateY = slide
    ? interpolate(frame, [0, 20], [28, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 0;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: 90,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export const WordByWord: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
}> = ({ text, delay = 0, stagger = 3.5, style }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        ...style,
      }}
    >
      {words.map((w, i) => {
        const start = delay + i * stagger;
        const o = interpolate(frame, [start, start + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.ease),
        });
        const ty = interpolate(frame, [start, start + 10], [12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              opacity: o,
              transform: `translateY(${ty}px)`,
              display: "inline-block",
              marginRight: "0.28em",
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const DotsOverlay: React.FC = () => (
  <AbsoluteFill style={{ opacity: 0.06 }}>
    <svg width="100%" height="100%">
      <defs>
        <pattern
          id="seletDots"
          width="46"
          height="46"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="3" r="3" fill={COLORS.sky} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#seletDots)" />
    </svg>
  </AbsoluteFill>
);
