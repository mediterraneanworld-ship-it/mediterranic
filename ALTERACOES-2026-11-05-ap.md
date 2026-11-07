# MEDITERRANIC — 2026-11-05-ap

## Pedido do dono
1. Retirar da homepage a secção repetida “Verified storefronts / One standard across all marketplaces”.
2. Aumentar o zoom das imagens dos quatro cartões “Four ways into deep time” ao passar o cursor no desktop.

## Alterações
- H9 deixou de ser renderizada na homepage. A ordem de H0–H13 e todo o conteúdo, caixas, links, logos, cores e configurações de H9 guardados no admin permanecem intactos. O editor H9 indica que a secção está oculta.
- H5, H11, rodapé e demais ligações de eBay/Catawiki não foram removidos nem alterados.
- As quatro imagens de H6 aumentam para 120% no desktop (1024 px ou mais), ao passar o cursor ou focar por teclado, com transição suave e sem sair do enquadramento. A preferência por movimento reduzido é respeitada. Em telemóvel não há zoom de desktop.
- Mantida a alteração anterior: a frase “Visit the whole archive, where you can request similar specimens.” continua clicável para /archive, mas os cartões de peças H12 continuam sem links individuais. /archive mantém as suas fichas individuais.
- Nenhuma imagem foi regenerada ou substituída. Nenhuma alteração ao esquema, inventário, preços, encomendas, newsletter, reviews ou dados privados.
- CODE_VERSION, manifesto, SOS e links do sandbox atualizados. A produção confirmada no início desta entrega era 2026-11-05-am; esta versão ap não foi publicada.

## Validação
- 176 testes offline passaram, incluindo a preservação das preferências H9 e os requisitos de zoom.
- Chromium local: as quatro imagens fizeram zoom de 1,20× no desktop; o foco por teclado funciona; apenas a imagem selecionada aumenta.
- Telemóvel: 320, 360, 390 e 430 px, quatro cartões sem zoom de desktop nem overflow horizontal.
- Admin: H9 mostra “Hidden from homepage · settings preserved”; o editor continua acessível. Sem gravação de preferências.
- Link da frase de arquivo, canais e ausência dos cartões de peça clicáveis confirmados. Sem chamadas de compra, envio de e-mail, ações em produção ou pedidos administrativos de alteração.
- Espelhamento público executado apenas na base local: 9 peças, 18 páginas, 48 referências fotográficas e 4 coleções verificadas, sem falhas. Não é backup privado.
- A entrega é validada por npx next typegen, npm exec tsc -- --noEmit --pretty false, npm run build e build_and_start antes de ser entregue.

## Publicação
Antes de um push grande faça Download backup no admin de produção. Substitua a src local pela src inteira do ZIP, sem fazer merge; preserve .env e .git. Copie também scripts, package.json, package-lock.json e public quando necessário; execute npm install. Commit + Push no GitHub Desktop publica pela Vercel. O ZIP não contém segredos, caches, .git, node_modules ou bases de dados. O conteúdo do Neon não deve ser substituído pelo espelho local.

## Links
- Produção: https://mediterranic.vercel.app
- Admin produção: https://mediterranic.vercel.app/admin
- Versão publicada: https://mediterranic.vercel.app/api/version
- SOS produção: https://mediterranic.vercel.app/sos
- Sandbox: https://3000-ill48ctkqw0vytkxh31a6.e2b.app
- Admin sandbox: https://3000-ill48ctkqw0vytkxh31a6.e2b.app/admin
- Versão sandbox: https://3000-ill48ctkqw0vytkxh31a6.e2b.app/api/version
- SOS sandbox: https://3000-ill48ctkqw0vytkxh31a6.e2b.app/sos
- ZIP completo: https://3000-ill48ctkqw0vytkxh31a6.e2b.app/downloads/mediterranic-2026-11-05-ap.zip
Os links de sandbox e ZIP são temporários.
