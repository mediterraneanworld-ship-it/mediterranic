# MEDITERRANIC — Contexto para novo chat (ler primeiro)

Este ficheiro serve para colar no início de um chat novo e recuperar o contexto
do projecto. Substitui a necessidade de explicar tudo outra vez.

---

## 1. QUEM SOU E COMO TRABALHAR

Sou o dono da loja Mediterranic. **Responde sempre em português; o site é em inglês.**

**Regra obrigatória em TODAS as respostas:**
- **Em cada resposta tens sempre de me dar os links de Produção e os links actuais do Sandbox (Preview).** Nunca omitas estes dois blocos de links.

O meu fluxo de trabalho é:
- Eu faço alterações no **admin de produção** (`mediterranic.vercel.app/admin`).
  Isso grava no **Neon** e sobrevive a qualquer deploy.
- Tu fazes alterações de **código** e entregas-me um **ZIP TODO**.
- Eu copio o conteúdo do ZIP para a pasta local (mantendo `.env` e `.git`),
  faço **Commit + Push** no GitHub Desktop e a Vercel publica.
- **Não tenho de repetir as alterações de conteúdo.** O Neon de produção fica
  ligado ao mesmo deploy; o ZIP é de código e não restabelece nem sobrescreve
  textos, peças, preços, fotos ou definições guardadas pelo admin.

**Nunca precisas de aceder ao meu Neon. Nunca uses acessos ao Neon de produção.
Nunca escrevas no Neon de produção a partir do sandbox.**

Antes de qualquer alteração de código, executa no início da sessão:
```
node scripts/pull-live.cjs https://mediterranic.vercel.app
```
(isto lê apenas páginas públicas e nunca escreve em produção)

E pede-me sempre um **Download backup** do admin antes de um push grande.

---

## 2. REGRAS INVIOLÁVEIS

1. **Nunca "Sold" em público.** Uma peça fora de venda mostra
   **"Unavailable"**, **sem preço**, com **"Request a similar specimen"**.
2. **Leilão vendido** → arquivo público `/archive`, sem preço.
3. **Leilão não vendido** → regressa a **Site Only** ao preço do campo
   **When in Site Only**. Nunca usar o último lance como preço de venda directa.
   Se esse campo estiver vazio, pedir ao curador; não adivinhar.
4. **"Reserve price not met" com leilão a decorrer NÃO significa que terminou.**
5. Os **textos, peças, preços e fotos vivem no Neon** e nunca podem ser apagados.
   O código só preenche a base se estiver vazia. Colunas novas vão para o
   **UPGRADE_SQL** em `src/lib/schema-migrate.ts` (apenas aditivas).
6. **Não restabelecer** os valores do admin a partir do código durante o arranque.
7. Se uma leitura do marketplace **falhar** (API bloqueada, 403, 404, sem preço
   em EUR), **nunca** interpretar como venda nem reescrever dados. Marcar como
   "não verificado" e deixar tudo como está.
8. **Só o canal actualmente escolhido** é verificado pelo cron. Site Only não
   regressa sozinho a um leilão antigo.
9. **País/marketplace** e **excepções** devem ser sempre visíveis no painel de
   sincronização (`/admin` → *Inventory synchronization* e *Diagnose eBay API*).
10. Em **"Further from the same shelf"** (página da peça `/shop/[slug]`): mostrar
    apenas peças da **mesma shelf / Era geológica** (`period`), com as disponíveis
    sempre primeiro. Passar as **Unavailable** para o fim e **só as apresentar se
    não houver peças disponíveis suficientes da mesma Era geológica** para
    completar os 4 lugares.

---

## 3. IDENTIFICAÇÃO DAS PEÇAS (importante)

Cada peça tem um **número de catálogo único de 4 dígitos** (ex.: 9676), às vezes
com prefixo fixo **PAIS** (ex.: PAIS9676). Esse número existe no título e no
link SmugMug, no Catawiki, no eBay e em todas as plataformas — é como a mesma
peça física é reconhecida quando muda de plataforma.

