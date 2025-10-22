# Curated Data Integration Guide

## Overview

This guide explains how to integrate the comprehensive curated data into your PMO Enterprise Platform database. The curated data includes:

- **500+ Employees** with realistic Canadian names, addresses, and role assignments
- **50+ Inventory Items** with realistic stock levels across multiple locations
- **100+ Invoices** with multiple line items and various payment statuses
- **50+ Artifacts** including documents, images, videos, and templates

## Generated Files

### 1. Employee Data
**File:** `db/11_d_employee_CURATED_FULL.sql`

**Contents:**
- 500 employees (EMP-0026 through EMP-0525)
- Diverse Canadian names (English, French, Asian, European)
- Realistic Canadian addresses across 7 provinces
- Complete contact information
- Hierarchical manager assignments
- Role assignments via entity mapping
- Registration in d_entity_instance_id table

**Key Features:**
- Employees 26-100: Field technicians and operations staff
- Employees 101-200: Skilled technicians across departments
- Employees 201-350: Full-time staff across all departments
- Employees 351-450: Part-time support staff
- Employees 451-525: Seasonal workers

### 2. Inventory Data
**File:** `db/f_inventory_CURATED.sql`

**Contents:**
- Inventory records for all 20 products
- Multiple store locations
- Realistic stock quantities based on product type
- Low stock, high stock, and out-of-stock scenarios
- Complete tracking information

**Key Features:**
- Lumber: 200-1000 units per location
- Electrical devices: 100-600 units
- HVAC equipment: 1-9 units
- Paint: 50-250 gallons
- Flooring: 500-3000 sqft

### 3. Invoice Data
**File:** `db/f_invoice_CURATED.sql`

**Contents:**
- 100+ invoices spanning last 6 months
- 2-5 line items per invoice
- Mix of product and labor charges
- Various payment statuses (paid, unpaid, partial, overdue)
- Realistic pricing and tax calculations

**Key Features:**
- Invoice numbers: INV-2025-00001 through INV-2025-00100+
- Payment statuses based on invoice age
- HST tax calculations (13% for Ontario)
- Realistic product quantities and pricing
- Labor charges ($65-$150/hr)

### 4. Artifact Data
**File:** `db/21_d_artifact_CURATED.sql`

**Contents:**
- 50+ artifacts of various types
- Documents, templates, images, videos, spreadsheets, presentations
- Different file formats and sizes
- Various visibility and security levels
- Linked to projects, tasks, offices, and businesses

**Key Features:**
- Safety and compliance documents
- Marketing and sales materials
- Technical documentation
- Training videos
- Version control examples

## Integration Methods

### Method 1: Manual Integration (Recommended for Review)

1. **Review the generated SQL files:**
   ```bash
   cd /home/rabin/projects/pmo/db
   cat 11_d_employee_CURATED_FULL.sql
   cat f_inventory_CURATED.sql
   cat f_invoice_CURATED.sql
   cat 21_d_artifact_CURATED.sql
   ```

2. **Execute each file separately:**
   ```bash
   # Employee data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f 11_d_employee_CURATED_FULL.sql

   # Inventory data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f f_inventory_CURATED.sql

   # Invoice data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f f_invoice_CURATED.sql

   # Artifact data
   PGPASSWORD=app psql -h localhost -p 5434 -U app -d app -f 21_d_artifact_CURATED.sql
   ```

### Method 2: Direct Append to DDL Files

**For permanent integration:**

1. **Append employee data to 11_d_employee.ddl:**
   ```bash
   cd /home/rabin/projects/pmo/db
   cat 11_d_employee_CURATED_FULL.sql >> 11_d_employee.ddl
   ```

2. **Append inventory data to f_inventory.ddl:**
   ```bash
   cat f_inventory_CURATED.sql >> f_inventory.ddl
   ```

3. **Append invoice data to f_invoice.ddl:**
   ```bash
   cat f_invoice_CURATED.sql >> f_invoice.ddl
   ```

4. **Append artifact data to 21_d_artifact.ddl:**
   ```bash
   cat 21_d_artifact_CURATED.sql >> 21_d_artifact.ddl
   ```

5. **Re-import the database:**
   ```bash
   ./tools/db-import.sh
   ```

### Method 3: Automated Import Script

Create a single script to import all curated data:

