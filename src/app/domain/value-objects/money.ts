/**
 * Valores monetários em meticais (MZN).
 * Todos os montantes são guardados como números inteiros de meticais
 * (sem centavos) para evitar erros de arredondamento em vírgula flutuante.
 */
export type Mzn = number;

export const Money = {
  round(value: number): Mzn {
    return Math.round(value);
  },

  sum(values: readonly number[]): Mzn {
    return values.reduce((acc, v) => acc + v, 0);
  },

  percentOf(value: Mzn, percent: number): Mzn {
    return Math.round((value * percent) / 100);
  },

  /** Formata no padrão moçambicano: 1.250 MT */
  format(value: Mzn, withSuffix = true): string {
    const sign = value < 0 ? '−' : '';
    const digits = Math.abs(Math.round(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${digits}${withSuffix ? ' MT' : ''}`;
  },

  /** Formato compacto para gráficos: 12,5 mil MT, 1,2 M MT */
  compact(value: Mzn): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')} mil`;
    return String(Math.round(value));
  },
} as const;
