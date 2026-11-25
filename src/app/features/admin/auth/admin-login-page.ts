import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DEMO_ADMIN, SessionService } from '../../../core/services/session.service';
import { errorMessage } from '../../../domain/services/domain-error';
import { Icon } from '../../../shared/components/icon';
import { Logo } from '../../../shared/components/logo';

@Component({
  selector: 'app-admin-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Logo, RouterLink],
  styles: `:host{display:grid;place-items:center;min-height:100vh;background:var(--ink);padding:20px}
    .box{width:min(420px,100%);background:#fff;border-radius:22px;padding:30px}
    h1{font-size:22px;margin:18px 0 4px} form{display:flex;flex-direction:column;gap:12px;margin-top:18px}`,
  template: `
    <div class="box">
      <app-logo [size]="28" suffix="admin" />
      <h1>Painel administrativo</h1>
      <p class="muted small">Gestão da loja Xitolo.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field"><label for="e">Email</label><input id="e" class="input" type="email" formControlName="email" autocomplete="username" /></div>
        <div class="field"><label for="p">Palavra-passe</label><input id="p" class="input" type="password" formControlName="password" autocomplete="current-password" /></div>
        @if (error()) { <div class="alert danger"><app-icon name="alert" [size]="16" />{{ error() }}</div> }
        <button class="btn brand lg">Entrar</button>
      </form>
      <div class="alert" style="margin-top:14px"><app-icon name="info" [size]="16" /><span>Demonstração: <b>{{ demo.email }}</b> / <b>{{ demo.password }}</b> (já preenchido)</span></div>
      <a routerLink="/" class="link small" style="display:inline-block;margin-top:14px">← Voltar à loja</a>
    </div>
  `,
})
export class AdminLoginPage {
  readonly voltar = input('/admin');
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  protected readonly demo = DEMO_ADMIN;
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: [DEMO_ADMIN.email, [Validators.required, Validators.email]],
    password: [DEMO_ADMIN.password, Validators.required],
  });

  submit(): void {
    try {
      this.session.adminLogin(this.form.value.email!, this.form.value.password!);
      void this.router.navigateByUrl(this.voltar() || '/admin');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