```bash
#!/bin/bash
# File: tools/import-curated-data.sh

set -e

echo "Importing curated data..."

# Database connection
DB_HOST="localhost"
DB_PORT="5434"
DB_USER="app"
DB_PASSWORD="app"
DB_NAME="app"

export PGPASSWORD=$DB_PASSWORD

echo "1. Importing employee data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/11_d_employee_CURATED_FULL.sql

echo "2. Importing inventory data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/f_inventory_CURATED.sql

echo "3. Importing invoice data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/f_invoice_CURATED.sql

echo "4. Importing artifact data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f db/21_d_artifact_CURATED.sql

echo "Curated data import complete!"
echo ""
echo "Summary:"
echo "- Employees: 500+"
echo "- Inventory items: 50+"
echo "- Invoices: 100+"
echo "- Artifacts: 50+"
```

Make it executable:
```bash
chmod +x tools/import-curated-data.sh
./tools/import-curated-data.sh
```

## Verification

### After importing, verify the data:

```sql
-- Check employee count
SELECT COUNT(*) as employee_count FROM app.d_employee WHERE active_flag = true;
-- Expected: 525+ employees

-- Check employee distribution by department
SELECT department, COUNT(*) as count
FROM app.d_employee
WHERE active_flag = true
GROUP BY department
ORDER BY count DESC;

-- Check inventory items
SELECT COUNT(*) as inventory_items FROM app.f_inventory WHERE active_flag = true;
-- Expected: 50+ items

-- Check inventory by product category
SELECT p.department, COUNT(*) as item_count, SUM(i.qty) as total_units
FROM app.f_inventory i
INNER JOIN app.d_product p ON p.id = i.product_id
WHERE i.active_flag = true
GROUP BY p.department;

-- Check invoice count
SELECT COUNT(DISTINCT invoice_number) as invoice_count FROM app.f_invoice;
-- Expected: 100+ invoices

-- Check invoice line items
SELECT COUNT(*) as line_items FROM app.f_invoice;
-- Expected: 300+ line items

-- Check artifacts
SELECT COUNT(*) as artifact_count FROM app.d_artifact WHERE active_flag = true;
-- Expected: 70+ artifacts

-- Check artifact types
SELECT artifact_type, COUNT(*) as count
FROM app.d_artifact
WHERE active_flag = true
GROUP BY artifact_type
ORDER BY count DESC;
```

## Data Characteristics

### Employee Data
- **Names:** Diverse mix of English, French, Asian, European, and South Asian names
- **Addresses:** Canadian addresses across Ontario, BC, Alberta, Quebec, Manitoba, Nova Scotia, Saskatchewan
- **Postal Codes:** Realistic Canadian format (A1A 1A1)
- **Phone Numbers:** Canadian format (+1-XXX-555-XXXX)
- **Email:** Pattern: firstname.lastnameNNN@huronhome.ca
- **Hire Dates:** Distributed between 2021-2024
- **Employee Types:** Full-time (70%), Part-time (20%), Seasonal (10%)

### Inventory Data
- **Realistic Quantities:** Based on product type and typical usage
- **Multiple Scenarios:** Low stock, high stock, out of stock
- **Store Locations:** Distributed across multiple offices/warehouses
- **Tracking:** Created by and last modified by fields populated

### Invoice Data
- **Time Distribution:** Last 6 months
- **Payment Status:** Mix of paid (40%), unpaid (35%), partial (25%)
- **Line Items:** 2-5 per invoice
- **Product Mix:** 80% products, 20% labor
- **Tax:** HST 13% (Ontario)
- **Margins:** 30-45% typical

### Artifact Data
- **Types:** Documents (35%), Templates (20%), Images (20%), Videos (15%), Spreadsheets (5%), Presentations (5%)
- **Visibility:** Public (25%), Internal (50%), Restricted (15%), Private (10%)
- **Security:** General (60%), Confidential (30%), Restricted (10%)
- **File Sizes:** Realistic based on type (Documents: 50KB-1MB, Images: 500KB-10MB, Videos: 10MB-500MB)
- **Entity Links:** Linked to projects, tasks, offices, and businesses

## Role Assignments

Employees are automatically assigned to roles based on their titles:

