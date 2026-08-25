import React from "react";
import {
  AbsoluteFill, Img, Sequence, staticFile, spring,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
} from "remotion";
import { COLORS, interFamily, monoFamily } from "./theme";
import { DotsOverlay, SceneWrapper, WordByWord } from "./components";

// Composition parametrizada pelo conceito gerado no painel (video/scenes.json).
//
// REFORMULACAO (ago/2026). Antes daqui a cena tinha UM formato so: sobrescrito com contador
// ("ABERTURA · 3/7"), manchete, subtexto. Tudo o que a IA escrevia como direcao de arte — numero
// em destaque, rotulo, lista de itens, cor do fundo, foto — era gravado no conceito e jogado fora
// no caminho para ca. O video saia com 3s cravados por cena, sem a marca 4Selet em cena nenhuma,
// e repetindo a chamada quando a ultima manchete JA era a chamada.
//
// Agora cada um desses campos existe de verdade e desenha:
//   numero + rotulo -> a cena vira um DADO (o numero e o protagonista)
//   itens[]         -> a cena vira uma LISTA com entrada escalonada
//   fundo / foto    -> a cena tem cor propria, ou foto de fundo com veu de leitura
//   duracao         -> 2,5s a 6s por cena, em vez de 3s para todas
export type BrandScene = {
  type: string;
  text: string;
  subtitle?: string;
  /** LEGADO: nos conceitos antigos o adaptador punha o subtexto neste campo. */
  visual?: string;
  /** O dado que vira protagonista da cena (ex.: "7,9%", "R$ 7.900", "0%"). */
  numero?: string;
  /** Rotulo curto em maiusculas — sob o numero, ou como sobrescrito da cena. */
  rotulo?: string;
  /** Ate 3 itens curtos; entram escalonados, com marcador. */
  itens?: string[];
  /** "navy" | "darker" | "blue" | "foto" — sem isto, alterna navy/darker por cena. */
  fundo?: string;
  /** Caminho relativo ao public do Remotion, ou URL http(s). */
  foto?: string;
  /** Segundos de tela desta cena (2,5 a 6). */
  duracao?: number;
};
export type BrandStoryProps = {
  concept?: string;
  cta?: string;
  scenes?: BrandScene[];
};

const FPS_BASE = 30;
const DURACAO_PADRAO = 3.5;
const DURACAO_MIN = 2.5;
const DURACAO_MAX = 6;

// A duracao deixou de ser cravada. O conceito ja dizia "Duracao: 4s" cena a cena e ninguem lia:
// um roteiro que o modelo escreveu para 31s saia com 21s, e a cena de lista tinha o mesmo tempo
// de tela que a cena de tres palavras.
export const framesDaCena = (s?: BrandScene | null): number => {
  const seg = Number(s && s.duracao);
  const usada = Number.isFinite(seg) && seg > 0
    ? Math.min(DURACAO_MAX, Math.max(DURACAO_MIN, seg))
    : DURACAO_PADRAO;
  return Math.round(usada * FPS_BASE);
};

export const brandStoryDuration = (scenes?: BrandScene[] | null): number => {
  const lista: (BrandScene | null)[] = Array.isArray(scenes) && scenes.length ? scenes : [null];
  return Math.max(1, lista.reduce((t, s) => t + framesDaCena(s), 0));
};

const eyebrowFor = (type: string): string => {
  switch ((type || "").toLowerCase()) {
    case "problem": return "O PROBLEMA";
    case "product": return "A PLATAFORMA";
    case "benefit": return "O QUE MUDA";
    case "cta": return "PRÓXIMO PASSO";
    default: return "";
  }
};

const FUNDOS: Record<string, string> = {
  darker: `radial-gradient(120% 120% at 50% 20%, ${COLORS.navy} 0%, ${COLORS.darker} 52%, ${COLORS.darkest} 100%)`,
  navy: `radial-gradient(125% 125% at 50% 28%, ${COLORS.blue} 0%, ${COLORS.navy} 44%, ${COLORS.darker} 100%)`,
  blue: `radial-gradient(120% 120% at 50% 34%, ${COLORS.sky} 0%, ${COLORS.blue} 38%, ${COLORS.navy} 100%)`,
};

const fonteDaFoto = (foto: string): string =>
  /^https?:\/\//i.test(foto) ? foto : staticFile(foto);

