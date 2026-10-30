# Mediterranic — guia de publicação

Passo a passo para colocar a loja no ar no seu domínio próprio.

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

1. **PayPal** — ligar a conta PayPal Business (o email já é o de recebimento).
2. **Limitação de pedidos** (*rate limiting*) para proteger o checkout.
3. **Cópias de segurança** — o Neon faz cópias automáticas nos planos pagos.

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

- O catálogo vive em `src/lib/seed-data.ts` e os textos em `src/lib/seed-settings.ts`.
  Tudo o que alterar no back-office tem de ser capturado para esses ficheiros antes
  de um novo deploy, senão é reposto.
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
