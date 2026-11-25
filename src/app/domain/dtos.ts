import { Address } from './entities/customer';
import { DiscountType, PromotionKind, PromotionScope } from './entities/misc';
import { ProductIllustration, ProductStatus } from './entities/product';
import { GarmentType } from './entities/common';
import { DeliveryMethod, PaymentMethod } from './value-objects/statuses';

/*
 * DTOs — dados que entram na aplicação vindos de formulários (e, no futuro,
 * os payloads trocados com a API REST). São convertidos em entidades pelos
 * mappers em infrastructure/mappers.
 */

export interface ProductFormDto {
  sku: string;
  name: string;
  description: string;
  features: string[];
  categoryId: string;
  images: string[];
  illustration: ProductIllustration;
  costPrice: number;
  price: number;
  promoPrice: number | null;
  initialStock: number;
  minStock: number;
  sizes: string[];
  colors: string[];
  status: ProductStatus;
  madeInMz: boolean;
}

export interface CategoryFormDto {
  name: string;
  description: string;
  image: string | null;
  illustration: { type: GarmentType; color: string };
  active: boolean;
  sortOrder: number;
}

export interface PromotionFormDto {
  name: string;
  description: string;
  kind: PromotionKind;
  code: string | null;
  discountType: DiscountType;
  value: number;
  minSubtotal: number;
  scope: PromotionScope;
  productIds: string[];
  categoryIds: string[];
  startsAt: string;
  endsAt: string;
  active: boolean;
  bannerColor: string;
}

export interface CartLineDto {
  productId: string;
  size: string;
  color: string;
  qty: number;
}

export interface PlaceOrderRequest {
  customerId: string;
  contact: { name: string; email: string; phone: string };
  lines: CartLineDto[];
  deliveryMethod: DeliveryMethod;
  address: Address | null;
  /** Província usada para calcular a entrega (no levantamento é Maputo Cidade). */
  province: string;
  paymentMethod: PaymentMethod;
  paymentPhone: string | null;
  couponCode: string | null;
}

export interface RegisterCustomerDto {
  name: string;
  email: string;
  phone: string;
  password: string;
}
