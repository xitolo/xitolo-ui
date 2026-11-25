import { Injectable, signal } from '@angular/core';

/** Abre o painel de "adicionar rápido" (escolha de tamanho/cor) a partir de qualquer cartão. */
@Injectable({ providedIn: 'root' })
export class QuickAddService {
  readonly productId = signal<string | null>(null);
  open(id: string): void {
    this.productId.set(id);
  }
  close(): void {
    this.productId.set(null);
  }
}
