import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogStore } from '../../../application/catalog.store';
import { CustomerStore } from '../../../application/customer.store';
import { SalesStore } from '../../../application/sales.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatAddress } from '../../../domain/entities';
import { Money } from '../../../domain/value-objects/money';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_METHODS } from '../../../domain/value-objects/statuses';
import { Badge, EmptyState, KpiCard } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-customer-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, PhonePipe, Badge, KpiCard, EmptyState],
  styles: `.k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.g{display:grid;grid-template-columns:1fr 2fr;gap:14px;align-items:start}
    @media (max-width:1000px){.k{grid-template-columns:1fr 1fr}.g{grid-template-columns:1fr}}`,
  template: `
    @if (customer(); as c) {
      <nav class="breadcrumb"><a routerLink="/admin/clientes">Clientes</a> / <span>{{ c.name }}</span></nav>
      <div class="page-head">
        <div><h1>{{ c.name }}</h1><p>Cliente desde {{ c.createdAt | date: 'dd/MM/yyyy' }}</p></div>
        <div class="row"><app-badge [label]="c.active ? 'Activo' : 'Inactivo'" [tone]="c.active ? 'success' : 'neutral'" />
          <button type="button" class="btn ghost sm" (click)="toggle()">{{ c.active ? 'Desactivar conta' : 'Activar conta' }}</button></div>
      </div>
      <div class="k">
        <app-kpi label="Encomendas" [value]="orders().length" [sub]="cancelled() + ' canceladas'" icon="package" />
        <app-kpi label="Total gasto (pago)" [value]="m(spent())" icon="wallet" tone="success" />
        <app-kpi label="Valor médio" [value]="m(avg())" icon="chart" />
        <app-kpi label="Favoritos" [value]="c.favorites.length" icon="heart" tone="brand" />
      </div>
      <div class="g">
        <div class="stack">
          <div class="card pad small">
            <h3 style="margin-bottom:8px">Contactos</h3>
            <div class="kv"><span>Email</span><span>{{ c.email }}</span></div>
            <div class="kv"><span>Telemóvel</span><span>{{ c.phone | phone }}</span></div>
          </div>
          <div class="card pad small">
            <h3 style="margin-bottom:8px">Endereços ({{ c.addresses.length }})</h3>
            @for (a of c.addresses; track a.id) {
              <p style="margin-bottom:8px"><b>{{ a.label }}</b>@if (a.isDefault) { · principal }<br />{{ a.recipient }} · {{ a.phone | phone }}<br /><span class="muted">{{ fmt(a) }}</span></p>
            } @empty { <p class="muted">Sem endereços.</p> }
          </div>
          <div class="card pad small">
            <h3 style="margin-bottom:8px">Favoritos</h3>
            @for (id of c.favorites; track id) { <div>{{ catalog.product(id)?.name ?? 'Produto removido' }}</div> } @empty { <p class="muted">Nenhum.</p> }
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Histórico de compras</h3></div>
          @if (orders().length) {
            <div class="table-wrap"><table class="table">
              <thead><tr><th>Encomenda</th><th>Data</th><th class="num">Artigos</th><th>Pagamento</th><th class="num">Total</th><th>Estado</th></tr></thead>
              <tbody>
                @for (o of orders(); track o.id) {
                  <tr>
                    <td><a class="link mono small" [routerLink]="['/admin/encomendas', o.id]">{{ o.number }}</a></td>
                    <td>{{ o.createdAt | date: 'dd/MM/yyyy' }}</td>
                    <td class="num">{{ o.items.length }}</td>
                    <td>{{ pay[o.paymentMethod].label }}</td>
                    <td class="num">{{ o.total | mzn }}</td>
                    <td><app-badge [label]="label[o.status]" [tone]="tone[o.status]" /></td>
                  </tr>
                }
              </tbody></table></div>
          } @else { <app-empty icon="package" title="Sem encomendas" /> }
        </div>
      </div>
    } @else {
      <app-empty icon="users" title="Cliente não encontrado"><a class="btn" routerLink="/admin/clientes">Voltar</a></app-empty>
    }
  `,
})
export class CustomerDetailPage {
  readonly id = input.required<string>();
  private readonly customers = inject(CustomerStore);
  private readonly sales = inject(SalesStore);
  protected readonly catalog = inject(CatalogStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly pay = PAYMENT_METHODS;
  protected readonly fmt = formatAddress;
  protected readonly m = Money.format;

  protected readonly customer = computed(() => this.customers.customer(this.id()));
  protected readonly orders = computed(() => this.sales.ordersOf(this.id()));
  protected readonly cancelled = computed(() => this.orders().filter((o) => o.status === 'cancelada').length);
  private readonly paid = computed(() => this.orders().filter((o) => o.status !== 'cancelada' && this.sales.paymentFor(o.id)?.status === 'confirmado'));
  protected readonly spent = computed(() => this.paid().reduce((s, o) => s + o.total, 0));
  protected readonly avg = computed(() => (this.paid().length ? Math.round(this.spent() / this.paid().length) : 0));

  async toggle(): Promise<void> {
    const c = this.customer()!;
    if (c.active && !(await this.confirm.confirm({ title: 'Desactivar conta?', message: 'O cliente deixa de conseguir iniciar sessão e fazer encomendas. As encomendas existentes mantêm-se.', confirmLabel: 'Desactivar', danger: true }))) return;
    try {
      await this.customers.setActive(c.id, !c.active);
      this.toast.success(c.active ? 'Conta desactivada' : 'Conta activada');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
