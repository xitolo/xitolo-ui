import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReviewService } from '../../../application/review.service';
import { SalesStore } from '../../../application/sales.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatAddress } from '../../../domain/entities';
import { DELIVERY_METHOD_LABEL } from '../../../domain/value-objects/shipping';
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from '../../../domain/value-objects/statuses';
import { Icon } from '../../../shared/components/icon';
import { OrderTimeline } from '../../../shared/components/order-timeline';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge, EmptyState } from '../../../shared/components/ui';
import { MznPipe, PhonePipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-order-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MznPipe, PhonePipe, Badge, OrderTimeline, ProductImage, Icon, EmptyState],
  styles: `.g{display:grid;grid-template-columns:1.2fr 1fr;gap:16px;align-items:start}
    .it{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.it:last-child{border:0}
    .it .im{width:56px;height:70px;border-radius:8px;overflow:hidden;flex-shrink:0}.it .grow{flex:1;font-size:14px}
    @media (max-width:900px){.g{grid-template-columns:1fr}}`,
  template: `
    @if (order(); as o) {
      @let pay = payment();
      @let dlv = delivery();
      <nav class="breadcrumb"><a routerLink="/conta/encomendas">Encomendas</a> / <span>{{ o.number }}</span></nav>
      <div class="page-head">
        <div><h1>{{ o.number }}</h1><p>Feita a {{ o.createdAt | date: "dd/MM/yyyy 'às' HH:mm" }}</p></div>
        <div class="row">
          <app-badge [label]="label[o.status]" [tone]="tone[o.status]" />
          @if (o.status === 'pendente' || o.status === 'confirmada') {
            <button type="button" class="btn ghost sm" (click)="cancel()" [disabled]="busy()">Cancelar encomenda</button>
          }
        </div>
      </div>

      @if (pay && pay.status !== 'confirmado' && o.status === 'pendente' && (pay.method === 'mpesa' || pay.method === 'emola')) {
        <div class="alert warning" style="margin-bottom:14px"><app-icon name="clock" [size]="16" />
          <span>O pagamento ainda não foi concluído. <a class="link" [routerLink]="['/checkout/concluido', o.id]">Concluir pagamento {{ payInfo[pay.method].label }}</a></span></div>
      }
      @if (pay && pay.status === 'pendente' && pay.method === 'transferencia') {
        <div class="alert" style="margin-bottom:14px"><app-icon name="bank" [size]="16" />
          <span>A aguardar transferência de <b>{{ pay.amount | mzn }}</b> para o NIB 0034 0000 1234 5678 9012 3 com a referência <b>{{ o.number }}</b>.</span></div>
      }

      <div class="g">
        <div class="stack">
          <div class="card pad"><h3 style="margin-bottom:14px">Acompanhamento</h3><app-order-timeline [order]="o" /></div>
          <div class="card pad">
            <h3>Artigos</h3>
            @for (i of o.items; track $index) {
              <div class="it">
                <a class="im" [routerLink]="['/produto', i.productId]"><app-product-image [images]="i.image ? [i.image] : []" [type]="i.illustration.type" [pattern]="i.illustration.pattern" [color]="i.color" /></a>
                <div class="grow">{{ i.name }}<div class="muted xs">{{ i.color }} · {{ i.size }} · {{ i.qty }} × {{ i.unitPrice | mzn }}</div>
                  @if (o.status === 'entregue' && canReview(i.productId)) {
                    <a class="link xs" [routerLink]="['/produto', i.productId]" fragment="avaliacoes">★ Avaliar produto</a>
                  }
                </div>
                <b class="small">{{ i.unitPrice * i.qty | mzn }}</b>
              </div>
            }
          </div>
        </div>
        <div class="stack">
          <div class="card pad">
            <h3 style="margin-bottom:8px">Resumo</h3>
            <div class="kv"><span>Subtotal</span><span>{{ o.subtotal | mzn }}</span></div>
            <div class="kv"><span>Entrega</span><span>{{ o.shippingFee ? (o.shippingFee | mzn) : 'Grátis' }}</span></div>
            @if (o.discount) { <div class="kv"><span>Cupão {{ o.couponCode }}</span><span class="ok">−{{ o.discount | mzn }}</span></div> }
            <div class="kv total"><span>Total</span><span>{{ o.total | mzn }}</span></div>
          </div>
          @if (pay) {
            <div class="card pad">
              <div class="row between"><h3>Pagamento</h3><app-badge [label]="payLabel[pay.status]" [tone]="payTone[pay.status]" /></div>
              <div class="kv"><span>Método</span><span>{{ payInfo[pay.method].label }}</span></div>
              @if (pay.phone) { <div class="kv"><span>Número</span><span>{{ pay.phone | phone }}</span></div> }
              <div class="kv"><span>Referência</span><span class="mono">{{ pay.reference }}</span></div>
              @if (pay.confirmedAt) { <div class="kv"><span>Confirmado</span><span>{{ pay.confirmedAt | date: 'dd/MM/yyyy HH:mm' }}</span></div> }
            </div>
          }
          <div class="card pad">
            <h3 style="margin-bottom:8px">{{ deliveryLabel[o.deliveryMethod] }}</h3>
            @if (o.address; as a) {
              <p class="small">{{ a.recipient }} · {{ a.phone | phone }}<br />{{ fmt(a) }}@if (a.reference) {<br /><span class="muted">Ref.: {{ a.reference }}</span>}</p>
            } @else {
              <p class="small">Loja Xitolo — Av. 24 de Julho, 1520, Maputo</p>
            }
            <div class="kv"><span>Previsão</span><span>{{ (dlv?.expectedBy ?? o.expectedBy) | date: 'dd/MM/yyyy' }}</span></div>
            @if (dlv?.courier) { <div class="kv"><span>Estafeta</span><span>{{ dlv!.courier }}</span></div> }
            @if (dlv?.completedAt) { <div class="kv"><span>Entregue</span><span>{{ dlv!.completedAt | date: 'dd/MM/yyyy HH:mm' }}</span></div> }
          </div>
        </div>
      </div>
    } @else {
      <app-empty icon="package" title="Encomenda não encontrada"><a class="btn" routerLink="/conta/encomendas">Voltar</a></app-empty>
    }
  `,
})
export class OrderDetailPage {
  readonly id = input.required<string>();
  private readonly sales = inject(SalesStore);
  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly reviews = inject(ReviewService);

  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly tone = ORDER_STATUS_TONE;
  protected readonly payLabel = PAYMENT_STATUS_LABEL;
  protected readonly payTone = PAYMENT_STATUS_TONE;
  protected readonly payInfo = PAYMENT_METHODS;
  protected readonly deliveryLabel = DELIVERY_METHOD_LABEL;
  protected readonly fmt = formatAddress;
  protected readonly busy = signal(false);

  protected readonly order = computed(() => {
    const o = this.sales.order(this.id());
    return o && o.customerId === this.session.customer()?.id ? o : undefined;
  });
  protected readonly payment = computed(() => (this.order() ? this.sales.paymentFor(this.order()!.id) : null));
  protected readonly delivery = computed(() => (this.order() ? this.sales.deliveryFor(this.order()!.id) : null));

  canReview(productId: string): boolean {
    const c = this.session.customer();
    return !!c && this.reviews.canReview(c.id, productId);
  }

  async cancel(): Promise<void> {
    const r = await this.confirm.ask({
      title: 'Cancelar encomenda?',
      message: 'O stock reservado é libertado e, se já pagaste, o valor é reembolsado para o mesmo método de pagamento.',
      confirmLabel: 'Cancelar encomenda',
      cancelLabel: 'Manter',
      danger: true,
      input: { label: 'Motivo (opcional)', placeholder: 'Ex: Enganei-me no tamanho' },
    });
    if (!r.confirmed) return;
    this.busy.set(true);
    try {
      await this.sales.cancelByCustomer(this.order()!.id, r.text);
      this.toast.success('Encomenda cancelada');
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