| Title Pattern | Assigned Role |
|---------------|---------------|
| CEO | Chief Executive Officer |
| CFO | Chief Financial Officer |
| CTO | Chief Technology Officer |
| COO | Chief Operating Officer |
| Senior Vice President | Senior Vice President |
| Vice President (HR) | Vice President Human Resources |
| Director (Finance) | Director of Finance |
| Director (IT) | Director of Information Technology |
| Manager (Landscaping) | Landscaping Manager |
| Manager (Snow Removal) | Snow Removal Manager |
| Manager (HVAC) | HVAC Manager |
| Manager (Plumbing) | Plumbing Manager |
| Manager (Solar Energy) | Solar Energy Manager |
| Field Supervisor | Field Supervisor |
| Senior Technician | Senior Technician |
| Field Technician | Field Technician |
| Project Coordinator | Project Coordinator |
| Financial Analyst | Financial Analyst |
| HR Coordinator | HR Coordinator |
| IT Administrator | IT Administrator |
| Seasonal Worker | Seasonal Worker |
| Part-time Support | Part-time Support |

## Entity Registrations

All curated data is automatically registered in the appropriate entity tables:

1. **d_entity_instance_id:** All employees, artifacts registered
2. **d_entity_id_map:** Employee-role relationships, artifact-parent entity relationships
3. **entity_id_rbac_map:** Permissions inherited from role assignments (via existing RBAC data)

## Troubleshooting

### Issue: Duplicate employee emails
**Solution:** The script generates unique emails using incremental numbers (firstname.lastnameNNN@huronhome.ca)

### Issue: Missing store IDs for inventory
**Solution:** The script creates a default warehouse if no stores exist

### Issue: Missing products for invoices
**Solution:** Ensure d_product table is populated before running invoice script

### Issue: Missing entities for artifacts
**Solution:** Ensure projects, tasks, offices, and businesses exist before running artifact script

## Performance Considerations

- **Import Time:** Each script takes 10-30 seconds to complete
- **Total Data Size:** Approximately 50-100MB
- **Indexes:** All necessary indexes are already defined in the DDL files
- **Triggers:** Database triggers automatically calculate invoice totals and inventory updates

## Next Steps

After importing the curated data:

1. **Test the API:**
   ```bash
   ./tools/test-api.sh GET /api/v1/employee
   ./tools/test-api.sh GET /api/v1/inventory
   ./tools/test-api.sh GET /api/v1/invoice
   ./tools/test-api.sh GET /api/v1/artifact
   ```

2. **Test the Web UI:**
   - Navigate to http://localhost:5173
   - Log in as james.miller@huronhome.ca / password123
   - Browse employees, inventory, invoices, and artifacts

3. **Verify RBAC:**
   ```sql
   -- Check role assignments
   SELECT r.name, COUNT(*) as employee_count
   FROM app.d_entity_id_map eim
   INNER JOIN app.d_role r ON r.id::text = eim.parent_entity_id
   WHERE eim.parent_entity_type = 'role'
     AND eim.child_entity_type = 'employee'
   GROUP BY r.name
   ORDER BY employee_count DESC;
   ```

4. **Run Reports:**
   - Revenue by product category
   - Inventory levels by location
   - Employee distribution by department
   - Artifact usage statistics

## Maintenance

### Refreshing Curated Data

To refresh the curated data (remove and re-import):

```sql
-- Remove curated employees (keep original 5)
DELETE FROM app.d_employee WHERE code LIKE 'EMP-%' AND code::text >= 'EMP-0026';

-- Remove curated inventory
TRUNCATE app.f_inventory CASCADE;

-- Remove curated invoices
TRUNCATE app.f_invoice CASCADE;

-- Remove curated artifacts (keep original 7)
DELETE FROM app.d_artifact WHERE code LIKE 'ART-2025-%' OR code LIKE 'ART-SAFE-%' OR code LIKE 'ART-MKT-%' OR code LIKE 'ART-TECH-%' OR code LIKE 'ART-VID-%';
```

Then re-run the import scripts.

## Support

For issues or questions:
1. Check the verification queries above
2. Review the SQL files for detailed comments
3. Consult the main README.md and db/README.md
4. Check database logs: `./tools/logs-api.sh`

## Summary

This curated data provides a comprehensive, realistic dataset for:
- Development and testing
- Demonstrations and presentations
- Performance testing and optimization
- Training and onboarding
- Feature development and validation

All data follows Canadian standards and PMO platform conventions, ensuring consistency with the existing system architecture.
