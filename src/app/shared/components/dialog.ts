import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

/** Caixa de diálogo modal com conteúdo projectado (cabeçalho, corpo e rodapé). */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="overlay" (click)="closed.emit()"></div>
    <div class="dialog" [class.wide]="wide()" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <div class="dialog-head">
        <h2>{{ title() }}</h2>
        <button type="button" class="icon-btn sm" (click)="closed.emit()" aria-label="Fechar"><app-icon name="x" /></button>
      </div>
      <div class="dialog-body"><ng-content /></div>
      <div class="dialog-foot"><ng-content select="[foot]" /></div>
    </div>
  `,
})
export class Dialog {
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly closed = output<void>();
}
