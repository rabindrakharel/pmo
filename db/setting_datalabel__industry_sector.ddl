-- ============================================================================
-- VIII. INDUSTRY SECTOR SETTINGS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Categorizes clients by industry sector to enable sector-specific service
--   offerings, pricing strategies, and marketing campaigns. Allows for industry
--   trend analysis, specialized service packages, and targeted business development.
--
-- Business Context:
--   Huron Home Services serves multiple market segments with different needs,
--   compliance requirements, and service expectations. Industry sector classification
--   enables tailored approaches for each market vertical.
--
-- Key Sectors for Home Services:
--   - Residential: Homeowners, individual properties, HOAs
--   - Commercial Real Estate: Office buildings, retail, shopping centers
--   - Healthcare: Hospitals, clinics, senior living facilities
--   - Education: Schools, universities, daycare centers
--   - Hospitality: Hotels, resorts, conference centers
--   - Municipal/Government: City properties, parks, public facilities
--   - Industrial: Manufacturing, warehouses, distribution centers
--   - Property Management: Multi-unit residential, commercial property managers
--
-- Integration Points:
--   - d_client table uses industry_sector_id for client categorization
--   - Pricing models may vary by industry sector
--   - Service packages customized per industry requirements
--   - Compliance and certification tracking by sector
--   - Marketing segmentation and campaign targeting
--
-- UI/UX Usage:
--   - Dropdown selector in client forms
--   - Filter option in client lists and reports
--   - Industry-specific dashboard views
--   - Sector performance analytics
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_industry_sector (
    level_id integer PRIMARY KEY,
    name varchar(50) NOT NULL UNIQUE,
    descr text,
    sort_order integer,
    active_flag boolean DEFAULT true,
    created_ts timestamptz DEFAULT now()
);

-- ============================================================================
-- DATA CURATION:
-- ============================================================================

-- Industry sectors served by Huron Home Services
-- Comprehensive categorization for Canadian home services market

INSERT INTO app.setting_datalabel_industry_sector (level_id, name, descr, sort_order, active_flag) VALUES
(0, 'Residential', 'Individual homeowners, single-family homes, townhouses, and residential condominiums.', 0, true),
(1, 'Commercial Real Estate', 'Office buildings, retail centers, shopping malls, and mixed-use commercial properties.', 1, true),
(2, 'Healthcare', 'Hospitals, medical clinics, senior living facilities, assisted living, and long-term care homes.', 2, true),
(3, 'Education', 'Schools, universities, colleges, daycare centers, and educational institutions.', 3, true),
(4, 'Hospitality', 'Hotels, resorts, conference centers, restaurants, and tourism facilities.', 4, true),
(5, 'Municipal/Government', 'City properties, public parks, government buildings, and municipal facilities.', 5, true),
(6, 'Industrial', 'Manufacturing facilities, warehouses, distribution centers, and industrial parks.', 6, true),
(7, 'Property Management', 'Multi-unit residential management companies, commercial property management firms.', 7, true),
(8, 'Religious', 'Churches, temples, mosques, synagogues, and other religious facilities.', 8, true),
(9, 'Non-Profit', 'Charitable organizations, community centers, and non-profit facilities.', 9, true),
(10, 'Automotive', 'Car dealerships, automotive service centers, and parking facilities.', 10, true),
(11, 'Financial Services', 'Banks, credit unions, insurance offices, and financial institutions.', 11, true);
