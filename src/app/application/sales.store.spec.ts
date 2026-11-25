import { TestBed } from '@angular/core/testing';
import { provideMockRepositories } from '../infrastructure/providers';
import { MOCK_API_CONFIG, MockDatabase } from '../infrastructure/persistence/mock-database';
import { rangeFromPreset } from '../domain/value-objects/date-range';
import { AppDataService } from './app-data.service';
import { CatalogStore } from './catalog.store';
import { ProductManagementService } from './product-management.service';
import { ReportingService } from './reporting.service';
import { SalesStore } from './sales.store';
import { PlaceOrderRequest } from '../domain/dtos';

describe('Casos de uso de vendas (integração com repositórios mockados)', () => {
  let sales: SalesStore;
  let catalog: CatalogStore;

  const ana = 'cli_ana';
  const address = {
    id: 'adr_cli_ana', label: 'Casa', recipient: 'Ana Macuácua', phone: '841234567', province: 'Maputo Cidade',
    city: 'Maputo', street: 'Bairro da Malhangalene, Rua 1', reference: '', isDefault: true,
  };
  const req = (over: Partial<PlaceOrderRequest> = {}): PlaceOrderRequest => ({
    customerId: ana,
    contact: { name: 'Ana Macuácua', email: 'ana@exemplo.co.mz', phone: '841234567' },
    lines: [{ productId: 'prd_003', size: 'M', color: 'Preto', qty: 2 }],
    deliveryMethod: 'normal',
    address,
    province: 'Maputo Cidade',
    paymentMethod: 'mpesa',
    paymentPhone: '841234567',
    couponCode: null,
    ...over,
  });

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideMockRepositories(), { provide: MOCK_API_CONFIG, useValue: { latency: [0, 0], storageKey: 'xitolo:test' } }],
    });
    TestBed.inject(MockDatabase).reset();
    await TestBed.inject(AppDataService).loadAll();
    sales = TestBed.inject(SalesStore);
    catalog = TestBed.inject(CatalogStore);
  });

  const product = () => catalog.product('prd_003')!;

  it('M-Pesa: reserva stock, confirma a encomenda após o PIN e mantém o preço registado', async () => {
    const before = { ...product() };
    const order = await sales.placeOrder(req());
    expect(product().reserved).toBe(before.reserved + 2);
    expect(order.status).toBe('pendente');

    await sales.respondToWalletRequest(order.id, false);
    expect(sales.paymentFor(order.id)!.status).toBe('rejeitado');
    await sales.retryPayment(order.id, '841234567');
    await sales.respondToWalletRequest(order.id, true);
    expect(sales.order(order.id)!.status).toBe('confirmada');

    // alterar o preço depois da compra não altera a encomenda
    await catalog.saveProduct({ ...product(), price: 9999 });
    expect(sales.order(order.id)!.items[0].unitPrice).toBe(order.items[0].unitPrice);
  });

  it('cancelar uma encomenda paga reembolsa e liberta o stock uma única vez', async () => {
    const reserved = product().reserved;
    const order = await sales.placeOrder(req());
    await sales.respondToWalletRequest(order.id, true);
    await sales.changeOrderStatus(order.id, 'cancelada', 'admin');
    expect(product().reserved).toBe(reserved);
    expect(sales.paymentFor(order.id)!.status).toBe('reembolsado');
    await expect(sales.changeOrderStatus(order.id, 'cancelada', 'admin')).rejects.toThrow();
    expect(product().reserved).toBe(reserved);
  });

  it('pagamento na entrega: só conta como recebido quando a encomenda é entregue', async () => {
    const reporting = TestBed.inject(ReportingService);
    const range = rangeFromPreset('all');
    const received0 = reporting.financial(range).receivedValue;
    const stock0 = product().stock;
    const order = await sales.placeOrder(req({ paymentMethod: 'na_entrega', paymentPhone: null }));
    await sales.changeOrderStatus(order.id, 'confirmada', 'admin');
    expect(reporting.financial(range).receivedValue).toBe(received0);

    await expect(sales.changeOrderStatus(order.id, 'em_transito', 'admin')).rejects.toThrow(/Registe primeiro a entrega/);
    await sales.registerDelivery(order.id, { courier: 'Albino Cossa', fee: order.shippingFee, cost: 70, expectedBy: order.expectedBy });
    await sales.changeOrderStatus(order.id, 'em_transito', 'admin');
    await sales.changeOrderStatus(order.id, 'entregue', 'admin');

    expect(sales.paymentFor(order.id)!.status).toBe('confirmado');
    expect(sales.deliveryFor(order.id)!.status).toBe('concluida');
    expect(product().stock).toBe(stock0 - 2);
    expect(reporting.financial(range).receivedValue).toBe(received0 + order.total);
  });

  it('não permite comprar mais do que o stock disponível', async () => {
    const available = product().stock - product().reserved;
    await expect(sales.placeOrder(req({ lines: [{ productId: 'prd_003', size: 'M', color: 'Preto', qty: available + 1 }] }))).rejects.toThrow();
  });

  it('produto desactivado não aparece nem pode ser comprado', async () => {
    await catalog.setProductStatus('prd_003', false);
    await expect(sales.placeOrder(req())).rejects.toThrow(/já não está disponível/);
  });

  it('novo produto entra com stock inicial registado como movimento', async () => {
    const created = await TestBed.inject(ProductManagementService).create({
      sku: 'XT-TESTE-1', name: 'Produto teste', description: 'Descrição do produto teste', features: [], categoryId: 'cat_homem', images: [],
      illustration: { type: 'tee', pattern: false }, costPrice: 100, price: 300, promoPrice: null, initialStock: 15, minStock: 3,
      sizes: ['M'], colors: ['Preto'], status: 'activo', madeInMz: false,
    });
    expect(catalog.product(created.id)!.stock).toBe(15);
  });
});
