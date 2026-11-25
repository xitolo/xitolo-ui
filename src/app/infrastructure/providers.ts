import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import {
  CategoryRepository,
  CustomerRepository,
  DeliveryRepository,
  OrderRepository,
  PaymentRepository,
  ProductRepository,
  PromotionRepository,
  ReviewRepository,
  StockMovementRepository,
} from '../domain/repositories/repositories';
import {
  MockCategoryRepository,
  MockCustomerRepository,
  MockDeliveryRepository,
  MockOrderRepository,
  MockPaymentRepository,
  MockProductRepository,
  MockPromotionRepository,
  MockReviewRepository,
  MockStockMovementRepository,
} from './repositories/mock-repositories';

/**
 * Liga os contratos de repositório às implementações mockadas.
 * Para usar um backend REST: criar `provideHttpRepositories()` com
 * implementações baseadas em HttpClient e trocá-lo em app.config.ts.
 */
export function provideMockRepositories(): EnvironmentProviders {
  const bindings: Provider[] = [
    { provide: ProductRepository, useClass: MockProductRepository },
    { provide: CategoryRepository, useClass: MockCategoryRepository },
    { provide: CustomerRepository, useClass: MockCustomerRepository },
    { provide: OrderRepository, useClass: MockOrderRepository },
    { provide: PaymentRepository, useClass: MockPaymentRepository },
    { provide: DeliveryRepository, useClass: MockDeliveryRepository },
    { provide: StockMovementRepository, useClass: MockStockMovementRepository },
    { provide: PromotionRepository, useClass: MockPromotionRepository },
    { provide: ReviewRepository, useClass: MockReviewRepository },
  ];
  return makeEnvironmentProviders(bindings);
}
