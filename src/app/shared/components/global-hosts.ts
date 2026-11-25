import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { Dialog } from './dialog';
import { Icon } from './icon';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: `:host{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:min(440px,92vw)}
    .t{pointer-events:auto;display:flex;gap:10px;align-items:center;background:var(--ink);color:#fff;padding:11px 16px;border-radius:14px;font-weight:600;font-size:14px;box-shadow:0 12px 30px rgba(0,0,0,.2);animation:up .2s ease}
    .t.error{background:#9b1c1c}.t.success .i{color:#6ee7b7}
    @keyframes up{from{opacity:0;transform:translateY(10px)}}
    @media (max-width:900px){:host{bottom:76px}}`,
  template: `
    @for (t of toast.toasts(); track t.id) {
      <div class="t" [class]="t.kind" role="status" (click)="toast.dismiss(t.id)">
        <app-icon class="i" [name]="t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check-circle' : 'info'" [size]="18" />
        <span>{{ t.text }}</span>
      </div>
    }
  `,
})
export class ToastHost {
  protected readonly toast = inject(ToastService);
}

@Component({
  selector: 'app-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog, FormsModule],
  template: `
    @if (svc.current(); as c) {
      <app-dialog [title]="c.title" (closed)="svc.close({ confirmed: false, text: '' })">
        <p class="muted" style="font-size:14px">{{ c.message }}</p>
        @if (c.input) {
          <div class="field" style="margin-top:14px">
            <label for="confirm-input">{{ c.input.label }}</label>
            <textarea id="confirm-input" class="textarea" [(ngModel)]="text" [placeholder]="c.input.placeholder ?? ''"></textarea>
          </div>
        }
        <ng-container foot>
          <button type="button" class="btn ghost" (click)="svc.close({ confirmed: false, text: '' })">{{ c.cancelLabel ?? 'Cancelar' }}</button>
          <button
            type="button"
            class="btn"
            [class.danger]="c.danger"
            [disabled]="c.input?.required && !text().trim()"
            (click)="svc.close({ confirmed: true, text: text() })"
          >
            {{ c.confirmLabel ?? 'Confirmar' }}
          </button>
        </ng-container>
      </app-dialog>
    }
  `,
})
export class ConfirmHost {
  protected readonly svc = inject(ConfirmService);
  protected readonly text = signal('');
  constructor() {
    effect(() => {
      if (this.svc.current()) this.text.set('');
    });
  }
}
