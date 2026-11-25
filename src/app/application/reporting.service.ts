import { Injectable, inject } from '@angular/core';
import { stockLevel } from '../domain/entities';
import {
  Granularity,
  computeFinancialSummary,
  deliveryPerformance,
  orderStatusDistribution,
  paymentMethodMix,
  salesByCategory,
  salesSeries,
  topProducts,
} from '../domain/services/finance';
import { DateRange, inRange } from '../domain/value-objects/date-range';
import { OrderStatus } from '../domain/value-objects/statuses';
import { CatalogStore } from './catalog.store';
import { CustomerStore } from './customer.store';
import { SalesStore } from './sales.store';

const PROCESSING: OrderStatus[] = ['confirmada', 'em_preparacao', 'pronta_envio', 'em_transito', 'saiu_entrega'];

/**
 * Indicadores e relatórios do painel. Tudo é calculado a partir dos registos
 * actuais das stores — não existem totais guardados em separado.
 */
@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly sales = inject(SalesStore);
  private readonly catalog = inject(CatalogStore);
  private readonly customers = inject(CustomerStore);

  financial(range: DateRange) {
    return computeFinancialSummary(this.sales.orders(), this.sales.payments(), this.sales.deliveries(), range);
  }

  commercial(range: DateRange) {
    const orders = this.sales.orders().filter((o) => inRange(o.createdAt, range));
    const products = this.catalog.products();
    const active = products.filter((p) => p.status === 'activo');
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === 'pendente').length,
      processing: orders.filter((o) => PROCESSING.includes(o.status)).length,
      delivered: orders.filter((o) => o.status === 'entregue').length,
      cancelled: orders.filter((o) => o.status === 'cancelada').length,
      customers: this.customers.customers().length,
      newCustomers: this.customers.customers().filter((c) => inRange(c.createdAt, range)).length,
      activeProducts: active.length,
      outOfStock: active.filter((p) => stockLevel(p) === 'esgotado').length,
      lowStock: active.filter((p) => stockLevel(p) === 'baixo').length,
    };
  }

  deliveries(range: DateRange) {
    return deliveryPerformance(this.sales.deliveries(), range);
  }

  series(range: DateRange, g: Granularity) {
    return salesSeries(this.sales.orders(), this.sales.payments(), range, g);
  }

  topProducts(range: DateRange, limit = 10) {
    return topProducts(this.sales.orders(), range, limit);
  }

  byCategory(range: DateRange) {
    return salesByCategory(this.sales.orders(), this.catalog.categories(), range);
  }

  paymentMix(range: DateRange) {
    return paymentMethodMix(this.sales.orders(), range);
  }

  statusDistribution(range: DateRange) {
    return orderStatusDistribution(this.sales.orders(), range);
  }
}
