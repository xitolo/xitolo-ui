import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHost, ToastHost } from './shared/components/global-hosts';
import { QuickAdd } from './shared/components/quick-add';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost, ConfirmHost, QuickAdd],
  template: `
    <router-outlet />
    <app-quick-add />
    <app-confirm-host />
    <app-toast-host />
  `,
})
export class App {}
