> **Actualização posterior:** esta entrega acrescenta reconciliação automática de
> inventário antes dos preços. Ver `INVENTARIO-AUTOMATICO.md`. A primeira revisão
> descrita abaixo não cobria essa descoberta completa, pelo que o build/testes
> anteriores, por si só, não provavam que os canais correspondiam à oferta real.

# Mediterranic — revisão do deployment 39e76ca

## Âmbito e preservação de dados

Revisão do commit master `39e76ca430124d340b78cec7c0b81d898becacf3`, comparação com
as alterações posteriores do sandbox e consulta das páginas públicas da loja.
As rotas privadas de produção responderam 401; não foram usados acessos ao Neon,
credenciais de produção, pagamentos reais nem acções que terminassem anúncios.

Os testes de integração usam apenas a base local, com registos isolados que são
removidos no fim. Foi comparada uma cópia dos campos originais de todas as linhas
locais de peças, textos, encomendas, linhas de encomenda, reviews, subscritores e
imagens: ficaram iguais. As colunas novas são apenas aditivas em UPGRADE_SQL.

## 1. Avisos laranja dos logs da Vercel

O log fornecido terminou com `Build Completed` e `Deployment completed`.
Os avisos não significam que o deployment falhou:

- `Unknown env config "cache-dir"` aparece duas vezes: é uma opção de configuração
  do npm que o ambiente está a fornecer. Não é uma leitura de eBay nem erro de SQL.
  Não foi inventada uma configuração no código para esconder o aviso. Uma futura
  versão do npm/Vercel poderá exigir corrigir essa opção no ambiente.
- `install-scripts ... not yet covered by allowScripts` é um aviso da política de
  scripts de instalação do npm. Não se aprovam scripts desconhecidos em massa.
  O build real passou; uma instalação limpa continua a dever ser validada.
- `packages are looking for funding` é informativo.

Foi encontrada separadamente uma vulnerabilidade crítica na versão Next.js
16.2.6. A revisão actualiza para Next.js 16.4.3, alinha eslint-config-next, corrige
source-map-js e PostCSS e actualiza dependências transitivas compatíveis.

Resultado de `npm audit --omit=dev`: **0 vulnerabilidades conhecidas**.
Auditoria incluindo ferramentas de desenvolvimento: **0 críticas, 0 altas e 21
moderadas**. Estas últimas continuam declaradas; não foram ocultadas com um
`audit fix --force` que pudesse introduzir mudanças incompatíveis.

## 2. Uma peça pode mudar de canal sem se tornar uma peça nova

O problema era guardar um único external_listing_url por peça e considerar um
anúncio "já importado" sem distinguir a plataforma activa. Agora cada peça pode
ter:

- ebay_listing_url;
- catawiki_listing_url;
- marketplace_history (URLs anteriores);
- specimen_reference (número de catálogo, quando conhecido).

O mesmo ID e slug permanecem no ciclo eBay → Catawiki → Site Only → eBay.
Fotografias, descrições, certificados, colecções e preço When in Site Only não
são substituídos quando se liga um anúncio a um registo existente.

### Como usar no admin

1. **Find my eBay listings** mostra anúncios activos.
2. Se reconhecer um link antigo ou referência inequívoca, selecciona o registo
   existente. Se só houver um nome/espécie semelhante, apresenta uma sugestão,
   mas não junta automaticamente duas peças.
3. Escolher a peça existente na lista e usar **Link / reactivate this specimen**.
4. Confirmar a mudança de canal. Não é criada outra ficha.
5. **Create a NEW, distinct specimen** é para uma peça física diferente.

Os botões de canal reutilizam o link correcto guardado para essa plataforma.
Quando falta um link, o editor é aberto com uma explicação; não fica a apontar
para a plataforma errada. Os campos eBay, Catawiki e referência estão no editor.

Uma lista terminada e guardada no Seller Hub não está activa. Deve ser relistada
no eBay para aparecer na pesquisa de anúncios activos. A eBay Browse API não é
um inventário de rascunhos e anúncios terminados guardados na conta.

