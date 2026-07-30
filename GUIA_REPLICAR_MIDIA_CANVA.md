# Guia: replicar "4Selet na Mídia" à mão no Canva

Objetivo: você conseguir refazer QUALQUER peça de "4Selet na mídia" sozinho, sem depender da
ferramenta. A ferramenta e este guia usam exatamente os mesmos tokens (cores, fontes, layout),
então o resultado bate. Onde o Canva não faz igual (gradiente/brilho de vidro), fica bem próximo.

---

## 1) Kit — junte uma vez (e salve como "Marca" no Canva)

**Logos** (já estão no projeto, pasta `assets/`):
- `logo-4selet-light.png` — logo claro, para fundo ESCURO (é o que usamos).
- `logo-4selet.png` — logo escuro, para fundo CLARO.
- `simbolo.svg` — só o símbolo "4".

**Cores da marca** (no Canva: menu Marca → Cores, ou cole o HEX em cada elemento):
| Nome | HEX | Uso |
|---|---|---|
| Darker | `#07212B` | fundo mais escuro (bordas do gradiente) |
| Navy | `#003554` | fundo base |
| Blue | `#006494` | topo do gradiente / brilho |
| Sky | `#5499B5` | "na mídia", links, detalhes, molduras |
| Mist | `#AFBCC9` | textos secundários / eyebrow |
| Cloud | `#D9DCD6` | quase-branco |
| Branco | `#FFFFFF` | "4Selet" do título |

**Fontes** (existem no Canva): **Inter** (títulos e texto) e **JetBrains Mono** (só o "olho"/eyebrow, tipo `VALOR ECONÔMICO · PULSEBRAND`).

**Logo do veículo**: baixe do site (ex.: "Valor Econômico logo png", "Estadão logo png").

**Print da matéria**: screenshot do artigo no SEU navegador (logado) — retrato, mostrando cabeçalho + manchete + foto. É assim que você resolve sites que bloqueiam captura automática (Estadão).

---

## 2) Tamanhos (crie o design no Canva com estas medidas)
- Feed Instagram: **1080 × 1350**
- Quadrado: **1080 × 1080**
- Story/Reels: **1080 × 1920**
- Paisagem (LinkedIn/site): **1920 × 1080**

---

## 3) O "enquadramento de marca" (igual nas duas referências)
Vale para os dois estilos — é o que dá a cara de "4Selet na mídia":
1. **Topo-esquerda:** logo `4SELET` (light). Altura ~6% da arte.
2. **Topo-direita:** `4Selet na mídia` — "4Selet" branco (Inter 800) + "na mídia" azul-céu `#5499B5` (Inter 700), com uma barrinha vertical ao lado.
3. **Rodapé-esquerda:** card BRANCO arredondado com o logo do veículo dentro (respiro nas bordas).
4. **Rodapé-direita:** `Leia a matéria completa` (branco, Inter 600) + a URL em `#5499B5` (Inter 700) + uma seta `›` dentro de um círculo com borda azul.
5. **Regra de ouro:** a matéria fica SEMPRE reta (retângulo perfeito). Nunca incline/distorça o texto.

---

## 4) ESTILO A — Foto realista (mão + tablet), tipo Valor
1. **Fundo:** foto de mesa escura (Elementos → busque `dark desk` / `desk coffee dark`) OU um retângulo com gradiente navy (`#006494` → `#003554` → `#07212B`).
2. **Mockup do tablet:** Canva → **Apps → Smartmockups → Tablet**. Escolha um "mão segurando tablet" quase DE FRENTE (pouca inclinação — é o que mantém a matéria legível/reta).
   - Alternativa: Elementos → `hand holding tablet` (procure um PNG com fundo transparente).
3. **Tela:** no Smartmockups, faça **upload do print da matéria** como a imagem da tela. Ele encaixa reto sozinho.
4. Aplique o **enquadramento de marca** (seção 3).
5. Exporte **PNG**.

## 5) ESTILO B — Gráfico chapado, tipo Estadão
1. **Fundo:** retângulo navy com gradiente (mesmo do item A.1).
2. **Textura:** Elementos → `dots grid` (pontos), opacidade ~15%, cor `#5499B5`.
3. **Molduras de tecnologia:** retângulos com cantos arredondados e **borda fina** `#5499B5` nos 4 cantos (o "colchete" tech das bordas). Sem preenchimento.
4. **Device:** Elementos → `browser window` OU `tablet frame` (reto). Use um **Frame/Moldura** e arraste o print da matéria pra dentro.
5. Aplique o **enquadramento de marca** (seção 3).
6. Exporte **PNG**.

---

## 6) Garantia: replicar TUDO que a ferramenta gerou
Toda peça da ferramenta nasce destes mesmos tokens:
- **Cores:** só a paleta acima. **Fontes:** só Inter (+ JetBrains Mono nos detalhes). **Sem emoji.**
- **Feed/anúncio estático:** fundo navy + Selet Dots, título Inter forte (≤4 palavras), subtexto Mist, CTA. Área segura ~74px de margem.
- **Carrossel:** cada slide 1080×1350, capa com título + slides de conteúdo (foto de fundo opcional com scrim escuro pra leitura).
- **Mídia (esta):** os dois estilos acima.
Ou seja: com o kit da seção 1 + as medidas da seção 2, você reconstrói qualquer uma no Canva. Se quiser, eu escrevo o passo-a-passo específico de um tipo (ex.: carrossel) do mesmo jeito.

> Observação honesta: alguns efeitos (gradiente exato, brilho de vidro do tablet, sombra rica) ficam
> APROXIMADOS no Canva — o olho não percebe diferença no feed. A ferramenta entrega pixel-perfeito;
> o Canva entrega "muito próximo e editável à mão". Os dois partem da mesma receita.
