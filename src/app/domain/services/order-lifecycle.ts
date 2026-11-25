import { Order } from '../entities/order';
import { Payment } from '../entities/payment';
import { DeliveryMethod, DeliveryStatus, ORDER_FLOW, ORDER_STATUS_LABEL, OrderStatus } from '../value-objects/statuses';

/** Encomendas para levantamento não passam pelos estados de transporte. */
export function orderFlow(method: DeliveryMethod): OrderStatus[] {
  return method === 'levantamento'
    ? ORDER_FLOW.filter((s) => s !== 'em_transito' && s !== 'saiu_entrega')
    : [...ORDER_FLOW];
}

const CANCELLABLE: readonly OrderStatus[] = ['pendente', 'confirmada', 'em_preparacao', 'pronta_envio'];

export function canCancel(status: OrderStatus): boolean {
  return CANCELLABLE.includes(status);
}

export function isFinal(status: OrderStatus): boolean {
  return status === 'entregue' || status === 'cancelada';
}

export function requiresPrepayment(o: Pick<Order, 'paymentMethod'>): boolean {
  return o.paymentMethod !== 'na_entrega';
}

/** Estados para os quais a encomenda pode avançar (apenas para a frente). */
export function nextStatuses(o: Pick<Order, 'status' | 'deliveryMethod'>): OrderStatus[] {
  if (isFinal(o.status)) return [];
  const flow = orderFlow(o.deliveryMethod);
  const idx = flow.indexOf(o.status);
  const forward = flow.slice(idx + 1);
  return canCancel(o.status) ? [...forward, 'cancelada'] : forward;
}

/**
 * Valida a transição. Devolve a mensagem de erro, ou null se for permitida.
 * Regra: encomendas pré-pagas (M-Pesa, e-Mola, transferência) só são
 * confirmadas depois de o pagamento estar confirmado.
 */
export function transitionError(o: Order, to: OrderStatus, payment: Payment | null): string | null {
  if (o.status === to) return 'A encomenda já se encontra neste estado.';
  if (!nextStatuses(o).includes(to)) {
    return `Não é possível passar de "${ORDER_STATUS_LABEL[o.status]}" para "${ORDER_STATUS_LABEL[to]}".`;
  }
  if (to !== 'cancelada' && requiresPrepayment(o) && payment?.status !== 'confirmado') {
    return 'Esta encomenda só pode avançar depois de o pagamento ser confirmado.';
  }
  return null;
}

/** Estado da entrega correspondente a um estado da encomenda. */
export function deliveryStatusFor(status: OrderStatus): DeliveryStatus {
  switch (status) {
    case 'em_transito':
    case 'saiu_entrega':
      return 'em_curso';
    case 'entregue':
      return 'concluida';
    case 'cancelada':
      return 'cancelada';
    default:
      return 'pendente';
  }
}

/** Progresso (0–1) para barras e linhas temporais. */
export function orderProgress(o: Pick<Order, 'status' | 'deliveryMethod'>): number {
  if (o.status === 'cancelada') return 0;
  const flow = orderFlow(o.deliveryMethod);
  return flow.indexOf(o.status) / (flow.length - 1);
}

let seq = 0;
/** Número de encomenda legível e único: XT-AAMMDD-XXXX */
export function generateOrderNumber(now = new Date(), existing: ReadonlySet<string> = new Set()): string {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let n: string;
  do {
    seq = (seq + 1) % 10000;
    const rnd = (Math.floor(Math.random() * 9000) + 1000 + seq) % 10000;
    n = `XT-${yy}${mm}${dd}-${String(rnd).padStart(4, '0')}`;
  } while (existing.has(n));
  return n;
}
