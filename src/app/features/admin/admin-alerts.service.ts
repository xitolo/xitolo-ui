import { Injectable, computed, inject } from '@angular/core';
import { InventoryStore } from '../../application/inventory.store';
import { SalesStore } from '../../application/sales.store';
import { isDeliveryLate } from '../../domain/entities';

export interface AdminAlert {
  id: string;
  icon: string;
  tone: 'warning' | 'danger' | 'info';
  title: string;
  text: string;
  link: string;
  query: Record<string, string>;
  count: number;
}

/** Alertas operacionais derivados dos dados (notificações do painel). */
@Injectable({ providedIn: 'root' })
export class AdminAlertsService {
  private readonly sales = inject(SalesStore);
  private readonly inventory = inject(InventoryStore);

  readonly pendingOrders = computed(() => this.sales.orders().filter((o) => o.status === 'pendente').length);
  readonly pendingPayments = computed(
    () => this.sales.payments().filter((p) => p.status === 'pendente' && this.sales.order(p.orderId)?.status !== 'cancelada').length,
  );
  readonly awaitingDelivery = computed(
    () =>
      this.sales
        .orders()
        .filter(
          (o) =>
            o.deliveryMethod !== 'levantamento' &&
            ['confirmada', 'em_preparacao', 'pronta_envio'].includes(o.status) &&
            !this.sales.deliveryFor(o.id),
        ).length,
  );
  readonly lateDeliveries = computed(() => {
    const now = new Date();
    return this.sales.deliveries().filter((d) => d.status !== 'concluida' && isDeliveryLate(d, now)).length;
  });
  readonly lowStock = computed(() => this.inventory.summary().low.length + this.inventory.summary().out.length);

  readonly alerts = computed<AdminAlert[]>(() => {
    const list: AdminAlert[] = [
      { id: 'po', icon: 'package', tone: 'warning', title: 'Encomendas pendentes', text: 'A aguardar pagamento ou confirmação', link: '/admin/encomendas', query: { estado: 'pendente' }, count: this.pendingOrders() },
      { id: 'pp', icon: 'wallet', tone: 'info', title: 'Pagamentos por confirmar', text: 'Transferências e cobranças pendentes', link: '/admin/pagamentos', query: { estado: 'pendente' }, count: this.pendingPayments() },
      { id: 'ad', icon: 'truck', tone: 'info', title: 'Entregas por registar', text: 'Encomendas confirmadas sem estafeta', link: '/admin/entregas', query: { vista: 'registar' }, count: this.awaitingDelivery() },
      { id: 'ld', icon: 'clock', tone: 'danger', title: 'Entregas atrasadas', text: 'Passaram o prazo previsto', link: '/admin/entregas', query: { vista: 'atrasadas' }, count: this.lateDeliveries() },
      { id: 'ls', icon: 'box', tone: 'danger', title: 'Stock reduzido ou esgotado', text: 'Produtos activos abaixo do mínimo', link: '/admin/stock', query: { nivel: 'alerta' }, count: this.lowStock() },
    ];
    return list.filter((a) => a.count > 0);
  });
  readonly total = computed(() => this.alerts().reduce((s, a) => s + a.count, 0));
}
