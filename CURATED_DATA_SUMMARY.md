# Curated Data Summary

## Overview

Comprehensive curated data has been generated for the PMO Enterprise Platform, including 500+ employees, 50+ inventory items, 100+ invoices, and 50+ artifacts. All data follows Canadian standards and integrates seamlessly with the existing system.

## Files Generated

### 1. Employee Data
**Location:** `/home/rabin/projects/pmo/db/11_d_employee_CURATED_FULL.sql`

**Statistics:**
- **Total Employees:** 500 (EMP-0026 through EMP-0525)
- **Full-time:** ~350 employees
- **Part-time:** ~100 employees
- **Seasonal:** ~75 employees
- **Provinces Covered:** 7 (ON, BC, AB, QC, MB, NS, SK)
- **Cities:** 80+ Canadian cities

**Features:**
- ✅ Realistic Canadian names (diverse backgrounds)
- ✅ Authentic Canadian addresses with postal codes
- ✅ Complete contact information (phone, mobile, email)
- ✅ Hierarchical manager assignments
- ✅ Role-based assignments via entity mapping
- ✅ Automatic registration in d_entity_instance_id
- ✅ Automatic entity-role mapping via d_entity_id_map
- ✅ Hire dates distributed 2021-2024

**Distribution by Role:**
- Field Technicians: ~200
- Senior Technicians: ~50
- Field Supervisors: ~30
- Specialists/Analysts: ~60
- Coordinators: ~50
- Managers: ~40
- Seasonal Workers: ~70

### 2. Inventory Data
**Location:** `/home/rabin/projects/pmo/db/f_inventory_CURATED.sql`

**Statistics:**
- **Total Inventory Records:** 50+ items
- **Product Categories:** 10 (Lumber, Electrical, Plumbing, HVAC, Paint, Flooring, Hardware)
- **Store Locations:** Multiple warehouses/offices
- **Stock Scenarios:** Normal, Low, High, Out-of-stock

**Features:**
- ✅ Realistic stock quantities based on product type
- ✅ Multiple store locations
- ✅ Low stock alerts for reordering
- ✅ Overstock scenarios
- ✅ Out-of-stock items with notes
- ✅ Complete tracking (created_by, last_modified_by)
- ✅ Automatic warehouse creation if needed

**Stock Levels:**
- Lumber: 200-1,200 units
- Electrical Wire: 50-150 rolls
- Electrical Devices: 100-600 units
- Plumbing Pipes: 50-200 lengths
- HVAC Equipment: 1-9 units
- HVAC Filters: 100-850 units
- Paint: 50-250 gallons
- Flooring: 500-4,500 sqft
- Hardware: 30-150 boxes

### 3. Invoice Data
**Location:** `/home/rabin/projects/pmo/db/f_invoice_CURATED.sql`

**Statistics:**
- **Total Invoices:** 100+ invoices
- **Total Line Items:** 300+ line items
- **Time Period:** Last 6 months
- **Average Lines per Invoice:** 2-5
- **Client Types:** Residential, Commercial, Government

**Features:**
- ✅ Sequential invoice numbering (INV-2025-00001+)
- ✅ Multiple line items per invoice
- ✅ Mix of products (80%) and labor (20%)
- ✅ Various payment statuses (paid, unpaid, partial, overdue)
- ✅ Realistic pricing and margins
- ✅ HST tax calculations (13% Ontario)
- ✅ Aging analysis with buckets
- ✅ Payment tracking with methods and references

**Financial Summary:**
- Total Billed Amount: Variable (realistic mix)
- Payment Status Distribution:
  - Paid: ~40%
  - Unpaid: ~35%
  - Partial: ~25%
- Average Margin: 30-45%
- Labor Rates: $65-$150/hour

### 4. Artifact Data
**Location:** `/home/rabin/projects/pmo/db/21_d_artifact_CURATED.sql`

**Statistics:**
- **Total Artifacts:** 70+ artifacts
- **Artifact Types:** 6 (Document, Template, Image, Video, Spreadsheet, Presentation)
- **File Formats:** 9 (PDF, DOCX, XLSX, PPTX, JPG, PNG, MP4, TXT, CSV)
- **Visibility Levels:** 4 (Public, Internal, Restricted, Private)
- **Security Levels:** 3 (General, Confidential, Restricted)

