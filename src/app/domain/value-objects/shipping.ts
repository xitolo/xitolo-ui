import { DeliveryMethod } from './statuses';

export interface Province {
  name: string;
  region: 'Sul' | 'Centro' | 'Norte';
  /** Taxa de entrega normal cobrada ao cliente (MT). */
  fee: number;
  /** Custo operacional estimado para a loja (MT). */
  cost: number;
  /** Prazo máximo em dias para entrega normal. */
  etaDays: number;
  etaLabel: string;
  /** Pagamento na entrega e entrega expresso disponíveis. */
  metro: boolean;
}

export const PROVINCES: readonly Province[] = [
  { name: 'Maputo Cidade', region: 'Sul', fee: 100, cost: 70, etaDays: 1, etaLabel: '24h', metro: true },
  { name: 'Maputo Província', region: 'Sul', fee: 150, cost: 110, etaDays: 2, etaLabel: '1–2 dias', metro: true },
  { name: 'Gaza', region: 'Sul', fee: 250, cost: 190, etaDays: 3, etaLabel: '2–3 dias', metro: false },
  { name: 'Inhambane', region: 'Sul', fee: 300, cost: 230, etaDays: 4, etaLabel: '3–4 dias', metro: false },
  { name: 'Sofala', region: 'Centro', fee: 350, cost: 270, etaDays: 5, etaLabel: '3–5 dias', metro: false },
  { name: 'Manica', region: 'Centro', fee: 350, cost: 280, etaDays: 5, etaLabel: '3–5 dias', metro: false },
  { name: 'Tete', region: 'Centro', fee: 400, cost: 320, etaDays: 6, etaLabel: '4–6 dias', metro: false },
  { name: 'Zambézia', region: 'Centro', fee: 400, cost: 320, etaDays: 6, etaLabel: '4–6 dias', metro: false },
  { name: 'Nampula', region: 'Norte', fee: 450, cost: 360, etaDays: 7, etaLabel: '4–7 dias', metro: false },
  { name: 'Cabo Delgado', region: 'Norte', fee: 500, cost: 410, etaDays: 8, etaLabel: '5–8 dias', metro: false },
  { name: 'Niassa', region: 'Norte', fee: 500, cost: 420, etaDays: 8, etaLabel: '5–8 dias', metro: false },
];

/** Envio normal grátis a partir deste subtotal. */
export const FREE_SHIPPING_FROM = 3000;
export const EXPRESS_SURCHARGE = 150;
export const STORE_ADDRESS = 'Loja Xitolo — Av. 24 de Julho, 1520, Maputo';

export interface DeliveryOption {
  method: DeliveryMethod;
  label: string;
  description: string;
  fee: number;
  cost: number;
  etaDays: number;
  etaLabel: string;
  available: boolean;
  unavailableReason?: string;
}

export function findProvince(name: string): Province {
  return PROVINCES.find((p) => p.name === name) ?? PROVINCES[0];
}

/** Opções de entrega e respectivos custos para uma província e subtotal. */
export function deliveryOptions(provinceName: string, subtotal: number): DeliveryOption[] {
  const p = findProvince(provinceName);
  const free = subtotal >= FREE_SHIPPING_FROM;
  return [
    {
      method: 'normal',
      label: 'Entrega ao domicílio',
      description: free ? `Grátis acima de ${FREE_SHIPPING_FROM.toLocaleString('pt-PT')} MT` : `Entrega em ${p.name}`,
      fee: free ? 0 : p.fee,
      cost: p.cost,
      etaDays: p.etaDays,
      etaLabel: p.etaLabel,
      available: true,
    },
    {
      method: 'expresso',
      label: 'Expresso (mesmo dia)',
      description: 'Encomendas feitas até às 12h',
      fee: p.fee + EXPRESS_SURCHARGE,
      cost: p.cost + 100,
      etaDays: 1,
      etaLabel: 'Hoje',
      available: p.metro,
      unavailableReason: 'Só disponível em Maputo Cidade e Província',
    },
    {
      method: 'levantamento',
      label: 'Levantamento na loja',
      description: STORE_ADDRESS,
      fee: 0,
      cost: 0,
      etaDays: 1,
      etaLabel: 'Pronto em 24h',
      available: true,
    },
  ];
}

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  normal: 'Entrega ao domicílio',
  expresso: 'Expresso',
  levantamento: 'Levantamento na loja',
};
