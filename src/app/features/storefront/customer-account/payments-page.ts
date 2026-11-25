import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { PAYMENT_METHODS, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_TONE } from '../../../domain/value-objects/statuses';
import { Badge, EmptyState } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-payments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MznPipe, Badge, EmptyState, RouterLink],
  template: `
    <div class="page-head"><div><h1>Histórico de pagamentos</h1><p>Total pago: <b>{{ totalPaid() | mzn }}</b></p></div></div>
    <div class="card table-wrap">
      @if (payments().length) {
        <table class="table">
          <thead><tr><th>Data</th><th>Encomenda</th><th>Método</th><th>Estado</th><th class="num">Valor</th></tr></thead>
          <tbody>
            @for (p of payments(); track p.id) {
              <tr>
                <td class="nowrap">{{ p.createdAt | date: 'dd/MM/yyyy' }}</td>
                <td><a class="link" [routerLink]="['/conta/encomendas', p.orderId]">{{ p.orderNumber }}</a></td>
                <td>{{ methods[p.method].label }}</td>
                <td><app-badge [label]="label[p.status]" [tone]="tone[p.status]" /></td>
                <td class="num">{{ p.amount | mzn }}</td>
              </tr>
            }
          </tbody>
        </table>
      } @else {
        <app-empty icon="wallet" title="Ainda sem pagamentos" />
      }
    </div>
  `,
})
export class PaymentsPage {
  private readonly sales = inject(SalesStore);
  private readonly session = inject(SessionService);
  protected readonly methods = PAYMENT_METHODS;
  protected readonly label = PAYMENT_STATUS_LABEL;
  protected readonly tone = PAYMENT_STATUS_TONE;
  protected readonly payments = computed(() => this.sales.payments().filter((p) => p.customerId === this.session.customer()?.id));
  protected readonly totalPaid = computed(() =>
    this.payments()
      .filter((p) => p.status === 'confirmado')
      .reduce((s, p) => s + p.amount, 0),
  );
}
