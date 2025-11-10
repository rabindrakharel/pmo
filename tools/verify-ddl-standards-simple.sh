#!/bin/bash
# Simple DDL Standards Verification

DB_PATH="/home/user/pmo/db"
TOTAL_FILES=0
COMPLIANT=0
NON_COMPLIANT=0

echo "🔍 DDL STANDARDS VERIFICATION"
echo "=============================="
echo ""

for file in "$DB_PATH"/*.ddl; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        violations=0

        # Check for required sections
        grep -q "^-- SEMANTICS:" "$file" || ((violations++))
        grep -q "^-- OPERATIONS:" "$file" || ((violations++))
        grep -q "^-- KEY FIELDS:" "$file" || ((violations++))
        grep -q "^-- RELATIONSHIPS" "$file" || ((violations++))
        grep -q "^-- DATA CURATION" "$file" || ((violations++))

        # Check standard columns
        grep -q "id uuid PRIMARY KEY" "$file" || ((violations++))
        grep -q "metadata jsonb" "$file" || ((violations++))
        grep -q "active_flag boolean" "$file" || ((violations++))

        # Check temporal columns
        grep -q "from_ts timestamptz" "$file" || ((violations++))
        grep -q "created_ts timestamptz" "$file" || ((violations++))
        grep -q "version integer" "$file" || ((violations++))

        ((TOTAL_FILES++))

        if [ $violations -eq 0 ]; then
            echo "✅ $filename - COMPLIANT"
            ((COMPLIANT++))
        else
            echo "❌ $filename - $violations violations"
            ((NON_COMPLIANT++))
        fi
    fi
done

echo ""
echo "=============================="
echo "SUMMARY"
echo "=============================="
echo "Total Files: $TOTAL_FILES"
echo "Compliant: $COMPLIANT"
echo "Non-Compliant: $NON_COMPLIANT"
echo ""

COMPLIANCE_PCT=$((COMPLIANT * 100 / TOTAL_FILES))
echo "Compliance Rate: ${COMPLIANCE_PCT}%"
