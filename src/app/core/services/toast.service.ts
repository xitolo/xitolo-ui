import { Injectable, signal } from '@angular/core';
import { errorMessage } from '../../domain/services/domain-error';

export interface Toast {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'info', ms = 3200): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  error(err: unknown): void {
    this.show(errorMessage(err), 'error', 5000);
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
