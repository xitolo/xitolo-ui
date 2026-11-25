import { Product } from '../entities/product';
import { Promotion, isPromotionLive } from '../entities/misc';
import { Money } from '../value-objects/money';

export interface PriceQuote {
  /** Preço de venda de tabela. */
  listPrice: number;
  /** Preço final a cobrar. */
  price: number;
  discountPercent: number;
  source: 'nenhum' | 'produto' | 'campanha';
  campaign: Promotion | null;
}

export function promotionTargets(promo: Promotion, product: Pick<Product, 'id' | 'categoryId'>): boolean {
  switch (promo.scope) {
    case 'all':
      return true;
    case 'products':
      return promo.productIds.includes(product.id);
    case 'categories':
      return promo.categoryIds.includes(product.categoryId);
  }
}

export function applyDiscount(price: number, type: Promotion['discountType'], value: number): number {
  const discounted = type === 'percent' ? price - Money.percentOf(price, value) : price - value;
  return Math.max(0, Money.round(discounted));
}

/**
 * Preço efectivo de um produto: o menor entre o preço de venda, o preço
 * promocional do produto e o preço resultante de cada campanha activa.
 * As campanhas não são cumulativas entre si.
 */
export function quotePrice(product: Product, promotions: readonly Promotion[], now = new Date()): PriceQuote {
  const listPrice = product.price;
  let price = listPrice;
  let source: PriceQuote['source'] = 'nenhum';
  let campaign: Promotion | null = null;

  if (product.promoPrice !== null && product.promoPrice > 0 && product.promoPrice < price) {
    price = product.promoPrice;
    source = 'produto';
  }

  for (const promo of promotions) {
    if (promo.kind !== 'campanha' || !isPromotionLive(promo, now) || !promotionTargets(promo, product)) continue;
    const candidate = applyDiscount(listPrice, promo.discountType, promo.value);
    if (candidate < price) {
      price = candidate;
      source = 'campanha';
      campaign = promo;
    }
  }

  const discountPercent = listPrice > 0 ? Math.round((1 - price / listPrice) * 100) : 0;
  return { listPrice, price, discountPercent, source, campaign };
}

export interface CouponLine {
  productId: string;
  categoryId: string;
  lineTotal: number;
}

export interface CouponEvaluation {
  ok: boolean;
  discount: number;
  message: string;
  promotion: Promotion | null;
}

/** Valida um cupão e calcula o desconto sobre as linhas elegíveis. */
export function evaluateCoupon(
  code: string,
  promotions: readonly Promotion[],
  lines: readonly CouponLine[],
  now = new Date(),
): CouponEvaluation {
  const normalized = code.trim().toUpperCase();
  const fail = (message: string): CouponEvaluation => ({ ok: false, discount: 0, message, promotion: null });
  if (!normalized) return fail('Indica um código.');

  const promo = promotions.find((p) => p.kind === 'cupao' && p.code?.toUpperCase() === normalized);
  if (!promo) return fail('Cupão inválido.');
  if (!isPromotionLive(promo, now)) return fail('Este cupão não está activo.');

  const subtotal = Money.sum(lines.map((l) => l.lineTotal));
  if (subtotal < promo.minSubtotal) {
    return fail(`Este cupão exige um mínimo de ${Money.format(promo.minSubtotal)}.`);
  }

  const eligible = Money.sum(
    lines.filter((l) => promotionTargets(promo, { id: l.productId, categoryId: l.categoryId })).map((l) => l.lineTotal),
  );
  if (eligible <= 0) return fail('Nenhum produto do carrinho é elegível para este cupão.');

  const discount =
    promo.discountType === 'percent' ? Money.percentOf(eligible, promo.value) : Math.min(promo.value, eligible);

  return { ok: true, discount, message: promo.description || promo.name, promotion: promo };
}

export function orderTotal(subtotal: number, discount: number, shippingFee: number): number {
  return Math.max(0, subtotal - discount) + shippingFee;
}
