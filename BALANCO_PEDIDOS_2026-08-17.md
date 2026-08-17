# Balanço dos pedidos — 17 de agosto de 2026

Levantamento de **tudo que você pediu** desde o começo do projeto, conferido **um por um contra o código de hoje**.

A regra que usei foi não acreditar nas minhas próprias anotações: o que eu escrevi na época podia estar otimista, então
cada item foi reaberto e verificado no código atual, com prova (arquivo e linha). Onde não deu para provar, está escrito
que não deu — em vez de um palpite.

## O número

| Situação | Quantos |
|---|---|
| **No ar**, funcionando em mkt.4st.co | **159** |
| **Entregue pela metade** — funciona, mas falta um pedaço do que você pediu | **59** |
| **Não foi feito** | **14** |
| Esperando uma decisão ou uma ação sua | 6 |
| Não se aplica mais | 3 |
| **Total conferido** | **241** |

Nada está "pronto e esperando publicar": tudo que existe no código já está em produção (commit `b381f42`).

---

## O que eu confirmei no servidor agora

Cinco itens que a auditoria não conseguia responder só lendo código — fui olhar em produção:

- **A chave do Pexels ESTÁ configurada em produção.** Minha anotação dizia que faltava; estava desatualizada. A busca de imagens funciona.
- **O primeiro post real pelo painel ACONTECEU.** No histórico há dois registros: `onde_seu_dinheiro_fica` marcada à mão, e `seu_agente_de_ia_respondendo_aluno_sozin_2` **publicada pelo painel**, com link do Instagram. Essa pendência pode ser encerrada.
- **O Instagram está conectado** como @4selet, com o identificador da conta guardado.
- **O @flavio já existe** em produção, sem convite pendente.
- **Nenhuma peça de Mídia está parada em revisão** (0 de 9). Não há nada esperando decisão sua ali.

---

## 1. Não foi feito (14)

São os pedidos que não existem no painel hoje. Alguns por escolha combinada, outros porque ficaram para trás.

### Criação de arte

**Promover preferências recorrentes dele a toggles/opções em Configurações, em vez de conserto peça a peça**  
Nenhum dos ajustes recorrentes virou opção: fecho com CTA de conversão, peso do texto do fecho (bold em vez de extra-bold) e deslocamento do título (titleOffsetY, que hoje é campo por slide em prompts.js:34). Todos continuam sendo conserto peça a peça.
  
*Como conferir:* Abra Configurações e role a página inteira: só aparecem Conexões, Aparência (cores do painel) e Gerenciar tags — nenhuma chave de preferência de arte.

**Incoerência: o editor visual oferece Archivo Black, Playfair Display e Bebas Neue sem aviso, enquanto a criação promete 'só Inter'**  
A incoerência continua de pé, só que deslocada: a criação NÃO promete mais 'só Inter' (ela oferece 8 famílias, mas com o modal Sim/Não que o Hugo desenhou). O editor de arte oferece outra lista, sem aviso nenhum, e duas dessas fontes (Archivo Black e Georgia) o motor de render nem conhece — a arte só sai com elas porque o editor carrega a fonte do Google direto (app.js:2419).
  
*Como conferir:* No editor de arte, abra a caixinha de Fonte e escolha Playfair ou Archivo Black: troca na hora, sem perguntar nada — enquanto o mesmo tipo de escolha na tela de criação abre um aviso perguntando se quer sair da identidade da marca.

### Criar conteúdo e briefing

**Verde/vermelho funcionais (cores semânticas) na arte**  
Nenhum arquétipo (comparação, medidor, números, lista) usa verde para o que ganha e vermelho para o que perde — tudo sai na escala azul da marca. Único jeito hoje é pintar o texto na mão no editor de arte (seletor de cor, interface/public/js/app.js:2474).
  
*Como conferir:* Gere um carrossel de comparação (ex.: 'aprovação da 4Selet vs mercado'): os dois lados saem em azul/cinza, sem verde no que ganha nem vermelho no que perde.

**Exportar o carrossel como UMA imagem contínua**  
Falta o botão que transforma a montagem do quadro (ou os N slides) num único arquivo de imagem contínua para baixar. Hoje o único download é o ZIP com os slides soltos.
  
*Como conferir:* Abra um carrossel aprovado, clique em 'Ver no quadro' e monte os slides lado a lado: não existe botão de baixar/exportar ali; o único download é 'Baixar todos (ZIP)', que traz os slides em arquivos separados.

**A IA sugerir conteúdos complementares / apontar oportunidades quando identificar lacunas ou melhorias**  
Tudo. O que existe hoje é o oposto do pedido: o /interpret foi deliberadamente fechado em três campos e joga fora observações extras do modelo (comentário em generate.js:525-528). Não existe nenhum ponto do painel que diga 'você poderia fazer também X' ou aponte lacuna de conteúdo.
  
*Como conferir:* Criar conteúdo: escreva um tema propositalmente incompleto e clique em Gerar — o painel só diz o que preencheu e o que não deu para saber; nunca sugere uma peça complementar ou uma oportunidade.

**Poder trocar o aparelho (mockup) de uma peça de Mídia já criada**  
Tudo: (a) fazer setMediaMeta aceitar merge parcial (hoje reescreve o objeto inteiro), (b) criar um endpoint tipo POST /api/content/:folder/media para gravar só o modelo, (c) trocar o fragmento do palco na arte já renderizada (ou re-renderizar avisando). Hoje, para mudar o aparelho, só criando outra peça.
  
*Como conferir:* Abra uma peça de "4Selet na Mídia" já criada: o cartão "Mockup da matéria" mostra qual aparelho está em uso, mas não existe nenhum botão ou lista para trocá-lo — o aparelho só é escolhido na tela de criação.

**Poder editar os outros formatos da peça (1:1, 9:16, 16:9), não só o 4:5**  
Tudo: o editor não lista nem abre square.png / story.png / media_16x9.png, e não há seletor de formato dentro do editor. Some-se a isso que só o 4:5 tem o sidecar .editable.json — os outros formatos precisariam ganhar esse arquivo para serem editáveis. O risco que ele levantou (montar um formato e publicar outro, não editado) continua de pé.
  
*Como conferir:* Abra a peça de Mídia e clique em "Montar no editor": abre sempre a versão 4:5 e não há nenhuma aba, seta ou lista para escolher 1:1, 9:16 ou 16:9 — as outras versões só aparecem como imagem na peça, sem botão de editar.

**Avisar antes de perder a montagem do mockup ao clicar em "Gerar arte final"**  
Falta a confirmação explícita antes do re-render quando a peça já tem edição manual salva (algo como "isto refaz a arte do zero e descarta a montagem que você fez no editor"), e falta o painel saber que a peça foi editada à mão para só perguntar nesse caso.
  
*Como conferir:* Monte o mockup no editor, salve, volte à peça e clique em "Gerar nova versão da arte": ela é refeita na hora, sem nenhuma pergunta, e a montagem que você fez se perde.

### Painel e editor

**Tipografia por palavra no editor de arte (fonte/tamanho/cor aplicados só à palavra selecionada)**  
Tudo. Fonte, tamanho, cor, negrito e itálico continuam valendo para a caixa de texto inteira. Era o item que ele mesmo mandou fazer por último, então está coerente com o combinado — mas não foi feito.
  
*Como conferir:* Abra uma peça, clique em "Editar arte", dê duplo clique numa caixa de texto, selecione UMA palavra e mude a fonte ou o tamanho na barra: a mudança pega a caixa toda, não a palavra.

**Miniatura/representação da arte no seletor de estilo GERAL (Editorial / Destaque / Dividido / Foto)**  
O seletor de estilo geral continua 100% texto nos dois lugares: no Criar conteúdo é uma lista suspensa ("Editorial — gradiente azul, headline à esquerda"), e na página da peça são 4 cartões só com nome e descrição. A ideia de miniatura foi construída APENAS para o seletor de mockup da peça de Mídia — não foi levada para Editorial/Destaque/Dividido/Foto.
  
*Como conferir:* Abra uma peça e olhe o bloco "Estilo visual da arte": os quatro cartões (Editorial, Destaque, Dividido, Foto) têm só nome e texto, nenhuma imagem — diferente do seletor de mockup da peça de Mídia, que mostra a arte.

**Decidir se a regra "sem emoji" vale também para o CONTEÚDO GERADO (hoje o brand_identity permite 1 emoji funcional)**  
Falta a DECISÃO do Hugo: hoje o "sem emoji" vale só para a interface do painel; a legenda que a IA escreve ainda pode levar 1 emoji funcional. Se ele quiser zero emoji também no texto gerado, é mudar a tabela em knowledge/brand_identity.md e a checagem em lib/config.js.
  
*Como conferir:* Gere uma legenda de Instagram e repare: a IA pode incluir uma seta ou marcador funcional; o painel só recusa os emojis de hype (fogo, foguete, dinheiro).

### Publicação e integrações

**Cross-post para o Facebook / rascunho nativo na BM do Facebook (Fase 2)**  
Tudo: não existe chamada de publicação em Página do Facebook, não existe pedido da permissão pages_manage_posts e não existe opção de cross-post na tela. O painel guardou o ID da Página, o que adianta o primeiro passo quando a fase 2 for construída.
  
*Como conferir:* Não há nada para conferir na tela: no modal "Publicar ou agendar" só existe Instagram — não aparece opção de Facebook.

