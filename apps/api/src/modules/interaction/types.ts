/**
 * Customer Interaction Type Definitions
 * Based on f_customer_interaction table
 */

export interface Interaction {
  id: string;
  interaction_number: string;
  interaction_type: string; // 'voice_call', 'chat', 'email', 'sms', 'video_call', 'social_media', 'in_person'
  interaction_subtype?: string; // 'inbound', 'outbound', 'follow_up', 'escalation'
  channel: string; // 'phone', 'live_chat', 'whatsapp', 'email', 'facebook', 'twitter', 'zoom', 'in_store'

  // Chunking support
  chunk_number?: number;
  total_chunks?: number;
  parent_interaction_id?: string;
  is_primary_chunk?: boolean;

  // Timing
  interaction_ts?: string;
  duration_seconds?: number;
  wait_time_seconds?: number;
  talk_time_seconds?: number;
  hold_time_seconds?: number;
  after_call_work_seconds?: number;

  // Person entities (polymorphic)
  interaction_person_entities?: any[]; // JSONB array: [{"person_entity_type": "customer", "person_id": "uuid"}]
  interaction_intention_entity?: string; // 'task', 'project', 'quote', etc.

  // Content storage (S3/MinIO)
  content_format?: string;
  content_size_bytes?: number;
  content_object_bucket?: string;
  content_object_key?: string;
  content_url?: string;
  content_mime_type?: string;
  content_text?: string; // Inline text for small content
  content_summary?: string; // AI-generated summary

  // Transcript
  transcript_text?: string;
  transcript_confidence_score?: number;
  transcript_language?: string;

  // Sentiment & Analytics
  sentiment_score?: number;
  sentiment_label?: string; // 'positive', 'neutral', 'negative', 'mixed'
  customer_satisfaction_score?: number;
  net_promoter_score?: number;
  emotion_tags?: string[];

  // Classification
  interaction_reason?: string;
  interaction_category?: string;
  interaction_subcategory?: string;
  priority_level?: string;

  // Compliance
  consent_recorded?: boolean;
  consent_type?: string;

  // Integration
  source_system?: string;

  // Attachments
  attachment_count?: number;
  attachment_ids?: string[];
  related_interaction_ids?: string[];

  // Metadata
  metadata?: Record<string, any>;

  // Audit fields
  created_by_employee_id?: string;
  created_ts?: string;
  updated_ts?: string;
  deleted_ts?: string;
  archived_ts?: string;
}

export interface CreateInteractionRequest {
  interaction_number: string;
  interaction_type: string;
  channel: string;
  interaction_subtype?: string;
  interaction_ts?: string;
  duration_seconds?: number;
  interaction_person_entities?: any[];
  interaction_intention_entity?: string;
  content_format?: string;
  content_text?: string;
  content_summary?: string;
  transcript_text?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  customer_satisfaction_score?: number;
  emotion_tags?: string[];
  interaction_reason?: string;
  interaction_category?: string;
  priority_level?: string;
  metadata?: Record<string, any>;
}

export interface UpdateInteractionRequest {
  interaction_subtype?: string;
  interaction_intention_entity?: string;
  content_summary?: string;
  transcript_text?: string;
  sentiment_score?: number;
  sentiment_label?: string;
  customer_satisfaction_score?: number;
  emotion_tags?: string[];
  interaction_reason?: string;
  interaction_category?: string;
  priority_level?: string;
  metadata?: Record<string, any>;
}
