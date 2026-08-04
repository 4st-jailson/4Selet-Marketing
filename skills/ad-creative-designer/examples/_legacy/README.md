# Legado — NAO copiar como modelo

Estes arquivos sao a versao ANTIGA do fixture do ad, guardada so como historico. Eles seguem um contrato que o sistema abandonou:

| Arquivo | Por que saiu de circulacao |
|---|---|
| `ads/layout.json` | O blueprint hoje e `ads/concept.json`, com schema PLANO (`eyebrow`, `headline`, `subtext`, `cta`, `badge`, `image`). O `elements[]`, `width`, `height`, `background` e `palette` nao sao lidos por ninguem. Este arquivo ainda traz a frase-tag como rodape, hoje PROIBIDA por regra dura |
| `ads/styles.css` | O CSS agora e sempre inline num `<style>`. O saneamento do painel (`sanitizeArtHtml`) remove `<link rel="stylesheet">` que nao seja de fonte do Google — a arte re-renderizaria sem estilo |
| `ads/instagram_ad.png` | O nome canonico e `ads/ad.png`. Com outro nome, o editor visual nao acha a origem HTML (`E_NO_SOURCE_HTML`) e o render nao emite os sidecars de edicao |

O fixture atual esta um nivel acima, em `examples/ads/` — `concept.json` + `ad.html` (CSS inline) + `ad.png` (render @2x) + sidecars.
