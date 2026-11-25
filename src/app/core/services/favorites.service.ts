import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { CustomerStore } from '../../application/customer.store';
import { BrowserStorage } from './browser-storage';
import { SessionService } from './session.service';

const KEY = 'xitolo:favorites:guest';

/**
 * Favoritos: guardados no cliente quando tem sessão iniciada; para visitantes
 * ficam no navegador e são fundidos na conta ao iniciar sessão.
 */
@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly session = inject(SessionService);
  private readonly customers = inject(CustomerStore);
  private readonly guest = signal<string[]>(BrowserStorage.get<string[]>(KEY, []));

  readonly ids = computed(() => this.session.customer()?.favorites ?? this.guest());
  readonly count = computed(() => this.ids().length);

  constructor() {
    effect(() => BrowserStorage.set(KEY, this.guest()));
    effect(() => {
      const c = this.session.customer();
      const pending = this.guest();
      if (c && pending.length) {
        void this.customers.mergeFavorites(c.id, pending).then(() => this.guest.set([]));
      }
    });
  }

  has(productId: string): boolean {
    return this.ids().includes(productId);
  }

  /** Devolve true se ficou nos favoritos. */
  async toggle(productId: string): Promise<boolean> {
    const c = this.session.customer();
    if (c) return this.customers.toggleFavorite(c.id, productId);
    const has = this.guest().includes(productId);
    this.guest.update((g) => (has ? g.filter((x) => x !== productId) : [...g, productId]));
    return !has;
  }
}