**Decidir se o perfil "membro" pode publicar no Instagram (decisão de política que ficou com ele)**  
A decisão continua com você e o código continua no estado antigo: qualquer pessoa com login de "membro" pode publicar no Instagram da 4Selet. Se você quiser restringir, é uma linha (adminOnly na rota de publicar) — mas não vou mexer sem sua palavra.
  
*Como conferir:* Em Configurações > Usuários, crie um usuário de perfil membro, entre com ele e abra uma peça aprovada: o botão Publicar aparece e funciona.

**Copy técnica demais para quem é leigo**  
A revisão de linguagem do painel inteiro. Palavras como "render", "renderizar", "prévia", "slug" e mensagens de erro cruas continuam aparecendo para quem usa. Isso é uma varredura tela a tela, não um conserto de um ponto só.
  
*Como conferir:* Abra uma peça de carrossel e clique no ↻ de um slide com o painel sem chave de IA: a mensagem que aparece fala em "render", palavra que ninguém de fora entende.

---

## 2. Entregue pela metade (59)

Estes funcionam, mas não cobrem tudo que você pediu. É onde mora a maior parte do trabalho que sobrou —
e onde eu provavelmente disse "feito" quando o certo seria "feito em parte".

### Criação de arte

**Artes com variedade e liberdade de composição: poder alterar, acrescentar novos elementos e usar outros layouts, em vez de sempre fundo simples + texto + logo**  
*Falta:* Os 8 desenhos novos (palavra gigante, número solo, princípio numerado, comparação A>B, citação, medidor, fluxograma ramificado, balões de conversa) NÃO aparecem em nenhuma lista de escolha da tela: só entram sozinhos quando o texto traz o dado certo, ou digitando o campo `layout` no JSON avançado. Na prática, quem não mexe em JSON continua vendo 4 estilos de arte e 6 layouts de slide.
  
*Como conferir:* Abra uma peça aprovada e olhe o bloco 'Estilo visual da arte': só aparecem Editorial, Destaque, Dividido e Foto — nenhum dos layouts novos está lá para escolher.

**Não deixar 'tudo muito preso' — poder criar arte sobre um acontecimento/evento do mundo, que os layouts fechados não cobrem**  
*Falta:* Continua não existindo 'criar arte do zero' dentro do painel: toda peça nasce de um tipo de conteúdo com layout fechado. A válvula de escape é indireta — gerar/importar uma imagem e desenhar por cima no editor. Um evento do mundo (algo fora da campanha) não tem tipo nem layout próprio.
  
*Como conferir:* Em Criar Conteúdo, veja que toda peça exige escolher um tipo pronto — não há 'começar uma arte em branco'; a única forma de arte livre é abrir o editor de uma peça já existente e usar '+ Texto' / '+ Inserir imagem'.

**Marca deve AVISAR, nunca bloquear: se a arte fugir muito do padrão 4Selet, informar; modal com UM botão OK; ao fechar, uma flag num canto perguntando se quer prosseguir**  
*Falta:* Três coisas: (1) não há detector do resultado — uma arte que ficou toda vermelha no editor visual sai sem aviso nenhum, porque o aviso só olha o texto do campo 'Referência visual' ANTES de gerar; (2) o modal não é de um botão OK só — tem 'Fechar' mais os botões de escolha (app.js:5786-5794); (3) não existe a flag num canto perguntando se quer prosseguir: o aviso aparece uma vez por referência e some (Set PALETA_AVISADA, app.js:5778).
  
*Como conferir:* Em Criar Conteúdo escreva 'tons de fim de tarde' na Referência visual e gere: aparece a janela sobre a cor; depois abra o editor de qualquer peça, pinte o fundo de vermelho e salve — nenhum aviso aparece.

**Recriar as peças do Instagram como teste, para comparar com o real**  
*Falta:* O teste foi feito e o documento com os prompts está no repositório (logo, em produção). O que ficou de fora: as 5 peças recriadas moram só na máquina local — a pasta outputs/ é ignorada pelo git, então elas não existem no painel de mkt.4st.co e o Hugo não consegue abri-las lá para comparar lado a lado com o perfil real.
  
*Como conferir:* O documento com os cinco prompts está no repositório (PROMPTS_RECRIACAO_INSTAGRAM.md), mas se ele procurar as peças rec_* na lista do painel em mkt.4st.co não vai achar nenhuma.

**Mais famílias/arquétipos de arte a partir do estudo (5 novos arquétipos de slide: numero, palavra, serie, citacao, comparacao)**  
*Falta:* O motor desenha os cinco e a IA os escolhe sozinha, mas o Hugo NÃO consegue escolhê-los na mão: o seletor de layout do slide (interface/public/js/app.js:5641, SLIDE_LAYOUTS) ainda lista só 6 opções antigas (Automático, Capa, Texto, Número em destaque, Lista, Chamada final) e o seletor de estilo da peça única (app.js:2126, VISUAL_TEMPLATES) só tem os 4 clássicos (Editorial, Destaque, Dividido, Foto). Para forçar um deles hoje só editando o JSON avançado.
  
*Como conferir:* Gere um carrossel e repare que aparecem slides novos (algarismo gigante, palavra gigante, citação com aspas, 'A > B') — mas abra o seletor 'Layout' de um slide na edição e veja que essas opções não estão lá para escolher.

**Escolher o destino da publicação (feed / story / reels / outro), com modo automático ou manual**  
*Falta:* Falta a escolha em si. Hoje o destino é sempre deduzido do tipo da peça (config.js:431 destinoPadrao: story→Story, vídeo→Reels, resto→Feed). Não existe em lugar nenhum da tela um seletor para o Hugo dizer 'esta arte de feed eu vou postar como story' — ou seja, o 'modo manual' que ele pediu está no modelo de dados, mas não tem porta de entrada.
  
*Como conferir:* Abra 'Publicar ou agendar' numa peça aprovada: tem legenda, data e os botões, mas não existe nenhum campo para escolher se vai para Feed, Story ou Reels.

**Tela de publicações organizada por destino (ele aprovou a prévia)**  
*Falta:* Ficaram de fora as três partes que a memória já dava como pendentes, e a verificação confirma: (1) agenda por faixa de horário — não existe, o agendamento é só um campo data/hora solto (app.js:3953); (2) fluxo 'Preparar para postar' para os destinos manuais (Story/Reels) — não existe nenhuma tela ou botão com esse propósito; (3) lembrete no dia — não existe. Além disso, 'organizada por destino' hoje é só uma COLUNA na tabela, não um agrupamento/filtro por Feed/Story/Reels.
  
*Como conferir:* Abra o menu Publicações: as abas são Publicados e Agendados (não Feed/Story/Reels), e não há nenhum botão 'Preparar para postar' nem aviso no dia da postagem.

**Colar a chave da Pexels em Configurações (destrava foto de situação e vitrine de capas)**  
*Falta:* A memória dizia 'vazia nos dois ambientes' — no painel LOCAL isso é falso, a chave está lá. O que continua em aberto é produção (mkt.4st.co): como o arquivo é ignorado pelo git, colar a chave aqui não colou lá. Precisa abrir Configurações no site e conferir/colar.
  
*Como conferir:* Em mkt.4st.co, Configurações > cartão 'Pexels': se o selo disser 'conectada' e o campo mostrar 'Cole uma nova chave para trocar…', a chave está salva (app.js:6770-6773); se disser 'opcional' e 'Cole a chave aqui', não está.

**Cobrir as famílias visuais que faltam do estudo (balões de conversa, medidor, fluxograma com nós, regras em papel, foto de situação, vitrine de capas de livro, personagem em sequência)**  
*Falta:* Faltam 3: vitrine de capas de livro (F09), personagem ilustrado em sequência (F13) e foto real de situação como família própria (F17). Hoje foto só entra como FUNDO do slide com véu de leitura (render.js:1828-1836) — não existe o arranjo 'cena real' nem a composição de capas.
  
*Como conferir:* Em Criar conteúdo > Carrossel, peça no tema 'balões de conversa', 'medidor de 96,4%', 'fluxo que se divide em dois caminhos' ou 'regras numa folha de papel' — sai desenhado; peça 'vitrine de capas de livro' ou 'personagem ilustrado em sequência' — sai como texto comum.

**Gerar no painel a mesma variedade e riqueza do Instagram — variedade em TEMA e em LAYOUT, valendo para TODOS os formatos (post único, stories 9:16, ads e vídeo), não só carrossel**  
*Falta:* Dois formatos ficaram de fora da variedade de LAYOUT: (1) o post de feed 4:5 continua limitado aos 4 templates de sempre — números, listas e etapas não viram grade/fluxo como no carrossel; (2) o vídeo tem um desenho único (BrandStory), só muda o texto. A variedade de TEMA (pilares) essa sim vale para todos.
  
*Como conferir:* Crie a mesma ideia como Carrossel, como Story e como Imagem/Anúncio: cada uma sai com desenho diferente conforme o dado. Repita como Feed Instagram e como Vídeo: a cara é sempre a mesma.

**Slides menos 'duros'/com cara de IA — estética editorial variada, pegadas suaves, slides claros intercalados e variedade ENTRE carrosséis sem ele ter que ajustar toda vez**  
*Falta:* Duas coisas ficaram no meio do caminho: (1) o slide claro é PEDIDO ao modelo no prompt, não garantido pelo painel — pode sair carrossel inteiro escuro e nada avisa; (2) a rotação automática só troca o estilo da CAPA entre 3 templates (editorial/destaque/dividido); os slides de dentro seguem sempre o dado. E não existe nenhum controle de variedade em Configurações (routes/settings.js só trata chaves e modelos).
  