// Foto de fundo com deriva lenta (quadro parado numa cena de 4s denuncia que e imagem estatica)
// e veu de leitura por cima — sem ele a manchete branca some no claro da foto.
const FotoDeFundo: React.FC<{ foto: string }> = ({ foto }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const escala = interpolate(frame, [0, durationInFrames], [1.05, 1.14], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.linear,
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${escala})` }}>
        <Img src={fonteDaFoto(foto)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(7,33,43,.78) 0%, rgba(7,33,43,.58) 22%,"
            + " rgba(7,33,43,.80) 46%, rgba(7,33,43,.78) 68%, rgba(5,12,18,.93) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Rotulo: React.FC<{ texto: string; espaco?: number }> = ({ texto, espaco }) => (
  <div
    style={{
      fontFamily: monoFamily, fontWeight: 500, color: COLORS.cloud, opacity: 0.62,
      fontSize: 36, letterSpacing: 7, textTransform: "uppercase",
      marginBottom: espaco == null ? 44 : espaco,
    }}
  >
    {texto}
  </div>
);

// O numero entra com mola contida e escala conforme o tamanho do dado: "0%" ocupa a tela,
// "R$ 7.900" recua o suficiente para nao quebrar em duas linhas.
const NumeroGrande: React.FC<{ texto: string }> = ({ texto }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mola = spring({ frame, fps, config: { damping: 200, mass: 0.55 }, durationInFrames: 24 });
  const escala = interpolate(mola, [0, 1], [0.78, 1]);
  const opacidade = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
  });
  const n = texto.trim().length;
  const tamanho = Math.round(Math.max(148, Math.min(300, 300 - Math.max(0, n - 3) * 25)));
  return (
    <div
      style={{
        fontFamily: interFamily, fontWeight: 900, color: "#FFFFFF",
        fontSize: tamanho, lineHeight: 0.94, letterSpacing: -6,
        opacity: opacidade, transform: `scale(${escala})`,
      }}
    >
      {texto}
    </div>
  );
};

const ListaDeItens: React.FC<{ itens: string[]; inicio: number }> = ({ itens, inicio }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, alignItems: "flex-start", marginTop: 46 }}>
      {itens.map((item, i) => {
        const comeco = inicio + i * 9;
        const o = interpolate(frame, [comeco, comeco + 12], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
        });
        const tx = interpolate(frame, [comeco, comeco + 12], [-22, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "baseline", gap: 20,
              opacity: o, transform: `translateX(${tx}px)`,
            }}
          >
            <span style={{ color: COLORS.sky, fontFamily: interFamily, fontWeight: 700, fontSize: 34 }}>▸</span>
            <span style={{ fontFamily: interFamily, fontWeight: 500, fontSize: 46, color: COLORS.cloud, lineHeight: 1.25 }}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// A marca 4Selet passa a existir no video. Antes NAO aparecia em cena nenhuma — nem na ultima,
// que era exatamente onde todo conceito gerado pedia o logo.
// Fica no ALTO porque o rodape do Reels e do aplicativo (perfil, legenda, botoes).
const MarcaDiscreta: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [4, 20], [0, 0.46], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 96 }}>
      <Img src={staticFile("logo-4selet-light.png")} style={{ width: 150, opacity: o }} />
    </AbsoluteFill>
  );
};

const MarcaFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [14, 34], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease),
  });
  const ty = interpolate(frame, [14, 34], [16, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  return (
    <Img
      src={staticFile("logo-4selet-light.png")}
      style={{ width: 320, marginTop: 76, opacity: o, transform: `translateY(${ty}px)` }}
    />
  );
};

// "Falar com o time." de manchete + pilula "Falar com o time" embaixo era a mesma frase duas
// vezes na mesma tela. So mostra a pilula quando ela ACRESCENTA alguma coisa.
const mesmaFrase = (a: string, b: string): boolean => {
  const limpa = (s: string) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
  return !!limpa(a) && limpa(a) === limpa(b);
};

const SceneCard: React.FC<{ scene: BrandScene; index: number; total: number; cta?: string }> = ({
  scene, index, total, cta,
}) => {
  const chamada = String(cta || "").trim();
  const ehCta = (scene.type || "").toLowerCase() === "cta";
  const ultima = index === total - 1;
  const mostraCta = !!chamada && (ehCta || ultima) && !mesmaFrase(chamada, scene.text || "");
  const apoioBruto = String(scene.subtitle != null ? scene.subtitle : (scene.visual || "")).trim();
  // A chamada tambem aparecia como SUBTEXTO: na cena final saiam "Falar com o time." de apoio e
  // "Falar com o time" na pilula, uma embaixo da outra. Entre as duas, quem fica e a pilula — ela
  // e o elemento acionavel; o apoio repetido e so ruido.
  const apoio = mostraCta && mesmaFrase(chamada, apoioBruto) ? "" : apoioBruto;
  const numero = String(scene.numero || "").trim();
  const rotulo = String(scene.rotulo || "").trim();
  const itens = (Array.isArray(scene.itens) ? scene.itens : [])
    .map((x) => String(x || "").trim()).filter(Boolean).slice(0, 3);
  const sobrescrito = rotulo && !numero ? rotulo : (rotulo ? "" : eyebrowFor(scene.type));

  // Com numero em cena a manchete recua para papel de apoio — dois protagonistas na mesma tela
  // e nenhum protagonista.
  const tamManchete = numero
    ? Math.round(Math.max(52, Math.min(72, 72 - Math.max(0, (scene.text || "").length - 34) * 0.7)))
    : Math.round(Math.max(72, Math.min(116, 116 - Math.max(0, (scene.text || "").length - 40) * 1.1)));

  return (
    <SceneWrapper slide keepEnd={ultima} pad="170px 92px 260px">
      <div style={{ width: "100%", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {sobrescrito ? <Rotulo texto={sobrescrito} /> : null}
        {numero ? <NumeroGrande texto={numero} /> : null}
        {numero && rotulo ? <div style={{ height: 26 }} /> : null}
        {numero && rotulo ? <Rotulo texto={rotulo} espaco={40} /> : null}
        <WordByWord
          text={scene.text || ""}
          janela={Math.max(14, framesDaCena(scene) * 0.42)}
          delay={numero ? 10 : 0}
          style={{
            fontFamily: interFamily, fontWeight: 900,
            fontSize: tamManchete, lineHeight: 1.04,
            color: "#FFFFFF", letterSpacing: numero ? -1 : -2,
          }}
        />
        {apoio ? (
          <div
            style={{
              fontFamily: interFamily, fontWeight: 400, fontSize: 40,
              color: COLORS.mist, marginTop: 40, lineHeight: 1.3, maxWidth: 840,
            }}
          >
            {apoio}
          </div>
        ) : null}
        {itens.length ? <ListaDeItens itens={itens} inicio={numero ? 26 : 18} /> : null}
        {mostraCta ? (
          <div
            style={{
              display: "inline-block", marginTop: 62,
              fontFamily: interFamily, fontWeight: 800, fontSize: 46, color: "#FFFFFF",
              background: COLORS.blue, padding: "30px 60px", borderRadius: 999,
            }}
          >
            {chamada}
          </div>
        ) : null}
        {ultima ? <MarcaFinal /> : null}
      </div>
    </SceneWrapper>
  );
};

const Cena: React.FC<{ scene: BrandScene; index: number; total: number; cta?: string }> = ({
  scene, index, total, cta,
}) => {
  const foto = String(scene.foto || "").trim();
  const escolhido = String(scene.fundo || "").toLowerCase().trim();
  // Sem fundo declarado, alterna navy/darker: um gradiente unico do primeiro ao ultimo quadro
  // fazia as sete cenas parecerem a mesma tela com o texto trocando.
  const chave = FUNDOS[escolhido] ? escolhido : (index % 2 === 0 ? "navy" : "darker");
  const ultima = index === total - 1;
  return (
    <AbsoluteFill style={{ background: FUNDOS[chave] }}>
      {foto ? <FotoDeFundo foto={foto} /> : <DotsOverlay />}
      {!ultima ? <MarcaDiscreta /> : null}
      <SceneCard scene={scene} index={index} total={total} cta={cta} />
    </AbsoluteFill>
  );
};

export const BrandStory: React.FC<BrandStoryProps> = ({ scenes, cta }) => {
  const list: BrandScene[] = Array.isArray(scenes) && scenes.length
    ? scenes
    // Sem cenas a peca nao tem conteudo — e o texto de reserva NAO pode ser a frase-tag, que e
    // proibida como assinatura (lib/prompts.js, bloco GOVERNANCE).
    : [{ type: "hook", text: "4Selet", subtitle: "" }];
  let cursor = 0;
  return (
    <AbsoluteFill style={{ background: COLORS.darker }}>
      {list.map((scene, i) => {
        const dur = framesDaCena(scene);
        const from = cursor;
        cursor += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Cena scene={scene} index={i} total={list.length} cta={cta} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
