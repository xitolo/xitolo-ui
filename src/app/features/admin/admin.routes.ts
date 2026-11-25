import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  { path: '', title: 'Dashboard · Xitolo Admin', loadComponent: () => import('./dashboard/dashboard-page').then((m) => m.DashboardPage) },
  { path: 'produtos', title: 'Produtos · Xitolo Admin', loadComponent: () => import('./products/products-page').then((m) => m.ProductsPage) },
  { path: 'produtos/novo', title: 'Novo produto · Xitolo Admin', loadComponent: () => import('./products/product-form-page').then((m) => m.ProductFormPage) },
  { path: 'produtos/:id', title: 'Produto · Xitolo Admin', loadComponent: () => import('./products/product-detail-page').then((m) => m.ProductDetailPage) },
  { path: 'produtos/:id/editar', title: 'Editar produto · Xitolo Admin', loadComponent: () => import('./products/product-form-page').then((m) => m.ProductFormPage) },
  { path: 'categorias', title: 'Categorias · Xitolo Admin', loadComponent: () => import('./categories/categories-page').then((m) => m.CategoriesPage) },
  { path: 'encomendas', title: 'Encomendas · Xitolo Admin', loadComponent: () => import('./orders/orders-page').then((m) => m.OrdersPage) },
  { path: 'encomendas/:id', title: 'Encomenda · Xitolo Admin', loadComponent: () => import('./orders/order-detail-page').then((m) => m.AdminOrderDetailPage) },
  { path: 'clientes', title: 'Clientes · Xitolo Admin', loadComponent: () => import('./customers/customers-page').then((m) => m.CustomersPage) },
  { path: 'clientes/:id', title: 'Cliente · Xitolo Admin', loadComponent: () => import('./customers/customer-detail-page').then((m) => m.CustomerDetailPage) },
  { path: 'pagamentos', title: 'Pagamentos · Xitolo Admin', loadComponent: () => import('./payments/payments-page').then((m) => m.PaymentsPage) },
  { path: 'entregas', title: 'Entregas · Xitolo Admin', loadComponent: () => import('./deliveries/deliveries-page').then((m) => m.DeliveriesPage) },
  { path: 'stock', title: 'Stock · Xitolo Admin', loadComponent: () => import('./inventory/inventory-page').then((m) => m.InventoryPage) },
  { path: 'promocoes', title: 'Promoções · Xitolo Admin', loadComponent: () => import('./promotions/promotions-page').then((m) => m.PromotionsPage) },
  { path: 'relatorios', title: 'Relatórios · Xitolo Admin', loadComponent: () => import('./reports/reports-page').then((m) => m.ReportsPage) },
];
