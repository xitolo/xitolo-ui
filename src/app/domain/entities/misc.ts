import { Actor, Entity } from './common';
import { StockMovementType } from '../value-objects/statuses';

export interface StockMovement extends Entity {
  productId: string;
  productName: string;
  type: StockMovementType;
  /** Quantidade (sempre positiva); o tipo indica o efeito. */
  qty: number;
  stockAfter: number;
  reservedAfter: number;
  reason: string;
  orderNumber: string | null;
  at: string;
  by: Actor;
}

export type DiscountType = 'percent' | 'fixed';
export type PromotionKind = 'campanha' | 'cupao';
export type PromotionScope = 'all' | 'products' | 'categories';

export interface Promotion extends Entity {
  name: string;
  description: string;
  /** Campanha: aplicada automaticamente aos preços. Cupão: aplicado no checkout com código. */
  kind: PromotionKind;
  code: string | null;
  discountType: DiscountType;
  value: number;
  minSubtotal: number;
  scope: PromotionScope;
  productIds: string[];
  categoryIds: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
  /** Cor do banner na página inicial. */
  bannerColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review extends Entity {
  productId: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export function isPromotionLive(p: Pick<Promotion, 'active' | 'startsAt' | 'endsAt'>, now = new Date()): boolean {
  const t = now.getTime();
  return p.active && new Date(p.startsAt).getTime() <= t && new Date(p.endsAt).getTime() >= t;
}
