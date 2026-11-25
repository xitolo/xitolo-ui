import { Injectable, inject } from '@angular/core';
import { CartLineDto } from '../domain/dtos';
import { OrderItem, Product, availableStock } from '../domain/entities';
import { CouponEvaluation, PriceQuote, evaluateCoupon, orderTotal, quotePrice } from '../domain/services/pricing';
import { Money } from '../domain/value-objects/money';
import { DeliveryOption, deliveryOptions } from '../domain/value-objects/shipping';
import { DeliveryMethod } from '../domain/value-objects/statuses';
import { CatalogStore } from './catalog.store';

export interface PricedLine {
  line: CartLineDto;
  product: Product | null;
  quote: PriceQuote | null;
  available: number;
  lineTotal: number;
  error: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  items: OrderItem[];
  units: number;
  subtotal: number;
  /** Poupança face ao preço de tabela (promoções). */
  savings: number;
  coupon: CouponEvaluation | null;
  discount: number;
  options: DeliveryOption[];
  option: DeliveryOption;
  shippingFee: number;
  total: number;
  errors: string[];
}

/**
 * Calcula preços, descontos e custos de entrega de um conjunto de linhas.
 * É usado pelo carrinho, pelo checkout e na criação da encomenda — garantindo
 * que o cliente vê exactamente o valor que vai ser registado.
 */
@Injectable({ providedIn: 'root' })
export class OrderPricingService {
  private readonly catalog = inject(CatalogStore);

  price(lines: readonly CartLineDto[], couponCode: string | null, province: string, method: DeliveryMethod): PricedCart {
    const now = new Date();
    const promotions = this.catalog.promotions();
    const usedByProduct = new Map<string, number>();
    for (const l of lines) usedByProduct.set(l.productId, (usedByProduct.get(l.productId) ?? 0) + l.qty);

    const priced: PricedLine[] = lines.map((line) => {
      const product = this.catalog.product(line.productId) ?? null;
      const category = product ? this.catalog.category(product.categoryId) : undefined;
      if (!product || product.status !== 'activo' || !category?.active) {
        return { line, product, quote: null, available: 0, lineTotal: 0, error: 'Este produto já não está disponível.' };
      }
      const quote = quotePrice(product, promotions, now);
      const available = availableStock(product);
      let error: string | null = null;
      if (available <= 0) error = 'Esgotado.';
      else if ((usedByProduct.get(product.id) ?? 0) > available) error = `Só restam ${available} unidade(s).`;
      else if (!product.variants.sizes.includes(line.size) || !product.variants.colors.includes(line.color)) {
        error = 'A variante escolhida já não existe.';
      }
      return { line, product, quote, available, lineTotal: quote.price * line.qty, error };
    });

    const valid = priced.filter((p) => !p.error && p.product && p.quote);
    const items: OrderItem[] = valid.map(({ line, product, quote }) => ({
      productId: product!.id,
      sku: product!.sku,
      name: product!.name,
      categoryId: product!.categoryId,
      image: product!.images[0] ?? null,
      illustration: product!.illustration,
      size: line.size,
      color: line.color,
      qty: line.qty,
      listPrice: quote!.listPrice,
      unitPrice: quote!.price,
      unitCost: product!.costPrice,
    }));

    const subtotal = Money.sum(items.map((i) => i.unitPrice * i.qty));
    const savings = Money.sum(items.map((i) => (i.listPrice - i.unitPrice) * i.qty));
    const coupon = couponCode
      ? evaluateCoupon(
          couponCode,
          promotions,
          items.map((i) => ({ productId: i.productId, categoryId: i.categoryId, lineTotal: i.unitPrice * i.qty })),
          now,
        )
      : null;
    const discount = coupon?.ok ? coupon.discount : 0;
    const options = deliveryOptions(province, subtotal);
    const option = options.find((o) => o.method === method && o.available) ?? options[0];
    const shippingFee = items.length ? option.fee : 0;

    return {
      lines: priced,
      items,
      units: items.reduce((s, i) => s + i.qty, 0),
      subtotal,
      savings,
      coupon,
      discount,
      options,
      option,
      shippingFee,
      total: items.length ? orderTotal(subtotal, discount, shippingFee) : 0,
      errors: priced.filter((p) => p.error).map((p) => `${p.product?.name ?? 'Produto'}: ${p.error}`),
    };
  }
}
