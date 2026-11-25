import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { OrderPricingService } from '../../application/order-pricing.service';
import { CatalogStore } from '../../application/catalog.store';
import { CartLineDto } from '../../domain/dtos';
import { availableStock, defaultAddress } from '../../domain/entities';
import { DomainError } from '../../domain/services/domain-error';
import { DeliveryMethod } from '../../domain/value-objects/statuses';
import { BrowserStorage } from './browser-storage';
import { SessionService } from './session.service';

const KEY = 'xitolo:cart';
export const MAX_QTY_PER_LINE = 10;

/** Carrinho de compras (persistido localmente). */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly pricing = inject(OrderPricingService);
  private readonly catalog = inject(CatalogStore);
  private readonly session = inject(SessionService);

  readonly lines = signal<CartLineDto[]>(BrowserStorage.get<CartLineDto[]>(KEY, []));
  readonly couponCode = signal<string | null>(null);
  /** Província usada na estimativa de entrega (endereço por defeito do cliente). */
  readonly province = signal<string>('Maputo Cidade');
  readonly method = signal<DeliveryMethod>('normal');

  readonly count = computed(() => this.lines().reduce((s, l) => s + l.qty, 0));
  readonly priced = computed(() => this.pricing.price(this.lines(), this.couponCode(), this.province(), this.method()));

  constructor() {
    effect(() => BrowserStorage.set(KEY, this.lines()));
    effect(() => {
      const c = this.session.customer();
      const a = c ? defaultAddress(c) : null;
      if (a) this.province.set(a.province);
    });
  }

  add(productId: string, size: string, color: string, qty: number): void {
    const p = this.catalog.product(productId);
    if (!p) throw new DomainError('Produto não encontrado.');
    const inCart = this.lines()
      .filter((l) => l.productId === productId)
      .reduce((s, l) => s + l.qty, 0);
    const available = availableStock(p);
    if (inCart + qty > available) {
      throw new DomainError(available - inCart > 0 ? `Só pode adicionar mais ${available - inCart} unidade(s).` : 'Já tem no carrinho todo o stock disponível.');
    }
    this.lines.update((ls) => {
      const i = ls.findIndex((l) => l.productId === productId && l.size === size && l.color === color);
      if (i < 0) return [...ls, { productId, size, color, qty }];
      return ls.map((l, ix) => (ix === i ? { ...l, qty: Math.min(MAX_QTY_PER_LINE, l.qty + qty) } : l));
    });
  }

  setQty(index: number, qty: number): void {
    const line = this.lines()[index];
    if (!line) return;
    const p = this.catalog.product(line.productId);
    const others = this.lines()
      .filter((l, i) => i !== index && l.productId === line.productId)
      .reduce((s, l) => s + l.qty, 0);
    const max = Math.min(MAX_QTY_PER_LINE, p ? availableStock(p) - others : MAX_QTY_PER_LINE);
    const next = Math.max(1, Math.min(max, qty));
    this.lines.update((ls) => ls.map((l, i) => (i === index ? { ...l, qty: next } : l)));
  }

  remove(index: number): void {
    this.lines.update((ls) => ls.filter((_, i) => i !== index));
  }

  clear(): void {
    this.lines.set([]);
    this.couponCode.set(null);
  }

  applyCoupon(code: string): void {
    const result = this.pricing.price(this.lines(), code, this.province(), this.method()).coupon;
    if (!result?.ok) throw new DomainError(result?.message ?? 'Cupão inválido.');
    this.couponCode.set(code.trim().toUpperCase());
  }

  removeCoupon(): void {
    this.couponCode.set(null);
  }
}
