import * as zmq from 'zeromq';
import { logger } from '../../utils/logger';

/**
 * ZMQ Topic types for Bitcoin Core notifications
 */
export type ZmqTopic = 'hashblock' | 'hashtx' | 'rawblock' | 'rawtx';

/**
 * ZMQ message handler
 */
export type ZmqHandler = (topic: string, data: Buffer, sequence: number) => void | Promise<void>;

/**
 * ZMQ Subscriber Configuration
 */
export interface ZmqSubscriberConfig {
  endpoint: string;
  topics: ZmqTopic[];
  reconnectInterval?: number; // ms
  maxReconnectAttempts?: number;
}

/**
 * ZMQ Subscriber for Bitcoin Core notifications
 *
 * Bitcoin Core publishes notifications via ZeroMQ for:
 * - hashblock: New block hash when a block is added to chain
 * - hashtx: New transaction hash when added to mempool
 * - rawblock: Full block data in binary format
 * - rawtx: Full transaction data in binary format
 *
 * Usage:
 * ```typescript
 * const subscriber = new ZmqSubscriber({
 *   endpoint: 'tcp://127.0.0.1:28332',
 *   topics: ['hashblock', 'rawtx']
 * });
 *
 * subscriber.on('hashblock', (topic, data, sequence) => {
 *   const blockHash = data.toString('hex');
 *   console.log('New block:', blockHash);
 * });
 *
 * await subscriber.connect();
 * ```
 */
export class ZmqSubscriber {
  private socket: zmq.Subscriber | null = null;
  private config: Required<ZmqSubscriberConfig>;
  private handlers: Map<string, ZmqHandler[]> = new Map();
  private isConnected: boolean = false;
  private isShuttingDown: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: ZmqSubscriberConfig) {
    this.config = {
      endpoint: config.endpoint,
      topics: config.topics,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
    };

    logger.info('ZMQ Subscriber initialized', {
      endpoint: this.config.endpoint,
      topics: this.config.topics,
    });
  }

  /**
   * Register a handler for a specific topic
   */
  on(topic: ZmqTopic, handler: ZmqHandler): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
    logger.debug('ZMQ handler registered', { topic });
  }

  /**
   * Remove a handler for a specific topic
   */
  off(topic: ZmqTopic, handler: ZmqHandler): void {
    const topicHandlers = this.handlers.get(topic);
    if (topicHandlers) {
      const index = topicHandlers.indexOf(handler);
      if (index !== -1) {
        topicHandlers.splice(index, 1);
        logger.debug('ZMQ handler removed', { topic });
      }
    }
  }

  /**
   * Connect to ZMQ endpoint and start listening
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('ZMQ already connected');
      return;
    }

    try {
      // Create subscriber socket
      this.socket = new zmq.Subscriber();

      // Configure socket options
      this.socket.connect(this.config.endpoint);
      logger.info('ZMQ connected to endpoint', { endpoint: this.config.endpoint });

      // Subscribe to all configured topics
      for (const topic of this.config.topics) {
        this.socket.subscribe(topic);
        logger.info('ZMQ subscribed to topic', { topic });
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Start listening for messages
      this.startListening();

      logger.info('ZMQ subscriber started successfully');
    } catch (error) {
      logger.error('Failed to connect ZMQ', { error });
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Start listening for messages
   */
  private async startListening(): Promise<void> {
    if (!this.socket) return;

    try {
      // Iterate over messages asynchronously
      for await (const [topic, message, sequence] of this.socket) {
        if (this.isShuttingDown) break;

        try {
          const topicStr = topic.toString();
          const sequenceNum = sequence ? sequence.readUInt32LE(0) : 0;

          logger.debug('ZMQ message received', {
            topic: topicStr,
            sequence: sequenceNum,
            messageSize: message.length,
          });

          // Call all registered handlers for this topic
          const handlers = this.handlers.get(topicStr as ZmqTopic);
          if (handlers && handlers.length > 0) {
            for (const handler of handlers) {
              try {
                await handler(topicStr, message, sequenceNum);
              } catch (handlerError) {
                logger.error('ZMQ handler error', {
                  topic: topicStr,
                  error: handlerError,
                });
              }
            }
          } else {
            logger.debug('No handlers registered for ZMQ topic', { topic: topicStr });
          }
        } catch (messageError) {
          logger.error('Error processing ZMQ message', { error: messageError });
        }
      }
    } catch (error) {
      if (!this.isShuttingDown) {
        logger.error('ZMQ listening error', { error });
        this.isConnected = false;
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('ZMQ max reconnect attempts reached', {
        attempts: this.reconnectAttempts,
        max: this.config.maxReconnectAttempts,
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    logger.warn('ZMQ scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error('ZMQ reconnect failed', { error });
      }
    }, delay);
  }

  /**
   * Disconnect from ZMQ endpoint
   */
  async disconnect(): Promise<void> {
    logger.info('ZMQ disconnecting...');

    this.isShuttingDown = true;
    this.isConnected = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close socket
    if (this.socket) {
      try {
        // Unsubscribe from all topics
        for (const topic of this.config.topics) {
          this.socket.unsubscribe(topic);
        }

        this.socket.close();
        this.socket = null;
        logger.info('ZMQ disconnected successfully');
      } catch (error) {
        logger.error('Error disconnecting ZMQ', { error });
      }
    }
  }

  /**
   * Check if subscriber is connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get current reconnect attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<ZmqSubscriberConfig> {
    return { ...this.config };
  }
}