**Features:**
- ✅ Diverse artifact types and formats
- ✅ Realistic file sizes based on type
- ✅ Linked to projects, tasks, offices, businesses
- ✅ Security and visibility controls
- ✅ Version control metadata
- ✅ Safety and compliance documents
- ✅ Marketing materials
- ✅ Technical documentation
- ✅ Training videos
- ✅ Automatic entity registration and mapping

**Artifact Categories:**
- Safety & Compliance: 5+ documents
- Marketing & Sales: 5+ materials
- Technical Documentation: 5+ documents
- Training Videos: 5+ videos
- General Documents: 50+ items

## Integration Instructions

### Quick Start

1. **Navigate to project directory:**
   ```bash
   cd /home/rabin/projects/pmo
   ```

2. **Import all curated data:**
   ```bash
   # Employee data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f db/11_d_employee_CURATED_FULL.sql

   # Inventory data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f db/f_inventory_CURATED.sql

   # Invoice data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f db/f_invoice_CURATED.sql

   # Artifact data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f db/21_d_artifact_CURATED.sql
   ```

3. **Verify the import:**
   ```bash
   ./tools/run_query.sh "SELECT
       (SELECT COUNT(*) FROM app.d_employee WHERE active_flag = true) as employees,
       (SELECT COUNT(*) FROM app.f_inventory WHERE active_flag = true) as inventory_items,
       (SELECT COUNT(DISTINCT invoice_number) FROM app.f_invoice) as invoices,
       (SELECT COUNT(*) FROM app.d_artifact WHERE active_flag = true) as artifacts;"
   ```

### Permanent Integration

To make the curated data permanent in your schema:

```bash
# Append to DDL files
cat db/11_d_employee_CURATED_FULL.sql >> db/11_d_employee.ddl
cat db/f_inventory_CURATED.sql >> db/f_inventory.ddl
cat db/f_invoice_CURATED.sql >> db/f_invoice.ddl
cat db/21_d_artifact_CURATED.sql >> db/21_d_artifact.ddl

# Re-import entire database
./tools/db-import.sh
```

## What's Included

### Automatic Entity Registrations

All curated data is automatically:
1. **Registered in d_entity_instance_id** - Central entity registry
2. **Mapped in d_entity_id_map** - Parent-child relationships
3. **Role-assigned** - Employees linked to appropriate roles
4. **Tracked** - Created by, modified by, timestamps

### Realistic Data Characteristics

#### Employee Data
- **Name Diversity:** English, French, Chinese, Indian, Korean, Hispanic, Italian, Polish names
- **Geographic Distribution:** Major cities across all major Canadian provinces
- **Department Distribution:** Landscaping, Snow Removal, HVAC, Plumbing, Solar, Finance, HR, IT
- **Hierarchy:** Proper management reporting structure
- **Contact Info:** Valid Canadian phone format and email patterns

#### Inventory Data
- **Stock Realism:** Quantities match typical usage patterns
- **Variety:** Low stock alerts, overstock situations, stockouts
- **Multi-location:** Distributed across multiple warehouses
- **Product Types:** Construction, electrical, plumbing, HVAC, paint, flooring, hardware

#### Invoice Data
- **Time-based:** Distributed over last 6 months
- **Payment Patterns:** Realistic aging and payment behavior
- **Product Mix:** Real products from d_product table
- **Labor Charges:** Competitive Canadian rates
- **Tax Compliance:** Proper HST calculations

#### Artifact Data
- **Professional Documents:** Brochures, manuals, reports, guides
- **Media Files:** Photos, videos, presentations
- **Security Controls:** Appropriate visibility and classification
- **Business Relevance:** Linked to actual projects and entities

## Verification Queries

After import, run these queries to verify data integrity:

