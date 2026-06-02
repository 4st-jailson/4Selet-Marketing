import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS } from "./theme";
import { DotsOverlay } from "./components";
import { Hook } from "./scenes/Hook";
import { Problem } from "./scenes/Problem";
import { Solution } from "./scenes/Solution";
import { Benefits } from "./scenes/Benefits";
import { CTA } from "./scenes/CTA";

export const AdVideo: React.FC = () => {
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
        <Problem />
      </Sequence>
      <Sequence from={176} durationInFrames={130}>
        <Solution />
      </Sequence>
      <Sequence from={296} durationInFrames={100}>
        <Benefits />
      </Sequence>
      <Sequence from={386} durationInFrames={64}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
