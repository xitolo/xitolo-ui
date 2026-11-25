import { Injectable, inject } from '@angular/core';
import { Review } from '../domain/entities';
import { DomainError } from '../domain/services/domain-error';
import { CatalogStore } from './catalog.store';
import { CustomerStore } from './customer.store';
import { SalesStore } from './sales.store';

/** Avaliações: só quem recebeu o produto pode avaliar, uma vez por produto. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly catalog = inject(CatalogStore);
  private readonly sales = inject(SalesStore);
  private readonly customers = inject(CustomerStore);

  reviewsOf(customerId: string): Review[] {
    return this.catalog.reviews().filter((r) => r.customerId === customerId);
  }

  existing(customerId: string, productId: string): Review | undefined {
    return this.catalog.reviews().find((r) => r.customerId === customerId && r.productId === productId);
  }

  /** Encomenda entregue que contém o produto (habilita a avaliação). */
  deliveredOrderWith(customerId: string, productId: string): string | null {
    return (
      this.sales
        .ordersOf(customerId)
        .find((o) => o.status === 'entregue' && o.items.some((i) => i.productId === productId))?.id ?? null
    );
  }

  canReview(customerId: string, productId: string): boolean {
    return !!this.deliveredOrderWith(customerId, productId) && !this.existing(customerId, productId);
  }

  async submit(customerId: string, productId: string, rating: number, comment: string): Promise<Review> {
    const customer = this.customers.customer(customerId);
    if (!customer) throw new DomainError('Inicie sessão para avaliar.');
    if (this.existing(customerId, productId)) throw new DomainError('Já avaliou este produto.');
    const orderId = this.deliveredOrderWith(customerId, productId);
    if (!orderId) throw new DomainError('Só pode avaliar produtos de encomendas entregues.');
    if (rating < 1 || rating > 5) throw new DomainError('Escolha de 1 a 5 estrelas.');
    return this.catalog.insertReview({
      productId,
      customerId,
      customerName: customer.name,
      orderId,
      rating,
      comment: comment.trim(),
      createdAt: new Date().toISOString(),
    });
  }
}
