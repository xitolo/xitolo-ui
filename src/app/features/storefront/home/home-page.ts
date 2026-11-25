import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { SalesStore } from '../../../application/sales.store';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { Promotion, isPromotionLive } from '../../../domain/entities';
import { Money } from '../../../domain/value-objects/money';
import { Icon } from '../../../shared/components/icon';
import { ProductCard } from '../../../shared/components/product-card';
import { ProductImage } from '../../../shared/components/product-image';

interface Banner {
  id: string;
  title: string;
  text: string;
  cta: string;
  link: string[];
  query: Record<string, string>;
  color: string;
  endsAt: string | null;
}

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductCard, ProductImage, Icon],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly queries = inject(CatalogQueries);
  protected readonly catalog = inject(CatalogStore);
  private readonly sales = inject(SalesStore);
  private readonly favorites = inject(FavoritesService);
  protected readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly slide = signal(0);
  protected readonly now = signal(Date.now());

  protected readonly banners = computed<Banner[]>(() => {
    const campaigns = this.catalog
      .promotions()
      .filter((p) => p.kind === 'campanha' && isPromotionLive(p))
      .sort((a, b) => a.endsAt.localeCompare(b.endsAt));
    const fromCampaigns = campaigns.map<Banner>((p) => ({
      id: p.id,
      title: p.name,
      text: p.description,
      cta: 'Ver ofertas',
      link: ['/produtos'],
      query: { campanha: p.id },
      color: p.bannerColor,
      endsAt: p.endsAt,
    }));
    return [
      ...fromCampaigns,
      {
        id: 'brand',
        title: 'Moda nova todos os dias, a preços de Moçambique.',
        text: 'Paga pelo telemóvel e recebe em casa, de Maputo a Pemba.',
        cta: 'Comprar agora',
        link: ['/produtos'],
        query: {},
        color: '#d9480f',
        endsAt: null,
      },
    ];
  });
  protected readonly current = computed(() => this.banners()[this.slide() % this.banners().length]);

  protected readonly onSale = computed(() => this.queries.onSale().slice(0, 12));
  protected readonly bestSellers = computed(() => this.queries.bestSellers().slice(0, 10));
  protected readonly newArrivals = computed(() => this.queries.newest().filter((v) => v.isNew).slice(0, 10));
  protected readonly recentlyAdded = computed(() => this.queries.newest().slice(0, 8));
  protected readonly madeInMz = computed(() => this.queries.storefront().filter((v) => v.product.madeInMz).slice(0, 4));

  /** Fim da campanha activa mais próxima (contagem decrescente da secção de promoções). */
  private readonly saleEnds = computed(() => this.banners().find((b) => b.endsAt)?.endsAt ?? null);
  protected readonly countdown = computed(() => {
    const end = this.saleEnds();
    if (!end) return null;
    let s = Math.max(0, Math.floor((new Date(end).getTime() - this.now()) / 1000));
    const d = Math.floor(s / 86400);
    s %= 86400;
    const pad = (n: number) => String(n).padStart(2, '0');
    return { d, h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
  });

  protected readonly coupons = computed(() =>
    this.catalog.promotions().filter((p): p is Promotion & { code: string } => p.kind === 'cupao' && !!p.code && isPromotionLive(p)),
  );

  protected readonly recommended = computed(() => {
    const c = this.session.customer();
    const favIds = this.favorites.ids();
    const cats = new Set<string>();
    for (const id of favIds) {
      const p = this.catalog.product(id);
      if (p) cats.add(p.categoryId);
    }
    if (c) for (const o of this.sales.ordersOf(c.id)) for (const i of o.items) cats.add(i.categoryId);
    return this.queries.recommendedFor([...cats], favIds, 10);
  });

  protected readonly categoryCards = computed(() =>
    this.catalog.activeCategories().map((c) => ({
      category: c,
      count: this.queries.storefront().filter((v) => v.product.categoryId === c.id).length,
    })),
  );

  constructor() {
    const t1 = setInterval(() => this.now.set(Date.now()), 1000);
    const t2 = setInterval(() => this.slide.update((s) => s + 1), 6500);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(t1);
      clearInterval(t2);
    });
  }

  go(i: number): void {
    this.slide.set(i);
  }

  async copy(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.toast.success(`Código ${code} copiado`);
    } catch {
      this.toast.show(`Usa o código ${code} no checkout`);
    }
  }

  protected money(v: number): string {
    return Money.format(v);
  }
}