*Como conferir:* Gere dois carrosséis seguidos sem mexer em nada: as capas saem com estilos diferentes e no meio costuma aparecer 1 slide de fundo claro. Se quiser forçar, ainda é peça a peça — em Configurações não há nenhuma opção de variedade.

**Slide de fecho deve ser CTA de conversão (Solicitar convite / Falar com o time / convite no link da bio), não engajamento tipo 'Salva este post'**  
*Falta:* Falta (a) proibir explicitamente o CTA de engajamento ('Salva este post', 'Comenta', 'Marca um amigo') no corpo/fecho — hoje só o hype é barrado, e o próprio texto de exemplo do modo simulado usa 'Salva esse post'; (b) virar padrão de marca em Configurações: o CTA continua sendo digitado/escolhido peça a peça, e o padrão do painel é sair SEM CTA nenhum (knowledge/brand_identity.md:384).
  
*Como conferir:* Em Criar Conteúdo, no campo Chamada (CTA), os atalhos sugeridos são todos de conversão — mas em Configurações não existe nenhum campo para fixar o fecho como padrão, e a chamada continua a ser escolhida em cada peça.

**Controle fino da posição do título na capa**  
*Falta:* Falta (a) um controle na tela — hoje só dá para mexer pedindo em texto no 'Ajustar com IA' ou arrastando no editor de arte; não há campo/seta de posição no editor de slides; (b) funcionar nas capas SEM foto: nos templates Editorial, Destaque e Dividido o campo é simplesmente ignorado.
  
*Como conferir:* Abra um carrossel com foto na capa e peça em 'Ajustar com IA' para subir o título — funciona; mas em nenhum campo da tela de edição do slide existe um controle de posição do título, e em capa sem foto o pedido não tem efeito.

**Poder acrescentar elementos (ex.: formas geométricas) na arte pelo editor visual e que eles sobrevivam ao reabrir**  
*Falta:* Falta a forma geométrica em si: não existe ferramenta de retângulo/círculo/linha no editor, e mesmo que uma forma fosse inserida por outro caminho ela não seria reconhecida ao reabrir (viraria cenário fixo). O que existe hoje e sobrevive: texto, imagem, logo, marca d'água e os três elementos prontos.
  
*Como conferir:* No editor de arte (botão Editar arte), olhe a barra de ferramentas: dá para acrescentar texto, logo, marca d'água, imagem e elemento pronto — não existe nenhum botão de forma, retângulo ou círculo.

### Criar conteúdo e briefing

**Fazer o briefing longo e estruturado funcionar (ele colou 8.140 caracteres de direção de arte e nada foi preenchido); sistema dinâmico, completo e robusto**  
*Falta:* O texto longo não é mais recusado nem cortado, mas a leitura só preenche quatro coisas: Formato, Assunto, Chamada e Tipografia. Cores em hex, mockup/aparelho, composição e o resto da direção de arte que você escreve no briefing continuam sem virar campo nenhum (itens 6, 7 e 8 abaixo).
  
*Como conferir:* Criar conteúdo → cole o briefing inteiro no campo de tema e clique fora: aparece a faixa dizendo o que ele leu (Formato, Assunto, Chamada e, se você pediu uma fonte pelo nome, a Tipografia), cada item com 'desfazer'.

**Mockup em notebook (o briefing pedia o print dentro de um notebook)**  
*Falta:* No carrossel o layout de aparelho não é escolhível à mão: ele só entra sozinho quando você anexa um print, ou quando a IA/o JSON avançado pede. Falta colocar 'Print em aparelho' (e escolher qual aparelho) no menu de layout do slide.
  
*Como conferir:* Para a peça '4Selet na Mídia': Criar conteúdo → escolha o modelo 'Notebook' na grade de aparelhos. Para carrossel: anexe um print a um slide e ele vira automaticamente print dentro de notebook — mas você não acha 'Print em aparelho' na lista de layouts do slide.

**Paleta de cores própria em hex no briefing (cores definidas por ele para a peça)**  
*Falta:* Cor definida por você em hex, para a peça, não existe. São 4 paletas prontas, e a escolha é da CAMPANHA (vale para todas as peças dela), não da peça. O briefing nunca troca cor — no máximo abre um aviso.
  
