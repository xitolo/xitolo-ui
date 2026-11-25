import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerStore } from '../../../application/customer.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { Address, formatAddress } from '../../../domain/entities';
import { PROVINCES } from '../../../domain/value-objects/shipping';
import { Dialog } from '../../../shared/components/dialog';
import { Icon } from '../../../shared/components/icon';
import { EmptyState } from '../../../shared/components/ui';
import { PhonePipe } from '../../../shared/pipes/format.pipes';
import { mzPhoneValidator } from '../../../shared/validators';

@Component({
  selector: 'app-addresses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Dialog, Icon, EmptyState, PhonePipe],
  styles: `.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .a{display:flex;flex-direction:column;gap:4px;font-size:14px}.a.def{border-color:var(--ink)}`,
  template: `
    <div class="page-head"><div><h1>Endereços de entrega</h1><p>Usados para acelerar o checkout.</p></div>
      <button type="button" class="btn" (click)="open(null)"><app-icon name="plus" [size]="16" /> Novo endereço</button></div>
    @if (addresses().length) {
      <div class="g">
        @for (a of addresses(); track a.id) {
          <div class="card pad a" [class.def]="a.isDefault">
            <div class="row between"><b>{{ a.label }}</b>@if (a.isDefault) { <span class="badge plain">Principal</span> }</div>
            <span>{{ a.recipient }} · {{ a.phone | phone }}</span>
            <span class="muted">{{ fmt(a) }}</span>
            @if (a.reference) { <span class="muted small">Ref.: {{ a.reference }}</span> }
            <div class="row" style="margin-top:8px">
              <button type="button" class="btn ghost xs" (click)="open(a)">Editar</button>
              @if (!a.isDefault) { <button type="button" class="btn ghost xs" (click)="makeDefault(a)">Tornar principal</button> }
              <button type="button" class="btn ghost xs" (click)="remove(a)">Remover</button>
            </div>
          </div>
        }
      </div>
    } @else {
      <app-empty icon="pin" title="Sem endereços guardados" text="Adiciona um endereço para receberes as tuas encomendas." />
    }

    @if (editing() !== undefined) {
      <app-dialog [title]="editing() ? 'Editar endereço' : 'Novo endereço'" (closed)="editing.set(undefined)">
        <form id="addr-form" [formGroup]="form" class="form-grid" (ngSubmit)="save()">
          <div class="field"><label for="l">Nome</label><input id="l" class="input" formControlName="label" placeholder="Casa, Trabalho…" /></div>
          <div class="field"><label for="r">Destinatário</label><input id="r" class="input" formControlName="recipient" /></div>
          <div class="field"><label for="t">Telemóvel</label><div class="input-prefix"><span>+258</span><input id="t" class="input" formControlName="phone" inputmode="numeric" /></div>
            @if (form.controls.phone.touched && form.controls.phone.invalid) { <span class="error">Telemóvel inválido.</span> }</div>
          <div class="field"><label for="p">Província</label><select id="p" class="select" formControlName="province">
            @for (p of provinces; track p.name) { <option [value]="p.name">{{ p.name }}</option> }</select></div>
          <div class="field"><label for="c">Cidade / Distrito</label><input id="c" class="input" formControlName="city" /></div>
          <div class="field"><label for="ref">Referência</label><input id="ref" class="input" formControlName="reference" /></div>
          <div class="field full"><label for="s">Bairro, rua e nº</label><input id="s" class="input" formControlName="street" />
            @if (form.controls.street.touched && form.controls.street.invalid) { <span class="error">Indica o bairro e a rua.</span> }</div>
          <label class="check full"><input type="checkbox" formControlName="isDefault" /> Endereço principal</label>
        </form>
        <ng-container foot>
          <button type="button" class="btn ghost" (click)="editing.set(undefined)">Cancelar</button>
          <button type="submit" form="addr-form" class="btn" [disabled]="busy()">Guardar</button>
        </ng-container>
      </app-dialog>
    }
  `,
})
export class AddressesPage {
  private readonly session = inject(SessionService);
  private readonly customers = inject(CustomerStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly provinces = PROVINCES;
  protected readonly fmt = formatAddress;
  protected readonly busy = signal(false);
  /** undefined = fechado; null = novo; Address = edição. */
  protected readonly editing = signal<Address | null | undefined>(undefined);
  protected readonly addresses = computed(() => this.session.customer()?.addresses ?? []);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    label: ['Casa', Validators.required],
    recipient: ['', Validators.required],
    phone: ['', [Validators.required, mzPhoneValidator]],
    province: ['Maputo Cidade', Validators.required],
    city: ['', Validators.required],
    street: ['', [Validators.required, Validators.minLength(6)]],
    reference: [''],
    isDefault: [false],
  });

  open(a: Address | null): void {
    const c = this.session.customer()!;
    this.form.reset(
      a
        ? { ...a }
        : { label: 'Casa', recipient: c.name, phone: c.phone, province: 'Maputo Cidade', city: '', street: '', reference: '', isDefault: !c.addresses.length },
    );
    this.editing.set(a);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    await this.run(async () => {
      await this.customers.saveAddress(this.session.customer()!.id, { ...this.form.getRawValue(), id: this.editing()?.id });
      this.editing.set(undefined);
      this.toast.success('Endereço guardado');
    });
  }

  async makeDefault(a: Address): Promise<void> {
    await this.run(() => this.customers.saveAddress(this.session.customer()!.id, { ...a, isDefault: true }).then(() => undefined));
  }

  async remove(a: Address): Promise<void> {
    if (!(await this.confirm.confirm({ title: 'Remover endereço?', message: `${a.label}: ${formatAddress(a)}`, confirmLabel: 'Remover', danger: true }))) return;
    await this.run(() => this.customers.removeAddress(this.session.customer()!.id, a.id));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
