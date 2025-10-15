-- ============================================================================
-- VI. CUSTOMER TIER SETTINGS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Defines customer tier levels for client segmentation and service differentiation.
--   Enables tailored pricing, service levels, priority handling, and account management
--   based on customer value and engagement level. Critical for revenue optimization
--   and customer relationship management strategies.
--
-- Business Context:
--   Huron Home Services categorizes clients into tiers to provide appropriate service
--   levels, prioritization, and pricing structures. This tiering system allows for
--   resource allocation optimization and ensures high-value clients receive premium
--   attention while maintaining profitability across all customer segments.
--
-- Customer Tiers:
--   - Standard: Base-level residential and small commercial clients
--   - Plus: Mid-tier clients with enhanced service needs or recurring contracts
--   - Premium: High-value clients requiring white-glove service and priority scheduling
--   - Enterprise: Large commercial, institutional, or multi-site clients
--   - Government: Municipal, provincial, and federal government entities
--   - Strategic: Key accounts with strategic importance or partnership value
--
-- Integration Points:
--   - d_client table uses customer_tier_id for client categorization
--   - Pricing and quoting systems apply tier-specific rates
--   - Service scheduling prioritizes based on tier level
--   - Account management assigns resources by tier
--   - Customer success metrics tracked by tier
--
-- UI/UX Usage:
--   - Dropdown selector in client forms
--   - Filter option in client lists and reports
--   - Dashboard segmentation by tier
--   - Service level analytics and reporting
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_customer_tier (
    level_id integer PRIMARY KEY,
    level_name varchar(50) NOT NULL UNIQUE,
    level_descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Customer tier levels for Huron Home Services
-- Comprehensive segmentation for service differentiation and resource allocation

INSERT INTO app.setting_datalabel_customer_tier (level_id, level_name, level_descr, sort_order, active_flag) VALUES
(0, 'Standard', 'Base-level service tier for residential clients and small businesses. Standard pricing, regular scheduling windows, email/phone support.', 0, true),
(1, 'Plus', 'Enhanced service tier for recurring clients with seasonal contracts. Priority scheduling, dedicated support line, loyalty discounts.', 1, true),
(2, 'Premium', 'High-value clients requiring white-glove service and priority handling. Same-day response, account manager, premium pricing with concierge service.', 2, true),
(3, 'Enterprise', 'Large commercial accounts including retail centers, office complexes, and multi-site facilities. Customized SLAs, dedicated account team, bulk pricing.', 3, true),
(4, 'Government', 'Municipal, provincial, and federal government entities with procurement compliance requirements. Contract-based pricing, regulatory compliance, public sector protocols.', 4, true),
(5, 'Strategic', 'Key accounts with strategic partnership value including referral sources, media visibility, or market expansion opportunities. Customized engagement and collaborative planning.', 5, true);
