import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CatalogStore } from '../../../application/catalog.store';
import { ProductManagementService } from '../../../application/product-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductFormDto } from '../../../domain/dtos';
import { COLOR_SWATCHES, GARMENT_LABEL, GarmentType } from '../../../domain/entities';
import { ProductMapper } from '../../../infrastructure/mappers/mappers';
import { Icon } from '../../../shared/components/icon';
import { ImagePicker } from '../../../shared/components/image-picker';
import { ProductImage } from '../../../shared/components/product-image';
import { EmptyState } from '../../../shared/components/ui';
import { MznPipe } from '../../../shared/pipes/format.pipes';

const SIZE_PRESETS: Record<string, string[]> = {
  Roupa: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Calças: ['30', '32', '34', '36', '38'],
  Calçado: ['36', '37', '38', '39', '40', '41', '42', '43'],
  Criança: ['2A', '4A', '6A', '8A', '10A', '12A'],
  Único: ['Único'],
};

@Component({
  selector: 'app-product-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ImagePicker, ProductImage, Icon, MznPipe, EmptyState],
  templateUrl: './product-form-page.html',
  styles: `.lay{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}
    .side{position:sticky;top:84px}.prev{aspect-ratio:3/4;border-radius:12px;overflow:hidden}
    fieldset{border:0}legend{float:left;width:100%;font-weight:800;font-size:15px;margin-bottom:12px}legend+*{clear:both}
    .feat{display:flex;gap:6px}.sizes-add{display:flex;gap:6px;max-width:280px}
    @media (max-width:1000px){.lay{grid-template-columns:1fr}.side{position:static}}`,
})
export class ProductFormPage {
  /** Ausente → criação. */
  readonly id = input<string>();
  private readonly fb = inject(FormBuilder);
  protected readonly catalog = inject(CatalogStore);
  private readonly management = inject(ProductManagementService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly garments = Object.entries(GARMENT_LABEL) as [GarmentType, string][];
  protected readonly swatches = Object.entries(COLOR_SWATCHES);
  protected readonly sizePresets = Object.entries(SIZE_PRESETS);
  protected readonly busy = signal(false);
  protected readonly images = signal<string[]>([]);
  protected readonly newSize = signal('');

  protected readonly existing = computed(() => (this.id() ? this.catalog.product(this.id()!) : undefined));
  protected readonly isEdit = computed(() => !!this.id());

  protected readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{3,20}$/)]],
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    features: this.fb.array<FormControl<string>>([]),
    categoryId: ['', Validators.required],
    type: ['tee' as GarmentType],
    pattern: [false],
    costPrice: [0, [Validators.required, Validators.min(0)]],
    price: [0, [Validators.required, Validators.min(1)]],
    promoPrice: [null as number | null],
    initialStock: [0, [Validators.min(0)]],
    minStock: [5, [Validators.required, Validators.min(0)]],
    sizes: [[] as string[]],
    colors: [[] as string[]],
    status: ['activo' as 'activo' | 'inactivo'],
    madeInMz: [false],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly margin = computed(() => {
    const v = this.value();
    const sell = v.promoPrice || v.price || 0;
    return sell ? Math.round(((sell - (v.costPrice ?? 0)) / sell) * 100) : 0;
  });

  get features(): FormArray<FormControl<string>> {
    return this.form.controls.features;
  }

  constructor() {
    let loadedFor: string | undefined;
    effect(() => {
      const p = this.existing();
      if (p && loadedFor !== p.id) {
        loadedFor = p.id;
        const dto = ProductMapper.toForm(p);
        this.features.clear();
        dto.features.forEach((f) => this.features.push(this.fb.nonNullable.control(f)));
        this.form.patchValue({ ...dto, type: dto.illustration.type, pattern: dto.illustration.pattern });
        this.form.controls.initialStock.disable();
        this.images.set(dto.images);
      }
      if (!this.id() && !loadedFor) {
        loadedFor = 'new';
        const first = this.catalog.categories()[0];
        this.form.patchValue({ categoryId: first?.id ?? '', sku: `XT-${String(this.catalog.products().length + 1).padStart(3, '0')}`, sizes: ['S', 'M', 'L', 'XL'], colors: ['Preto'] });
        this.features.push(this.fb.nonNullable.control(''));
      }
    });
  }

  addFeature(): void {
    this.features.push(this.fb.nonNullable.control(''));
  }

  toggleIn(key: 'sizes' | 'colors', v: string): void {
    const ctrl = this.form.controls[key];
    const list = ctrl.value;
    ctrl.setValue(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
    ctrl.markAsDirty();
  }

  addSize(): void {
    const s = this.newSize().trim().toUpperCase();
    if (s && !this.form.controls.sizes.value.includes(s)) this.toggleIn('sizes', s);
    this.newSize.set('');
  }

  applyPreset(sizes: string[]): void {
    this.form.controls.sizes.setValue([...sizes]);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.show('Verifique os campos assinalados.', 'error');
      return;
    }
    const v = this.form.getRawValue();
    const dto: ProductFormDto = {
      sku: v.sku,
      name: v.name,
      description: v.description,
      features: v.features,
      categoryId: v.categoryId,
      images: this.images(),
      illustration: { type: v.type, pattern: v.pattern },
      costPrice: +v.costPrice,
      price: +v.price,
      promoPrice: v.promoPrice ? +v.promoPrice : null,
      initialStock: +v.initialStock || 0,
      minStock: +v.minStock,
      sizes: v.sizes,
      colors: v.colors,
      status: v.status,
      madeInMz: v.madeInMz,
    };
    this.busy.set(true);
    try {
      const saved = this.isEdit() ? await this.management.update(this.id()!, dto) : await this.management.create(dto);
      this.toast.success(this.isEdit() ? 'Produto actualizado' : 'Produto criado — já está no catálogo');
      void this.router.navigate(['/admin/produtos', saved.id]);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
