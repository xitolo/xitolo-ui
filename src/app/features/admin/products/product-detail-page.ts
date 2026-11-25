import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { InventoryStore } from '../../../application/inventory.store';
import { SalesStore } from '../../../application/sales.store';
import { ToastService } from '../../../core/services/toast.service';
import { STOCK_MOVEMENT_LABEL, STOCK_MOVEMENT_TONE } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState, KpiCard, Stars } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';
import { StockDialog, StockOperation } from '../shared/stock-dialog';
import { Money } from '../../../domain/value-objects/money';

@Component({
  selector: 'app-admin-product-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, Badge, KpiCard, ProductImage, Icon, Stars, EmptyState, StockDialog],
  styles: `.top{display:grid;grid-template-columns:220px 1fr;gap:16px}.im{aspect-ratio:3/4;border-radius:14px;overflow:hidden}
    .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.g{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .hist{list-style:none;max-height:340px;overflow:auto}.hist li{padding:8px 16px;border-bottom:1px solid var(--line);font-size:13px}
    @media (max-width:900px){.top,.g{grid-template-columns:1fr}.kp{grid-template-columns:1fr 1fr}.im{max-width:200px}}`,
  template: `
    @if (view(); as v) {
      @let p = v.product;
      <nav class="breadcrumb"><a routerLink="/admin/produtos">Produtos</a> / <span>{{ p.name }}</span></nav>
      <div class="page-head">
        <div><h1>{{ p.name }}</h1><p class="mono">{{ p.sku }} · {{ v.category?.name }} · criado a {{ p.createdAt | date: 'dd/MM/yyyy' }} · actualizado {{ p.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</p></div>
        <div class="row wrap">
          <app-badge [label]="p.status === 'activo' ? 'Activo' : 'Inactivo'" [tone]="p.status === 'activo' ? 'success' : 'neutral'" />
          @if (v.visible) { <a class="btn ghost sm" [routerLink]="['/produto', p.id]" target="_blank"><app-icon name="external" [size]="14" /> Ver na loja</a> }
          <button type="button" class="btn ghost sm" (click)="toggle()">{{ p.status === 'activo' ? 'Desactivar' : 'Activar' }}</button>
          <button type="button" class="btn ghost sm" (click)="stockOp.set('entrada')"><app-icon name="box" [size]="14" /> Movimentar stock</button>
          <a class="btn sm" [routerLink]="['/admin/produtos', p.id, 'editar']"><app-icon name="edit" [size]="14" /> Editar</a>
        </div>
      </div>

      <div class="top">
        <div class="im"><app-product-image [images]="p.images" [type]="p.illustration.type" [pattern]="p.illustration.pattern" [color]="p.variants.colors[0]" /></div>
        <div class="stack">
          <div class="kp">
            <app-kpi label="Preço na loja" [value]="m(v.quote.price)" [sub]="v.quote.source === 'campanha' ? 'Campanha: ' + v.quote.campaign?.name : v.quote.source === 'produto' ? 'Preço promocional' : 'Preço de venda'" icon="tag" tone="brand" />
            <app-kpi label="Custo / margem" [value]="m(p.costPrice)" [sub]="'Margem ' + marginPct() + '%'" icon="wallet" />
            <app-kpi label="Stock disponível" [value]="v.available" [sub]="p.stock + ' físico · ' + p.reserved + ' reservado · mín. ' + p.minStock" icon="box" [tone]="v.level === 'ok' ? 'success' : v.level === 'baixo' ? 'warning' : 'danger'" />
            <app-kpi label="Vendidos" [value]="v.sold" [sub]="'Receita ' + m(revenue())" icon="chart" tone="info" />
          </div>
          <div class="card pad small">
            <div class="kv"><span>Preço de venda</span><span>{{ p.price | mzn }}</span></div>
            <div class="kv"><span>Preço promocional</span><span>{{ p.promoPrice ? (p.promoPrice | mzn) : '—' }}</span></div>
            <div class="kv"><span>Tamanhos</span><span>{{ p.variants.sizes.join(', ') }}</span></div>
            <div class="kv"><span>Cores</span><span>{{ p.variants.colors.join(', ') }}</span></div>
            <div class="kv"><span>Avaliação</span><span><app-stars [value]="v.rating" [count]="v.reviewCount" /></span></div>
            <div class="kv"><span>Feito em MZ</span><span>{{ p.madeInMz ? 'Sim' : 'Não' }}</span></div>
          </div>
        </div>
      </div>

      <div class="g">
        <div class="card">
          <div class="card-head"><h3>Movimentações de stock</h3><a class="link xs" routerLink="/admin/stock" [queryParams]="{ produto: p.id }">Ver todas</a></div>
          <ul class="hist">
            @for (mv of movements(); track mv.id) {
              <li class="row between">
                <span><app-badge [label]="mvLabel[mv.type]" [tone]="mvTone[mv.type]" /> {{ mv.reason }} @if (mv.orderNumber) { <span class="mono xs">{{ mv.orderNumber }}</span> }</span>
                <span class="right nowrap"><b>{{ mv.type === 'saida' || mv.type === 'venda' ? '−' : mv.type === 'entrada' ? '+' : '' }}{{ mv.qty }}</b><br /><span class="muted xs">{{ mv.at | date: 'dd/MM/yy HH:mm' }}</span></span>
              </li>
            } @empty { <li class="muted">Sem movimentações.</li> }
          </ul>
        </div>
        <div class="card">
          <div class="card-head"><h3>Histórico de alterações</h3></div>
          <ul class="hist">
            @for (h of history(); track $index) {
              <li><b>{{ h.message }}</b><div class="muted xs">{{ h.at | date: 'dd/MM/yyyy HH:mm' }} · {{ h.by }}</div></li>
            }
          </ul>
        </div>
      </div>

      @if (stockOp(); as op) { <app-stock-dialog [product]="p" [initialOp]="op" (closed)="stockOp.set(null)" /> }
    } @else {
      <app-empty icon="tag" title="Produto não encontrado"><a class="btn" routerLink="/admin/produtos">Voltar</a></app-empty>
    }
  `,
})
export class ProductDetailPage {
  readonly id = input.required<string>();
  private readonly queries = inject(CatalogQueries);
  private readonly catalog = inject(CatalogStore);
  private readonly inventory = inject(InventoryStore);
  private readonly sales = inject(SalesStore);
  private readonly toast = inject(ToastService);
  protected readonly mvLabel = STOCK_MOVEMENT_LABEL;
  protected readonly mvTone = STOCK_MOVEMENT_TONE;
  protected readonly m = Money.format;
  protected readonly stockOp = signal<StockOperation | null>(null);

  protected readonly view = computed(() => this.queries.view(this.id()));
  protected readonly movements = computed(() => this.inventory.forProduct(this.id()).slice(0, 30));
  protected readonly history = computed(() => [...(this.view()?.product.history ?? [])].reverse());
  protected readonly marginPct = computed(() => {
    const v = this.view();
    return v && v.quote.price ? Math.round(((v.quote.price - v.product.costPrice) / v.quote.price) * 100) : 0;
  });
  protected readonly revenue = computed(() =>
    this.sales
      .orders()
      .filter((o) => o.status !== 'cancelada')
      .flatMap((o) => o.items)
      .filter((i) => i.productId === this.id())
      .reduce((s, i) => s + i.unitPrice * i.qty, 0),
  );

  async toggle(): Promise<void> {
    const p = this.view()!.product;
    try {
      await this.catalog.setProductStatus(p.id, p.status !== 'activo');
      this.toast.success('Estado actualizado');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
