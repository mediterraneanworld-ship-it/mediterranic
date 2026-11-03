# Mediterranic — publicar a actualização eBay

## Este ZIP substitui o conteúdo do projecto

1. No admin online, descarregar **Download backup**.
2. Descompactar o ZIP e copiar o conteúdo para a pasta local do projecto,
   substituindo ficheiros com o mesmo caminho. **Não apagar a pasta do projecto,
   a pasta `.git` ou o `.env` local.**
3. GitHub Desktop → **Commit** → **Push origin**. A Vercel gera o novo deployment.
4. Promover para Production se necessário.
5. No admin da loja publicada → cartão eBay → **Test eBay API**.
6. Se o teste confirmar acesso: **Find my eBay listings** → escolher a ficha existente → **Link / reactivate this specimen**. Para peças físicas novas, escolher **Create a NEW, distinct specimen**.
7. Para preços de peças existentes: **Check prices now**. O cron diário usa o
   mesmo leitor da API; a sua execução fica em **Check history**.

## Credenciais

As chaves já guardadas na Vercel não precisam de ser copiadas para ficheiros:
- `EBAY_CLIENT_ID` = App ID de Production
- `EBAY_CLIENT_SECRET` = Cert ID do mesmo keyset

Guardar variáveis não altera um deployment já em execução: fazer um novo deploy
ou Redeploy. Não criar variáveis duplicadas e não usar `NEXT_PUBLIC_` para segredos.

O teste distingue chaves detectadas de acesso efectivo. A eBay pode exigir
activar o keyset ou aprovar acesso Production à API. O painel mostra esse erro;
não é preciso enviar nenhuma chave pelo chat.

## Dados e domínio

O ZIP não inclui `.env`, `.git`, base de dados ou credenciais. Um deployment não
repõe o catálogo nem os textos do admin. O seed só preenche uma base vazia. As
actualizações de estrutura são aditivas em `src/lib/schema-migrate.ts`.

Não executar os scripts de espelho de desenvolvimento contra o Neon de produção.
A leitura pública é parcial e não substitui o backup autenticado.

O domínio actual não é alterado. `mediterranic.com` continua no site antigo até
à decisão de mudança, no fim do projecto.

## Desenvolvimento e testes

As chaves da Vercel não existem automaticamente no sandbox de desenvolvimento.
"No eBay keys on this deployment" aqui não significa que faltem na Vercel.

Testes offline (sem rede ou escritas na base):
`node --test scripts/test-ebay.cjs`

O site e os novos controlos foram testados em Chromium a 320, 360, 390, 430 e
1440 píxeis. O teste de ligação real às tuas chaves tem de ser feito no admin da
Vercel depois de publicar.


## Revisão do ciclo eBay → Catawiki → site → eBay

Esta versão guarda links separados e histórico por peça. Não cria uma segunda
ficha para uma relistagem conhecida. Só o canal activo é verificado pelo cron.

Lê o relatório completo em `public/AUDITORIA-39e76ca.md`. Esta entrega exige o
ZIP TODO, incluindo package.json e package-lock.json (Next.js corrigido e novas
colunas idempotentes). Nenhum dado do Neon é reposto a partir do sandbox.


## Esta entrega: inventário realmente reconciliado

O cron não verifica só preços: procura ofertas activas, reconhece relistagens e
actualiza canais com identidade segura. O admin de produção inicia outra
verificação se a última tiver mais de 15 minutos. O fluxo normal não é rever as
peças diariamente.

Uma confirmação inicial ambígua fica lembrada por links/referência e, quando
possível, pela assinatura do texto e fotografias. Falhas de leitura mostram
"not verified", não zero. O sandbox sem chaves contém contagens locais antigas,
identificadas como tal — o teste real autenticado será na Vercel.

Ver `public/INVENTARIO-AUTOMATICO.md` e secção 28 do guia.


## Se não sincronizar

1. Confirmar que as chaves existem **no ambiente que estás a testar**. O sandbox
   local não as tem; um deployment Preview precisa das suas.
2. Admin → *Diagnose eBay API*: mostra chaves, marketplace, nome de vendedor
   enviado, nº de anúncios e avisos da eBay.
3. Se o nome de vendedor for o da loja (`/str/…`), definir
   `EBAY_SELLER_USERNAME` na Vercel com a conta real e redeployar.
4. Correr *Synchronize inventory now* e confirmar em *Inventory synchronization*.

Ver `public/EBAY-DIAGNOSTICO.md`.
