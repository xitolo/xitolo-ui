import { Injectable, computed, inject } from '@angular/core';
import { Category, Product, StockLevel, availableStock, stockLevel } from '../domain/entities';
import { PriceQuote, quotePrice } from '../domain/services/pricing';
import { CatalogStore } from './catalog.store';
import { SalesStore } from './sales.store';

/** Modelo de leitura de um produto, pronto para apresentar na loja e no painel. */
export interface ProductView {
  product: Product;
  category: Category | undefined;
  quote: PriceQuote;
  available: number;
  level: StockLevel;
  rating: number;
  reviewCount: number;
  sold: number;
  isNew: boolean;
  /** Visível na loja (produto e categoria activos). */
  visible: boolean;
}

export type CatalogSort = 'relevancia' | 'recentes' | 'preco_asc' | 'preco_desc' | 'vendidos' | 'avaliacao';

export interface CatalogFilter {
  q?: string;
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean;
  onSale?: boolean;
  madeInMz?: boolean;
  minRating?: number | null;
  minSold?: number | null;
  sort?: CatalogSort;
}

const NEW_DAYS = 21;

@Injectable({ providedIn: 'root' })
export class CatalogQueries {
  private readonly catalog = inject(CatalogStore);
  private readonly sales = inject(SalesStore);

  /** Unidades vendidas por produto (encomendas não canceladas). */
  private readonly soldByProduct = computed(() => {
    const m = new Map<string, number>();
    for (const o of this.sales.orders()) {
      if (o.status === 'cancelada') continue;
      for (const i of o.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.qty);
    }
    return m;
  });

  private readonly ratingByProduct = computed(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of this.catalog.reviews()) {
      const x = m.get(r.productId) ?? { sum: 0, n: 0 };
      x.sum += r.rating;
      x.n += 1;
      m.set(r.productId, x);
    }
    return m;
  });

  readonly all = computed<ProductView[]>(() => {
    const now = new Date();
    const promotions = this.catalog.promotions();
    const cats = new Map(this.catalog.categories().map((c) => [c.id, c]));
    const sold = this.soldByProduct();
    const ratings = this.ratingByProduct();
    return this.catalog.products().map((product) => {
      const category = cats.get(product.categoryId);
      const r = ratings.get(product.id);
      return {
        product,
        category,
        quote: quotePrice(product, promotions, now),
        available: availableStock(product),
        level: stockLevel(product),
        rating: r ? Math.round((r.sum / r.n) * 10) / 10 : 0,
        reviewCount: r?.n ?? 0,
        sold: sold.get(product.id) ?? 0,
        isNew: now.getTime() - new Date(product.createdAt).getTime() < NEW_DAYS * 86_400_000,
        visible: product.status === 'activo' && !!category?.active,
      };
    });
  });

  /** Catálogo público: apenas produtos activos de categorias activas. */
  readonly storefront = computed(() => this.all().filter((v) => v.visible));

  readonly onSale = computed(() =>
    this.storefront()
      .filter((v) => v.quote.discountPercent > 0 && v.available > 0)
      .sort((a, b) => b.quote.discountPercent - a.quote.discountPercent),
  );
  readonly bestSellers = computed(() => [...this.storefront()].sort((a, b) => b.sold - a.sold));
  readonly newest = computed(() =>
    [...this.storefront()].sort((a, b) => b.product.createdAt.localeCompare(a.product.createdAt)),
  );
  readonly topRated = computed(() =>
    [...this.storefront()].filter((v) => v.reviewCount > 0).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount),
  );

  view(id: string): ProductView | undefined {
    return this.all().find((v) => v.product.id === id);
  }

  related(view: ProductView, limit = 6): ProductView[] {
    return this.storefront()
      .filter((v) => v.product.id !== view.product.id && v.product.categoryId === view.product.categoryId)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, limit);
  }

  /** Recomendações simples: favoritos e compras anteriores → mesmas categorias; senão, os mais bem avaliados. */
  recommendedFor(categoryIds: string[], excludeIds: string[] = [], limit = 10): ProductView[] {
    const pool = this.storefront().filter((v) => v.available > 0 && !excludeIds.includes(v.product.id));
    const preferred = pool.filter((v) => categoryIds.includes(v.product.categoryId));
    const score = (v: ProductView) => v.rating * 10 + Math.log1p(v.sold) * 4 + (v.quote.discountPercent > 0 ? 5 : 0);
    const ranked = [...preferred.sort((a, b) => score(b) - score(a)), ...pool.filter((v) => !preferred.includes(v)).sort((a, b) => score(b) - score(a))];
    return ranked.slice(0, limit);
  }

  search(filter: CatalogFilter, source: ProductView[] = this.storefront()): ProductView[] {
    const q = filter.q?.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const list = source.filter((v) => {
      if (filter.categoryId && v.product.categoryId !== filter.categoryId) return false;
      if (q) {
        const hay = `${v.product.name} ${v.product.description} ${v.category?.name ?? ''} ${v.product.variants.colors.join(' ')}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '');
        if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      if (filter.minPrice != null && v.quote.price < filter.minPrice) return false;
      if (filter.maxPrice != null && v.quote.price > filter.maxPrice) return false;
      if (filter.inStock && v.available <= 0) return false;
      if (filter.onSale && v.quote.discountPercent <= 0) return false;
      if (filter.madeInMz && !v.product.madeInMz) return false;
      if (filter.minRating && v.rating < filter.minRating) return false;
      if (filter.minSold && v.sold < filter.minSold) return false;
      return true;
    });
    const by: Record<CatalogSort, (a: ProductView, b: ProductView) => number> = {
      relevancia: (a, b) => Number(b.available > 0) - Number(a.available > 0) || b.sold + b.rating * 20 - (a.sold + a.rating * 20),
      recentes: (a, b) => b.product.createdAt.localeCompare(a.product.createdAt),
      preco_asc: (a, b) => a.quote.price - b.quote.price,
      preco_desc: (a, b) => b.quote.price - a.quote.price,
      vendidos: (a, b) => b.sold - a.sold,
      avaliacao: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
    };
    return list.sort(by[filter.sort ?? 'relevancia']);
  }
}
