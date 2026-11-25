import { Injectable, InjectionToken, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { DomainError } from '../../domain/services/domain-error';
import { DbCollections, buildSeed } from '../mock-data/seed-builder';

export type CollectionName = keyof DbCollections;

export interface MockApiConfig {
  /** Latência simulada [mín, máx] em ms. */
  latency: [number, number];
  storageKey: string;
}

export const MOCK_API_CONFIG = new InjectionToken<MockApiConfig>('MOCK_API_CONFIG', {
  providedIn: 'root',
  factory: () => ({ latency: [120, 380], storageKey: 'xitolo:db:v1' }),
});

interface Snapshot {
  version: 1;
  seededAt: string;
  collections: DbCollections;
}

/**
 * "Base de dados" em memória persistida no localStorage.
 * Simula o servidor: os repositórios mockados lêem e escrevem aqui.
 * Também detecta alterações feitas noutro separador (ex.: loja aberta num
 * separador e painel administrativo noutro) e notifica as stores.
 */
@Injectable({ providedIn: 'root' })
export class MockDatabase {
  private readonly config = inject(MOCK_API_CONFIG);
  private snapshot: Snapshot;

  /** Emite quando os dados mudam fora desta instância (outro separador ou reposição). */
  readonly externalChanges$ = new Subject<void>();

  constructor() {
    this.snapshot = this.load() ?? this.createSnapshot();
    this.persist();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== this.config.storageKey) return;
        const fresh = this.load();
        if (fresh) {
          this.snapshot = fresh;
          this.externalChanges$.next();
        }
      });
    }
  }

  get seededAt(): string {
    return this.snapshot.seededAt;
  }

  read<K extends CollectionName>(name: K): DbCollections[K] {
    return structuredClone(this.snapshot.collections[name]);
  }

  write<K extends CollectionName>(name: K, rows: DbCollections[K]): void {
    const previous = this.snapshot.collections[name];
    this.snapshot.collections[name] = structuredClone(rows);
    try {
      this.persist();
    } catch (err) {
      this.snapshot.collections[name] = previous;
      throw err;
    }
  }

  /** Repõe os dados de demonstração iniciais. */
  reset(): void {
    this.snapshot = this.createSnapshot();
    this.persist();
    this.externalChanges$.next();
  }

  private createSnapshot(): Snapshot {
    return { version: 1, seededAt: new Date().toISOString(), collections: buildSeed(new Date()) };
  }

  private load(): Snapshot | null {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Snapshot;
      return parsed?.version === 1 && parsed.collections ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.snapshot));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        throw new DomainError('O armazenamento local do navegador está cheio. Remova algumas imagens e tente novamente.');
      }
      // Navegação privada / armazenamento indisponível: continua só em memória.
    }
  }
}
