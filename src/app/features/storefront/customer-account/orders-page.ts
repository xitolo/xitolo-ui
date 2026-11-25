import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { orderUnits } from '../../../domain/entities';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_METHODS } from '../../../domain/value-objects/statuses';
import { OrderTimeline } from '../../../shared/components/order-timeline';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

type Filter = 'todas' | 'curso' | 'entregues' | 'canceladas';

@Component({
  selector: 'app-orders-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, Badge, EmptyState, OrderTimeline, ProductImage],
  styles: `.ord{display:block;padding:16px;transition:box-shadow .15s}.ord:hover{box-shadow:var(--shadow)}
    .imgs{display:flex;gap:6px;margin:10px 0}.imgs span{width:46px;height:56px;border-radius:8px;overflow:hidden;display:block}`,
  template: `
    <div class="page-head"><div><h1>As minhas encomendas</h1><p>{{ orders().length }} encomenda(s)</p></div></div>
    <div class="tabs" style="margin-bottom:14px">
      @for (f of filters; track f.id) {
        <button type="button" [class.on]="filter() === f.id" (click)="filter.set(f.id)">{{ f.label }}</button>
      }
    </div>
    <div class="stack">
      @for (o of shown(); track o.id) {
        <a class="card ord" [routerLink]="['/conta/encomendas', o.id]">
          <div class="row between wrap">
            <div><b>{{ o.number }}</b><div class="muted small">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ units(o) }} artigos · {{ pay[o.paymentMethod].label }}</div></div>
            <div class="row"><b>{{ o.total | mzn }}</b><app-badge [label]="label[o.status]" [tone]="tone[o.status]" /></div>
          </div>
          <div class="imgs">
            @for (i of o.items.slice(0, 5); track $index) {
              <span><app-product-image [images]="i.image ? [i.image] : []" [type]="i.illustration.type" [pattern]="i.illustration.pattern" [color]="i.color" /></span>
            }
          </div>
          <app-order-timeline [order]="o" [compact]="true" />
        </a>
      } @empty {
        <app-empty icon="package" title="Sem encomendas aqui" text="Quando fizeres uma compra, podes acompanhá-la nesta página.">
          <a class="btn" routerLink="/produtos">Ir às compras</a>
        </app-empty>
      }
    </div>
  `,
})
export class OrdersPage {
  private readonly sales = inject(SalesStore);
  private readonly session = inject(SessionService);
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly pay = PAYMENT_METHODS;
  protected readonly units = orderUnits;
  protected readonly filter = signal<Filter>('todas');
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'curso', label: 'Em curso' },
    { id: 'entregues', label: 'Entregues' },
    { id: 'canceladas', label: 'Canceladas' },
  ];
  protected readonly orders = computed(() => this.sales.ordersOf(this.session.customer()?.id ?? ''));
  protected readonly shown = computed(() =>
    this.orders().filter((o) => {
      switch (this.filter()) {
        case 'curso':
          return o.status !== 'entregue' && o.status !== 'cancelada';
        case 'entregues':
          return o.status === 'entregue';
        case 'canceladas':
          return o.status === 'cancelada';
        default:
          return true;
      }
    }),
  );
}
