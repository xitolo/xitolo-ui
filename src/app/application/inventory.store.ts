import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Actor, Order, Product, StockMovement, availableStock, newId, stockLevel } from '../domain/entities';
import { ProductRepository, StockMovementRepository } from '../domain/repositories/repositories';
import { DomainError } from '../domain/services/domain-error';
import { InventoryPolicy, StockChange, qtyByProduct } from '../domain/services/inventory-policy';
import { CatalogStore } from './catalog.store';

/** Operações de inventário e histórico de movimentações. */
@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly catalog = inject(CatalogStore);
  private readonly productRepo = inject(ProductRepository);
  private readonly movementRepo = inject(StockMovementRepository);

  readonly movements = signal<StockMovement[]>([]);

  readonly summary = computed(() => {
    const products = this.catalog.products();
    return {
      units: products.reduce((s, p) => s + p.stock, 0),
      reserved: products.reduce((s, p) => s + p.reserved, 0),
      available: products.reduce((s, p) => s + availableStock(p), 0),
      costValue: products.reduce((s, p) => s + p.stock * p.costPrice, 0),
      retailValue: products.reduce((s, p) => s + p.stock * p.price, 0),
      low: products.filter((p) => p.status === 'activo' && stockLevel(p) === 'baixo'),
      out: products.filter((p) => p.status === 'activo' && stockLevel(p) === 'esgotado'),
    };
  });

  async load(): Promise<void> {
    const list = await firstValueFrom(this.movementRepo.findAll());
    this.movements.set(list.sort((a, b) => b.at.localeCompare(a.at)));
  }

  forProduct(productId: string): StockMovement[] {
    return this.movements().filter((m) => m.productId === productId);
  }

  /** Persiste produtos e movimentos resultantes de uma ou mais alterações de stock. */
  async apply(changes: StockChange[]): Promise<void> {
    if (!changes.length) return;
    const products = changes.map((c) => c.product);
    const movements: StockMovement[] = changes.map((c) => ({ ...c.movement, id: newId('mov') }));
    await firstValueFrom(this.productRepo.saveMany(products));
    await firstValueFrom(this.movementRepo.saveMany(movements));
    this.catalog.upsertProducts(products);
    this.movements.update((all) => [...movements.reverse(), ...all]);
  }

  private product(id: string): Product {
    const p = this.catalog.product(id);
    if (!p) throw new DomainError('Produto não encontrado.');
    return p;
  }

  // ---------- Operações manuais (painel) ----------
  async registerEntry(productId: string, qty: number, reason: string): Promise<void> {
    await this.apply([InventoryPolicy.entry(this.product(productId), qty, { reason: reason || 'Entrada de mercadoria', by: 'admin' })]);
  }

  async registerExit(productId: string, qty: number, reason: string): Promise<void> {
    await this.apply([InventoryPolicy.exit(this.product(productId), qty, { reason: reason || 'Saída manual', by: 'admin' })]);
  }

  async adjust(productId: string, newStock: number, reason: string): Promise<void> {
    await this.apply([InventoryPolicy.adjust(this.product(productId), newStock, { reason: reason || 'Contagem de inventário', by: 'admin' })]);
  }

  // ---------- Efeitos das encomendas ----------
  /** Verifica (sem alterar) se há stock disponível para as linhas. */
  checkAvailability(items: readonly { productId: string; qty: number }[]): void {
    for (const [pid, q] of qtyByProduct(items)) {
      const p = this.product(pid);
      if (availableStock(p) < q) {
        throw new DomainError(`Stock insuficiente para "${p.name}". Disponível: ${availableStock(p)}.`);
      }
    }
  }

  changesForOrder(order: Order, effect: 'reserve' | 'release' | 'consume', by: Actor): StockChange[] {
    const reasons = { reserve: 'Reserva para encomenda', release: 'Encomenda cancelada', consume: 'Encomenda entregue' };
    const changes: StockChange[] = [];
    for (const [pid, q] of qtyByProduct(order.items)) {
      const p = this.catalog.product(pid);
      if (!p) continue; // produto removido: a encomenda mantém o snapshot
      const ctx = { reason: reasons[effect], orderNumber: order.number, by };
      changes.push(
        effect === 'reserve'
          ? InventoryPolicy.reserve(p, q, ctx)
          : effect === 'release'
            ? InventoryPolicy.release(p, q, ctx)
            : InventoryPolicy.consume(p, q, ctx),
      );
    }
    return changes;
  }
}
