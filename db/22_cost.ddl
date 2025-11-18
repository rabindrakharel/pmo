-- =====================================================
-- COST ENTITY (d_cost) - FINANCIAL TRACKING
-- =====================================================
--
-- SEMANTICS:
-- • Financial cost tracking for projects, tasks, and other entities
-- • Supports multi-currency with exchange rates and local currency conversion
-- • Attachment support for invoices, receipts, and supporting documents via S3/MinIO
-- • In-place updates (same ID, version++), soft delete preserves audit trail
--
-- OPERATIONS:
-- • CREATE: INSERT with version=1, active_flag=true
-- • UPDATE: Same ID, version++, updated_ts refreshes
-- • DELETE: active_flag=false, to_ts=now() (soft delete)
-- • QUERY: Filter by cost_code, currency, validity period
--
-- RELATIONSHIPS (NO FOREIGN KEYS):
-- • Parent: project, task, office, business (via entity_instance_link)
-- • Child: attachments stored in S3/MinIO (referenced by attachment_object_key)
-- • RBAC: entity_rbac
--
-- ATTACHMENT WORKFLOW:
-- • Upload file to S3/MinIO via presigned URL
-- • Store object key, bucket, size, format in attachment_* columns
-- • Retrieve via presigned download URL when viewing cost details
--
-- =====================================================

CREATE TABLE IF NOT EXISTS app.cost (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  cost_code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Cost amounts
  cost_amt_lcl numeric(15,2) NOT NULL,
  cost_amt_invoice numeric(15,2),
  invoice_currency varchar(3) DEFAULT 'CAD',
  exch_rate numeric(10,6) DEFAULT 1.0,
  cust_budgeted_amt_lcl numeric(15,2),

  -- Attachment support (S3/MinIO)
  attachment varchar(500),
  attachment_format varchar(50),
  attachment_size_bytes bigint,
  attachment_object_bucket varchar(100),
  attachment_object_key varchar(500),

  -- Validity period
  from_ts timestamptz,
  to_ts timestamptz,

  -- Standard fields
  active_flag boolean DEFAULT true,
  created_ts timestamptz DEFAULT now(),
  updated_ts timestamptz DEFAULT now(),
  version integer DEFAULT 1
);

-- Auto-update timestamp trigger
CREATE TRIGGER d_cost_updated_ts
  BEFORE UPDATE ON app.cost
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_ts();

-- Indexes for performance
CREATE INDEX idx_cost_active ON app.cost(active_flag) WHERE active_flag = true;
CREATE INDEX idx_cost_code ON app.cost(cost_code);
CREATE INDEX idx_cost_currency ON app.cost(invoice_currency);
CREATE INDEX idx_cost_validity ON app.cost(from_ts, to_ts) WHERE from_ts IS NOT NULL;

-- Comments
COMMENT ON TABLE app.cost IS 'Project and task-level cost tracking with attachment support';
COMMENT ON COLUMN app.cost.cost_amt_lcl IS 'Cost amount in local currency (CAD)';
COMMENT ON COLUMN app.cost.cost_amt_invoice IS 'Cost amount as per invoice (if different currency)';
COMMENT ON COLUMN app.cost.exch_rate IS 'Exchange rate applied for currency conversion';
COMMENT ON COLUMN app.cost.cust_budgeted_amt_lcl IS 'Customer budgeted amount in local currency';
COMMENT ON COLUMN app.cost.from_ts IS 'Validity start date';
COMMENT ON COLUMN app.cost.to_ts IS 'Validity end date';