- Aparece na ficha **por baixo do título**, no formato
  `PAIS9676 · 9 mm · 456 g` (bolinhas douradas como separadores).
- No editor: campo **REF · collection reference** + **Weight with box (g)**.
- Aceita `PAIS9676` ou `9676`: o núcleo de 4 dígitos é a chave de correspondência.
- **Um ano nunca é uma referência.**
- Referências **diferentes** nunca são fundidas.
- Se a REF não for preenchida, a loja tenta aprendê-la do link.

---

## 4. ESTADO ACTUAL (implementado e testado)

- 11 peças no catálogo; contagens partilhadas entre home, filtros e backend
  (`inventoryCounts`), excluindo arquivo, rascunhos, stock 0 e ofertas inactivas.
- Estatísticas Hero: `Years of Experience` e `Verified Feedbacks Label` são
  editáveis em Admin → **2. Site Settings & Fixed Texts** → **Hero Statistics &
  Provenance** (valor inicial `5,000+`). `Specimens` é sempre calculado de
  `inventoryCounts.all` (disponíveis Site Only + eBay + Catawiki), nunca editável;
  `Eras offered` também é automático. Para mudar o valor actual da produção,
  editar o campo no admin de produção; um ZIP não altera o valor já guardado no Neon.
- **Ciclo de canais sem duplicar peças:** cada peça guarda links separados
  (`ebay_listing_url`, `catawiki_listing_url`), histórico e referência.
  Um anúncio conhecido é **ligado à ficha existente**, não importado outra vez.
- **Inventário automático** antes dos preços no cron e no botão manual
  (`synchronizeInventory`): descobre ofertas activas, aprende referências,
  liga relistagens e importa novas quando inequívocas. Falha nunca é zero.
- **Painel de sincronização** mostra sempre o **país/marketplace** activo de cada
  canal e a barra dedicada de **excepções** (com distinção clara quando um feed
  não foi verificado). O estado "partly verified" é só para admin, nunca público.
- **"Further from the same shelf"** (`src/lib/shelf-recommendations.ts`): filtra
  pela mesma Era geológica (`period`), apresenta as disponíveis primeiro e só
  coloca *Unavailable* no fim se existirem menos de 4 disponíveis dessa Era.
- **Caixa de canal** no admin (Site Only / Catawiki / eBay / Unavailable) com
  link, preço e gravação. Unavailable tem escolha **arquivo sim/não** e sem campo
  de link.
- Editor da peça abre **inline, abaixo da linha editada**.
- **eBay:** Browse API oficial (leilões e preço fixo, categoria 3213).
  Avisos da eBay são lidos como erro, não como zero anúncios.
- **PayPal** Orders v2 com captura transaccional e chaves de idempotência;
  dono confirmou que está a funcionar.
- **Received Orders** no admin: filtros por estado, confirmar invoice/pagamento
  em revisão, expedir com carrier + tracking (visível ao comprador em
  `/orders/[id]`), concluir e cancelar; cancelamento de encomenda paga repõe
  stock, mas **não faz refund PayPal**. Botão **Delete cancelled orders** elimina
  permanentemente apenas encomendas com status `cancelled` e os seus itens; mostra
  contagem exacta, pede confirmação e não altera stock nem outros estados.
- **Email de nova encomenda** integrado server-side via Resend: invoice e ordem
  PayPal criada enviam aviso para `mediterranean.world@gmail.com` (destinatário
  predefinido). Para activar em Vercel Production faltam `RESEND_API_KEY` e
  `RESEND_FROM_EMAIL` (domínio remetente verificado); opcional
  `ORDER_NOTIFICATION_EMAIL`. No admin, **Received Orders → Send test e-mail**
  verifica a configuração do deployment sem criar encomenda. O email de falha
  não desfaz encomendas. Ver `public/PEDIDOS-EMAIL.md`.
