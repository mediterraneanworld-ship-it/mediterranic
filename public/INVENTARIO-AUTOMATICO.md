# Inventário automático — correcção da discrepância dos canais

## O que estava errado

A rotina anterior verificava preços dos links já guardados. Não era uma
reconciliação completa das ofertas activas. Por isso, fichas que tinham voltado
a Site Only podiam ficar nesse canal quando reapareciam no eBay. Ter um URL
Catawiki/eBay guardado também não provava que a oferta continuava activa.

A loja publicada consultada ainda usava o commit 39e76ca e devolvia 6 fichas
marcadas direct e 2 eBay. Estes são os valores guardados, não uma confirmação
independente da distribuição real que o proprietário descreveu.

Foi lida a página pública actual do vendedor Catawiki: inventário completo com
1 lote activo, https://www.catawiki.com/en/l/108133994. O antigo link Bigotina
107874965 redireccionava para esse lote, mantendo #9629. Esta relistagem pode
ser reconhecida sem uma revisão manual do proprietário.

Não foram inventadas contagens nem usados acessos ao Neon de produção.

## O que passa a ser automático

1. Ler os inventários activos eBay e Catawiki.
2. Aprender referências nos anúncios anteriormente associados à ficha.
3. Reconhecer links e redireccionamentos de relistagens.
4. Reconhecer referências estáveis de catálogo nas descrições.
5. Quando não há referência, recordar uma identidade confirmada de texto +
   fotografias originais. Outro item ID eBay com essa mesma assinatura pode ser
   ligado à mesma ficha sem repetir a confirmação.
6. Mudar o canal de uma ficha conhecida sem substituir fotos, descrição,
   certificados ou preço When in Site Only.
7. Importar automaticamente referências novas inequívocas. Só publicar com
   fotografia, descrição e preço EUR; incompletas ficam em rascunho.
8. Verificar presença real da oferta, separadamente do canal/link guardado.
9. Actualizar preços e tratar fechos comprovados, preservando as regras do arquivo.
10. Calcular todos os números com o mesmo filtro, no início e na loja.

Uma simples espécie igual não prova que duas peças físicas são a mesma coisa.
Uma identidade incerta ou duas ofertas concorrentes são excepções visíveis,
não motivo para pedir uma recontagem diária de todo o catálogo.

## Quando executa

- No cron diário já configurado (06:00 UTC).
- No botão Check prices now, que agora inclui inventário antes dos preços.
- Automaticamente ao abrir o admin na Vercel, se a última execução tiver mais
  de 15 minutos, as chaves estiverem presentes e a automatização activa.
- No botão Synchronize inventory now, quando for preciso uma execução imediata.

O plano Hobby da Vercel não oferece cron a cada poucos minutos. Para polling
regular mais frequente sem depender de visitas ao admin, configurar uma vez um
agendador externo, como cron-job.org. Não é uma revisão manual diária e também
não se promete propagação em tempo real entre marketplaces.

## O que não se adivinha

- API bloqueada, inventário parcial, username de loja não confirmado ou falha
  de rede não significam zero peças.
- Anúncio terminado guardado na conta eBay não significa anúncio activo.
- Oferta ausente não prova venda: não se apaga a ficha nem se arquiva como vendida.
- Uma peça já arquivada/sem stock não é ressuscitada automaticamente só por
  aparecer uma oferta contraditória.
- Não se usa um lance de €1 como preço de venda directa quando falta When in Site Only.
- Se mudarem simultaneamente a referência, o texto e as fotos, pode ser precisa
  uma nova identificação; o programa não tem como provar sozinho a identidade física.

## Como ver o estado

Admin → Inventory synchronization: última execução, fontes verificadas,
contagens guardadas, contagens efectivamente lidas e apenas avisos pontuais.

As páginas públicas mostram a data/estado de verificação. Neste sandbox as
chaves eBay da Vercel não estão disponíveis: a distribuição local é identificada
como snapshot, não como leitura autenticada do inventário actual do eBay.

## Dados e instalação

As adições de schema são idempotentes: inventory_sync_state, marketplace_active
e marketplace_checked_at. A aprendizagem de identidade guarda metadados em
colunas/histórico próprios, sem reescrever textos ou fotografias do catálogo.

ZIP TODO → backup primeiro → copiar mantendo .env/.git → Commit + Push →
promover na Vercel se solicitado. As chaves já guardadas na Vercel continuam lá.
Abrir o admin de produção e acompanhar a primeira sincronização; não introduzir
manualmente números nos contadores.

## Testes realizados

- 35 testes offline, incluindo contagem única, parser de inventário activo,
  redireccionamento #9629, ausência versus erro, correspondências inequívocas,
  assinaturas de fotografia/texto, arquivo e fechos de leilão.
- Base local com fichas isoladas: 4 em Site Only passam automaticamente a
  1 Catawiki + 3 eBay + 0 Site Only.
- Segunda execução sem duplicar nem repetir revisão de identidade.
- Outro número eBay reconhecido por referência e, noutro caso, por assinatura
  confirmada de texto/fotos, sem novo pedido manual.
- Falha de API preserva dados e declara fonte não verificada.
- Oferta terminada deixa de contar como activa sem ser marcada como vendida.
- Nova referência importada com fotografia e publicada; execução repetida sem duplicar.
- Uma dúvida resolvida uma vez deixa de suspender fichas não relacionadas.
- Browser em 320, 360, 390, 430, 768 e 1440 px, contagens da home/filtros/backend
  iguais, checkout e autenticação sem regressões.
- Comparação dos campos originais das tabelas locais: preservados. Os dados
  de produção só foram consultados por páginas públicas, nunca escritos.

As chamadas eBay autenticadas reais têm de correr na Vercel, onde estão as chaves.
Os testes do sandbox não são apresentados como prova de acesso à conta real.
