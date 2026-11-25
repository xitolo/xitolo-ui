import { Category } from '../entities/category';
import { Delivery, isDeliveryLate } from '../entities/delivery';
import { Order, orderCost } from '../entities/order';
import { Payment } from '../entities/payment';
import { DateRange, inRange, startOfDay, toIsoDate } from '../value-objects/date-range';
import { Money } from '../value-objects/money';
import { PAYMENT_METHODS, PaymentMethod, OrderStatus, ORDER_STATUS_LABEL } from '../value-objects/statuses';

/**
 * Modelo financeiro (todas as métricas são calculadas a partir dos registos —
 * nada é guardado em duplicado).
 *
 *  Valor vendido      Σ total das encomendas não canceladas.
 *  Valor recebido     Σ pagamentos com estado "confirmado".
 *  Valor pendente     Σ pagamentos "pendente" de encomendas não canceladas.
 *  Receita bruta      Σ (produtos + taxas de entrega) das encomendas pagas, antes de descontos.
 *  Deduções           descontos de cupão + comissões de pagamento + IVA incluído (16%).
 *  Receita líquida    receita bruta − deduções.
 *  Lucro estimado     receita líquida − custo dos produtos vendidos − custo operacional das entregas.
 *
 * Encomendas pendentes ou canceladas nunca entram como receita recebida.
 */
export const VAT_RATE = 0.16;

export interface FinancialSummary {
  ordersCount: number;
  activeOrdersCount: number;
  soldValue: number;
  receivedValue: number;
  pendingValue: number;
  refundedValue: number;
  rejectedValue: number;
  cancelledValue: number;
  cancelledCount: number;
  grossRevenue: number;
  discounts: number;
  paymentFees: number;
  vat: number;
  netRevenue: number;
  productCost: number;
  deliveryCost: number;
  estimatedProfit: number;
  averageOrderValue: number;
  paidOrdersCount: number;
}

