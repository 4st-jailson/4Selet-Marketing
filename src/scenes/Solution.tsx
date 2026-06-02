import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, interFamily, monoFamily } from "../theme";
import { SceneWrapper } from "../components";

const EnergyLines: React.FC = () => {
  const frame = useCurrentFrame();
  const n = 12;
  return (
    <svg
      width="1000"
      height="1000"
      viewBox="-500 -500 1000 1000"
      style={{ position: "absolute" }}
    >
      {new Array(n).fill(0).map((_, i) => {
        const ang = (i / n) * Math.PI * 2;
        const phase = (frame * 0.018 + i / n) % 1;
        const r0 = interpolate(phase, [0, 1], [90, 420]);
        const r1 = r0 + 80;
        const o = interpolate(phase, [0, 0.2, 0.8, 1], [0, 0.45, 0.45, 0]);
        return (
          <line
            key={i}
            x1={Math.cos(ang) * r0}
            y1={Math.sin(ang) * r0}
            x2={Math.cos(ang) * r1}
            y2={Math.sin(ang) * r1}
            stroke={COLORS.blue}
            strokeWidth="6"
            strokeLinecap="round"
            opacity={o}
          />
        );
      })}
    </svg>
  );
};

const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const floatY = Math.sin(frame * 0.09) * 9;
  return (
    <div style={{ transform: `translateY(${floatY}px)`, marginBottom: 36 }}>
      <svg width="320" height="200" viewBox="0 0 320 200">
        <rect x="0" y="0" width="320" height="200" rx="20" fill={COLORS.navy} />
        <rect x="22" y="22" width="130" height="12" rx="6" fill={COLORS.mist} opacity="0.5" />
        {[0, 1, 2, 3].map((i) => {
          const h = interpolate(frame, [i * 5, i * 5 + 20], [0, 50 + i * 22], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <rect
              key={i}
              x={34 + i * 64}
              y={166 - h}
              width="38"
              height={h}
              rx="6"
              fill={COLORS.blue}
            />
          );
        })}
        <polyline
          points="34,150 98,126 162,92 226,64 290,44"
          fill="none"
          stroke={COLORS.sky}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 6, fps, durationInFrames: 26, config: { damping: 200 } });
  const zeroScale = interpolate(s, [0, 1], [0.4, 1]);
  return (
    <SceneWrapper>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", zIndex: 0 }}>
        <EnergyLines />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", zIndex: 1 }}>
        <Dashboard />
        <div
          style={{
            fontFamily: interFamily,
            fontWeight: 800,
            color: COLORS.cloud,
            fontSize: 56,
            letterSpacing: "-1px",
          }}
        >
          4Selet.
        </div>
        <div
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            color: COLORS.blue,
            fontSize: 280,
            lineHeight: 1,
            letterSpacing: "-6px",
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
            fontSize: 60,
            marginTop: 4,
            textAlign: "center",
          }}
        >
          de taxa por 3 meses
        </div>
        <div
          style={{
            fontFamily: monoFamily,
            fontWeight: 500,
            color: COLORS.mist,
            fontSize: 26,
            marginTop: 22,
            textAlign: "center",
          }}
        >
          ou até R$ 300 mil em vendas · R$ 1,99 por transação
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
};
