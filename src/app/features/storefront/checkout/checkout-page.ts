import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerStore } from '../../../application/customer.store';
import { OrderPricingService } from '../../../application/order-pricing.service';
import { SalesStore } from '../../../application/sales.store';
import { CartService } from '../../../core/services/cart.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { Address, defaultAddress, formatAddress } from '../../../domain/entities';
import { errorMessage } from '../../../domain/services/domain-error';
import { MzPhone } from '../../../domain/value-objects/mz-phone';
import { PROVINCES, findProvince } from '../../../domain/value-objects/shipping';
import { DeliveryMethod, PAYMENT_METHODS, PaymentMethod } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { ProductImage } from '../../../shared/components/product-image';
import { EmptyState } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';
import { mzPhoneValidator } from '../../../shared/validators';

const STEPS = ['Identificação', 'Contacto', 'Endereço', 'Entrega', 'Pagamento', 'Revisão', 'Confirmação'];

@Component({
  selector: 'app-checkout-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, ProductImage, MznPipe, PhonePipe, EmptyState],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly cart = inject(CartService);
  protected readonly session = inject(SessionService);
  private readonly customers = inject(CustomerStore);
  private readonly sales = inject(SalesStore);
  private readonly pricing = inject(OrderPricingService);
  private readonly toast = inject(ToastService);

  protected readonly steps = STEPS;
  protected readonly provinces = PROVINCES;
  protected readonly payMethods = Object.values(PAYMENT_METHODS);
  protected readonly step = signal(0);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly authMode = signal<'login' | 'register'>('login');

  // ---------- 1. Identificação ----------
  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['ana@exemplo.co.mz', [Validators.required, Validators.email]],
    password: ['xitolo123', Validators.required],
  });
  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S+\s+\S+/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, mzPhoneValidator]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ---------- 2. Contacto ----------
  protected readonly contactForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S+\s+\S+/)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, mzPhoneValidator]],
  });

  // ---------- 3. Endereço ----------
  protected readonly addressChoice = signal<string>('new');
  protected readonly addressForm = this.fb.nonNullable.group({
    label: ['Casa'],
    recipient: ['', Validators.required],
    phone: ['', [Validators.required, mzPhoneValidator]],
    province: ['Maputo Cidade', Validators.required],
    city: ['', Validators.required],
    street: ['', [Validators.required, Validators.minLength(6)]],
    reference: [''],
    save: [true],
  });
  private readonly addressValue = toSignal(this.addressForm.valueChanges, { initialValue: this.addressForm.getRawValue() });

  // ---------- 4/5. Entrega e pagamento ----------
  protected readonly method = signal<DeliveryMethod>('normal');
  protected readonly payMethod = signal<PaymentMethod>('mpesa');
  protected readonly walletPhone = this.fb.nonNullable.control('', [mzPhoneValidator]);
  protected readonly accepted = signal(false);

  protected readonly savedAddresses = computed(() => this.session.customer()?.addresses ?? []);
  protected readonly address = computed<Address | null>(() => {
    const choice = this.addressChoice();
    if (choice !== 'new') return this.savedAddresses().find((a) => a.id === choice) ?? null;
    const v = this.addressValue();
    return {
      id: 'novo',
      label: v.label ?? 'Casa',
      recipient: v.recipient ?? '',
      phone: MzPhone.normalize(v.phone ?? ''),
      province: v.province ?? 'Maputo Cidade',
      city: v.city ?? '',
      street: v.street ?? '',
      reference: v.reference ?? '',
      isDefault: false,
    };
  });
  protected readonly province = computed(() => this.address()?.province ?? 'Maputo Cidade');
  protected readonly metro = computed(() => findProvince(this.province()).metro);
  protected readonly priced = computed(() =>
    this.pricing.price(this.cart.lines(), this.cart.couponCode(), this.method() === 'levantamento' ? 'Maputo Cidade' : this.province(), this.method()),
  );
  protected readonly options = computed(() => this.pricing.price(this.cart.lines(), null, this.province(), 'normal').options);
  protected readonly pay = computed(() => PAYMENT_METHODS[this.payMethod()]);
  protected readonly formatAddress = formatAddress;

  constructor() {
    // Pré-preenche dados a partir da conta.
    effect(() => {
      const c = this.session.customer();
      if (!c) return;
      if (!this.contactForm.dirty) this.contactForm.patchValue({ name: c.name, email: c.email, phone: c.phone });
      const def = defaultAddress(c);
      if (def && this.addressChoice() === 'new' && !this.addressForm.dirty) this.addressChoice.set(def.id);
      if (!this.addressForm.dirty) this.addressForm.patchValue({ recipient: c.name, phone: c.phone });
      if (!this.walletPhone.dirty) this.walletPhone.setValue(c.phone);
      if (this.step() === 0) this.step.set(1);
    });
    // Ajusta métodos indisponíveis quando a província muda.
    effect(() => {
      if (this.method() === 'expresso' && !this.metro()) this.method.set('normal');
      if (this.payMethod() === 'na_entrega' && !this.metro() && this.method() !== 'levantamento') this.payMethod.set('mpesa');
    });
  }

  go(i: number): void {
    if (i < this.step()) {
      this.error.set('');
      this.step.set(i);
    }
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) return this.loginForm.markAllAsTouched();
    await this.run(async () => {
      const { email, password } = this.loginForm.getRawValue();
      await this.session.login(email, password);
      this.step.set(1);
    });
  }

  async register(): Promise<void> {
    if (this.registerForm.invalid) return this.registerForm.markAllAsTouched();
    await this.run(async () => {
      await this.session.register(this.registerForm.getRawValue());
      this.step.set(1);
    });
  }

  next(): void {
    this.error.set('');
    const s = this.step();
    if (s === 1 && this.contactForm.invalid) return this.contactForm.markAllAsTouched();
    if (s === 2 && this.addressChoice() === 'new' && this.addressForm.invalid) return this.addressForm.markAllAsTouched();
    if (s === 4) {
      if (this.payMethod() === 'na_entrega' && !this.metro() && this.method() !== 'levantamento') {
        this.error.set('Pagamento na entrega só está disponível em Maputo Cidade e Província.');
        return;
      }
      const prefixes = this.pay().prefixes;
      if (prefixes) {
        const p = MzPhone.parse(this.walletPhone.value);
        if (!p || !prefixes.includes(p.prefix)) {
          this.walletPhone.markAsTouched();
          this.error.set(`O número ${this.pay().label} deve começar por ${prefixes.join(' ou ')}.`);
          return;
        }
      }
    }
    this.step.set(s + 1);
  }

  async place(): Promise<void> {
    const customer = this.session.customer();
    if (!customer) return this.step.set(0);
    if (!this.accepted()) {
      this.error.set('Confirme que aceita os termos e condições.');
      return;
    }
    await this.run(async () => {
      let address = this.method() === 'levantamento' ? null : this.address();
      if (address && this.addressChoice() === 'new' && this.addressForm.getRawValue().save) {
        const { save: _s, ...data } = this.addressForm.getRawValue();
        address = await this.customers.saveAddress(customer.id, { ...data, isDefault: !customer.addresses.length });
      }
      const contact = this.contactForm.getRawValue();
      const order = await this.sales.placeOrder({
        customerId: customer.id,
        contact,
        lines: this.cart.lines(),
        deliveryMethod: this.method(),
        address,
        province: this.method() === 'levantamento' ? 'Maputo Cidade' : this.province(),
        paymentMethod: this.payMethod(),
        paymentPhone: this.pay().prefixes ? this.walletPhone.value : null,
        couponCode: this.cart.couponCode(),
      });
      this.cart.clear();
      this.step.set(6);
      await this.router.navigate(['/checkout/concluido', order.id]);
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
