import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Money } from '../../domain/value-objects/money';

/* Gráficos SVG leves, sem dependências externas. */

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

export const CHART_COLORS = ['#d9480f', '#0b7a5c', '#2f5fb3', '#f2b632', '#8e44ad', '#e03131', '#6f6660', '#1b1715'];

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:block;position:relative}
    svg{width:100%;height:auto;overflow:visible}
    text{font-size:10px;fill:var(--muted);font-family:var(--font)}
    .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:6px}
    .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
    .tip{position:absolute;pointer-events:none;background:var(--ink);color:#fff;font-size:12px;padding:7px 10px;border-radius:8px;white-space:nowrap;transform:translate(-50%,-110%);z-index:2}
    .tip div{display:flex;gap:6px;align-items:center}.tip i{width:8px;height:8px;border-radius:2px;display:inline-block}`,
  template: `
    <div class="legend">
      @for (s of series(); track s.name) {
        <span><i [style.background]="s.color"></i>{{ s.name }}</span>
      }
    </div>
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" (mouseleave)="hover.set(-1)" role="img" [attr.aria-label]="ariaLabel()">
      @for (t of ticks(); track $index) {
        <line [attr.x1]="P" [attr.x2]="W - 8" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#ece6df" />
        <text [attr.x]="P - 6" [attr.y]="t.y + 3" text-anchor="end">{{ t.label }}</text>
      }
      @for (l of xLabels(); track $index) {
        <text [attr.x]="l.x" [attr.y]="H - 4" text-anchor="middle">{{ l.label }}</text>
      }
      @for (s of paths(); track s.name) {
        <path [attr.d]="s.area" [attr.fill]="s.color" opacity=".08" />
        <path [attr.d]="s.line" fill="none" [attr.stroke]="s.color" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
      }
      @if (hover() >= 0) {
        <line [attr.x1]="x(hover())" [attr.x2]="x(hover())" [attr.y1]="12" [attr.y2]="H - 20" stroke="#cfc6be" stroke-dasharray="3 3" />
        @for (s of series(); track s.name) {
          <circle [attr.cx]="x(hover())" [attr.cy]="y(s.values[hover()])" r="3.5" [attr.fill]="s.color" stroke="#fff" stroke-width="1.5" />
        }
      }
      @for (l of labels(); track $index) {
        <rect [attr.x]="x($index) - step() / 2" y="0" [attr.width]="step()" [attr.height]="H - 20" fill="transparent" (mouseenter)="hover.set($index)" />
      }
    </svg>
    @if (hover() >= 0) {
      <div class="tip" [style.left.%]="(x(hover()) / W) * 100" [style.top.%]="12">
        <b>{{ labels()[hover()] }}</b>
        @for (s of series(); track s.name) {
          <div><i [style.background]="s.color"></i>{{ s.name }}: {{ fmt(s.values[hover()]) }}</div>
        }
      </div>
    }
  `,
})
export class LineChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly money = input(true);
  readonly ariaLabel = input('Gráfico de linhas');
  protected readonly hover = signal(-1);
  protected readonly W = 640;
  protected readonly H = 220;
  protected readonly P = 46;

  private readonly max = computed(() => niceMax(Math.max(0, ...this.series().flatMap((s) => s.values))));
  protected readonly step = computed(() => (this.W - this.P - 8) / Math.max(1, this.labels().length - 1));
  protected x = (i: number) => this.P + i * this.step();
  protected y = (v: number) => 12 + (1 - v / this.max()) * (this.H - 34);
  protected fmt = (v: number) => (this.money() ? Money.format(v) : String(v));

  protected readonly ticks = computed(() =>
    [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: this.y(this.max() * f), label: this.money() ? Money.compact(this.max() * f) : String(Math.round(this.max() * f)) })),
  );
  protected readonly xLabels = computed(() => {
    const n = this.labels().length;
    const every = Math.max(1, Math.ceil(n / 8));
    return this.labels()
      .map((label, i) => ({ label, x: this.x(i), i }))
      .filter((l) => l.i % every === 0 || (l.i === n - 1 && (n - 1) % every >= every / 2));
  });
  protected readonly paths = computed(() =>
    this.series().map((s) => {
      const pts = s.values.map((v, i) => `${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`);
      const line = pts.length ? `M${pts.join('L')}` : '';
      const area = pts.length ? `${line}L${this.x(s.values.length - 1)},${this.H - 22}L${this.x(0)},${this.H - 22}Z` : '';
      return { name: s.name, color: s.color, line, area };
    }),
  );
}

export interface BarDatum {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}

/** Barras horizontais (rankings). */
@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:flex;flex-direction:column;gap:10px}
    .r{display:grid;grid-template-columns:minmax(90px,1.2fr) 2fr auto;gap:10px;align-items:center;font-size:13px}
    .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.l small{display:block;color:var(--muted);font-size:11px}
    .b{height:10px;background:var(--hover);border-radius:99px;overflow:hidden}.b i{display:block;height:100%;border-radius:99px;transition:width .4s}
    .v{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right;min-width:64px}
    .e{color:var(--muted);font-size:13px;text-align:center;padding:20px}`,
  template: `
    @for (d of data(); track d.label; let i = $index) {
      <div class="r">
        <span class="l" [title]="d.label">{{ d.label }}@if (d.sub) {<small>{{ d.sub }}</small>}</span>
        <span class="b"><i [style.width.%]="(d.value / max()) * 100" [style.background]="d.color ?? colors[i % colors.length]"></i></span>
        <span class="v">{{ money() ? fmt(d.value) : d.value }}</span>
      </div>
    } @empty {
      <div class="e">Sem dados no período.</div>
    }
  `,
})
export class BarList {
  readonly data = input.required<BarDatum[]>();
  readonly money = input(false);
  protected readonly colors = CHART_COLORS;
  protected readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));
  protected fmt = (v: number) => Money.format(v);
}

