import { Observable } from 'rxjs';
import {
  Category,
  Customer,
  Delivery,
  Entity,
  Order,
  Payment,
  Product,
  Promotion,
  Review,
  StockMovement,
} from '../entities';

/**
 * Contratos de repositório (portas). A camada de aplicação depende apenas
 * destas classes abstractas, usadas também como tokens de injecção.
 *
 * Hoje são implementadas por repositórios mockados (infrastructure/repositories).
 * Para ligar a um backend REST basta criar implementações com HttpClient e
 * trocar o provider em `infrastructure/providers.ts`.
 */
export abstract class CrudRepository<T extends Entity> {
  abstract findAll(): Observable<T[]>;
  abstract findById(id: string): Observable<T | null>;
  abstract create(entity: Omit<T, 'id'> & { id?: string }): Observable<T>;
  abstract update(entity: T): Observable<T>;
  abstract delete(id: string): Observable<void>;
  /** Escrita em lote (usada por operações que alteram vários registos). */
  abstract saveMany(entities: T[]): Observable<T[]>;
}

export abstract class ProductRepository extends CrudRepository<Product> {}
export abstract class CategoryRepository extends CrudRepository<Category> {}
export abstract class PromotionRepository extends CrudRepository<Promotion> {}
export abstract class ReviewRepository extends CrudRepository<Review> {}
export abstract class StockMovementRepository extends CrudRepository<StockMovement> {}
export abstract class PaymentRepository extends CrudRepository<Payment> {}
export abstract class DeliveryRepository extends CrudRepository<Delivery> {}

export abstract class OrderRepository extends CrudRepository<Order> {
  abstract findByCustomer(customerId: string): Observable<Order[]>;
}

export abstract class CustomerRepository extends CrudRepository<Customer> {
  abstract findByEmail(email: string): Observable<Customer | null>;
}
