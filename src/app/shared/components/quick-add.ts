import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogQueries } from '../../application/catalog-queries.service';
import { CartService } from '../../core/services/cart.service';
import { QuickAddService } from '../../core/services/quick-add.service';
import { ToastService } from '../../core/services/toast.service';
import { COLOR_SWATCHES } from '../../domain/entities';
import { Dialog } from './dialog';
import { ProductImage } from './product-image';
import { Price, QtyStepper } from './ui';

/** Selecção de variante e quantidade sem sair do catálogo. */
@Component({
  selector: 'app-quick-add',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, ProductImage, Price, QtyStepper, RouterLink],
  styles: `.qa{display:grid;grid-template-columns:150px 1fr;gap:18px}.im{aspect-ratio:3/4;border-radius:12px;overflow:hidden}
    h3{font-size:16px;margin-bottom:6px}.err{color:var(--sale);font-size:12.5px;min-height:16px}
    @media (max-width:520px){.qa{grid-template-columns:1fr}.im{max-width:160px}}`,
  template: `
    @if (view(); as v) {
      <app-dialog title="Adicionar ao carrinho" (closed)="svc.close()">
        <div class="qa">
          <div class="im"><app-product-image [images]="v.product.images" [type]="v.product.illustration.type" [pattern]="v.product.illustration.pattern" [color]="color()" /></div>
          <div class="stack">
            <div>
              <h3>{{ v.product.name }}</h3>
              <app-price [price]="v.quote.price" [was]="v.quote.listPrice" [showOff]="true" />
            </div>
            <div class="stack" style="--gap:6px">
              <span class="label">Cor: <span class="muted">{{ color() }}</span></span>
              <div class="chips">
                @for (c of v.product.variants.colors; track c) {
                  <button type="button" class="swatch" [class.on]="c === color()" [style.background]="swatch(c)" [title]="c" (click)="color.set(c)"></button>
                }
              </div>
            </div>
            <div class="stack" style="--gap:6px">
              <span class="label">Tamanho: <span class="muted">{{ size() ?? 'escolhe um' }}</span></span>
              <div class="chips">
                @for (s of v.product.variants.sizes; track s) {
                  <button type="button" class="chip square" [class.on]="s === size()" (click)="size.set(s); error.set('')">{{ s }}</button>
                }
              </div>
              <span class="err">{{ error() }}</span>
            </div>
            <div class="row">
              <app-qty [(value)]="qty" [max]="maxQty()" />
              <span class="muted small">{{ v.available }} disponíveis</span>
            </div>
            <a class="link small" [routerLink]="['/produto', v.product.id]" (click)="svc.close()">Ver todos os detalhes</a>
          </div>
        </div>
        <ng-container foot>
          <button type="button" class="btn ghost" (click)="svc.close()">Cancelar</button>
          <button type="button" class="btn brand" (click)="add(false)">Adicionar</button>
          <button type="button" class="btn" (click)="add(true)">Comprar já</button>
        </ng-container>
      </app-dialog>
    }
  `,
})
export class QuickAdd {
  protected readonly svc = inject(QuickAddService);
  private readonly queries = inject(CatalogQueries);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly view = computed(() => {
    const id = this.svc.productId();
    return id ? this.queries.view(id) : undefined;
  });
  protected readonly color = signal('');
  protected readonly size = signal<string | null>(null);
  protected readonly qty = signal(1);
  protected readonly error = signal('');
  protected readonly maxQty = computed(() => Math.max(1, Math.min(10, this.view()?.available ?? 1)));

  constructor() {
    effect(() => {
      const v = this.view();
      if (!v) return;
      this.color.set(v.product.variants.colors[0]);
      this.size.set(v.product.variants.sizes.length === 1 ? v.product.variants.sizes[0] : null);
      this.qty.set(1);
      this.error.set('');
    });
  }

  protected swatch(c: string): string {
    return COLOR_SWATCHES[c] ?? '#999';
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
      this.svc.close();
      this.toast.success('Adicionado ao carrinho');
      if (buyNow) void this.router.navigate(['/carrinho']);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
