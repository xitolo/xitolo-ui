import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { ReviewService } from '../../../application/review.service';
import { CartService } from '../../../core/services/cart.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { COLOR_SWATCHES } from '../../../domain/entities';
import { FREE_SHIPPING_FROM } from '../../../domain/value-objects/shipping';
import { Icon } from '../../../shared/components/icon';
import { ProductCard } from '../../../shared/components/product-card';
import { ProductImage } from '../../../shared/components/product-image';
import { EmptyState, Price, QtyStepper, Stars } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

interface GalleryItem {
  kind: 'photo' | 'ill';
  index: number;
  color: string;
}

@Component({
  selector: 'app-product-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductImage, Price, QtyStepper, Stars, Icon, ProductCard, EmptyState, DatePipe, MznPipe],
  templateUrl: './product-page.html',
  styleUrl: './product-page.scss',
})
export class ProductPage {
  readonly id = input.required<string>();

  private readonly queries = inject(CatalogQueries);
  private readonly catalog = inject(CatalogStore);
  private readonly cart = inject(CartService);
  protected readonly favorites = inject(FavoritesService);
  protected readonly session = inject(SessionService);
  private readonly reviewsSvc = inject(ReviewService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly titleSvc = inject(Title);
  protected readonly freeFrom = FREE_SHIPPING_FROM;

  protected readonly view = computed(() => {
    const v = this.queries.view(this.id());
    return v?.visible ? v : undefined;
  });
  protected readonly color = signal('');
  protected readonly size = signal<string | null>(null);
  protected readonly qty = signal(1);
  protected readonly error = signal('');
  protected readonly active = signal<GalleryItem | null>(null);

  protected readonly gallery = computed<GalleryItem[]>(() => {
    const p = this.view()?.product;
    if (!p) return [];
    return [
      ...p.images.map((_, i) => ({ kind: 'photo' as const, index: i, color: p.variants.colors[0] })),
      ...p.variants.colors.map((c) => ({ kind: 'ill' as const, index: 999, color: c })),
    ];
  });

  protected readonly reviews = computed(() =>
    this.catalog
      .reviews()
      .filter((r) => r.productId === this.id())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  protected readonly distribution = computed(() => {
    const total = this.reviews().length || 1;
    return [5, 4, 3, 2, 1].map((s) => {
      const n = this.reviews().filter((r) => r.rating === s).length;
      return { s, n, pct: Math.round((n / total) * 100) };
    });
  });
  protected readonly related = computed(() => {
    const v = this.view();
    return v ? this.queries.related(v) : [];
  });
  protected readonly maxQty = computed(() => Math.max(1, Math.min(10, this.view()?.available ?? 1)));

  protected readonly canReview = computed(() => {
    const c = this.session.customer();
    return !!c && this.reviewsSvc.canReview(c.id, this.id());
  });
  protected readonly newRating = signal(5);
  protected readonly newComment = signal('');
  protected readonly sending = signal(false);

  constructor() {
    effect(() => {
      const v = this.view();
      if (!v) return;
      this.titleSvc.setTitle(`${v.product.name} · Xitolo`);
      this.color.set(v.product.variants.colors[0]);
      this.size.set(v.product.variants.sizes.length === 1 ? v.product.variants.sizes[0] : null);
      this.qty.set(1);
      this.error.set('');
      this.active.set(null);
    });
  }

  protected swatch(c: string): string {
    return COLOR_SWATCHES[c] ?? '#999';
  }

  pickColor(c: string): void {
    this.color.set(c);
    this.active.set({ kind: 'ill', index: 999, color: c });
  }

  add(buyNow: boolean): void {
    const v = this.view();
    const size = this.size();
    if (!v) return;
    if (!size) {
      this.error.set('Por favor escolhe um tamanho.');
      return;
    }
    try {
      this.cart.add(v.product.id, size, this.color(), this.qty());
      this.toast.success('Adicionado ao carrinho');
      if (buyNow) void this.router.navigate(['/carrinho']);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async toggleFav(): Promise<void> {
    const on = await this.favorites.toggle(this.id());
    this.toast.show(on ? '♥ Guardado nos favoritos' : 'Removido dos favoritos', on ? 'success' : 'info');
  }

  async submitReview(): Promise<void> {
    const c = this.session.customer();
    if (!c) return;
    this.sending.set(true);
    try {
      await this.reviewsSvc.submit(c.id, this.id(), this.newRating(), this.newComment());
      this.newComment.set('');
      this.toast.success('Obrigado pela tua avaliação!');
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.sending.set(false);
    }
  }
}
