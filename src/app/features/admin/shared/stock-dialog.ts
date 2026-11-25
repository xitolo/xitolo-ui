import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { InventoryStore } from '../../../application/inventory.store';
import { ToastService } from '../../../core/services/toast.service';
import { Product, availableStock } from '../../../domain/entities';
import { Dialog } from '../../../shared/components/dialog';

export type StockOperation = 'entrada' | 'saida' | 'ajuste';

/** Registo de entrada, saída ou ajuste de stock (com motivo para o histórico). */
@Component({
  selector: 'app-stock-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog],
  template: `
    <app-dialog [title]="'Movimentar stock — ' + product().name" (closed)="closed.emit()">
      <div class="segmented" style="margin-bottom:14px">
        <button type="button" [class.on]="op() === 'entrada'" (click)="op.set('entrada')">Entrada</button>
        <button type="button" [class.on]="op() === 'saida'" (click)="op.set('saida')">Saída</button>
        <button type="button" [class.on]="op() === 'ajuste'" (click)="op.set('ajuste')">Ajuste (contagem)</button>
      </div>
      <div class="grid-3" style="margin-bottom:14px">
        <div class="card pad center"><div class="muted xs">Físico</div><b>{{ product().stock }}</b></div>
        <div class="card pad center"><div class="muted xs">Reservado</div><b>{{ product().reserved }}</b></div>
        <div class="card pad center"><div class="muted xs">Disponível</div><b>{{ available() }}</b></div>
      </div>
      <form id="stock-form" class="form-grid" (submit)="$event.preventDefault(); submit()">
        <div class="field">
          <label for="q">{{ op() === 'ajuste' ? 'Nova quantidade física' : 'Quantidade' }}</label>
          <input id="q" class="input" type="number" min="0" [value]="qty()" (input)="qty.set(+$any($event.target).value)" />
          <span class="hint">Depois: {{ preview() }} unidades físicas</span>
        </div>
        <div class="field">
          <label for="r">Motivo</label>
          <input id="r" class="input" [placeholder]="placeholder()" [value]="reason()" (input)="reason.set($any($event.target).value)" />
        </div>
      </form>
      @if (op() === 'saida') { <p class="muted xs" style="margin-top:8px">Saídas manuais (quebras, ofertas, amostras) não podem usar unidades reservadas por encomendas.</p> }
      <ng-container foot>
        <button type="button" class="btn ghost" (click)="closed.emit()">Cancelar</button>
        <button type="submit" form="stock-form" class="btn" [disabled]="busy()">Registar {{ op() }}</button>
      </ng-container>
    </app-dialog>
  `,
})
export class StockDialog {
  readonly product = input.required<Product>();
  readonly initialOp = input<StockOperation>('entrada');
  readonly closed = output<void>();
  private readonly inventory = inject(InventoryStore);
  private readonly toast = inject(ToastService);

  protected readonly op = signal<StockOperation>('entrada');
  protected readonly qty = signal(10);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly available = computed(() => availableStock(this.product()));
  protected readonly preview = computed(() => {
    const s = this.product().stock;
    return this.op() === 'entrada' ? s + this.qty() : this.op() === 'saida' ? s - this.qty() : this.qty();
  });
  protected readonly placeholder = computed(
    () => ({ entrada: 'Ex: Encomenda ao fornecedor nº 123', saida: 'Ex: Peça danificada', ajuste: 'Ex: Inventário mensal' })[this.op()],
  );

  ngOnInit(): void {
    this.op.set(this.initialOp());
    if (this.initialOp() === 'ajuste') this.qty.set(this.product().stock);
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    try {
      const id = this.product().id;
      if (this.op() === 'entrada') await this.inventory.registerEntry(id, this.qty(), this.reason());
      if (this.op() === 'saida') await this.inventory.registerExit(id, this.qty(), this.reason());
      if (this.op() === 'ajuste') await this.inventory.adjust(id, this.qty(), this.reason());
      this.toast.success('Movimento de stock registado');
      this.closed.emit();
    } catch (e) {
      this.toast.error(e);
    } finally {
      this.busy.set(false);
    }
  }
}
