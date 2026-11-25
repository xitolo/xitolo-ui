import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CatalogStore } from '../../../application/catalog.store';
import { InventoryStore } from '../../../application/inventory.store';
import { Product } from '../../../domain/entities';
import { inRange, rangeFromPreset } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { STOCK_MOVEMENT_LABEL, STOCK_MOVEMENT_TONE, StockMovementType } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState, KpiCard, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';
import { PeriodFilter, downloadCsv } from '../shared/period-filter';
import { StockDialog, StockOperation } from '../shared/stock-dialog';

@Component({
  selector: 'app-inventory-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, Badge, KpiCard, Pagination, EmptyState, ProductImage, Icon, StockDialog, PeriodFilter],
  styles: `.k{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}@media (max-width:1100px){.k{grid-template-columns:repeat(2,1fr)}}
    .rule{font-size:12.5px}`,
  template: `
    <div class="page-head">
      <div><h1>Stock</h1><p>Disponível = físico − reservado. Encomendas reservam ao serem criadas, libertam ao serem canceladas e dão saída ao serem entregues.</p></div>
    </div>
    <div class="k">
      <app-kpi label="Unidades em armazém" [value]="s().units" [sub]="s().reserved + ' reservadas · ' + s().available + ' disponíveis'" icon="box" />
      <app-kpi label="Valor do inventário (custo)" [value]="m(s().costValue)" icon="wallet" tone="info" />
      <app-kpi label="Valor a preço de venda" [value]="m(s().retailValue)" icon="tag" />
      <app-kpi label="Stock reduzido" [value]="s().low.length" sub="produtos activos" icon="alert" tone="warning" />
      <app-kpi label="Sem stock" [value]="s().out.length" sub="produtos activos" icon="x" tone="danger" />
    </div>

    <div class="tabs" style="margin-bottom:12px">
      <button type="button" [class.on]="tab() === 'stock'" (click)="tab.set('stock')">Stock por produto</button>
      <button type="button" [class.on]="tab() === 'mov'" (click)="tab.set('mov')">Histórico de movimentações</button>
    </div>

    @if (tab() === 'stock') {
      <div class="card">
        <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
          <div class="search-box" style="height:36px;flex:1;min-width:200px"><app-icon name="search" />
            <input placeholder="Produto ou SKU" [value]="q()" (input)="q.set($any($event.target).value); page.set(1)" aria-label="Pesquisar" /></div>
          <select class="select sm" style="width:auto" [value]="level()" (change)="level.set($any($event.target).value); page.set(1)" aria-label="Nível">
            <option value="">Todos</option><option value="alerta">Reduzido ou esgotado</option><option value="baixo">Stock reduzido</option><option value="esgotado">Sem stock</option>
          </select>
          <button type="button" class="btn ghost sm" (click)="exportStock()"><app-icon name="download" [size]="16" /> CSV</button>
        </div>
        @if (stockRows().length) {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Produto</th><th class="num">Físico</th><th class="num">Reservado</th><th class="num">Disponível</th><th class="num">Mínimo</th><th class="num">Valor (custo)</th><th>Nível</th><th></th></tr></thead>
            <tbody>
              @for (v of pagedStock(); track v.product.id) {
                <tr>
                  <td><div class="row" style="--gap:10px"><span class="thumb"><app-product-image [images]="v.product.images" [type]="v.product.illustration.type" [pattern]="v.product.illustration.pattern" [color]="v.product.variants.colors[0]" /></span>
                    <div><a class="strong small" [routerLink]="['/admin/produtos', v.product.id]">{{ v.product.name }}</a><div class="muted xs mono">{{ v.product.sku }}{{ v.product.status === 'inactivo' ? ' · inactivo' : '' }}</div></div></div></td>
                  <td class="num">{{ v.product.stock }}</td>
                  <td class="num">{{ v.product.reserved }}</td>
                  <td class="num"><b>{{ v.available }}</b></td>
                  <td class="num">{{ v.product.minStock }}</td>
                  <td class="num">{{ v.product.stock * v.product.costPrice | mzn }}</td>
                  <td><app-badge [label]="v.level === 'ok' ? 'Normal' : v.level === 'baixo' ? 'Reduzido' : 'Esgotado'" [tone]="v.level === 'ok' ? 'success' : v.level === 'baixo' ? 'warning' : 'danger'" /></td>
                  <td class="nowrap">
                    <button type="button" class="btn xs" (click)="openOp(v.product, 'entrada')">+ Entrada</button>
                    <button type="button" class="btn ghost xs" (click)="openOp(v.product, 'saida')">Saída</button>
                    <button type="button" class="btn ghost xs" (click)="openOp(v.product, 'ajuste')">Ajustar</button>
                  </td>
                </tr>
              }
            </tbody></table></div>
          <app-pagination [total]="stockRows().length" [(page)]="page" [(size)]="size" />
        } @else { <app-empty icon="box" title="Nenhum produto" /> }
      </div>
    } @else {
      <div class="card">
        <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
          <select class="select sm" style="width:auto;max-width:260px" [value]="productFilter()" (change)="productFilter.set($any($event.target).value); mpage.set(1)" aria-label="Produto">
            <option value="">Todos os produtos</option>
            @for (p of catalog.products(); track p.id) { <option [value]="p.id" [selected]="p.id === productFilter()">{{ p.name }}</option> }
          </select>
          <select class="select sm" style="width:auto" [value]="type()" (change)="type.set($any($event.target).value); mpage.set(1)" aria-label="Tipo">
            <option value="">Todos os tipos</option>
            @for (t of types; track t) { <option [value]="t">{{ mvLabel[t] }}</option> }
          </select>
          <app-period-filter [(range)]="range" />
        </div>
        @if (movements().length) {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="num">Qtd.</th><th class="num">Físico após</th><th class="num">Reservado após</th><th>Motivo</th><th>Por</th></tr></thead>
            <tbody>
              @for (mv of pagedMov(); track mv.id) {
                <tr>
                  <td class="nowrap small">{{ mv.at | date: 'dd/MM/yy HH:mm' }}</td>
                  <td class="small">{{ mv.productName }}</td>
                  <td><app-badge [label]="mvLabel[mv.type]" [tone]="mvTone[mv.type]" /></td>
                  <td class="num"><b>{{ sign(mv.type) }}{{ mv.qty }}</b></td>
                  <td class="num">{{ mv.stockAfter }}</td>
                  <td class="num">{{ mv.reservedAfter }}</td>
                  <td class="small">{{ mv.reason }} @if (mv.orderNumber) { <span class="mono xs muted">{{ mv.orderNumber }}</span> }</td>
                  <td class="small">{{ mv.by }}</td>
                </tr>
              }
            </tbody></table></div>
          <app-pagination [total]="movements().length" [(page)]="mpage" [(size)]="msize" />
        } @else { <app-empty icon="refresh" title="Sem movimentações" /> }
      </div>
    }

    @if (op(); as o) { <app-stock-dialog [product]="o.product" [initialOp]="o.op" (closed)="op.set(null)" /> }
  `,
})
export class InventoryPage {
  readonly nivel = input<string>('');
  readonly produto = input<string>('');
  private readonly inventory = inject(InventoryStore);
  protected readonly catalog = inject(CatalogStore);
  private readonly queries = inject(CatalogQueries);
  protected readonly mvLabel = STOCK_MOVEMENT_LABEL;
  protected readonly mvTone = STOCK_MOVEMENT_TONE;
  protected readonly types = Object.keys(STOCK_MOVEMENT_LABEL) as StockMovementType[];
  protected readonly m = Money.format;
  protected readonly s = this.inventory.summary;

