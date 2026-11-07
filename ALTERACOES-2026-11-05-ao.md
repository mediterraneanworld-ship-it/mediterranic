# MEDITERRANIC — 2026-11-05-ao

## Pedido do dono
1. Tornar clicável a frase da homepage: “Visit the whole archive, where you can request similar specimens.”, enviando para /archive.
2. Remover a linha redundante acima do rodapé: “Also on / Our eBay store / Our Catawiki auctions”.

## Alterações
- src/app/page.tsx: a frase editável H12 continua abaixo dos cartões, agora dentro de Link para /archive.
- src/app/page.tsx: removido o bloco final Also on/eBay/Catawiki da secção H12.
- src/lib/site-content.ts: removidos do editor H12 os campos Marketplace row · prefix/eBay/Catawiki. Os valores guardados na base não são apagados nem reescritos.
- Cartões de peças no H12 continuam apenas fotografia + título, sem links nem navegação.
- /archive mantém ligações individuais e Request a similar specimen.
- CODE_VERSION/manifesto, testes e SOS atualizados para 2026-11-05-ao.

## Segurança de conteúdo
- Sem alterações à base de dados, preços, REFs, fotografias, encomendas, newsletter ou moderação.
- Sem deploy em produção nesta entrega.

## Validação
- node --test scripts/test-*.cjs
- npx next typegen
- npm exec tsc -- --noEmit --pretty false
- npm run build
- build_and_start e verificação local/publica da home.

## Ligações
- Produção: https://mediterranic.vercel.app
- Admin: https://mediterranic.vercel.app/admin
- Versão publicada: https://mediterranic.vercel.app/api/version
- SOS: https://mediterranic.vercel.app/sos
- Sandbox: https://3000-ikqr26odgrmzepdpmg3py.e2b.app
- Admin sandbox: https://3000-ikqr26odgrmzepdpmg3py.e2b.app/admin
- Versão sandbox: https://3000-ikqr26odgrmzepdpmg3py.e2b.app/api/version
- SOS sandbox: https://3000-ikqr26odgrmzepdpmg3py.e2b.app/sos
- ZIP: https://3000-ikqr26odgrmzepdpmg3py.e2b.app/downloads/mediterranic-2026-11-05-ao.zip
