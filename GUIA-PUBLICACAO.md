# Mediterranic — guia de publicação

Passo a passo para colocar a loja no ar no seu domínio próprio.

---

## 0. Início de cada sessão de desenvolvimento (para o programador)

**Antes de qualquer alteração**, espelhar a loja publicada para o ambiente de
trabalho, para que o preview mostre as peças e os textos reais (e não o
catálogo de demonstração):

```
node scripts/pull-live.cjs https://mediterranic.vercel.app
```

- Lê apenas as **páginas públicas** (sitemap, páginas de produto, /archive e a
  home) — não precisa de palavra-passe.
- Faz *upsert* por slug na base local: actualiza as que existem, acrescenta as
  que faltam, **nunca apaga**.
- Fotografias guardadas na base de dados da loja (`/api/uploads/N`) são
  descarregadas e re-mapeadas para a base local.
- Os dados de produção (Neon) **nunca devem ser usados como destino** deste
  script: só executar com uma base de dados local de desenvolvimento.
- As páginas públicas são uma vista parcial: não permitem obter rascunhos,
  preços privados, todos os textos editáveis ou o histórico do cron. A consulta
  pública não substitui um backup autenticado. Nunca prometer que é um espelho
  completo nem restaurar esse espelho para produção.

Se o dono da loja enviar um ficheiro de backup (`⬇ Download backup`), esse
ficheiro é ainda mais completo (inclui campos privados como "When in Site
Only", colecções, destaque, certificados) e deve ser usado por cima:
restaurá-lo em `/admin` → `⬆ Restore from file` no preview.

**Regra obrigatória de comunicação para o programador:**
- O ficheiro de arranque para novos chats vive em `CONTEXTO-NOVO-CHAT.md` (e em
  `public/CONTEXTO-NOVO-CHAT.md`).
- **Em TODAS as respostas**, o programador tem **sempre** de incluir os links
  completos de **Produção** (`https://mediterranic.vercel.app`) e os links
  actuais do **Sandbox / Preview** da sessão.

---

## 1. Criar a base de dados (Neon)

1. Ir a **https://neon.tech** e criar conta gratuita.
2. **Create project** → região **Europe (Frankfurt)** (mais perto de Portugal e dos clientes europeus).
3. No painel do projeto, copiar a **connection string pooled**:
   ```
   postgresql://user:password@ep-xxxx.eu-central-1.aws.neon.tech/dbname?sslmode=require
   ```
   Usar a versão **pooled** (`-pooler` no nome do host), porque a Vercel abre muitas
   ligações em simultâneo.
4. Guardar esta string — é o `DATABASE_URL`.

---

## 2. Criar conta na Vercel e importar o projeto

1. Ir a **https://vercel.com** → **Sign Up** com a conta GitHub.
2. Autorizar a Vercel a aceder aos seus repositórios.
3. **Add New… → Project** → **Import** o repositório `mediterranic`.
4. Framework: **Next.js** (detectado automaticamente). Não mudar o build command.

---

## 3. Variáveis de ambiente (Settings → Environment Variables)

| Nome | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | a string do Neon | **Sim** |
| `ADMIN_PASSWORD` | uma palavra-passe forte sua | **Sim** |
| `STRICT_ADMIN_AUTH` | `true` | **Sim** |
| `CRON_SECRET` | uma chave longa aleatória | **Sim** (para o automático dos preços) |
| `NEXT_PUBLIC_SITE_URL` | `https://oseudominio.com` | Recomendado |
| `EBAY_STORE_URL` | `https://www.ebay.com/str/mederranic` | Recomendado |

Marcar as três opções: *Production*, *Preview* e *Development*.

> `ADMIN_PASSWORD` e `CRON_SECRET` devem ser diferentes e longos (20+ caracteres).
> Guarde-os num gestor de palavras-passe.

---

## 4. Deploy

1. **Deploy**. O primeiro build demora 2–4 minutos.
2. A Vercel dá um endereço temporário `https://mediterranic-xxx.vercel.app`.
3. Abrir esse endereço: a loja deve aparecer **já com as 10 peças** (a base de dados
   é preenchida automaticamente a partir do catálogo do projecto).

---

## 5. Ligar o seu domínio

1. Na Vercel: **Settings → Domains → Add** → escrever `oseudominio.com` e `www.oseudominio.com`.
2. A Vercel mostra dois registos DNS:
   - um **A** para `@` → `76.76.21.21`
   - um **CNAME** para `www` → `cname.vercel-dns.com`
3. Ir ao painel onde tem o domínio (GoDaddy, Namecheap, Amen, Cloudflare…) e colar
   esses dois registos na zona **DNS**.
4. Esperar 15 minutos a 48 horas (normalmente menos de 1 hora).
5. Actualizar `NEXT_PUBLIC_SITE_URL` para o domínio final e fazer novo deploy.

---

## 6. Verificações finais

- [ ] `https://oseudominio.com` abre com cadeado
- [ ] `https://oseudominio.com/admin` pede palavra-passe
- [ ] `https://oseudominio.com/shop` mostra as peças
- [ ] Fazer uma encomenda de teste até ao fim
- [ ] Confirmar que o preço aparece em euros

---

## 7. Falta fazer antes de vender a sério

1. **PayPal** — ligar a conta PayPal Business (o email de recebimento já é
   `mediterranean.world@gmail.com`). Faltam as credenciais da API
   (`PAYPAL_CLIENT_ID` e `PAYPAL_SECRET`) nas Environment Variables da Vercel.
2. **Importar o catálogo antigo** de `www.mediterranic.com` (galerias numeradas,
   ex.: *9588 Koneprusia dahmani*).
3. **Domínio próprio, só no fim do projecto:** `mediterranic.com` (e `www`).
   Até essa decisão, manter a loja em `mediterranic.vercel.app`, sem alterar
   DNS, o SmugMug ou os domínios configurados na Vercel.
4. **Limitação de pedidos** (*rate limiting*) para proteger o checkout.
5. **Cópias de segurança** — o Neon faz cópias automáticas nos planos pagos.

### Já está feito

- **Página Envios e Devoluções** → `/shipping`, ligada no cabeçalho
  (*Insured Worldwide Shipping*) e no rodapé. Os valores mostrados são lidos de
  `src/lib/shipping.ts`, ou seja, são exactamente os que o checkout cobra — não
  há duas tabelas que possam divergir.
- **Newsletter** → formulário no rodapé e em `/shipping`. Ver secção 10.

---

## 8. Trabalhar no back-office sem perder nada

Esta é a regra mais importante do dia-a-dia.

### Antes de pedir alterações ao programador

1. Entrar em `/admin`
2. Carregar em **"⬇ Download backup"** (primeira caixa do painel)
3. Guardar o ficheiro `mediterranic-backup-AAAA-MM-DD.json`
4. Enviar esse ficheiro junto com o pedido de alterações

O ficheiro contém **tudo**: todas as peças, preços, fotografias, estados de stock,
canais de venda, certificados, vídeos e todos os textos da loja.

### Se alguma coisa se perder

1. Entrar em `/admin`
2. **"⬆ Restore from file"** → escolher o backup
3. Confirmar

O restauro **nunca apaga nada**. As peças são reconhecidas pelo nome interno
(*slug*): as que existem são actualizadas, as que faltam são acrescentadas, e
qualquer peça criada depois do backup fica intacta.

### Com que frequência

- Antes de qualquer trabalho de desenvolvimento — **sempre**
- Depois de uma sessão longa de edições — recomendado
- Uma vez por semana, por hábito

---

## Notas técnicas

- Peças, preços, fotografias carregadas e textos editados vivem no **Neon**.
  `src/lib/seed-data.ts` e `src/lib/seed-settings.ts` são apenas valores iniciais:
  o catálogo só é preenchido se a tabela de peças estiver vazia. Um deploy não
  repõe os valores do admin nem apaga dados existentes. Nunca copiar um `.env`
  de desenvolvimento para substituir as variáveis da Vercel.
- O automático dos preços corre **uma vez por dia às 06:00** (`vercel.json`). O plano
  gratuito da Vercel (Hobby) só permite um cron diário. Para mais frequência:
  - **Plano Pro da Vercel** (~20 €/mês): mude `"schedule"` para `"*/30 * * * *"`.
  - **Ou um agendador externo gratuito** (cron-job.org, UptimeRobot): chame de X em X
    minutos o endereço `https://shop.mediterranic.com/api/cron/refresh-prices?secret=A_SUA_CRON_SECRET`.
  - O botão **"Check prices now"** no back-office funciona sempre, de imediato.
- As fotografias estão em `public/images/` e são servidas directamente.

---

## 9. Como pedir alterações a partir de agora

Passa a funcionar assim: por cada pedido, o programador diz-lhe se basta
**substituir alguns ficheiros** ou se convém **renovar o zip todo**.

### Regra de ouro (antes de qualquer push)

1. Entrar em `/admin`
2. **"⬇ Download backup"** e guardar o ficheiro

Isto não é porque o push apague dados — **não apaga**. O catálogo, os preços e os
textos vivem na base de dados (Neon) e o código novo nunca toca numa base de
dados que já tenha peças. O backup é só a sua rede de segurança.

### Caminho A — só alguns ficheiros (o mais frequente)

Mudanças de textos fixos no código, ajustes de CSS, pequenas correcções.

1. Descarregar os ficheiros indicados
2. Copiar para `Documentos/GitHub/mediterranic`, substituindo os que têm o
   mesmo nome (e o mesmo caminho — ex.: `src/components/...`)
3. GitHub Desktop → **Commit** → **Push origin**
4. A Vercel publica sozinha em ~1 minuto

### Caminho B — zip completo

Alterações de estrutura, de base de dados (novas colunas), de muitas páginas
ao mesmo tempo, ou do comportamento do back-office.

1. Descarregar o zip → descompactar
2. Copiar **o conteúdo** da pasta para `Documentos/GitHub/mediterranic`,
   substituindo tudo
3. GitHub Desktop → **Commit** → **Push origin**
4. A Vercel publica sozinha em ~1 minuto

### O que NUNCA é preciso fazer

- Não é preciso voltar a criar o projeto na Vercel.
- Não é preciso mexer nas Environment Variables (só se o programador disser).
- Não é preciso voltar a ligar o domínio.

### As suas peças estão seguras

O código só preenche a base de dados se ela estiver **vazia**. Como a sua já
tem peças, qualquer deploy novo deixa peças, preços, fotos e textos intactos.

---

## 10. Newsletter

Um formulário de subscrição aparece no **rodapé** de todas as páginas e no fim
de `/shipping`.

- Os endereços ficam na tabela `newsletter_subscribers` do Neon (criada
  sozinha no arranque, via `UPGRADE_SQL` em `src/lib/schema-migrate.ts`).
- No back-office, separador **“4. Newsletter”**: vê a lista, a data e a origem
  de cada subscrição, e descarrega **Download CSV** para enviar a partir do
  Gmail, Mailchimp ou Brevo.
- **Remove** apaga apenas um endereço, quando alguém pede para sair. Nada mais
  apaga — nem um deploy, nem o restauro de um backup.
- O endereço é único: se alguém se inscrever duas vezes não fica duplicado.
- O backup (`⬇ Download backup`) passou a incluir a lista de subscritores
  (versão 2). Um restauro volta a acrescentar os que faltarem sem nunca apagar
  os que entretanto se inscreveram.
- Ainda **não envia emails automaticamente** — falta ligar um fornecedor
  (Resend, Brevo ou Mailchimp). A lista é sua e exporta-se em CSV.

---

## 11. Regras de apresentação pública (recordatório)

Estas regras estão aplicadas no código e devem manter-se:

- Nunca aparece **“Sold”** em público. Uma peça fora de stock mostra
  **“Unavailable”**, **sem preço**, com o apelo **“Request a similar specimen”**.
- Leilão **vendido** → a peça vai para o arquivo público em `/archive`, sem preço.
- Leilão **não vendido** → a peça volta a **Site Only** com o preço do campo
  *“When in Site Only”*.
- **“Reserve price not met”** com o leilão ainda a decorrer **não** significa que
  terminou — a peça mantém-se no canal do leiloeiro.
- Os preços actualizam-se em `/admin` com **“Check prices now”** e, uma vez por
  dia às 06:00, pelo cron da Vercel (`vercel.json`).

---

## 12. Editar todos os textos e fotografias do site

Desde esta versão, **todos** os textos e **todas** as fotografias do site público
se editam no back-office, sem tocar em código.

### Onde

`/admin` → separador **“5. Page texts & photos”**.

À esquerda escolhe-se a página; à direita aparecem os campos. Tipos de campo:

- **Texto** — uma linha (títulos, botões, legendas).
- **Texto longo** — parágrafos.
- **Uma linha por item** — listas (blocos de texto de Envios e Devoluções,
  listas do rodapé).
- **Pares título + texto** — os 4 cartões de confiança, os 3 passos da
  proveniência.
- **Fotografia** — campo de caminho **e** botão **Upload photo**. A imagem é
  guardada na base de dados (`uploaded_images`), por isso sobrevive a qualquer
  deploy. Também se pode colar um caminho `/images/...` ou um URL.

No fim, **Save all pages**. O botão fica “Saved” quando não há alterações.

### O que está incluído

| Página | O que se edita |
|---|---|
| Cabeçalho | faixa de confiança, 5 etiquetas do menu |
| Início | hero (textos + foto + botões), 4 cartões de confiança, 3 canais, coleções (títulos + **4 capas**), destaques, proveniência (textos + **foto** + 3 passos), reviews, marketplaces, CTA final |
| Loja | cabeçalho, descrição, estado vazio |
| Arquivo | cabeçalho, descrição, etiqueta, estado vazio |
| Envios e Devoluções | todos os blocos (títulos + parágrafos) |
| Checkout | cabeçalho |
| Página de peça | títulos das secções, certificado |
| Rodapé | tagline, newsletter, listas, rodapé legal |
| 404 | título, texto, botões |

### Onde fica guardado

Tudo numa única coluna jsonb, `site_settings.content`. A coluna é criada sozinha
no arranque (`UPGRADE_SQL` em `src/lib/schema-migrate.ts`). O código faz *merge*
do que está guardado sobre os valores por omissão em `src/lib/site-content.ts`
— se um campo novo for acrescentado ao código, aparece no admin já preenchido
com o texto actual e **não apaga** nada do que já foi escrito.

### Duas regras

1. **Nada é apagado por um deploy.** O que está na base de dados ganha sempre ao
   texto por omissão.
2. **Não há duas fontes de verdade.** O separador 2 (“Fixed Storefront Texts”)
   e o separador 5 escrevem para o mesmo sítio: o hero e a proveniência são
   sincronizados nos dois sentidos. Se editar num, o outro mostra o novo valor.

---

## 13. Preços escondidos, contagem real e importação do eBay

### 13.1 Peças indisponíveis não têm preço em lado nenhum

Uma peça com `archived`, sem stock ou sem canal de venda aparece como
**“Unavailable”**, sem preço e com **“Request a similar specimen”**. Isso já
acontecia no ecrã. O problema é que o preço podia continuar no **código-fonte**
da página (payload técnico), invisível mas legível.

Corrigido em `src/lib/product-visibility.ts`:

- `isAvailable()` — à venda = não arquivada **e** com stock **e** com canal.
- `publicProduct()` / `publicProducts()` — apagam `priceCents`,
  `compareAtCents` e `siteOnlyPriceCents` antes de qualquer objecto passar para
  um componente cliente.

Aplicado na loja, na página da peça, no cartão de produto e no botão de compra.
O preço de reserva interno (“When in Site Only”) também nunca sai do servidor
para peças indisponíveis.

### 13.2 O número de peças no hero é real

“Specimens”, no bloco *Five hundred million years, in your keeping.*, conta
apenas peças **à venda** (com stock, não arquivadas, com canal). As peças do
catálogo/arquivo não contam. “Eras offered” também passou a ser calculado a
partir dos períodos realmente presentes.

### 13.3 Uma peça nova no eBay não aparecia — porquê

Eram três coisas, todas resolvidas:

1. **“Check prices now” não cria peças.** Esse botão (e o cron diário) só
   actualiza peças **que já existem** no site. Para trazer uma peça nova é
   preciso **“Find my eBay listings”**.
2. **A importação guardava tudo como rascunho** (`published: false`), por isso
   a peça ficava invisível até alguém a abrir e publicar manualmente.
   Agora, quando a página do anúncio (ou a montra do eBay) mostra o preço, a
   peça é importada **já publicada**, com canal **Live on eBay**, stock 1 e o
   preço do eBay — e o mesmo valor fica em “When in Site Only”, para o caso de
   o leilão terminar sem venda.
   Só fica em rascunho quando **não há preço nenhum** para ler; nesse caso o
   aviso final diz exactamente quantas peças esperam preço.
3. **Filtro de trilobites.** A montra do eBay é filtrada: conchas, minerais,
   meteoritos, dentes, âmbar, corais, etc. são excluídos automaticamente. Se o
   título do anúncio contiver uma dessas palavras (por exemplo “coral”) e não
   contiver “trilobite”, a peça é excluída — nesse caso o painel mostra
   “N excluídos”. A lista final, antes de importar, é sempre visível no admin.

---

## 14. eBay: porque a importação parou (e como fica resolvida)

### O que se passou

A importação lia a página pública do eBay. Desde o reforço da protecção
anti-robô, o eBay responde **HTTP 403** a pedidos feitos de servidores (Vercel,
sandbox, CI) — e também aos leitores externos. Testado a partir do servidor:

```
https://www.ebay.com/itm/920090937900     -> 403
https://www.ebay.com/str/mederranic       -> 403
```

Não é a loja, o código ou a conta: é o eBay a recusar o acesso automático.
Antes funcionava porque a protecção era mais permissiva.

### A solução: API oficial da eBay (gratuita)

1. Ir a **https://developer.ebay.com** com a conta do eBay → *Hi [nome]* → **Application Keys**.
2. Criar/ver as chaves de **Production**: **App ID (Client ID)** e **Cert ID (Client Secret)**.
3. Na Vercel: **Settings → Environment Variables**, adicionar
   - `EBAY_CLIENT_ID` = App ID
   - `EBAY_CLIENT_SECRET` = Cert ID
   - (opcional) `EBAY_MARKETPLACE_ID` = `EBAY_US` ou `EBAY_ES`/`EBAY_GB`
4. **Redeploy** (Deployments → ⋯ → Redeploy).

Com as chaves, os dois botões passam a usar a API e **já não dependem da página**:

- **“Find my eBay listings”** — lista os anúncios activos do vendedor com preço.
- **“Import from URL”** — lê um anúncio pelo link ou pelo número do artigo.

Sem chaves, a loja continua a funcionar; a importação mostra o motivo (HTTP 403)
e cada lote tem o botão **“Add manually”**, que abre o formulário já com link,
canal *Live on eBay* e preço preenchidos.

### O que ficou melhor mesmo sem chaves

- Os erros deixaram de ser silenciosos: o painel diz quantas foram importadas,
  quantas ficaram em rascunho, quantas falharam e **porquê**.
- A importação com preço fica **já publicada** (Live on eBay); só fica em
  rascunho quando não há preço nenhum.

---

## 15. eBay sem chaves: importar colando o anúncio

### 15.1 O que está realmente bloqueado (medido, não suposto)

```
ebay.com/                          -> 403
ebay.com/itm/920090937900          -> 403
ebay.com/str/mederranic            -> 403
ebay.com/sch/... (busca e RSS)     -> 403
i.ebayimg.com (fotografias)        -> 200   ← acessível
api.ebay.com (token, sem chaves)   -> 400   ← acessível
google.com / mediterranic.vercel.app -> 200
```

O código de leitura é **o mesmo desde o primeiro commit**: `fetch` da página,
com `r.jina.ai` como alternativa. Não mudou nada no projecto. O que mudou foi o
eBay recusar pedidos vindos de servidores (IP de datacenter). As fotografias
vivem noutro domínio (CDN) e continuam acessíveis — por isso é sempre possível
guardar as fotos.

### 15.2 A via que funciona já, sem chaves: colar

`/admin` → separador 1 → cartão do eBay → **“eBay blocking? Paste the listing
here — no keys needed”**.

1. Abrir o anúncio no browser.
2. <kbd>Ctrl</kbd>+<kbd>A</kbd> → <kbd>Ctrl</kbd>+<kbd>C</kbd> → colar na
   primeira caixa.
3. Botão direito na fotografia principal → *Copiar endereço da imagem* → colar
   na segunda caixa (uma por linha). Também aceita o HTML da página, de onde as
   fotos são extraídas sozinhas.
4. **Read pasted listing** → o formulário abre preenchido (título, espécie,
   período, localidade, comprimento, preparação, preço, descrição e fotos já
   guardadas na base de dados).
5. Rever e **Save**.

### 15.3 Nunca mais peças vazias

O `/api/admin/products` passou a recusar publicar uma peça sem **preço**,
**pelo menos uma fotografia** e **descrição**. A mensagem diz exactamente o que
falta. Guardar como rascunho continua permitido. Isto corrige o caso de ficar
uma peça criada sem foto, sem preço e sem texto.

### 15.4 Chaves da API — porque não as posso criar por si

As chaves são pessoais e só podem ser criadas com sessão iniciada na **sua**
conta eBay e no **eBay Developers Program** (com verificação de identidade).
Não tenho — nem devo ter — acesso à sua conta. Em 5 minutos, você:

1. `developer.ebay.com` → iniciar sessão com a conta eBay da loja.
2. *Hi [nome]* → **Application Keys**.
3. Ver/criar as chaves de **Production**: **App ID** e **Cert ID**.
4. Na Vercel: *Settings → Environment Variables* →
   `EBAY_CLIENT_ID` = App ID, `EBAY_CLIENT_SECRET` = Cert ID.
5. *Deployments → ⋯ → Redeploy*.
6. Dizer-me, e eu testo os dois botões contra a API real.

Sem chaves, tudo o resto funciona: colar (15.2), “Add manually”, preços diários
e a loja.

---

## 16. Importar SmugMug: sempre as três primeiras fotos

A galeria de SmugMug no domínio `mediterranic.com` tem um URL para cada
fotografia (não só uma capa). O importador de URL usava apenas a meta-tag
`og:image` e escolhia sempre a primeira imagem, o que explicava o facto de a
peça ter uma só fotografia.

Agora `src/lib/gallery-images.ts`:

- lê todas as imagens de `photos.smugmug.com` e ignora logos/spacers;
- deduplica pelo id real da foto (a mesma foto pode aparecer em vários tamanhos);
- mantém a **ordem da galeria**;
- guarda **as primeiras 3** — nunca 1, nunca as últimas;
- guarda as fotografias no `uploaded_images` da nossa base, não depende de URL
  externo para a peça continuar visível.

Se o site não conseguiu descarregar **todas as 3**, o admin **não publica de
forma silenciosa**: mostra uma mensagem com a contagem, mantém o formulário
aberto com as fotografias que conseguiu e pede que complete as restantes.

Isto é específico ao **Import from URL** quando o link é do SmugMug (ou do
antigo site `mediterranic.com`). O processo **não apaga** fotos antigas que já
existem noutras peças nem altera as peças do arquivo. Uma peça já existente
continua o mesmo catálogo — reimportar o URL volta a actualizar os campos
da peça, não cria uma duplicata se o slug já existe.


---

## 17. Ligar o PayPal (pagamentos reais)

O checkout tem dois botões: **Pay with PayPal** (pagamento imediato) e
**Place order by invoice** (encomenda confirmada por email, sem cobrar).

### Variáveis de ambiente na Vercel (Settings → Environment Variables)

| Nome | Valor | Ambiente |
|---|---|---|
| `PAYPAL_CLIENT_ID` | Client ID da app REST | Production, Preview, Development |
| `PAYPAL_CLIENT_SECRET` | Client Secret (secreto — nunca no código) | Production, Preview, Development |
| `PAYPAL_ENVIRONMENT` | `sandbox` para testes, **`live`** para produção | conforme o caso |
| `PAYPAL_MERCHANT_EMAIL` | `mediterranean.world@gmail.com` (apenas referência) | opcional |

### Onde obter as chaves

1. Iniciar sessão em **https://developer.paypal.com** com a conta PayPal
   Business da loja (**mediterranean.world@gmail.com**).
2. **My Apps & Credentials → Create App** (REST API app).
3. Copiar **Client ID** e **Client Secret**.
4. Para testar sem dinheiro real, use as credenciais **Sandbox** e
   `PAYPAL_ENVIRONMENT=sandbox`; para cobrar de verdade, Production + `live`.

### Fluxo implementado (server-side, seguro)

1. O browser chama `/api/paypal/create-order` — os preços são **sempre
   recalculados no servidor** a partir da base de dados, nunca do browser.
2. É criada uma encomenda interna com estado `pending_payment` e uma encomenda
   PayPal; o comprador é redirecionado para o link de aprovação do PayPal.
3. No regresso (`/checkout?paypal=return&order=…&token=…`), o servidor verifica
   na API do PayPal que o estado é `APPROVED`, faz **capture**, compara o valor
   pago com o total da encomenda e só então confirma a encomenda e baixa o stock.
4. Se cancelar, a encomenda fica `cancelled` e nada é cobrado.

Colunas novas em `orders` (`payment_method`, `paypal_order_id`) vão para o
`UPGRADE_SQL` e são criadas sozinhas no arranque. Sem as variáveis PayPal, o
botão mostra um aviso e o botão de fatura continua a funcionar.

---

## 18. Logo, favicon e Statcounter

- **Favicon:** ficheiros na convenção do Next (`src/app/icon.svg`,
  `src/app/icon.png`, `src/app/apple-icon.png`) — o browser pede
  automaticamente. Ícone dourado sobre azul-marinho, como o logotipo.
- **Logotipo do cabeçalho:** editável em `/admin` → **5. Page texts & photos** →
  *Header & navigation* → campo **Logo** (upload de PNG/SVG; vazio = texto
  "Mediterranic"). Por omissão usa `/images/logo-mediterranic.png`.
- **Statcounter:** `/admin` → **5. Page texts & photos** →
  *Analytics & tracking (Statcounter)* → colar o código completo que o
  Statcounter dá (com as tags `<script>`), no campo **bodyScripts**. É
  injectado no fim de todas as páginas. O código é guardado em
  `site_settings.content`, por isso sobrevive a deploys. Não o coloques em dois
  Sítios — conta uma vez.


---

## 19. Logotipo, favicon editáveis e lista de países

- **Logotipo do cabeçalho:** por omissão volta a ser o texto serifado
  "MEDITERRANIC" (o anterior). Se quiseres uma imagem, `/admin` →
  **5. Page texts & photos** → *Brand · logo & favicon* → **Header logo**
  (upload PNG/SVG). Vazio = texto.
- **Favicon (separador do browser):** o mesmo grupo, campo **Favicon**
  (upload). É aplicado via metadata dinâmica em todas as páginas.
  Por omissão: o "M" dourado sobre azul (`/images/logo-m-icon.png`), que também
  serve de `icon.png` e `apple-icon.png` para telemóveis e apps instaladas.
- **Países no checkout:** a lista passou a ser **todos os países ISO 3166-1
  (229), por ordem alfabética**, em `src/lib/shipping.ts`. As zonas de
  portes ganhou "Rest of the world" (€75 / €150), e a página /shipping mostra
  as quatro zonas automaticamente.

## 20. PayPal sandbox: que conta escolher?

No **developer.paypal.com → Sandbox → Accounts**, escolhe a conta sandbox
cuja **moeda e país** correspondem à loja real:

- A loja vende em **EUR** e a conta Business real é europeia → usa a conta
  sandbox **(ES)**, porque o sandbox dela trabalha em **EUR** e espelha o
  comportamento da conta de produção europeia.
- A conta **(US)** trabalha em **USD** — os pagamentos de teste apareceriam em
  dólares e não refletem o checkout real em euros.

Regra prática: **sandbox ES para testar, produção (live) com as chaves da
conta mediterranean.world@gmail.com quando estiver tudo aprovado.**

---

## 21. Cores das marcas nos mercados (em todo o site)

As ligações e etiquetas dos mercados usam as **cores oficiais das marcas** em todo
o site (cabeçalhos de canal, cartões da home, botões de compra externa, rodapé,
loja e página de peça):

| Marca | Cor | Onde se vê |
|---|---|---|
| **WhatsApp** | verde `#25D366` | cartão "Direct" (fundo verde) |
| **Facebook** | azul `#1877F2` | cartão "Community" (fundo azul) |
| **Instagram** | gradiente `#FCAF45→#E1306C→#833AB4` | cartão "Photography" (fundo gradiente) |
| **Catawiki** | azul `#0033FF` | etiqueta "Live on Catawiki", cartão, botão "View Live Listing", rodapé |
| **eBay** | quatro cores `#E53238`+`#0064D2`+`#F5AF02`+`#86B817` (1/4 cada) | etiqueta "Live on eBay", cartão, botão "View Live Listing", rodapé |

**Nota eBay:** o logótipo do eBay é multicolor (e=vermelho, b=azul, a=amarelo,
y=verde). As quatro cores aparecem agora em faixas iguais (`.ebay-quad` em
`globals.css`), com um leve escurecimento para o texto branco continuar legível.
No cartão do eBay os acentos usam o **vermelho eBay** (`#E53238`), para o azul
ficar reservado ao Catawiki.

**Cor de fundo das caixas:** os cartões de cada rede/plataforma ("Everywhere we
are") têm a **cor de fundo** da marca, com texto branco.

No fundo escuro do rodapé as cores aparecem em tons mais claros (`#4d94ff` eBay,
`#5b8cff` Catawiki) para continuarem legíveis. Não estão presas em `theme`: se
alguma vez quiseres mudar uma cor, é só trocar o valor hexadecimal nas classes
(`bg-[#0033FF]`, `text-[#0064D2]`, etc.).


---

## 22. Cor do canal "Only on This Site"

O canal **Site Only / Only on This Site** passou a usar o laranja `#ff9f3d` em
**todas as páginas**:

- etiqueta "Site Exclusive" nos cartões de peça e na página da peça;
- barra "Available Only on Mediterranic";
- botão **Add to cart** (compra directa);
- etiqueta e borda do cartão "Only on This Site" na página inicial;
- ponto indicador no filtro de canais da loja.

Classe única em `src/app/globals.css`: `.site-only`. Para o texto sobre laranja
usar tinta escura (`#0c1b26`), e para texto laranja sobre fundo claro usar
`#c9721f` (mais escuro, legível). O eBay mantém as quatro cores e o Catawiki o
azul — os três canais nunca se confundem.


---

## 23. Etiquetas fora das imagens e envios (5 zonas + envio grátis)

### 23.1 Etiquetas das peças

As etiquetas (**Período**, **Site Exclusive / Live on eBay / Live on Catawiki /
Unavailable**, e a etiqueta **Archive**) saíram de dentro das fotografias e
passaram para **uma linha acima da imagem**. No telemóvel deixaram de tapar a
peça. A faixa de "View details" que aparecia sobre a fotografia foi removida.

### 23.2 Envio grátis (o caso normal)

`/admin` → **5. Page texts & photos** → grupo **Shipping & payment** →
interruptor **Free shipping on every order** (ligado por omissão).

- **Ligado:** o checkout mostra **uma única opção — Free shipping**, sem
  alternativas. Não há *insured standard* nem *insured express*.
- **Desligado:** o checkout mostra **uma única opção — insured delivery**, ao
  preço da zona do país de destino.

O preço é sempre calculado no servidor (nunca vem do browser) e a encomenda
guarda o método (`free` ou `insured`).

### 23.3 As cinco zonas

| Zona | Envio segurado |
|---|---|
| Europe | €54 |
| Americas | €48 |
| Asia & Middle East | €60 |
| Africa | €72 |
| Oceania | €85 |

Cada um dos 229 países está atribuído a uma destas cinco zonas, em
`src/lib/shipping.ts`. A tabela em `/shipping` mostra as cinco zonas, o tempo de
trânsito e o preço (ou "Free", quando o envio grátis está ligado).


---

## 24. "Site Exclusive" a laranja e remoção da palavra "insured"

- A etiqueta **Site Exclusive** usa exactamente `#ff9f3d` com tinta escura
  (`#0c1b26`) nas etiquetas, botões e cartões.
- A palavra **insured** foi retirada de todo o site: textos, etiquetas, checkout,
  página de envios, descrições das peças e metadados. Onde fazia sentido passou a
  **"Safe delivery"**, "carefully packed and tracked" ou "protected".
- O método de envio na base de dados passou a `free` / `protected`. Encomendas
  antigas com o valor antigo (`insured`) continuam a mostrar a etiqueta correcta.
- Nos textos editáveis que já estavam gravados na base de dados, a substituição
  foi feita directamente (sem perder o resto do conteúdo). Nos textos por
  omissão no código também.


---

## 25. Porque o cron diário não corria — e como fica

### 25.1 Diagnóstico

- A rota `/api/cron/refresh-prices` está publicada (responde 401 sem segredo).
- A Vercel só envia o segredo ao cron se a variável **`CRON_SECRET`** existir no
  projecto. Sem ela, a Vercel chama a rota todos os dias às 06:00 UTC, mas a rota
  **recusa em silêncio** (401). Não havia registo nenhum, por isso ninguém via.
- O eBay bloqueia servidores (403); o Catawiki lê-se via leitor. Por isso as duas
  peças eBay aparecem como "could not be read" até haver chaves da API do eBay.

### 25.2 O que mudou

- **Histórico de verificações** em `/admin` → cartão *Refresh marketplace
  prices* → **Check history**: cada execução (automática Vercel, agendador
  externo ou manual) fica registada com data (hora de Lisboa), resultado e, se
  for recusada, o motivo exacto. Tabela nova `price_check_runs` (criada sozinha).
- Aviso vermelho **"CRON_SECRET missing in Vercel"** quando a variável não existe.
- **Blindagem eBay:** uma página de "verificação anti-robô" do eBay nunca é lida
  como "anúncio terminado" — antes podia arquivar uma peça viva como vendida.
- **Preços de Site Only protegidos:** numa peça já em Site Only, uma leitura
  incerta do leilão já não reescreve o preço do site. Só um leilão confirmado a
  decorrer devolve a peça ao canal do marketplace.

### 25.3 O que tens de fazer (2 minutos)

1. Vercel → **Settings → Environment Variables** → procurar `CRON_SECRET`.
   - Se não existir: **Add** → nome `CRON_SECRET`, valor = uma frase longa
     inventada (20+ caracteres, só letras e números), ambiente **Production**,
     *Sensitive* ligado → **Save**.
2. **Deployments → ⋯ → Redeploy** (as variáveis só valem após novo deploy).
3. No dia seguinte, `/admin` → *Check history* deve mostrar
   "Automatic (Vercel, daily) · N checked".

### 25.4 Agendador externo (recomendado, mais fiável)

O cron gratuito da Vercel corre uma vez por dia, a uma hora aproximada dentro da
hora marcada. Para várias verificações por dia e um histórico próprio:
**cron-job.org** → *Create cronjob* → URL
`https://mediterranic.vercel.app/api/cron/refresh-prices?secret=O_TEU_CRON_SECRET`
→ a cada 2 ou 3 horas. Aparece no histórico como "external scheduler".


---

## 26. Entrega eBay com chaves de Production já colocadas na Vercel

### Publicar

1. No admin **da loja online**, descarregar **Download backup**.
2. Descompactar `mediterranic-update.zip` e copiar o conteúdo para a pasta local
   do projecto. O ZIP não contém `.env`, `.git`, `node_modules`, base de dados,
   credenciais nem o próprio ZIP dentro de si.
3. GitHub Desktop → **Commit** → **Push origin**. A Vercel cria um deployment
   novo e lê as variáveis já guardadas.
4. Promover para Production se a Vercel o pedir. Não criar outro projecto,
   não mudar o Neon, não voltar a introduzir nem partilhar as chaves.
5. Admin online → cartão **eBay** → **Test eBay API**. O teste consulta um
   anúncio e mostra o resultado, o nome de vendedor devolvido, fotos e preço em
   euros. **Não cria nem altera peças.**
6. **Find my eBay listings** → resultados no próprio cartão eBay → **Import all
   new** ou **Import this**. Depois, **Check prices now** para actualizar as
   peças já existentes. O cron usa o mesmo leitor da API.

### Variáveis que este ZIP usa (só no servidor)

- `EBAY_CLIENT_ID`: App ID da chave **Production**.
- `EBAY_CLIENT_SECRET`: Cert ID do mesmo conjunto de chaves.
- `EBAY_MARKETPLACE_ID`: opcional; por omissão `EBAY_US`.
- `EBAY_SELLER_USERNAME`: opcional, caso o nome da montra não seja o nome de
  utilizador. Também se pode colocar a ligação `/usr/<utilizador>` na caixa de
  pesquisa, em vez de `/str/<montra>`.
- `CRON_SECRET`: continua necessário para autorizar as chamadas do agendador.
  A presença desta variável não prova, por si só, que o cron executou: confirmar
  em **Check history** e nos logs da Vercel.

**Chaves na Vercel não aparecem automaticamente no sandbox de desenvolvimento.**
Se aqui disser "No eBay keys on this deployment", isso não quer dizer que faltem
na Vercel. Testar no admin do deployment onde foram configuradas.

### Garantias de comportamento e limites

- Conta aprovada, chaves detectadas e acesso à API são três verificações
  diferentes. O teste pode mostrar credenciais rejeitadas, keyset desactivado,
  acesso Production recusado (403), limite de chamadas ou artigo inexistente.
  Não se esconde um erro da API atrás da mensagem "o HTML foi bloqueado".
- A pesquisa inclui leilões e preço fixo na categoria Rocks, Fossils & Minerals,
  com filtro de vendedor e exclusão local de material não trilobite.
- O preço do leilão usa o lance actual quando a API o fornece. USD não é
  reetiquetado como EUR: utiliza-se EUR ou `convertedFromValue` explicitamente
  em EUR; sem esse valor, pede-se o preço em euros e preserva-se o preço existente.
- O cron e o botão manual usam **também** as chaves, não apenas a importação.
- Falhas, desaparecimento da montra, página de segurança e artigo terminado
  **não provam venda** e não arquivam nem reescrevem preços automaticamente.
  A API Browse não fornece um recibo da venda; nesse caso, confirmar no eBay e
  marcar a peça no admin. Venda comprovada no Catawiki mantém a regra do arquivo.
- Importações novas só publicam com preço válido, foto e descrição. Incompletas
  ficam em rascunho; nunca recebem um preço inventado do formulário de exemplo.
- O preço **When in Site Only** é definido pelo curador, não preenchido com um
  lance baixo. Se faltar, uma leitura de leilão não vendido deixa o produto
  intacto e pede para preencher esse campo.
- **Check history** distingue execuções completas, parciais e falhadas.

Validação offline (sem eBay, Neon ou credenciais):
`node --test scripts/test-ebay.cjs`

Este ZIP conserva todas as alterações anteriores: etiquetas fora das imagens,
cor Site Exclusive, cores dos mercados, favicon, conteúdos editáveis e envios.
Não faz limpeza em massa, importação nem reposição de textos no arranque.


---

## 27. Revisão geral do deployment 39e76ca e peças que mudam de canal

Relatório detalhado, resultados e limites de teste:
`public/AUDITORIA-39e76ca.md` (também acessível em `/AUDITORIA-39e76ca.md`).

### A regra passa a ser: uma peça física, uma ficha

- Links eBay e Catawiki guardados separadamente, com histórico. O editor tem os
  campos **Saved eBay item URL**, **Saved Catawiki lot URL** e referência.
- Na pesquisa do eBay, uma relistagem pode ser **ligada à ficha existente** por
  **Link / reactivate this specimen**. Não importar outra cópia só porque mudou
  de plataforma ou de ID do anúncio.
- O nome da espécie não basta para juntar peças: o painel pede a escolha. Um
  número de catálogo inequívoco ou um link já guardado pode identificar a ficha.
- A acção confirma o novo canal e conserva fotos, textos e When in Site Only.
  Não termina nem cria anúncios fora do site. Essa gestão continua tua.
- Um anúncio terminado guardado na conta eBay não está activo; só aparecerá como
  oferta activa depois de relistado. A API Browse não é o arquivo do Seller Hub.
- O cron só consulta a plataforma actualmente escolhida. Site Only não regressa
  sozinho ao link antigo de Catawiki, e um eBay antigo não manda sobre Catawiki.
- Quando Catawiki termina sem venda, usa-se **When in Site Only**. Sem esse preço,
  o painel avisa em vez de colocar a peça à venda pelo valor do último lance.
- Se editares enquanto o cron lê uma página, a tua alteração prevalece.
- Os históricos das duas versões de cron foram mantidos e reunidos.

### Outras correcções da revisão

Autenticação do admin no servidor antes de enviar dados, compras directas apenas
em Site Only, idempotência e confirmação transaccional de PayPal, pedido por
factura distinto de pagamento confirmado, precisão dos cêntimos e ajustes das
fotos preservados, favicon do admin respeitado, Statcounter com navegação interna,
249 destinos ISO e manutenção das cinco tarifas, envio grátis único quando activo.

Backup v3 inclui ficheiros de imagens carregadas e encomendas. O restauro é
transaccional e remapeia os IDs das imagens sem substituir ficheiros existentes.
Remover uma peça conserva a ficha como rascunho de arquivo, em vez de apagar
fisicamente reviews ou linhas de encomendas. Nada disto faz updates em massa nos
textos ou repõe os dados do Neon durante o arranque.

A actualização inclui Next.js 16.4.3 e dependências corrigidas. O build tem de
instalar o novo package-lock.json; não publicar apenas um ou dois ficheiros.
Os avisos do log original e as auditorias estão explicados no relatório.

### Publicar

**ZIP TODO** → manter `.git` e `.env` locais → Commit + Push → aguardar build e
promover para Production. As chaves da Vercel mantêm-se. Depois confirmar
**Test eBay API**, associar as relistagens às fichas certas e ver **Check history**.

Os testes no sandbox não usam as tuas chaves de produção. Não foi efectuada
cobrança PayPal real, alteração no Neon ou encerramento de anúncio externo.


---

## 28. Inventário automático: não apenas preços nem revisão diária do catálogo

### O erro que esta entrega corrige

O cron actualizava preços dos links já escolhidos, mas não reconciliava todos os
anúncios activos. Assim, uma peça que regressou de Catawiki a Site Only podia
continuar marcada Site Only quando reaparecia no eBay. O canal guardado e a
presença real de uma oferta não eram a mesma coisa. As contagens também não
usavam um único filtro.

Foi verificado publicamente um exemplo concreto: a página do vendedor Catawiki
mostrava **All lots (1)**; o antigo link Bigotina `107874965` redireccionava para
`108133994`, mantendo a referência **#9629**. Não se alteraram números à mão.

### Rotina normal

- O cron e **Check prices now** passam a executar descoberta e reconciliação de
  inventários, depois preços.
- Ao abrir o admin na Vercel, com chaves eBay presentes e automatização activa,
  inicia-se uma sincronização em falta ou com mais de **15 minutos**.
- O cron da Vercel continua diário às 06:00 UTC e exige CRON_SECRET. No plano
  Hobby não é um processo em tempo real. Para intervalos regulares menores,
  configurar cron-job.org **uma vez**, preferindo Authorization: Bearer ao
  segredo na query string. Isto é configuração inicial, não revisão diária.
- Há um interruptor em **Shipping & payment** para pausar a reconciliação
  automática. O botão explícito **Synchronize inventory now** continua disponível.

### Identidade, relistagens e ofertas activas

Links antigos, referências de catálogo encontradas nas descrições e
redireccionamentos de relistagens são reaproveitados automaticamente.

Sem referência, uma associação confirmada pode guardar uma assinatura do **texto
+ identificador das fotografias originais**. Um novo número eBay com o mesmo
texto/fotos pode então ser reconhecido sem nova confirmação. Se mudarem ambos,
ou se várias fichas partilharem a mesma assinatura, não se adivinha a identidade.
O nome da espécie nunca basta para juntar peças físicas.

Novas referências inequívocas são importadas automaticamente. Só se publicam
com descrição, fotografia e preço EUR confirmado; incompletas ficam em rascunho.
O preço When in Site Only é teu, nunca um lance de €1 inventado pelo programa.

As colunas marketplace_active e marketplace_checked_at distinguem um link
guardado de uma oferta comprovadamente activa. Um inventário completo pode
provar ausência de uma oferta, **não** uma venda: não elimina a ficha, stock,
fotos ou histórico. Leituras parciais/falhadas nunca são gravadas como zero.

### Contagem única e excepções visíveis

Início, cartões de canal, colecções e filtros usam a mesma regra. Arquivo,
rascunhos, stock zero, ausência de canal e ofertas verificadas como inactivas
não contam. O total é a soma Site Only + eBay + Catawiki.

O novo painel **Inventory synchronization** mostra fontes verificadas, data,
valores guardados e avisos pontuais. Em casos ambíguos, ligar a oferta à ficha
existente uma vez. Suspensões cautelares criadas pelo sincronizador podem ser
levantadas automaticamente quando a dúvida deixa de existir; nunca se repõe
uma indisponibilidade manual por adivinhação.

O site mostra a data/estado da última verificação. Neste sandbox, sem chaves da
Vercel, mostra explicitamente que a contagem é uma cópia local, **não** a leitura
actual autenticada do eBay.

### Publicar e testar uma vez

**ZIP TODO**. Antes: Download backup. Copiar o conteúdo mantendo .git/.env;
Commit + Push; promover o novo deployment. As Environment Variables mantêm-se.
Abrir o admin de produção e acompanhar Inventory synchronization. Só permissões,
identidades não inequívocas ou ofertas contraditórias precisam de resolução
pontual — não uma recontagem quase diária feita por ti.

Os testes offline e de base local cobrem 1 Catawiki + várias eBay + 0 Site Only,
execuções repetidas sem duplicar, novos números de anúncio, perda temporária da
API, assinatura texto/fotos, importação completa e conservação dos dados.


---

## 29. Se os anúncios do eBay não sincronizarem

Diagnóstico completo em `public/EBAY-DIAGNOSTICO.md`.

**Sandbox:** sem variáveis `EBAY_*` no ambiente local. Chaves da Vercel não são
copiadas para o sandbox nem para deployments Preview. O painel diz isto
explicitamente.

**Produção com chaves:** a causa mais comum é o nome do vendedor. O código usava
o nome da loja (`ebay.com/str/mederranic`) como `sellers:{…}`, mas um nome de
loja não é obrigatoriamente a conta de vendedor. A eBay responde então HTTP 200
com lista vazia e um **aviso** (código 12003). O código só lia `errors`, pelo que
isso era interpretado como zero anúncios. Já está corrigido: os avisos são
lidos e um resultado vazio com aviso nunca é gravado como inventário vazio.

**Resolver:** admin → *Diagnose eBay API* → se indicar nome inválido, criar
`EBAY_SELLER_USERNAME` na Vercel com o nome real da conta de vendedor e fazer
Redeploy. Em alternativa, colar o URL de um anúncio próprio no diagnóstico para
a loja aprender o `seller.username`.

Outras causas: 403 (acesso Production à Browse API não aprovado), 401
(keyset inválido), mercado diferente de `EBAY_US`, ou indexação recente de um
anúncio novo. Todas são distinguidas no diagnóstico.


---

## 30. Referência de colecção (REF) e bloqueio do keyset eBay

Documento completo: `public/REFERENCIA-E-BLOCKIO-EBAY.md`.

### Bloqueio do keyset

O email da eBay indica que o keyset Production *Mediterranic* está **desactivado**
e precisa de subscrição nas notificações de encerramento de contas do
Marketplace, ou de uma isenção. Sem isso as chaves não autorizam a Browse API.
Activar em developer.ebay.com → Application Keys → seguir o aviso do keyset.
Depois: Redeploy e *Diagnose eBay API*. Enquanto estiver desactivado, o painel
mostra erro de acesso, nunca zero anúncios.

### REF — identificador único

A ficha passa a mostrar, por baixo do título, `PAIS9676 · 9 mm · 456 g` em vez de
*Scientific Species*. A espécie permanece na tabela de características.

Campos novos no editor: **REF · collection reference** e **Weight with box (g)**.
Aceita `PAIS9676` ou `9676`. O núcleo de 4 dígitos é a chave de correspondência,
pelo que uma peça sem prefixo é reconhecida num anúncio com prefixo. Anos não são
confundidos com referências. Uma referência diferente nunca é fundida com outra
peça. Se a REF não for introduzida, a loja tenta aprendê-la do link do anúncio.


---

## 31. "Further from the same shelf", país/marketplace e links obrigatórios

- **"Further from the same shelf" (`src/lib/shelf-recommendations.ts`):** na
  página de cada peça (`/shop/[slug]`), esta secção mostra apenas peças da
  **mesma Era geológica** (`period`, com fallback para a colecção correspondente
  se o período estiver vazio). As peças **disponíveis** aparecem sempre
  primeiro; as peças **Unavailable** passam para o fim e **só são apresentadas
  se não existirem 4 peças disponíveis dessa mesma Era geológica**.
- **Painel de sincronização (`Inventory synchronization` e `Diagnose eBay API`):**
  apresenta sempre o **país/marketplace** activo de cada fonte e a barra de
  **excepções** (distinguindo `feed not verified` de `0 pending`).
- **Instruções para novo chat (`CONTEXTO-NOVO-CHAT.md`):** inclui a regra
  obrigatória de apresentar em **todas** as respostas os links de **Produção** e
  os links actuais de **Sandbox / Preview**.