  protected readonly tab = linkedSignal<'stock' | 'mov'>(() => (this.produto() ? 'mov' : 'stock'));
  protected readonly q = signal('');
  protected readonly level = linkedSignal(() => this.nivel() ?? '');
  protected readonly page = signal(1);
  protected readonly size = signal(20);
  protected readonly productFilter = linkedSignal(() => this.produto() ?? '');
  protected readonly type = signal('');
  protected readonly range = signal(rangeFromPreset('all'));
  protected readonly mpage = signal(1);
  protected readonly msize = signal(20);
  protected readonly op = signal<{ product: Product; op: StockOperation } | null>(null);

  protected readonly stockRows = computed(() => {
    const q = this.q().trim().toLowerCase();
    const lv = this.level();
    return this.queries
      .all()
      .filter(
        (v) =>
          (!q || v.product.name.toLowerCase().includes(q) || v.product.sku.toLowerCase().includes(q)) &&
          (!lv || (lv === 'alerta' ? v.level !== 'ok' && v.product.status === 'activo' : v.level === lv)),
      )
      .sort((a, b) => a.available - a.product.minStock - (b.available - b.product.minStock));
  });
  protected readonly pagedStock = computed(() => paginate(this.stockRows(), this.page(), this.size()));
  protected readonly movements = computed(() =>
    this.inventory
      .movements()
      .filter(
        (m) => (!this.productFilter() || m.productId === this.productFilter()) && (!this.type() || m.type === this.type()) && inRange(m.at, this.range()),
      ),
  );
  protected readonly pagedMov = computed(() => paginate(this.movements(), this.mpage(), this.msize()));

  openOp(product: Product, op: StockOperation): void {
    this.op.set({ product, op });
  }

  sign(t: StockMovementType): string {
    return t === 'entrada' ? '+' : t === 'saida' || t === 'venda' ? '−' : '';
  }

  exportStock(): void {
    downloadCsv(
      'stock-xitolo.csv',
      ['SKU', 'Produto', 'Físico', 'Reservado', 'Disponível', 'Mínimo', 'Custo unit.', 'Valor (custo)', 'Nível'],
      this.stockRows().map((v) => [v.product.sku, v.product.name, v.product.stock, v.product.reserved, v.available, v.product.minStock, v.product.costPrice, v.product.stock * v.product.costPrice, v.level]),
    );
  }
}
