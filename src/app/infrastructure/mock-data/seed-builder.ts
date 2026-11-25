import {
  Category,
  ChangeLogEntry,
  Customer,
  Delivery,
  COURIERS,
  Order,
  OrderEvent,
  OrderItem,
  Payment,
  Product,
  Promotion,
  Review,
  StockMovement,
  logEntry,
} from '../../domain/entities';
import { InventoryPolicy, MovementDraft } from '../../domain/services/inventory-policy';
import { orderFlow } from '../../domain/services/order-lifecycle';
import { evaluateCoupon, orderTotal, quotePrice } from '../../domain/services/pricing';
import { Money } from '../../domain/value-objects/money';
import { MzPhone } from '../../domain/value-objects/mz-phone';
import { deliveryOptions, findProvince } from '../../domain/value-objects/shipping';
import {
  DeliveryMethod,
  ORDER_STATUS_LABEL,
  OrderStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '../../domain/value-objects/statuses';
import { CATEGORY_SEED, PRODUCT_SEED, REVIEW_COMMENTS } from './catalog.data';
import { CUSTOMER_SEED, DEMO_PASSWORD } from './customers.data';

export interface DbCollections {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  deliveries: Delivery[];
  stockMovements: StockMovement[];
  promotions: Promotion[];
  reviews: Review[];
}

/** Gerador pseudo-aleatório determinístico (mulberry32) — dados iguais em cada reposição. */
function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p: number) => next() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T>(arr: readonly T[], w: (x: T) => number): T => {
      const total = arr.reduce((s, x) => s + w(x), 0);
      let r = next() * total;
      for (const x of arr) {
        r -= w(x);
        if (r <= 0) return x;
      }
      return arr[arr.length - 1];
    },
  };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (t: number) => new Date(t).toISOString();

interface StockEvent {
  at: number;
  kind: 'entrada' | 'reserva' | 'venda' | 'libertacao';
  productId: string;
  qty: number;
  reason: string;
  orderNumber: string | null;
  by: 'admin' | 'sistema';
}

