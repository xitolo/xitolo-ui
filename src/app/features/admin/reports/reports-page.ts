import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { CatalogQueries } from '../../../application/catalog-queries.service';
import { CustomerStore } from '../../../application/customer.store';
import { ReportingService } from '../../../application/reporting.service';
import { SalesStore } from '../../../application/sales.store';
import { isDeliveryLate } from '../../../domain/entities';
import { DateRange, inRange, rangeFromPreset } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { PROVINCES } from '../../../domain/value-objects/shipping';
import {
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PaymentMethod,
  PaymentStatus,
} from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { EmptyState } from '../../../shared/components/ui';
import { PeriodFilter, downloadCsv } from '../shared/period-filter';

type ReportId = 'vendas' | 'receitas' | 'pagamentos' | 'encomendas' | 'entregas' | 'stock' | 'top' | 'clientes';
type Cell = string | number;
interface Report {
  title: string;
  description: string;
  header: string[];
  /** Índices das colunas monetárias. */
  money: number[];
  rows: Cell[][];
  totals?: Cell[];
}

const REPORTS: { id: ReportId; label: string; icon: string }[] = [
  { id: 'vendas', label: 'Vendas', icon: 'chart' },
  { id: 'receitas', label: 'Receitas', icon: 'wallet' },
  { id: 'pagamentos', label: 'Pagamentos', icon: 'card' },
  { id: 'encomendas', label: 'Encomendas', icon: 'package' },
  { id: 'entregas', label: 'Entregas', icon: 'truck' },
  { id: 'stock', label: 'Stock', icon: 'box' },
  { id: 'top', label: 'Mais vendidos', icon: 'star' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
];

@Component({
  selector: 'app-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodFilter, Icon, EmptyState],
  styles: `.types{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:14px}
    .types button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:12px;background:#fff;border:1px solid var(--line);font-size:13px;font-weight:600;color:var(--ink-2)}
    .types button.on{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);color:var(--ink)}
    @media (max-width:1100px){.types{grid-template-columns:repeat(4,1fr)}}
    @media print{.types,.no-print{display:none!important}}`,
  template: `
    <div class="page-head">
      <div><h1>Relatórios</h1><p>Escolha o relatório e o período. Pode exportar para CSV (Excel) ou imprimir.</p></div>
      <app-period-filter [(range)]="range" class="no-print" />
    </div>
    <div class="types">
      @for (t of types; track t.id) {
        <button type="button" [class.on]="type() === t.id" (click)="type.set(t.id)"><app-icon [name]="t.icon" />{{ t.label }}</button>
      }
    </div>
    @let r = report();
    <div class="card">
      <div class="card-head">
        <div><h3>{{ r.title }}</h3><span class="muted xs">{{ r.description }} · {{ periodText() }}</span></div>
        <div class="row no-print">
          <button type="button" class="btn ghost sm" (click)="print()"><app-icon name="file" [size]="16" /> Imprimir</button>
          <button type="button" class="btn sm" (click)="export()" [disabled]="!r.rows.length"><app-icon name="download" [size]="16" /> Exportar CSV</button>
        </div>
      </div>
      @if (r.rows.length) {
        <div class="table-wrap"><table class="table">
          <thead><tr>@for (h of r.header; track $index) { <th [class.num]="$index > 0 && isNum(r, $index)">{{ h }}</th> }</tr></thead>
          <tbody>
            @for (row of r.rows; track $index) {
              <tr>@for (c of row; track $index) { <td [class.num]="$index > 0 && isNum(r, $index)">{{ fmt(r, $index, c) }}</td> }</tr>
            }
          </tbody>
          @if (r.totals) {
            <tfoot><tr>@for (c of r.totals; track $index) { <td [class.num]="$index > 0 && isNum(r, $index)">{{ fmt(r, $index, c) }}</td> }</tr></tfoot>
          }
        </table></div>
      } @else {
        <app-empty icon="file" title="Sem dados no período" text="Experimente um período mais alargado." />
      }
    </div>
  `,
})
export class ReportsPage {
  readonly tipo = input<string>('');
  private readonly reports = inject(ReportingService);
  private readonly sales = inject(SalesStore);
  private readonly queries = inject(CatalogQueries);
  private readonly customers = inject(CustomerStore);
  protected readonly types = REPORTS;
  protected readonly type = linkedSignal<ReportId>(() => (this.tipo() as ReportId) || 'vendas');
  protected readonly range = signal<DateRange>(rangeFromPreset('30d'));

  protected readonly periodText = computed(() => {
    const r = this.range();
    return r.from.getFullYear() < 2001 ? 'todo o período' : `${r.from.toLocaleDateString('pt-PT')} a ${r.to.toLocaleDateString('pt-PT')}`;
  });

  protected readonly report = computed<Report>(() => {
    const range = this.range();
    const orders = this.sales.orders().filter((o) => inRange(o.createdAt, range));
    const sum = (rows: Cell[][], i: number) => rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);

    switch (this.type()) {
      case 'vendas': {
        const rows: Cell[][] = this.reports
          .series(range, 'day')
          .filter((p) => p.orders || p.received)
          .reverse()
          .map((p) => [p.key.split('-').reverse().join('/'), p.orders, p.sold, p.received, p.orders ? Math.round(p.sold / p.orders) : 0]);
        return { title: 'Relatório de vendas', description: 'Por dia (encomendas não canceladas)', header: ['Dia', 'Encomendas', 'Valor vendido', 'Valor recebido', 'Ticket médio'], money: [2, 3, 4], rows,
          totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 1) ? Math.round(sum(rows, 2) / sum(rows, 1)) : 0] };
      }
      case 'receitas': {
        const f = this.reports.financial(range);
        const rows: Cell[][] = [
          ['Valor vendido (encomendas activas)', f.soldValue],
          ['Valor recebido (pagamentos confirmados)', f.receivedValue],
          ['Valor pendente', f.pendingValue],
          ['Receita bruta (produtos + entregas pagas)', f.grossRevenue],
          ['(−) Descontos de cupões', -f.discounts],
          ['(−) Comissões de pagamento', -f.paymentFees],
          ['(−) IVA incluído (16%)', -f.vat],
          ['Receita líquida estimada', f.netRevenue],
          ['(−) Custo dos produtos vendidos', -f.productCost],
          ['(−) Custo operacional das entregas', -f.deliveryCost],
          ['Lucro estimado', f.estimatedProfit],
          ['Valor de encomendas canceladas', f.cancelledValue],
          ['Valor reembolsado', f.refundedValue],
        ];
        return { title: 'Relatório de receitas', description: 'Demonstração de resultados estimada', header: ['Indicador', 'Valor'], money: [1], rows };
      }
      case 'pagamentos': {
        const pays = this.sales.payments().filter((p) => inRange(p.createdAt, range));
        const statuses: PaymentStatus[] = ['confirmado', 'pendente', 'rejeitado', 'reembolsado'];
        const rows: Cell[][] = (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => {
          const ps = pays.filter((p) => p.method === m);
          const by = (s: PaymentStatus) => ps.filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0);
          return [PAYMENT_METHODS[m].label, ps.length, ...statuses.map(by), ps.reduce((a, p) => a + p.fee, 0)];
        });
        return { title: 'Relatório de pagamentos', description: 'Por método e estado', header: ['Método', 'Transacções', ...statuses.map((s) => PAYMENT_STATUS_LABEL[s]), 'Comissões'], money: [2, 3, 4, 5, 6], rows,
          totals: ['Total', ...[1, 2, 3, 4, 5, 6].map((i) => sum(rows, i))] };
      }
      case 'encomendas': {
        const all: OrderStatus[] = [...ORDER_FLOW, 'cancelada'];
        const rows: Cell[][] = all.map((s) => {
          const os = orders.filter((o) => o.status === s);
          return [ORDER_STATUS_LABEL[s], os.length, orders.length ? `${Math.round((os.length / orders.length) * 100)}%` : '0%', os.reduce((a, o) => a + o.total, 0)];
        });
        return { title: 'Relatório de encomendas', description: 'Por estado', header: ['Estado', 'Encomendas', '% do total', 'Valor'], money: [3], rows, totals: ['Total', orders.length, '100%', sum(rows, 3)] };
      }
      case 'entregas': {
        const ds = this.sales.deliveries().filter((d) => inRange(d.createdAt, range));
        const rows: Cell[][] = PROVINCES.map((p) => {
          const x = ds.filter((d) => d.address.province === p.name && d.status !== 'cancelada');
          const fee = x.reduce((a, d) => a + d.fee, 0);
          const cost = x.reduce((a, d) => a + d.cost, 0);
          return [p.name, x.length, x.filter((d) => d.status === 'concluida').length, x.filter((d) => isDeliveryLate(d)).length, fee, cost, fee - cost];
        }).filter((r) => r[1]);
        return { title: 'Relatório de entregas', description: 'Por província', header: ['Província', 'Entregas', 'Concluídas', 'Atrasadas', 'Cobrado', 'Custo', 'Margem'], money: [4, 5, 6], rows,
          totals: ['Total', ...[1, 2, 3, 4, 5, 6].map((i) => sum(rows, i))] };
      }
      case 'stock': {
        const rows: Cell[][] = this.queries.all().map((v) => [v.product.name, v.product.stock, v.product.reserved, v.available, v.product.minStock, v.product.stock * v.product.costPrice, v.product.stock * v.product.price, v.level === 'ok' ? 'Normal' : v.level === 'baixo' ? 'Reduzido' : 'Esgotado']);
        return { title: 'Relatório de stock', description: 'Situação actual (não depende do período)', header: ['Produto', 'Físico', 'Reservado', 'Disponível', 'Mínimo', 'Valor custo', 'Valor venda', 'Nível'], money: [5, 6], rows,
          totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3), '', sum(rows, 5), sum(rows, 6), ''] };
      }
      case 'top': {
        const cost = new Map<string, number>();
        for (const o of orders) if (o.status !== 'cancelada') for (const i of o.items) cost.set(i.productId, (cost.get(i.productId) ?? 0) + i.unitCost * i.qty);
        const rows: Cell[][] = this.reports.topProducts(range, 50).map((r, i) => [`${i + 1}. ${r.label}`, r.qty, r.value, cost.get(r.id) ?? 0, r.value - (cost.get(r.id) ?? 0)]);
        return { title: 'Produtos mais vendidos', description: 'Por unidades vendidas', header: ['Produto', 'Unidades', 'Receita', 'Custo', 'Margem bruta'], money: [2, 3, 4], rows,
          totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 4)] };
      }
      case 'clientes': {
        const rows: Cell[][] = this.customers
          .customers()
          .map((c) => {
            const os = orders.filter((o) => o.customerId === c.id);
            const paid = os.filter((o) => o.status !== 'cancelada' && this.sales.paymentFor(o.id)?.status === 'confirmado');
            const spent = paid.reduce((a, o) => a + o.total, 0);
            return [c.name, os.length, paid.length, spent, paid.length ? Math.round(spent / paid.length) : 0] as Cell[];
          })
          .filter((r) => r[1])
          .sort((a, b) => Number(b[3]) - Number(a[3]));
        return { title: 'Relatório de clientes', description: 'Clientes com encomendas no período', header: ['Cliente', 'Encomendas', 'Pagas', 'Total pago', 'Valor médio'], money: [3, 4], rows,
          totals: ['Total', sum(rows, 1), sum(rows, 2), sum(rows, 3), ''] };
      }
    }
  });

  isNum(r: Report, i: number): boolean {
    return r.money.includes(i) || typeof r.rows[0]?.[i] === 'number';
  }

  fmt(r: Report, i: number, c: Cell): string {
    if (r.money.includes(i) && typeof c === 'number') return Money.format(c);
    return String(c);
  }

  export(): void {
    const r = this.report();
    downloadCsv(`relatorio-${this.type()}-xitolo.csv`, r.header, r.totals ? [...r.rows, r.totals] : r.rows);
  }

  print(): void {
    window.print();
  }
}
