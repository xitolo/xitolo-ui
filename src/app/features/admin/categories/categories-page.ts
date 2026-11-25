import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogStore } from '../../../application/catalog.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { COLOR_SWATCHES, Category, GARMENT_LABEL, GarmentType } from '../../../domain/entities';
import { Dialog } from '../../../shared/components/dialog';
import { Icon } from '../../../shared/components/icon';
import { ImagePicker } from '../../../shared/components/image-picker';
import { ProductImage } from '../../../shared/components/product-image';
import { Badge } from '../../../shared/components/ui';

@Component({
  selector: 'app-categories-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Dialog, ImagePicker, ProductImage, Icon, Badge],
  styles: `.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
    .c{overflow:hidden;display:flex;flex-direction:column}.c.off{opacity:.65}
    .im{height:140px;display:block}.im img{width:100%;height:100%;object-fit:cover}
    .b{padding:14px;display:flex;flex-direction:column;gap:6px;flex:1}
    .acts{display:flex;gap:4px;padding:8px 10px;border-top:1px solid var(--line);align-items:center}`,
  template: `
    <div class="page-head">
      <div><h1>Categorias</h1><p>Categorias inactivas e os seus produtos deixam de aparecer na loja.</p></div>
      <button type="button" class="btn sm" (click)="open(null)"><app-icon name="plus" [size]="16" /> Nova categoria</button>
    </div>
    <div class="g">
      @for (c of rows(); track c.cat.id) {
        <div class="card c" [class.off]="!c.cat.active">
          <span class="im">
            @if (c.cat.image) { <img [src]="c.cat.image" [alt]="c.cat.name" /> }
            @else { <app-product-image [type]="c.cat.illustration.type" [color]="c.cat.illustration.color" [pattern]="c.cat.illustration.type === 'wrap'" style="--ill:34%" /> }
          </span>
          <div class="b">
            <div class="row between"><b>{{ c.cat.name }}</b><app-badge [label]="c.cat.active ? 'Activa' : 'Inactiva'" [tone]="c.cat.active ? 'success' : 'neutral'" /></div>
            <span class="muted small">{{ c.cat.description }}</span>
            <a class="link small" routerLink="/admin/produtos" [queryParams]="{ categoria: c.cat.id }">{{ c.count }} produto(s) associado(s) →</a>
          </div>
          <div class="acts">
            <span class="muted xs" style="flex:1">Ordem {{ c.cat.sortOrder }}</span>
            <button type="button" class="btn ghost xs" (click)="toggle(c.cat)">{{ c.cat.active ? 'Desactivar' : 'Activar' }}</button>
            <button type="button" class="icon-btn sm" (click)="open(c.cat)" title="Editar"><app-icon name="edit" /></button>
            <button type="button" class="icon-btn sm" (click)="remove(c.cat, c.count)" title="Remover"><app-icon name="trash" /></button>
          </div>
        </div>
      }
    </div>

    @if (editing() !== undefined) {
      <app-dialog [title]="editing() ? 'Editar categoria' : 'Nova categoria'" (closed)="editing.set(undefined)">
        <form id="cat-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <div class="field"><label for="n">Nome</label><input id="n" class="input" formControlName="name" />
            @if (form.controls.name.touched && form.controls.name.invalid) { <span class="error">Obrigatório.</span> }</div>
          <div class="field"><label for="o">Ordem no menu</label><input id="o" class="input" type="number" formControlName="sortOrder" /></div>
          <div class="field full"><label for="d">Descrição</label><textarea id="d" class="textarea" formControlName="description" style="min-height:60px"></textarea></div>
          <div class="field full"><label>Imagem</label><app-image-picker [(images)]="image" [max]="1" /></div>
          <div class="field"><label for="t">Ilustração (sem imagem)</label>
            <select id="t" class="select" formControlName="type">@for (g of garments; track g[0]) { <option [value]="g[0]">{{ g[1] }}</option> }</select></div>
          <div class="field"><label for="cl">Cor</label>
            <select id="cl" class="select" formControlName="color">@for (c of colors; track c) { <option [value]="c">{{ c }}</option> }</select></div>
          <label class="check full"><input type="checkbox" formControlName="active" /> Activa (visível na loja)</label>
        </form>
        <ng-container foot>
          <button type="button" class="btn ghost" (click)="editing.set(undefined)">Cancelar</button>
          <button type="submit" form="cat-form" class="btn" [disabled]="busy()">Guardar</button>
        </ng-container>
      </app-dialog>
    }
  `,
})
export class CategoriesPage {
  private readonly catalog = inject(CatalogStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly garments = Object.entries(GARMENT_LABEL) as [GarmentType, string][];
  protected readonly colors = Object.keys(COLOR_SWATCHES);
  protected readonly editing = signal<Category | null | undefined>(undefined);
  protected readonly image = signal<string[]>([]);
  protected readonly busy = signal(false);

  protected readonly rows = computed(() =>
    [...this.catalog.categories()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cat) => ({ cat, count: this.catalog.products().filter((p) => p.categoryId === cat.id).length })),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    sortOrder: [1],
    type: ['tee' as GarmentType],
    color: ['Laranja'],
    active: [true],
  });

  open(c: Category | null): void {
    this.form.reset(
      c
        ? { name: c.name, description: c.description, sortOrder: c.sortOrder, type: c.illustration.type, color: c.illustration.color, active: c.active }
        : { name: '', description: '', sortOrder: this.catalog.categories().length + 1, type: 'tee', color: 'Laranja', active: true },
    );
    this.image.set(c?.image ? [c.image] : []);
    this.editing.set(c);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    this.busy.set(true);
    try {
      await this.catalog.saveCategory(
        { name: v.name, description: v.description, sortOrder: +v.sortOrder, active: v.active, image: this.image()[0] ?? null, illustration: { type: v.type, color: v.color } },
        this.editing()?.id,
      );
      this.toast.success('Categoria guardada');
      this.editing.set(undefined);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async toggle(c: Category): Promise<void> {
    await this.catalog.setCategoryActive(c.id, !c.active);
    this.toast.success(c.active ? 'Categoria desactivada — oculta da loja' : 'Categoria activada');
  }

  async remove(c: Category, count: number): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Remover categoria?',
      message: count ? `“${c.name}” tem ${count} produto(s). Mova-os antes de remover.` : `“${c.name}” será removida.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.catalog.deleteCategory(c.id);
      this.toast.success('Categoria removida');
    } catch (e) {
      this.toast.error(e);
    }
  }
}
