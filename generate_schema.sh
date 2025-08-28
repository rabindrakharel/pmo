#!/bin/bash

# PMO Database Schema Generator
# Consolidates all .ddl files into schema.sql with proper dependencies

OUTPUT_FILE="db/schema.sql"

echo "-- ============================================================================"
echo "-- PMO Database Schema - Complete Unified Schema"
echo "-- Generated from all .ddl files in dependency order with curated data"
echo "-- Updated with authentication fields and consistent naming"
echo "-- ============================================================================"
echo ""

# Define DDL files in dependency order
DDL_FILES=(
    "db/00_extensions.ddl"
    "db/00_app.ddl"
    "db/01_meta.ddl"
    "db/02_location.ddl"
    "db/03_worksite.ddl"
    "db/04_business.ddl"
    "db/05_hr.ddl"
    "db/06_employee.ddl"
    "db/07_role.ddl"
    "db/08_client.ddl"
    "db/09_project.ddl"
    "db/10_task.ddl"
    "db/11_forms.ddl"
    "db/12_app_tables.ddl"
    "db/13_unified_scope.ddl"
    "db/14_permission_tables.ddl"
    "db/15_app_data.ddl"
    "db/16_route_component_permissions.ddl"
)

# Start fresh
> "$OUTPUT_FILE"

{
    echo "-- ============================================================================"
    echo "-- PMO Database Schema - Complete Unified Schema"
    echo "-- Generated from all .ddl files in dependency order with curated data"
    echo "-- Updated with authentication fields and consistent naming"
    echo "-- ============================================================================"
    echo ""
    
    # Process each DDL file
    for ddl_file in "${DDL_FILES[@]}"; do
        if [ -f "$ddl_file" ]; then
            echo "-- ============================================================================"
            echo "-- $(basename "$ddl_file" .ddl | tr '[:lower:]' '[:upper:]')"
            echo "-- ============================================================================"
            echo ""
            
            # Add file content, removing any existing headers
            sed '/^-- =*$/,/^-- =*$/d' "$ddl_file" | sed '/^$/N;/^\n$/d'
            
            echo ""
        else
            echo "Warning: File $ddl_file not found" >&2
        fi
    done
    
    # Add data curation sections
    echo "-- ============================================================================"
    echo "-- DATA CURATION - Employee Authentication Data"
    echo "-- ============================================================================"
    echo ""
    
    echo "INSERT INTO app.d_emp (name, \"descr\", addr, email, password_hash, tags) VALUES"
    echo "('John Smith', 'Senior Project Manager - Infrastructure', '123 Richmond St, London, ON N6A 3K7', 'john.smith@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),"
    echo "('Jane Doe', 'Principal Frontend Developer', '456 King St W, Toronto, ON M5V 1M3', 'jane.doe@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),"
    echo "('Bob Wilson', 'DevOps Engineer', '789 Dundas St, London, ON N6A 1H3', 'bob.wilson@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),"
    echo "('Alice Johnson', 'UX Designer', '321 Bay St, Toronto, ON M5H 2R2', 'alice.johnson@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),"
    echo "('Mike Chen', 'Backend Engineer', '654 Yonge St, Toronto, ON M4Y 2A6', 'mike.chen@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb),"
    echo "('Sarah Lee', 'QA Engineer', '987 Adelaide St W, Toronto, ON M6J 2S8', 'sarah.lee@techcorp.com', '\$2b\$10\$rQJZa.HZjH9YbC9K4kW5UeL/gHu.dEb8lqXk0yE7XnL8V.QwK8P5e', '[]'::jsonb);"
    echo ""
    
} > "$OUTPUT_FILE"

echo "Schema generated successfully: $OUTPUT_FILE"