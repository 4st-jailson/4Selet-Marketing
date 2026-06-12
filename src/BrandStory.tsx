import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, interFamily, monoFamily } from "./theme";
import { DotsOverlay, SceneWrapper, WordByWord } from "./components";

// Composition parametrizada pelo conceito gerado no painel (video/scenes.json).
// props = { concept, cta, scenes: [{ type, text, visual }] }
export type BrandScene = { type: string; text: string; visual?: string };
export type BrandStoryProps = {
  concept?: string;
  cta?: string;
  scenes?: BrandScene[];
};

const PER_SCENE = 90; // frames por cena (3s @ 30fps)
const FADE = 12;

const eyebrowFor = (type: string): string => {
  switch ((type || "").toLowerCase()) {
    case "hook": return "ABERTURA";
    case "problem": return "O PROBLEMA";
    case "product": return "A PLATAFORMA";
    case "benefit": return "O QUE MUDA";
    case "cta": return "PROXIMO PASSO";
    default: return "4SELET";
  }
};

const SceneCard: React.FC<{ scene: BrandScene; index: number; total: number }> = ({
  scene, index, total,
}) => {
  const isCta = (scene.type || "").toLowerCase() === "cta" || index === total - 1;
  return (
    <SceneWrapper slide>
      <div style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: monoFamily,
            color: COLORS.sky,
            fontSize: 40,
            letterSpacing: 6,
            marginBottom: 48,
          }}
        >
          {eyebrowFor(scene.type)} · {index + 1}/{total}
        </div>
        <WordByWord
          text={scene.text || ""}
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            fontSize: scene.text && scene.text.length > 48 ? 86 : 116,
            lineHeight: 1.02,
            color: "#FFFFFF",
            letterSpacing: -2,
          }}
        />
        {scene.visual ? (
          <div
            style={{
              fontFamily: interFamily,
              fontWeight: 400,
              fontSize: 40,
              color: COLORS.mist,
              marginTop: 44,
            }}
          >
            {scene.visual}
          </div>
        ) : null}
        {isCta ? (
          <div
            style={{
              display: "inline-block",
              marginTop: 64,
              fontFamily: interFamily,
              fontWeight: 800,
              fontSize: 46,
              color: "#FFFFFF",
              background: COLORS.blue,
              padding: "30px 60px",
              borderRadius: 999,
            }}
          >
            Para quem sabe que e Selet.
          </div>
        ) : null}
      </div>
    </SceneWrapper>
  );
};

export const BrandStory: React.FC<BrandStoryProps> = ({ scenes }) => {
  const list: BrandScene[] = Array.isArray(scenes) && scenes.length
    ? scenes
    : [{ type: "hook", text: "Para quem sabe que e Selet.", visual: "" }];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(125% 125% at 50% 28%, ${COLORS.blue} 0%, ${COLORS.navy} 42%, ${COLORS.darker} 100%)`,
      }}
    >
      <DotsOverlay />
      {list.map((scene, i) => (
        <Sequence key={i} from={i * (PER_SCENE - FADE)} durationInFrames={PER_SCENE}>
          <SceneCard scene={scene} index={i} total={list.length} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Duracao total em frames para um numero de cenas (usado no Root via calculateMetadata).
export const brandStoryDuration = (n: number): number =>
  Math.max(1, n) * (PER_SCENE - FADE) + FADE;
