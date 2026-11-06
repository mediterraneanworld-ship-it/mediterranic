# Mediterranic — 2026-11-05-am

## Correcção de âmbito
- **Homepage, H12 / From the archive:** cada peça mostra apenas a primeira fotografia escolhida no admin e o título por baixo. Fotografia e título NÃO são links e não navegam ao clicar. Não há zoom ou cursor de link nesses cartões.
- Mantido o título **Pieces that found their collectors last days.**
- Mantida a linha inferior **Visit the whole archive, where you can request similar specimens.**
- Os botões gerais para a página Archive mantêm-se.
- **Página /archive:** NÃO foi alterada. Cada peça continua a abrir a sua ficha individual, sem preço de venda e com **Request a similar specimen**.
- Título e linha inferior continuam editáveis em Tab 5 → H12.
- O espelhamento público local reconhece cartões da home sem links e continua compatível com páginas públicas antigas.

Sem alterações à base de dados, preços, stock, fotografias, encomendas, subscritores ou moderação. Sem deploy de produção a partir da sandbox.

## Validação
- 171 testes offline.
- Browser local: fotografia e título da home sem navegação; links e pedido de espécime semelhante preservados em /archive.
- Regressão da primeira fotografia/Make cover, textos H12 e abertura das caixas H pela linha.
- Typegen, TypeScript, build, build_and_start e healthcheck.
- Dados temporários usados nos ensaios são restaurados no fim.

## Publicar
1. Download backup no admin de produção antes do push.
2. Substituir a src completa pela src do ZIP, sem merge; manter .env e .git.
3. Copiar também public/, scripts/, package.json, package-lock.json e vercel.json.
4. npm install, Commit + Push pelo GitHub Desktop.
5. Confirmar /api/version = 2026-11-05-am.

ZIP completo sem .env, .git, node_modules, .next, caches, logs, screenshots ou cópias da base de dados.
