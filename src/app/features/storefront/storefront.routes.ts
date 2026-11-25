import { Routes } from '@angular/router';
import { customerGuard } from '../../core/guards/auth.guards';

export const STOREFRONT_ROUTES: Routes = [
  { path: '', title: 'Xitolo — Moda acessível para Moçambique', loadComponent: () => import('./home/home-page').then((m) => m.HomePage) },
  { path: 'produtos', title: 'Catálogo · Xitolo', loadComponent: () => import('./products/catalog-page').then((m) => m.CatalogPage) },
  { path: 'produto/:id', loadComponent: () => import('./products/product-page').then((m) => m.ProductPage) },
  { path: 'favoritos', title: 'Favoritos · Xitolo', loadComponent: () => import('./products/favorites-page').then((m) => m.FavoritesPage) },
  { path: 'carrinho', title: 'Carrinho · Xitolo', loadComponent: () => import('./cart/cart-page').then((m) => m.CartPage) },
  { path: 'checkout', title: 'Finalizar compra · Xitolo', loadComponent: () => import('./checkout/checkout-page').then((m) => m.CheckoutPage) },
  {
    path: 'checkout/concluido/:id',
    title: 'Encomenda registada · Xitolo',
    canActivate: [customerGuard],
    loadComponent: () => import('./checkout/order-placed-page').then((m) => m.OrderPlacedPage),
  },
  { path: 'entrar', title: 'Entrar · Xitolo', loadComponent: () => import('./auth/auth-page').then((m) => m.AuthPage) },
  { path: 'seguir', title: 'Seguir encomenda · Xitolo', loadComponent: () => import('./orders/track-order-page').then((m) => m.TrackOrderPage) },
  { path: 'ajuda', title: 'Ajuda · Xitolo', loadComponent: () => import('./help/help-page').then((m) => m.HelpPage) },
  {
    path: 'conta',
    canActivate: [customerGuard],
    loadComponent: () => import('./customer-account/account-layout').then((m) => m.AccountLayout),
    loadChildren: () => import('./customer-account/account.routes').then((m) => m.ACCOUNT_ROUTES),
  },
];
