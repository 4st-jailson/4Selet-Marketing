import React from "react";
import { Composition } from "remotion";
import { AdVideo } from "./AdVideo";
import { CampanhaDemo } from "./CampanhaDemo";
import { BrandStory, BrandStoryProps, brandStoryDuration } from "./BrandStory";

// Cenas de exemplo da composition. NAO sao decorativas: e o que aparece ao abrir o Remotion
// Studio e o que sai quando alguem renderiza pelo CLI sem passar --props. Por isso a ultima cena
// deixou de trazer a frase-tag da marca — ela nao assina peca (regra dura em
// knowledge/brand_identity.md e no bloco GOVERNANCE de interface/lib/prompts.js), e pelo Studio
// TODO video saia assinado com ela. O texto de exemplo tambem esta acentuado, porque estas
// strings vao desenhadas na tela.
const defaultScenes: BrandStoryProps = {
  concept: "Os 4 números que definem a margem do produtor.",
  cta: "Conhecer a plataforma",
  scenes: [
    { type: "hook", text: "7,9% não é o seu problema.", visual: "número grande em fundo Navy" },
    { type: "benefit", text: "95% de aprovação no cartão.", visual: "comparativo de barras" },
    { type: "benefit", text: "PIX em D+10. 0% por 3 meses.", visual: "linha do tempo" },
    { type: "cta", text: "Acesso por convite.", visual: "" },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AdVideo"
        component={AdVideo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CampanhaDemo"
        component={CampanhaDemo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="BrandStory"
        component={BrandStory}
        durationInFrames={brandStoryDuration(defaultScenes.scenes!.length)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultScenes}
        calculateMetadata={({ props }) => ({
          durationInFrames: brandStoryDuration(
            Array.isArray(props.scenes) && props.scenes.length ? props.scenes.length : 1
          ),
        })}
      />
    </>
  );
};
