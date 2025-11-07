-- ============================================================================
-- LangGraph PostgreSQL Checkpointer Tables
-- Auto-created by @langchain/langgraph-checkpoint-postgres
-- ============================================================================
--
-- SEMANTICS:
-- These tables store LangGraph conversation state for persistence across
-- server restarts. The PostgreSQL checkpointer enables production-ready
-- state management for the 14-step conversational AI workflow.
--
-- TABLES:
-- 1. checkpoints - Main checkpoint storage (conversation snapshots)
-- 2. checkpoint_blobs - Large checkpoint data (binary blobs)
-- 3. checkpoint_writes - Write tracking for incremental updates
-- 4. checkpoint_migrations - Migration version tracking
--
-- USAGE:
-- These tables are automatically created and managed by PostgresSaver.
-- DO NOT manually modify or drop these tables.
-- They are used by: apps/api/src/modules/chat/orchestrator/langgraph/
--
-- ============================================================================

-- Drop existing tables (for clean import)
DROP TABLE IF EXISTS public.checkpoint_writes CASCADE;
DROP TABLE IF EXISTS public.checkpoint_blobs CASCADE;
DROP TABLE IF EXISTS public.checkpoints CASCADE;
DROP TABLE IF EXISTS public.checkpoint_migrations CASCADE;

-- ============================================================================
-- Main Checkpoint Storage
-- Stores conversation state snapshots keyed by thread_id (session_id)
-- ============================================================================

CREATE TABLE public.checkpoints (
    -- Thread identifier (maps to session_id in our system)
    thread_id TEXT NOT NULL,

    -- Checkpoint namespace (default: empty string)
    checkpoint_ns TEXT NOT NULL DEFAULT ''::text,

    -- Unique checkpoint identifier (UUID v7 format)
    checkpoint_id TEXT NOT NULL,

    -- Parent checkpoint for versioning/history
    parent_checkpoint_id TEXT,

    -- Checkpoint type (standard, snapshot, etc.)
    type TEXT,

    -- Main checkpoint data (LangGraph state as JSON)
    -- Contains: messages, context, customer_profile, actions, etc.
    checkpoint JSONB NOT NULL,

    -- Metadata (timestamps, versions, etc.)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Primary key: (thread_id, checkpoint_ns, checkpoint_id)
    CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- Index for efficient thread_id lookups
CREATE INDEX idx_checkpoints_thread_id ON public.checkpoints(thread_id);

-- Index for parent checkpoint traversal
CREATE INDEX idx_checkpoints_parent ON public.checkpoints(parent_checkpoint_id);

COMMENT ON TABLE public.checkpoints IS 'LangGraph conversation state checkpoints - main storage';
COMMENT ON COLUMN public.checkpoints.thread_id IS 'Session identifier (maps to our session_id)';
COMMENT ON COLUMN public.checkpoints.checkpoint IS 'Full conversation state snapshot (JSONB)';
COMMENT ON COLUMN public.checkpoints.checkpoint_id IS 'Unique checkpoint version (UUID v7)';

-- ============================================================================
-- Checkpoint Blobs Storage
-- Stores large binary data that doesn't fit in main checkpoint JSONB
-- ============================================================================

CREATE TABLE public.checkpoint_blobs (
    -- Thread identifier
    thread_id TEXT NOT NULL,

    -- Checkpoint namespace
    checkpoint_ns TEXT NOT NULL DEFAULT ''::text,

    -- Channel name (e.g., 'messages', 'context', 'actions')
    channel TEXT NOT NULL,

    -- Blob version identifier
    version TEXT NOT NULL,

    -- Blob type (image, audio, file, etc.)
    type TEXT NOT NULL,

    -- Binary data
    blob BYTEA,

    -- Primary key: (thread_id, checkpoint_ns, channel, version)
    CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

-- Index for efficient blob lookups by thread and channel
CREATE INDEX idx_checkpoint_blobs_thread_channel ON public.checkpoint_blobs(thread_id, channel);

COMMENT ON TABLE public.checkpoint_blobs IS 'Large binary data storage for checkpoints';
COMMENT ON COLUMN public.checkpoint_blobs.blob IS 'Binary data (images, files, etc.)';

-- ============================================================================
-- Checkpoint Writes Tracking
-- Tracks incremental writes for atomic checkpoint updates
-- ============================================================================

CREATE TABLE public.checkpoint_writes (
    -- Thread identifier
    thread_id TEXT NOT NULL,

    -- Checkpoint namespace
    checkpoint_ns TEXT NOT NULL DEFAULT ''::text,

    -- Checkpoint identifier
    checkpoint_id TEXT NOT NULL,

    -- Task identifier for parallel processing
    task_id TEXT NOT NULL,

    -- Write index (order of writes)
    idx INTEGER NOT NULL,

    -- Channel being written to
    channel TEXT NOT NULL,

    -- Write type (update, append, delete, etc.)
    type TEXT,

    -- Write data (binary)
    blob BYTEA NOT NULL,

    -- Primary key: (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
    CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- Index for efficient write lookups
CREATE INDEX idx_checkpoint_writes_checkpoint ON public.checkpoint_writes(thread_id, checkpoint_id);

COMMENT ON TABLE public.checkpoint_writes IS 'Incremental write tracking for atomic updates';
COMMENT ON COLUMN public.checkpoint_writes.idx IS 'Write order index for replay';

-- ============================================================================
-- Checkpoint Migrations
-- Tracks schema migration versions
-- ============================================================================

CREATE TABLE public.checkpoint_migrations (
    -- Migration version number
    version INTEGER NOT NULL PRIMARY KEY,

    -- Migration timestamp
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.checkpoint_migrations IS 'LangGraph checkpointer migration tracking';

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get latest checkpoint for a session
-- SELECT checkpoint
-- FROM public.checkpoints
-- WHERE thread_id = 'your-session-id'
-- ORDER BY checkpoint_id DESC
-- LIMIT 1;

-- Count checkpoints per session
-- SELECT thread_id, COUNT(*) as checkpoint_count
-- FROM public.checkpoints
-- GROUP BY thread_id
-- ORDER BY checkpoint_count DESC;

-- Get conversation state from checkpoint
-- SELECT
--   thread_id,
--   checkpoint_id,
--   checkpoint->'channel_values'->'current_node' as current_node,
--   checkpoint->'channel_values'->'conversation_ended' as ended,
--   jsonb_array_length(checkpoint->'channel_values'->'messages') as message_count
-- FROM public.checkpoints
-- WHERE thread_id = 'your-session-id'
-- ORDER BY checkpoint_id DESC;

-- ============================================================================
-- CLEANUP POLICY (Optional)
-- ============================================================================

-- Auto-delete old checkpoints (run as cron job)
-- DELETE FROM public.checkpoints
-- WHERE metadata->>'created_at' < (NOW() - INTERVAL '30 days')::text;

-- Keep only latest N checkpoints per thread
-- DELETE FROM public.checkpoints c1
-- WHERE EXISTS (
--   SELECT 1 FROM (
--     SELECT thread_id, checkpoint_id,
--            ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY checkpoint_id DESC) as rn
--     FROM public.checkpoints
--   ) c2
--   WHERE c2.thread_id = c1.thread_id
--     AND c2.checkpoint_id = c1.checkpoint_id
--     AND c2.rn > 100
-- );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON public.checkpoints TO app;
GRANT ALL ON public.checkpoint_blobs TO app;
GRANT ALL ON public.checkpoint_writes TO app;
GRANT ALL ON public.checkpoint_migrations TO app;

-- ============================================================================
-- END OF DDL
-- ============================================================================