O nome da montra /str/ pode ser diferente do nome de utilizador. Quando possível,
a pesquisa resolve o vendedor a partir de um anúncio conhecido. Um teste eBay
bem sucedido também actualiza a caixa de pesquisa com o /usr/ devolvido.

## 3. O cron respeita a plataforma activa

- Só verifica peças publicadas, com stock, não arquivadas e cujo canal activo é
  eBay ou Catawiki. Site Only não regressa sozinho a um leilão antigo.
- Uma edição manual de canal, URL, stock ou preço feita durante a leitura vence
  sobre o resultado antigo: o update tem uma condição de concorrência.
- Uma leitura desconhecida, erro 403/404, limite ou ausência de anúncio não prova
  venda e não reescreve preços nem arquiva uma peça.
- Leilão Catawiki comprovadamente vendido: arquivo, sem preço público.
- Não vendido: regressa a Site Only ao valor de When in Site Only. Sem esse valor,
  pede a sua introdução; não usa o último lance como preço de venda directa.
- Reserve price not met com licitação aberta continua a ser leilão activo.
- O orçamento de tempo da execução evita perder o relatório inteiro quando um
  marketplace está lento. Peças não verificadas são indicadas como tal.

Mantiveram-se as duas tabelas de histórico existentes nas versões anteriores:
price_refresh_runs (a do deployment 39e76ca) e price_check_runs. O painel reúne
os registos de ambas; nenhuma tabela foi eliminada.

A hora é **06:00 UTC**: em Lisboa, 06:00 no inverno e 07:00 no verão. O Hobby da
Vercel pode executar dentro da hora agendada. Ter CRON_SECRET configurado não
prova que a execução ocorreu: confirmar o registo real no painel/logs.

## 4. Segurança e integridade

- O servidor verifica a sessão antes de serializar dados do admin. Antes havia
  login visual, mas os dados já podiam estar no HTML.
- Em Vercel, a ausência de ADMIN_PASSWORD falha de forma segura. A palavra-passe
  pública de exemplo não é preenchida em produção.
- O cookie de autenticação é HttpOnly e Secure na Vercel.
- Compras directas só aceitam peças publicadas, em Site Only, com stock e preço.
  Enviar manualmente um slug eBay/Catawiki à API não permite comprá-lo no site.
- PayPal create/capture usa chaves de idempotência. Ordem e stock são bloqueados
  durante a confirmação e uma repetição não desconta stock outra vez.
- Montante, moeda EUR e referência são verificados antes de capturar; a captura
  tem de estar COMPLETED para confirmar. Uma resposta PENDING não é tratada como
  pagamento concluído.
- Uma resposta de rede incerta nunca afirma falsamente "Nothing was charged".
  Uma captura já concluída pode ser reconciliada sem iniciar outra cobrança.
- Pedidos por factura são pending_invoice, não pagamentos confirmados. O site
  distingue pedido recebido e pagamento concluído.
- Ao esgotar uma peça paga, passa ao arquivo. Não é publicada a palavra Sold.
- Os preços privados de Site Only e o histórico de links não vão nas props
  públicas. Peças indisponíveis não levam preço de venda no payload.
- O editor preserva cêntimos, rotação, espelhamento e crop das fotos.
- Remover uma peça retira-a da loja mas conserva a ficha como rascunho de arquivo;
  não elimina reviews nem linhas de encomendas por cascata.

## 5. Funcionalidades anteriores confirmadas

- Emblema + letras MEDITERRANIC mantidos; cabeçalho responsivo.
- Favicon escolhido no admin não é ultrapassado por um SVG fixo. O fallback é o
  M com fundo azul-turquesa das Caraíbas.
- Site Exclusive a #ff9f3d; eBay quatro cores; Catawiki azul; redes sociais com
  os fundos das marcas.
