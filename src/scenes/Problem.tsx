import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, interFamily, monoFamily } from "../theme";
import { SceneWrapper, WordByWord } from "../components";

const Clock: React.FC = () => {
  const frame = useCurrentFrame();
  const minute = interpolate(frame, [0, 100], [0, 720]);
  const hour = interpolate(frame, [0, 100], [0, 180]);
  return (
    <svg width="150" height="150" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="62" fill="none" stroke={COLORS.sky} strokeWidth="7" />
      <circle cx="80" cy="80" r="6" fill={COLORS.cloud} />
      <g transform={`rotate(${hour} 80 80)`}>
        <line x1="80" y1="80" x2="80" y2="46" stroke={COLORS.cloud} strokeWidth="7" strokeLinecap="round" />
      </g>
      <g transform={`rotate(${minute} 80 80)`}>
        <line x1="80" y1="80" x2="80" y2="32" stroke={COLORS.blue} strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
};

const ArrowDown: React.FC = () => {
  const frame = useCurrentFrame();
  const ty = interpolate(frame, [0, 60], [-10, 46], { extrapolateRight: "clamp" });
  const o = interpolate(frame, [0, 18, 60, 90], [0, 1, 1, 0.5]);
  return (
    <div style={{ transform: `translateY(${ty}px)`, opacity: o }}>
      <svg width="120" height="170" viewBox="0 0 120 170">
        <line x1="60" y1="10" x2="60" y2="120" stroke={COLORS.mist} strokeWidth="9" strokeLinecap="round" />
        <path
          d="M28 96 L60 132 L92 96"
          fill="none"
          stroke={COLORS.mist}
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const Problem: React.FC = () => (
  <SceneWrapper slide>
    <div style={{ display: "flex", gap: 90, alignItems: "center", marginBottom: 56 }}>
      <Clock />
      <ArrowDown />
    </div>
    <div
      style={{
        fontFamily: monoFamily,
        fontWeight: 700,
        color: COLORS.sky,
        fontSize: 150,
        letterSpacing: "-2px",
        lineHeight: 1,
      }}
    >
      7,9%
    </div>
    <div
      style={{
        fontFamily: interFamily,
        fontWeight: 700,
        color: COLORS.cloud,
        fontSize: 56,
        marginTop: 6,
      }}
    >
      de taxa.
    </div>
    <WordByWord
      text="E o dinheiro demorando a cair."
      delay={18}
      style={{
        fontFamily: interFamily,
        fontWeight: 500,
        color: COLORS.mist,
        fontSize: 46,
        marginTop: 26,
        textAlign: "center",
        maxWidth: 760,
      }}
    />
  </SceneWrapper>
);
