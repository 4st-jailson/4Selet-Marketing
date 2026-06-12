import React from "react";
import { Composition } from "remotion";
import { AdVideo } from "./AdVideo";
import { CampanhaDemo } from "./CampanhaDemo";
import { BrandStory, BrandStoryProps, brandStoryDuration } from "./BrandStory";

const defaultScenes: BrandStoryProps = {
  concept: "Os 4 numeros que definem a margem do produtor.",
  cta: "Conhecer a plataforma",
  scenes: [
    { type: "hook", text: "7,9% nao e o seu problema.", visual: "numero grande em fundo Navy" },
    { type: "benefit", text: "95% de aprovacao no cartao.", visual: "comparativo de barras" },
    { type: "benefit", text: "PIX em D+10. 0% por 3 meses.", visual: "linha do tempo" },
    { type: "cta", text: "Para quem sabe que e Selet.", visual: "" },
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