- Etiquetas dos cartões e do arquivo acima das fotografias. Na galeria, o aviso
  e o contador ficam fora da imagem; zoom de rato não dispara em toque.
- Sem a alegação insured na apresentação pública; textos antigos são corrigidos
  apenas na apresentação, sem updates em massa no Neon.
- Envio grátis activado no admin = opção única grátis. Desactivado = tarifa única
  de uma das cinco zonas, sem standard/express.
- 249 destinos ISO, por ordem alfabética. Tarifas preservadas: Europa €54,
  Américas €48, Ásia €60, África €72, Oceânia €85.
- Carrinho segue o interruptor de envio grátis, em vez de prometer sempre grátis.
- A página da encomenda usa a foto real, não um nome de ficheiro que podia dar 404.
- Statcounter restaurado com o projecto fornecido, segue navegação interna e não
  é carregado nas entradas admin, checkout ou encomendas. Pode ser desligado no
  editor. O teste do contador foi simulado, para não poluir as estatísticas reais.
- Conteúdos e fotos continuam editáveis; subscritores e exportação CSV mantidos.
- Backup v3 inclui bytes de fotografias carregadas e encomendas. Restauro é
  transaccional, remapeia IDs de fotos e não sobrescreve um pagamento existente
  com um estado antigo. Backups v1/v2 continuam aceites.
- O domínio por omissão mantém-se mediterranic.vercel.app até ao fim do projecto.
  Se NEXT_PUBLIC_SITE_URL estiver definido na Vercel, esse valor continua a ter
  prioridade: deve corresponder ao endereço realmente em uso.

## 6. Testes realizados

- 23 testes offline: `node --test scripts/test-ebay.cjs scripts/test-audit.cjs`.
- Testes locais reais da base: ciclo completo de canais sem duplicar, precisão
  de preço/fotos, compras não autorizadas por canal, confirmação concorrente,
  arquivo sem preço, factura não paga, backup/restauro com foto e rollback.
- Chromium a 320, 360, 390, 430, 768 e 1440 píxeis: início, loja, arquivo e envios.
- Checkout e editor a 390 px; cinco zonas com envio grátis desligado e opção
  única grátis ligado; 249 opções de país; sem erro JavaScript.
- Interface de relistagem usa o endpoint de ligação, não o de criar peça nova.
- Instância local temporária com autenticação de produção: dados privados não
  aparecem antes de login, APIs devolvem 401 e login abre o painel correctamente.
- Typegen, TypeScript e build de produção.

## 7. Limites que dependem das contas reais

Não foi feita uma cobrança PayPal real nem uma chamada autenticada com as chaves
da tua Vercel. As chaves não existem automaticamente neste sandbox. Depois do
push, usar Test eBay API no admin online e acompanhar Check history para o cron.
Não foram criados nem terminados anúncios fora do site.

A API Browse, sozinha, não prova se um anúncio eBay terminado foi vendido.
Confirmar no eBay antes de arquivar uma venda sem confirmação pela API.

Envio automático de newsletters/emails ainda depende de fornecedor; recolha e
CSV não significam envio de campanhas. Política de privacidade e consentimento
para analytics devem ser revistos antes da abertura definitiva. Backups muito
grandes continuam sujeitos aos limites de transferência da plataforma; manter
igualmente a protecção/backups próprios do Neon.

## 8. Publicar esta revisão

**ZIP TODO**, porque há dependências actualizadas e colunas adicionais.

1. Admin online → Download backup.
2. Copiar o conteúdo do ZIP para o projecto local, mantendo .git e .env.
3. Commit + Push no GitHub Desktop; aguardar novo build na Vercel e promover se
   necessário. As chaves já guardadas continuam nas Environment Variables.
4. Admin online → Test eBay API → Find my eBay listings → ligar as relistagens às
   peças existentes. Rever When in Site Only.
5. Confirmar a próxima execução em Check history. Nenhuma migração apaga dados
   nem repõe os textos do admin.
