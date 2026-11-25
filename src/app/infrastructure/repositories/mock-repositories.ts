import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Category,
  Customer,
  Delivery,
  Order,
  Payment,
  Product,
  Promotion,
  Review,
  StockMovement,
} from '../../domain/entities';
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
} from '../../domain/repositories/repositories';
import { ProductMapper } from '../mappers/mappers';
import { MockCrudRepository } from './mock-crud.repository';

@Injectable()
export class MockProductRepository extends MockCrudRepository<'products', Product> implements ProductRepository {
  protected readonly collection = 'products';
  protected readonly idPrefix = 'prd';
  protected override toEntity(raw: Product): Product {
    return ProductMapper.normalize(raw);
  }
}

@Injectable()
export class MockCategoryRepository extends MockCrudRepository<'categories', Category> implements CategoryRepository {
  protected readonly collection = 'categories';
  protected readonly idPrefix = 'cat';
}

@Injectable()
export class MockCustomerRepository extends MockCrudRepository<'customers', Customer> implements CustomerRepository {
  protected readonly collection = 'customers';
  protected readonly idPrefix = 'cli';
  findByEmail(email: string): Observable<Customer | null> {
    const e = email.trim().toLowerCase();
    return this.respond(() => this.rows().find((c) => c.email.toLowerCase() === e) ?? null);
  }
}

@Injectable()
export class MockOrderRepository extends MockCrudRepository<'orders', Order> implements OrderRepository {
  protected readonly collection = 'orders';
  protected readonly idPrefix = 'ord';
  findByCustomer(customerId: string): Observable<Order[]> {
    return this.respond(() => this.rows().filter((o) => o.customerId === customerId));
  }
}

@Injectable()
export class MockPaymentRepository extends MockCrudRepository<'payments', Payment> implements PaymentRepository {
  protected readonly collection = 'payments';
  protected readonly idPrefix = 'pay';
}

@Injectable()
export class MockDeliveryRepository extends MockCrudRepository<'deliveries', Delivery> implements DeliveryRepository {
  protected readonly collection = 'deliveries';
  protected readonly idPrefix = 'dlv';
}

@Injectable()
export class MockStockMovementRepository
  extends MockCrudRepository<'stockMovements', StockMovement>
  implements StockMovementRepository
{
  protected readonly collection = 'stockMovements';
  protected readonly idPrefix = 'mov';
}

@Injectable()
export class MockPromotionRepository extends MockCrudRepository<'promotions', Promotion> implements PromotionRepository {
  protected readonly collection = 'promotions';
  protected readonly idPrefix = 'prm';
}

@Injectable()
export class MockReviewRepository extends MockCrudRepository<'reviews', Review> implements ReviewRepository {
  protected readonly collection = 'reviews';
  protected readonly idPrefix = 'rev';
}
