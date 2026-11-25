import { Entity } from './common';

export interface Address {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  /** Bairro, rua e número da casa. */
  street: string;
  reference: string;
  isDefault: boolean;
}

export interface Customer extends Entity {
  name: string;
  email: string;
  phone: string;
  /**
   * Apenas para a demonstração (sem backend). Numa versão com API real
   * a autenticação é feita no servidor e esta propriedade desaparece.
   */
  password: string;
  addresses: Address[];
  favorites: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function defaultAddress(c: Pick<Customer, 'addresses'>): Address | null {
  return c.addresses.find((a) => a.isDefault) ?? c.addresses[0] ?? null;
}

export function formatAddress(a: Pick<Address, 'street' | 'city' | 'province'>): string {
  return `${a.street}, ${a.city}, ${a.province}`;
}
