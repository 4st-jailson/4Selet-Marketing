import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS, interFamily, monoFamily } from "../theme";
import { SceneWrapper } from "../components";

const Check: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const len = 46;
  return (
    <svg width="66" height="66" viewBox="0 0 66 66">
      <circle
        cx="33"
        cy="33"
        r="29"
        fill="none"
        stroke={COLORS.blue}
        strokeWidth="4"
        opacity={interpolate(p, [0, 1], [0.15, 1])}
      />
      <path
        d="M20 34 L29 43 L46 24"
        fill="none"
        stroke={COLORS.cloud}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={interpolate(p, [0, 1], [len, 0])}
      />
    </svg>
  );
};

const Row: React.FC<{ delay: number; children: React.ReactNode }> = ({
  delay,
  children,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tx = interpolate(frame, [delay, delay + 12], [-26, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        opacity: o,
        transform: `translateX(${tx}px)`,
      }}
    >
      <Check delay={delay} />
      <div
        style={{
          fontFamily: interFamily,
          fontWeight: 500,
          color: COLORS.cloud,
          fontSize: 46,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const M: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ fontFamily: monoFamily, fontWeight: 700, color: COLORS.sky }}>
    {children}
  </span>
);

export const Benefits: React.FC = () => (
  <SceneWrapper slide>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 44,
        alignItems: "flex-start",
      }}
    >
      <Row delay={4}>
        <M>95%</M> de aprovação no cartão
      </Row>
      <Row delay={20}>
        <M>R$ 1,99</M> por transação
      </Row>
      <Row delay={36}>Suporte de gente de verdade</Row>
    </div>
  </SceneWrapper>
);
