import { Injectable, computed, inject, signal } from '@angular/core';
import { CustomerStore } from '../../application/customer.store';
import { RegisterCustomerDto } from '../../domain/dtos';
import { Customer } from '../../domain/entities';
import { DomainError } from '../../domain/services/domain-error';
import { BrowserStorage } from './browser-storage';

const CUSTOMER_KEY = 'xitolo:session:customer';
const ADMIN_KEY = 'xitolo:session:admin';

/** Credenciais do administrador de demonstração. */
export const DEMO_ADMIN = { email: 'admin@xitolo.co.mz', password: 'admin123', name: 'Dombo Admin' };

/**
 * Sessões simuladas (cliente e administrador). Sem backend, a autenticação
 * é apenas para demonstração; numa versão com API passa a usar tokens.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly customers = inject(CustomerStore);

  private readonly customerId = signal<string | null>(BrowserStorage.get<string | null>(CUSTOMER_KEY, null));
  readonly isAdmin = signal<boolean>(BrowserStorage.get<boolean>(ADMIN_KEY, false));

  readonly customer = computed<Customer | null>(() => {
    const c = this.customers.customer(this.customerId());
    return c && c.active ? c : null;
  });
  readonly isLoggedIn = computed(() => !!this.customer());
  readonly firstName = computed(() => this.customer()?.name.split(' ')[0] ?? '');

  async login(email: string, password: string): Promise<Customer> {
    const c = await this.customers.authenticate(email, password);
    this.setCustomer(c.id);
    return c;
  }

  async register(dto: RegisterCustomerDto): Promise<Customer> {
    const c = await this.customers.register(dto);
    this.setCustomer(c.id);
    return c;
  }

  logout(): void {
    this.setCustomer(null);
  }

  adminLogin(email: string, password: string): void {
    if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
      throw new DomainError('Credenciais de administrador inválidas.');
    }
    this.isAdmin.set(true);
    BrowserStorage.set(ADMIN_KEY, true);
  }

  adminLogout(): void {
    this.isAdmin.set(false);
    BrowserStorage.remove(ADMIN_KEY);
  }

  private setCustomer(id: string | null): void {
    this.customerId.set(id);
    if (id) BrowserStorage.set(CUSTOMER_KEY, id);
    else BrowserStorage.remove(CUSTOMER_KEY);
  }
}
