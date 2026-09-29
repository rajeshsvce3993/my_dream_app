import { logger } from '../logging/logger.js';

export type DomainEventName =
  | 'OrderCreated'
  | 'PaymentCompleted'
  | 'PaymentFailed'
  | 'OrderConfirmed'
  | 'OrderPacked'
  | 'OrderShipped'
  | 'OrderDelivered'
  | 'OrderCancelled'
  | 'InventoryReserved'
  | 'InventoryReleased'
  | 'RefundCompleted'
  | 'UserRegistered';

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  payload: T;
  occurredAt: Date;
  correlationId?: string;
}

type EventHandler = (event: DomainEvent) => void | Promise<void>;

class InProcessEventBus {
  private handlers = new Map<DomainEventName, Set<EventHandler>>();

  on(name: DomainEventName, handler: EventHandler): void {
    if (!this.handlers.has(name)) {
      this.handlers.set(name, new Set());
    }
    this.handlers.get(name)!.add(handler);
  }

  async emit<T>(event: DomainEvent<T>): Promise<void> {
    const handlers = this.handlers.get(event.name);
    if (!handlers?.size) return;
    await Promise.all(
      [...handlers].map(async (handler) => {
        try {
          await handler(event as DomainEvent);
        } catch (err) {
          logger.error({ err, event: event.name }, 'Event handler failed');
        }
      }),
    );
  }
}

export const eventBus = new InProcessEventBus();
