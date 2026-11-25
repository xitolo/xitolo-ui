import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MockDatabase } from '../infrastructure/persistence/mock-database';
import { CatalogStore } from './catalog.store';
import { CustomerStore } from './customer.store';
import { InventoryStore } from './inventory.store';
import { SalesStore } from './sales.store';

/**
 * Carrega todas as stores no arranque e mantém-nas sincronizadas quando os
 * dados mudam noutro separador (loja e painel abertos em simultâneo).
 */
@Injectable({ providedIn: 'root' })
export class AppDataService {
  private readonly catalog = inject(CatalogStore);
  private readonly inventory = inject(InventoryStore);
  private readonly customers = inject(CustomerStore);
  private readonly sales = inject(SalesStore);
  private readonly db = inject(MockDatabase);

  readonly ready = signal(false);
  readonly syncing = signal(false);

  constructor() {
    this.db.externalChanges$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => void this.reload());
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.catalog.load(), this.inventory.load(), this.customers.load(), this.sales.load()]);
    this.ready.set(true);
  }

  async reload(): Promise<void> {
    this.syncing.set(true);
    try {
      await this.loadAll();
    } finally {
      this.syncing.set(false);
    }
  }

  /** Repõe os dados de demonstração. */
  async resetDemo(): Promise<void> {
    this.db.reset();
    await this.reload();
  }
}
