import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatAddress } from '../../../domain/entities';
import { DELIVERY_METHOD_LABEL } from '../../../domain/value-objects/shipping';
import { PAYMENT_METHODS } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { OrderTimeline } from '../../../shared/components/order-timeline';
import { EmptyState } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';

/** Passo 7 — confirmação e simulação do pagamento. */
@Component({
  selector: 'app-order-placed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, MznPipe, PhonePipe, OrderTimeline, EmptyState],
  styleUrl: './order-placed-page.scss',
  templateUrl: './order-placed-page.html',
})
export class OrderPlacedPage {
  readonly id = input.required<string>();
  private readonly sales = inject(SalesStore);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly order = computed(() => {
    const o = this.sales.order(this.id());
    return o && o.customerId === this.session.customer()?.id ? o : undefined;
  });
  protected readonly payment = computed(() => (this.order() ? this.sales.paymentFor(this.order()!.id) : null));
  protected readonly method = computed(() => (this.payment() ? PAYMENT_METHODS[this.payment()!.method] : null));
  protected readonly busy = signal(false);
  protected readonly retryPhone = signal('');
  protected readonly ussdRef = Date.now().toString().slice(-6);
  protected readonly deliveryLabel = DELIVERY_METHOD_LABEL;
  protected readonly formatAddress = formatAddress;

  async respond(approved: boolean): Promise<void> {
    await this.run(() => this.sales.respondToWalletRequest(this.order()!.id, approved), approved ? 'Pagamento confirmado!' : 'Pagamento recusado');
  }

  async retry(): Promise<void> {
    await this.run(() => this.sales.retryPayment(this.order()!.id, this.retryPhone() || this.payment()!.phone), 'Novo pedido enviado para o telemóvel');
  }

  async transferSent(): Promise<void> {
    await this.run(() => this.sales.notifyTransferSent(this.order()!.id), 'Obrigado! Vamos verificar a transferência.');
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
