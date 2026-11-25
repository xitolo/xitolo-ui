import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { inRange, rangeFromPreset } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { PAYMENT_METHODS, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE, PaymentStatus } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { Badge, EmptyState, KpiCard, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';
import { PaymentActions } from '../shared/payment-actions';
import { PeriodFilter, downloadCsv } from '../shared/period-filter';

@Component({
  selector: 'app-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, PhonePipe, Badge, KpiCard, Pagination, EmptyState, PaymentActions, PeriodFilter, Icon],
  styles: `.k{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}@media (max-width:1100px){.k{grid-template-columns:repeat(2,1fr)}}`,
  template: `
    <div class="page-head">
      <div><h1>Pagamentos e receitas</h1><p>Só pagamentos confirmados contam como valor recebido.</p></div>
      <div class="row wrap"><app-period-filter [(range)]="range" /><button type="button" class="btn ghost sm" (click)="export()"><app-icon name="download" [size]="16" /> CSV</button></div>
    </div>
    <div class="k">
      <app-kpi label="Total recebido" [value]="m(sum('confirmado'))" [sub]="count('confirmado') + ' pagamentos'" icon="check-circle" tone="success" />
      <app-kpi label="Por receber" [value]="m(sum('pendente'))" [sub]="count('pendente') + ' pendentes'" icon="clock" tone="warning" />
      <app-kpi label="Rejeitados" [value]="m(sum('rejeitado'))" [sub]="count('rejeitado') + ' pagamentos'" icon="x" tone="danger" />
      <app-kpi label="Reembolsados" [value]="m(sum('reembolsado'))" [sub]="count('reembolsado') + ' pagamentos'" icon="return" />
      <app-kpi label="Comissões estimadas" [value]="m(fees())" sub="M-Pesa / e-Mola (1,5%)" icon="percent" tone="info" />
    </div>
    <div class="tabs" style="margin-bottom:12px">
      <button type="button" [class.on]="!status()" (click)="status.set(''); page.set(1)">Todos</button>
      @for (s of statuses; track s) { <button type="button" [class.on]="status() === s" (click)="status.set(s); page.set(1)">{{ label[s] }} ({{ count(s) }})</button> }
    </div>
    <div class="card">
      <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
        <div class="search-box" style="height:36px;flex:1;min-width:200px"><app-icon name="search" />
          <input placeholder="Referência, encomenda ou cliente" [value]="q()" (input)="q.set($any($event.target).value); page.set(1)" aria-label="Pesquisar" /></div>
        <select class="select sm" style="width:auto" [value]="method()" (change)="method.set($any($event.target).value); page.set(1)" aria-label="Método">
          <option value="">Todos os métodos</option>
          @for (mm of methods; track mm.id) { <option [value]="mm.id">{{ mm.label }}</option> }
        </select>
      </div>
      @if (filtered().length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Referência</th><th>Encomenda</th><th>Cliente</th><th>Método</th><th class="num">Valor</th><th class="num">Comissão</th><th>Estado</th><th>Acções</th></tr></thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr>
                  <td><span class="mono small">{{ p.reference }}</span><div class="muted xs">{{ p.createdAt | date: 'dd/MM/yy HH:mm' }}</div></td>
                  <td><a class="link mono small" [routerLink]="['/admin/encomendas', p.orderId]">{{ p.orderNumber }}</a></td>
                  <td>{{ p.customerName }}@if (p.phone) { <div class="muted xs">{{ p.phone | phone }}</div> }</td>
                  <td><span class="row" style="--gap:6px"><i [style.background]="methodsMap[p.method].color" style="width:8px;height:8px;border-radius:50%"></i>{{ methodsMap[p.method].label }}</span></td>
                  <td class="num"><b>{{ p.amount | mzn }}</b></td>
                  <td class="num muted">{{ p.fee ? (p.fee | mzn) : '—' }}</td>
                  <td><app-badge [label]="label[p.status]" [tone]="tone[p.status]" />@if (p.confirmedAt) { <div class="muted xs">{{ p.confirmedAt | date: 'dd/MM HH:mm' }}</div> }</td>
                  <td><app-payment-actions [payment]="p" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [total]="filtered().length" [(page)]="page" [(size)]="size" />
      } @else {
        <app-empty icon="wallet" title="Sem pagamentos" text="Não há pagamentos com estes filtros." />
      }
    </div>
  `,
})
export class PaymentsPage {
  readonly estado = input<string>('');
  private readonly sales = inject(SalesStore);
  protected readonly label = PAYMENT_STATUS_LABEL;
  protected readonly tone = PAYMENT_STATUS_TONE;
  protected readonly methods = Object.values(PAYMENT_METHODS);
  protected readonly methodsMap = PAYMENT_METHODS;
  protected readonly statuses: PaymentStatus[] = ['pendente', 'confirmado', 'rejeitado', 'reembolsado'];
  protected readonly m = Money.format;

  protected readonly status = linkedSignal(() => (this.estado() ?? '') as PaymentStatus | '');
  protected readonly method = signal('');
  protected readonly q = signal('');
  protected readonly range = signal(rangeFromPreset('all'));
  protected readonly page = signal(1);
  protected readonly size = signal(20);

  private readonly scoped = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.sales
      .payments()
      .filter(
        (p) =>
          inRange(p.createdAt, this.range()) &&
          (!this.method() || p.method === this.method()) &&
          (!q || p.reference.toLowerCase().includes(q) || p.orderNumber.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q)),
      );
  });
  protected readonly filtered = computed(() => this.scoped().filter((p) => !this.status() || p.status === this.status()));
  protected readonly rows = computed(() => paginate(this.filtered(), this.page(), this.size()));
  protected readonly fees = computed(() => this.scoped().filter((p) => p.status === 'confirmado').reduce((s, p) => s + p.fee, 0));

  sum(s: PaymentStatus): number {
    return this.scoped()
      .filter((p) => p.status === s)
      .reduce((a, p) => a + p.amount, 0);
  }
  count(s: PaymentStatus): number {
    return this.scoped().filter((p) => p.status === s).length;
  }

  export(): void {
    downloadCsv(
      'pagamentos-xitolo.csv',
      ['Referência', 'Data', 'Encomenda', 'Cliente', 'Método', 'Valor', 'Comissão', 'Estado', 'Confirmado em'],
      this.filtered().map((p) => [
        p.reference, new Date(p.createdAt).toLocaleString('pt-PT'), p.orderNumber, p.customerName, PAYMENT_METHODS[p.method].label,
        p.amount, p.fee, PAYMENT_STATUS_LABEL[p.status], p.confirmedAt ? new Date(p.confirmedAt).toLocaleString('pt-PT') : '',
      ]),
    );
  }
}
