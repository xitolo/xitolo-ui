/* Estados de domínio e respectivos rótulos em português de Moçambique. */

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

// ---------- Encomendas ----------
export type OrderStatus =
  | 'pendente'
  | 'confirmada'
  | 'em_preparacao'
  | 'pronta_envio'
  | 'em_transito'
  | 'saiu_entrega'
  | 'entregue'
  | 'cancelada';

/** Fluxo normal (linear) de uma encomenda com entrega ao domicílio. */
export const ORDER_FLOW: readonly OrderStatus[] = [
  'pendente',
  'confirmada',
  'em_preparacao',
  'pronta_envio',
  'em_transito',
  'saiu_entrega',
  'entregue',
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  em_preparacao: 'Em preparação',
  pronta_envio: 'Pronta para envio',
  em_transito: 'Em trânsito',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  pendente: 'warning',
  confirmada: 'info',
  em_preparacao: 'info',
  pronta_envio: 'info',
  em_transito: 'brand',
  saiu_entrega: 'brand',
  entregue: 'success',
  cancelada: 'danger',
};

// ---------- Pagamentos ----------
export type PaymentStatus = 'pendente' | 'confirmado' | 'rejeitado' | 'reembolsado';
export type PaymentMethod = 'mpesa' | 'emola' | 'transferencia' | 'na_entrega';

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  rejeitado: 'Rejeitado',
  reembolsado: 'Reembolsado',
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  pendente: 'warning',
  confirmado: 'success',
  rejeitado: 'danger',
  reembolsado: 'neutral',
};

export interface PaymentMethodInfo {
  id: PaymentMethod;
  label: string;
  description: string;
  color: string;
  /** Prefixos de telemóvel aceites (só carteiras móveis). */
  prefixes: string[] | null;
  /** Comissão estimada cobrada à loja (%) — usada no cálculo da receita líquida. */
  feePercent: number;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodInfo> = {
  mpesa: {
    id: 'mpesa',
    label: 'M-Pesa',
    description: 'Vodacom · números 84 / 85',
    color: '#e60000',
    prefixes: ['84', '85'],
    feePercent: 1.5,
  },
  emola: {
    id: 'emola',
    label: 'e-Mola',
    description: 'Movitel · números 86 / 87',
    color: '#f28c00',
    prefixes: ['86', '87'],
    feePercent: 1.5,
  },
  transferencia: {
    id: 'transferencia',
    label: 'Transferência bancária',
    description: 'BCI, Millennium bim, Standard Bank, Moza…',
    color: '#0b5fa5',
    prefixes: null,
    feePercent: 0,
  },
  na_entrega: {
    id: 'na_entrega',
    label: 'Pagamento na entrega',
    description: 'Dinheiro ou POS — Maputo Cidade e Província',
    color: '#1b1715',
    prefixes: null,
    feePercent: 0,
  },
};

// ---------- Entregas ----------
export type DeliveryStatus = 'pendente' | 'em_curso' | 'concluida' | 'cancelada';
export type DeliveryMethod = 'normal' | 'expresso' | 'levantamento';

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pendente: 'Pendente',
  em_curso: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const DELIVERY_STATUS_TONE: Record<DeliveryStatus, Tone> = {
  pendente: 'warning',
  em_curso: 'brand',
  concluida: 'success',
  cancelada: 'danger',
};

// ---------- Stock ----------
export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'reserva' | 'libertacao' | 'venda';

export const STOCK_MOVEMENT_LABEL: Record<StockMovementType, string> = {
  entrada: 'Entrada',
  saida: 'Saída manual',
  ajuste: 'Ajuste',
  reserva: 'Reserva',
  libertacao: 'Libertação',
  venda: 'Saída por venda',
};

export const STOCK_MOVEMENT_TONE: Record<StockMovementType, Tone> = {
  entrada: 'success',
  saida: 'danger',
  ajuste: 'neutral',
  reserva: 'warning',
  libertacao: 'info',
  venda: 'brand',
};
