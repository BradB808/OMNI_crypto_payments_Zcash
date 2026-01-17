import { WebhookEventType, WebhookStatus } from '../types';

/**
 * WebhookEvent model
 * Tracks webhook delivery to merchants
 */
export interface WebhookEvent {
  id: string;
  merchant_id: string;
  payment_id: string | null;

  // Event details
  event_type: WebhookEventType;
  payload: any; // JSON payload

  // Delivery tracking
  status: WebhookStatus;
  attempts: number;
  next_retry_at: Date | null;
  last_error: string | null;

  // Response tracking
  response_status_code: number | null;
  response_body: string | null;

  // Timestamps
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create webhook event input
 */
export interface CreateWebhookEventInput {
  merchant_id: string;
  payment_id?: string;
  event_type: WebhookEventType;
  payload: any;
}

/**
 * Update webhook event input
 */
export interface UpdateWebhookEventInput {
  status?: WebhookStatus;
  attempts?: number;
  next_retry_at?: Date;
  last_error?: string;
  response_status_code?: number;
  response_body?: string;
  delivered_at?: Date;
}
