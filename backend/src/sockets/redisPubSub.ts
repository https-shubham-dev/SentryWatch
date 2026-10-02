import Redis from 'ioredis';
import { redisConnectionOptions } from '../config/redis.js';

export type EventType = 'api:status_changed' | 'incident:created' | 'incident:updated';

export interface SystemEvent {
  type: EventType;
  organizationId: string;
  payload: unknown;
}

const CHANNEL_NAME = 'sentrywatch:events';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(redisConnectionOptions);
  }
  return publisher;
}

/**
 * Publish a system event to Redis Pub/Sub.
 * Enables cross-process communication from BullMQ workers to the Socket.IO server.
 */
export async function publishSystemEvent(event: SystemEvent): Promise<void> {
  try {
    const pub = getPublisher();
    await pub.publish(CHANNEL_NAME, JSON.stringify(event));
  } catch (err) {
    console.error('[PubSub] Error publishing system event:', err);
  }
}

/**
 * Subscribe to Redis Pub/Sub system events and forward them to Socket.IO org rooms.
 */
export function subscribeSystemEvents(onEvent: (event: SystemEvent) => void): void {
  subscriber = new Redis(redisConnectionOptions);

  subscriber.subscribe(CHANNEL_NAME, (err) => {
    if (err) {
      console.error('[PubSub] Failed to subscribe to Redis channel:', err);
    } else {
      console.info(`[PubSub] Subscribed to Redis channel '${CHANNEL_NAME}'`);
    }
  });

  subscriber.on('message', (_channel, message) => {
    try {
      const event: SystemEvent = JSON.parse(message);
      onEvent(event);
    } catch (err) {
      console.error('[PubSub] Error parsing received event message:', err);
    }
  });
}
