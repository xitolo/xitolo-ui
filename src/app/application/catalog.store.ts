import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CategoryFormDto, PromotionFormDto } from '../domain/dtos';
import { Category, Product, Promotion, Review, isPromotionLive, logEntry } from '../domain/entities';
import {
  CategoryRepository,
  ProductRepository,
  PromotionRepository,
  ReviewRepository,
} from '../domain/repositories/repositories';
import { DomainError } from '../domain/services/domain-error';
import { CategoryMapper, PromotionMapper } from '../infrastructure/mappers/mappers';

/**
 * Estado do catálogo (produtos, categorias, promoções e avaliações).
 * Fonte única de verdade partilhada pela loja e pelo painel administrativo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly productRepo = inject(ProductRepository);
  private readonly categoryRepo = inject(CategoryRepository);
  private readonly promotionRepo = inject(PromotionRepository);
  private readonly reviewRepo = inject(ReviewRepository);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly promotions = signal<Promotion[]>([]);
  readonly reviews = signal<Review[]>([]);

  readonly activeCategories = computed(() =>
    this.categories()
      .filter((c) => c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
  readonly livePromotions = computed(() => this.promotions().filter((p) => isPromotionLive(p)));

  async load(): Promise<void> {
    const [products, categories, promotions, reviews] = await Promise.all([
      firstValueFrom(this.productRepo.findAll()),
      firstValueFrom(this.categoryRepo.findAll()),
      firstValueFrom(this.promotionRepo.findAll()),
      firstValueFrom(this.reviewRepo.findAll()),
    ]);
    this.products.set(products);
    this.categories.set(categories);
    this.promotions.set(promotions);
    this.reviews.set(reviews);
  }

  product(id: string): Product | undefined {
    return this.products().find((p) => p.id === id);
  }

  category(id: string): Category | undefined {
    return this.categories().find((c) => c.id === id);
  }

  /** Substitui/insere produtos no estado (usado após operações de stock e encomendas). */
  upsertProducts(list: Product[]): void {
    const map = new Map(list.map((p) => [p.id, p]));
    const existing = new Set(this.products().map((p) => p.id));
    const fresh = list.filter((p) => !existing.has(p.id));
    this.products.update((all) => [...fresh, ...all.map((p) => map.get(p.id) ?? p)]);
  }

  // ---------- Produtos ----------
  async saveProduct(product: Product): Promise<Product> {
    const saved = await firstValueFrom(this.productRepo.update(product));
    this.upsertProducts([saved]);
    return saved;
  }

  async insertProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const saved = await firstValueFrom(this.productRepo.create(product));
    this.upsertProducts([saved]);
    return saved;
  }

  async setProductStatus(id: string, active: boolean): Promise<void> {
    const p = this.require(id);
    const now = new Date().toISOString();
    await this.saveProduct({
      ...p,
      status: active ? 'activo' : 'inactivo',
      updatedAt: now,
      history: [...p.history, logEntry('admin', active ? 'Produto activado' : 'Produto desactivado', now)],
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const p = this.require(id);
    if (p.reserved > 0) {
      throw new DomainError(`Não é possível remover: há ${p.reserved} unidade(s) reservada(s) em encomendas em curso. Desactive o produto.`);
    }
    await firstValueFrom(this.productRepo.delete(id));
    this.products.update((all) => all.filter((x) => x.id !== id));
    // Remove também das campanhas que o referenciam.
    const affected = this.promotions().filter((pr) => pr.productIds.includes(id));
    for (const pr of affected) {
      await this.persistPromotion({ ...pr, productIds: pr.productIds.filter((x) => x !== id) });
    }
  }

  private require(id: string): Product {
    const p = this.product(id);
    if (!p) throw new DomainError('Produto não encontrado.');
    return p;
  }

  // ---------- Categorias ----------
  async saveCategory(dto: CategoryFormDto, id?: string): Promise<Category> {
    const now = new Date().toISOString();
    const duplicate = this.categories().find((c) => c.name.toLowerCase() === dto.name.trim().toLowerCase() && c.id !== id);
    if (duplicate) throw new DomainError('Já existe uma categoria com este nome.');
    if (id) {
      const existing = this.category(id);
      if (!existing) throw new DomainError('Categoria não encontrada.');
      const saved = await firstValueFrom(this.categoryRepo.update({ ...CategoryMapper.fromForm(dto, now, existing), id }));
      this.categories.update((all) => all.map((c) => (c.id === id ? saved : c)));
      return saved;
    }
    const saved = await firstValueFrom(this.categoryRepo.create(CategoryMapper.fromForm(dto, now)));
    this.categories.update((all) => [...all, saved]);
    return saved;
  }

  async setCategoryActive(id: string, active: boolean): Promise<void> {
    const c = this.category(id);
    if (!c) return;
    const saved = await firstValueFrom(this.categoryRepo.update({ ...c, active, updatedAt: new Date().toISOString() }));
    this.categories.update((all) => all.map((x) => (x.id === id ? saved : x)));
  }

  async deleteCategory(id: string): Promise<void> {
    const count = this.products().filter((p) => p.categoryId === id).length;
    if (count > 0) {
      throw new DomainError(`Esta categoria tem ${count} produto(s) associado(s). Mova-os para outra categoria ou desactive a categoria.`);
    }
    await firstValueFrom(this.categoryRepo.delete(id));
    this.categories.update((all) => all.filter((c) => c.id !== id));
  }

  // ---------- Promoções ----------
  async savePromotion(dto: PromotionFormDto, id?: string): Promise<Promotion> {
    if (dto.kind === 'cupao') {
      const code = (dto.code ?? '').trim().toUpperCase();
      if (!/^[A-Z0-9]{4,20}$/.test(code)) throw new DomainError('O código do cupão deve ter 4 a 20 letras ou números.');
      if (this.promotions().some((p) => p.code === code && p.id !== id)) throw new DomainError('Já existe um cupão com este código.');
    }
    if (new Date(dto.endsAt) <= new Date(dto.startsAt)) throw new DomainError('A data de fim deve ser posterior à data de início.');
    if (dto.discountType === 'percent' && (dto.value <= 0 || dto.value >= 100)) throw new DomainError('A percentagem deve estar entre 1 e 99.');
    if (dto.scope === 'products' && !dto.productIds.length) throw new DomainError('Seleccione pelo menos um produto.');
    if (dto.scope === 'categories' && !dto.categoryIds.length) throw new DomainError('Seleccione pelo menos uma categoria.');

    const now = new Date().toISOString();
    if (id) {
      const existing = this.promotions().find((p) => p.id === id);
      return this.persistPromotion({ ...PromotionMapper.fromForm(dto, now, existing), id });
    }
    const saved = await firstValueFrom(this.promotionRepo.create(PromotionMapper.fromForm(dto, now)));
    this.promotions.update((all) => [saved, ...all]);
    return saved;
  }

  async setPromotionActive(id: string, active: boolean): Promise<void> {
    const p = this.promotions().find((x) => x.id === id);
    if (p) await this.persistPromotion({ ...p, active, updatedAt: new Date().toISOString() });
  }

  async deletePromotion(id: string): Promise<void> {
    await firstValueFrom(this.promotionRepo.delete(id));
    this.promotions.update((all) => all.filter((p) => p.id !== id));
  }

  private async persistPromotion(p: Promotion): Promise<Promotion> {
    const saved = await firstValueFrom(this.promotionRepo.update(p));
    this.promotions.update((all) => all.map((x) => (x.id === p.id ? saved : x)));
    return saved;
  }

  // ---------- Avaliações ----------
  async insertReview(review: Omit<Review, 'id'>): Promise<Review> {
    const saved = await firstValueFrom(this.reviewRepo.create(review));
    this.reviews.update((all) => [saved, ...all]);
    return saved;
  }
}