export function paymentByOrder(payments: readonly Payment[]): Map<string, Payment> {
  // Se uma encomenda tiver várias tentativas, prevalece a mais recente.
  const m = new Map<string, Payment>();
  for (const p of [...payments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) m.set(p.orderId, p);
  return m;
}

export function computeFinancialSummary(
  orders: readonly Order[],
  payments: readonly Payment[],
  deliveries: readonly Delivery[],
  range: DateRange,
): FinancialSummary {
  const scoped = orders.filter((o) => inRange(o.createdAt, range));
  const ids = new Set(scoped.map((o) => o.id));
  const active = scoped.filter((o) => o.status !== 'cancelada');
  const cancelled = scoped.filter((o) => o.status === 'cancelada');
  const payMap = paymentByOrder(payments.filter((p) => ids.has(p.orderId)));
  const deliveryByOrder = new Map(deliveries.map((d) => [d.orderId, d]));

  const paid = active.filter((o) => payMap.get(o.id)?.status === 'confirmado');
  const scopedPayments = [...payMap.values()];
  const sumPay = (st: Payment['status'], onlyActive = false) =>
    Money.sum(
      scopedPayments
        .filter((p) => p.status === st)
        .filter((p) => !onlyActive || active.some((o) => o.id === p.orderId))
        .map((p) => p.amount),
    );

  const grossRevenue = Money.sum(paid.map((o) => o.subtotal + o.shippingFee));
  const discounts = Money.sum(paid.map((o) => o.discount));
  const paymentFees = Money.sum(paid.map((o) => payMap.get(o.id)?.fee ?? 0));
  const vat = Money.round(((grossRevenue - discounts) * VAT_RATE) / (1 + VAT_RATE));
  const netRevenue = grossRevenue - discounts - paymentFees - vat;
  const productCost = Money.sum(paid.map(orderCost));
  const deliveryCost = Money.sum(paid.map((o) => deliveryByOrder.get(o.id)?.cost ?? o.shippingCost));
  const soldValue = Money.sum(active.map((o) => o.total));

  return {
    ordersCount: scoped.length,
    activeOrdersCount: active.length,
    soldValue,
    receivedValue: sumPay('confirmado'),
    pendingValue: sumPay('pendente', true),
    refundedValue: sumPay('reembolsado'),
    rejectedValue: sumPay('rejeitado'),
    cancelledValue: Money.sum(cancelled.map((o) => o.total)),
    cancelledCount: cancelled.length,
    grossRevenue,
    discounts,
    paymentFees,
    vat,
    netRevenue,
    productCost,
    deliveryCost,
    estimatedProfit: netRevenue - productCost - deliveryCost,
    averageOrderValue: active.length ? Money.round(soldValue / active.length) : 0,
    paidOrdersCount: paid.length,
  };
}

// ---------------- Séries temporais ----------------
export type Granularity = 'day' | 'week' | 'month';

export interface SeriesPoint {
  key: string;
  label: string;
  sold: number;
  received: number;
  orders: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function bucketStart(d: Date, g: Granularity): Date {
  const x = startOfDay(d);
  if (g === 'week') {
    const dow = (x.getDay() + 6) % 7; // segunda-feira = 0
    x.setDate(x.getDate() - dow);
  }
  if (g === 'month') x.setDate(1);
  return x;
}

function nextBucket(d: Date, g: Granularity): Date {
  const x = new Date(d);
  if (g === 'day') x.setDate(x.getDate() + 1);
  if (g === 'week') x.setDate(x.getDate() + 7);
  if (g === 'month') x.setMonth(x.getMonth() + 1);
  return x;
}

function bucketLabel(d: Date, g: Granularity): string {
  if (g === 'month') return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function salesSeries(
  orders: readonly Order[],
  payments: readonly Payment[],
  range: DateRange,
  g: Granularity,
): SeriesPoint[] {
  const firstOrder = orders.reduce<string | null>((min, o) => (!min || o.createdAt < min ? o.createdAt : min), null);
  const from = firstOrder && new Date(firstOrder) > range.from ? new Date(firstOrder) : range.from;
  const to = range.to > new Date() ? new Date() : range.to;
  const points = new Map<string, SeriesPoint>();
  for (let d = bucketStart(from, g); d <= to; d = nextBucket(d, g)) {
    const key = toIsoDate(d);
    points.set(key, { key, label: bucketLabel(d, g), sold: 0, received: 0, orders: 0 });
  }
  const keyOf = (iso: string) => toIsoDate(bucketStart(new Date(iso), g));

  for (const o of orders) {
    if (o.status === 'cancelada' || !inRange(o.createdAt, range)) continue;
    const pt = points.get(keyOf(o.createdAt));
    if (pt) {
      pt.sold += o.total;
      pt.orders += 1;
    }
  }
  for (const p of payments) {
    if (p.status !== 'confirmado' || !p.confirmedAt || !inRange(p.confirmedAt, range)) continue;
    const pt = points.get(keyOf(p.confirmedAt));
    if (pt) pt.received += p.amount;
  }
  return [...points.values()];
}

// ---------------- Agregações ----------------
export interface RankRow {
  id: string;
  label: string;
  qty: number;
  value: number;
}

export function topProducts(orders: readonly Order[], range: DateRange, limit = 10): RankRow[] {
  const m = new Map<string, RankRow>();
  for (const o of orders) {
    if (o.status === 'cancelada' || !inRange(o.createdAt, range)) continue;
    for (const i of o.items) {
      const r = m.get(i.productId) ?? { id: i.productId, label: i.name, qty: 0, value: 0 };
      r.qty += i.qty;
      r.value += i.unitPrice * i.qty;
      m.set(i.productId, r);
    }
  }
  return [...m.values()].sort((a, b) => b.qty - a.qty || b.value - a.value).slice(0, limit);
}

export function salesByCategory(orders: readonly Order[], categories: readonly Category[], range: DateRange): RankRow[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const m = new Map<string, RankRow>();
  for (const o of orders) {
    if (o.status === 'cancelada' || !inRange(o.createdAt, range)) continue;
    for (const i of o.items) {
      const r = m.get(i.categoryId) ?? { id: i.categoryId, label: names.get(i.categoryId) ?? 'Sem categoria', qty: 0, value: 0 };
      r.qty += i.qty;
      r.value += i.unitPrice * i.qty;
      m.set(i.categoryId, r);
    }
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export function paymentMethodMix(orders: readonly Order[], range: DateRange): RankRow[] {
  const m = new Map<PaymentMethod, RankRow>();
  for (const o of orders) {
    if (o.status === 'cancelada' || !inRange(o.createdAt, range)) continue;
    const r = m.get(o.paymentMethod) ?? { id: o.paymentMethod, label: PAYMENT_METHODS[o.paymentMethod].label, qty: 0, value: 0 };
    r.qty += 1;
    r.value += o.total;
    m.set(o.paymentMethod, r);
  }
  return [...m.values()].sort((a, b) => b.qty - a.qty);
}

export function orderStatusDistribution(orders: readonly Order[], range: DateRange): RankRow[] {
  const m = new Map<OrderStatus, RankRow>();
  for (const o of orders) {
    if (!inRange(o.createdAt, range)) continue;
    const r = m.get(o.status) ?? { id: o.status, label: ORDER_STATUS_LABEL[o.status], qty: 0, value: 0 };
    r.qty += 1;
    r.value += o.total;
    m.set(o.status, r);
  }
  return [...m.values()];
}

export interface DeliveryPerformance {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  late: number;
  lateCompleted: number;
  lateOpen: number;
  onTimeRate: number;
  averageDays: number;
  feesCharged: number;
  operationalCost: number;
  margin: number;
}

export function deliveryPerformance(deliveries: readonly Delivery[], range: DateRange, now = new Date()): DeliveryPerformance {
  const scoped = deliveries.filter((d) => inRange(d.createdAt, range));
  const valid = scoped.filter((d) => d.status !== 'cancelada');
  const completed = scoped.filter((d) => d.status === 'concluida');
  const lateCompleted = completed.filter((d) => isDeliveryLate(d, now)).length;
  const days = completed
    .filter((d) => d.completedAt)
    .map((d) => (new Date(d.completedAt!).getTime() - new Date(d.createdAt).getTime()) / 86_400_000);
  const feesCharged = Money.sum(valid.map((d) => d.fee));
  const operationalCost = Money.sum(valid.map((d) => d.cost));
  return {
    total: scoped.length,
    pending: scoped.filter((d) => d.status === 'pendente').length,
    inProgress: scoped.filter((d) => d.status === 'em_curso').length,
    completed: completed.length,
    cancelled: scoped.filter((d) => d.status === 'cancelada').length,
    late: scoped.filter((d) => isDeliveryLate(d, now)).length,
    lateCompleted,
    lateOpen: scoped.filter((d) => d.status !== 'concluida' && isDeliveryLate(d, now)).length,
    onTimeRate: completed.length ? Math.round(((completed.length - lateCompleted) / completed.length) * 100) : 100,
    averageDays: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0,
    feesCharged,
    operationalCost,
    margin: feesCharged - operationalCost,
  };
}