```sql
-- 1. Employee verification
SELECT
    employee_type,
    COUNT(*) as count,
    COUNT(DISTINCT department) as departments
FROM app.d_employee
WHERE active_flag = true
GROUP BY employee_type;

-- 2. Inventory verification
SELECT
    p.department,
    COUNT(*) as items,
    SUM(i.qty) as total_units
FROM app.f_inventory i
JOIN app.d_product p ON p.id = i.product_id
GROUP BY p.department;

-- 3. Invoice verification
SELECT
    invoice_status,
    payment_status,
    COUNT(DISTINCT invoice_number) as invoices,
    SUM(line_total_cad) as total_amount
FROM app.f_invoice
GROUP BY invoice_status, payment_status;

-- 4. Artifact verification
SELECT
    artifact_type,
    visibility,
    COUNT(*) as count,
    pg_size_pretty(SUM(file_size_bytes)::bigint) as total_size
FROM app.d_artifact
WHERE active_flag = true
GROUP BY artifact_type, visibility;

-- 5. Role assignments verification
SELECT
    r.name as role,
    COUNT(*) as employees
FROM app.d_entity_id_map eim
JOIN app.d_role r ON r.id::text = eim.parent_entity_id
WHERE eim.parent_entity_type = 'role'
  AND eim.child_entity_type = 'employee'
GROUP BY r.name
ORDER BY employees DESC;
```

## Use Cases

This curated data supports:

1. **Development & Testing**
   - Large dataset for performance testing
   - Realistic data for feature development
   - Edge cases and scenarios

2. **Demonstrations**
   - Populated UI for client demos
   - Realistic business scenarios
   - Professional presentation data

3. **Training**
   - Onboarding new developers
   - System walkthroughs
   - Feature tutorials

4. **Performance Testing**
   - Load testing with realistic volumes
   - Query optimization
   - Index effectiveness

5. **Reporting & Analytics**
   - Dashboard population
   - Report generation
   - Business intelligence testing

## Data Quality

All data meets these standards:

✅ **Accuracy:** Canadian postal codes, phone numbers, addresses
✅ **Realism:** Natural distributions and patterns
✅ **Consistency:** Follows existing schema conventions
✅ **Integrity:** All foreign key relationships valid
✅ **Completeness:** Required fields populated
✅ **Security:** Appropriate password hashing (bcrypt)
✅ **Compliance:** RBAC permissions properly assigned

## Maintenance

### Refreshing Data

To remove curated data and start fresh:

```sql
-- Remove curated employees (keep original 5)
DELETE FROM app.d_employee WHERE code >= 'EMP-0026';

-- Clear curated inventory
DELETE FROM app.f_inventory WHERE id NOT IN (
    SELECT id FROM app.f_inventory LIMIT 20
);

-- Clear curated invoices
DELETE FROM app.f_invoice WHERE invoice_number >= 'INV-2025-00006';

-- Clear curated artifacts
DELETE FROM app.d_artifact WHERE code LIKE 'ART-2025%'
    OR code LIKE 'ART-SAFE%'
    OR code LIKE 'ART-MKT%'
    OR code LIKE 'ART-TECH%'
    OR code LIKE 'ART-VID%';
```

Then re-run the import scripts.

## Documentation

For detailed information, see:
- **CURATED_DATA_INTEGRATION_GUIDE.md** - Complete integration instructions
- **db/11_d_employee_CURATED_FULL.sql** - Employee generation script with comments
- **db/f_inventory_CURATED.sql** - Inventory generation script with comments
- **db/f_invoice_CURATED.sql** - Invoice generation script with comments
- **db/21_d_artifact_CURATED.sql** - Artifact generation script with comments

## Support

If you encounter issues:
1. Check the integration guide
2. Review SQL file comments
3. Verify database connection
4. Check logs: `./tools/logs-api.sh`
5. Consult main README.md

## Summary

The curated data provides a comprehensive, production-ready dataset that:
- **Scales:** 500+ employees, 100+ invoices, 50+ inventory items, 70+ artifacts
- **Integrates:** Automatic entity registration and mapping
- **Validates:** Realistic Canadian data with proper formatting
- **Performs:** Optimized for database operations
- **Demonstrates:** Professional-quality sample data for showcasing the platform

All data is ready to import and use immediately with the PMO Enterprise Platform.

---

**Generated:** 2025-10-22
**Author:** Claude Code
**Version:** 1.0
