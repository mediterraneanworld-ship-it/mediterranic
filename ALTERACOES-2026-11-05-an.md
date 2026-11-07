# MEDITERRANIC — recuperação 2026-11-05-an

## Base recuperada
- GitHub: https://github.com/mediterraneanworld-ship-it/mediterranic, branch master.
- Commit: 04eed7c50f74d3180947bb41a4ec20c3b4baa1b9.
- Versão publicada confirmada: 2026-11-05-am. Esta entrega NÃO foi publicada em produção.
- Os 139 ficheiros de src foram recuperados sem merge. O diretório inicial continha apenas o template Next.js.
- Ambiente local preservado; DATABASE_URL confirmado como PostgreSQL em 127.0.0.1. Nenhuma ligação ao Neon de produção.

## Alterações desta entrega
- CODE_VERSION/manifesto, links de sandbox/ZIP e SOS atualizados para 2026-11-05-an.
- Next.js 16.4.5 e PostCSS 8.5.32; dependências do espelho instaladas pelo gestor de pacotes. Auditoria das dependências de produção: zero vulnerabilidades. Avisos restantes da árvore de desenvolvimento não foram ocultados nem corrigidos com force.
- pull-live.cjs acrescenta pertenças às coleções somente depois de verificar a página pública completa e o filtro exacto. Falhas preservam dados; não apaga escolhas privadas nem reimporta peças eliminadas.
- Correcção real no checkout: o efeito do diálogo invoice estava depois de retornos condicionais e provocava React #310 com carrinho persistido. Todos os hooks ficam agora antes dos retornos.
- Estados de captura/cancelamento PayPal derivados dos parâmetros de retorno; redirecionamento por location.assign. ESLint do componente sem erros. Nenhuma compra ou captura real foi executada.
- Nenhum redesenho, tradução ou alteração a conteúdo publicado. Regras de inventário, PayPal live, invoice, newsletter, reviews, shipping e administração preservadas.

## Espelhamento público local
- Tabelas preparadas com ensureSchema, apenas CREATE/ALTER aditivos.
- Comando: node scripts/pull-live.cjs https://mediterranic.vercel.app
- Resultado final: 9 peças, 18 páginas, 48 referências fotográficas verificadas por SHA-256; quatro filtros de coleção verificados e seis pertenças aditivas; zero falhas.
- Primeira execução: 10 uploads locais novos e 38 referências reutilizadas. Repetição: zero uploads novos e 48 referências reutilizadas. Nenhum ID de upload sobrescrito.
- Não é um backup privado: drafts, encomendas, subscritores e decisões privadas não são expostos pelas páginas públicas.
- Nenhuma compra, captura PayPal, newsletter ou e-mail real foi executado.

## Validação confirmada
- node --test scripts/test-*.cjs: 174 testes, 174 aprovados, zero falhas.
- ESLint de src/components/checkout-form.tsx: sem erros.
- npm audit --omit=dev: zero vulnerabilidades.
- check-sandbox-recovery.cjs: 36 verificações de páginas/larguras, incluindo 320/360/390/430 px e desktop 1440 px; zero overflow horizontal e zero erros React.
- Carrinho Site Only persistido abre checkout; campos obrigatórios impedem confirmação incompleta; diálogo invoice aceita nota e fecha em Back. Nenhuma encomenda submetida.
- Moderação local: pending oculto → approved público → rejected oculto, registo preservado. Apenas o fixture descartável foi removido; produtos, settings e reviews existentes permaneceram iguais.
- check-admin-products-browser.cjs: ordem Unavailable, Publish/Unpublish, validação inline, Save & publish, confirmação DELETE e eliminação de fixtures passaram.
- check-admin-products.cjs: publicação consistente, preço/link obrigatórios, recibos e moderação preservados, bloqueio por pagamento em curso e backup/restore de histórico passaram.
- check-home-archive-editor.cjs: cartões H12 sem links, arquivo com links, Make cover, linhas H0–H13, edição mobile e controlos de ordem passaram. Galeria e textos locais restaurados.
- Capa The Connoisseur: HTTP 307 com Location relativo. Upload: ETag presente e pedido condicional HTTP 304.
- build_and_start passou durante a recuperação. A sequência final obrigatória (next typegen, tsc --noEmit, npm run build e build_and_start) é repetida depois das últimas alterações, antes da entrega.
- Build/healthcheck não demonstram execução de cron, entrega de e-mail, nem estado do keyset eBay. Esses pontos precisam dos logs/configuração do proprietário; não foram inferidos.

## Publicação
Antes de um push grande, fazer Download backup no admin de produção.
Substituir src inteira pela src do ZIP; manter .env e .git. Copiar public, scripts, package.json, package-lock.json e configurações necessárias. Executar npm install. O ZIP não contém segredos, dados privados, dependências instaladas ou caches.
Commit + Push no GitHub Desktop publica pela Vercel. Esta recuperação NÃO foi publicada em produção.
Confirmar a versão publicada depois do deploy. O conteúdo do Neon não deve ser substituído pelo espelho local.
O plano Hobby é destinado a uso pessoal/não comercial; avaliar Pro para a atividade comercial da loja antes da publicação final.

## Ligações
- Produção: https://mediterranic.vercel.app
- Admin: https://mediterranic.vercel.app/admin
- Versão: https://mediterranic.vercel.app/api/version
- SOS: https://mediterranic.vercel.app/sos
- Sandbox: https://3000-i3mms58r4mwfxae0ms0ww.e2b.app
- Admin sandbox: https://3000-i3mms58r4mwfxae0ms0ww.e2b.app/admin
- Versão sandbox: https://3000-i3mms58r4mwfxae0ms0ww.e2b.app/api/version
- SOS sandbox: https://3000-i3mms58r4mwfxae0ms0ww.e2b.app/sos
- ZIP: https://3000-i3mms58r4mwfxae0ms0ww.e2b.app/downloads/mediterranic-2026-11-05-an.zip
Os links de sandbox e ZIP são temporários. GitHub e SOS publicado são referências duradouras.