/** Barras verticais (séries curtas). */
@Component({
  selector: 'app-column-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:block} svg{width:100%;height:auto} text{font-size:10px;fill:var(--muted);font-family:var(--font)}
    rect.bar{transition:opacity .15s} rect.bar:hover{opacity:.75}`,
  template: `
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Gráfico de colunas">
      @for (d of data(); track d.label; let i = $index) {
        <rect class="bar" [attr.x]="x(i) + 4" [attr.y]="y(d.value)" [attr.width]="bw() - 8" [attr.height]="H - 34 - y(d.value) + 12"
          rx="4" [attr.fill]="d.color ?? '#d9480f'"><title>{{ d.label }}: {{ money() ? fmt(d.value) : d.value }}</title></rect>
        <text [attr.x]="x(i) + bw() / 2" [attr.y]="y(d.value) - 4" text-anchor="middle" style="fill:var(--ink);font-weight:700">{{ money() ? short(d.value) : d.value }}</text>
        <text [attr.x]="x(i) + bw() / 2" [attr.y]="H - 6" text-anchor="middle">{{ d.label }}</text>
      }
    </svg>
  `,
})
export class ColumnChart {
  readonly data = input.required<BarDatum[]>();
  readonly money = input(false);
  protected readonly W = 520;
  protected readonly H = 200;
  private readonly max = computed(() => niceMax(Math.max(1, ...this.data().map((d) => d.value))));
  protected readonly bw = computed(() => (this.W - 10) / Math.max(1, this.data().length));
  protected x = (i: number) => 5 + i * this.bw();
  protected y = (v: number) => 12 + (1 - v / this.max()) * (this.H - 34);
  protected fmt = (v: number) => Money.format(v);
  protected short = (v: number) => Money.compact(v);
}

@Component({
  selector: 'app-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
    svg{width:140px;height:140px;flex-shrink:0}
    .lg{display:flex;flex-direction:column;gap:7px;font-size:13px;flex:1;min-width:140px}
    .lg div{display:flex;align-items:center;gap:8px}.lg i{width:10px;height:10px;border-radius:3px;flex-shrink:0}
    .lg span{flex:1}.lg b{font-variant-numeric:tabular-nums}
    .c1{font-size:18px;font-weight:800;fill:var(--ink)}.c2{font-size:9px;fill:var(--muted)}`,
  template: `
    <svg viewBox="0 0 120 120" role="img" aria-label="Gráfico circular">
      @for (s of arcs(); track s.label) {
        <circle cx="60" cy="60" r="46" fill="none" [attr.stroke]="s.color" stroke-width="18"
          [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset" transform="rotate(-90 60 60)"><title>{{ s.label }}: {{ s.value }}</title></circle>
      }
      @if (!total()) {
        <circle cx="60" cy="60" r="46" fill="none" stroke="#ece6df" stroke-width="18" />
      }
      <text x="60" y="60" text-anchor="middle" class="c1">{{ centerValue() ?? total() }}</text>
      <text x="60" y="74" text-anchor="middle" class="c2">{{ centerLabel() }}</text>
    </svg>
    <div class="lg">
      @for (s of arcs(); track s.label) {
        <div><i [style.background]="s.color"></i><span>{{ s.label }}</span><b>{{ fmt(s.value) }}</b><small class="muted">{{ s.pct }}%</small></div>
      }
    </div>
  `,
})
export class Donut {
  readonly data = input.required<BarDatum[]>();
  readonly centerLabel = input('total');
  readonly centerValue = input<string | null>(null);
  /** Formata os valores da legenda como montantes. */
  readonly money = input(false);
  protected fmt = (v: number) => (this.money() ? Money.compact(v) : String(v));
  protected readonly total = computed(() => this.data().reduce((s, d) => s + d.value, 0));
  protected readonly arcs = computed(() => {
    const C = 2 * Math.PI * 46;
    let acc = 0;
    return this.data()
      .filter((d) => d.value > 0)
      .map((d, i) => {
        const len = (d.value / this.total()) * C;
        const arc = { label: d.label, value: d.value, color: d.color ?? CHART_COLORS[i % CHART_COLORS.length], dash: `${len} ${C - len}`, offset: -acc, pct: Math.round((d.value / this.total()) * 100) };
        acc += len;
        return arc;
      });
  });
}
