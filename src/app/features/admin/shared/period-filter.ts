import { ChangeDetectionStrategy, Component, computed, model, signal } from '@angular/core';
import { DateRange, PERIOD_LABELS, PeriodPreset, rangeFromPreset, toIsoDate } from '../../../domain/value-objects/date-range';

/** Selector de período (predefinições + intervalo personalizado). */
@Component({
  selector: 'app-period-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `:host{display:flex;gap:6px;align-items:center;flex-wrap:wrap} .input{width:auto} .select{width:auto}`,
  template: `
    <select class="select sm" [value]="preset()" (change)="setPreset($any($event.target).value)" aria-label="Período">
      @for (p of presets; track p) { <option [value]="p" [selected]="p === preset()">{{ labels[p] }}</option> }
    </select>
    @if (preset() === 'custom') {
      <input class="input sm" type="date" [value]="fromStr()" (change)="setCustom('from', $any($event.target).value)" aria-label="De" />
      <span class="muted small">a</span>
      <input class="input sm" type="date" [value]="toStr()" (change)="setCustom('to', $any($event.target).value)" aria-label="Até" />
    }
  `,
})
export class PeriodFilter {
  readonly range = model<DateRange>(rangeFromPreset('30d'));
  protected readonly preset = signal<PeriodPreset>('30d');
  protected readonly presets: PeriodPreset[] = ['7d', '30d', '90d', 'month', 'year', 'all', 'custom'];
  protected readonly labels = PERIOD_LABELS;
  protected readonly fromStr = computed(() => toIsoDate(this.range().from));
  protected readonly toStr = computed(() => toIsoDate(this.range().to));

  ngOnInit(): void {
    // Alinha o selector com o intervalo inicial recebido.
    const from = this.range().from.getTime();
    const match = this.presets.find((p) => p !== 'custom' && rangeFromPreset(p).from.getTime() === from);
    this.preset.set(match ?? 'custom');
  }

  setPreset(p: PeriodPreset): void {
    this.preset.set(p);
    if (p !== 'custom') this.range.set(rangeFromPreset(p));
  }

  setCustom(which: 'from' | 'to', value: string): void {
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const r = this.range();
    this.range.set(rangeFromPreset('custom', new Date(), which === 'from' ? { from: date, to: r.to } : { from: r.from, to: date }));
  }
}

/** Exporta linhas para CSV (abre no Excel com acentos correctos). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
