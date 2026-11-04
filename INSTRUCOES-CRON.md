# Mediterranic — CRON_SECRET já existe: o que fazer

Versão de código: 2026-11-03-s.
Contexto SOS actualizado: https://mediterranic.vercel.app/sos (após deploy).
Produção: https://mediterranic.vercel.app
Admin: https://mediterranic.vercel.app/admin
Versão: https://mediterranic.vercel.app/api/version

## 1. Não criar outra variável

Se CRON_SECRET já tem Production seleccionado, mantém a variável e o valor.
Production + Preview é uma configuração válida. Vercel agenda os cron jobs
apenas no deploy de Production; escolher Preview para a variável não cria
outro agendamento.

- Não apagues nem regeneres o segredo para resolver a mensagem «já existe».
- Se precisas de corrigir o âmbito, edita a variável existente.
- Para Production, deixa o filtro de branch Git vazio.
- Não publiques o valor no GitHub, em screenshots ou no chat.
- Se alteraste variáveis, faz um novo deploy Production. O Commit + Push
  deste código pode ser esse deploy; não precisas de outro redeploy depois.
- Se nada mudou e o deploy já tem a variável, não precisas de a voltar a guardar.

## 2. Publicar sem perder conteúdo

Antes do push, faz Download backup no admin de produção.

O ZIP contém código completo, sem .env, .git, node_modules ou .next.
Mantém o teu .env e .git. Apaga a src local e copia a src do ZIP.
Confirma também que o vercel.json da raiz é o do ZIP: contém os dois jobs.
Faz Commit + Push. O conteúdo no Neon não é substituído pelos dados do sandbox.

Esta versão usa a newsletter do master publicado (1590c26): preserva o
interruptor automático, seleção manual, tokens de unsubscribe e histórico.
Não liga o envio automático nem envia um teste durante o deploy.

## 3. Confirmar os agendamentos

Vercel → projecto mediterranic → Settings → Cron Jobs:

| Endpoint | Expressão | Horário UTC |
| --- | --- | --- |
| /api/cron/refresh-prices | 0 6 * * * | 06:00 diariamente |
| /api/cron/newsletter | 0 7 * * * | 07:00 diariamente |

Confirma que Cron Jobs não está desactivado no projecto. Se o segundo job
não aparece, verifica o vercel.json no commit publicado e o deploy Production.
Os horários são UTC. No plano Hobby, a chamada pode ocorrer em qualquer
momento da hora indicada; não necessariamente ao minuto zero.

Vercel envia automaticamente Authorization: Bearer seguido do CRON_SECRET
existente. Não precisas de configurar esse cabeçalho dentro da Vercel.

## 4. Confirmar a newsletter

Admin → tab 4 Newsletter:

1. «Check configuration» verifica se o segredo está disponível nesse deploy,
   sem revelar o valor e sem enviar e-mails.
2. Para autorizar os envios automáticos, activa o interruptor
   «Automatic sending (daily check, every 15 days)» quando estiveres pronto.
   Não o ligues apenas para testar o diagnóstico.
3. O cron só envia com o automático ligado e quando passaram 15 dias desde
   o último envio entregue, incluindo envios parciais. Sem envio anterior,
   o próximo cron pode enviar se o automático estiver ligado.
4. Ainda são necessários destinatários confirmados, peças disponíveis e o
   fornecedor de e-mail configurado. Um segredo presente não prova entrega.

Verifica a execução em Vercel → Cron Jobs → View Logs e no histórico da
newsletter. «Check configuration» é seguro; «Run», «Send now» e «Send anyway»
podem realmente contactar os subscritores — não os uses só para testar o segredo.

## 5. cron-job.org (só se já utilizas)

A Vercel NÃO actualiza o segredo guardado no cron-job.org. Se um job externo
está a dar 401, edita esse job e coloca no cabeçalho Authorization o texto
Bearer seguido de um espaço e do mesmo valor CRON_SECRET da Vercel.
Mantém a URL de produção, sem incluir o segredo no URL.

Não cries um segundo cron externo para a newsletter se a Vercel já a agenda.
Escolhe um único agendador para evitar chamadas simultâneas. Guardar o segredo
na Vercel, por si só, não corrige o cabeçalho de um job externo existente.

## Domínio

Links novos dos e-mails e imagens locais usam https://mediterranic.vercel.app.
shop.mediterranic.com não é usado. mediterranic.com só será adoptado no fim
mediante a alteração deliberada de src/lib/site-url.ts. Mensagens antigas
já entregues não são alteradas por um deploy.

Documentação: https://vercel.com/docs/cron-jobs/manage-cron-jobs