- Botão alternativo no checkout diz
  **“PLACE ORDER BY INVOICE (EMAIL) - USE FOR ALTERNATIVE PAYMENT METHODS AND OFFERS”**.
- **Envios:** envio grátis único quando activo no admin; senão uma tarifa das
  **5 zonas** (Europa €54, Américas €48, Ásia €60, África €72, Oceania €85).
  **249 destinos ISO**, ordem alfabética. Nunca dizer "insured".
- **Newsletter** com exportação CSV; **backup v3** inclui imagens e encomendas.
- **Statcounter** activo, segue navegação interna, não carrega em admin/checkout.
- Cores: Site Only `#ff9f3d`, Catawiki `#0033FF`, eBay quatro cores
  (`.ebay-quad`, divisões inclinadas a **102°**, estático), WhatsApp `#25D366`,
  Instagram/Facebook gradientes.
- Etiquetas das peças **fora** das fotografias (não tapam no telemóvel).
- **Next.js 16.4.3**; `npm audit --omit=dev` sem vulnerabilidades conhecidas;
  **55 testes** offline a passar.
- Domínio: manter `mediterranic.vercel.app` até ao fim do projecto. O
  `mediterranic.com` continua no site antigo.

---

## 5. PENDENTES

1. **eBay:** o keyset Production *Mediterranic* está **desactivado**. O dono tem
   de subscrever as notificações de encerramento de conta (ou pedir isenção) em
   developer.ebay.com. Escolheu "Exempted" no formulário, pendente de validação
   pela eBay. Até lá, o diagnóstico mostra erro de acesso — nunca zero anúncios.
2. **`EBAY_SELLER_USERNAME`:** confirmar o nome real da conta de vendedor
   (a ligação `/str/mederranic` é o nome da loja, não necessariamente o username).
3. **PayPal:** está a funcionar (confirmado pelo dono). Se o checkout voltar a
   falhar, correr **Admin → Diagnose PayPal API**.
4. **Email de novas encomendas:** adicionar na Vercel Production `RESEND_API_KEY`
   e `RESEND_FROM_EMAIL` (de um domínio verificado no Resend), depois Redeploy.
   Destinatário já predefinido para `mediterranean.world@gmail.com`.
5. **Cron-job.org externo** (opcional): corrigir o CRON_SECRET nesse agendador.
6. **Newsletter:** ainda falta ligar um fornecedor de envio automático; a lista
   continua disponível para exportar CSV.
7. **Domínio próprio** (mediterranic.com) só no fim do projecto.

---

## 6. COMANDOS ÚTEIS

```
node scripts/pull-live.cjs https://mediterranic.vercel.app   # espelhar produção (só leitura)
node --test scripts/test-ebay.cjs scripts/test-audit.cjs scripts/test-inventory.cjs
npm run build
```

---

## 7. LINKS (incluir sempre Produção + Sandbox em todas as respostas)

### Produção
- Loja produção: https://mediterranic.vercel.app
- Admin produção: https://mediterranic.vercel.app/admin
- Arquivo: https://mediterranic.vercel.app/archive
- Site Only: https://mediterranic.vercel.app/shop?channel=direct
- eBay: https://mediterranic.vercel.app/shop?channel=ebay
- Catawiki: https://mediterranic.vercel.app/shop?channel=catawiki
- Envios: https://mediterranic.vercel.app/shipping
- Checkout: https://mediterranic.vercel.app/checkout
- GitHub: https://github.com/mediterraneanworld-ship-it/mediterranic (master)

### Sandbox / Preview (substituir `<SANDBOX_URL>` pelo URL real da sessão actual)
- Loja sandbox: `<SANDBOX_URL>`
- Admin sandbox: `<SANDBOX_URL>/admin`
- Arquivo sandbox: `<SANDBOX_URL>/archive`
- Loja / filtros sandbox: `<SANDBOX_URL>/shop`
