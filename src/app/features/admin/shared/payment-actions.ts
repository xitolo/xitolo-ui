import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { SalesStore } from '../../../application/sales.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { Payment } from '../../../domain/entities';
import { canCancel } from '../../../domain/services/order-lifecycle';
import { Money } from '../../../domain/value-objects/money';

/** Acções sobre um pagamento: confirmar, rejeitar, reembolsar. */
@Component({
  selector: 'app-payment-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:inline-flex;gap:6px;flex-wrap:wrap}`,
  template: `
    @if (payment().status === 'pendente' && orderActive()) {
      <button type="button" class="btn accent xs" (click)="confirmPay()" [disabled]="busy()">Confirmar</button>
      <button type="button" class="btn ghost xs" (click)="reject()" [disabled]="busy()">Rejeitar</button>
    }
    @if (payment().status === 'confirmado' && refundable()) {
      <button type="button" class="btn ghost xs" (click)="refund()" [disabled]="busy()">Reembolsar</button>
    }
  `,
})
export class PaymentActions {
  readonly payment = input.required<Payment>();
  private readonly sales = inject(SalesStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);

  private readonly order = computed(() => this.sales.order(this.payment().orderId));
  protected readonly orderActive = computed(() => this.order()?.status !== 'cancelada');
  protected readonly refundable = computed(() => !!this.order() && canCancel(this.order()!.status));

  async confirmPay(): Promise<void> {
    const p = this.payment();
    const ok = await this.confirm.confirm({
      title: 'Confirmar pagamento?',
      message: `Confirma que recebeu ${Money.format(p.amount)} referente à encomenda ${p.orderNumber}. A encomenda passa a "Confirmada" e o valor conta como recebido.`,
      confirmLabel: 'Confirmar recebimento',
    });
    if (ok) await this.run(() => this.sales.confirmPayment(p.id), 'Pagamento confirmado');
  }

  async reject(): Promise<void> {
    const r = await this.confirm.ask({
      title: 'Rejeitar pagamento?',
      message: 'A encomenda continua pendente; o cliente pode tentar pagar novamente ou pode cancelá-la.',
      confirmLabel: 'Rejeitar',
      danger: true,
      input: { label: 'Motivo', placeholder: 'Ex: Transferência não encontrada no extracto', required: true },
    });
    if (r.confirmed) await this.run(() => this.sales.rejectPayment(this.payment().id, r.text), 'Pagamento rejeitado');
  }

  async refund(): Promise<void> {
    const r = await this.confirm.ask({
      title: 'Reembolsar e cancelar encomenda?',
      message: `O valor de ${Money.format(this.payment().amount)} será marcado como reembolsado, a encomenda ${this.payment().orderNumber} é cancelada e o stock libertado.`,
      confirmLabel: 'Reembolsar',
      danger: true,
      input: { label: 'Motivo', required: true },
    });
    if (r.confirmed) await this.run(() => this.sales.refundPayment(this.payment().id, r.text), 'Reembolso registado');
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
