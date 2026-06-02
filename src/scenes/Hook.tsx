import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, interFamily } from "../theme";
import { SceneWrapper, WordByWord } from "../components";

const CardIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, durationInFrames: 30, config: { damping: 200 } });
  const scale = interpolate(s, [0, 1], [0.5, 1]);
  const rot = interpolate(frame, [0, 96], [-7, 7]);
  return (
    <div
      style={{
        transform: `scale(${scale}) rotate(${rot}deg)`,
        transformOrigin: "center",
        marginBottom: 70,
      }}
    >
      <svg width="340" height="240" viewBox="0 0 340 240">
        <rect
          x="30"
          y="40"
          width="280"
          height="170"
          rx="22"
          fill="none"
          stroke={COLORS.blue}
          strokeWidth="7"
        />
        <rect x="30" y="74" width="280" height="26" fill={COLORS.navy} />
        <rect x="58" y="132" width="56" height="40" rx="8" fill={COLORS.sky} />
        <line
          x1="140"
          y1="152"
          x2="282"
          y2="152"
          stroke={COLORS.mist}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <line
          x1="58"
          y1="188"
          x2="210"
          y2="188"
          stroke={COLORS.mist}
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>
    </div>
  );
};

export const Hook: React.FC = () => (
  <SceneWrapper>
    <CardIcon />
    <WordByWord
      text="Quanto a taxa come da sua venda?"
      delay={10}
      style={{
        fontFamily: interFamily,
        fontWeight: 900,
        color: COLORS.cloud,
        fontSize: 86,
        lineHeight: 1.04,
        letterSpacing: "-1.5px",
        textAlign: "center",
        maxWidth: 860,
      }}
    />
  </SceneWrapper>
);
