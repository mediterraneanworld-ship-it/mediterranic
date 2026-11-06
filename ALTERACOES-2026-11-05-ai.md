# Mediterranic — 2026-11-05-ai

## Corrigido
- O espelhamento público passa a verificar os bytes/SHA-256 das fotografias e a ligar as capas, logo, favicon e galerias aos uploads locais correctos.
- Uploads existentes nunca são sobrescritos. Uma segunda execução reutiliza as imagens verificadas.
- Leituras incompletas preservam os dados locais e ficam assinaladas como não verificadas.
- O script só aceita PostgreSQL em localhost/127.0.0.1/::1; recusa Neon ou qualquer outro host remoto.
- `/api/uploads/N` usa ETag e revalidação, evitando que o browser guarde para sempre uma imagem alterada.
- MEDITERRANIC no rodapé permanece numa linha, com tamanho adaptado à coluna.
- As caixas H9 sem link próprio usam as ligações reais das definições da loja; foram removidos destinos de exemplo.

## Limites honestos
- Páginas públicas não expõem rascunhos, preços privados, encomendas, subscritores ou todas as preferências do admin. Para uma cópia privada completa, usar Download backup no admin de produção.
- A tradução ainda não foi implementada. País não determina língua; a proposta é preferência manual guardada, idioma do navegador como sinal principal e país apenas como apoio, com revisão dos textos e cuidado com SEO, privacidade e custos.

## Publicar
1. Fazer Download backup no admin de produção.
2. Copiar a src completa do ZIP, sem merge; manter .env e .git.
3. Copiar public/, scripts/, package.json, package-lock.json e vercel.json do ZIP.
4. Executar npm install, validação e Commit + Push pelo GitHub Desktop.
5. Confirmar /api/version e guardar /sos.

Não foram feitas compras, envios de e-mail, alterações ao Neon ou deploy de produção a partir da sandbox.
