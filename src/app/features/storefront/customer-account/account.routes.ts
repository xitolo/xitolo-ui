import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  { path: '', title: 'A minha conta · Xitolo', loadComponent: () => import('./profile-page').then((m) => m.ProfilePage) },
  { path: 'encomendas', title: 'As minhas encomendas · Xitolo', loadComponent: () => import('./orders-page').then((m) => m.OrdersPage) },
  { path: 'encomendas/:id', title: 'Encomenda · Xitolo', loadComponent: () => import('./order-detail-page').then((m) => m.OrderDetailPage) },
  { path: 'pagamentos', title: 'Pagamentos · Xitolo', loadComponent: () => import('./payments-page').then((m) => m.PaymentsPage) },
  { path: 'enderecos', title: 'Endereços · Xitolo', loadComponent: () => import('./addresses-page').then((m) => m.AddressesPage) },
  {
    path: 'favoritos',
    title: 'Favoritos · Xitolo',
    data: { embedded: true },
    loadComponent: () => import('../products/favorites-page').then((m) => m.FavoritesPage),
  },
  { path: 'avaliacoes', title: 'Avaliações · Xitolo', loadComponent: () => import('./reviews-page').then((m) => m.ReviewsPage) },
];
