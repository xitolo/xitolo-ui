import { buildSeed } from '../../infrastructure/mock-data/seed-builder';
import { Product, availableStock } from '../entities';
import { rangeFromPreset } from '../value-objects/date-range';
import { computeFinancialSummary } from './finance';
import { InventoryPolicy, qtyByProduct } from './inventory-policy';
import { nextStatuses, transitionError } from './order-lifecycle';
import { evaluateCoupon, quotePrice } from './pricing';

const NOW = new Date('2026-11-24T18:00:00');
const db = buildSeed(NOW);

describe('Dados de demonstração', () => {
  it('são coerentes: stock reservado = soma das encomendas com reserva activa', () => {
    const reservedByOrders = new Map<string, number>();
    for (const o of db.orders.filter((x) => x.stockState === 'reservado')) {
      for (const [pid, q] of qtyByProduct(o.items)) reservedByOrders.set(pid, (reservedByOrders.get(pid) ?? 0) + q);
    }
    for (const p of db.products) {
      expect(p.reserved).toBe(reservedByOrders.get(p.id) ?? 0);
      expect(p.stock).toBeGreaterThanOrEqual(p.reserved);
    }
  });

  it('reproduz o stock final a partir do histórico de movimentos', () => {
    for (const p of db.products) {
      const last = db.stockMovements.filter((m) => m.productId === p.id).sort((a, b) => b.at.localeCompare(a.at))[0];
      if (last) {
        expect(last.stockAfter).toBe(p.stock);
        expect(last.reservedAfter).toBe(p.reserved);
      }
    }
  });

  it('tem encomendas entregues, canceladas e em curso, cada uma com pagamento', () => {
    const st = new Set(db.orders.map((o) => o.status));
    expect(st.has('entregue')).toBe(true);
    expect(st.has('cancelada')).toBe(true);
    expect(db.orders.length).toBeGreaterThan(100);
    expect(db.payments.length).toBe(db.orders.length);
    for (const o of db.orders) {
      const pay = db.payments.find((p) => p.orderId === o.id)!;
      expect(pay.amount).toBe(o.total);
      if (o.status === 'cancelada') expect(['rejeitado', 'reembolsado']).toContain(pay.status);
      if (o.status !== 'pendente' && o.status !== 'cancelada' && o.paymentMethod !== 'na_entrega') {
        expect(pay.status).toBe('confirmado');
      }
    }
  });

  it('não conta encomendas canceladas nem pendentes como receita recebida', () => {
    const f = computeFinancialSummary(db.orders, db.payments, db.deliveries, rangeFromPreset('all', NOW));
    const confirmed = db.payments.filter((p) => p.status === 'confirmado').reduce((s, p) => s + p.amount, 0);
    expect(f.receivedValue).toBe(confirmed);
    expect(f.soldValue).toBe(f.receivedValue + f.pendingValue);
    expect(f.netRevenue).toBeLessThan(f.grossRevenue);
    expect(f.estimatedProfit).toBeLessThan(f.netRevenue);
  });
});

describe('Regras de inventário', () => {
  const base = { ...db.products[0], stock: 10, reserved: 2 } as Product;
  const ctx = { reason: 'teste', by: 'admin' as const };

  it('reserva só o que está disponível', () => {
    expect(availableStock(base)).toBe(8);
    expect(InventoryPolicy.reserve(base, 8, ctx).product.reserved).toBe(10);
    expect(() => InventoryPolicy.reserve(base, 9, ctx)).toThrow();
  });

  it('venda consome a reserva e o stock físico uma única vez', () => {
    const r = InventoryPolicy.reserve(base, 3, ctx).product;
    const v = InventoryPolicy.consume(r, 3, ctx).product;
    expect(v.stock).toBe(7);
    expect(v.reserved).toBe(2);
  });

  it('ajuste não pode ficar abaixo do reservado', () => {
    expect(() => InventoryPolicy.adjust(base, 1, ctx)).toThrow();
    expect(InventoryPolicy.adjust(base, 15, ctx).movement.qty).toBe(5);
  });
});

describe('Preços e cupões', () => {
  it('aplica o menor preço entre promoção do produto e campanha', () => {
    const p = { ...db.products[0], price: 1000, promoPrice: 900, categoryId: 'cat_mulher' } as Product;
    const q = quotePrice(p, db.promotions, NOW);
    expect(q.price).toBe(800); // −20% da campanha "Ofertas da Semana"
    expect(q.source).toBe('campanha');
  });

  it('valida mínimo do cupão MOZ25', () => {
    const lines = [{ productId: 'x', categoryId: 'cat_homem', lineTotal: 1000 }];
    expect(evaluateCoupon('MOZ25', db.promotions, lines, NOW).ok).toBe(false);
    expect(evaluateCoupon('moz25', db.promotions, [{ ...lines[0], lineTotal: 2000 }], NOW).discount).toBe(250);
    expect(evaluateCoupon('NATAL500', db.promotions, [{ ...lines[0], lineTotal: 9000 }], NOW).ok).toBe(false);
  });
});

describe('Ciclo de vida da encomenda', () => {
  it('não confirma encomenda pré-paga sem pagamento confirmado', () => {
    const o = db.orders.find((x) => x.paymentMethod === 'mpesa')!;
    const pending = { ...o, status: 'pendente' as const };
    expect(transitionError(pending, 'confirmada', { ...db.payments[0], status: 'pendente' })).toBeTruthy();
    expect(transitionError(pending, 'confirmada', { ...db.payments[0], status: 'confirmado' })).toBeNull();
  });

  it('não permite cancelar depois de enviada', () => {
    expect(nextStatuses({ status: 'em_transito', deliveryMethod: 'normal' })).not.toContain('cancelada');
    expect(nextStatuses({ status: 'pronta_envio', deliveryMethod: 'levantamento' })).toEqual(['entregue', 'cancelada']);
  });
});
