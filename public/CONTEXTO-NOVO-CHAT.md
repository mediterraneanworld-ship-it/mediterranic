# MEDITERRANIC — SOS para continuar num novo chat

Copia este documento para o início do novo chat. Pede ao assistente para o ler antes de alterar código.
Se o chat anterior bloquear, o trabalho publicado e os dados no Neon continuam a existir.
Versão DESTE CÓDIGO: 2026-11-05-ad. A versão realmente publicada deve ser confirmada em https://mediterranic.vercel.app/api/version.

## 1. Dono, idioma e respostas
Sou o dono da loja Mediterranic. Responde sempre em português; a loja e o admin são em inglês. Respostas curtas.
Em TODAS as respostas inclui os links de produção, sandbox, versão, admin, ZIP completo e esta página SOS. Não omitir o SOS nas respostas seguintes.
Usa a tua recomendação sem bloquear o trabalho com pedidos de confirmação. Antes de um push grande, lembra-me de fazer Download backup no admin de produção.

## 2. Primeiro recuperar a base certa
1) Clonar https://github.com/mediterraneanworld-ship-it/mediterranic, branch master, para o projecto.
2) Comparar o código do GitHub com a cópia de trabalho e com /api/version; preservar alterações publicadas que a conversa anterior possa desconhecer.
3) Confirmar que DATABASE_URL aponta APENAS para a base local/sandbox. Nunca ligar ao Neon de produção.
4) Preparar as tabelas locais de forma aditiva, se necessário, e executar:
   node scripts/pull-live.cjs https://mediterranic.vercel.app
O script lê páginas públicas e espelha para a base LOCAL. Nunca deve ser executado com DATABASE_URL de produção.
Se o ZIP ou sandbox antigo tiver expirado, usar master + páginas públicas + este SOS. Não inventar que um preview antigo ainda funciona.

## 3. Fluxo de publicação — nunca fazer merge de src
Eu edito conteúdo no admin de produção: isso grava no Neon e sobrevive ao deploy.
Tu alteras código, validas e entregas um ZIP COMPLETO, sem .env, .git, node_modules, .next, caches, logs ou cópias do banco de dados.
Eu APAGO a src local e copio a src do ZIP. Mantenho .env e .git. Copio também public/ quando existirem imagens novas e vercel.json quando necessário.
Commit + Push no GitHub Desktop publica pela Vercel. Nunca confundir mudar um ficheiro no sandbox com ter feito deploy em produção.
Vercel: cada push no master cria um deployment; o site é sempre o último deployment de produção. Os antigos não afectam o site nem os dados (Neon). O Hobby protege sempre o que está no ar, os 3 últimos de produção e os 3 últimos de qualquer tipo; os restantes podem ser apagados (de imediato se o armazenamento passar de 10 GB). Para voltar atrás: Instant Rollback e depois confirmar /api/version. O plano Hobby é para uso pessoal e não comercial: confirmar com o dono se a loja deve passar ao Pro.
Um deploy não pode apagar nem substituir peças, preços, textos, fotografias, encomendas, subscritores ou decisões de moderação.
Seed apenas se a tabela estiver vazia; settings apenas se a linha não existir. Colunas novas em UPGRADE_SQL de src/lib/schema-migrate.ts, sem DROP/TRUNCATE/DELETE nem actualizações forçadas do conteúdo.

## 4. Regras de inventário invioláveis
- Nunca mostrar Sold em público: usar Unavailable, sem preço, com Request a similar specimen.
- Leilão vendido vai para /archive sem preço.
- Leilão não vendido regressa a Site Only ao valor When in Site Only; nunca usar o último lance. Sem esse valor, pedir ao curador, não adivinhar.
- Reserve price not met enquanto há licitação NÃO significa que o leilão terminou.
- Falha de leitura/API/403/404/sem preço EUR não é venda nem feed vazio. Marcar não verificado, deixar os dados intactos.
- O cron verifica apenas o canal actualmente escolhido; Site Only não regressa a leilões antigos sozinho.
- Further from the same shelf: mesma Era geológica, disponíveis primeiro; Unavailable só no fim para completar os quatro lugares.
- REF: núcleo único de 4 dígitos, com ou sem prefixo PAIS. Um ano nunca é REF. REFs diferentes nunca se fundem.
- Dimensions é texto livre. Modelo: Specimen: X.0 x X.0 cm; Matrix: X.0 x X.0 cm. REF inicial: PAIS9600. Não substituir dados reais pelos modelos.

