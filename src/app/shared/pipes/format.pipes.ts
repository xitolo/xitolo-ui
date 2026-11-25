import { Pipe, PipeTransform } from '@angular/core';
import { Money } from '../../domain/value-objects/money';
import { formatPhone } from '../../domain/value-objects/mz-phone';

/** 1250 → "1.250 MT" */
@Pipe({ name: 'mzn' })
export class MznPipe implements PipeTransform {
  transform(value: number | null | undefined, suffix = true): string {
    return value == null ? '—' : Money.format(value, suffix);
  }
}

/** 841234567 → "+258 84 123 4567" */
@Pipe({ name: 'phone' })
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? formatPhone(value) : '—';
  }
}

const RTF = new Intl.RelativeTimeFormat('pt', { numeric: 'auto' });

/** Data relativa: "há 3 horas", "ontem". */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const abs = Math.abs(diff);
    if (abs < 60) return 'agora mesmo';
    if (abs < 3600) return RTF.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return RTF.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return RTF.format(Math.round(diff / 86400), 'day');
    return RTF.format(Math.round(diff / (86400 * 30)), 'month');
  }
}

@Pipe({ name: 'compact' })
export class CompactPipe implements PipeTransform {
  transform(value: number): string {
    return Money.compact(value);
  }
}
