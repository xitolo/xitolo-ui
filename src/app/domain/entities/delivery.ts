import { Address } from './customer';
import { ChangeLogEntry, Entity } from './common';
import { DeliveryMethod, DeliveryStatus } from '../value-objects/statuses';

export interface Delivery extends Entity {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  address: Address;
  method: DeliveryMethod;
  /** Valor cobrado ao cliente. */
  fee: number;
  /** Custo operacional para a loja. */
  cost: number;
  courier: string | null;
  status: DeliveryStatus;
  expectedBy: string;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: ChangeLogEntry[];
}

export const COURIERS = ['Albino Cossa', 'Fátima Nhantumbo', 'Hélder Mabunda', 'Transportes Chiuta', 'Correios de Moçambique'];

/**
 * Uma entrega está atrasada se, não estando concluída/cancelada, já passou
 * o prazo — ou se foi concluída depois do prazo previsto.
 */
export function isDeliveryLate(d: Pick<Delivery, 'status' | 'expectedBy' | 'completedAt'>, now = new Date()): boolean {
  const due = new Date(d.expectedBy).getTime();
  if (d.status === 'cancelada') return false;
  if (d.status === 'concluida') return !!d.completedAt && new Date(d.completedAt).getTime() > due;
  return now.getTime() > due;
}
