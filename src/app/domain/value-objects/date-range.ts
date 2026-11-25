/** Intervalo de datas fechado [from, to] usado nos filtros por período. */
export interface DateRange {
  from: Date;
  to: Date;
}

export type PeriodPreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'all' | 'custom';

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  month: 'Este mês',
  year: 'Este ano',
  all: 'Todo o período',
  custom: 'Personalizado',
};

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function rangeFromPreset(preset: PeriodPreset, now = new Date(), custom?: Partial<DateRange>): DateRange {
  const to = endOfDay(now);
  switch (preset) {
    case '7d':
      return { from: startOfDay(addDays(now, -6)), to };
    case '30d':
      return { from: startOfDay(addDays(now, -29)), to };
    case '90d':
      return { from: startOfDay(addDays(now, -89)), to };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to };
    case 'all':
      return { from: new Date(2000, 0, 1), to: endOfDay(addDays(now, 3650)) };
    case 'custom':
      return {
        from: startOfDay(custom?.from ?? addDays(now, -29)),
        to: endOfDay(custom?.to ?? now),
      };
  }
}

export function inRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** yyyy-mm-dd na hora local (para inputs type=date e chaves de agregação). */
export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
