import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatAddress, isDeliveryLate, orderCost } from '../../../domain/entities';
import { nextStatuses, transitionError } from '../../../domain/services/order-lifecycle';
import { DELIVERY_METHOD_LABEL } from '../../../domain/value-objects/shipping';
import {
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_TONE,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { OrderTimeline } from '../../../shared/components/order-timeline';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';
import { DeliveryDialog } from '../shared/delivery-dialog';
import { PaymentActions } from '../shared/payment-actions';

@Component({
  selector: 'app-admin-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, PhonePipe, Badge, ProductImage, OrderTimeline, Icon, EmptyState, DeliveryDialog, PaymentActions],
  templateUrl: './order-detail-page.html',
  styles: `.g{display:grid;grid-template-columns:1.4fr 1fr;gap:14px;align-items:start}
    .it{display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)}
    .it .im{width:44px;height:54px;border-radius:8px;overflow:hidden;flex-shrink:0}
    .hist{list-style:none}.hist li{display:grid;grid-template-columns:120px 1fr;gap:10px;padding:8px 16px;border-bottom:1px solid var(--line);font-size:13px}
    .actbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:14px 16px;background:var(--surface-2);border-radius:var(--r);border:1px solid var(--line);margin-bottom:14px}
    @media (max-width:1000px){.g{grid-template-columns:1fr}}`,
})
export class AdminOrderDetailPage {
  readonly id = input.required<string>();
  private readonly sales = inject(SalesStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly payLabel = PAYMENT_STATUS_LABEL;
  protected readonly payTone = PAYMENT_STATUS_TONE;
  protected readonly payInfo = PAYMENT_METHODS;
  protected readonly dLabel = DELIVERY_STATUS_LABEL;
  protected readonly dTone = DELIVERY_STATUS_TONE;
  protected readonly methodLabel = DELIVERY_METHOD_LABEL;
  protected readonly fmt = formatAddress;
  protected readonly busy = signal(false);
  protected readonly deliveryOpen = signal(false);

  protected readonly order = computed(() => this.sales.order(this.id()));
  protected readonly payment = computed(() => (this.order() ? this.sales.paymentFor(this.order()!.id) : null));
  protected readonly delivery = computed(() => (this.order() ? this.sales.deliveryFor(this.order()!.id) : null));
  protected readonly next = computed(() => (this.order() ? nextStatuses(this.order()!).filter((s) => s !== 'cancelada') : []));
  protected readonly canCancel = computed(() => (this.order() ? nextStatuses(this.order()!).includes('cancelada') : false));
  protected readonly blocked = computed(() => {
    const o = this.order();
    const n = this.next()[0];
    return o && n ? transitionError(o, n, this.payment()) : null;
  });
  protected readonly cost = computed(() => (this.order() ? orderCost(this.order()!) : 0));
  protected readonly late = computed(() => (this.delivery() ? isDeliveryLate(this.delivery()!) : false));
  protected readonly history = computed(() => [...(this.order()?.history ?? [])].reverse());

  async advance(to: OrderStatus): Promise<void> {
    await this.run(() => this.sales.changeOrderStatus(this.order()!.id, to, 'admin').then(() => undefined), `Estado: ${ORDER_STATUS_LABEL[to]}`);
  }

  async cancel(): Promise<void> {
    const pay = this.payment();
    const r = await this.confirm.ask({
      title: 'Cancelar encomenda?',
      message:
        'O stock reservado é libertado. ' +
        (pay?.status === 'confirmado' ? 'O pagamento confirmado será marcado como reembolsado.' : 'O pagamento pendente será anulado.'),
      confirmLabel: 'Cancelar encomenda',
      cancelLabel: 'Voltar',
      danger: true,
      input: { label: 'Motivo', placeholder: 'Ex: Cliente pediu cancelamento por telefone', required: true },
    });
    if (!r.confirmed) return;
    await this.run(() => this.sales.changeOrderStatus(this.order()!.id, 'cancelada', 'admin', `Cancelada: ${r.text}`).then(() => undefined), 'Encomenda cancelada');
  }

  private async run(fn: () => Promise<void>, ok: string): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      this.toast.success(ok);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