## 5. Funcionalidades actuais que não podem desaparecer
- Checkout PayPal live e pedido por invoice com customer_note. Não fazer compras reais durante testes.
- E-mails via Resend; domínio mediterranic.com verificado para o remetente orders@mediterranic.com. Nunca copiar chaves para código ou para o chat.
- Received Orders: detalhes, envio, tracking, mensagem, CSV; eliminar encomenda não repõe stock.
- Newsletter Featured and New Pieces: seleção manual ou automática, até 10 peças disponíveis, intervalo de 15 dias, envio manual, histórico e unsubscribe.
- Texto do e-mail: Twice a month we share the pieces we are most excited about — featured specimens and the newest arrivals from the quarries and preparators.
- Preservar newsletter_settings, auto_enabled, piece_ids, unsubscribe_token e newsletter_sends. Não substituir esta implementação por outra que apague estas preferências.
- Botão Duplicate prepara um rascunho novo sob a linha original, sem alterar a peça original nem transportar os anúncios antigos.
- Edit abre sob a linha sem scroll para cima; botão Top global; galeria limitada ao ecrã; logo MEDITERRANIC numa linha também em mobile.
- Reviews: What Owners and Visitors say. Novos comentários ficam pending; só entram no site e nas médias/contagens depois de aprovação no admin, tab 6 Reviews.
- Comentários antigos já públicos mantêm-se visíveis até decisão do curador. Rejeitar oculta, não elimina. Backups preservam a moderação.
- Capa The Connoisseur: fotografia real da Cyphaspis walteri com vidro (/covers/connoisseur-cyphaspis.jpg), sem regenerar o fóssil. Confirmar no admin (5. Page texts and photos) que a capa aponta para este ficheiro, porque o Neon pode guardar o valor antigo. Escolha das avaliações da home: botão Show on home page no separador 6 (até 6; sem escolha, automático). Não anunciar que uma vitrine física está incluída na venda.
- Capas personalizadas guardadas no admin não são substituídas pelo deploy; há opção Use glass display cover no editor de conteúdo.
- Este SOS existe em /sos; texto copiável/descarregável em /api/sos-context. É público, sem segredos e marcado noindex.

- Envios: tabela por classe de peso (0–500 g; 501–1000 g; 1001–2000 g; mais de 2 kg) × 5 regiões, no admin (separador 7, Shipping rates). Peso do carrinho = soma das peças com caixa. Peça sem peso cobra a classe mais pesada até ter peso. O envio grátis, quando ligado, sobrepõe-se a tudo.
- Textos da home (admin, separador 5 → Home): título do hero em Hero → Title (first part); linha por baixo dos 4 cartões em Collections → Text below the four cards. As idades (milhões de anos) saíram dos cartões e ficam só nessa linha.

## 6. Domínio e variáveis Vercel
A loja continua em https://mediterranic.vercel.app. mediterranic.com só no FIM do projecto; shop.mediterranic.com não existe nem será usado.
PUBLIC_SITE_URL está centralizado em src/lib/site-url.ts. NEXT_PUBLIC_SITE_URL deixou de ser utilizada e pode ser removida de Production e Preview.
CRON_SECRET já existe: manter o valor, não criar outra variável. Production + Preview é válido; os cron jobs Vercel são executados apenas em Production.
Filtro de branch vazio para Production. Variáveis novas/alteradas precisam de um novo deploy; não pedir o valor secreto no chat.
vercel.json: /api/cron/refresh-prices às 06:00 UTC; /api/cron/newsletter às 07:00 UTC, diariamente. Hobby pode executar dentro da hora indicada.
Para newsletter automática: interruptor Automatic sending ligado no admin E intervalo de 15 dias cumprido, além de destinatários confirmados, peças e fornecedor configurado.
Check configuration é só leitura: não revela o segredo e não envia e-mails. Run/Send now podem enviar de verdade. Não os usar para testar a configuração.
cron-job.org não herda o segredo da Vercel: actualizar o cabeçalho Authorization com Bearer + o mesmo valor, se esse agendador for usado. Não duplicar o agendamento da newsletter.

