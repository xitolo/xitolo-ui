import { Entity, GarmentType } from './common';

export interface Category extends Entity {
  name: string;
  slug: string;
  description: string;
  /** Imagem carregada (data URL). Null → usa a ilustração. */
  image: string | null;
  illustration: { type: GarmentType; color: string };
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
