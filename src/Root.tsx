import React from "react";
import { Composition } from "remotion";
import { AdVideo } from "./AdVideo";
import { CampanhaDemo } from "./CampanhaDemo";
import { BrandStory, BrandScene, BrandStoryProps, brandStoryDuration } from "./BrandStory";

// Cenas de exemplo da composition. NAO sao decorativas: e o que aparece ao abrir o Remotion
// Studio e o que sai quando alguem renderiza pelo CLI sem passar --props. Por isso a ultima cena
// deixou de trazer a frase-tag da marca — ela nao assina peca (regra dura em
// knowledge/brand_identity.md e no bloco GOVERNANCE de interface/lib/prompts.js), e pelo Studio
// TODO video saia assinado com ela. O texto de exemplo tambem esta acentuado, porque estas
// strings vao desenhadas na tela.
//
// O exemplo usa os campos NOVOS (numero, rotulo, itens, fundo, duracao) de proposito: quem abre o
// Studio precisa ver o que a composition sabe fazer hoje, nao o formato antigo de so texto.
const defaultScenes: BrandStoryProps = {
  concept: "Os números que definem a margem do produtor.",
  cta: "Conhecer a plataforma",
  scenes: [
    {
      type: "hook", text: "Não é o seu problema.",
      subtitle: "É o que o mercado tira de cada venda sua.",
      numero: "7,9%", rotulo: "da sua margem", fundo: "darker", duracao: 4,
    },
    {
      type: "benefit", text: "Aprovação no cartão.",
      subtitle: "Multiadquirência: mais venda aprovada, mais margem real.",
      numero: "95%", rotulo: "aprovação", fundo: "navy", duracao: 4,
    },
    {
      type: "product", text: "As condições, sem letra miúda.",
      itens: ["0% por 3 meses", "R$ 1,99 por transação", "PIX em D+10, cartão em D+30"],
      fundo: "blue", duracao: 5.5,
    },
    {
      type: "cta", text: "Acesso por convite.",
      subtitle: "A plataforma é para quem opera com seriedade.",
      fundo: "navy", duracao: 4.5,
    },
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
        durationInFrames={brandStoryDuration(defaultScenes.scenes)}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultScenes}
        // A duracao passou a SOMAR o tempo de cada cena. Enquanto era numero-de-cenas x 3s, a
        // duracao que o modelo escrevia no conceito nao chegava a lugar nenhum.
        calculateMetadata={({ props }) => ({
          durationInFrames: brandStoryDuration(props.scenes as BrandScene[] | undefined),
        })}
      />
    </>
  );
};
