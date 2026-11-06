# Mediterranic — 2026-11-05-aj

## Admin, Tab 1
- **Delete permanently** pede confirmação escrita (DELETE). Remove realmente o registo de products e das listas do admin, loja e arquivo. Não é mais um rascunho de arquivo.
- Recibos e decisões de moderação são guardados em `product_deletions` antes da remoção, numa só transacção. Encomendas, totais, tracking e CSV mantêm as linhas originais. Uploads partilhados ficam intactos.
- Pagamentos e invoices em curso impedem a eliminação até resolução. A acção não cancela anúncios no eBay/Catawiki.
- O cron e o espelhamento público não voltam a importar automaticamente identidades eliminadas. Se o dono apagar a última peça, o seed não repõe o catálogo.
- **Unavailable** e Archive ficam no fim; ordem estável dentro de cada grupo. Draft é visibilidade, não disponibilidade.
- **Publish**, **Unpublish** e **Save & publish** usam validação coerente. Descrição longa ou curta é aceite. Erros de preenchimento são mostrados junto à linha e no editor, em vez de uma mensagem genérica que desaparece no topo.
- Rascunhos novos podem ser completados e publicados na mesma operação. Preços aceitam cêntimos; rascunhos/Unavailable/Archive podem ficar sem preço. Preços e stock não são inventados.
- A nova estrutura é aditiva: o deploy apenas cria a tabela de histórico quando falta. Não elimina produtos automaticamente. Backup v4 inclui o histórico; o restauro de histórico não republica produtos.

## Ligação da capa
A fotografia The Connoisseur não mudou. Foi corrigido o redireccionamento de /covers/connoisseur-cyphaspis.jpg para conservar o domínio público da sandbox em vez do endereço interno do servidor.

## Idioma
Tradução cancelada por decisão do dono. Loja e admin mantêm-se em inglês.

## Verificações
- `node --test scripts/test-*.cjs` (testes offline).
- `node scripts/check-admin-products.cjs` (somente base e servidor locais; testes de Publish/Unpublish, eliminação e recibos).
- `node scripts/check-admin-products-browser.cjs` (somente sandbox; cliques reais e diálogo a 320/360/390/430/1440 px).
- `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, `npm run build`, `build_and_start` e `/api/health`.
- As peças/encomendas temporárias de teste são removidas após os ensaios. Não se fazem pagamentos, envios de e-mail ou escritas na produção.

## Publicação
1. Fazer **Download backup** no admin de produção.
2. Apagar a src local e copiar a src COMPLETA do ZIP — não fazer merge.
3. Copiar também public/, scripts/, package.json, package-lock.json e vercel.json do ZIP. Manter .env e .git.
4. `npm install`, validar, Commit + Push pelo GitHub Desktop.
5. Confirmar `/api/version` = `2026-11-05-aj` e guardar `/sos`.

O ZIP não leva .env, .git, node_modules, .next, caches, logs, screenshots nem cópias da base de dados. O sandbox não publica por si só em produção.
