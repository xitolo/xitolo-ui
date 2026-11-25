import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Order } from '../../domain/entities';
import { orderFlow } from '../../domain/services/order-lifecycle';
import { ORDER_STATUS_LABEL, OrderStatus } from '../../domain/value-objects/statuses';
import { Icon } from './icon';

interface Step {
  status: OrderStatus;
  label: string;
  at: string | null;
  note: string | null;
  state: 'done' | 'current' | 'todo' | 'cancelled';
}

const HINT: Partial<Record<OrderStatus, string>> = {
  pendente: 'A aguardar confirmação do pagamento',
  confirmada: 'Recebemos a tua encomenda',
  em_preparacao: 'Estamos a separar e embalar as peças',
  pronta_envio: 'Embalada e pronta a sair',
  em_transito: 'A caminho da tua província',
  saiu_entrega: 'O estafeta está a caminho',
  entregue: 'Entregue — obrigado!',
};

/** Linha temporal visual do estado da encomenda. */
@Component({
  selector: 'app-order-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Icon],
  styles: `
    ol{list-style:none;position:relative}
    li{display:grid;grid-template-columns:28px 1fr;gap:12px;padding-bottom:18px;position:relative}
    li:not(:last-child)::before{content:'';position:absolute;left:13px;top:26px;bottom:0;width:2px;background:var(--line)}
    li.done:not(:last-child)::before{background:var(--accent)}
    .dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#fff;border:2px solid var(--line-2);color:var(--muted);z-index:1}
    .done .dot{background:var(--accent);border-color:var(--accent);color:#fff}
    .current .dot{border-color:var(--brand);color:var(--brand);box-shadow:0 0 0 5px var(--brand-soft)}
    .cancelled .dot{background:var(--sale);border-color:var(--sale);color:#fff}
    .l{font-weight:700;font-size:14px}.todo .l{color:var(--muted);font-weight:600}
    .m{font-size:12.5px;color:var(--muted);margin-top:1px}
    .bar{display:flex;gap:4px}.bar i{flex:1;height:6px;border-radius:9px;background:var(--line)}.bar i.on{background:var(--accent)}.bar i.x{background:var(--sale)}
    .bl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:5px}
  `,
  template: `
    @if (compact()) {
      <div class="bar">
        @for (s of steps(); track s.status) {
          <i [class.on]="s.state === 'done' || s.state === 'current'" [class.x]="s.state === 'cancelled'"></i>
        }
      </div>
      <div class="bl"><span>{{ steps()[0].label }}</span><span>{{ steps()[steps().length - 1].label }}</span></div>
    } @else {
      <ol>
        @for (s of steps(); track s.status) {
          <li [class]="s.state">
            <span class="dot">
              @switch (s.state) {
                @case ('done') { <app-icon name="check" [size]="15" [stroke]="2.6" /> }
                @case ('cancelled') { <app-icon name="x" [size]="15" [stroke]="2.6" /> }
                @case ('current') { <app-icon name="clock" [size]="15" /> }
                @default { <span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span> }
              }
            </span>
            <div>
              <div class="l">{{ s.label }}</div>
              <div class="m">
                @if (s.at) { {{ s.at | date: 'dd/MM/yyyy, HH:mm' }} }
                @if (s.at && s.note) { · }
                {{ s.note }}
              </div>
            </div>
          </li>
        }
      </ol>
    }
  `,
})
export class OrderTimeline {
  readonly order = input.required<Order>();
  readonly compact = input(false);

  protected readonly steps = computed<Step[]>(() => {
    const o = this.order();
    const flow = orderFlow(o.deliveryMethod);
    const reachedAt = new Map<OrderStatus, { at: string; message: string }>();
    for (const h of o.history) if (h.status) reachedAt.set(h.status, { at: h.at, message: h.message });

    if (o.status === 'cancelada') {
      const reached = flow.filter((s) => reachedAt.has(s));
      const cancel = reachedAt.get('cancelada');
      return [
        ...reached.map<Step>((s) => ({ status: s, label: ORDER_STATUS_LABEL[s], at: reachedAt.get(s)!.at, note: null, state: 'done' })),
        { status: 'cancelada', label: 'Cancelada', at: cancel?.at ?? o.updatedAt, note: cancel?.message ?? null, state: 'cancelled' },
      ];
    }

    const idx = flow.indexOf(o.status);
    return flow.map<Step>((s, i) => {
      const label = s === 'pronta_envio' && o.deliveryMethod === 'levantamento' ? 'Pronta para levantamento' : ORDER_STATUS_LABEL[s];
      const ev = reachedAt.get(s);
      const isLast = i === flow.length - 1;
      return {
        status: s,
        label,
        at: i <= idx ? (ev?.at ?? null) : null,
        note: i === idx ? (HINT[s] ?? null) : i < idx ? null : null,
        state: i < idx || (i === idx && isLast) ? 'done' : i === idx ? 'current' : 'todo',
      };
    });
  });
}
