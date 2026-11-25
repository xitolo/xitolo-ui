import { Address } from './customer';
import { Actor, Entity } from './common';
import { DeliveryMethod, OrderStatus, PaymentMethod } from '../value-objects/statuses';
import { ProductIllustration } from './product';

/**
 * Linha da encomenda. Guarda um "snapshot" do produto no momento da compra
 * (nome, preços e custo) para que alterações futuras não afectem a encomenda.
 */
export interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  categoryId: string;
  image: string | null;
  illustration: ProductIllustration;
  size: string;
  color: string;
  qty: number;
  /** Preço de venda de tabela à data da compra. */
  listPrice: number;
  /** Preço efectivamente cobrado (com promoção). */
  unitPrice: number;
  /** Custo de aquisição à data da compra. */
  unitCost: number;
}

export interface OrderEvent {
  at: string;
  by: Actor;
  status: OrderStatus | null;
  message: string;
}

/**
 * Estado da reserva de stock da encomenda. Garante que cada encomenda
 * só reserva, liberta ou consome stock uma única vez.
 */
export type StockState = 'reservado' | 'libertado' | 'consumido';

export interface Order extends Entity {
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  /** Soma das linhas (preço cobrado × quantidade). */
  subtotal: number;
  /** Desconto de cupão. */
  discount: number;
  couponCode: string | null;
  shippingFee: number;
  /** Custo operacional estimado da entrega (para a margem). */
  shippingCost: number;
  total: number;
  deliveryMethod: DeliveryMethod;
  address: Address | null;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  stockState: StockState;
  expectedBy: string;
  createdAt: string;
  updatedAt: string;
  history: OrderEvent[];
}

export function orderUnits(o: Pick<Order, 'items'>): number {
  return o.items.reduce((s, i) => s + i.qty, 0);
}

export function orderCost(o: Pick<Order, 'items'>): number {
  return o.items.reduce((s, i) => s + i.unitCost * i.qty, 0);
}
