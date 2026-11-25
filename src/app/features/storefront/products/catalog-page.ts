import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { CatalogQueries, CatalogSort } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { promotionTargets } from '../../../domain/services/pricing';
import { Icon } from '../../../shared/components/icon';
import { ProductCard } from '../../../shared/components/product-card';
import { EmptyState } from '../../../shared/components/ui';

const PAGE = 24;

@Component({
  selector: 'app-catalog-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, Icon, EmptyState, RouterLink],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queries = inject(CatalogQueries);
  protected readonly catalog = inject(CatalogStore);

  protected readonly params = toSignal(this.route.queryParams, { initialValue: {} as Params });
  protected readonly filtersOpen = signal(false);
  protected readonly limit = signal(PAGE);

  protected readonly sorts: { id: CatalogSort; label: string }[] = [
    { id: 'relevancia', label: 'Recomendados' },
    { id: 'recentes', label: 'Mais recentes' },
    { id: 'vendidos', label: 'Mais vendidos' },
    { id: 'avaliacao', label: 'Melhor avaliados' },
    { id: 'preco_asc', label: 'Preço: menor → maior' },
    { id: 'preco_desc', label: 'Preço: maior → menor' },
  ];

  protected readonly category = computed(() => this.catalog.activeCategories().find((c) => c.slug === this.params()['categoria']) ?? null);
  protected readonly campaign = computed(() => this.catalog.promotions().find((p) => p.id === this.params()['campanha']) ?? null);
  protected readonly sort = computed<CatalogSort>(() => (this.params()['ordem'] as CatalogSort) || 'relevancia');
  protected readonly num = (k: string) => {
    const v = this.params()[k];
    return v === undefined || v === '' ? null : +v;
  };
  protected readonly flag = (k: string) => this.params()[k] === '1';

  protected readonly results = computed(() => {
    const campaign = this.campaign();
    const source = campaign ? this.queries.storefront().filter((v) => promotionTargets(campaign, v.product)) : undefined;
    return this.queries.search(
      {
        q: this.params()['q'],
        categoryId: this.category()?.id ?? null,
        minPrice: this.num('min'),
        maxPrice: this.num('max'),
        inStock: this.flag('stock'),
        onSale: this.flag('promo'),
        madeInMz: this.flag('mz'),
        minRating: this.num('aval'),
        minSold: this.num('pop'),
        sort: this.sort(),
      },
      source,
    );
  });
  protected readonly visible = computed(() => this.results().slice(0, this.limit()));

  protected readonly title = computed(() => {
    const p = this.params();
    if (this.campaign()) return this.campaign()!.name;
    if (p['q']) return `Resultados para “${p['q']}”`;
    if (this.category()) return this.category()!.name;
    if (this.flag('promo')) return 'Promoções';
    if (this.flag('mz')) return 'Feito em Moçambique';
    return 'Todos os produtos';
  });

  protected readonly activeCount = computed(() =>
    ['categoria', 'min', 'max', 'stock', 'promo', 'mz', 'aval', 'pop', 'campanha', 'q'].filter((k) => this.params()[k]).length,
  );

  set(patch: Params): void {
    this.limit.set(PAGE);
    const next: Params = { ...this.params(), ...patch };
    for (const k of Object.keys(next)) if (next[k] === null || next[k] === '' || next[k] === undefined) delete next[k];
    void this.router.navigate([], { queryParams: next, replaceUrl: true });
  }

  toggle(k: string): void {
    this.set({ [k]: this.flag(k) ? null : '1' });
  }

  setPrice(min: number | null, max: number | null): void {
    this.set({ min, max });
  }

  clear(): void {
    void this.router.navigate([], { queryParams: {} });
  }
}
