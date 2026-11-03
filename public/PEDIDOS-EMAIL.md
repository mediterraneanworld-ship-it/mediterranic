# Email ao proprietário quando entra uma encomenda

## Comportamento

Quando uma nova encomenda é gravada com sucesso, o servidor envia um email de
notificação para **mediterranean.world@gmail.com**, incluindo referência,
estado, tipo de pagamento, cliente, morada, itens, total e link para o admin.

- **Invoice / métodos alternativos:** enviado assim que a encomenda é registada;
  o assunto e o corpo indicam que está **por pagar**.
- **PayPal:** enviado depois de o PayPal criar a ordem e o link de aprovação;
  indica **awaiting buyer approval**, não pagamento confirmado.
- O email é apenas uma notificação ao proprietário: falha do fornecedor não
  desfaz nem bloqueia a encomenda.
- A chave de idempotência do Resend usa a referência da encomenda; retries do
  mesmo pedido não duplicam o email.
- Se faltar configuração ou o Resend rejeitar o envio, a encomenda continua
  guardada e o motivo fica nos logs da função Vercel (**Functions → Logs**).
- A alteração do estado/envio/tracking não envia email ao comprador; o tracking
  fica disponível na página pública da encomenda.

## Activar no deployment de produção

O código está preparado, mas este sandbox não tem uma chave Resend e não acede
às variáveis secretas da Vercel. Para começar a receber avisos:

1. Criar/usar uma conta em **https://resend.com**.
2. Verificar um domínio de envio no Resend (DNS SPF/DKIM). Não uses um endereço
   `@gmail.com` como remetente da API; a Resend exige um remetente de um domínio
   que controlas/verificaste.
3. Criar uma API key no Resend.
4. Vercel → projecto → **Settings → Environment Variables**. Criar para
   **Production** (All Branches):

   | Variável | Valor |
   |---|---|
   | `RESEND_API_KEY` | API key Resend (`re_…`) — segredo, só servidor |
   | `RESEND_FROM_EMAIL` | Remetente verificado, por exemplo `Mediterranic Orders <orders@teudominio-verificado>` |
   | `ORDER_NOTIFICATION_EMAIL` | Opcional. Destinatário. Por omissão já é `mediterranean.world@gmail.com` |

5. **Redeploy Production**. Não é preciso publicar outro ZIP para gravar segredos.
6. Admin de produção → **Received Orders** → **Send test e-mail**. Confirma que
   chega a `mediterranean.world@gmail.com` (ver também Spam). Este botão usa as
   variáveis exactas do deployment e **não cria encomenda nem altera stock**.
7. Depois de o teste chegar, uma encomenda invoice ou PayPal criada envia o aviso
   automaticamente. Se falhar, vê o erro no admin e nos logs da função Vercel;
   nunca copies a API key para logs, código, browser ou este chat.

## Segurança

A API key só é lida por `src/lib/order-notifications.ts` no servidor. Nunca é
exposta a uma rota pública, componente cliente ou variável `NEXT_PUBLIC_*`.
Os dados de comprador são enviados apenas no email pedido pelo proprietário e
para o destinatário configurado.
