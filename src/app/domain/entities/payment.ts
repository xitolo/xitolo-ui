import { ChangeLogEntry, Entity } from './common';
import { PaymentMethod, PaymentStatus } from '../value-objects/statuses';

export interface Payment extends Entity {
  reference: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  /** Comissão estimada do operador (MT). */
  fee: number;
  status: PaymentStatus;
  /** Número de carteira móvel usado (M-Pesa / e-Mola). */
  phone: string | null;
  createdAt: string;
  confirmedAt: string | null;
  updatedAt: string;
  history: ChangeLogEntry[];
}
