# Mediterranic — 2026-11-03-s

## Nesta entrega

- E-mail: «…featured specimens and the newest arrivals from the quarries and preparators.» em HTML e texto simples.
- SOS público, sem segredos e noindex: /sos. Copiar contexto completo ou descarregar /api/sos-context.
- Os ficheiros CONTEXTO-NOVO-CHAT.md (raiz e public) reproduzem as mesmas instruções. Para os actualizar a partir do código: node scripts/export-sos.cjs.
- Fichas: título «What Owners and Visitors say». O formulário acolhe proprietários e visitantes e informa que a publicação requer aprovação.
- Admin → tab 6 Reviews: pendentes, aprovados e rejeitados; aprovar, rejeitar ou voltar a pendente. Rejeitar oculta sem apagar. Só comentários aprovados entram nas listas, médias e contagens públicas.
- Comentários antigos já públicos mantêm-se visíveis; o deploy não os reescreve. Estado e data de moderação entram no backup e são preservados no restauro.
- MEDITERRANIC não quebra de linha no mobile. Testado em 320, 360, 375, 390, 430, 768, 1024 e 1440 px.
- Capa The Connoisseur: fotografia REAL da placa Fezouata, com recorte do fundo escuro e vitrine digital. Nenhum fóssil foi regenerado ou redesenhado. A fotografia original permanece intacta, com SHA-256 registado em public/images/connoisseur-glass-info.json.
- Imagem nova: public/images/connoisseur-glass.png. A antiga capa incluída no código mantém um alias compatível, sem alterar URLs de capas personalizadas guardadas no admin.
- Admin → tab 5 → Home · Collections → Cover · The Connoisseur: «Use glass display cover» permite escolher a composição explicitamente; gravar o conteúdo para publicar essa preferência.

## Publicar

1. Download backup no admin de produção antes do push.
2. Apagar a src local e copiar a src completa deste ZIP (não fazer merge).
3. Copiar também public/ — inclui a capa nova e a versão actualizada do contexto SOS.
4. Copiar os scripts/documentos actualizados e manter o vercel.json fornecido. Manter sempre .env e .git locais.
5. Commit + Push no GitHub Desktop. Confirmar https://mediterranic.vercel.app/api/version = 2026-11-03-s.
6. Depois do deploy, guardar https://mediterranic.vercel.app/sos nos favoritos.

O ZIP não contém dados do banco, segredos, .env, .git, node_modules, .next, logs, screenshots de testes ou ZIPs anteriores. A base Neon de produção não foi acedida directamente nem alterada pelo sandbox. Não foi enviado nenhum e-mail nos testes. O deploy aplica apenas as colunas aditivas de moderação em UPGRADE_SQL; comentários novos ficam pendentes.

## Links

Produção: https://mediterranic.vercel.app
Admin: https://mediterranic.vercel.app/admin
Versão: https://mediterranic.vercel.app/api/version
SOS produção (após deploy): https://mediterranic.vercel.app/sos
Sandbox: https://3000-ihn0c4htnvmwd4z1v6hgw.e2b.app
Admin sandbox: https://3000-ihn0c4htnvmwd4z1v6hgw.e2b.app/admin
SOS sandbox: https://3000-ihn0c4htnvmwd4z1v6hgw.e2b.app/sos
ZIP: https://3000-ihn0c4htnvmwd4z1v6hgw.e2b.app/downloads/mediterranic-2026-11-03-s.zip
Nova capa: https://3000-ihn0c4htnvmwd4z1v6hgw.e2b.app/images/connoisseur-glass.png
