import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerStore } from '../../../application/customer.store';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { mzPhoneValidator } from '../../../shared/validators';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe],
  template: `
    <div class="page-head"><div><h1>Dados pessoais</h1>
      <p>Cliente desde {{ session.customer()?.createdAt | date: 'MMMM yyyy' }}</p></div></div>
    <form class="card pad form-grid" [formGroup]="form" (ngSubmit)="save()">
      <div class="field full"><label for="n">Nome completo</label><input id="n" class="input" formControlName="name" />
        @if (form.controls.name.touched && form.controls.name.invalid) { <span class="error">Indica o nome e apelido.</span> }</div>
      <div class="field"><label for="e">Email</label><input id="e" class="input" type="email" formControlName="email" />
        @if (form.controls.email.touched && form.controls.email.invalid) { <span class="error">Email inválido.</span> }</div>
      <div class="field"><label for="t">Telemóvel</label><div class="input-prefix"><span>+258</span><input id="t" class="input" formControlName="phone" inputmode="numeric" /></div>
        @if (form.controls.phone.touched && form.controls.phone.invalid) { <span class="error">Telemóvel inválido.</span> }</div>
      <div class="full row end">
        <button type="button" class="btn ghost" (click)="reset()" [disabled]="!form.dirty">Repor</button>
        <button class="btn" [disabled]="busy() || !form.dirty">Guardar alterações</button>
      </div>
    </form>
  `,
})
export class ProfilePage {
  protected readonly session = inject(SessionService);
  private readonly customers = inject(CustomerStore);
  private readonly toast = inject(ToastService);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S+\s+\S+/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, mzPhoneValidator]],
  });

  constructor() {
    effect(() => {
      if (!this.form.dirty) this.reset();
    });
  }

  reset(): void {
    const c = this.session.customer();
    if (c) this.form.reset({ name: c.name, email: c.email, phone: c.phone });
  }

  async save(): Promise<void> {
    const c = this.session.customer();
    if (!c || this.form.invalid) return this.form.markAllAsTouched();
    this.busy.set(true);
    try {
      await this.customers.updateProfile(c.id, this.form.getRawValue());
      this.form.markAsPristine();
      this.toast.success('Dados actualizados');
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