## 7. Verificações e pendentes — confirmar, não presumir
- Verificar estado do keyset eBay Production/isenção e o EBAY_SELLER_USERNAME real, sem interpretar uma falha como ausência de ofertas.
- Confirmar jobs nos logs Vercel e histórico do admin; build bem-sucedido não prova execução de cron ou entrega de e-mail.
- Avisos npm cache-dir/allowScripts não impediram o último deploy. Rever scripts antes de aprovar; não usar aprovação indiscriminada para esconder avisos.
- Preservar cores: Site Only #ff9f3d, Catawiki #0033FF, WhatsApp #25D366, eBay a 102°. Contagens de peças/Eras sempre calculadas.

## 8. Validar antes de entregar
node --test scripts/test-ebay.cjs scripts/test-audit.cjs scripts/test-inventory.cjs scripts/test-cron.cjs scripts/test-release.cjs
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
Executar também build_and_start e verificar /api/health no sandbox. Inspeccionar os logs antes de corrigir falhas. Se houver alterações posteriores, repetir a validação.
Ensaiar em mobile 320/360/390/430px. Testar comentários pending → approved → rejected só no sandbox; nunca chamar envios ou compras em produção.
Actualizar CODE_VERSION/manifesto, src/lib/release-info.ts e este documento em cada entrega. Confirmar que o ZIP inclui toda a src e os novos assets de public/.

## 9. Links desta entrega
Produção: https://mediterranic.vercel.app
Admin: https://mediterranic.vercel.app/admin
Versão publicada: https://mediterranic.vercel.app/api/version
Checkout: https://mediterranic.vercel.app/checkout
Arquivo: https://mediterranic.vercel.app/archive
Envios: https://mediterranic.vercel.app/shipping
Featured: https://mediterranic.vercel.app/featured
Site Only: https://mediterranic.vercel.app/shop?channel=direct
eBay: https://mediterranic.vercel.app/shop?channel=ebay
Catawiki: https://mediterranic.vercel.app/shop?channel=catawiki
SOS produção (depois do deploy): https://mediterranic.vercel.app/sos
Sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app
Admin sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/admin
Versão sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/api/version
Checkout sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/checkout
Arquivo sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/archive
Envios sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/shipping
Featured sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/featured
Site Only sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/shop?channel=direct
eBay sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/shop?channel=ebay
Catawiki sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/shop?channel=catawiki
Capa The Connoisseur: https://3000-in4mh42st3jeo8rd750f7.e2b.app/covers/connoisseur-cyphaspis.jpg
SOS sandbox: https://3000-in4mh42st3jeo8rd750f7.e2b.app/sos
Texto SOS: https://3000-in4mh42st3jeo8rd750f7.e2b.app/api/sos-context
ZIP completo: https://3000-in4mh42st3jeo8rd750f7.e2b.app/downloads/mediterranic-2026-11-05-ad.zip
GitHub: https://github.com/mediterraneanworld-ship-it/mediterranic (master)
Os links sandbox/ZIP são temporários. O código no GitHub e o SOS publicado são as referências duradouras.

## Manifesto deste código
- order-notifications
- email-test
- editable-hero-stats
- orders-admin-actions
- same-shelf-era-order
- catawiki-wordmark
- ebay-quad-102deg
- public-inventory-banner-removed
- buyer-note
- tracking-email
- message-buyer
- invoice-note-dialog
- customer-delivery-check
- back-to-top
- whatsapp-below-instagram-desktop
- live-social-settings-mirror
- admin-edit-keeps-scroll
- compact-product-gallery
- mobile-overflow-fixes
- free-text-dimensions
- no-first-review-prompt
- editor-field-templates
- newsletter-featured-send
- newsletter-bulk-send
- newsletter-15day-cadence
- newsletter-unsubscribe
- newsletter-send-log
- twice-a-month-copy
- duplicate-specimen
- canonical-vercel-url
- cron-read-only-configuration
- newsletter-auto-setting-preserved
- newsletter-quarries-preparators-copy
- sos-handover-page
- review-moderation
- owners-and-visitors-reviews
- mobile-wordmark-nowrap
- connoisseur-original-photo-glass
- home-reviews-picker
- connoisseur-cyphaspis-glass
- newsletter-inline-images
- shipping-weight-table
- covers-route-bundled-cover
- shipping-table-admin-tab
- home-million-years-lines-retired
- collections-ages-below-cards
- hero-line-as-saved
- hero-eyebrow-retired
- collection-ages-retired
- links-compact-cards
- mobile-form-text-16px
- shipping-table-stacked-phone
- hero-moved-up
- home-sections-tightened
- link-cards-coloured-compact
- labels-one-line
- footer-gap-halved
- home-sections-reorderable-h0-h13
- home-sections-full-inline-editor
