import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { SessionService } from '../../../core/services/session.service';
import { ProductCard } from '../../../shared/components/product-card';
import { EmptyState } from '../../../shared/components/ui';

@Component({
  selector: 'app-favorites-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProductCard, EmptyState, RouterLink],
  styles: `.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
    @media (max-width:560px){.grid{grid-template-columns:repeat(2,1fr);gap:10px}}`,
  template: `
    <div [class.container]="!embedded()" [class.page]="!embedded()">
      @if (!embedded()) {
        <div class="page-head">
          <div>
            <h1>Favoritos</h1>
            <p>{{ items().length }} peça(s) guardada(s){{ session.isLoggedIn() ? '' : ' neste dispositivo — inicia sessão para as guardar na tua conta' }}.</p>
          </div>
        </div>
      }
      @if (items().length) {
        <div class="grid">
          @for (v of items(); track v.product.id) {
            <app-product-card [view]="v" />
          }
        </div>
      } @else {
        <app-empty icon="heart" title="Ainda não tens favoritos" text="Toca no ♡ de uma peça para a guardar aqui.">
          <a class="btn" routerLink="/produtos">Explorar o catálogo</a>
        </app-empty>
      }
    </div>
  `,
})
export class FavoritesPage {
  private readonly queries = inject(CatalogQueries);
  private readonly favorites = inject(FavoritesService);
  protected readonly session = inject(SessionService);
  /** Quando usado dentro da área pessoal (route data). */
  readonly embedded = input(false);
  protected readonly items = computed(() => {
    const ids = this.favorites.ids();
    return this.queries.storefront().filter((v) => ids.includes(v.product.id));
  });
}
