import { Category, Product, Promotion, slugify } from '../../domain/entities';
import { CategoryFormDto, ProductFormDto, PromotionFormDto } from '../../domain/dtos';

/*
 * Mappers: convertem DTOs (formulários / API) em entidades de domínio e
 * normalizam registos persistidos (compatibilidade com versões anteriores).
 */

export const ProductMapper = {
  normalize(raw: Product): Product {
    return {
      ...raw,
      images: raw.images ?? [],
      features: raw.features ?? [],
      reserved: raw.reserved ?? 0,
      promoPrice: raw.promoPrice ?? null,
      history: raw.history ?? [],
      variants: { sizes: raw.variants?.sizes ?? [], colors: raw.variants?.colors ?? [] },
    };
  },

  /** Novo produto a partir do formulário. O stock inicial entra via movimento de inventário. */
  fromForm(dto: ProductFormDto, now: string): Omit<Product, 'id'> {
    return {
      sku: dto.sku.trim().toUpperCase(),
      name: dto.name.trim(),
      description: dto.description.trim(),
      features: dto.features.map((f) => f.trim()).filter(Boolean),
      categoryId: dto.categoryId,
      images: dto.images,
      illustration: dto.illustration,
      costPrice: dto.costPrice,
      price: dto.price,
      promoPrice: dto.promoPrice || null,
      stock: 0,
      reserved: 0,
      minStock: dto.minStock,
      variants: { sizes: dto.sizes, colors: dto.colors },
      status: dto.status,
      madeInMz: dto.madeInMz,
      createdAt: now,
      updatedAt: now,
      history: [],
    };
  },

  /** Aplica o formulário a um produto existente (stock não é alterado aqui). */
  merge(existing: Product, dto: ProductFormDto, now: string): Product {
    const base = ProductMapper.fromForm(dto, now);
    return {
      ...existing,
      ...base,
      stock: existing.stock,
      reserved: existing.reserved,
      createdAt: existing.createdAt,
      history: existing.history,
    };
  },

  toForm(p: Product): ProductFormDto {
    return {
      sku: p.sku,
      name: p.name,
      description: p.description,
      features: [...p.features],
      categoryId: p.categoryId,
      images: [...p.images],
      illustration: { ...p.illustration },
      costPrice: p.costPrice,
      price: p.price,
      promoPrice: p.promoPrice,
      initialStock: p.stock,
      minStock: p.minStock,
      sizes: [...p.variants.sizes],
      colors: [...p.variants.colors],
      status: p.status,
      madeInMz: p.madeInMz,
    };
  },
};

export const CategoryMapper = {
  fromForm(dto: CategoryFormDto, now: string, existing?: Category): Omit<Category, 'id'> {
    return {
      name: dto.name.trim(),
      slug: slugify(dto.name),
      description: dto.description.trim(),
      image: dto.image,
      illustration: dto.illustration,
      active: dto.active,
      sortOrder: dto.sortOrder,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  },
};

export const PromotionMapper = {
  fromForm(dto: PromotionFormDto, now: string, existing?: Promotion): Omit<Promotion, 'id'> {
    return {
      ...dto,
      name: dto.name.trim(),
      description: dto.description.trim(),
      code: dto.kind === 'cupao' ? (dto.code ?? '').trim().toUpperCase() : null,
      productIds: dto.scope === 'products' ? dto.productIds : [],
      categoryIds: dto.scope === 'categories' ? dto.categoryIds : [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  },

  toForm(p: Promotion): PromotionFormDto {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
    return { ...rest, productIds: [...p.productIds], categoryIds: [...p.categoryIds] };
  },
};
