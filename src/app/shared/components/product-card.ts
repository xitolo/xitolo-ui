import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductView } from '../../application/catalog-queries.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from './icon';
import { ProductImage } from './product-image';
import { Price } from './ui';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductImage, Price, Icon],
  styles: `
    :host{display:block}
    .card{display:flex;flex-direction:column;height:100%;background:#fff;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);transition:transform .15s,box-shadow .15s}
    .card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}
    .media{position:relative}.img{aspect-ratio:3/4;position:relative;display:block}
    .tags{position:absolute;top:9px;left:9px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
    .loc{position:absolute;left:9px;bottom:9px}
    .fav{position:absolute;top:8px;right:8px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.92);display:grid;place-items:center;color:var(--ink)}
    .fav.on{color:var(--sale)}
    .soldout{position:absolute;inset:0;background:rgba(255,255,255,.55);display:grid;place-items:center}
    .soldout span{background:var(--ink);color:#fff;font-weight:700;font-size:12px;padding:5px 12px;border-radius:999px}
    .add{position:absolute;right:8px;bottom:8px;width:36px;height:36px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;box-shadow:var(--shadow-sm);transition:transform .15s}
    .add:hover{transform:scale(1.08)}
    .ci{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px;flex:1}
    .nm{font-size:13.5px;color:var(--ink-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:38px}
    .meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted)}
    .meta .st{color:var(--gold)}
    .low{font-size:11.5px;color:var(--warning);font-weight:600}
    @media (max-width:560px){.nm{font-size:12.5px}.ci{padding:8px 9px 10px}}
  `,
  template: `
    @let v = view();
    @let p = v.product;
    <article class="card">
      <div class="media">
      <a class="img" [routerLink]="['/produto', p.id]" [attr.aria-label]="p.name">
        <app-product-image [images]="p.images" [type]="p.illustration.type" [pattern]="p.illustration.pattern" [color]="p.variants.colors[0]" [alt]="p.name" />
        <span class="tags">
          @if (v.quote.discountPercent > 0) {
            <span class="tag">−{{ v.quote.discountPercent }}%</span>
          }
          @if (v.isNew) {
            <span class="tag new">Novo</span>
          }
        </span>
        @if (p.madeInMz) {
          <span class="tag local loc">Feito em MZ</span>
        }
        @if (v.available <= 0) {
          <span class="soldout"><span>Esgotado</span></span>
        }
      </a>
      <button type="button" class="fav" [class.on]="favorites.has(p.id)" (click)="toggleFav()" [attr.aria-label]="favorites.has(p.id) ? 'Remover dos favoritos' : 'Guardar nos favoritos'">
        <app-icon name="heart" [size]="18" [fill]="favorites.has(p.id)" />
      </button>
      @if (v.available > 0) {
        <button type="button" class="add" (click)="quickAdd.open(p.id)" aria-label="Adicionar ao carrinho">
          <app-icon name="bag" [size]="18" />
        </button>
      }
      </div>
      <a class="ci" [routerLink]="['/produto', p.id]">
        <span class="nm">{{ p.name }}</span>
        <app-price [price]="v.quote.price" [was]="v.quote.listPrice" />
        <span class="meta">
          @if (v.reviewCount) {
            <span class="st">★</span>{{ v.rating.toFixed(1).replace('.', ',') }} ·
          }
          {{ v.sold >= 1000 ? (v.sold / 1000).toFixed(1).replace('.', ',') + ' mil' : v.sold }} vendidos
        </span>
        @if (v.available > 0 && v.level === 'baixo') {
          <span class="low">Só restam {{ v.available }}!</span>
        }
      </a>
    </article>
  `,
})
export class ProductCard {
  readonly view = input.required<ProductView>();
  protected readonly favorites = inject(FavoritesService);
  protected readonly quickAdd = inject(QuickAddService);
  private readonly toast = inject(ToastService);

  async toggleFav(): Promise<void> {
    try {
      const on = await this.favorites.toggle(this.view().product.id);
      this.toast.show(on ? '♥ Guardado nos favoritos' : 'Removido dos favoritos', on ? 'success' : 'info');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
