import { inject } from '@angular/core';
import { Observable, defer, delay, of } from 'rxjs';
import { Entity, newId } from '../../domain/entities/common';
import { CrudRepository } from '../../domain/repositories/repositories';
import { DomainError } from '../../domain/services/domain-error';
import { DbCollections } from '../mock-data/seed-builder';
import { CollectionName, MOCK_API_CONFIG, MockDatabase } from '../persistence/mock-database';

type RowOf<K extends CollectionName> = DbCollections[K][number];

/**
 * Implementação genérica de CRUD sobre a MockDatabase, com latência
 * assíncrona simulada — comporta-se como um cliente HTTP.
 */
export abstract class MockCrudRepository<K extends CollectionName, T extends RowOf<K> & Entity> implements CrudRepository<T> {
  protected abstract readonly collection: K;
  protected abstract readonly idPrefix: string;
  protected readonly db = inject(MockDatabase);
  private readonly config = inject(MOCK_API_CONFIG);

  /** Hook do mapper: normaliza registos persistidos (ex.: campos novos). */
  protected toEntity(raw: T): T {
    return raw;
  }

  protected respond<R>(fn: () => R): Observable<R> {
    const [min, max] = this.config.latency;
    const ms = max > 0 ? Math.round(min + Math.random() * (max - min)) : 0;
    const source = defer(() => of(fn()));
    return ms > 0 ? source.pipe(delay(ms)) : source;
  }

  protected rows(): T[] {
    return (this.db.read(this.collection) as unknown as T[]).map((r) => this.toEntity(r));
  }

  protected store(rows: T[]): void {
    this.db.write(this.collection, rows as unknown as DbCollections[K]);
  }

  findAll(): Observable<T[]> {
    return this.respond(() => this.rows());
  }

  findById(id: string): Observable<T | null> {
    return this.respond(() => this.rows().find((r) => r.id === id) ?? null);
  }

  create(entity: Omit<T, 'id'> & { id?: string }): Observable<T> {
    return this.respond(() => {
      const rows = this.rows();
      const created = { ...entity, id: entity.id ?? newId(this.idPrefix) } as T;
      if (rows.some((r) => r.id === created.id)) throw new DomainError('Já existe um registo com este identificador.');
      this.store([created, ...rows]);
      return created;
    });
  }

  update(entity: T): Observable<T> {
    return this.respond(() => {
      const rows = this.rows();
      const idx = rows.findIndex((r) => r.id === entity.id);
      if (idx < 0) throw new DomainError('Registo não encontrado.');
      rows[idx] = entity;
      this.store(rows);
      return entity;
    });
  }

  delete(id: string): Observable<void> {
    return this.respond(() => {
      this.store(this.rows().filter((r) => r.id !== id));
    });
  }

  saveMany(entities: T[]): Observable<T[]> {
    return this.respond(() => {
      const rows = this.rows();
      const index = new Map(rows.map((r, i) => [r.id, i]));
      const fresh: T[] = [];
      for (const e of entities) {
        const i = index.get(e.id);
        if (i === undefined) fresh.push(e);
        else rows[i] = e;
      }
      this.store([...fresh, ...rows]);
      return entities;
    });
  }
}
