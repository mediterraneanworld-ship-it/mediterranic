# “Could not start the PayPal payment” — porque acontece e como confirmar

## O sintoma

O comprador preenche o checkout, carrega em **Pay with PayPal** e vê:

> *Could not start the PayPal payment. Please try again.*

Nenhuma cobrança é feita quando isto acontece — a falha é **antes** de o PayPal
criar a ordem. Mas a frase é genérica: esconde a causa real.

## A causa mais provável: desencontro sandbox / live

No **developer.paypal.com**, os separadores **Sandbox** e **Live** (dentro de
*My Apps & Credentials*) têm **apps e credenciais diferentes**. Um Client Secret
Sandbox **não** funciona na API live (`api-m.paypal.com`) nem ao contrário: o
PayPal recusa o pedido do token com `invalid_client` (HTTP 401).

Se as chaves forem *Live* mas a loja estiver a falar com a API Sandbox (porque
`PAYPAL_ENVIRONMENT` ficou por definir e o padrão era sandbox), o pagamento
nunca arranca — e o checkout só podia mostrar a frase genérica.

## O que foi corrigido no código

1. **Erros classificados.** O módulo PayPal distingue:
   - `PAYPAL_AUTH_FAILED` — credenciais recusadas (`invalid_client`),
   - `PAYPAL_ORDER_REJECTED` — o PayPal recusou a ordem (com o código dele,
     ex.: `DUPLICATE_INVOICE_ID`, e o `debug_id`),
   - `PAYPAL_UNAVAILABLE` — não foi possível falar com o PayPal.
   O checkout mostra ao comprador uma frase calma (“no charge was made”, com a
   saída da factura), e a resposta traz também `code` + `detail` com a causa
   exacta para diagnóstico.
2. **Detecção automática do ambiente.** Sem `PAYPAL_ENVIRONMENT`, a loja pede
   o token ao Sandbox e, **só se o PayPal rejeitar as credenciais como
   inválidas**, tenta o Live. Credenciais Sandbox nunca obtêm token Live (e
   vice-versa), por isso isto não consegue cobrar dinheiro real por engano —
   só elimina a falha clássica “chaves live, padrão sandbox”.
3. **Diagnóstico no admin.** `/admin` → **PayPal connection** → **Diagnose
   PayPal API**: pede um token no ambiente que a loja usaria e, se for
   rejeitado, também no outro. Diz em linguagem simples o que corrigir.
   Cria **zero** encomendas e **zero** cobranças.

## O que deves confirmar (2 minutos)

| Verificação | Onde |
|---|---|
| As chaves são de que ambiente? | developer.paypal.com → *My Apps & Credentials* → separador **Sandbox** ou **Live** |
| Client ID e Secret são da mesma app? | Na mesma página/app; não misturar uma app com o secret de outra |
| `PAYPAL_ENVIRONMENT` | Vercel → *Settings → Environment Variables* (Production): `live` para chaves Live, `sandbox` para testes |
| Mudaste variáveis? | Fazer **Redeploy** — variáveis novas só entram em vigor num deploy novo |
| Confirmar | `/admin` → **Diagnose PayPal API** deve dizer “token issued” no ambiente certo |

Para testar sem dinheiro real: chaves **Sandbox** + `PAYPAL_ENVIRONMENT=sandbox`,
e pagar com uma conta de comprador *sandbox* (developer.paypal.com → Sandbox →
Accounts). Para cobrar a sério: chaves **Live** + `PAYPAL_ENVIRONMENT=live`.

## O que não foi feito a partir do sandbox de desenvolvimento

- Não foram usadas as tuas chaves reais nem lidos segredos de produção.
- Não foi criada nenhuma ordem PayPal real.
- O comportamento foi verificado com testes offline (credenciais falsas:
  rejeição `invalid_client` classificada, detecção Live automática, rejeição de
  ordem com o código do PayPal, sumário sem segredos) — total **47 testes** a
  passar.
