import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SalesStore } from '../../../application/sales.store';
import { SessionService } from '../../../core/services/session.service';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../../../shared/components/icon';
import { MznPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-account-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, MznPipe],
  styles: `.acc{display:grid;grid-template-columns:250px 1fr;gap:24px;align-items:start}.acc>*{min-width:0}
    .side{position:sticky;top:130px}
    .who{display:flex;gap:12px;align-items:center;padding:16px}
    .av{width:46px;height:46px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:800;font-size:17px;flex-shrink:0}
    .stats{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
    .stats div{padding:10px 16px;font-size:12px;color:var(--muted)}.stats div+div{border-left:1px solid var(--line)}.stats b{display:block;color:var(--ink);font-size:15px}
    nav{display:flex;flex-direction:column;padding:8px}
    nav a,nav button{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-weight:600;font-size:14px;color:var(--ink-2);text-align:left}
    nav a:hover,nav button:hover{background:var(--hover)} nav a.on{background:var(--ink);color:#fff}
    @media (max-width:900px){.acc{grid-template-columns:1fr}.side{position:static}
      nav{flex-direction:row;overflow-x:auto;scrollbar-width:none}nav a,nav button{white-space:nowrap}}`,
  template: `
    <div class="container page">
      <div class="acc">
        <aside class="card side">
          @if (session.customer(); as c) {
            <div class="who">
              <span class="av">{{ initials() }}</span>
              <div><b>{{ c.name }}</b><div class="muted xs">{{ c.email }}</div></div>
            </div>
            <div class="stats">
              <div><b>{{ stats().orders }}</b>encomendas</div>
              <div><b>{{ stats().spent | mzn }}</b>em compras</div>
            </div>
          }
          <nav>
            <a routerLink="/conta" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }"><app-icon name="user" [size]="18" /> Dados pessoais</a>
            <a routerLink="/conta/encomendas" routerLinkActive="on"><app-icon name="package" [size]="18" /> Encomendas</a>
            <a routerLink="/conta/pagamentos" routerLinkActive="on"><app-icon name="wallet" [size]="18" /> Pagamentos</a>
            <a routerLink="/conta/enderecos" routerLinkActive="on"><app-icon name="pin" [size]="18" /> Endereços</a>
            <a routerLink="/conta/favoritos" routerLinkActive="on"><app-icon name="heart" [size]="18" /> Favoritos</a>
            <a routerLink="/conta/avaliacoes" routerLinkActive="on"><app-icon name="star" [size]="18" /> Avaliações</a>
            <button type="button" (click)="logout()"><app-icon name="logout" [size]="18" /> Terminar sessão</button>
          </nav>
        </aside>
        <section><router-outlet /></section>
      </div>
    </div>
  `,
})
export class AccountLayout {
  protected readonly session = inject(SessionService);
  private readonly sales = inject(SalesStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly initials = computed(() =>
    (this.session.customer()?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  protected readonly stats = computed(() => {
    const c = this.session.customer();
    const orders = c ? this.sales.ordersOf(c.id) : [];
    const paid = orders.filter((o) => o.status !== 'cancelada' && this.sales.paymentFor(o.id)?.status === 'confirmado');
    return { orders: orders.length, spent: paid.reduce((s, o) => s + o.total, 0) };
  });

  logout(): void {
    this.session.logout();
    this.toast.show('Sessão terminada');
    void this.router.navigate(['/']);
  }
}
