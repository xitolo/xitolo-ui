import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AppDataService } from '../../application/app-data.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { DEMO_ADMIN, SessionService } from '../../core/services/session.service';
import { ToastService } from '../../core/services/toast.service';
import { AdminAlertsService } from '../../features/admin/admin-alerts.service';
import { Icon } from '../../shared/components/icon';
import { Logo } from '../../shared/components/logo';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: () => number;
}

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
})
export class AdminLayout {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  protected readonly data = inject(AppDataService);
  protected readonly alerts = inject(AdminAlertsService);
  protected readonly admin = DEMO_ADMIN;

  protected readonly sideOpen = signal(false);
  protected readonly bellOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly quick = signal('');

  protected readonly groups: { title: string; items: NavItem[] }[] = [
    { title: 'Visão geral', items: [{ path: '/admin', label: 'Dashboard', icon: 'dashboard' }, { path: '/admin/relatorios', label: 'Relatórios', icon: 'file' }] },
    {
      title: 'Vendas',
      items: [
        { path: '/admin/encomendas', label: 'Encomendas', icon: 'package', badge: () => this.alerts.pendingOrders() },
        { path: '/admin/pagamentos', label: 'Pagamentos', icon: 'wallet', badge: () => this.alerts.pendingPayments() },
        { path: '/admin/entregas', label: 'Entregas', icon: 'truck', badge: () => this.alerts.awaitingDelivery() + this.alerts.lateDeliveries() },
        { path: '/admin/clientes', label: 'Clientes', icon: 'users' },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { path: '/admin/produtos', label: 'Produtos', icon: 'tag' },
        { path: '/admin/categorias', label: 'Categorias', icon: 'layers' },
        { path: '/admin/stock', label: 'Stock', icon: 'box', badge: () => this.alerts.lowStock() },
        { path: '/admin/promocoes', label: 'Promoções', icon: 'percent' },
      ],
    },
  ];

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.sideOpen.set(false);
        this.bellOpen.set(false);
        this.menuOpen.set(false);
      });
  }

  goToOrder(): void {
    const q = this.quick().trim();
    if (!q) return;
    void this.router.navigate(['/admin/encomendas'], { queryParams: { q } });
    this.quick.set('');
  }

  async resetDemo(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: 'Repor dados de demonstração?',
      message: 'Todas as alterações (produtos, encomendas, pagamentos, stock…) serão substituídas pelos dados iniciais.',
      confirmLabel: 'Repor dados',
      danger: true,
    });
    if (!ok) return;
    await this.data.resetDemo();
    this.toast.success('Dados de demonstração repostos');
  }

  logout(): void {
    this.session.adminLogout();
    void this.router.navigate(['/admin/entrar']);
  }
}
