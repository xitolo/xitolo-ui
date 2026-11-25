# Xitolo — E-commerce de moda para Moçambique

Plataforma de comércio electrónico com **loja online** e **painel administrativo**. Funciona totalmente no frontend, com dados mockados persistentes, e está preparada para trocar os repositórios mockados por um backend REST.

> “Xitolo” quer dizer *loja*. Evolução do MVP *Xiluva*.

## Como correr

```bash
npm install
npm start            # http://localhost:4200  (loja)
                     # http://localhost:4200/admin  (painel)
npm test             # testes de regras de negócio e casos de uso (Vitest)
npm run build        # build de produção → dist/xitolo
npx ng build --configuration demo   # build com rotas # para alojamento estático
```

Requisitos: Node 22+, Angular CLI 22.

### Contas de demonstração

| Perfil | Email | Palavra-passe |
|---|---|---|
| Cliente | `ana@exemplo.co.mz` (ou `joao.sitoe@…`, `celia.n@…`) | `xitolo123` |
| Administrador | `admin@xitolo.co.mz` | `admin123` |

Cupões: `BEMVINDO10` (10%), `MOZ25` (250 MT acima de 1.500 MT). `NATAL500` está agendado.
No painel: menu do perfil → **Repor dados de demonstração**.

## Stack

Angular 22 · TypeScript · standalone components · Signals · RxJS · Reactive Forms · Router (lazy loading) · SCSS · Vitest. Sem bibliotecas de UI nem de gráficos: os gráficos são componentes SVG próprios.

## Arquitectura

```
src/app/
├── domain/                 regras de negócio puras (sem Angular)
│   ├── entities/           Product, Category, Customer, Order, Payment, Delivery, StockMovement, Promotion, Review
│   ├── value-objects/      Money (MZN), MzPhone, DateRange, estados, províncias/entregas
│   ├── services/           pricing, inventory-policy, order-lifecycle, finance
│   ├── repositories/       contratos (classes abstractas = tokens de DI)
│   └── dtos.ts             DTOs de formulários / futura API
├── application/            casos de uso e estado (signals)
│   ├── catalog.store.ts    produtos, categorias, promoções, avaliações
│   ├── sales.store.ts      encomendas + pagamentos + entregas (sincronizados)
│   ├── inventory.store.ts  movimentos de stock
│   ├── customer.store.ts
│   ├── order-pricing.service.ts   preço único usado no carrinho, checkout e encomenda
│   ├── catalog-queries.service.ts modelo de leitura (preço efectivo, rating, vendidos)
│   └── reporting.service.ts       indicadores e relatórios
├── infrastructure/
│   ├── persistence/mock-database.ts   "servidor" em localStorage (+ sincronização entre separadores)
│   ├── repositories/                  repositórios mockados com latência simulada
│   ├── mappers/                       DTO ↔ entidade, normalização
│   ├── mock-data/                     seed determinístico e coerente
│   └── providers.ts                   provideMockRepositories()
├── core/                   sessão, carrinho, favoritos, toasts, confirmações, guards
├── shared/                 componentes (cartão, imagem, timeline, gráficos, paginação…), pipes, validadores
├── layouts/                storefront-layout, admin-layout
└── features/
    ├── storefront/         home, products, cart, checkout, customer-account, orders, auth, help
    └── admin/              dashboard, products, categories, orders, customers, payments, deliveries, inventory, promotions, reports
```

Os componentes nunca tocam nos dados mockados: dependem das stores, que dependem dos contratos de repositório.

### Ligar a um backend REST

1. Criar `HttpProductRepository extends ProductRepository` (etc.) com `HttpClient`.
2. Criar `provideHttpRepositories()` e substituir `provideMockRepositories()` em `app.config.ts`.
3. Remover `password` de `Customer` e mover a autenticação para o servidor (o `SessionService` é a única peça a alterar).

## Regras de negócio

**Stock** (`domain/services/inventory-policy.ts`)
- Disponível = físico − reservado.
- Encomenda criada → **reserva**; cancelada → **libertação**; entregue → **saída por venda** (físico e reservado descem).
- Cada encomenda tem `stockState` (`reservado → libertado | consumido`) e só transita uma vez: o mesmo produto nunca é descontado duas vezes.
- Entradas, saídas manuais e ajustes ficam no histórico; uma saída manual não pode usar unidades reservadas.

**Encomendas** (`order-lifecycle.ts`)
- Fluxo: Pendente → Confirmada → Em preparação → Pronta para envio → Em trânsito → Saiu para entrega → Entregue (levantamento salta o transporte). Cancelada só antes do envio.
- Encomendas pré-pagas (M-Pesa, e-Mola, transferência) só avançam com o pagamento confirmado; a confirmação do pagamento confirma a encomenda automaticamente.
- Não é possível pôr em trânsito sem entrega registada (responsável, custo, prazo).
- Cada linha guarda o snapshot do produto (nome, preço de tabela, preço cobrado e custo) no momento da compra.

**Pagamentos**: estados Pendente, Confirmado, Rejeitado, Reembolsado. O pagamento na entrega é confirmado quando a encomenda é entregue. Cancelar uma encomenda paga marca o pagamento como reembolsado; se estiver pendente, é anulado.

**Preços**: o preço efectivo é o menor entre o preço de venda, o preço promocional do produto e cada campanha activa (as campanhas não se acumulam). Os cupões aplicam-se no checkout, por cima do preço efectivo.

**Modelo financeiro** (`finance.ts`, calculado sempre a partir dos registos)

| Indicador | Definição |
|---|---|
| Valor vendido | Σ total das encomendas não canceladas |
| Valor recebido | Σ pagamentos confirmados |
| Valor pendente | Σ pagamentos pendentes de encomendas activas |
| Receita bruta | Σ (produtos + taxa de entrega) das encomendas pagas, antes de descontos |
| Receita líquida estimada | bruta − cupões − comissões (1,5% M-Pesa/e-Mola) − IVA incluído (16%) |
| Lucro estimado | líquida − custo dos produtos vendidos − custo operacional das entregas |

Encomendas pendentes ou canceladas nunca contam como receita recebida.

## Dados mockados

`buildSeed()` gera de forma determinística 6 categorias, 32 produtos, 14 clientes, 6 promoções e cerca de 180 encomendas dos últimos 90 dias, com os respectivos pagamentos, entregas, avaliações e movimentos de stock. As encomendas são geradas com as mesmas regras de domínio da aplicação, e os testes verificam que o stock final é exactamente o resultado do histórico de movimentos.

A persistência é feita em `localStorage` (`xitolo:db:v1`). Com a loja e o painel abertos em dois separadores, as alterações feitas num aparecem no outro.

## Testes

`npm test` corre 17 testes, em `domain/services/domain-rules.spec.ts` e `application/sales.store.spec.ts`. Cobrem a coerência do seed, as reservas e a saída única de stock, os preços e cupões, as transições de estado, o reembolso, o pagamento na entrega, a exigência de entrega registada e a regra de que alterar um preço não altera encomendas já feitas.

## Limitações conhecidas

- Não há autenticação real, porque não existe servidor.
- O stock é controlado por produto e não por variante (tamanho/cor).
- As imagens são guardadas como data URL no `localStorage` (cerca de 5 MB por navegador). Sem fotografias, a loja mostra ilustrações vectoriais.
