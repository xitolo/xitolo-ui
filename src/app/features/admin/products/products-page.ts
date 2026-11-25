import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogQueries, ProductView } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';
import { downloadCsv } from '../shared/period-filter';

@Component({
  selector: 'app-admin-products-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProductImage, Badge, Pagination, EmptyState, MznPipe, Icon],
  templateUrl: './products-page.html',
})
export class ProductsPage {
  /** Filtro inicial por categoria (?categoria=id). */
  readonly categoria = input<string>('');
  private readonly queries = inject(CatalogQueries);
  protected readonly catalog = inject(CatalogStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly q = signal('');
  protected readonly cat = linkedSignal(() => this.categoria() ?? '');
  protected readonly status = signal<'' | 'activo' | 'inactivo'>('');
  protected readonly level = signal<'' | 'ok' | 'baixo' | 'esgotado'>('');
  protected readonly page = signal(1);
  protected readonly size = signal(10);

  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.queries
      .all()
      .filter(
        (v) =>
          (!q || v.product.name.toLowerCase().includes(q) || v.product.sku.toLowerCase().includes(q)) &&
          (!this.cat() || v.product.categoryId === this.cat()) &&
          (!this.status() || v.product.status === this.status()) &&
          (!this.level() || v.level === this.level()),
      )
      .sort((a, b) => b.product.updatedAt.localeCompare(a.product.updatedAt));
  });
  protected readonly rows = computed(() => paginate(this.filtered(), this.page(), this.size()));
  protected readonly margin = (v: ProductView) => (v.quote.price ? Math.round(((v.quote.price - v.product.costPrice) / v.quote.price) * 100) : 0);

  reset(): void {
    this.page.set(1);
  }

  async toggle(v: ProductView): Promise<void> {
    const active = v.product.status !== 'activo';
    try {
      await this.catalog.setProductStatus(v.product.id, active);
      this.toast.success(active ? 'Produto activado — visível na loja' : 'Produto desactivado — oculto da loja');
    } catch (e) {
      this.toast.error(e);
    }
  }

  async remove(v: ProductView): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Remover produto?',
      message: `"${v.product.name}" será removido do catálogo. As encomendas antigas mantêm o registo do produto. Esta acção não pode ser anulada.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.catalog.deleteProduct(v.product.id);
      this.toast.success('Produto removido');
    } catch (e) {
      this.toast.error(e);
    }
  }

  open(v: ProductView): void {
    void this.router.navigate(['/admin/produtos', v.product.id]);
  }

  export(): void {
    downloadCsv(
      'produtos-xitolo.csv',
      ['SKU', 'Produto', 'Categoria', 'Estado', 'Custo', 'Preço', 'Preço promocional', 'Preço efectivo', 'Stock', 'Reservado', 'Disponível', 'Stock mínimo', 'Vendidos'],
      this.filtered().map((v) => [
        v.product.sku, v.product.name, v.category?.name ?? '', v.product.status, v.product.costPrice, v.product.price,
        v.product.promoPrice ?? '', v.quote.price, v.product.stock, v.product.reserved, v.available, v.product.minStock, v.sold,
      ]),
    );
  }
}
