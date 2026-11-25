import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlaceOrderRequest } from '../domain/dtos';
import { Actor, Delivery, Order, Payment, logEntry } from '../domain/entities';
import { DeliveryRepository, OrderRepository, PaymentRepository } from '../domain/repositories/repositories';
import { DomainError } from '../domain/services/domain-error';
import { StockChange } from '../domain/services/inventory-policy';
import {
  deliveryStatusFor,
  generateOrderNumber,
  requiresPrepayment,
  transitionError,
} from '../domain/services/order-lifecycle';
import { orderTotal } from '../domain/services/pricing';
import { Money } from '../domain/value-objects/money';
import { MzPhone } from '../domain/value-objects/mz-phone';
import { findProvince } from '../domain/value-objects/shipping';
import { ORDER_STATUS_LABEL, OrderStatus, PAYMENT_METHODS } from '../domain/value-objects/statuses';
import { CustomerStore } from './customer.store';
import { InventoryStore } from './inventory.store';
import { OrderPricingService } from './order-pricing.service';

export interface DeliveryDraft {
  courier: string;
  fee: number;
  cost: number;
  expectedBy: string;
}

/**
 * Casos de uso de vendas: encomendas, pagamentos e entregas.
 * Mantém as três entidades sincronizadas com o inventário.
 */
@Injectable({ providedIn: 'root' })
export class SalesStore {
  private readonly orderRepo = inject(OrderRepository);
  private readonly paymentRepo = inject(PaymentRepository);
  private readonly deliveryRepo = inject(DeliveryRepository);
  private readonly inventory = inject(InventoryStore);
  private readonly customers = inject(CustomerStore);
  private readonly pricing = inject(OrderPricingService);

