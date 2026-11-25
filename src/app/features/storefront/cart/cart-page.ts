import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CartService, MAX_QTY_PER_LINE } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { FREE_SHIPPING_FROM, PROVINCES } from '../../../domain/value-objects/shipping';
import { Icon } from '../../../shared/components/icon';
import { ProductCard } from '../../../shared/components/product-card';
import { ProductImage } from '../../../shared/components/product-image';
import { EmptyState, QtyStepper } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-cart-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductImage, QtyStepper, MznPipe, Icon, EmptyState, ProductCard],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage {
  protected readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly queries = inject(CatalogQueries);
  protected readonly provinces = PROVINCES;
  protected readonly freeFrom = FREE_SHIPPING_FROM;
  protected readonly code = signal('');
  protected readonly couponError = signal('');

  protected readonly p = this.cart.priced;
  protected readonly remaining = computed(() => Math.max(0, FREE_SHIPPING_FROM - this.p().subtotal));
  protected readonly progress = computed(() => Math.min(100, (this.p().subtotal / FREE_SHIPPING_FROM) * 100));
  protected readonly suggestions = computed(() => {
    const inCart = new Set(this.cart.lines().map((l) => l.productId));
    return this.queries.onSale().filter((v) => !inCart.has(v.product.id)).slice(0, 5);
  });

  maxFor(index: number): number {
    const line = this.p().lines[index];
    if (!line?.product) return 1;
    const others = this.cart.lines().filter((l, i) => i !== index && l.productId === line.line.productId).reduce((s, l) => s + l.qty, 0);
    return Math.max(1, Math.min(MAX_QTY_PER_LINE, line.available - others));
  }

  applyCoupon(): void {
    try {
      this.cart.applyCoupon(this.code());
      this.couponError.set('');
      this.toast.success('Cupão aplicado');
    } catch (e) {
      this.couponError.set((e as Error).message);
    }
  }

  removeInvalid(): void {
    const bad = new Set(this.p().lines.map((l, i) => (l.error && !l.error.startsWith('Só restam') ? i : -1)));
    this.cart.lines.update((ls) => ls.filter((_, i) => !bad.has(i)));
  }
}
