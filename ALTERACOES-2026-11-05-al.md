# Mediterranic — 2026-11-05-al

## Homepage — From the archive
- Título: **Pieces that found their collectors last days.**
- Por baixo dos cartões: **Visit the whole archive, where you can request similar specimens.**
- Os cartões voltam a abrir a ficha individual da peça, mantendo a primeira fotografia escolhida no admin (Make cover).
- As fichas de arquivo mantêm o padrão anterior: sem preço de venda e com **Request a similar specimen**.
- O botão geral para o arquivo mantém-se.
- Título e linha inferior são editáveis em Tab 5 → H12. Um título antigo igual ao default anterior é actualizado apenas na apresentação; a base de dados não é reescrita pelo deploy. Outros textos personalizados são preservados.
- O espelhamento público local também lê a linha nova, sem a confundir com o texto principal de H12.

Não foram alterados stock, preços, fotografias, encomendas, subscritores ou decisões de moderação. Sem migrações de base de dados, compras ou envio de e-mails nos testes.

## Validação
- 170 testes offline: `node --test scripts/test-*.cjs`.
- Browser apenas local: `node scripts/check-home-archive-editor.cjs`.
- Confirmados: links individuais, Request a similar specimen, primeira fotografia, campo H12 e linha inferior a 320/360/390/430 px e desktop.
- Regressões H0–H13: abrir/recolher pelo espaço da linha, número e seta; controlos de movimento independentes.
- Fotografias e conteúdos temporariamente usados nos ensaios foram restaurados; peças de teste removidas.
- Typegen, TypeScript, build, build_and_start e healthcheck.

## Publicação
1. Fazer **Download backup** no admin de produção.
2. Copiar a src COMPLETA do ZIP, sem merge; manter .env e .git.
3. Copiar também public/, scripts/, package.json, package-lock.json e vercel.json do ZIP.
4. `npm install`, Commit + Push pelo GitHub Desktop.
5. Confirmar `/api/version` = `2026-11-05-al` e guardar `/sos`.

ZIP completo sem segredos, .env, .git, node_modules, .next, caches, logs, screenshots ou cópias da base de dados.
