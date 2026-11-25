import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogStore } from '../../../application/catalog.store';
import { SalesStore } from '../../../application/sales.store';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { Promotion, PromotionKind } from '../../../domain/entities';
import { promotionTargets } from '../../../domain/services/pricing';
import { toIsoDate } from '../../../domain/value-objects/date-range';
import { Money } from '../../../domain/value-objects/money';
import { Tone } from '../../../domain/value-objects/statuses';
import { PromotionMapper } from '../../../infrastructure/mappers/mappers';
import { Dialog } from '../../../shared/components/dialog';
import { Icon } from '../../../shared/components/icon';
import { Badge, EmptyState } from '../../../shared/components/ui';

@Component({
  selector: 'app-promotions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DatePipe, Dialog, Icon, Badge, EmptyState],
  styles: `.pick{max-height:170px;overflow:auto;border:1.5px solid var(--line-2);border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:4px}`,
  template: `
    <div class="page-head">
      <div><h1>Promoções e descontos</h1><p>Campanhas baixam o preço na loja automaticamente; cupões aplicam-se no checkout com código.</p></div>
      <button type="button" class="btn sm" (click)="open(null)"><app-icon name="plus" [size]="16" /> Nova promoção</button>
    </div>
    <div class="tabs" style="margin-bottom:12px">
      <button type="button" [class.on]="kind() === ''" (click)="kind.set('')">Todas</button>
      <button type="button" [class.on]="kind() === 'campanha'" (click)="kind.set('campanha')">Campanhas</button>
      <button type="button" [class.on]="kind() === 'cupao'" (click)="kind.set('cupao')">Cupões</button>
    </div>
    <div class="card">
      @if (rows().length) {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Promoção</th><th>Tipo</th><th>Desconto</th><th>Aplica-se a</th><th>Período</th><th>Impacto</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (r of rows(); track r.p.id) {
              <tr>
                <td><span class="row" style="--gap:8px"><i [style.background]="r.p.bannerColor" style="width:10px;height:10px;border-radius:3px"></i><b>{{ r.p.name }}</b></span><div class="muted xs">{{ r.p.description }}</div></td>
                <td>@if (r.p.kind === 'cupao') { Cupão <span class="mono strong">{{ r.p.code }}</span> } @else { Campanha }</td>
                <td>{{ r.p.discountType === 'percent' ? r.p.value + '%' : m(r.p.value) }}@if (r.p.minSubtotal) { <div class="muted xs">mín. {{ m(r.p.minSubtotal) }}</div> }</td>
                <td class="small">{{ scopeText(r.p) }}</td>
                <td class="small nowrap">{{ r.p.startsAt | date: 'dd/MM/yy' }} → {{ r.p.endsAt | date: 'dd/MM/yy' }}</td>
                <td class="small">{{ r.impact }}</td>
                <td><app-badge [label]="r.state.label" [tone]="r.state.tone" /></td>
                <td class="nowrap">
                  <button type="button" class="btn ghost xs" (click)="toggle(r.p)">{{ r.p.active ? 'Desactivar' : 'Activar' }}</button>
                  <button type="button" class="icon-btn sm" (click)="open(r.p)" title="Editar"><app-icon name="edit" /></button>
                  <button type="button" class="icon-btn sm" (click)="remove(r.p)" title="Remover"><app-icon name="trash" /></button>
                </td>
              </tr>
            }
          </tbody></table></div>
      } @else { <app-empty icon="percent" title="Sem promoções" /> }
    </div>

    @if (editing() !== undefined) {
      <app-dialog [title]="editing() ? 'Editar promoção' : 'Nova promoção'" [wide]="true" (closed)="editing.set(undefined)">
        <form id="promo-form" class="form-grid" [formGroup]="form" (ngSubmit)="save()">
          <div class="field full"><div class="segmented">
            <button type="button" [class.on]="v().kind === 'campanha'" (click)="form.controls.kind.setValue('campanha')">Campanha (automática)</button>
            <button type="button" [class.on]="v().kind === 'cupao'" (click)="form.controls.kind.setValue('cupao')">Cupão (com código)</button>
          </div></div>
          <div class="field"><label for="n">Nome</label><input id="n" class="input" formControlName="name" />
            @if (form.controls.name.touched && form.controls.name.invalid) { <span class="error">Obrigatório.</span> }</div>
          @if (v().kind === 'cupao') {
            <div class="field"><label for="c">Código</label><input id="c" class="input mono" formControlName="code" placeholder="EX: VERAO15" style="text-transform:uppercase" /></div>
          } @else {
            <div class="field"><label for="bc">Cor do banner</label><input id="bc" class="input" type="color" formControlName="bannerColor" style="padding:4px" /></div>
          }
          <div class="field full"><label for="d">Descrição (aparece na loja)</label><input id="d" class="input" formControlName="description" placeholder="Ex: −20% em toda a colecção Mulher" /></div>
          <div class="field"><label for="dt">Tipo de desconto</label>
            <select id="dt" class="select" formControlName="discountType"><option value="percent">Percentagem (%)</option><option value="fixed">Valor fixo (MT)</option></select></div>
          <div class="field"><label for="val">Valor</label><input id="val" class="input" type="number" min="1" formControlName="value" /></div>
          @if (v().kind === 'cupao') {
            <div class="field"><label for="min">Compra mínima (MT)</label><input id="min" class="input" type="number" min="0" formControlName="minSubtotal" /></div>
          }
          <div class="field"><label for="s">Início</label><input id="s" class="input" type="date" formControlName="startsAt" /></div>
          <div class="field"><label for="e">Fim</label><input id="e" class="input" type="date" formControlName="endsAt" /></div>
          <div class="field"><label for="sc">Aplica-se a</label>
            <select id="sc" class="select" formControlName="scope"><option value="all">Todos os produtos</option><option value="categories">Categorias</option><option value="products">Produtos específicos</option></select></div>
          @if (v().scope === 'categories') {
            <div class="field full"><label>Categorias</label><div class="chips">
              @for (c of catalog.categories(); track c.id) { <button type="button" class="chip" [class.on]="selCats().includes(c.id)" (click)="toggleSel(selCats, c.id)">{{ c.name }}</button> }
            </div></div>
          }
          @if (v().scope === 'products') {
            <div class="field full"><label>Produtos ({{ selProducts().length }})</label><div class="pick">
              @for (p of catalog.products(); track p.id) { <label class="check small"><input type="checkbox" [checked]="selProducts().includes(p.id)" (change)="toggleSel(selProducts, p.id)" /> {{ p.name }} <span class="muted">· {{ m(p.price) }}</span></label> }
            </div></div>
          }
          <label class="check full"><input type="checkbox" formControlName="active" /> Activa</label>
        </form>
        <ng-container foot>
          <button type="button" class="btn ghost" (click)="editing.set(undefined)">Cancelar</button>
          <button type="submit" form="promo-form" class="btn" [disabled]="busy()">Guardar</button>
        </ng-container>
      </app-dialog>
    }
  `,
})
export class PromotionsPage {
  protected readonly catalog = inject(CatalogStore);
  private readonly sales = inject(SalesStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly m = Money.format;
  protected readonly kind = signal<'' | PromotionKind>('');
  protected readonly editing = signal<Promotion | null | undefined>(undefined);
  protected readonly selCats = signal<string[]>([]);
  protected readonly selProducts = signal<string[]>([]);
  protected readonly busy = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    kind: ['campanha' as PromotionKind],
    code: [''],
    discountType: ['percent' as 'percent' | 'fixed'],
    value: [10, [Validators.required, Validators.min(1)]],
    minSubtotal: [0],
    scope: ['all' as 'all' | 'products' | 'categories'],
    startsAt: ['', Validators.required],
    endsAt: ['', Validators.required],
    active: [true],
    bannerColor: ['#d9480f'],
  });
  protected readonly v = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly rows = computed(() => {
    const now = Date.now();
    return this.catalog
      .promotions()
      .filter((p) => !this.kind() || p.kind === this.kind())
      .map((p) => {
        const starts = new Date(p.startsAt).getTime();
        const ends = new Date(p.endsAt).getTime();
        const state: { label: string; tone: Tone } = !p.active
          ? { label: 'Desactivada', tone: 'neutral' }
          : now < starts
            ? { label: 'Agendada', tone: 'info' }
            : now > ends
              ? { label: 'Terminada', tone: 'neutral' }
              : { label: 'Activa', tone: 'success' };
        const impact =
          p.kind === 'cupao'
            ? `${this.sales.orders().filter((o) => o.couponCode === p.code).length} encomendas`
            : `${this.catalog.products().filter((x) => x.status === 'activo' && promotionTargets(p, x)).length} produtos`;
        return { p, state, impact };
      });
  });

  scopeText(p: Promotion): string {
    if (p.scope === 'all') return 'Todos os produtos';
    if (p.scope === 'categories') return p.categoryIds.map((id) => this.catalog.category(id)?.name ?? '?').join(', ');
    return `${p.productIds.length} produto(s)`;
  }

  toggleSel(sig: typeof this.selCats, id: string): void {
    sig.update((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  }

  open(p: Promotion | null): void {
    const now = new Date();
    if (p) {
      const dto = PromotionMapper.toForm(p);
      this.form.reset({ ...dto, code: dto.code ?? '', startsAt: toIsoDate(new Date(dto.startsAt)), endsAt: toIsoDate(new Date(dto.endsAt)) });
      this.selCats.set(dto.categoryIds);
      this.selProducts.set(dto.productIds);
    } else {
      this.form.reset({
        name: '', description: '', kind: 'campanha', code: '', discountType: 'percent', value: 10, minSubtotal: 0, scope: 'all',
        startsAt: toIsoDate(now), endsAt: toIsoDate(new Date(now.getTime() + 14 * 86_400_000)), active: true, bannerColor: '#d9480f',
      });
      this.selCats.set([]);
      this.selProducts.set([]);
    }
    this.editing.set(p);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const day = (s: string, end: boolean) => {
      const [y, mo, d] = s.split('-').map(Number);
      return new Date(y, mo - 1, d, end ? 23 : 0, end ? 59 : 0).toISOString();
    };
    this.busy.set(true);
    try {
      await this.catalog.savePromotion(
        {
          ...v,
          value: +v.value,
          minSubtotal: +v.minSubtotal || 0,
          code: v.kind === 'cupao' ? v.code : null,
          productIds: this.selProducts(),
          categoryIds: this.selCats(),
          startsAt: day(v.startsAt, false),
          endsAt: day(v.endsAt, true),
        },
        this.editing()?.id,
      );
      this.toast.success('Promoção guardada — preços da loja actualizados');
      this.editing.set(undefined);
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  async toggle(p: Promotion): Promise<void> {
    await this.catalog.setPromotionActive(p.id, !p.active);
    this.toast.success(p.active ? 'Promoção desactivada' : 'Promoção activada');
  }

  async remove(p: Promotion): Promise<void> {
    if (!(await this.confirm.confirm({ title: 'Remover promoção?', message: `“${p.name}” será removida. Encomendas anteriores mantêm os preços registados.`, confirmLabel: 'Remover', danger: true }))) return;
    await this.catalog.deletePromotion(p.id);
    this.toast.success('Promoção removida');
  }
}
