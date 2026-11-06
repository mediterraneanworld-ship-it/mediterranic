# Mediterranic — 2026-11-05-ak

## Alterações
- Os cartões individuais do arquivo na homepage (H12) deixaram de ser links. Fotografia e nome não navegam para a ficha da peça. Não há efeito visual de botão ou zoom ao passar o rato.
- Cada cartão continua a mostrar `images[0]`: a primeira fotografia/Make cover escolhida no editor da Tab 1. Não foi criada uma segunda regra de selecção de capas.
- O botão geral para a página Archive mantém-se. As fichas e links do arquivo fora desta mostra da homepage não foram alterados.
- Tab 5: um clique na linha de cabeçalho de qualquer H abre ou recolhe o editor. Funciona no espaço vazio, no número/nome e na seta. A pega continua reservada ao arrastar; as setas de movimento não fecham o editor.
- Todas as caixas continuam recolhidas por defeito e conservam Save changes.

Não houve alteração de esquema, conteúdo guardado, preços, stock, encomendas ou envios de e-mail. A produção não foi alterada directamente.

## Verificações
- 169 testes offline, incluindo ausência de links nos cartões e primeira fotografia.
- Browser local: Make cover actualiza a imagem da homepage; cartões não navegam; H0–H13 abrem/fecham pelo espaço vazio, número e seta.
- Ensaios de interface a 320/360/390/430 px e desktop.
- A galeria usada no ensaio foi restaurada; linhas de catálogo temporárias foram removidas.
- Typegen, TypeScript, build, build_and_start e healthcheck.

## Publicar
1. Download backup no admin de produção antes do push.
2. Substituir a src completa pela src do ZIP, sem merge.
3. Copiar também public/, scripts/, package.json, package-lock.json e vercel.json; manter .env e .git locais.
4. Executar npm install, Commit + Push no GitHub Desktop.
5. Confirmar https://mediterranic.vercel.app/api/version = 2026-11-05-ak.

ZIP completo, sem .env, .git, node_modules, .next, caches, logs, imagens de teste ou cópias da base de dados.