*Como conferir:* Escreva 'tons dourados' no campo de referência visual e gere: aparece a janela 'Sobre a cor que você pediu' te mandando escolher uma das 4 paletas em Campanhas — não há lugar para digitar um código de cor (#RRGGBB) da peça. Só dentro do editor de arte, clicando num texto ou caixa, você escolhe cor livre.

**Tipografia própria no briefing (Manrope / Montserrat)**  
*Falta:* Manrope não está na lista de fontes — se você pedir Manrope no briefing, nada acontece e a peça sai em Inter, sem avisar. A lista é fechada de propósito (o nome vai para dentro de URL e CSS), então acrescentar Manrope é uma linha em interface/lib/render.js:204-213 e outra em interface/public/js/app.js:2168.
  
*Como conferir:* Criar conteúdo → campo 'Tipografia': Montserrat está lá (junto com Playfair, DM Serif, Poppins, Oswald, Bebas e Space Grotesk), e ao escolher aparece o aviso de que sai da identidade. Escreva 'Montserrat' no briefing e ele preenche sozinho. Manrope não aparece em lugar nenhum.

**Print real da plataforma dentro de mockup no CARROSSEL**  
*Falta:* O menu 'Layout' do slide NÃO oferece 'Print em aparelho': a lista visível tem só Automático, Capa de destaque, Texto explicativo, Número em destaque, Lista de pontos e Chamada final (interface/public/js/app.js:5641-5648, const SLIDE_LAYOUTS). O aparelho só entra por três caminhos: quando o painel pergunta o que fazer com um print que faltou, quando a IA escreve layout:"device" no JSON, ou editando o JSON (avançado). Escolher 'quero este slide dentro de um notebook' pelo menu, na mão, não dá hoje. Também não há como trocar o modelo do aparelho (notebook/janela/celular/tablet) pela tela — só pelo JSON.
  
*Como conferir:* Criar Conteúdo > Carrossel, peça um print do dashboard no tema; quando abrir a janela 'de onde vem esta imagem', escolha 'Capturar de um site' e o slide sai com a captura dentro de um notebook — mas abra o menu Layout desse slide e veja que a opção 'Print em aparelho' não está lá.

**Cards / etiquetas flutuantes com posição livre no slide**  
*Falta:* A IA nunca gera um card flutuante: não há campo no JSON do carrossel nem arquétipo no render. Só existe na mão, peça por peça, abrindo o editor de arte depois de a arte estar pronta — e o que for movido lá não vira padrão nem se repete nas próximas peças.
  
*Como conferir:* Abra uma peça pronta, clique em 'Editar arte', use '+ Texto' e depois 'Fundo do item' para virar etiqueta, e arraste para onde quiser — mas na tela de Criar Conteúdo não existe nenhuma opção de etiqueta flutuante.

**Cor de fundo por slide e degradê custom**  
*Falta:* Faltam as duas metades do pedido: (1) escolher a cor de fundo de um slide na hora de criar (hoje só claro/escuro, e nem isso aparece na tela — 'theme' só pelo JSON avançado, interface/public/js/app.js:5328); (2) degradê custom não existe em lugar nenhum — o único controle é um seletor de cor sólida dentro do editor de arte.
  
*Como conferir:* Abra uma peça, 'Editar arte', botão 'Fundo': ele abre um seletor de cor chapada e não tem opção de degradê; e na tela de Criar Conteúdo não há campo de cor por slide.

**Controlar a posição do logo na peça**  
*Falta:* Não existe controle de posição do logo na criação nem em Configurações — nem 'canto inferior direito', nem tirar o logo da peça. Só arrastando na mão dentro do editor de arte, peça por peça (e essa mudança não fica valendo para as próximas).
  
*Como conferir:* Em Criar Conteúdo, o campo 'Logo' só deixa escolher claro/escuro/só o símbolo — não tem onde ele fica; para mover, é abrir 'Editar arte' e arrastar o logo à mão.

**Termos de busca de imagem por slide vindos do briefing (foto por slide)**  
*Falta:* O termo por slide só nasce quando a IA reclama que faltou imagem. Ela não propõe, por conta própria, uma busca de foto para cada slide do carrossel — e o único campo que existia para isso na peça de imagem única ('foto_busca') é preenchido pela IA e jogado fora, porque nenhum código o consome.
  
*Como conferir:* Gere um carrossel pedindo foto em vários slides: a janela de busca só aparece (com as palavras já preenchidas) nos slides em que a IA avisou que não conseguiu a imagem; nos demais, a foto de fundo é sempre você que vai buscar, slide a slide, no botão 'Foto de fundo'.

**Campo 'prompt principal' / auto-preenchimento: escrever a peça em linguagem livre e a IA pré-preencher os campos reais do formulário, com ele apenas revisando as informações**  
*Falta:* A leitura preenche apenas TRÊS campos — formato (content_type), assunto/pilar e chamada (CTA) — mais tipografia, que ainda pergunta antes de aplicar (interface/public/js/app.js:5078 e :5099-5105). Os outros campos do formulário continuam por conta dele: a oferta/número em destaque foi deixada de fora de propósito (comentário em interface/routes/generate.js:446-447), e estilo da arte, logo, marca d'água e foto não são tocados. Sem chave de IA configurada não interpreta nada (interface/routes/generate.js:482-484).
  
*Como conferir:* Em Criar Conteúdo, escreva a peça em texto corrido no campo 'Tema / objetivo da peça' e clique em Gerar: aparece a faixa dizendo o que foi entendido (formato, assunto, chamada) com opção de desfazer item por item — mas os campos de oferta/número, estilo da arte e logo continuam como você deixou.

**Regra de sobrescrita: campo vazio a IA preenche direto; campo já preenchido a mão NÃO é sobreposto, vira sugestão inline discreta com aceitar/recusar campo a campo; SEM 'aceitar todas'**  
*Falta:* O Formato (cards de tipo de peça) é a exceção: mesmo que você tenha clicado num card à mão, a leitura troca o card sozinha (app.js:5090) — só que ela para a geração uma vez e mostra 'desfazer' (app.js:5109-5112). Ou seja: para o Formato é 'troca e avisa', não 'sugere e espera'. Para os outros três campos a regra que você pediu está exatamente como descrita.
  
*Como conferir:* Criar conteúdo: escolha um Assunto e escreva uma Chamada à mão, depois descreva outra coisa no Tema e clique em Gerar — nesses campos aparece um aviso 'Pelo seu texto seria X' com o botão 'usar' (não troca sozinho); já no Formato o card muda sozinho e a geração para uma vez pedindo confirmação.

**Print dentro de aparelho (notebook/janela/celular/tablet) como layout de slide, não só na peça de Mídia**  
*Falta:* O layout existe e funciona, mas NÃO está na lista de layouts que dá para escolher à mão: interface/public/js/app.js:5641-5648 (SLIDE_LAYOUTS) só tem Automático, Capa de destaque, Texto explicativo, Número em destaque, Lista de pontos e Chamada final — não há opção "Print em aparelho", e layoutThumb (app.js:5697-5712) também não tem miniatura para ela. Hoje o print-em-aparelho só entra sozinho, quando você captura/envia um print naquele slide; e não dá para trocar o aparelho (notebook/janela/celular/tablet) pela tela — o padrão é notebook.
  
*Como conferir:* Em Criar Conteúdo, num carrossel, quando o painel perguntar a imagem do slide e você escolher "Capturar do site", aquele slide já sai com o print dentro de um notebook. Mas abra o menu "Layout" desse slide: a opção "Print em aparelho" não está lá para escolher à mão.

**A funcionalidade de mockup deve usar o Canva como inspiração: partir de um modelo já pronto e você mesmo montar o mockup que quiser**  
*Falta:* Faltam as duas metades que fazem o "escolher um modelo pronto e montar em cima": (1) TROCAR o aparelho de uma peça já criada não existe — content.setMediaMeta só é chamado no caminho de criação (interface/routes/generate.js:634), não há rota nem botão para mudar o modelo depois; o cartão da peça só EXIBE qual aparelho está em uso (app.js:2262). (2) Não dá para inserir um mockup de aparelho numa arte qualquer pelo editor: o menu "+ Elemento pronto" (app.js:2451-2455) só oferece CTA, Rodapé e Selo — não há "+ Aparelho/Mockup". Na prática o mockup continua preso ao tipo "4Selet na Mídia" e ao modelo escolhido no momento da criação.
  
*Como conferir:* Abra uma peça de "4Selet na Mídia" já criada: o cartão "Mockup da matéria" mostra o aparelho e o botão "Montar no editor" (lá dá para mover/redimensionar o mockup inteiro e trocar o print), mas não existe nenhum lugar para trocar o aparelho por outro, nem para inserir um aparelho numa arte que não seja de Mídia.

**Correção do entendimento: não é criar um novo modelo de dispositivo, é pegar um modelo pronto e a partir dele fazer o mockup que ele quiser**  
*Falta:* O mesmo do item anterior: trocar o modelo de aparelho de uma peça pronta e inserir um mockup em qualquer arte pelo editor. Enquanto isso não existe, o que foi entregue como resposta ao pedido foi um guia para montar no Canva por fora do painel — não a capacidade dentro do painel.
  
*Como conferir:* No painel, tente pegar uma peça pronta e trocar o mockup dela por outro modelo: não há esse caminho em lugar nenhum — só o guia GUIA_REPLICAR_MIDIA_CANVA.md, que manda refazer a peça à mão no Canva.

**Descoberta do mockup: a peça de Mídia não oferecia nada na tela**  
*Falta:* O botão "Mockup" na barra do editor, com painel lateral para escolher/ajustar o aparelho dentro do editor, não entrou. Efeito prático: o cartão informa qual é o aparelho e leva ao editor, mas não existe lugar nenhum (nem na peça, nem no editor) para TROCAR o aparelho — mesma lacuna do item 1.
  
*Como conferir:* Abra uma peça de "4Selet na Mídia": o cartão "Mockup da matéria" com a miniatura e o botão "Montar no editor" já aparece; mas ao entrar no editor, a barra de ferramentas vai de "+ Texto" até "Remover" sem nenhum item chamado "Mockup".

### Painel e editor

**Paridade de campos no atalho "Nova campanha" (dentro do Criar Conteúdo) com o formulário completo de Campanhas**  
*Falta:* O atalho ganhou 10 dos 11 campos do formulário completo. Falta exatamente UM: "Cor da campanha" (a paleta da campanha, app.js:1122 / payload em 1146). Como a cor vale para TODAS as peças da campanha, quem cria pelo atalho sai sempre na identidade padrão e só descobre a opção indo em Campanhas → Editar. Também falta o aviso "cor fora da identidade" (ligaConfirmacaoDeCor, app.js:1130), que existe só no formulário completo.
  
*Como conferir:* Abra Criar conteúdo, clique em "＋ Nova campanha" ao lado do campo Campanha e compare com Campanhas → "＋ Nova campanha": tudo bate, menos o campo "Cor da campanha", que só existe na tela de Campanhas.

**Título da peça precisa refletir a PROPOSTA da arte, não o recorte da primeira frase do briefing**  
*Falta:* O título continua sendo um RECORTE DE TEXTO do briefing, feito no navegador por regex, e não uma leitura do que a peça propõe. A IA nunca é consultada para o título: a rota /interpret (generate.js:470) extrai apenas formato, pilar e chamada. Quando o briefing abre direto pela direção de arte ("Carrossel 4:5, identidade 4SELET (fundo azul..."), o título sai igualzinho à reclamação original.
  
*Como conferir:* Em Criar conteúdo, cole um briefing de direção de arte que comece pela especificação ("Carrossel 4:5, identidade 4SELET (fundo azul navy)…") no campo Tema/objetivo e olhe o que aparece sozinho no campo Título.

**Mais variedade geral nas artes, mantendo a identidade da marca**  
*Falta:* Duas coisas. (1) A rotação do "Automático (varia por peça)" continua sobre apenas TRÊS estilos — TEMPLATES_ROTACAO = ["editorial","bold","split"] (render.js:1640); "photo" só entra quando a peça tem foto, e os 10 arquétipos novos NÃO entram na rotação. (2) Os arquétipos novos só aparecem quando o CONTEÚDO traz o dado certo (números, lista, etapas, citação, comparação — render.js:2732-2749); uma peça de texto puro continua caindo nos 3 templates de sempre. Ou seja: a variedade cresceu muito, mas continua dependendo do que a IA escreve, não de uma decisão de variar.
  
*Como conferir:* Em Criar conteúdo, deixe "Estilo visual" em "Automático" e gere várias peças: as que têm números, lista ou etapas saem em grade/fluxo/lista (novos desenhos); as de texto puro continuam alternando só entre Editorial, Destaque e Dividido.

**Versão fotográfica "mão segurando tablet" da peça de Mídia (mockup fotorrealista)**  
*Falta:* O mockup existe e roda, mas hoje ele NÃO está disponível para escolher na tela — foi escondido depois que você reprovou as três cenas foto-reais. Peça antiga que já usa continua renderizando; peça nova não tem como pegar. Além disso, as fotos-base (base_maos_tablet.jpg etc.) não são versionadas no git, então não consigo confirmar que existem no servidor de produção.
  
*Como conferir:* Em Criar conteúdo, escolha o tipo "4Selet na Mídia" e olhe o seletor de mockup: só aparecem as famílias "Aparelho" e "Editorial" — a família "Foto real" não está lá.

**Variante RETRATO do mockup de mão + tablet (para bater com a referência que ele mandou)**  
*Falta:* A variante retrato existe no motor de arte, mas está inalcançável pela tela pelo mesmo motivo do item anterior: os três modelos "Foto real" foram tirados do seletor depois que você reprovou. Não consegui verificar se a foto-base retrato existe no servidor de produção (interface/public/uploads/ está no .gitignore:18).
  
*Como conferir:* Mesma tela do item anterior: Criar conteúdo → "4Selet na Mídia" → seletor de mockup; a opção "Foto real (mãos)" não aparece para escolher.

**Nota de orientação/navegação do painel (índice de onde consultar cada coisa) para a próxima sessão não se perder**  
*Falta:* A nota existe mas está DESATUALIZADA e nunca foi revisada: ela cita PM2 (`pm2 restart painel-4selet`) quando produção hoje é Docker, e lista a rota `routes/meta.js` que não existe mais (as rotas atuais são auth, campaigns, capture, collections, content, generate, pexels, publish, settings, squad, squad_webhook, uploads, users). Além disso é um arquivo interno meu, fora do repositório — não é nada que o Hugo veja ou possa consultar.
  
*Como conferir:* Não dá para conferir na tela do painel: é um arquivo de anotação minha, fora do site; o índice equivalente que ele pode abrir é o bloco "Documentação de referência" no topo do CLAUDE.md do projeto.

**Corrigir markdown do Assistente, mostrar NOME da campanha em vez do slug, e acentuar as strings do back-end (P1 aprovado por ele)**  
*Falta:* Acentuar as 29 mensagens de erro que ainda saem sem acento do back-end — concentradas em routes/content.js, collections.js, generate.js e uploads.js. Elas aparecem no avisinho vermelho do painel quando algo dá errado, escritas como "peca nao encontrada".
  
*Como conferir:* O markdown e o nome da campanha ele vê no Assistente e nos cards das peças (nome legível, não o slug); o que falta ele só vê quando dá erro — o avisinho vermelho ainda escreve "peca nao encontrada", sem acento.

**Revisar TODOS os fluxos do painel no navegador, avaliar UX e revisar termos/copy — entregando diagnóstico priorizado ANTES de mudar código**  
*Falta:* O diagnóstico priorizado nunca virou documento — ficou só na conversa, então não há como ele reler a lista de achados nem saber o que da revisão ficou de fora. Concretamente: os P1 saíram, mas os P2/P3 (se existiram) não estão registrados em lugar nenhum que ele possa consultar.
  
*Como conferir:* As melhorias ele vê usando o painel (nomes de arquivo amigáveis, plural certo em "peça(s)", ajustes do brief recolhidos); já o relatório da revisão não existe em lugar nenhum para abrir.

**Não usar auto-publish nem Supabase por enquanto (decisão dele)**  
*Falta:* A parte do Supabase continua respeitada (nenhum código depende dele). A parte de 'sem auto-publish' não vale mais: depois disso foi construída a publicação no Instagram com agendamento, e existe um relógio que posta sozinho no horário marcado (só peças aprovadas e só as que alguém agendou explicitamente). Se você quiser voltar atrás, o ponto a desligar é o agendador em server.js:204.
  
*Como conferir:* Em Configurações, o cartão Supabase aparece como 'não configurado' e nada no painel pede ele; já em Publicações, uma peça aprovada pode ser agendada e o painel posta sozinho na hora marcada.

**Decidir se aprova os lotes P2/P3 e se commita**  
*Falta:* Não existe em lugar nenhum do repositório o que era o lote P3 — só a menção de que ele existiu. Sem essa lista não dá para dizer se foi feito, então P3 fica em aberto até você (ou eu, relendo a conversa da época) reconstruir a lista.
  
*Como conferir:* Na Biblioteca e no Criar Conteúdo você vê os acabamentos do P2 (contagem 'peça/peças' certa, nomes de arquivo amigáveis, bloco 'Ajustes — opcional' fechado, rejeitadas escondidas); do P3 não há nada a conferir.

**Link de convite com login e senha PRÉ-PREENCHIDOS na URL**  
*Falta:* Do jeito que você pediu — login e senha escritos na URL — não foi feito e eu recusei: a URL fica no histórico do navegador, em log de servidor e em qualquer app por onde o link passar, então a senha vazaria. No lugar, a pessoa recebe um link que já entra sozinha e define a própria senha (na prática ela digita ainda menos do que você pediu).
  
*Como conferir:* Em Usuários, clique em 'Gerar link de convite' de uma pessoa: aparece um link para copiar; ao abri-lo, ela entra direto e cai na tela de definir a senha, sem digitar login.

### Publicação e integrações

**Integrar o painel à Business Manager da Meta para publicar no Instagram (aprovado no painel → ele libera → depois agendamento), cobrindo feed, carrossel e Stories/Reels**  
*Falta:* Faltam duas coisas do que ele descreveu. (1) O "sobe pra BM como rascunho" NÃO existe: o painel publica direto no Instagram no momento em que ele confirma — o próprio painel faz o papel de rascunho/liberação (a peça só sai depois de aprovada + confirmação humana). Não há nenhuma chamada que crie rascunho na Business Manager. (2) Stories e Reels não são publicados pela API: no código eles são marcados como destino "manual", ou seja, a arte sai pronta e alguém posta no aplicativo. Feed (imagem única) e carrossel estão implementados de verdade. Também não dá para confirmar daqui se a conexão em produção está viva hoje — o token mora em interface/data/publish.json, que é ignorado pelo git (.gitignore:21) e não existe na cópia local.
  
*Como conferir:* Abra uma peça aprovada e clique em "Publicar ou agendar": aparece a prévia do Instagram e os botões Publicar agora / Agendar; em Configurações › Instagram o cartão diz se a conexão foi verificada (Conectado / Conexão expirada / Não verificado).

**Importar imagem pronta e poder editá-la como HTML, preservando a qualidade**  
*Falta:* Dá para abrir a arte importada no editor e trabalhar POR CIMA dela (acrescentar textos, formas, logo, reenquadrar, girar, opacidade), com a qualidade original preservada. O que não existe é editar o que já está DENTRO da imagem — a manchete que veio na arte importada continua sendo pixel, não texto. Isso é a "reconstrução com IA", que segue na fila. E não é automático: depois de importar é preciso clicar em "Preparar para editar" uma vez.
  
*Como conferir:* Importe uma arte, abra a peça e clique em "Preparar para editar"; depois clique na imagem para abrir o editor — você consegue colocar coisas em cima, mas ao clicar no texto que veio na imagem nada é selecionado, porque ele faz parte da foto.

**Fazer os DOIS modelos de peça de mídia: o foto-realista estilo Valor (mão+tablet+mesa) e o gráfico chapado estilo Estadão**  
*Falta:* Falta o modelo foto-realista voltar a ser oferecido. Hoje ele está escondido do seletor (por ter sido reprovado) e, mesmo se fosse reativado, as três fotos-base (base_maos_tablet.jpg, base_maos_mesa_escura.jpg, base_mesa_cafe.jpg) só existem nesta máquina — a pasta uploads está fora do git, então no servidor a cena sairia sem foto. Desbloqueio: a foto-base aprovada por você, subida pelo painel em produção.
  
*Como conferir:* Em Criar Conteúdo > 4Selet na Mídia, olhe o seletor de modelo: aparecem os grupos "Aparelho" (Tablet, Celular, Notebook, Navegador) e "Editorial" (Citação, Selo, Split, Camadas) — o grupo "Foto real" não aparece na lista.

**Replicar exatamente a imagem-referência do Estadão (artigo mais completo: barra de busca, ícones de compartilhar na vertical, manchete centralizada, moldura mais cheia)**  
*Falta:* O artigo do Estadão foi montado como um arquivo de teste na minha máquina e virou um print colado numa peça local; nada disso subiu. Em produção o painel continua dependendo de você subir o print da matéria. E a peça 'Mídia Estadão' que ficou parecida com a referência não está na biblioteca de produção — ela só existe no computador local.
  
*Como conferir:* Em mkt.4st.co, menu Conteúdo/Biblioteca, procure a peça 'Mídia Estadão': ela não aparece; o que mudou lá é só a moldura do layout Camadas (crie uma peça de Mídia com o modelo Camadas para ver o logo dentro do painel no topo e as 6 molduras nas laterais).

**Matéria não pode sair cortada em nenhum formato (4:5, 1:1, 9:16, 16:9)**  
*Falta:* Os dois pontos que eu mesmo tinha anotado como pendentes continuam pendentes no código: no modelo Citação a matéria entra como miniatura deitada e corta a parte de baixo (é onde some o rosto), e no modelo Celular a matéria cabe inteira mas sobra quase 40% de tela branca. Os modelos Navegador e Selo estão resolvidos.
  
*Como conferir:* Crie uma peça de Mídia com o mesmo print nos 4 formatos: nos modelos Navegador e Selo a matéria aparece inteira; troque para Citação (corta embaixo) e para Celular (fica muita tela branca sobrando).

**"Fica me deslogando" — parar de perder a sessão**  
*Falta:* O prazo subiu de 12 horas para 7 dias, mas continua sendo um prazo fixo: mesmo usando o painel todo dia, no 7º dia ele pede login de novo. Para 'nunca mais deslogar' na prática falta renovar a sessão a cada acesso (crachá que se renova sozinho enquanto você usa).
  
*Como conferir:* Entre no painel e volte no dia seguinte (e nos seguintes): você continua logado durante a semana; se aparecer a tela de login, vai ser só depois de 7 dias do último login.

**Compositor manual estilo Canva dentro do painel: partir de um modelo pronto e montar o mockup à mão (trocar aparelho/print de peça já criada)**  
*Falta:* Falta o mecanismo em si: partir de um modelo pronto dentro do painel e montar/trocar o mockup à mão, incluindo trocar o aparelho de uma peça já criada (hoje, para mudar de tablet para celular, é preciso criar a peça de novo). O que foi entregue é meio caminho: dá para mover, redimensionar e trocar a imagem do mockup no editor de arte.
  
*Como conferir:* Abra uma peça de Mídia já criada: você vê o nome do aparelho e o botão 'Montar no editor' (lá dá para arrastar/redimensionar o mockup e trocar a imagem), mas não existe lugar nenhum para escolher outro aparelho ou partir de um modelo pronto.

**Feed cortando palavra no meio e sem subtexto**  
*Falta:* As duas queixas literais (palavra partida e falta de subtexto) estão resolvidas, mas a arte de feed continua saindo com eyebrow, CTA e selo VAZIOS no código (render.js:2871, 2874 e 2875: `eyebrow: ""`, `cta: ""`, `badge: ""`). E o texto da arte ainda é extraído da legenda em prosa — a peça de feed não tem headline própria; isso exige mudar o contrato do tipo e ficou de fora de propósito (está escrito na mensagem do próprio commit 9eb476b).
  
*Como conferir:* Criar Conteúdo › tipo "Post de feed" › gerar e olhar a prévia: o título termina em palavra inteira e agora existe uma linha de apoio abaixo dele; a arte ainda não traz chapéu, botão de chamada nem selo.

**Multi-seleção com Shift e atalhos de Figma/Canva no editor**  
*Falta:* Faltam Alt+arraste (duplicar arrastando), Ctrl+[ e Ctrl+] (mandar para frente/trás), Ctrl+G (agrupar) e redimensionar vários itens de uma vez — com 2 ou mais selecionados a alça de tamanho some.
  
*Como conferir:* No Editar arte, segure Shift e clique em vários elementos: eles ficam marcados e arrastam juntos; Esc solta tudo e Ctrl+A pega tudo. Já Alt+arrastar para duplicar, Ctrl+[ / Ctrl+] para mudar a ordem das camadas e Ctrl+G para agrupar não respondem.

**Implementar as 3 recomendações da auditoria que ficaram em aberto e validar no navegador**  
*Falta:* As três correções estão no ar, mas a parte "validar no navegador" não foi feita como o Hugo pede: a própria mensagem do commit 7c16d03 diz "Validado no navegador (Playwright, APIs stubadas)" — ou seja, harness automatizado com APIs dubladas, exatamente o que ele reclamou (ver item 5). Não há evidência no repositório de teste manual ao vivo desse lote.
  
*Como conferir:* Numa peça, editar as tags: elas trocam sem a tela toda piscar; e em Criar Conteúdo, com estilo "Foto", cada foto do acervo tem um "×" que remove a foto.

**Auditoria geral do painel: navegação, fluidez, UX, copy e os guias**  
*Falta:* Consigo comprovar a fluidez e a atualização dos guias. As partes de "navegação, UX e copy" são difusas — o commit e9f826a mexeu em 118 linhas de interface/public/js/app.js, mas não dá para afirmar item a item o que da auditoria de UX/copy foi feito e o que ficou de fora sem a lista original de achados, que não está no repositório.
  
*Como conferir:* Aprovar ou reprovar uma peça e reparar que o painel continua respondendo (não congela enquanto processa); e abrir o GUIA_DE_USO para ver o conteúdo atualizado.

**"Teste o mockup nativo" e "me entregue 10 variações" da peça de Mídia**  
*Falta:* As 10 variações entregues como peças no painel não existem mais em lugar nenhum (nem em outputs/, nem no repositório). Restaram 6 protótipos numa pasta de teste local, que nunca foi para produção. O lado bom: 5 desses 6 protótipos viraram layouts de verdade no painel (item 7) — mas isso é resultado do trabalho, não a entrega das 10 variações para ele olhar.
  
*Como conferir:* Procurar em Conteúdo por peças com nome "midia_var" — não vai achar nenhuma; os modelos que sobraram ele vê ao criar uma peça de Mídia, no seletor "Modelo do dispositivo".

**"O material não ficou da hora" — trocar a foto-base do mockup mão+tablet**  
*Falta:* Hoje ele não consegue escolher esse mockup na tela: os três modelos "Foto real" estão escondidos do seletor. Só peças antigas que já usavam continuam renderizando. Além disso, as fotos-base ficam em interface/public/uploads/, que é ignorado pelo git (.gitignore:18) — não vão no deploy, dependem do volume de uploads do servidor.
  
*Como conferir:* Criar uma peça de "4Selet na Mídia": no seletor "Modelo do dispositivo" só aparecem os grupos Aparelho e Editorial — o grupo "Foto real" (mãos segurando o tablet) não está mais lá para escolher.

**Reconstruir a peça da matéria do Estadão mesmo sem o print ("não tenho o print, se vire")**  
*Falta:* A memória afirmava "7 layouts × 4 formatos gerados" e "peças do Estadão em prod em revisão". No código só existe 1 peça (layout camadas) × 4 formatos; os outros 6 layouts são PNGs de teste em interface/_mediatest, que é uma pasta ignorada pelo git. Nem o print reconstruído, nem os testes, nem a peça estão versionados — ou seja, nada disso foi para o repositório de deploy. Se existem peças do Estadão no painel de produção, elas foram criadas lá dentro e eu não consigo confirmar isso pelo código.
  
*Como conferir:* Em Aprovados, procure "Mídia Estadão — camadas": existe UMA peça, nos 4 formatos — as outras 6 variações de layout do Estadão nunca viraram peça, ficaram como teste na minha máquina.

**Token do squad que ele gerou sumiu de produção**  
*Falta:* A CAUSA do sumiço continua desconhecida — não há no código nenhuma correção que impeça o token de sumir de novo. O que existe é rastro: se sumir outra vez, a tela de Requisições vai mostrar quem mexeu e quando, e o backup diário passa a ter uma cópia. Se hoje a conexão está de pé em produção, só olhando o painel em produção para saber.
  
*Como conferir:* Menu Requisições: o cartão do topo diz se a conexão está ligada e as linhas "Mudança na conexão" mostram o histórico de quem cadastrou ou removeu o token.

**Aprovou o lote 2 recomendado (fila de trabalho, freio nas rotas de IA, backup dos volumes, correção de dependências vulneráveis)**  
*Falta:* Duas coisas ficaram só no papel do lado do servidor: (a) a FILA não roda em produção — não existe serviço redis nenhum em docker-compose.prod.yml e sem REDIS_URL o pipeline continua sequencial, exatamente como antes; (b) o backup existe como script, mas não há no repositório nenhum agendamento (cron/systemd) que o faça rodar sozinho todo dia — se ninguém instalou isso no servidor à mão, ele nunca rodou. Não consigo verificar o servidor daqui.
  
*Como conferir:* Peça uma geração com IA umas trinta vezes seguidas em cinco minutos: na trigésima primeira o painel avisa "Muitas gerações seguidas" em vez de continuar gastando; já o backup e a fila não têm tela — só dá para conferir no servidor.

**Microcopy do filtro de tamanho da busca de imagens (ele bateu 3 vezes no ponto)**  
*Falta:* Falta reconciliar os dois controles vizinhos: "Resolução mínima" (Qualquer/Alta/Máxima) e "Tamanho mínimo da foto" (px) tratam do mesmo assunto e ficam colados, sem uma linha dizendo para que serve cada um. E o texto do botão "Ver mais opções" ainda fala em "tamanho", desalinhado do rótulo novo.
  
*Como conferir:* Em Criar conteúdo, clique em Buscar imagem e depois em "Ver mais opções": os dois controles de tamanho aparecem lado a lado logo abaixo do campo de busca.

**Publicação que falha não avisa — a peça segue verde e não existe aba de "Falhados"**  
*Falta:* Duas partes do que você apontou seguem de pé: (1) a PEÇA em si não avisa nada — a busca por listSchedule em app.js aparece só uma vez, na linha 4152, dentro da tela Publicações; abrindo a peça você não vê que a publicação dela falhou; (2) não existe aviso ativo (contador no menu, alerta, e-mail) — você só descobre se entrar em Publicações > Agendados por conta própria. Aba separada de "Falhados" não foi criada, mas os falhados passaram a aparecer na aba Agendados com o motivo.
  
*Como conferir:* Menu Publicações, aba Agendados: agendamentos que deram errado agora aparecem com o selo vermelho "Falhou" e o motivo em letra pequena logo abaixo.

**Corrigir os agentes depois da auditoria (os 4 itens de CÓDIGO que sobraram)**  
*Falta:* Sobraram 2 correções de código: (a) o pipeline em lote não gera peça de "4Selet na Mídia" a não ser que o tipo seja pedido na mão (pipeline/agents.js:23-26); (b) o checklist do preview.html reprova CTA aprovado por causa da lista velha (scripts/generate_preview.js:254). Sobrou também um resto pequeno: src/Root.tsx:14 ainda tem a frase-tag no exemplo de pré-visualização do Remotion Studio (não afeta a peça gerada pelo painel).
  
*Como conferir:* Gerar uma peça de Vídeo e conferir que o card final mostra a chamada que ele escreveu (e não a frase "Para quem sabe que é Selet") — os outros dois itens não têm tela: são o robô em lote e o relatório de prévia gerado por linha de comando, que ele não usa no dia a dia.

---

## 3. Esperando você (6)

**Colar a chave da Pexels em PRODUÇÃO (mkt.4st.co → Configurações → Pexels) — depende do Hugo**  
Confirmar no próprio site: se aparecer "não configurada", colar a chave (grátis em pexels.com/api). Sem ela, a busca de imagens em produção responde "Configure a chave da Pexels em Configurações" (app.js:637).
  
*Como conferir:* Entre em mkt.4st.co → Configurações → cartão "Banco de imagens (Pexels)": ele diz se a chave está configurada, e o botão "Testar" responde "Funcionando (N fotos)".

**Testar/validar a interação do editor clicando de verdade (faltou por não haver senha de admin no localhost)**  
Falta o seu teste manual mesmo: abrir o editor no painel e mexer (mover, salvar, trocar de slide). Nenhum comando pode comprovar isso por você.
  
*Como conferir:* Entre em mkt.4st.co, abra uma peça, clique em 'Editar arte', mova um texto e clique em 'Salvar arte' — o botão precisa virar 'Salvo ✓' e a miniatura da peça mudar.

**Gerar o link de convite real do @flavio (usuário existe só em produção)**  
Confirmar em produção se o link de convite do @flavio chegou a ser gerado e entregue a ele. Atenção: gerar de novo INVALIDA o link anterior (interface/public/js/app.js:7688).
  
*Como conferir:* Entre em mkt.4st.co, abra Configurações > Usuários e veja se aparece o @flavio na lista com a marca de convite pendente; se não aparecer, clique em Convidar na linha dele.

**Criar um app NOVO na Meta só para este projeto (não reaproveitar os apps existentes da BM)**  
O painel não guarda o número do app em lugar nenhum do código — ele guarda só o token colado, e esse arquivo não sai do servidor. Para afirmar que o app novo existe e é o usado, é preciso olhar a tela de Configurações em produção (ou o painel de apps da Meta), coisa que esta auditoria, só-leitura e local, não alcança.
  
*Como conferir:* Em https://mkt.4st.co, Configurações › Instagram: se o cartão mostrar "Conectado" com @4selet, o token em uso é o do app que você colou; qual app é ele, só o painel de apps da Meta (developers.facebook.com/apps) responde.

**Fazer o 1º post de teste real no Instagram pelo painel**  
A evidência que existe no repositório aponta para uma marcação manual ("já publiquei por fora"), não para um post feito pelo painel. Mas o arquivo que responde isso de verdade mora só no servidor, então não afirmo nem que sim nem que não.
  
*Como conferir:* Menu Publicações › aba Publicados: se alguma linha tiver o botão "Ver no Instagram", aquele post saiu pelo painel; linhas com o aviso "registrada por você" foram só marcadas à mão.

**Peças de "4Selet na Mídia" paradas em revisão em produção esperando decisão dele**  
Preciso de acesso ao servidor (ou ele abrir a tela e me dizer o número) para confirmar quantas peças de Mídia continuam em revisão.
  
*Como conferir:* Entrar em mkt.4st.co > Biblioteca, aba "Em revisão", e olhar quantas peças do tipo "4Selet na Mídia" ainda estão lá esperando aprovar, publicar ou descartar.

---

## 4. Não se aplica mais (3)

**Publicar Stories direto pelo painel (Instagram)**  
Nada a fazer — foi recusado por inviabilidade da API da Meta, e o código reflete isso explicitamente: o Story existe como destino, só que marcado como 'manual' (a arte sai pronta e a postagem é feita no aplicativo).

**Usar um serviço externo de geração de arte/imagem**  
Nada — a recomendação de não integrar gerador de imagem foi aceita, e o código confirma que nenhum serviço desse tipo entrou.

**Quando pedir "teste no navegador", quer teste MANUAL ao vivo, não harness automatizado com APIs dubladas**  
Não há nada no código que garanta a regra. E pelo menos uma entrega posterior ao pedido (7c16d03) foi declarada validada com APIs dubladas.

---

## 5. O que está no ar (159)

Conferido no código, com prova em cada um. Aqui vai só a lista — se quiser a prova de algum item específico, é só pedir.

### Criação de arte (11)

- Reclamação: 'está tudo muito básico, apenas com um fundo azul e o texto na frente' — a peça de Imagem precisa ter mais desenho
- Poder sair da identidade da marca com aviso — escolher a família tipográfica da peça (inclusive pedindo pelo nome no prompt)
- Poder rodar campanha com cor fora da paleta (ex.: campanha de fim de ano 'vermelhona'), por campanha
- Analisar TODAS as publicações do Instagram da 4Selet e usar o resultado para melhorar o painel
- Criar o formato Stories no painel
- Tema claro disponível em qualquer layout e marca-texto de palavra funcionando também no corpo (o ==palavra== imprimia os sinais de igual em vez de realçar)
- Tratamento de capa do carrossel com foto (ele aprovou)
- Conteúdo não pode ser só Taxa Zero — cobrir educacional, curiosidades de plataformas, prova de plataforma, novidades e motivacional/estratégico (pilares)
- Carrossel melhor — fluxograma com ícones, pontinhos de paginação e realce manual de palavra
- Anexar imagem de referência ao 'Ajustar com IA' para o modelo enxergar o exemplo
- Tipografia do fecho em bold (700) e não extra-bold, com ênfase por COR azul e sem sublinhado

### Criar conteúdo e briefing (24)

- Validar de forma completa os campos do formulário Criar Conteúdo por tipo (CTA redundante, campos que não fazem sentido por tipo, campos faltando), com pesquisa de mercado e autorização para aplicar melhorias
- Tirar a duplicação do CTA (mesmo rótulo 'CTA' no briefing e no editor) sem remover o campo
- Campo de Referência/clima não podia sumir no tipo Vídeo (gating de arte errado)
- Poder editar as hashtags da peça
- Feed precisava de editor de campos (não só textarea cru)
- Tirar o 'Texto completo (avançado)' do feed — redundante e confuso
- Vídeo precisava mostrar as cenas (storyboard) em vez de nada útil
- Renderizar a arte automaticamente ao gerar (a peça ficava 'sem mídia para prever no celular')
- Prévia do carrossel tinha que mostrar TODOS os slides, não só o primeiro
- Tirar o 'destaque azul nos campos' — o chevron azul do select ladrilhado ('>>>>')
- Poder importar conteúdo externo (arte pronta + legenda) para dentro do fluxo do painel
- Corrigir o 'empurre' do botão Editar (o botão pulava ao ser clicado)
- O campo novo deve SUBSTITUIR o 'Tema/objetivo', não ser mais um campo ao lado
- Testar tudo em local antes de afirmar que funciona
- Analisar o melhor cenário do recurso sem se deixar levar pelas opções que ele mesmo listou, e seguir a recomendação
- O sistema tem que conseguir tirar print de site, pedindo o link quando não tiver a imagem
- Não deixar o usuário no escuro: quando faltar imagem, o sistema pergunta em vez de entregar a peça calada
- Parar de 'delirar' — a IA inventava caminho de arquivo de imagem (/uploads/print-dashboard.jpg) e a peça saía sem imagem
- Corrigir o clique duplo / botão que fica clicável sem dar sinal (janela cega) no Gerar
- Corrigir o 'slide 3 delirando' — a pesquisa de mercado injetava número errado (FAQ do próprio 4selet.com.br com 7,9% + R$ 2,00 contra o 0%/R$ 1,99 oficial)
- Corrigir a impressão de baixa qualidade da arte na visualização
- Manter os ícones na grade de modelos como estavam e, ao clicar em um, apresentar o respectivo layout
- Tirar os três modelos foto-reais da escolha de modelo de Mídia
- A foto de fundo da cena foto-real não deveria ser arrastável sozinha (deslocava a cena por baixo do print)

### Painel e editor (34)

- Função "4Selet na Mídia": tipo de peça nativo para postar aparições na imprensa, com modelos de aparelho (device) e tamanhos
- Poder regerar UM slide específico do carrossel, sem refazer a peça inteira
- Revisão do fluxo/ciclo de vida da peça: status "Publicado", fluxo enxuto (Salvar→Aprovar→Publicar), menu "Publicações" com abas [Publicados|Agendados] e histórico
- Busca de imagens em banco de fotos (Pexels) dentro do painel — no editor de arte e na criação de conteúdo
- Corrigir o bug "quando seleciono filtro ele se perde" na busca de imagens (trocar filtro durante a busca descartava a nova busca)
- Mostrar as dimensões em px de cada foto da busca, de forma discreta (só no hover)
- Corrigir o filtro de cor e o total de resultados da busca de imagens (amarelo/vermelho voltavam os mesmos IDs, total travado em 8000)
- Validar/economizar o consumo de cota da API de imagens (cache, debounce)
- Filtro de tamanho mínimo na busca de fotos, VAZIO por padrão (todos os tamanhos) e filtrando de verdade só se ele digitar
- Fazer o filtro de cor realmente respeitar a cor escolhida ("escolhi branco e veio foto vermelha")
- Toggle discreto no editor mostrando as dimensões da arte e do item selecionado
- Poder atribuir uma imagem específica a QUALQUER slide do carrossel (não só à capa)
- Melhorar a NITIDEZ das prévias das peças (modais publicar/celular)
- Tirar a tagline "Para quem sabe que é Selet" das peças
- Mais opções de logo por peça (auto/claro/escuro/só-símbolo) e de marca d'água (padrão/palavra/símbolo/contornada/canto/nenhuma)
- Ancorar o kind da peça de Mídia no content_type, para "Gerar arte final" não re-renderizar a Mídia como feed/imagem
- Lote de 7 ajustes UX do documento "Especificações de Ajuste v1.0" (pós-salvar, prévia social LinkedIn/Threads, tirar jargão Playwright, selo "Novo", chave mascarada com "Trocar chave", lightbox por tipo, variação de arte)
- Ponto 5 do documento de ajustes: Coleções/Pastas para agrupar peças
- Ponto 2 (server-side): prévia RENDERIZADA das peças visuais já na tela de criação, com endpoint de render sem salvar
- Tirar os emojis da interface do painel (usar ícones/glyphs) e humanizar a copy para leigos
- Editor de imagem profissional de verdade, estilo Canva (ele não gostou do 'Camadas mágicas' em formulário)
- Fundir a tela de 'Camadas' dentro do editor
- 'Editor completo' — os 4 lotes: correções de salvar/lightbox, zoom, grade/guias/zonas do Instagram, snap, duplicar/rotacionar/espelhar/camadas, filtros de imagem e efeitos de texto, blocos de marca
- Troca de senha OBRIGATÓRIA no primeiro acesso
- Tirar a dica de texto do topo do editor HTML
- Visualização estilo Figma do carrossel: posicionar cada slide livremente numa tela para montar uma imagem contínua
- Funções estilo Figma no quadro (v2): seleção múltipla/laço, pan e zoom por rolagem/Espaço, alinhar e distribuir, guias inteligentes, duplo-clique para abrir no editor
- O quadro do carrossel deve guardar a montagem e ter "Voltar ao quadro" ao sair para o editor
- Poder jogar a barra de edição para a esquerda, ganhando altura para ver a arte retrato maior
- Arrumar o visual da barra lateral do editor (ele achou "podre")
- Humanizar o badge do modelo de IA no cabeçalho "Resultado" (mostrava o id cru claude-sonnet-4-6)
- Marcador "Novo" confiável na biblioteca (sumia assim que ele abria a peça pela primeira vez)
- Reclamação: "na VPS é apresentada a seção Ajustes, porém em outros dispositivos não são apresentados os demais itens dentro dessa mesma seção"
- Auditar o "trabalho que ninguém pediu" / peso do painel — resultou na correção das miniaturas da Biblioteca (tela de Conteúdo baixava 21 MB)

### Publicação e integrações (90)

- Agendar a publicação com tempo de revisar/suspender antes de ir ao ar
- Corrigir o erro "Cannot parse access token" que aparecia ao publicar carrossel
- Botão de confirmar publicação não pode ser vermelho (vermelho remete a erro) — usar o azul da marca
- Ctrl+C / Ctrl+V no editor de arte (copiar e colar elementos, inclusive entre slides)
- Reestruturar o modal Publicar/Agendar (prévia à esquerda, legenda à direita, botões no rodapé) e deixar a legenda alta o suficiente
- Atalho "+ Nova campanha" dentro do Criar Conteúdo, sem precisar trocar de tela
- Peça importada mostrando os slides duplicados (5 viraram 10) e dizendo "Esta peça não tem imagem publicável"
- Configurações estava com cartões de conexão empilhados e tokens à mostra — virar lista que abre no clique
- Desembaralhar Configurações: listagem de integrações num canto e o token de outro, misturado
- A matéria não pode sair torta nas peças de mídia (queixa recorrente sobre a notícia inclinada)
- O carimbo/selo estava por cima do "4Selet na mídia" e ilegível — arrumar
- Miniatura da peça aparecendo como card branco na biblioteca
- Usar o fundo que ele mandou (navy com grid de pontos / Selet Dots) nas peças de mídia
- Campo "Manchete" na criação da peça de Mídia
- Peça gerada nascia "sem mídia para prever no celular" — renderizar a arte automaticamente ao gerar
- Tirar o "destaque azul nos campos" / a setinha do select ladrilhada
- Transformar URL de um site em print dentro do acervo (captura de site)
- Quando faltar imagem, o painel deve perguntar em vez de inventar/silenciar (pendência de imagem com saídas)
- Poder sair da identidade: tipografia por peça e cor por campanha, com aviso em vez de bloqueio
- Trava contra clique duplo em ações que já estão em voo
- Pesquisa de mercado gerando fatos errados (o FAQ do próprio site injetava taxa errada) — reescrever
- Conferir se nada que existia sumiu depois do lote grande (revisão de perda)
- A seção "Ajustes"/"Criação avançada" não aparecia na tela (relatou 2 vezes, mesmo com a correção no ar)
- Perguntou se o aviso de versão nova ia atrapalhar a fluidez do painel
- Briefing longo colado no campo de tema não preenchia nada — passar a ler o briefing inteiro
- O editor estava colando palavras / fragmentando o texto ao digitar
- "Automático (varia por peça)" não variava — todas as artes saíam iguais (editorial)
- O texto que ele escreve tem que vencer o pilar (o ângulo do pilar atropelava o briefing detalhado)
- Respeitar o número de slides pedido no briefing
- A foto anexada na capa do carrossel não aparecia
- Trazer o Notebook de volta no seletor de modelos de Mídia
- Tirar a frase-tag "Para quem sabe que é Selet" de toda postagem (arte e vídeo)
- Buscar imagens de banco (Pexels) dentro do painel, no editor de arte e no Criar Conteúdo
- Foto de fundo por slide do carrossel (não só na capa)
- Página completa "Ver mais" na busca de imagens, com filtros e paginação, voltando para onde estava
- Usar só o símbolo "4" da marca, com a mesma fonte e borda, sem o "SELET"
- O aviso de "layout sem dado" tem que ser acionável (botão Inserir números/itens)
- Prévia da arte estava pixelada/borrada — melhorar a nitidez (incluindo nos modais publicar e celular)
- Marcar uma peça como já publicada, sem repostar
- Regerar um slide específico ainda na tela de criação
- Seletor de layout do slide com miniatura, e layout sem dado não pode quebrar a arte
- Editor: poder pintar o "Fundo do item" (plaqueta atrás do símbolo/marca)
- Tirar a "Logo vetorial" que estava fora da identidade da marca
- Reduzir os passos do fluxo — ele contou que precisava "aprovar 4 vezes"
- Menu "Publicações" com abas Publicados/Agendados e histórico de tudo que foi publicado
- Escolher o tamanho/formato da peça de Mídia (Feed 4:5, Quadrado 1:1, Story 9:16, Site 16:9)
- Durante a publicação mostrar que está publicando (não só mudar o texto do botão)
- Tipo nativo "4Selet na Mídia" para postar aparições na imprensa (print da matéria num dispositivo, na identidade da marca)
- Mostrar o motivo real do erro de render/prévia em vez de "HTTP 400" cru
- No editor, conteúdo ficava em cima do outro e não dava para pegar o de baixo — painel de camadas
- Ctrl+Z funcionando no editor mesmo com campo da barra focado
- Funções de Figma no quadro do carrossel (seleção múltipla, laço, pan/zoom, alinhar/distribuir, guias) e duplo-clique abrindo o editor
- "Ver no quadro" do carrossel: tela livre para posicionar slides e montar imagem contínua
- Barra do editor encostada à esquerda para liberar altura e ver a arte retrato maior
- Marcador "Novo" confiável e nome do modelo legível no cabeçalho Resultado
- Foto e logo sumiam na arte final (o editor mostrava, o salvar/baixar não)
- Descartar peça dava erro e não funcionava
- No editor de arte a imagem não salvava e o TAB fragmentava o texto
- "Ao editar um conteúdo, a imagem não vem correta"
- Importar conteúdo já pronto (feed com 1 imagem ou carrossel com 2-10 + legenda) para dentro do fluxo
- Tirar o "empurre" do botão Editar da lightbox ("tire esse empurre")
- Corrigir os campos do Criar Conteúdo (clima sumindo no Vídeo, CTA duplicado, faltar hashtags, feed sem editor de campos, storyboard do vídeo) — R1 a R5
- Usuário (Flavio) não via a seção "Criação avançada" — deploy não chegava no navegador
- Botão "Inserir credenciais" em Configurações
- Tirar o "empurra a tecla pro lado" — setas do teclado empurrando o elemento no editor
- Editor "totalmente editável" — os ícones do fluxo ficavam travados e não dava para mover
- Botão "Fechar" da prévia no celular estava ilegível
- Prévia no celular: navegação mais suave, tirar o scroll, jogar os itens para a direita e validar tudo antes de subir
- Prévia no celular ainda cortava — quer ver o celular E o conteúdo em tamanho real
- Prévia no celular estava "muito quebrada/sem espaçamento" — usar como referência o simulador iOS do MacBook
- Ver a peça no celular antes de publicar
- Legenda do carrossel aparecia com erro/JSON na prévia e no modal de publicar
- Integrar a pesquisa de mercado (Tavily) em produção
- Acabar com o login duplo do painel (porteiro do Caddy + login do painel)
- Editor visual próprio que edita a arte real, com convite por link e senha obrigatória no primeiro acesso
- Melhorar o fluxo aprovar→publicar (nome do aprovador pré-preenchido, agendar em pé de igualdade, deixar claro que publicar não é 2ª aprovação)
- "Não consigo editar uma mídia" — peça de Mídia não abria no editor de arte
- Outros layouts e variedades de peça de Mídia — "todos"
- Revisar a UX do Criar Conteúdo (reordenar blocos e renomear campos)
- Termos confusos no editor de arte: "+ Imagem" e "+ Bloco" precisam de nomes claros
- "Pra que serve essa data?" — mover o campo Data para o bloco técnico, explicar para que serve, e esconder o bloco técnico do perfil membro
- Dois desalinhamentos: a linha Logo/Marca d'água quebrando em 2 linhas e os cards de "Modelo do dispositivo" com larguras diferentes
- Aviso quando a proporção do print não combina com o modelo de dispositivo escolhido
- Receber artes prontas do sistema squad direto no painel, caindo em Aprovados, com marca de origem, editáveis, com cartão de conexão em Configurações e página Requisições com logs e reprocessar — e no fim um prompt para mandar ao time deles
- O cartão da conexão do squad não explicava nada — "Trocar token" ao lado de "Gerar um aqui" era confuso
- Tratar reenvio de post regerado/cancelado pelo squad (não descartar como repetido nem apagar peça)
- Auditoria de segurança e robustez do painel, com correção do que fosse achado
- Higiene do código do mockup morto (pediu a limpeza, com verificação antes)
- Alça órfã do editor depois de desfazer ou duplicar+apagar
- Revisar os agentes/skills para ver se não perderam contexto depois de tantas alterações