export function buildSeed(now = new Date(), seed = 20261124): DbCollections {
  const r = prng(seed);
  const nowT = now.getTime();
  const dayStart = (daysAgo: number, hour = 9, minute = 0) => {
    const d = new Date(nowT - daysAgo * DAY);
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  // ---------------- Categorias ----------------
  const categories: Category[] = CATEGORY_SEED.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    description: c.description,
    image: null,
    illustration: { type: c.type, color: c.color },
    active: true,
    sortOrder: i + 1,
    createdAt: iso(dayStart(220)),
    updatedAt: iso(dayStart(220)),
  }));

  // ---------------- Produtos ----------------
  const catCode = (id: string) => id.replace('cat_', '').slice(0, 3).toUpperCase();
  const products: Product[] = PRODUCT_SEED.map((s, i) => {
    const created = dayStart(s.ageDays, 8);
    const history: ChangeLogEntry[] = [logEntry('admin', 'Produto criado', iso(created))];
    if (s.promo) history.push(logEntry('admin', `Preço promocional definido: ${Money.format(s.promo)}`, iso(created + DAY)));
    if (s.inactive) history.push(logEntry('admin', 'Produto desactivado', iso(dayStart(30))));
    const costRatio = 0.42 + r.next() * 0.13;
    return {
      id: `prd_${String(i + 1).padStart(3, '0')}`,
      sku: `XT-${catCode(s.cat)}-${String(i + 1).padStart(3, '0')}`,
      name: s.name,
      description: s.desc,
      features: s.features,
      categoryId: s.cat,
      images: [],
      illustration: { type: s.type, pattern: !!s.local },
      costPrice: Math.round((s.price * costRatio) / 10) * 10,
      price: s.price,
      promoPrice: s.promo,
      stock: 0,
      reserved: 0,
      minStock: s.min,
      variants: { sizes: s.sizes, colors: s.colors },
      status: s.inactive ? 'inactivo' : 'activo',
      madeInMz: !!s.local,
      createdAt: iso(created),
      updatedAt: iso(history[history.length - 1] ? new Date(history[history.length - 1].at).getTime() : created),
      history,
    };
  });
  const seedByProduct = new Map(products.map((p, i) => [p.id, PRODUCT_SEED[i]]));

  // ---------------- Clientes ----------------
  const customers: Customer[] = CUSTOMER_SEED.map((c) => {
    const created = dayStart(c.ageDays, 12);
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      password: DEMO_PASSWORD,
      addresses: [
        {
          id: `adr_${c.id}`,
          label: 'Casa',
          recipient: c.name,
          phone: c.phone,
          province: c.province,
          city: c.city,
          street: c.street,
          reference: c.reference,
          isDefault: true,
        },
      ],
      favorites: [],
      active: c.active !== false,
      createdAt: iso(created),
      updatedAt: iso(created),
    };
  });
  for (const c of customers) {
    const n = r.int(1, 5);
    for (let k = 0; k < n; k++) {
      const p = r.pick(products.filter((x) => x.status === 'activo'));
      if (!c.favorites.includes(p.id)) c.favorites.push(p.id);
    }
  }

  // ---------------- Promoções ----------------
  const promo = (p: Omit<Promotion, 'createdAt' | 'updatedAt'>): Promotion => ({
    ...p,
    createdAt: p.startsAt,
    updatedAt: p.startsAt,
  });
  const promotions: Promotion[] = [
    promo({ id: 'prm_semana', name: 'Ofertas da Semana', description: '−20% em Mulher e Calçado', kind: 'campanha', code: null, discountType: 'percent', value: 20, minSubtotal: 0, scope: 'categories', productIds: [], categoryIds: ['cat_mulher', 'cat_calcado'], startsAt: iso(dayStart(4, 0)), endsAt: iso(dayStart(-6, 23, 59)), active: true, bannerColor: '#1b1715' }),
    promo({ id: 'prm_capulana', name: 'Festival da Capulana', description: '−15% em toda a colecção Capulana', kind: 'campanha', code: null, discountType: 'percent', value: 15, minSubtotal: 0, scope: 'categories', productIds: [], categoryIds: ['cat_capulana'], startsAt: iso(dayStart(20, 0)), endsAt: iso(dayStart(-25, 23, 59)), active: true, bannerColor: '#0b7a5c' }),
    promo({ id: 'prm_aulas', name: 'Regresso às Aulas', description: '−25% em roupa de criança', kind: 'campanha', code: null, discountType: 'percent', value: 25, minSubtotal: 0, scope: 'categories', productIds: [], categoryIds: ['cat_crianca'], startsAt: iso(dayStart(120, 0)), endsAt: iso(dayStart(85, 23, 59)), active: true, bannerColor: '#2f5fb3' }),
    promo({ id: 'prm_bemvindo', name: 'Boas-vindas', description: '10% de desconto na 1ª compra', kind: 'cupao', code: 'BEMVINDO10', discountType: 'percent', value: 10, minSubtotal: 0, scope: 'all', productIds: [], categoryIds: [], startsAt: iso(dayStart(200, 0)), endsAt: iso(dayStart(-365, 23, 59)), active: true, bannerColor: '#d9480f' }),
    promo({ id: 'prm_moz25', name: 'MOZ25', description: '250 MT de desconto acima de 1.500 MT', kind: 'cupao', code: 'MOZ25', discountType: 'fixed', value: 250, minSubtotal: 1500, scope: 'all', productIds: [], categoryIds: [], startsAt: iso(dayStart(100, 0)), endsAt: iso(dayStart(-60, 23, 59)), active: true, bannerColor: '#d9480f' }),
    promo({ id: 'prm_natal', name: 'Natal Xitolo', description: '500 MT de desconto acima de 4.000 MT', kind: 'cupao', code: 'NATAL500', discountType: 'fixed', value: 500, minSubtotal: 4000, scope: 'all', productIds: [], categoryIds: [], startsAt: iso(dayStart(-7, 0)), endsAt: iso(dayStart(-37, 23, 59)), active: true, bannerColor: '#e03131' }),
  ];

  // ---------------- Encomendas, pagamentos, entregas ----------------
  const orders: Order[] = [];
  const payments: Payment[] = [];
  const deliveries: Delivery[] = [];
  const reviews: Review[] = [];
  const stockEvents: StockEvent[] = [];
  const ordersByCustomer = new Map<string, number>();
  let seq = 0;

  for (let d = 90; d >= 0; d--) {
    const expected = 1 + ((90 - d) / 90) * 2.2;
    const count = Math.floor(expected + r.next() * 1.4);
    for (let k = 0; k < count; k++) {
      const createdT = dayStart(d, r.int(8, 21), r.int(0, 59));
      if (createdT > nowT - 20 * 60_000) continue;
      const customer = r.weighted(
        customers.filter((c) => new Date(c.createdAt).getTime() < createdT),
        (c) => (c.active ? CUSTOMER_SEED.find((s) => s.id === c.id)!.weight : 0.2),
      );
      if (!customer) continue;

      // --- linhas ---
      const pool = products.filter(
        (p) => new Date(p.createdAt).getTime() < createdT && (p.status === 'activo' || d > 30) && seedByProduct.get(p.id)!.stock > 0,
      );
      if (!pool.length) continue;
      const nLines = r.weighted([1, 2, 3], (n) => (n === 1 ? 55 : n === 2 ? 30 : 15));
      const items: OrderItem[] = [];
      for (let l = 0; l < nLines; l++) {
        const p = r.weighted(pool, (x) => seedByProduct.get(x.id)!.popularity);
        if (items.some((i) => i.productId === p.id)) continue;
        const q = quotePrice(p, promotions, new Date(createdT));
        items.push({
          productId: p.id,
          sku: p.sku,
          name: p.name,
          categoryId: p.categoryId,
          image: null,
          illustration: p.illustration,
          size: r.pick(p.variants.sizes),
          color: r.pick(p.variants.colors),
          qty: r.chance(0.82) ? 1 : 2,
          listPrice: q.listPrice,
          unitPrice: q.price,
          unitCost: p.costPrice,
        });
      }
      const subtotal = Money.sum(items.map((i) => i.unitPrice * i.qty));

      // --- cupão ---
      const isFirst = !ordersByCustomer.has(customer.id);
      let couponCode: string | null = null;
      let discount = 0;
      const tryCoupon = isFirst && r.chance(0.55) ? 'BEMVINDO10' : r.chance(0.1) ? 'MOZ25' : null;
      if (tryCoupon) {
        const ev = evaluateCoupon(
          tryCoupon,
          promotions,
          items.map((i) => ({ productId: i.productId, categoryId: i.categoryId, lineTotal: i.unitPrice * i.qty })),
          new Date(createdT),
        );
        if (ev.ok) {
          couponCode = tryCoupon;
          discount = ev.discount;
        }
      }
      ordersByCustomer.set(customer.id, (ordersByCustomer.get(customer.id) ?? 0) + 1);

      // --- entrega ---
      const address = customer.addresses[0];
      const province = findProvince(address.province);
      const method: DeliveryMethod = province.metro
        ? r.weighted<DeliveryMethod>(['normal', 'expresso', 'levantamento'], (m) => (m === 'normal' ? 70 : 15))
        : 'normal';
      const option = deliveryOptions(province.name, subtotal).find((o) => o.method === method)!;
      const shippingFee = option.fee;

      // --- pagamento ---
      const operator = MzPhone.parse(customer.phone)!.operator;
      let payMethod: PaymentMethod;
      if (operator === 'Vodacom') payMethod = r.weighted<PaymentMethod>(['mpesa', 'transferencia', 'na_entrega'], (m) => (m === 'mpesa' ? 70 : 15));
      else if (operator === 'Movitel') payMethod = r.weighted<PaymentMethod>(['emola', 'transferencia', 'na_entrega'], (m) => (m === 'emola' ? 70 : 15));
      else payMethod = r.pick<PaymentMethod>(['transferencia', 'na_entrega']);
      if (payMethod === 'na_entrega' && !province.metro) payMethod = 'transferencia';

      seq++;
      const created = new Date(createdT);
      const number = `XT-${String(created.getFullYear()).slice(2)}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}-${String(1000 + seq * 37).slice(-4)}`;
      const orderId = `ord_${String(seq).padStart(4, '0')}`;
      const total = orderTotal(subtotal, discount, shippingFee);
      const expectedBy = (() => {
        const e = new Date(createdT + option.etaDays * DAY);
        e.setHours(20, 0, 0, 0);
        return e.getTime();
      })();

      // --- linha temporal ---
      const history: OrderEvent[] = [
        { at: iso(createdT), by: 'cliente', status: 'pendente', message: 'Encomenda criada' },
      ];
      const payHistory: ChangeLogEntry[] = [logEntry('sistema', 'Pagamento iniciado', iso(createdT))];
      let paymentStatus: Payment['status'] = 'pendente';
      let confirmedAt: number | null = null;
      let status: OrderStatus = 'pendente';
      let t = createdT;
      let cancelledAt: number | null = null;
      let deliveredAt: number | null = null;
      let dispatchedAt: number | null = null;
      let readyAt: number | null = null;

      const flow = orderFlow(method);
      const late = r.chance(0.15);
      const paymentFails = (payMethod === 'mpesa' || payMethod === 'emola') && r.chance(0.05);
      const transferNeverPaid = payMethod === 'transferencia' && r.chance(0.1);
      const customerCancels = !paymentFails && !transferNeverPaid && r.chance(0.05);

      // pagamento
      if (payMethod === 'mpesa' || payMethod === 'emola') {
        const pt = createdT + r.int(1, 6) * 60_000;
        if (pt <= nowT) {
          if (paymentFails) {
            paymentStatus = 'rejeitado';
            payHistory.push(logEntry('sistema', 'Pagamento recusado pelo operador (PIN não confirmado)', iso(pt)));
            cancelledAt = pt + 60_000;
          } else {
            paymentStatus = 'confirmado';
            confirmedAt = pt;
            payHistory.push(logEntry('sistema', `Pagamento confirmado por ${PAYMENT_METHODS[payMethod].label}`, iso(pt)));
          }
        }
      } else if (payMethod === 'transferencia') {
        const pt = createdT + r.int(3, 30) * HOUR;
        if (transferNeverPaid) {
          if (createdT + 3 * DAY <= nowT) cancelledAt = createdT + 3 * DAY;
        } else if (pt <= nowT) {
          paymentStatus = 'confirmado';
          confirmedAt = pt;
          payHistory.push(logEntry('admin', 'Transferência confirmada no extracto bancário', iso(pt)));
        }
      }

      const canAdvance = (at: number) =>
        cancelledAt === null && at <= nowT && (payMethod === 'na_entrega' || (confirmedAt !== null && confirmedAt <= at));

      if (customerCancels) {
        const ct = createdT + r.int(1, 10) * HOUR;
        if (ct <= nowT) cancelledAt = ct;
      }

      // avançar estados
      const stepDurations: Record<OrderStatus, () => number> = {
        pendente: () => 0,
        confirmada: () => (payMethod === 'na_entrega' ? r.int(1, 3) * HOUR : r.int(10, 60) * 60_000),
        em_preparacao: () => r.int(1, 5) * HOUR,
        pronta_envio: () => r.int(1, 4) * HOUR,
        em_transito: () => r.int(1, 3) * HOUR,
        saiu_entrega: () => Math.max(HOUR, (option.etaDays - 1) * DAY * (late ? 1.5 : 0.55 + r.next() * 0.3)),
        entregue: () => (late ? r.int(20, 40) : r.int(1, 4)) * HOUR,
        cancelada: () => 0,
      };
      for (const step of flow.slice(1)) {
        let at = t + stepDurations[step]();
        if (step === 'confirmada' && confirmedAt) at = Math.max(at, confirmedAt + 5 * 60_000);
        if (step === 'entregue' && method === 'levantamento') at = t + r.int(4, 48) * HOUR;
        if (cancelledAt !== null && at > cancelledAt) break;
        if (!canAdvance(at)) break;
        t = at;
        status = step;
        if (step === 'pronta_envio') readyAt = at;
        if (step === 'em_transito') dispatchedAt = at;
        if (step === 'entregue') deliveredAt = at;
        history.push({
          at: iso(at),
          by: step === 'confirmada' && payMethod !== 'na_entrega' ? 'sistema' : 'admin',
          status: step,
          message: ORDER_STATUS_LABEL[step],
        });
      }

      // cancelamento (só antes do envio)
      if (cancelledAt !== null && cancelledAt <= nowT && ['pendente', 'confirmada', 'em_preparacao', 'pronta_envio'].includes(status)) {
        status = 'cancelada';
        const reason = paymentFails
          ? 'Cancelada automaticamente: pagamento recusado'
          : transferNeverPaid
            ? 'Cancelada: transferência não recebida em 72h'
            : 'Cancelada a pedido do cliente';
        history.push({ at: iso(cancelledAt), by: customerCancels ? 'cliente' : paymentFails ? 'sistema' : 'admin', status: 'cancelada', message: reason });
        if (paymentStatus === 'confirmado') {
          paymentStatus = 'reembolsado';
          payHistory.push(logEntry('admin', 'Valor reembolsado ao cliente', iso(cancelledAt + 2 * HOUR)));
        } else if (paymentStatus === 'pendente') {
          paymentStatus = 'rejeitado';
          payHistory.push(logEntry('sistema', 'Pagamento anulado — encomenda cancelada', iso(cancelledAt)));
        }
      } else {
        cancelledAt = null;
      }

      if (payMethod === 'na_entrega' && deliveredAt) {
        paymentStatus = 'confirmado';
        confirmedAt = deliveredAt;
        payHistory.push(logEntry('sistema', 'Valor cobrado na entrega', iso(deliveredAt)));
      }

      // stock
      for (const i of items) {
        stockEvents.push({ at: createdT, kind: 'reserva', productId: i.productId, qty: i.qty, reason: 'Reserva para encomenda', orderNumber: number, by: 'sistema' });
        if (deliveredAt) stockEvents.push({ at: deliveredAt, kind: 'venda', productId: i.productId, qty: i.qty, reason: 'Encomenda entregue', orderNumber: number, by: 'sistema' });
        if (cancelledAt) stockEvents.push({ at: cancelledAt, kind: 'libertacao', productId: i.productId, qty: i.qty, reason: 'Encomenda cancelada', orderNumber: number, by: 'sistema' });
      }

      const lastT = Math.max(...history.map((h) => new Date(h.at).getTime()));
      orders.push({
        id: orderId,
        number,
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        items,
        subtotal,
        discount,
        couponCode,
        shippingFee,
        shippingCost: option.cost,
        total,
        deliveryMethod: method,
        address: method === 'levantamento' ? null : address,
        paymentMethod: payMethod,
        status,
        stockState: deliveredAt ? 'consumido' : cancelledAt ? 'libertado' : 'reservado',
        expectedBy: iso(expectedBy),
        createdAt: iso(createdT),
        updatedAt: iso(lastT),
        history,
      });

      const fee = paymentStatus === 'confirmado' ? Money.percentOf(total, PAYMENT_METHODS[payMethod].feePercent) : 0;
      payments.push({
        id: `pay_${String(seq).padStart(4, '0')}`,
        reference: `PG${String(createdT).slice(-8)}`,
        orderId,
        orderNumber: number,
        customerId: customer.id,
        customerName: customer.name,
        method: payMethod,
        amount: total,
        fee,
        status: paymentStatus,
        phone: payMethod === 'mpesa' || payMethod === 'emola' ? customer.phone : null,
        createdAt: iso(createdT),
        confirmedAt: confirmedAt ? iso(confirmedAt) : null,
        updatedAt: payHistory[payHistory.length - 1].at,
        history: payHistory,
      });

      // A entrega é registada pelo administrador quando a encomenda fica pronta para envio.
      if (method !== 'levantamento' && readyAt) {
        const dStatus = status === 'cancelada' ? 'cancelada' : deliveredAt ? 'concluida' : dispatchedAt ? 'em_curso' : 'pendente';
        const courier = r.pick(province.metro ? COURIERS.slice(0, 3) : COURIERS.slice(3));
        const dHistory: ChangeLogEntry[] = [logEntry('admin', `Entrega registada e atribuída a ${courier}`, iso(readyAt))];
        if (dispatchedAt) dHistory.push(logEntry('admin', 'Saída do armazém', iso(dispatchedAt)));
        if (deliveredAt) dHistory.push(logEntry('admin', 'Entrega concluída', iso(deliveredAt)));
        if (status === 'cancelada' && cancelledAt) dHistory.push(logEntry('sistema', 'Entrega cancelada', iso(cancelledAt)));
        deliveries.push({
          id: `dlv_${String(seq).padStart(4, '0')}`,
          orderId,
          orderNumber: number,
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone,
          address,
          method,
          fee: shippingFee,
          cost: option.cost,
          courier,
          status: dStatus,
          expectedBy: iso(expectedBy),
          dispatchedAt: dispatchedAt ? iso(dispatchedAt) : null,
          completedAt: deliveredAt ? iso(deliveredAt) : null,
          createdAt: iso(readyAt),
          updatedAt: dHistory[dHistory.length - 1].at,
          history: dHistory,
        });
      }

      // avaliações
      if (deliveredAt && r.chance(0.45)) {
        const it = r.pick(items);
        const at = deliveredAt + r.int(1, 4) * DAY;
        if (at <= nowT && !reviews.some((rv) => rv.customerId === customer.id && rv.productId === it.productId)) {
          const rating = r.weighted([5, 4, 3, 2], (x) => ({ 5: 50, 4: 30, 3: 13, 2: 7 })[x]!);
          reviews.push({
            id: `rev_${String(reviews.length + 1).padStart(4, '0')}`,
            productId: it.productId,
            customerId: customer.id,
            customerName: customer.name,
            orderId,
            rating,
            comment: r.pick(REVIEW_COMMENTS[rating]),
            createdAt: iso(at),
          });
        }
      }
    }
  }

  // ---------------- Inventário: entradas e reprodução cronológica ----------------
  for (const p of products) {
    const s = seedByProduct.get(p.id)!;
    const evs = stockEvents.filter((e) => e.productId === p.id);
    const sold = evs.filter((e) => e.kind === 'venda').reduce((a, e) => a + e.qty, 0);
    const res = evs.filter((e) => e.kind === 'reserva').reduce((a, e) => a + e.qty, 0);
    const rel = evs.filter((e) => e.kind === 'libertacao').reduce((a, e) => a + e.qty, 0);
    const finalReserved = res - rel - sold;
    const needed = sold + finalReserved + s.stock;
    const created = new Date(p.createdAt).getTime();
    const restock = s.ageDays > 40 && needed > 20 ? Math.round(needed * 0.35) : 0;
    if (needed - restock > 0) {
      stockEvents.push({ at: created + HOUR, kind: 'entrada', productId: p.id, qty: needed - restock, reason: 'Stock inicial — fornecedor', orderNumber: null, by: 'admin' });
    }
    if (restock > 0) {
      stockEvents.push({ at: created + Math.floor((nowT - created) / 2), kind: 'entrada', productId: p.id, qty: restock, reason: 'Reposição — fornecedor', orderNumber: null, by: 'admin' });
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const drafts: MovementDraft[] = [];
  const order = { entrada: 0, reserva: 1, libertacao: 2, venda: 3 } as const;
  stockEvents.sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind]);
  for (const e of stockEvents) {
    let p = byId.get(e.productId)!;
    const ctx = { reason: e.reason, orderNumber: e.orderNumber, by: e.by, at: iso(e.at) } as const;
    if (e.kind === 'reserva' && p.stock - p.reserved < e.qty) {
      // Reposição de emergência para manter o histórico coerente.
      const fix = InventoryPolicy.entry(p, e.qty - (p.stock - p.reserved) + 10, { ...ctx, reason: 'Reposição urgente — fornecedor', orderNumber: null, by: 'admin' });
      p = fix.product;
      drafts.push(fix.movement);
    }
    const ch =
      e.kind === 'entrada'
        ? InventoryPolicy.entry(p, e.qty, ctx)
        : e.kind === 'reserva'
          ? InventoryPolicy.reserve(p, e.qty, ctx)
          : e.kind === 'libertacao'
            ? InventoryPolicy.release(p, e.qty, ctx)
            : InventoryPolicy.consume(p, e.qty, ctx);
    byId.set(p.id, { ...ch.product, updatedAt: p.updatedAt });
    drafts.push(ch.movement);
  }
  const finalProducts = products.map((p) => byId.get(p.id)!);
  const stockMovements: StockMovement[] = drafts.map((m, i) => ({ ...m, id: `mov_${String(i + 1).padStart(5, '0')}` }));

  return {
    products: finalProducts,
    categories,
    customers,
    orders: orders.reverse(),
    payments: payments.reverse(),
    deliveries: deliveries.reverse(),
    stockMovements: stockMovements.reverse(),
    promotions,
    reviews,
  };
}
