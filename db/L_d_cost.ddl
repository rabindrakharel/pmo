-- =====================================================
-- Cost Table
-- Tracks project and task-level costs with attachments
-- =====================================================

CREATE TABLE IF NOT EXISTS app.d_cost (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) UNIQUE NOT NULL,
  code varchar(50) UNIQUE NOT NULL,
  cost_code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  descr text,
  tags text[],
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
  BEFORE UPDATE ON app.d_cost
  FOR EACH ROW
  EXECUTE FUNCTION app.update_updated_ts();

-- Indexes for performance
CREATE INDEX idx_cost_active ON app.d_cost(active_flag) WHERE active_flag = true;
CREATE INDEX idx_cost_code ON app.d_cost(cost_code);
CREATE INDEX idx_cost_slug ON app.d_cost(slug);
CREATE INDEX idx_cost_currency ON app.d_cost(invoice_currency);
CREATE INDEX idx_cost_validity ON app.d_cost(from_ts, to_ts) WHERE from_ts IS NOT NULL;
CREATE INDEX idx_cost_tags ON app.d_cost USING gin(tags);

-- Comments
COMMENT ON TABLE app.d_cost IS 'Project and task-level cost tracking with attachment support';
COMMENT ON COLUMN app.d_cost.cost_amt_lcl IS 'Cost amount in local currency (CAD)';
COMMENT ON COLUMN app.d_cost.cost_amt_invoice IS 'Cost amount as per invoice (if different currency)';
COMMENT ON COLUMN app.d_cost.exch_rate IS 'Exchange rate applied for currency conversion';
COMMENT ON COLUMN app.d_cost.cust_budgeted_amt_lcl IS 'Customer budgeted amount in local currency';
COMMENT ON COLUMN app.d_cost.from_ts IS 'Validity start date';
COMMENT ON COLUMN app.d_cost.to_ts IS 'Validity end date';
