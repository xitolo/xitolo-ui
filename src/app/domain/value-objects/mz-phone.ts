/**
 * Número de telemóvel moçambicano (9 dígitos, prefixos 82–87).
 * 82/83 Tmcel · 84/85 Vodacom · 86/87 Movitel
 */
export type MobileOperator = 'Tmcel' | 'Vodacom' | 'Movitel';

const OPERATOR_BY_PREFIX: Record<string, MobileOperator> = {
  '82': 'Tmcel',
  '83': 'Tmcel',
  '84': 'Vodacom',
  '85': 'Vodacom',
  '86': 'Movitel',
  '87': 'Movitel',
};

export class MzPhone {
  private constructor(readonly digits: string) {}

  static normalize(raw: string): string {
    let d = (raw ?? '').replace(/\D/g, '');
    if (d.startsWith('258') && d.length === 12) d = d.slice(3);
    return d.slice(0, 9);
  }

  static isValid(raw: string): boolean {
    return /^8[2-7]\d{7}$/.test(MzPhone.normalize(raw));
  }

  static parse(raw: string): MzPhone | null {
    const d = MzPhone.normalize(raw);
    return MzPhone.isValid(d) ? new MzPhone(d) : null;
  }

  get operator(): MobileOperator {
    return OPERATOR_BY_PREFIX[this.digits.slice(0, 2)];
  }

  get prefix(): string {
    return this.digits.slice(0, 2);
  }

  /** +258 84 123 4567 */
  format(): string {
    return `+258 ${this.digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1 $2 $3')}`;
  }
}

export function formatPhone(raw: string): string {
  return MzPhone.parse(raw)?.format() ?? raw;
}
