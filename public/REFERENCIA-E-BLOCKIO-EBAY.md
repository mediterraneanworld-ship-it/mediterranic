# Referência de colecção (REF) e o bloqueio do keyset eBay

## Parte 1 — O email da eBay explica porque não sincroniza

O email recebido diz o essencial:

> *Added Production keyset Mediterranic, (App ID: MiguelPa-M…9121)*
> *Please note that the keyset is currently disabled and you need to either
> subscribe to eBay Marketplace Account Deletion/Closure notifications or apply
> for an exemption to enable it.*

**Um keyset desactivado não funciona, por mais correctas que estejam as
variáveis.** As chaves existem, o token até pode ser emitido, mas a eBay recusa
as chamadas à Browse API. Não é o nome do vendedor nem o código: é isto.

### Como activar (só tu o podes fazer)

1. Entrar em **developer.ebay.com** com a conta `mediterranean.world`.
2. Ir a **My Account → Application Keys** (ou o link directo do email).
3. Na chave *Mediterranic* (Production), aparece o aviso de keyset desactivado.
4. Seguir o link **Marketplace Account Deletion/Closure notifications** e
   escolher **uma** das vias:
   - **Subscribe**: fornecer um endpoint de notificação. A forma mais simples é
     usar um endpoint público que responda 200 (por exemplo um webhook de teste
     ou um serviço como webhook.site), porque a eBay só valida que responde.
   - **Apply for an exemption**: se não guardares dados de contas eBay, pedir
     isenção. Demora mais porque é análise manual.
5. Depois de activo, **Redeploy** na Vercel (as variáveis já lá estão) e correr
   **Diagnose eBay API**.

### Como confirmar que ficou activo

O diagnóstico passa a devolver anúncios em vez de erro. Enquanto o keyset estiver
desactivado, deve mostrar um erro de acesso (403/401) — nunca zero anúncios.
Se aparecer zero anúncios *sem* erro, aí sim é nome de vendedor ou marketplace.

## Parte 2 — Referência de colecção (REF), o identificador único

Implementado como pediste: um número que identifica a peça em todas as
plataformas, independentemente do nome, da foto ou do texto.

### O que aparece na ficha

Directamente **por baixo do título**, em vez de *Scientific Species*:

```
PAIS9676 · 9 mm · 456 g
```

- A referência em maiúsculas, com espaçamento largo.
- Depois o comprimento e o peso, separados por uma **bolinha dourada**
  (span decorativo, `aria-hidden`, sem poluir leitores de ecrã).
- Se faltar o peso ou o comprimento, a linha encurta sozinha em vez de mostrar
  separadores vazios.
- A espécie continua disponível na tabela de características, juntamente com o
  novo campo **Weight**.

### Como se preenche

No editor da peça, no bloco *One specimen, separate marketplace links*:

- **REF · collection reference** — aceita `PAIS9676` ou `9676`.
- **Weight with box (g)** — novo campo.

Se não preencheres a REF ao importar, a loja tenta aprendê-la do link do anúncio
(URL do tipo `/9676-…`, `#9676`, `PAIS9676` no título, ou campos `REF:`/`SKU:`).

### Como é usada no reconhecimento

Este é o "dois em um" que anteviste:

- `PAIS9676` e `9676` têm o **mesmo núcleo de 4 dígitos**, por isso uma peça
  guardada sem prefixo é reconhecida num anúncio com prefixo, e vice-versa.
- Um ano (2024, 2026…) **nunca** é confundido com uma referência.
- A referência tem prioridade sobre nome e fotografia no reconhecimento de
  relistagens. Se a referência não existir, o sistema continua a usar links
  guardados e, em último caso, a assinatura de texto + fotografias.
- Uma referência **diferente** nunca é fundida com outra peça: se o eBay mostrar
  `PAIS9677` e a ficha for `9676`, não são a mesma peça.

### Limites honestos

- Isto só funciona se a referência existir na ficha. Nas 11 peças actuais ela
  está vazia, por isso o reconhecimento ainda depende de links guardados.
- Se mudares o sistema de numeração, as referências antigas deixam de
  corresponder.
- A extracção automática depende de a eBay/Catawiki devolverem o número no
  texto. Quando não devolvem, é necessária uma identificação manual pontual.

## Testes

Adicionados dois testes: extracção da referência em prefixo, número simples,
URL, `REF:`/`SKU:` e rejeição de anos; e correspondência entre peça sem prefixo e
anúncio com prefixo. Total: **40 testes** offline a passar, mais os de base local
e de browser.
