import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogStore } from '../../../application/catalog.store';
import { ReviewService } from '../../../application/review.service';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { ProductImage } from '../../../shared/components/product-image';
import { EmptyState, Stars } from '../../../shared/components/ui';

@Component({
  selector: 'app-reviews-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, Stars, EmptyState, ProductImage],
  styles: `.r{display:flex;gap:14px;align-items:flex-start}.im{width:60px;height:74px;border-radius:8px;overflow:hidden;flex-shrink:0}
    .pend{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}`,
  template: `
    <div class="page-head"><div><h1>As minhas avaliações</h1><p>{{ mine().length }} avaliação(ões) publicada(s)</p></div></div>
    @if (pending().length) {
      <h3 style="margin-bottom:10px">Por avaliar</h3>
      <div class="pend" style="margin-bottom:22px">
        @for (p of pending(); track p.id) {
          <a class="card pad r" [routerLink]="['/produto', p.id]" fragment="avaliacoes">
            <span class="im"><app-product-image [images]="p.images" [type]="p.illustration.type" [pattern]="p.illustration.pattern" [color]="p.variants.colors[0]" /></span>
            <span class="small">{{ p.name }}<br /><span class="link xs">Avaliar →</span></span>
          </a>
        }
      </div>
    }
    <div class="stack">
      @for (r of mine(); track r.id) {
        @let p = catalog.product(r.productId);
        <div class="card pad r">
          @if (p) { <a class="im" [routerLink]="['/produto', p.id]"><app-product-image [images]="p.images" [type]="p.illustration.type" [pattern]="p.illustration.pattern" [color]="p.variants.colors[0]" /></a> }
          <div class="stack" style="--gap:4px">
            <b>{{ p?.name ?? 'Produto removido' }}</b>
            <app-stars [value]="r.rating" />
            @if (r.comment) { <p class="small">{{ r.comment }}</p> }
            <span class="muted xs">{{ r.createdAt | date: 'dd/MM/yyyy' }}</span>
          </div>
        </div>
      } @empty {
        <app-empty icon="star" title="Ainda não avaliaste nenhum produto" text="Depois de receberes uma encomenda podes avaliar os produtos." />
      }
    </div>
  `,
})
export class ReviewsPage {
  protected readonly catalog = inject(CatalogStore);
  private readonly session = inject(SessionService);
  private readonly sales = inject(SalesStore);
  private readonly reviews = inject(ReviewService);
  protected readonly mine = computed(() => this.reviews.reviewsOf(this.session.customer()?.id ?? ''));
  protected readonly pending = computed(() => {
    const c = this.session.customer();
    if (!c) return [];
    this.catalog.reviews();
    const ids = new Set(
      this.sales
        .ordersOf(c.id)
        .filter((o) => o.status === 'entregue')
        .flatMap((o) => o.items.map((i) => i.productId)),
    );
    return [...ids]
      .filter((id) => this.reviews.canReview(c.id, id))
      .map((id) => this.catalog.product(id))
      .filter((p) => !!p);
  });
}
