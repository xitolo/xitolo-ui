/** Base de todas as entidades persistidas. Datas em ISO-8601. */
export interface Entity {
  id: string;
}

export type Actor = 'cliente' | 'admin' | 'sistema';

/** Entrada genérica do histórico de alterações de uma entidade. */
export interface ChangeLogEntry {
  at: string;
  by: Actor;
  message: string;
}

export function logEntry(by: Actor, message: string, at = new Date().toISOString()): ChangeLogEntry {
  return { at, by, message };
}

export function newId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

/** Ilustração vectorial usada quando a peça ainda não tem fotografias. */
export type GarmentType = 'dress' | 'tee' | 'shirt' | 'pants' | 'shorts' | 'skirt' | 'shoe' | 'bag' | 'cap' | 'wrap';

export const GARMENT_LABEL: Record<GarmentType, string> = {
  dress: 'Vestido',
  tee: 'T-shirt / Top',
  shirt: 'Camisa',
  pants: 'Calças',
  shorts: 'Calções',
  skirt: 'Saia',
  shoe: 'Calçado',
  bag: 'Mala',
  cap: 'Boné',
  wrap: 'Capulana',
};

export const COLOR_SWATCHES: Record<string, string> = {
  Preto: '#1f1f1f',
  Branco: '#f4f1ec',
  Vermelho: '#d6332f',
  Azul: '#2f5fb3',
  Verde: '#2f8a5b',
  Amarelo: '#f1b52b',
  Rosa: '#ee8fb0',
  Bege: '#d8c3a5',
  Laranja: '#ec7a2e',
  Ganga: '#4a6a92',
  Castanho: '#7b5034',
  Cinzento: '#8a8a8a',
};
