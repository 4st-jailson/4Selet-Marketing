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
  // A ULTIMA cena nao deve sumir: com o fade-out ligado, o video terminava num quadro
  // praticamente vazio — e no Reels o ultimo quadro e o que muitos players congelam.
  keepEnd?: boolean;
}> = ({ children, slide, keepEnd }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // 8 quadros, nao 12. Como as cenas deixaram de se sobrepor, a entrada e a saida viraram tempo de
  // tela quase vazia entre uma cena e outra: com 12 de cada lado davam 0,8s por troca — 20% de um
  // video de 12s. Com 8, a transicao continua suave e o vazio cai para pouco mais de meio segundo.
  const T = 8;
  const fadeIn = interpolate(frame, [0, T], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });
  const fadeOut = keepEnd ? 1 : interpolate(
    frame,
    [durationInFrames - T, durationInFrames],
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
  // frames que a frase INTEIRA pode levar para entrar. Sem esse teto, uma headline longa so
  // ficava completa quando o fade de saida ja tinha comecado: sobrava menos de meio segundo
  // de leitura. Com ele, as palavras terminam de entrar na primeira metade da cena.
  janela?: number;
}> = ({ text, delay = 0, stagger = 3.5, style, janela }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  if (janela && words.length > 1) stagger = Math.min(stagger, janela / (words.length - 1));
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
