// Mover pasta ENTRE ZONAS, com os dois azares que já morderam este projeto.
//
// 1) EXDEV. Em produção `outputs/` é um volume nomeado e `outputs/approved` é um bind-mount do
//    host: dispositivos DIFERENTES. `fs.renameSync` entre eles falha com EXDEV — sempre, não de
//    vez em quando. Foi assim que o `--auto-revert` do check_approved_integrity nunca reverteu
//    nada em produção: o erro virava um WARN e o script terminava anunciando sucesso.
// 2) EBUSY/EPERM. No Windows, um antivírus ou o Explorer segurando a pasta derruba o rename.
//
// O caminho do EXDEV copia para um destino PROVISÓRIO (.part) e só então renomeia para o nome
// final: sem isso, uma queda no meio da cópia deixava a peça pela metade já no nome definitivo —
// a zona de destino listando uma peça incompleta, ou a mesma peça aparecendo nas duas zonas.
//
// Vive em scripts/lib porque os TRÊS lugares que movem peça precisam da mesma regra:
// interface/lib/content.js, scripts/promote_task.js e scripts/check_approved_integrity.js.
// Enquanto cada um tinha a sua, dois deles ficaram com o `renameSync` puro.
"use strict";
const fs = require("fs");

function moveDirRobust(src, dst) {
  const tryRename = () => { fs.renameSync(src, dst); };
  try { tryRename(); return; } catch (e) {
    if (e.code === "EBUSY" || e.code === "EPERM") {
      const wait = Date.now() + 200; while (Date.now() < wait) { /* busy-wait curto */ }
      tryRename(); return;
    }
    if (e.code === "EXDEV") {
      const part = dst + ".part";
      fs.rmSync(part, { recursive: true, force: true }); // sobra de tentativa anterior
      fs.cpSync(src, part, { recursive: true });
      fs.renameSync(part, dst);
      fs.rmSync(src, { recursive: true, force: true });
      return;
    }
    throw e;
  }
}

module.exports = { moveDirRobust };
