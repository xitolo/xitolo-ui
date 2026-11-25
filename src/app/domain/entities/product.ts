import { ChangeLogEntry, Entity, GarmentType } from './common';

export interface ProductVariants {
  sizes: string[];
  colors: string[];
}

export interface ProductIllustration {
  type: GarmentType;
  /** Padrão de capulana na ilustração. */
  pattern: boolean;
}

export type ProductStatus = 'activo' | 'inactivo';

export interface Product extends Entity {
  sku: string;
  name: string;
  description: string;
  features: string[];
  categoryId: string;
  /** Fotografias (data URL ou URL). Vazio → usa a ilustração. */
  images: string[];
  illustration: ProductIllustration;
  /** Preço de aquisição (custo). */
  costPrice: number;
  /** Preço de venda. */
  price: number;
  /** Preço promocional fixo definido no produto (opcional). */
  promoPrice: number | null;
  /** Stock físico em armazém. */
  stock: number;
  /** Unidades reservadas por encomendas ainda não entregues. */
  reserved: number;
  minStock: number;
  variants: ProductVariants;
  status: ProductStatus;
  madeInMz: boolean;
  createdAt: string;
  updatedAt: string;
  history: ChangeLogEntry[];
}

/** Unidades que ainda podem ser vendidas. */
export function availableStock(p: Pick<Product, 'stock' | 'reserved'>): number {
  return Math.max(0, p.stock - p.reserved);
}

export type StockLevel = 'ok' | 'baixo' | 'esgotado';

export function stockLevel(p: Pick<Product, 'stock' | 'reserved' | 'minStock'>): StockLevel {
  const a = availableStock(p);
  if (a <= 0) return 'esgotado';
  if (a <= p.minStock) return 'baixo';
  return 'ok';
}
