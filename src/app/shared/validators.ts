import { AbstractControl, ValidationErrors } from '@angular/forms';
import { MzPhone } from '../domain/value-objects/mz-phone';

/** Telemóvel moçambicano válido (82–87 + 7 dígitos). */
export function mzPhoneValidator(control: AbstractControl<string>): ValidationErrors | null {
  const v = control.value;
  if (!v) return null;
  return MzPhone.isValid(v) ? null : { mzPhone: true };
}