  readonly orders = signal<Order[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly deliveries = signal<Delivery[]>([]);

  async load(): Promise<void> {
    const byDateDesc = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
    const [orders, payments, deliveries] = await Promise.all([
      firstValueFrom(this.orderRepo.findAll()),
      firstValueFrom(this.paymentRepo.findAll()),
      firstValueFrom(this.deliveryRepo.findAll()),
    ]);
    this.orders.set(orders.sort(byDateDesc));
    this.payments.set(payments.sort(byDateDesc));
    this.deliveries.set(deliveries.sort(byDateDesc));
  }

  order(id: string): Order | undefined {
    return this.orders().find((o) => o.id === id || o.number === id);
  }

  paymentFor(orderId: string): Payment | null {
    return this.payments().find((p) => p.orderId === orderId) ?? null;
  }

  deliveryFor(orderId: string): Delivery | null {
    return this.deliveries().find((d) => d.orderId === orderId) ?? null;
  }

  ordersOf(customerId: string): Order[] {
    return this.orders().filter((o) => o.customerId === customerId);
  }

  // ======================= Encomendas =======================

  async placeOrder(req: PlaceOrderRequest): Promise<Order> {
    const customer = this.customers.customer(req.customerId);
    if (!customer) throw new DomainError('Inicie sessão para concluir a compra.');
    if (!customer.active) throw new DomainError('A sua conta está desactivada.');

    const priced = this.pricing.price(req.lines, req.couponCode, req.province, req.deliveryMethod);
    if (priced.errors.length) throw new DomainError(priced.errors[0]);
    if (!priced.items.length) throw new DomainError('O carrinho está vazio.');
    if (req.couponCode && !priced.coupon?.ok) throw new DomainError(priced.coupon?.message ?? 'Cupão inválido.');
    if (priced.option.method !== req.deliveryMethod) throw new DomainError('O método de entrega escolhido não está disponível.');
    if (req.deliveryMethod !== 'levantamento' && !req.address) throw new DomainError('Indique o endereço de entrega.');
    if (!MzPhone.isValid(req.contact.phone)) throw new DomainError('Telemóvel de contacto inválido.');

    const method = PAYMENT_METHODS[req.paymentMethod];
    if (req.paymentMethod === 'na_entrega' && !findProvince(req.province).metro) {
      throw new DomainError('Pagamento na entrega só está disponível em Maputo Cidade e Província.');
    }
    let walletPhone: string | null = null;
    if (method.prefixes) {
      const phone = MzPhone.parse(req.paymentPhone ?? '');
      if (!phone || !method.prefixes.includes(phone.prefix)) {
        throw new DomainError(`O número ${method.label} deve começar por ${method.prefixes.join(' ou ')}.`);
      }
      walletPhone = phone.digits;
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const expected = new Date(nowDate.getTime() + priced.option.etaDays * 86_400_000);
    expected.setHours(20, 0, 0, 0);

    const draft: Omit<Order, 'id'> = {
      number: generateOrderNumber(nowDate, new Set(this.orders().map((o) => o.number))),
      customerId: customer.id,
      customerName: req.contact.name.trim(),
      customerEmail: req.contact.email.trim().toLowerCase(),
      customerPhone: MzPhone.normalize(req.contact.phone),
      items: priced.items,
      subtotal: priced.subtotal,
      discount: priced.discount,
      couponCode: priced.coupon?.ok ? req.couponCode!.trim().toUpperCase() : null,
      shippingFee: priced.shippingFee,
      shippingCost: priced.option.cost,
      total: priced.total,
      deliveryMethod: req.deliveryMethod,
      address: req.deliveryMethod === 'levantamento' ? null : req.address,
      paymentMethod: req.paymentMethod,
      status: 'pendente',
      stockState: 'reservado',
      expectedBy: expected.toISOString(),
      createdAt: now,
      updatedAt: now,
      history: [{ at: now, by: 'cliente', status: 'pendente', message: 'Encomenda criada' }],
    };

    // Valida e prepara a reserva de stock antes de gravar qualquer coisa.
    const reservation = this.inventory.changesForOrder({ ...draft, id: '' }, 'reserve', 'cliente');
    const order = await firstValueFrom(this.orderRepo.create(draft));
    await this.inventory.apply(reservation);

    const payment = await firstValueFrom(
      this.paymentRepo.create({
        reference: `PG${Date.now().toString().slice(-8)}`,
        orderId: order.id,
        orderNumber: order.number,
        customerId: customer.id,
        customerName: order.customerName,
        method: req.paymentMethod,
        amount: order.total,
        fee: 0,
        status: 'pendente',
        phone: walletPhone,
        createdAt: now,
        confirmedAt: null,
        updatedAt: now,
        history: [
          logEntry(
            'sistema',
            req.paymentMethod === 'na_entrega'
              ? 'A cobrar no acto da entrega'
              : req.paymentMethod === 'transferencia'
                ? 'A aguardar transferência bancária'
                : `Pedido de pagamento enviado para ${MzPhone.parse(walletPhone!)!.format()}`,
            now,
          ),
        ],
      }),
    );

    this.orders.update((all) => [order, ...all]);
    this.payments.update((all) => [payment, ...all]);
    return order;
  }

  /** Altera o estado da encomenda aplicando os efeitos em stock, pagamento e entrega. */
  async changeOrderStatus(orderId: string, to: OrderStatus, by: Actor, note?: string): Promise<Order> {
    const order = this.requireOrder(orderId);
    const payment = this.paymentFor(order.id);
    const delivery = this.deliveryFor(order.id);
    const error = transitionError(order, to, payment);
    if (error) throw new DomainError(error);

    const shipping: OrderStatus[] = ['em_transito', 'saiu_entrega', 'entregue'];
    if (order.deliveryMethod !== 'levantamento' && shipping.includes(to) && !delivery) {
      throw new DomainError('Registe primeiro a entrega (responsável e custos) no módulo de Entregas.');
    }

    const now = new Date().toISOString();

    // --- stock (idempotente graças ao stockState) ---
    let stockChanges: StockChange[] = [];
    let stockState = order.stockState;
    if (to === 'cancelada' && stockState === 'reservado') {
      stockChanges = this.inventory.changesForOrder(order, 'release', by);
      stockState = 'libertado';
    }
    if (to === 'entregue' && stockState === 'reservado') {
      stockChanges = this.inventory.changesForOrder(order, 'consume', by);
      stockState = 'consumido';
    }

    // --- pagamento ---
    let nextPayment: Payment | null = null;
    if (payment && to === 'cancelada') {
      if (payment.status === 'confirmado') {
        nextPayment = this.withPaymentStatus(payment, 'reembolsado', by, 'Reembolso emitido — encomenda cancelada', now);
      } else if (payment.status === 'pendente') {
        nextPayment = this.withPaymentStatus(payment, 'rejeitado', by, 'Pagamento anulado — encomenda cancelada', now);
      }
    }
    if (payment && to === 'entregue' && payment.method === 'na_entrega' && payment.status === 'pendente') {
      nextPayment = this.withPaymentStatus(payment, 'confirmado', 'sistema', 'Valor cobrado na entrega', now);
    }

    // --- entrega ---
    let nextDelivery: Delivery | null = null;
    if (delivery) {
      const status = deliveryStatusFor(to);
      if (status !== delivery.status || to === 'saiu_entrega') {
        const msg = {
          pendente: 'Entrega pendente',
          em_curso: to === 'saiu_entrega' ? 'Saiu para entrega' : 'Saída do armazém — em trânsito',
          concluida: 'Entrega concluída',
          cancelada: 'Entrega cancelada',
        }[status];
        nextDelivery = {
          ...delivery,
          status,
          dispatchedAt: status === 'em_curso' || status === 'concluida' ? (delivery.dispatchedAt ?? now) : delivery.dispatchedAt,
          completedAt: status === 'concluida' ? now : delivery.completedAt,
          updatedAt: now,
          history: [...delivery.history, logEntry(by, msg, now)],
        };
      }
    }

    const updated: Order = {
      ...order,
      status: to,
      stockState,
      updatedAt: now,
      history: [...order.history, { at: now, by, status: to, message: note?.trim() || ORDER_STATUS_LABEL[to] }],
    };

    await this.inventory.apply(stockChanges);
    await this.persistOrder(updated);
    if (nextPayment) await this.persistPayment(nextPayment);
    if (nextDelivery) await this.persistDelivery(nextDelivery);
    return updated;
  }

  async cancelByCustomer(orderId: string, reason: string): Promise<void> {
    const order = this.requireOrder(orderId);
    if (order.status !== 'pendente' && order.status !== 'confirmada') {
      throw new DomainError('A encomenda já está em preparação. Contacte-nos pelo WhatsApp para a cancelar.');
    }
    await this.changeOrderStatus(orderId, 'cancelada', 'cliente', `Cancelada pelo cliente${reason ? ': ' + reason : ''}`);
  }

  // ======================= Pagamentos =======================

  /** Simula a resposta do cliente ao pedido USSD da carteira móvel. */
  async respondToWalletRequest(orderId: string, approved: boolean): Promise<void> {
    const payment = this.requirePaymentForOrder(orderId);
    if (payment.status !== 'pendente') return;
    const label = PAYMENT_METHODS[payment.method].label;
    if (approved) {
      await this.confirmPayment(payment.id, 'sistema', `Pagamento confirmado por ${label} (PIN validado)`);
    } else {
      await this.persistPayment(
        this.withPaymentStatus(payment, 'rejeitado', 'sistema', `Pagamento recusado — PIN não confirmado no ${label}`, new Date().toISOString()),
      );
    }
  }

  /** Nova tentativa após pagamento recusado (a encomenda continua pendente). */
  async retryPayment(orderId: string, phone: string | null): Promise<void> {
    const order = this.requireOrder(orderId);
    const payment = this.requirePaymentForOrder(orderId);
    if (order.status !== 'pendente' || payment.status !== 'rejeitado') {
      throw new DomainError('Não é possível repetir o pagamento desta encomenda.');
    }
    const method = PAYMENT_METHODS[payment.method];
    let walletPhone = payment.phone;
    if (method.prefixes) {
      const p = MzPhone.parse(phone ?? '');
      if (!p || !method.prefixes.includes(p.prefix)) throw new DomainError(`Número ${method.label} inválido.`);
      walletPhone = p.digits;
    }
    const now = new Date().toISOString();
    await this.persistPayment({
      ...payment,
      status: 'pendente',
      phone: walletPhone,
      updatedAt: now,
      history: [...payment.history, logEntry('cliente', 'Nova tentativa de pagamento', now)],
    });
  }

  async notifyTransferSent(orderId: string): Promise<void> {
    const payment = this.requirePaymentForOrder(orderId);
    const now = new Date().toISOString();
    await this.persistPayment({
      ...payment,
      updatedAt: now,
      history: [...payment.history, logEntry('cliente', 'Cliente indicou que efectuou a transferência', now)],
    });
  }

  async confirmPayment(paymentId: string, by: Actor = 'admin', note?: string): Promise<void> {
    const payment = this.requirePayment(paymentId);
    const order = this.requireOrder(payment.orderId);
    if (payment.status !== 'pendente') throw new DomainError('Só pagamentos pendentes podem ser confirmados.');
    if (order.status === 'cancelada') throw new DomainError('A encomenda foi cancelada — não é possível confirmar o pagamento.');
    const now = new Date().toISOString();
    await this.persistPayment(this.withPaymentStatus(payment, 'confirmado', by, note ?? 'Pagamento confirmado', now));
    if (order.status === 'pendente' && requiresPrepayment(order)) {
      await this.changeOrderStatus(order.id, 'confirmada', 'sistema', 'Pagamento recebido — encomenda confirmada');
    }
  }

  async rejectPayment(paymentId: string, reason: string): Promise<void> {
    const payment = this.requirePayment(paymentId);
    if (payment.status !== 'pendente') throw new DomainError('Só pagamentos pendentes podem ser rejeitados.');
    await this.persistPayment(
      this.withPaymentStatus(payment, 'rejeitado', 'admin', `Rejeitado: ${reason || 'pagamento não identificado'}`, new Date().toISOString()),
    );
  }

  /** Reembolso = cancelamento da encomenda (só antes do envio). */
  async refundPayment(paymentId: string, reason: string): Promise<void> {
    const payment = this.requirePayment(paymentId);
    if (payment.status !== 'confirmado') throw new DomainError('Só pagamentos confirmados podem ser reembolsados.');
    await this.changeOrderStatus(payment.orderId, 'cancelada', 'admin', `Cancelada com reembolso${reason ? ': ' + reason : ''}`);
  }

  private withPaymentStatus(p: Payment, status: Payment['status'], by: Actor, message: string, now: string): Payment {
    return {
      ...p,
      status,
      fee: status === 'confirmado' ? Money.percentOf(p.amount, PAYMENT_METHODS[p.method].feePercent) : status === 'reembolsado' ? p.fee : 0,
      confirmedAt: status === 'confirmado' ? now : p.confirmedAt,
      updatedAt: now,
      history: [...p.history, logEntry(by, message, now)],
    };
  }

  // ======================= Entregas =======================

  async registerDelivery(orderId: string, draft: DeliveryDraft): Promise<Delivery> {
    const order = this.requireOrder(orderId);
    if (order.deliveryMethod === 'levantamento') throw new DomainError('Esta encomenda é para levantamento na loja.');
    if (this.deliveryFor(order.id)) throw new DomainError('Esta encomenda já tem uma entrega registada.');
    if (order.status === 'pendente') throw new DomainError('Confirme a encomenda antes de registar a entrega.');
    if (order.status === 'cancelada' || order.status === 'entregue') throw new DomainError('A encomenda já está encerrada.');
    if (!order.address) throw new DomainError('A encomenda não tem endereço de entrega.');
    if (!draft.courier.trim()) throw new DomainError('Indique o responsável pela entrega.');
    this.validateDeliveryValues(draft);

    await this.applyFeeChange(order, draft.fee);
    const now = new Date().toISOString();
    const delivery = await firstValueFrom(
      this.deliveryRepo.create({
        orderId: order.id,
        orderNumber: order.number,
        customerId: order.customerId,
        customerName: order.customerName,
        phone: order.address.phone || order.customerPhone,
        address: order.address,
        method: order.deliveryMethod,
        fee: draft.fee,
        cost: draft.cost,
        courier: draft.courier.trim(),
        status: 'pendente',
        expectedBy: draft.expectedBy,
        dispatchedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        history: [logEntry('admin', `Entrega registada e atribuída a ${draft.courier.trim()}`, now)],
      }),
    );
    this.deliveries.update((all) => [delivery, ...all]);
    return delivery;
  }

  async updateDelivery(deliveryId: string, draft: DeliveryDraft): Promise<void> {
    const d = this.deliveries().find((x) => x.id === deliveryId);
    if (!d) throw new DomainError('Entrega não encontrada.');
    if (d.status === 'concluida' || d.status === 'cancelada') throw new DomainError('A entrega já está encerrada.');
    this.validateDeliveryValues(draft);
    const order = this.requireOrder(d.orderId);
    if (draft.fee !== d.fee) await this.applyFeeChange(order, draft.fee);
    const now = new Date().toISOString();
    const changes: string[] = [];
    if (draft.courier.trim() !== d.courier) changes.push(`responsável: ${draft.courier.trim()}`);
    if (draft.cost !== d.cost) changes.push(`custo: ${Money.format(draft.cost)}`);
    if (draft.fee !== d.fee) changes.push(`valor cobrado: ${Money.format(draft.fee)}`);
    if (draft.expectedBy !== d.expectedBy) changes.push('prazo alterado');
    await this.persistDelivery({
      ...d,
      courier: draft.courier.trim(),
      cost: draft.cost,
      fee: draft.fee,
      expectedBy: draft.expectedBy,
      updatedAt: now,
      history: changes.length ? [...d.history, logEntry('admin', `Actualizada — ${changes.join(', ')}`, now)] : d.history,
    });
  }

  private validateDeliveryValues(d: DeliveryDraft): void {
    if (d.fee < 0 || d.cost < 0) throw new DomainError('Os valores não podem ser negativos.');
    if (!d.expectedBy || isNaN(new Date(d.expectedBy).getTime())) throw new DomainError('Indique o prazo de entrega.');
  }

  /** Alterar o valor cobrado altera o total da encomenda — só se ainda não foi pago. */
  private async applyFeeChange(order: Order, fee: number): Promise<void> {
    if (fee === order.shippingFee) return;
    const payment = this.paymentFor(order.id);
    if (payment && payment.status !== 'pendente') {
      throw new DomainError('O pagamento já foi processado; o valor cobrado pela entrega não pode ser alterado.');
    }
    const now = new Date().toISOString();
    const total = orderTotal(order.subtotal, order.discount, fee);
    await this.persistOrder({
      ...order,
      shippingFee: fee,
      total,
      updatedAt: now,
      history: [...order.history, { at: now, by: 'admin', status: null, message: `Taxa de entrega alterada para ${Money.format(fee)}` }],
    });
    if (payment) await this.persistPayment({ ...payment, amount: total, updatedAt: now });
  }

  // ======================= Persistência =======================

  private async persistOrder(o: Order): Promise<void> {
    const saved = await firstValueFrom(this.orderRepo.update(o));
    this.orders.update((all) => all.map((x) => (x.id === saved.id ? saved : x)));
  }

  private async persistPayment(p: Payment): Promise<void> {
    const saved = await firstValueFrom(this.paymentRepo.update(p));
    this.payments.update((all) => all.map((x) => (x.id === saved.id ? saved : x)));
  }

  private async persistDelivery(d: Delivery): Promise<void> {
    const saved = await firstValueFrom(this.deliveryRepo.update(d));
    this.deliveries.update((all) => all.map((x) => (x.id === saved.id ? saved : x)));
  }

  private requireOrder(id: string): Order {
    const o = this.order(id);
    if (!o) throw new DomainError('Encomenda não encontrada.');
    return o;
  }

  private requirePayment(id: string): Payment {
    const p = this.payments().find((x) => x.id === id);
    if (!p) throw new DomainError('Pagamento não encontrado.');
    return p;
  }

  private requirePaymentForOrder(orderId: string): Payment {
    const p = this.paymentFor(orderId);
    if (!p) throw new DomainError('Pagamento não encontrado.');
    return p;
  }
}
