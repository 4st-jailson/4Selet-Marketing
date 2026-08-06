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

const eyebrowFor = (type: string): string => {
  switch ((type || "").toLowerCase()) {
    case "hook": return "ABERTURA";
    case "problem": return "O PROBLEMA";
    case "product": return "A PLATAFORMA";
    case "benefit": return "O QUE MUDA";
    case "cta": return "PRÓXIMO PASSO";
    default: return "4SELET";
  }
};

const SceneCard: React.FC<{ scene: BrandScene; index: number; total: number; cta?: string }> = ({
  scene, index, total, cta,
}) => {
  // A pílula só existe quando HÁ chamada. Antes ela aparecia na última cena sempre — inclusive
  // em peça sem CTA nenhum, e num vídeo de uma cena só aparecia logo na primeira.
  const chamada = String(cta || "").trim();
  const mostraCta = !!chamada && ((scene.type || "").toLowerCase() === "cta" || index === total - 1);
  const ultima = index === total - 1;
  return (
    <SceneWrapper slide keepEnd={ultima}>
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
          janela={PER_SCENE * 0.45}
          style={{
            fontFamily: interFamily,
            fontWeight: 900,
            // Escala contínua em vez de dois degraus: entre 116 e 72 conforme o tamanho do texto,
            // para headline longa não estourar nem virar bloco ilegível.
            fontSize: Math.round(Math.max(72, Math.min(116, 116 - Math.max(0, (scene.text || "").length - 40) * 1.1))),
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
        {mostraCta ? (
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
            {chamada}
          </div>
        ) : null}
      </div>
    </SceneWrapper>
  );
};

// O `cta` era desestruturado fora: o render grava a chamada em video/scenes.json e a composicao
// nunca a lia — o campo ia para o disco e era jogado no lixo. Quando a chamada aparecia na tela,
// era por acaso, porque o modelo tinha repetido a frase dentro do subtexto da ultima cena.
export const BrandStory: React.FC<BrandStoryProps> = ({ scenes, cta }) => {
  const list: BrandScene[] = Array.isArray(scenes) && scenes.length
    ? scenes
    // Sem cenas a peca nao tem conteudo — e o texto de reserva NAO pode ser a frase-tag, que e
    // proibida como assinatura (lib/prompts.js, bloco GOVERNANCE).
    : [{ type: "hook", text: "4Selet", visual: "" }];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(125% 125% at 50% 28%, ${COLORS.blue} 0%, ${COLORS.navy} 42%, ${COLORS.darker} 100%)`,
      }}
    >
      <DotsOverlay />
      {/* As cenas nao se sobrepoem mais. Antes cada uma comecava 12 quadros antes de a anterior
          acabar, e nesse intervalo os DOIS textos ficavam na tela a meia opacidade — acontecia em
          toda troca, quase 4% do video virava borrao. Agora uma sai e a outra entra. */}
      {list.map((scene, i) => (
        <Sequence key={i} from={i * PER_SCENE} durationInFrames={PER_SCENE}>
          <SceneCard scene={scene} index={i} total={list.length} cta={cta} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Duracao total em frames para um numero de cenas (usado no Root via calculateMetadata).
export const brandStoryDuration = (n: number): number => Math.max(1, n) * PER_SCENE;
