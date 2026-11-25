import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReportingService } from '../../../application/reporting.service';
import { SalesStore } from '../../../application/sales.store';
import { ToastService } from '../../../core/services/toast.service';
import { Delivery, Order, isDeliveryLate } from '../../../domain/entities';
import { inRange, rangeFromPreset } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { DELIVERY_STATUS_LABEL, DELIVERY_STATUS_TONE, ORDER_STATUS_LABEL, OrderStatus } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { Badge, EmptyState, KpiCard, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';
import { DeliveryDialog } from '../shared/delivery-dialog';
import { PeriodFilter } from '../shared/period-filter';

type View = 'todas' | 'registar' | 'pendente' | 'em_curso' | 'concluida' | 'atrasadas' | 'cancelada';

@Component({
  selector: 'app-deliveries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, PhonePipe, Badge, KpiCard, Pagination, EmptyState, DeliveryDialog, PeriodFilter, Icon],
  styles: `.k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}@media (max-width:1000px){.k{grid-template-columns:repeat(2,1fr)}}`,
  template: `
    <div class="page-head">
      <div><h1>Entregas</h1><p>Cada entrega está associada a uma encomenda; o estado de uma actualiza o da outra.</p></div>
      <app-period-filter [(range)]="range" />
    </div>
    <div class="k">
      <app-kpi label="Total de entregas" [value]="perf().total" [sub]="perf().completed + ' concluídas · ' + perf().pending + ' pendentes · ' + perf().inProgress + ' em andamento'" icon="truck" />
      <app-kpi label="Atrasadas" [value]="perf().late" [sub]="perf().onTimeRate + '% concluídas no prazo'" icon="alert" tone="danger" />
      <app-kpi label="Total cobrado / custos" [value]="m(perf().feesCharged)" [sub]="'Custos operacionais ' + m(perf().operationalCost)" icon="cash" />
      <app-kpi label="Margem estimada" [value]="m(perf().margin)" [sub]="'Tempo médio ' + perf().averageDays.toString().replace('.', ',') + ' dias'" icon="chart" [tone]="perf().margin >= 0 ? 'success' : 'danger'" />
    </div>
    <div class="tabs" style="margin-bottom:12px">
      @for (t of tabs; track t.id) {
        <button type="button" [class.on]="view() === t.id" (click)="view.set(t.id); page.set(1)">{{ t.label }}@if (t.id === 'registar' && awaiting().length) { ({{ awaiting().length }}) }</button>
      }
    </div>

    <div class="card">
      @if (view() === 'registar') {
        @if (awaiting().length) {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Encomenda</th><th>Cliente</th><th>Destino</th><th>Estado</th><th class="num">Taxa</th><th></th></tr></thead>
            <tbody>
              @for (o of awaiting(); track o.id) {
                <tr>
                  <td><a class="link mono small" [routerLink]="['/admin/encomendas', o.id]">{{ o.number }}</a><div class="muted xs">{{ o.createdAt | date: 'dd/MM HH:mm' }}</div></td>
                  <td>{{ o.customerName }}</td>
                  <td>{{ o.address?.city }}, {{ o.address?.province }}</td>
                  <td>{{ orderLabel[o.status] }}</td>
                  <td class="num">{{ o.shippingFee | mzn }}</td>
                  <td><button type="button" class="btn xs" (click)="register.set(o)">Registar entrega</button></td>
                </tr>
              }
            </tbody></table></div>
        } @else {
          <app-empty icon="check-circle" title="Nenhuma encomenda à espera" text="Todas as encomendas confirmadas já têm entrega registada." />
        }
      } @else {
        <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
          <div class="search-box" style="height:36px;flex:1;min-width:200px"><app-icon name="search" />
            <input placeholder="Encomenda, cliente, estafeta ou cidade" [value]="q()" (input)="q.set($any($event.target).value); page.set(1)" aria-label="Pesquisar" /></div>
        </div>
        @if (filtered().length) {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Encomenda</th><th>Cliente / destino</th><th>Responsável</th><th class="num">Cobrado</th><th class="num">Custo</th><th>Prazo</th><th>Saída / conclusão</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (d of rows(); track d.id) {
                @let o = sales.order(d.orderId);
                <tr>
                  <td><a class="link mono small" [routerLink]="['/admin/encomendas', d.orderId]">{{ d.orderNumber }}</a></td>
                  <td>{{ d.customerName }}<div class="muted xs">{{ d.address.city }}, {{ d.address.province }} · {{ d.phone | phone }}</div></td>
                  <td>{{ d.courier ?? '—' }}</td>
                  <td class="num">{{ d.fee | mzn }}</td>
                  <td class="num">{{ d.cost | mzn }}</td>
                  <td class="nowrap" [class.danger-text]="late(d)">{{ d.expectedBy | date: 'dd/MM/yy' }}</td>
                  <td class="xs muted nowrap">{{ d.dispatchedAt ? (d.dispatchedAt | date: 'dd/MM HH:mm') : '—' }}<br />{{ d.completedAt ? (d.completedAt | date: 'dd/MM HH:mm') : '' }}</td>
                  <td>
                    <app-badge [label]="dLabel[d.status]" [tone]="dTone[d.status]" />
                    @if (late(d)) { <div><app-badge label="Atrasada" tone="danger" /></div> }
                  </td>
                  <td class="nowrap">
                    @if (o && nextAction(o); as a) { <button type="button" class="btn xs" (click)="advance(o, a.to)" [disabled]="busy()">{{ a.label }}</button> }
                    @if (d.status === 'pendente' || d.status === 'em_curso') { <button type="button" class="icon-btn sm" title="Editar" (click)="edit.set(d)"><app-icon name="edit" /></button> }
                  </td>
                </tr>
              }
            </tbody></table></div>
          <app-pagination [total]="filtered().length" [(page)]="page" [(size)]="size" />
        } @else {
          <app-empty icon="truck" title="Sem entregas" text="Não há entregas com estes filtros." />
        }
      }
    </div>

    @if (register(); as o) { <app-delivery-dialog [order]="o" (closed)="register.set(null)" /> }
    @if (edit(); as d) { <app-delivery-dialog [order]="sales.order(d.orderId)!" [delivery]="d" (closed)="edit.set(null)" /> }
  `,
})
export class DeliveriesPage {
  readonly vista = input<string>('');
  protected readonly sales = inject(SalesStore);
  private readonly reports = inject(ReportingService);
  private readonly toast = inject(ToastService);
  protected readonly dLabel = DELIVERY_STATUS_LABEL;
  protected readonly dTone = DELIVERY_STATUS_TONE;
  protected readonly orderLabel = ORDER_STATUS_LABEL;
  protected readonly m = Money.format;
  protected readonly tabs: { id: View; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'registar', label: 'Por registar' },
    { id: 'pendente', label: 'Pendentes' },
    { id: 'em_curso', label: 'Em andamento' },
    { id: 'atrasadas', label: 'Atrasadas' },
    { id: 'concluida', label: 'Concluídas' },
    { id: 'cancelada', label: 'Canceladas' },
  ];

  protected readonly view = linkedSignal<View>(() => (this.vista() as View) || 'todas');
  protected readonly q = signal('');
  protected readonly range = signal(rangeFromPreset('all'));
  protected readonly page = signal(1);
  protected readonly size = signal(20);
  protected readonly busy = signal(false);
  protected readonly register = signal<Order | null>(null);
  protected readonly edit = signal<Delivery | null>(null);

  protected readonly perf = computed(() => this.reports.deliveries(this.range()));
  protected readonly awaiting = computed(() =>
    this.sales
      .orders()
      .filter((o) => o.deliveryMethod !== 'levantamento' && ['confirmada', 'em_preparacao', 'pronta_envio'].includes(o.status) && !this.sales.deliveryFor(o.id)),
  );
  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    const v = this.view();
    const now = new Date();
    return this.sales.deliveries().filter((d) => {
      if (!inRange(d.createdAt, this.range())) return false;
      if (v === 'atrasadas' && !(d.status !== 'concluida' && isDeliveryLate(d, now))) return false;
      if (['pendente', 'em_curso', 'concluida', 'cancelada'].includes(v) && d.status !== v) return false;
      return !q || [d.orderNumber, d.customerName, d.courier ?? '', d.address.city, d.address.province].join(' ').toLowerCase().includes(q);
    });
  });
  protected readonly rows = computed(() => paginate(this.filtered(), this.page(), this.size()));

  late(d: Delivery): boolean {
    return d.status !== 'concluida' && isDeliveryLate(d);
  }

  nextAction(o: Order): { to: OrderStatus; label: string } | null {
    switch (o.status) {
      case 'confirmada':
      case 'em_preparacao':
      case 'pronta_envio':
        return { to: 'em_transito', label: 'Marcar saída' };
      case 'em_transito':
        return { to: 'saiu_entrega', label: 'Saiu p/ entrega' };
      case 'saiu_entrega':
        return { to: 'entregue', label: 'Concluir' };
      default:
        return null;
    }
  }

  async advance(o: Order, to: OrderStatus): Promise<void> {
    this.busy.set(true);
    try {
      await this.sales.changeOrderStatus(o.id, to, 'admin');
      this.toast.success(`${o.number}: ${ORDER_STATUS_LABEL[to]}`);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
