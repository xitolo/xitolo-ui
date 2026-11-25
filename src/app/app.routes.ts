import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: 'admin/entrar',
    title: 'Entrar no painel · Xitolo',
    loadComponent: () => import('./features/admin/auth/admin-login-page').then((m) => m.AdminLoginPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout').then((m) => m.AdminLayout),
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layouts/storefront-layout/storefront-layout').then((m) => m.StorefrontLayout),
    loadChildren: () => import('./features/storefront/storefront.routes').then((m) => m.STOREFRONT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
