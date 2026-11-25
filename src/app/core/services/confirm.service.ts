import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Pede um texto (ex.: motivo de cancelamento). */
  input?: { label: string; placeholder?: string; required?: boolean };
}

export interface ConfirmResult {
  confirmed: boolean;
  text: string;
}

interface Pending extends ConfirmRequest {
  resolve: (r: ConfirmResult) => void;
}

/** Diálogo de confirmação baseado em Promise (um de cada vez). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<Pending | null>(null);

  ask(req: ConfirmRequest): Promise<ConfirmResult> {
    this.current()?.resolve({ confirmed: false, text: '' });
    return new Promise((resolve) => this.current.set({ ...req, resolve }));
  }

  async confirm(req: ConfirmRequest): Promise<boolean> {
    return (await this.ask(req)).confirmed;
  }

  close(result: ConfirmResult): void {
    const c = this.current();
    this.current.set(null);
    c?.resolve(result);
  }
}
