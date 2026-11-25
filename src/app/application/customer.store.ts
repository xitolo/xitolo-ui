import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RegisterCustomerDto } from '../domain/dtos';
import { Address, Customer, newId } from '../domain/entities';
import { CustomerRepository } from '../domain/repositories/repositories';
import { DomainError } from '../domain/services/domain-error';
import { MzPhone } from '../domain/value-objects/mz-phone';

@Injectable({ providedIn: 'root' })
export class CustomerStore {
  private readonly repo = inject(CustomerRepository);
  readonly customers = signal<Customer[]>([]);

  async load(): Promise<void> {
    this.customers.set(await firstValueFrom(this.repo.findAll()));
  }

  customer(id: string | null | undefined): Customer | undefined {
    return id ? this.customers().find((c) => c.id === id) : undefined;
  }

  async authenticate(email: string, password: string): Promise<Customer> {
    const c = await firstValueFrom(this.repo.findByEmail(email));
    if (!c || c.password !== password) throw new DomainError('Email ou palavra-passe incorrectos.');
    if (!c.active) throw new DomainError('Esta conta está desactivada. Contacte o apoio ao cliente.');
    return c;
  }

  async register(dto: RegisterCustomerDto): Promise<Customer> {
    const email = dto.email.trim().toLowerCase();
    if (await firstValueFrom(this.repo.findByEmail(email))) throw new DomainError('Já existe uma conta com este email.');
    const phone = MzPhone.parse(dto.phone);
    if (!phone) throw new DomainError('Telemóvel inválido — 9 dígitos a começar por 82 a 87.');
    if (dto.password.length < 6) throw new DomainError('A palavra-passe deve ter pelo menos 6 caracteres.');
    const now = new Date().toISOString();
    const saved = await firstValueFrom(
      this.repo.create({
        name: dto.name.trim(),
        email,
        phone: phone.digits,
        password: dto.password,
        addresses: [],
        favorites: [],
        active: true,
        createdAt: now,
        updatedAt: now,
      }),
    );
    this.customers.update((all) => [saved, ...all]);
    return saved;
  }

  async update(customer: Customer): Promise<Customer> {
    const saved = await firstValueFrom(this.repo.update({ ...customer, updatedAt: new Date().toISOString() }));
    this.customers.update((all) => all.map((c) => (c.id === saved.id ? saved : c)));
    return saved;
  }

  private require(id: string): Customer {
    const c = this.customer(id);
    if (!c) throw new DomainError('Cliente não encontrado.');
    return c;
  }

  async updateProfile(id: string, data: { name: string; email: string; phone: string }): Promise<Customer> {
    const c = this.require(id);
    const email = data.email.trim().toLowerCase();
    if (this.customers().some((x) => x.email === email && x.id !== id)) throw new DomainError('Este email já está a ser usado.');
    const phone = MzPhone.parse(data.phone);
    if (!phone) throw new DomainError('Telemóvel inválido.');
    return this.update({ ...c, name: data.name.trim(), email, phone: phone.digits });
  }

  async saveAddress(customerId: string, address: Omit<Address, 'id'> & { id?: string }): Promise<Address> {
    const c = this.require(customerId);
    if (!MzPhone.isValid(address.phone)) throw new DomainError('Telemóvel do destinatário inválido.');
    const saved: Address = { ...address, phone: MzPhone.normalize(address.phone), id: address.id ?? newId('adr') };
    let list = c.addresses.some((a) => a.id === saved.id)
      ? c.addresses.map((a) => (a.id === saved.id ? saved : a))
      : [...c.addresses, saved];
    if (saved.isDefault || list.length === 1) list = list.map((a) => ({ ...a, isDefault: a.id === saved.id }));
    await this.update({ ...c, addresses: list });
    return saved;
  }

  async removeAddress(customerId: string, addressId: string): Promise<void> {
    const c = this.require(customerId);
    let list = c.addresses.filter((a) => a.id !== addressId);
    if (list.length && !list.some((a) => a.isDefault)) list = list.map((a, i) => ({ ...a, isDefault: i === 0 }));
    await this.update({ ...c, addresses: list });
  }

  async toggleFavorite(customerId: string, productId: string): Promise<boolean> {
    const c = this.require(customerId);
    const has = c.favorites.includes(productId);
    await this.update({ ...c, favorites: has ? c.favorites.filter((f) => f !== productId) : [...c.favorites, productId] });
    return !has;
  }

  async mergeFavorites(customerId: string, productIds: string[]): Promise<void> {
    const c = this.require(customerId);
    const merged = [...new Set([...c.favorites, ...productIds])];
    if (merged.length !== c.favorites.length) await this.update({ ...c, favorites: merged });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.update({ ...this.require(id), active });
  }
}
