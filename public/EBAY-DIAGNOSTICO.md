# Porque é que os anúncios do eBay não sincronizavam — e como confirmar

## 1. O sandbox nunca podia funcionar

Verifiquei o ambiente de desenvolvimento: **não tem variáveis `EBAY_*`**. Apenas
`DATABASE_URL`.

Chaves guardadas na Vercel aplicam-se só aos ambientes onde foram gravadas.
Um sandbox local ou um deployment **Preview** não as herda de Production. O
painel passa a dizer isto explicitamente, em vez de deixar perceber que a
sincronização falhou por falta de chaves.

## 2. A causa mais provável em produção: o nome do vendedor

O código usava o nome da loja do URL:

```
https://www.ebay.com/str/mederranic  →  sellers:{mederranic}
```

**Um nome de loja eBay (`/str/…`) não é obrigatoriamente o nome de conta do
vendedor.** A loja pode ter um nome de exibição diferente do `seller username`
que a API exige no filtro `sellers:{…}`.

Quando o nome está errado, a API do eBay **não devolve erro**: responde HTTP
200 com uma lista vazia e um aviso (*warning*). O meu código só olhava para
`errors`, pelo que interpretava isso como “zero anúncios”.

### O bug corrigido

- A resposta da API passa a ser lida também nos avisos (`warnings`), incluindo o
  código 12003 “seller username is invalid”.
- Um resultado vazio acompanhado de aviso deixa de ser tratado como inventário
  vazio: passa a erro explícito, com o nome usado e a acção a tomar.
- Se o nome da loja não puder ser confirmado como conta de vendedor, a
  sincronização declara “não verificado”, nunca zero.

## 3. Como descobrir o nome correcto

Escolhe uma das vias:

1. **Qualquer anúncio teu activo.** Abre o anúncio no eBay. O identificador do
   vendedor aparece na página (“Informações do vendedor” / seller ID). É esse o
   valor a usar.
2. **Conta eBay.** Definições → Conta → Dados da conta / nome de utilizador.
3. **Deixar a loja aprender.** No admin, em *Diagnose eBay API*, cola o URL de
   **um anúncio teu activo** e corre o diagnóstico. A API devolve o
   `seller.username` real desse anúncio; a loja passa a usá-lo.

## 4. O que fazer

### Passo A — diagnóstico (30 segundos, nada é escrito)

Admin → separador 1 → **Diagnose eBay API** (substitui o antigo “Test eBay API”).

Devolve, sem gravar nada:

- se as chaves estão presentes **neste** deployment;
- o marketplace usado;
- o nome de vendedor enviado;
- quantos anúncios activos a eBay devolveu;
- os avisos da eBay, com código e texto;
- uma conclusão em linguagem simples.

### Passo B — corrigir o nome do vendedor

Na Vercel → *Settings → Environment Variables*, cria:

```
EBAY_SELLER_USERNAME = o nome real da conta de vendedor
```

Depois **Redeploy**. O painel mostra quando este override está activo.

### Passo C — validar

Corre de novo **Diagnose eBay API**. Se devolver anúncios, corre
**Synchronize inventory now**. A partir daí o cron diário e a abertura do admin
usam o mesmo leitor.

## 5. Outras causas possíveis, por ordem

| Sintoma no diagnóstico | Causa | Solução |
|---|---|---|
| `configured: false` | chaves não existem neste deployment | gravar também para Preview/Sandbox, ou testar em Production |
| Aviso 12003 / “seller username invalid” | nome de loja em vez de conta de vendedor | `EBAY_SELLER_USERNAME` |
| HTTP 403 | a eBay não aprovou acesso Production à Browse API | ver conta de developer; chaves activas não garantem permissão |
| HTTP 401 | token/chaveset inválido | confirmar App ID e Cert ID do mesmo keyset Production, redeploy |
| Zero anúncios, sem avisos | nome correcto mas sem anúncios activos | se relistaste agora, a eBay pode demorar vários minutos a indexar |
| Zero anúncios, com aviso de categoria | peças fora de “Rocks, Fossils & Minerals” | o código tenta pesquisa por palavra-chave; confirmar categoria/marketplace |

## 6. Marketplace

O padrão é `EBAY_US`. Se os teus anúncios estiverem noutro marketplace
(`ebay.es`, `ebay.co.uk`…), define `EBAY_MARKETPLACE_ID` (ex.: `EBAY_ES`) e
redeploy. O diagnóstico mostra o marketplace em uso.

## 7. O que não mudei

- Não criei nem terminei anúncios fora da loja.
- Não escrevi na base de dados de produção.
- Não inventei nomes de vendedor nem contagens.
- As páginas públicas do eBay estão bloqueadas a servidores (403), por isso não
  consegui confirmar publicamente qual é o teu nome de conta. É exactamente por
  isso que o diagnóstico existe: para responderes com dados reais em vez de eu
  adivinhar.

## 8. Testes

Adicionados três testes de regressão: avisos da eBay devolvidos como erro,
pesquisa válida com anúncios e total, e rejeição de um nome de loja como nome
de vendedor. Total: **38 testes** offline, todos a passar, mais os testes de base
local e de browser.
