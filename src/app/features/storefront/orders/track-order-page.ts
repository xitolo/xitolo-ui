import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { Order } from '../../../domain/entities';
import { MzPhone } from '../../../domain/value-objects/mz-phone';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { OrderTimeline } from '../../../shared/components/order-timeline';
import { Badge } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

/** Acompanhamento público: nº da encomenda + telemóvel usado na compra. */
@Component({
  selector: 'app-track-order-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OrderTimeline, Badge, MznPipe, DatePipe, Icon, RouterLink],
  styles: `.box{max-width:640px;margin:0 auto}.f{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
    @media (max-width:640px){.f{grid-template-columns:1fr}}`,
  template: `
    <div class="container page">
      <div class="box stack" style="--gap:16px">
        <div class="page-head"><div><h1>Seguir encomenda</h1><p>Indica o número da encomenda e o telemóvel usado na compra.</p></div></div>
        <form class="card pad f" (submit)="$event.preventDefault(); search()">
          <div class="field"><label for="n">Nº da encomenda</label><input id="n" class="input" placeholder="XT-261124-1234" [value]="number()" (input)="number.set($any($event.target).value)" /></div>
          <div class="field"><label for="t">Telemóvel</label><div class="input-prefix"><span>+258</span><input id="t" class="input" inputmode="numeric" [value]="phone()" (input)="phone.set($any($event.target).value)" /></div></div>
          <button class="btn">Procurar</button>
        </form>
        @if (session.isLoggedIn() && recent().length) {
          <div class="small muted">As tuas encomendas recentes:
            @for (o of recent(); track o.id) { <button type="button" class="link" (click)="pick(o)">{{ o.number }}</button>&nbsp; }
          </div>
        }
        @if (searched() && !found()) {
          <div class="alert danger"><app-icon name="alert" [size]="16" /> Não encontrámos nenhuma encomenda com estes dados.</div>
        }
        @if (found(); as o) {
          <div class="card pad stack">
            <div class="row between wrap">
              <div><b>{{ o.number }}</b><div class="muted small">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ o.total | mzn }}</div></div>
              <app-badge [label]="label[o.status]" [tone]="tone[o.status]" />
            </div>
            <div class="divider"></div>
            <app-order-timeline [order]="o" />
            @if (session.customer()?.id === o.customerId) {
              <a class="link small" [routerLink]="['/conta/encomendas', o.id]">Ver detalhes completos →</a>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class TrackOrderPage {
  private readonly sales = inject(SalesStore);
  protected readonly session = inject(SessionService);
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly number = signal('');
  protected readonly phone = signal('');
  protected readonly searched = signal(false);
  private readonly foundId = signal<string | null>(null);
  protected readonly found = computed(() => (this.foundId() ? this.sales.order(this.foundId()!) : undefined));
  protected readonly recent = computed(() => {
    const c = this.session.customer();
    return c ? this.sales.ordersOf(c.id).slice(0, 3) : [];
  });

  search(): void {
    this.searched.set(true);
    const n = this.number().trim().toUpperCase();
    const ph = MzPhone.normalize(this.phone());
    const o = this.sales.orders().find((x) => x.number === n && (x.customerPhone === ph || x.address?.phone === ph));
    this.foundId.set(o?.id ?? null);
  }

  pick(o: Order): void {
    this.number.set(o.number);
    this.phone.set(o.customerPhone);
    this.search();
  }
}
