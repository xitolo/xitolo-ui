import { Actor } from '../entities/common';
import { StockMovement } from '../entities/misc';
import { Product, availableStock } from '../entities/product';
import { StockMovementType } from '../value-objects/statuses';
import { DomainError } from './domain-error';

/**
 * Regras de inventário.
 *
 * Modelo: cada produto tem `stock` (unidades físicas em armazém) e
 * `reserved` (unidades comprometidas com encomendas ainda não entregues).
 * Disponível para venda = stock − reservado.
 *
 *  - Encomenda criada      → RESERVA   (reservado += q)
 *  - Encomenda cancelada   → LIBERTAÇÃO (reservado −= q)
 *  - Encomenda entregue    → VENDA     (stock −= q, reservado −= q)
 *
 * Cada encomenda tem um `stockState` (reservado → libertado | consumido)
 * e só pode transitar uma vez, o que impede que o mesmo produto seja
 * descontado duas vezes.
 */

export type MovementDraft = Omit<StockMovement, 'id'>;

export interface StockChange {
  product: Product;
  movement: MovementDraft;
}

interface Ctx {
  reason: string;
  orderNumber?: string | null;
  by: Actor;
  at?: string;
}

function change(product: Product, type: StockMovementType, qty: number, next: Pick<Product, 'stock' | 'reserved'>, ctx: Ctx): StockChange {
  const at = ctx.at ?? new Date().toISOString();
  const updated: Product = { ...product, stock: next.stock, reserved: next.reserved, updatedAt: at };
  return {
    product: updated,
    movement: {
      productId: product.id,
      productName: product.name,
      type,
      qty,
      stockAfter: next.stock,
      reservedAfter: next.reserved,
      reason: ctx.reason,
      orderNumber: ctx.orderNumber ?? null,
      at,
      by: ctx.by,
    },
  };
}

function assertQty(qty: number): void {
  if (!Number.isInteger(qty) || qty <= 0) throw new DomainError('A quantidade deve ser um número inteiro positivo.');
}

export const InventoryPolicy = {
  reserve(p: Product, qty: number, ctx: Ctx): StockChange {
    assertQty(qty);
    if (availableStock(p) < qty) {
      throw new DomainError(`Stock insuficiente para "${p.name}". Disponível: ${availableStock(p)}.`);
    }
    return change(p, 'reserva', qty, { stock: p.stock, reserved: p.reserved + qty }, ctx);
  },

  release(p: Product, qty: number, ctx: Ctx): StockChange {
    assertQty(qty);
    const q = Math.min(qty, p.reserved);
    return change(p, 'libertacao', q, { stock: p.stock, reserved: p.reserved - q }, ctx);
  },

  /** Saída efectiva por venda concluída — consome a reserva. */
  consume(p: Product, qty: number, ctx: Ctx): StockChange {
    assertQty(qty);
    const fromReserve = Math.min(qty, p.reserved);
    return change(p, 'venda', qty, { stock: Math.max(0, p.stock - qty), reserved: p.reserved - fromReserve }, ctx);
  },

  entry(p: Product, qty: number, ctx: Ctx): StockChange {
    assertQty(qty);
    return change(p, 'entrada', qty, { stock: p.stock + qty, reserved: p.reserved }, ctx);
  },

  /** Saída manual (quebra, oferta, amostra…). Não pode tocar no stock reservado. */
  exit(p: Product, qty: number, ctx: Ctx): StockChange {
    assertQty(qty);
    if (availableStock(p) < qty) {
      throw new DomainError(`Só há ${availableStock(p)} unidade(s) disponível(is) — o restante está reservado.`);
    }
    return change(p, 'saida', qty, { stock: p.stock - qty, reserved: p.reserved }, ctx);
  },

  /** Ajuste de inventário para uma contagem física. */
  adjust(p: Product, newStock: number, ctx: Ctx): StockChange {
    if (!Number.isInteger(newStock) || newStock < 0) throw new DomainError('Indica uma quantidade válida.');
    if (newStock < p.reserved) {
      throw new DomainError(`Não é possível ficar abaixo das ${p.reserved} unidades reservadas.`);
    }
    if (newStock === p.stock) throw new DomainError('A quantidade é igual ao stock actual.');
    const delta = newStock - p.stock;
    const reason = `${ctx.reason} (${delta > 0 ? '+' : ''}${delta})`;
    return change(p, 'ajuste', Math.abs(delta), { stock: newStock, reserved: p.reserved }, { ...ctx, reason });
  },
};

/** Agrupa as quantidades por produto (várias linhas podem ser do mesmo produto). */
export function qtyByProduct(items: readonly { productId: string; qty: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
  return m;
}
