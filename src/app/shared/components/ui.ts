import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { Tone } from '../../domain/value-objects/statuses';
import { MznPipe } from '../pipes/format.pipes';
import { Icon } from './icon';

/* Componentes de interface pequenos e reutilizáveis. */

@Component({
  selector: 'app-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;color:var(--muted)}
    .s{display:inline-flex;gap:1px;color:#e2dad1}.s .on{color:var(--gold)}
    button{display:inline-flex;padding:2px}`,
  template: `
    <span class="s" [attr.aria-label]="value() + ' de 5 estrelas'">
      @for (i of [1, 2, 3, 4, 5]; track i) {
        @if (editable()) {
          <button type="button" (click)="value.set(i)" [attr.aria-label]="i + ' estrelas'">
            <app-icon name="star" [size]="size()" [fill]="true" [class.on]="i <= value()" />
          </button>
        } @else {
          <app-icon name="star" [size]="size()" [fill]="true" [class.on]="i <= rounded()" />
        }
      }
    </span>
    @if (count() !== null) {
      <span>{{ value() ? value().toFixed(1).replace('.', ',') : '—' }} ({{ count() }})</span>
    }
  `,
  imports: [Icon],
})
export class Stars {
  readonly value = model(0);
  readonly count = input<number | null>(null);
  readonly size = input(14);
  readonly editable = input(false);
  protected readonly rounded = computed(() => Math.round(this.value()));
}

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="tone()" [class.plain]="plain()"><ng-content />{{ label() }}</span>`,
})
export class Badge {
  readonly label = input('');
  readonly tone = input<Tone>('neutral');
  readonly plain = input(false);
}

@Component({
  selector: 'app-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MznPipe],
  styles: `:host{display:inline-flex;align-items:baseline;gap:7px;flex-wrap:wrap}
    .now{font-weight:800;font-size:var(--price-size,17px)} .now.sale{color:var(--sale)}
    .was{font-size:12.5px;color:var(--muted);text-decoration:line-through}
    .off{font-size:11.5px;font-weight:800;color:var(--sale);background:var(--sale-soft);padding:2px 6px;border-radius:5px}`,
  template: `
    <span class="now" [class.sale]="was() > price()">{{ price() | mzn }}</span>
    @if (was() > price()) {
      <span class="was">{{ was() | mzn }}</span>
      @if (showOff()) {
        <span class="off">−{{ off() }}%</span>
      }
    }
  `,
})
export class Price {
  readonly price = input.required<number>();
  readonly was = input(0);
  readonly showOff = input(false);
  protected readonly off = computed(() => Math.round((1 - this.price() / this.was()) * 100));
}

@Component({
  selector: 'app-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `:host{display:block;text-align:center;padding:48px 20px;color:var(--muted)}
    .i{width:64px;height:64px;border-radius:50%;background:var(--hover);display:grid;place-items:center;margin:0 auto 12px;color:var(--ink-2)}
    h3{color:var(--ink);font-size:16px;margin-bottom:4px} p{font-size:14px;max-width:380px;margin:0 auto}
    .a{margin-top:16px;display:flex;justify-content:center;gap:8px}`,
  template: `
    <div class="i"><app-icon [name]="icon()" [size]="28" /></div>
    <h3>{{ title() }}</h3>
    @if (text()) {
      <p>{{ text() }}</p>
    }
    <div class="a"><ng-content /></div>
  `,
})
export class EmptyState {
  readonly icon = input('package');
  readonly title = input.required<string>();
  readonly text = input('');
}

@Component({
  selector: 'app-qty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `:host{display:inline-flex;align-items:center;border:1.5px solid var(--line-2);border-radius:999px;background:#fff}
    button{width:34px;height:34px;display:grid;place-items:center;border-radius:50%} button:disabled{opacity:.35}
    span{min-width:26px;text-align:center;font-weight:700;font-variant-numeric:tabular-nums}
    :host(.sm) button{width:28px;height:28px}`,
  template: `
    <button type="button" (click)="set(value() - 1)" [disabled]="value() <= min()" aria-label="Diminuir"><app-icon name="minus" [size]="16" /></button>
    <span>{{ value() }}</span>
    <button type="button" (click)="set(value() + 1)" [disabled]="value() >= max()" aria-label="Aumentar"><app-icon name="plus" [size]="16" /></button>
  `,
})
export class QtyStepper {
  readonly value = model(1);
  readonly min = input(1);
  readonly max = input(10);
  readonly changed = output<number>();
  set(v: number): void {
    const n = Math.max(this.min(), Math.min(this.max(), v));
    this.value.set(n);
    this.changed.emit(n);
  }
}

@Component({
  selector: 'app-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `:host{display:block;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:14px 16px}
    .t{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--muted);font-size:12.5px;font-weight:600}
    .i{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--hover);color:var(--ink-2)}
    .i.brand{background:var(--brand-soft);color:var(--brand)} .i.success{background:var(--accent-soft);color:var(--accent)}
    .i.warning{background:var(--warning-soft);color:var(--warning)} .i.danger{background:var(--sale-soft);color:var(--sale)}
    .i.info{background:var(--info-soft);color:var(--info)}
    .v{font-size:22px;font-weight:800;margin-top:6px;letter-spacing:-.3px;font-variant-numeric:tabular-nums}
    .s{font-size:12px;color:var(--muted);margin-top:2px}`,
  template: `
    <div class="t"><span>{{ label() }}</span><span class="i" [class]="tone()"><app-icon [name]="icon()" [size]="16" /></span></div>
    <div class="v">{{ value() }}</div>
    @if (sub()) {
      <div class="s">{{ sub() }}</div>
    }
  `,
})
export class KpiCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input('');
  readonly icon = input('chart');
  readonly tone = input<Tone>('neutral');
}

@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `:host{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;font-size:13px;color:var(--muted);flex-wrap:wrap}
    .p{display:flex;gap:4px;align-items:center} button{min-width:32px;height:32px;border-radius:8px;font-weight:600;display:grid;place-items:center;padding:0 6px}
    button:hover:not(:disabled){background:var(--hover)} button.on{background:var(--ink);color:#fff} button:disabled{opacity:.35}
    select{border:1.5px solid var(--line-2);border-radius:8px;padding:4px 6px;background:#fff}`,
  template: `
    <span>{{ from() }}–{{ to() }} de {{ total() }}</span>
    <div class="p">
      <button type="button" (click)="page.set(page() - 1)" [disabled]="page() <= 1" aria-label="Anterior"><app-icon name="chevron-left" [size]="16" /></button>
      @for (p of pages(); track $index) {
        @if (p === 0) {
          <span>…</span>
        } @else {
          <button type="button" [class.on]="p === page()" (click)="page.set(p)">{{ p }}</button>
        }
      }
      <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= last()" aria-label="Seguinte"><app-icon name="chevron-right" [size]="16" /></button>
    </div>
    <label class="row" style="--gap:6px">Por página
      <select [value]="size()" (change)="setSize($any($event.target).value)">
        @for (s of [10, 20, 50]; track s) {
          <option [value]="s" [selected]="s === size()">{{ s }}</option>
        }
      </select>
    </label>
  `,
})
export class Pagination {
  readonly total = input.required<number>();
  readonly page = model(1);
  readonly size = model(10);
  protected readonly last = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  protected readonly from = computed(() => (this.total() ? (this.page() - 1) * this.size() + 1 : 0));
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.size()));
  protected readonly pages = computed(() => {
    const last = this.last();
    const cur = Math.min(this.page(), last);
    const out: number[] = [];
    for (let p = 1; p <= last; p++) {
      if (p === 1 || p === last || Math.abs(p - cur) <= 1) out.push(p);
      else if (out[out.length - 1] !== 0) out.push(0);
    }
    return out;
  });
  setSize(v: string): void {
    this.size.set(+v);
    this.page.set(1);
  }
}

/** Fatia de uma lista para a página corrente. */
export function paginate<T>(list: readonly T[], page: number, size: number): T[] {
  const last = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page), last);
  return list.slice((p - 1) * size, p * size);
}
