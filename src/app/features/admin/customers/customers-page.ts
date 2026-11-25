import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CustomerStore } from '../../../application/customer.store';
import { SalesStore } from '../../../application/sales.store';
import { Customer, defaultAddress } from '../../../domain/entities';
import { MzPhone } from '../../../domain/value-objects/mz-phone';
import { Icon } from '../../../shared/components/icon';
import { Badge, EmptyState, Pagination, paginate } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';
import { downloadCsv } from '../shared/period-filter';

export interface CustomerRow {
  c: Customer;
  orders: number;
  spent: number;
  last: string | null;
}

@Component({
  selector: 'app-customers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MznPipe, PhonePipe, Badge, Pagination, EmptyState, Icon],
  template: `
    <div class="page-head">
      <div><h1>Clientes</h1><p>{{ customers.customers().length }} clientes registados</p></div>
      <button type="button" class="btn ghost sm" (click)="export()"><app-icon name="download" [size]="16" /> CSV</button>
    </div>
    <div class="card">
      <div class="row wrap" style="padding:12px 14px;border-bottom:1px solid var(--line)">
        <div class="search-box" style="height:36px;flex:1;min-width:200px"><app-icon name="search" />
          <input placeholder="Nome, email ou telefone" [value]="q()" (input)="q.set($any($event.target).value); page.set(1)" aria-label="Pesquisar" /></div>
        <select class="select sm" style="width:auto" [value]="sort()" (change)="sort.set($any($event.target).value)" aria-label="Ordenar">
          <option value="spent">Maior valor gasto</option><option value="orders">Mais encomendas</option><option value="recent">Registo mais recente</option><option value="name">Nome</option>
        </select>
      </div>
      @if (filtered().length) {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Cliente</th><th>Contacto</th><th>Província</th><th class="num">Encomendas</th><th class="num">Total gasto</th><th>Última compra</th><th>Estado</th></tr></thead>
          <tbody>
            @for (r of rows(); track r.c.id) {
              <tr class="clickable" (click)="router.navigate(['/admin/clientes', r.c.id])">
                <td><b>{{ r.c.name }}</b><div class="muted xs">desde {{ r.c.createdAt | date: 'MM/yyyy' }}</div></td>
                <td class="small">{{ r.c.email }}<div class="muted xs">{{ r.c.phone | phone }}</div></td>
                <td>{{ province(r.c) }}</td>
                <td class="num">{{ r.orders }}</td>
                <td class="num"><b>{{ r.spent | mzn }}</b></td>
                <td>{{ r.last ? (r.last | date: 'dd/MM/yyyy') : '—' }}</td>
                <td><app-badge [label]="r.c.active ? 'Activo' : 'Inactivo'" [tone]="r.c.active ? 'success' : 'neutral'" /></td>
              </tr>
            }
          </tbody></table></div>
        <app-pagination [total]="filtered().length" [(page)]="page" [(size)]="size" />
      } @else {
        <app-empty icon="users" title="Nenhum cliente encontrado" />
      }
    </div>
  `,
})
export class CustomersPage {
  protected readonly customers = inject(CustomerStore);
  private readonly sales = inject(SalesStore);
  protected readonly router = inject(Router);
  protected readonly q = signal('');
  protected readonly sort = signal<'spent' | 'orders' | 'recent' | 'name'>('spent');
  protected readonly page = signal(1);
  protected readonly size = signal(20);

  private readonly all = computed<CustomerRow[]>(() =>
    this.customers.customers().map((c) => {
      const orders = this.sales.ordersOf(c.id);
      const spent = orders
        .filter((o) => o.status !== 'cancelada' && this.sales.paymentFor(o.id)?.status === 'confirmado')
        .reduce((s, o) => s + o.total, 0);
      return { c, orders: orders.length, spent, last: orders[0]?.createdAt ?? null };
    }),
  );
  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    const d = MzPhone.normalize(q);
    const list = this.all().filter((r) => !q || r.c.name.toLowerCase().includes(q) || r.c.email.includes(q) || (d.length >= 3 && r.c.phone.includes(d)));
    const by = {
      spent: (a: CustomerRow, b: CustomerRow) => b.spent - a.spent,
      orders: (a: CustomerRow, b: CustomerRow) => b.orders - a.orders,
      recent: (a: CustomerRow, b: CustomerRow) => b.c.createdAt.localeCompare(a.c.createdAt),
      name: (a: CustomerRow, b: CustomerRow) => a.c.name.localeCompare(b.c.name),
    }[this.sort()];
    return list.sort(by);
  });
  protected readonly rows = computed(() => paginate(this.filtered(), this.page(), this.size()));

  province(c: Customer): string {
    return defaultAddress(c)?.province ?? '—';
  }

  export(): void {
    downloadCsv(
      'clientes-xitolo.csv',
      ['Nome', 'Email', 'Telefone', 'Província', 'Encomendas', 'Total gasto (pago)', 'Registo', 'Estado'],
      this.filtered().map((r) => [r.c.name, r.c.email, r.c.phone, this.province(r.c), r.orders, r.spent, r.c.createdAt.slice(0, 10), r.c.active ? 'Activo' : 'Inactivo']),
    );
  }
}
