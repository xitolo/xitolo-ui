import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SalesStore } from '../../../application/sales.store';
import { ToastService } from '../../../core/services/toast.service';
import { COURIERS, Delivery, Order, formatAddress } from '../../../domain/entities';
import { toIsoDate } from '../../../domain/value-objects/date-range';
import { findProvince } from '../../../domain/value-objects/shipping';
import { Dialog } from '../../../shared/components/dialog';
import { MznPipe } from '../../../shared/pipes/format.pipes';

/** Registar ou editar a entrega de uma encomenda. */
@Component({
  selector: 'app-delivery-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, ReactiveFormsModule, MznPipe],
  template: `
    <app-dialog [title]="(delivery() ? 'Editar entrega — ' : 'Registar entrega — ') + order().number" (closed)="closed.emit()">
      <div class="alert" style="margin-bottom:14px">
        <div><b>{{ order().customerName }}</b> · {{ order().address ? fmt(order().address!) : '' }}<br />
          <span class="small">Taxa paga pelo cliente na encomenda: <b>{{ order().shippingFee | mzn }}</b></span></div>
      </div>
      <form id="dlv-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <div class="field full"><label for="c">Responsável pela entrega</label>
          <input id="c" class="input" list="couriers" formControlName="courier" placeholder="Nome do estafeta ou transportadora" />
          <datalist id="couriers">@for (c of couriers; track c) { <option [value]="c"></option> }</datalist>
          @if (form.controls.courier.touched && form.controls.courier.invalid) { <span class="error">Obrigatório.</span> }</div>
        <div class="field"><label for="f">Valor cobrado ao cliente (MT)</label><input id="f" class="input" type="number" min="0" formControlName="fee" />
          <span class="hint">Alterar só é possível se o pagamento estiver pendente.</span></div>
        <div class="field"><label for="k">Custo da entrega (MT)</label><input id="k" class="input" type="number" min="0" formControlName="cost" />
          <span class="hint">Custo operacional para a loja.</span></div>
        <div class="field"><label for="e">Prazo previsto</label><input id="e" class="input" type="date" formControlName="expectedBy" /></div>
      </form>
      <ng-container foot>
        <button type="button" class="btn ghost" (click)="closed.emit()">Cancelar</button>
        <button type="submit" form="dlv-form" class="btn" [disabled]="busy()">{{ delivery() ? 'Guardar' : 'Registar entrega' }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class DeliveryDialog {
  readonly order = input.required<Order>();
  readonly delivery = input<Delivery | null>(null);
  readonly closed = output<void>();
  private readonly sales = inject(SalesStore);
  private readonly toast = inject(ToastService);
  protected readonly couriers = COURIERS;
  protected readonly fmt = formatAddress;
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    courier: ['', Validators.required],
    fee: [0, [Validators.required, Validators.min(0)]],
    cost: [0, [Validators.required, Validators.min(0)]],
    expectedBy: ['', Validators.required],
  });

  ngOnInit(): void {
    const o = this.order();
    const d = this.delivery();
    const metro = o.address ? findProvince(o.address.province).metro : true;
    this.form.setValue({
      courier: d?.courier ?? (metro ? COURIERS[0] : COURIERS[3]),
      fee: d?.fee ?? o.shippingFee,
      cost: d?.cost ?? o.shippingCost,
      expectedBy: toIsoDate(new Date(d?.expectedBy ?? o.expectedBy)),
    });
  }

  async save(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const [y, m, dd] = v.expectedBy.split('-').map(Number);
    const draft = { courier: v.courier, fee: +v.fee, cost: +v.cost, expectedBy: new Date(y, m - 1, dd, 20).toISOString() };
    this.busy.set(true);
    try {
      const d = this.delivery();
      if (d) await this.sales.updateDelivery(d.id, draft);
      else await this.sales.registerDelivery(this.order().id, draft);
      this.toast.success(d ? 'Entrega actualizada' : 'Entrega registada');
      this.closed.emit();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
