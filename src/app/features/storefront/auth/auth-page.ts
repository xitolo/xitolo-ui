import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { errorMessage } from '../../../domain/services/domain-error';
import { Icon } from '../../../shared/components/icon';
import { mzPhoneValidator } from '../../../shared/validators';

@Component({
  selector: 'app-auth-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon],
  styles: `.box{max-width:460px;margin:20px auto}.box h1{font-family:var(--display);font-size:28px;margin-bottom:4px}
    form{display:flex;flex-direction:column;gap:12px;margin-top:16px}
    .demo{margin-top:16px}.demo button{text-align:left}`,
  template: `
    <div class="container page">
      <div class="card pad box">
        <h1>{{ mode() === 'login' ? 'Bem-vindo de volta' : 'Criar conta' }}</h1>
        <p class="muted small">{{ mode() === 'login' ? 'Entra para acompanhar encomendas e guardar favoritos.' : 'Leva menos de um minuto.' }}</p>
        <div class="segmented" style="margin-top:14px">
          <button type="button" [class.on]="mode() === 'login'" (click)="mode.set('login')">Entrar</button>
          <button type="button" [class.on]="mode() === 'register'" (click)="mode.set('register')">Criar conta</button>
        </div>

        @if (mode() === 'login') {
          <form [formGroup]="login" (ngSubmit)="doLogin()">
            <div class="field"><label for="e">Email</label><input id="e" class="input" type="email" formControlName="email" autocomplete="email" /></div>
            <div class="field"><label for="p">Palavra-passe</label><input id="p" class="input" type="password" formControlName="password" autocomplete="current-password" /></div>
            @if (error()) { <div class="alert danger"><app-icon name="alert" [size]="16" />{{ error() }}</div> }
            <button class="btn brand lg" [disabled]="busy()">Entrar</button>
          </form>
          <div class="alert demo">
            <app-icon name="info" [size]="16" />
            <div>Contas de demonstração (palavra-passe <b>xitolo123</b>):<br />
              <button type="button" class="link" (click)="fill('ana@exemplo.co.mz')">ana&#64;exemplo.co.mz</button> ·
              <button type="button" class="link" (click)="fill('joao.sitoe@exemplo.co.mz')">joao.sitoe&#64;exemplo.co.mz</button> ·
              <button type="button" class="link" (click)="fill('celia.n@exemplo.co.mz')">celia.n&#64;exemplo.co.mz</button>
            </div>
          </div>
        } @else {
          <form [formGroup]="register" (ngSubmit)="doRegister()">
            <div class="field"><label for="n">Nome completo</label><input id="n" class="input" formControlName="name" placeholder="Ex: Ana Macuácua" />
              @if (register.controls.name.touched && register.controls.name.invalid) { <span class="error">Indica o nome e apelido.</span> }</div>
            <div class="field"><label for="re">Email</label><input id="re" class="input" type="email" formControlName="email" />
              @if (register.controls.email.touched && register.controls.email.invalid) { <span class="error">Email inválido.</span> }</div>
            <div class="field"><label for="t">Telemóvel</label><div class="input-prefix"><span>+258</span><input id="t" class="input" formControlName="phone" inputmode="numeric" placeholder="84 123 4567" /></div>
              @if (register.controls.phone.touched && register.controls.phone.invalid) { <span class="error">9 dígitos a começar por 82–87.</span> }</div>
            <div class="field"><label for="rp">Palavra-passe</label><input id="rp" class="input" type="password" formControlName="password" autocomplete="new-password" />
              @if (register.controls.password.touched && register.controls.password.invalid) { <span class="error">Mínimo 6 caracteres.</span> }</div>
            @if (error()) { <div class="alert danger"><app-icon name="alert" [size]="16" />{{ error() }}</div> }
            <button class="btn brand lg" [disabled]="busy()">Criar conta</button>
          </form>
        }
      </div>
    </div>
  `,
})
export class AuthPage {
  /** URL para onde voltar depois de entrar (query param ?voltar=). */
  readonly voltar = input<string>('/conta');
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly login = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly register = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S+\s+\S+/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, mzPhoneValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  fill(email: string): void {
    this.login.setValue({ email, password: 'xitolo123' });
  }

  async doLogin(): Promise<void> {
    if (this.login.invalid) return this.login.markAllAsTouched();
    await this.run(async () => {
      const c = await this.session.login(this.login.value.email!, this.login.value.password!);
      this.toast.success(`Olá, ${c.name.split(' ')[0]}!`);
    });
  }

  async doRegister(): Promise<void> {
    if (this.register.invalid) return this.register.markAllAsTouched();
    await this.run(async () => {
      await this.session.register(this.register.getRawValue());
      this.toast.success('Conta criada — bem-vindo à Xitolo!');
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
      await this.router.navigateByUrl(this.voltar() || '/conta');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
