import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerStore } from '../../../application/customer.store';
import { SalesStore } from '../../../application/sales.store';
import { orderUnits } from '../../../domain/entities';
import { inRange, rangeFromPreset } from '../../../domain/value-objects/date-range';
import { MzPhone } from '../../../domain/value-objects/mz-phone';
import { DELIVERY_METHOD_LABEL } from '../../../domain/value-objects/shipping';
import {
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { Badge, EmptyState, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';
import { PeriodFilter, downloadCsv } from '../shared/period-filter';

@Component({
  selector: 'app-admin-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MznPipe, Badge, Pagination, EmptyState, PeriodFilter, Icon],
  template: `
    <div class="page-head">
      <div><h1>Encomendas</h1><p>{{ filtered().length }} encomenda(s) · {{ total() | mzn }}</p></div>
      <div class="row wrap"><app-period-filter [(range)]="range" />
        <button type="button" class="btn ghost sm" (click)="export()"><app-icon name="download" [size]="16" /> CSV</button></div>
    </div>
    <div class="chips" style="margin-bottom:12px">
      <button type="button" class="chip" [class.on]="!status()" (click)="status.set(''); page.set(1)">Todas <span class="muted">{{ counts()['_'] }}</span></button>
      @for (s of statuses; track s) {
        <button type="button" class="chip" [class.on]="status() === s" (click)="status.set(s); page.set(1)">{{ label[s] }} <span class="muted">{{ counts()[s] ?? 0 }}</span></button>
      }
    </div>
    <div class="card">
      <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
        <div class="search-box" style="height:36px;flex:1;min-width:220px"><app-icon name="search" />
          <input placeholder="Nº da encomenda, cliente ou telefone" [value]="query()" (input)="query.set($any($event.target).value); page.set(1)" aria-label="Pesquisar" /></div>
        <select class="select sm" style="width:auto;max-width:220px" [value]="customer()" (change)="customer.set($any($event.target).value); page.set(1)" aria-label="Cliente">
          <option value="">Todos os clientes</option>
          @for (c of customers.customers(); track c.id) { <option [value]="c.id" [selected]="c.id === customer()">{{ c.name }}</option> }
        </select>
        <select class="select sm" style="width:auto" [value]="method()" (change)="method.set($any($event.target).value); page.set(1)" aria-label="Pagamento">
          <option value="">Todos os pagamentos</option>
          @for (m of methods; track m.id) { <option [value]="m.id">{{ m.label }}</option> }
        </select>
      </div>
      @if (filtered().length) {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Encomenda</th><th>Cliente</th><th class="num">Artigos</th><th class="num">Total</th><th>Pagamento</th><th>Entrega</th><th>Estado</th></tr></thead>
            <tbody>
              @for (o of rows(); track o.id) {
                @let p = sales.paymentFor(o.id);
                <tr class="clickable" (click)="router.navigate(['/admin/encomendas', o.id])">
                  <td><b class="mono">{{ o.number }}</b><div class="muted xs">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</div></td>
                  <td>{{ o.customerName }}<div class="muted xs">{{ o.address?.province ?? 'Levantamento' }}</div></td>
                  <td class="num">{{ units(o) }}</td>
                  <td class="num"><b>{{ o.total | mzn }}</b></td>
                  <td>{{ pay[o.paymentMethod].label }}@if (p) { <div><app-badge [label]="payLabel[p.status]" [tone]="payTone[p.status]" /></div> }</td>
                  <td class="small">{{ dlvLabel[o.deliveryMethod] }}</td>
                  <td><app-badge [label]="label[o.status]" [tone]="tone[o.status]" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [total]="filtered().length" [(page)]="page" [(size)]="size" />
      } @else {
        <app-empty icon="package" title="Nenhuma encomenda" text="Não há encomendas com estes filtros." />
      }
    </div>
  `,
})
export class OrdersPage {
  readonly q = input<string>('');
  readonly estado = input<string>('');
  protected readonly sales = inject(SalesStore);
  protected readonly customers = inject(CustomerStore);
  protected readonly router = inject(Router);

  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly payLabel = PAYMENT_STATUS_LABEL;
  protected readonly payTone = PAYMENT_STATUS_TONE;
  protected readonly pay = PAYMENT_METHODS;
  protected readonly methods = Object.values(PAYMENT_METHODS);
  protected readonly dlvLabel = DELIVERY_METHOD_LABEL;
  protected readonly statuses: OrderStatus[] = [...ORDER_FLOW, 'cancelada'];
  protected readonly units = orderUnits;

  protected readonly query = linkedSignal(() => this.q() ?? '');
  protected readonly status = linkedSignal(() => (this.estado() ?? '') as OrderStatus | '');
  protected readonly customer = signal('');
  protected readonly method = signal('');
  protected readonly range = signal(rangeFromPreset('all'));
  protected readonly page = signal(1);
  protected readonly size = signal(20);

  private readonly base = computed(() => {
    const q = this.query().trim().toLowerCase();
    const digits = MzPhone.normalize(q);
    return this.sales.orders().filter(
      (o) =>
        inRange(o.createdAt, this.range()) &&
        (!this.customer() || o.customerId === this.customer()) &&
        (!this.method() || o.paymentMethod === this.method()) &&
        (!q || o.number.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || (digits.length >= 4 && o.customerPhone.includes(digits))),
    );
  });
  protected readonly counts = computed(() => {
    const c: Record<string, number> = { _: this.base().length };
    for (const o of this.base()) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  });
  protected readonly filtered = computed(() => this.base().filter((o) => !this.status() || o.status === this.status()));
  protected readonly rows = computed(() => paginate(this.filtered(), this.page(), this.size()));
  protected readonly total = computed(() => this.filtered().reduce((s, o) => s + o.total, 0));

  export(): void {
    downloadCsv(
      'encomendas-xitolo.csv',
      ['Nº', 'Data', 'Cliente', 'Telefone', 'Província', 'Artigos', 'Subtotal', 'Desconto', 'Entrega', 'Total', 'Pagamento', 'Estado pagamento', 'Estado'],
      this.filtered().map((o) => [
        o.number, new Date(o.createdAt).toLocaleString('pt-PT'), o.customerName, o.customerPhone, o.address?.province ?? 'Levantamento',
        orderUnits(o), o.subtotal, o.discount, o.shippingFee, o.total, PAYMENT_METHODS[o.paymentMethod].label,
        PAYMENT_STATUS_LABEL[this.sales.paymentFor(o.id)?.status ?? 'pendente'], ORDER_STATUS_LABEL[o.status],
      ]),
    );
  }
}
