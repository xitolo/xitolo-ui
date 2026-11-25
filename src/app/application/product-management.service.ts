import { Injectable, inject } from '@angular/core';
import { ProductFormDto } from '../domain/dtos';
import { Product, logEntry } from '../domain/entities';
import { DomainError } from '../domain/services/domain-error';
import { InventoryPolicy } from '../domain/services/inventory-policy';
import { Money } from '../domain/value-objects/money';
import { ProductMapper } from '../infrastructure/mappers/mappers';
import { CatalogStore } from './catalog.store';
import { InventoryStore } from './inventory.store';

/** Casos de uso de gestão de produtos (criação com stock inicial, edição com histórico). */
@Injectable({ providedIn: 'root' })
export class ProductManagementService {
  private readonly catalog = inject(CatalogStore);
  private readonly inventory = inject(InventoryStore);

  private validate(dto: ProductFormDto, id?: string): void {
    if (this.catalog.products().some((p) => p.sku.toUpperCase() === dto.sku.trim().toUpperCase() && p.id !== id)) {
      throw new DomainError('Já existe um produto com este SKU.');
    }
    if (!this.catalog.category(dto.categoryId)) throw new DomainError('Seleccione uma categoria válida.');
    if (dto.price <= 0) throw new DomainError('O preço de venda deve ser superior a zero.');
    if (dto.promoPrice !== null && dto.promoPrice >= dto.price) {
      throw new DomainError('O preço promocional deve ser inferior ao preço de venda.');
    }
    if (!dto.sizes.length || !dto.colors.length) throw new DomainError('Defina pelo menos um tamanho e uma cor.');
  }

  async create(dto: ProductFormDto): Promise<Product> {
    this.validate(dto);
    const now = new Date().toISOString();
    const draft = ProductMapper.fromForm(dto, now);
    draft.history = [logEntry('admin', 'Produto criado', now)];
    const product = await this.catalog.insertProduct(draft);
    if (dto.initialStock > 0) {
      await this.inventory.apply([
        InventoryPolicy.entry(product, dto.initialStock, { reason: 'Stock inicial', by: 'admin' }),
      ]);
    }
    return this.catalog.product(product.id)!;
  }

  async update(id: string, dto: ProductFormDto): Promise<Product> {
    const existing = this.catalog.product(id);
    if (!existing) throw new DomainError('Produto não encontrado.');
    this.validate(dto, id);
    const now = new Date().toISOString();
    const next = ProductMapper.merge(existing, dto, now);
    const changes = this.describeChanges(existing, next);
    next.history = changes.length ? [...existing.history, logEntry('admin', changes.join(' · '), now)] : existing.history;
    return this.catalog.saveProduct(next);
  }

  private describeChanges(a: Product, b: Product): string[] {
    const out: string[] = [];
    if (a.name !== b.name) out.push(`Nome: "${a.name}" → "${b.name}"`);
    if (a.price !== b.price) out.push(`Preço: ${Money.format(a.price)} → ${Money.format(b.price)}`);
    if (a.promoPrice !== b.promoPrice) {
      out.push(`Preço promocional: ${a.promoPrice ? Money.format(a.promoPrice) : '—'} → ${b.promoPrice ? Money.format(b.promoPrice) : '—'}`);
    }
    if (a.costPrice !== b.costPrice) out.push(`Custo: ${Money.format(a.costPrice)} → ${Money.format(b.costPrice)}`);
    if (a.categoryId !== b.categoryId) {
      out.push(`Categoria: ${this.catalog.category(a.categoryId)?.name} → ${this.catalog.category(b.categoryId)?.name}`);
    }
    if (a.minStock !== b.minStock) out.push(`Stock mínimo: ${a.minStock} → ${b.minStock}`);
    if (a.status !== b.status) out.push(b.status === 'activo' ? 'Produto activado' : 'Produto desactivado');
    if (a.images.length !== b.images.length) out.push(`Imagens: ${a.images.length} → ${b.images.length}`);
    if (a.variants.sizes.join() !== b.variants.sizes.join() || a.variants.colors.join() !== b.variants.colors.join()) {
      out.push('Variantes actualizadas');
    }
    if (a.description !== b.description || a.features.join() !== b.features.join()) out.push('Descrição actualizada');
    return out;
  }
}
