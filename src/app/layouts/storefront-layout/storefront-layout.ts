import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { CatalogQueries } from '../../application/catalog-queries.service';
import { CatalogStore } from '../../application/catalog.store';
import { CartService } from '../../core/services/cart.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { SessionService } from '../../core/services/session.service';
import { FREE_SHIPPING_FROM } from '../../domain/value-objects/shipping';
import { Icon } from '../../shared/components/icon';
import { ProductImage } from '../../shared/components/product-image';
import { MznPipe } from '../../shared/pipes/format.pipes';
import { Logo } from '../../shared/components/logo';

@Component({
  selector: 'app-storefront-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ProductImage, MznPipe, Logo],
  templateUrl: './storefront-layout.html',
  styleUrl: './storefront-layout.scss',
})
export class StorefrontLayout {
  private readonly router = inject(Router);
  private readonly queries = inject(CatalogQueries);
  protected readonly catalog = inject(CatalogStore);
  protected readonly cart = inject(CartService);
  protected readonly favorites = inject(FavoritesService);
  protected readonly session = inject(SessionService);
  protected readonly freeFrom = FREE_SHIPPING_FROM;

  protected readonly q = signal('');
  protected readonly searchOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly suggestions = computed(() => (this.q().trim().length < 2 ? [] : this.queries.search({ q: this.q() }).slice(0, 6)));

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeCategory = computed(() => {
    const m = /[?&]categoria=([^&]+)/.exec(this.url());
    return m ? decodeURIComponent(m[1]) : null;
  });
  protected readonly isCatalog = computed(() => this.url().startsWith('/produtos'));

  submitSearch(): void {
    const q = this.q().trim();
    this.searchOpen.set(false);
    void this.router.navigate(['/produtos'], { queryParams: q ? { q } : {} });
  }

  pick(id: string): void {
    this.searchOpen.set(false);
    this.q.set('');
    void this.router.navigate(['/produto', id]);
  }

  closeSearchSoon(): void {
    setTimeout(() => this.searchOpen.set(false), 150);
  }
}
