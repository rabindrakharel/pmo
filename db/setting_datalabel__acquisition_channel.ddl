-- ============================================================================
-- IX. ACQUISITION CHANNEL SETTINGS
-- ============================================================================

-- ============================================================================
-- SEMANTICS:
-- ============================================================================
--
-- Purpose:
--   Tracks how clients discovered or were acquired by the business. Essential
--   for marketing ROI analysis, channel performance measurement, and optimizing
--   customer acquisition strategies. Enables data-driven marketing decisions.
--
-- Business Context:
--   Understanding which marketing channels drive the most valuable clients allows
--   Huron Home Services to allocate marketing budget effectively and double down
--   on high-performing channels while optimizing or eliminating low-performers.
--
-- Acquisition Channels:
--   - Organic Search: Found via Google, Bing (SEO)
--   - Paid Search: Google Ads, Bing Ads (PPC)
--   - Social Media: Facebook, Instagram, LinkedIn organic
--   - Paid Social: Facebook Ads, Instagram Ads, LinkedIn Ads
--   - Referral: Word-of-mouth from existing clients
--   - Direct: Typed URL directly, bookmarked site
--   - Email Marketing: Newsletter, promotional campaigns
--   - Content Marketing: Blog posts, guides, resources
--   - Trade Shows: Industry events, home shows
--   - Traditional Media: TV, radio, print ads
--   - Partnership: Strategic partnerships, co-marketing
--   - Cold Outreach: Sales team cold calls/emails
--
-- Integration Points:
--   - d_client table uses acquisition_channel_id to track origin
--   - Marketing analytics and attribution reporting
--   - Customer Acquisition Cost (CAC) analysis by channel
--   - Lifetime Value (LTV) analysis segmented by acquisition source
--   - Channel performance dashboards
--
-- UI/UX Usage:
--   - Dropdown selector in client forms
--   - Required field for new client onboarding
--   - Marketing performance reports
--   - Attribution analytics dashboards
--

-- ============================================================================
-- DDL:
-- ============================================================================

CREATE TABLE app.setting_datalabel_acquisition_channel (
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

-- Acquisition channels for Huron Home Services
-- Comprehensive tracking of client acquisition sources

INSERT INTO app.setting_datalabel_acquisition_channel (level_id, level_name, level_descr, sort_order, active_flag) VALUES
(0, 'Organic Search', 'Found business through Google, Bing, or other search engines (SEO).', 0, true),
(1, 'Paid Search', 'Clicked on Google Ads, Bing Ads, or other paid search advertisements (PPC).', 1, true),
(2, 'Social Media Organic', 'Discovered via Facebook, Instagram, LinkedIn, or Twitter organic posts.', 2, true),
(3, 'Paid Social Media', 'Clicked on Facebook Ads, Instagram Ads, LinkedIn Ads, or other social media ads.', 3, true),
(4, 'Referral', 'Word-of-mouth recommendation from existing client, friend, or family member.', 4, true),
(5, 'Direct', 'Typed URL directly into browser or used bookmarked link. Brand recognition.', 5, true),
(6, 'Email Marketing', 'Newsletter, promotional email campaign, or email outreach.', 6, true),
(7, 'Content Marketing', 'Blog post, how-to guide, video tutorial, or other educational content.', 7, true),
(8, 'Trade Show/Event', 'Met at home show, industry event, trade show, or community fair.', 8, true),
(9, 'Traditional Media', 'Saw TV commercial, heard radio ad, or read print advertisement.', 9, true),
(10, 'Partnership', 'Strategic partnership, co-marketing arrangement, or affiliate referral.', 10, true),
(11, 'Cold Outreach', 'Sales team cold call, cold email, or door-to-door canvassing.', 11, true),
(12, 'Online Directory', 'Found on Yelp, Google My Business, HomeStars, or other business directory.', 12, true),
(13, 'Real Estate Agent', 'Referred by real estate agent, property manager, or realtor network.', 13, true),
(14, 'Municipal Contract', 'Awarded through RFP, public tender, or government procurement process.', 14, true),
(15, 'Previous Client', 'Returning client from previous engagement or service contract.', 15, true);
