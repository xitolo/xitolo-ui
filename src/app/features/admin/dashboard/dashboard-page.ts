import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReportingService } from '../../../application/reporting.service';
import { SalesStore } from '../../../application/sales.store';
import { Granularity, VAT_RATE } from '../../../domain/services/finance';
import { rangeFromPreset } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, OrderStatus, PAYMENT_METHODS, PaymentMethod } from '../../../domain/value-objects/statuses';
import { BarList, CHART_COLORS, ColumnChart, Donut, LineChart } from '../../../shared/components/charts';
import { Icon } from '../../../shared/components/icon';
import { Badge, KpiCard } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';
import { PeriodFilter } from '../shared/period-filter';

const STATUS_COLOR: Record<OrderStatus, string> = {
  pendente: '#f2b632', confirmada: '#2f5fb3', em_preparacao: '#5b7fc7', pronta_envio: '#8aa4d8',
  em_transito: '#d9480f', saiu_entrega: '#ec7a2e', entregue: '#0b7a5c', cancelada: '#e03131',
};

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodFilter, KpiCard, LineChart, ColumnChart, BarList, Donut, Badge, MznPipe, DatePipe, RouterLink, Icon],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly reports = inject(ReportingService);
  private readonly sales = inject(SalesStore);

  protected readonly range = signal(rangeFromPreset('30d'));
  protected readonly granularity = signal<Granularity>('day');
  protected readonly showHelp = signal(false);
  protected readonly vat = VAT_RATE * 100;
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly m = Money.format;

  protected readonly fin = computed(() => this.reports.financial(this.range()));
  protected readonly com = computed(() => this.reports.commercial(this.range()));
  protected readonly dlv = computed(() => this.reports.deliveries(this.range()));

  protected readonly series = computed(() => this.reports.series(this.range(), this.granularity()));
  protected readonly lineLabels = computed(() => this.series().map((p) => p.label));
  protected readonly lineSeries = computed(() => [
    { name: 'Valor vendido', color: CHART_COLORS[0], values: this.series().map((p) => p.sold) },
    { name: 'Valor recebido', color: CHART_COLORS[1], values: this.series().map((p) => p.received) },
  ]);
  protected readonly ordersBars = computed(() => {
    const s = this.series();
    const last = s.slice(-14);
    return last.map((p) => ({ label: p.label, value: p.orders, color: '#2f5fb3' }));
  });

  protected readonly top = computed(() =>
    this.reports.topProducts(this.range(), 7).map((r) => ({ label: r.label, value: r.qty, sub: Money.format(r.value) })),
  );
  protected readonly categories = computed(() =>
    this.reports.byCategory(this.range()).map((r) => ({ label: r.label, value: r.value })),
  );
  protected readonly categoryTotal = computed(() => Money.compact(this.categories().reduce((s, c) => s + c.value, 0)));
  protected readonly payMix = computed(() =>
    this.reports.paymentMix(this.range()).map((r) => ({ label: r.label, value: r.qty, color: PAYMENT_METHODS[r.id as PaymentMethod].color })),
  );
  protected readonly statusDist = computed(() =>
    this.reports
      .statusDistribution(this.range())
      .sort((a, b) => b.qty - a.qty)
      .map((r) => ({ label: r.label, value: r.qty, color: STATUS_COLOR[r.id as OrderStatus] })),
  );
  protected readonly deliveryDonut = computed(() => {
    const d = this.dlv();
    return [
      { label: 'Concluídas no prazo', value: d.completed - d.lateCompleted, color: '#0b7a5c' },
      { label: 'Concluídas com atraso', value: d.lateCompleted, color: '#f2b632' },
      { label: 'Em aberto no prazo', value: d.pending + d.inProgress - d.lateOpen, color: '#2f5fb3' },
      { label: 'Em aberto atrasadas', value: d.lateOpen, color: '#e03131' },
    ];
  });

  protected readonly recent = computed(() => this.sales.orders().slice(0, 6));
}
