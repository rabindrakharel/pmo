#!/usr/bin/env tsx

/**
 * DDL to API Consistency Analyzer
 *
 * This script analyzes all DDL files and compares them with:
 * 1. API route implementations
 * 2. MCP manifest entries
 *
 * It identifies:
 * - Tables without corresponding API routes
 * - API routes without corresponding DDL tables
 * - Missing CRUD operations
 * - Inconsistencies in field mappings
 */

import * as fs from 'fs';
import * as path from 'path';

interface TableInfo {
  ddlFile: string;
  tableName: string;
  schemaName: string;
  columns: Set<string>;
  hasApi: boolean;
  apiPath?: string;
  mcpEntries: string[];
  missingOperations: string[];
}

interface ApiInfo {
  moduleName: string;
  path: string;
  endpoints: Set<string>;
  hasDDL: boolean;
  ddlFile?: string;
}

const results: {
  tables: Map<string, TableInfo>;
  apis: Map<string, ApiInfo>;
  inconsistencies: string[];
} = {
  tables: new Map(),
  apis: new Map(),
  inconsistencies: [],
};

// Entity name mappings (DDL table name -> API route path)
const entityMappings: Record<string, string> = {
  'd_project': 'project',
  'd_task': 'task',
  'd_employee': 'employee',
  'd_cust': 'cust',
  'd_business': 'biz',
  'd_office': 'office',
  'd_role': 'role',
  'd_position': 'position',
  'd_worksite': 'worksite',
  'd_wiki': 'wiki',
  'd_form_head': 'form',
  'd_artifact': 'artifact',
  'd_reports': 'reports',
  'd_product': 'product',
  'd_service': 'service',
  'd_cost': 'cost',
  'd_revenue': 'revenue',
  'd_email_template': 'email-template',
  'f_customer_interaction': 'interaction',
  'f_inventory': 'inventory',
  'f_order': 'order',
  'f_invoice': 'invoice',
  'f_shipment': 'shipment',
  'fact_quote': 'quote',
  'fact_work_order': 'work_order',
  'd_workflow_automation': 'workflow-automation',
  'd_event': 'booking', // d_event maps to booking API
  'd_entity_person_calendar': 'person-calendar',
};

// Analyze DDL files
function analyzeDDLFiles() {
  const ddlDir = path.join(process.cwd(), 'db');
  const files = fs.readdirSync(ddlDir).filter(f => f.endsWith('.ddl'));

  console.log(`\n📊 Analyzing ${files.length} DDL files...\n`);

  for (const file of files) {
    const content = fs.readFileSync(path.join(ddlDir, file), 'utf-8');

    // Extract CREATE TABLE statements
    const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\.(\w+)\s*\(/gi);

    for (const match of tableMatches) {
      const schemaName = match[1];
      const tableName = match[2];

      // Extract columns
      const columns = new Set<string>();
      const columnMatches = content.matchAll(/^\s*(\w+)\s+(?:uuid|varchar|text|integer|boolean|decimal|date|timestamptz|jsonb|timestamp)/gim);
      for (const colMatch of columnMatches) {
        columns.add(colMatch[1]);
      }

      const apiRoute = entityMappings[tableName] || tableName.replace(/^d_|^f_|^fact_/, '');

      results.tables.set(tableName, {
        ddlFile: file,
        tableName,
        schemaName,
        columns,
        hasApi: false,
        apiPath: apiRoute,
        mcpEntries: [],
        missingOperations: [],
      });
    }
  }

  console.log(`✅ Found ${results.tables.size} tables in DDL files`);
}

// Analyze API routes
function analyzeAPIRoutes() {
  const apiDir = path.join(process.cwd(), 'apps/api/src/modules');

  if (!fs.existsSync(apiDir)) {
    console.error(`❌ API directory not found: ${apiDir}`);
    return;
  }

  const modules = fs.readdirSync(apiDir);

  console.log(`\n📊 Analyzing ${modules.length} API modules...\n`);

  for (const moduleName of modules) {
    const routesFile = path.join(apiDir, moduleName, 'routes.ts');

    if (!fs.existsSync(routesFile)) {
      continue;
    }

    const content = fs.readFileSync(routesFile, 'utf-8');

    // Extract endpoint registrations
    const endpoints = new Set<string>();

    // Match fastify.get, fastify.post, fastify.put, fastify.patch, fastify.delete
    const endpointMatches = content.matchAll(/fastify\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi);

    for (const match of endpointMatches) {
      const method = match[1].toUpperCase();
      const path = match[2];
      endpoints.add(`${method} ${path}`);
    }

    // Check if this API has a corresponding DDL table
    let hasDDL = false;
    let ddlFile: string | undefined;

    for (const [tableName, tableInfo] of results.tables.entries()) {
      if (tableInfo.apiPath === moduleName) {
        hasDDL = true;
        ddlFile = tableInfo.ddlFile;
        tableInfo.hasApi = true;
        break;
      }
    }

    results.apis.set(moduleName, {
      moduleName,
      path: routesFile,
      endpoints,
      hasDDL,
      ddlFile,
    });
  }

  console.log(`✅ Found ${results.apis.size} API modules`);
}

// Analyze MCP manifest
function analyzeMCPManifest() {
  const manifestPath = path.join(process.cwd(), 'apps/mcp-server/src/api-manifest.ts');

  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ MCP manifest not found: ${manifestPath}`);
    return;
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');

  console.log(`\n📊 Analyzing MCP manifest...\n`);

  // Extract API endpoints from manifest
  const endpointMatches = content.matchAll(/{\s*name:\s*['"`](\w+)['"`],\s*method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`],\s*path:\s*['"`]([^'"`]+)['"`]/gs);

  let count = 0;
  for (const match of endpointMatches) {
    const name = match[1];
    const method = match[2];
    const path = match[3];
    count++;

    // Try to match to a table
    for (const [tableName, tableInfo] of results.tables.entries()) {
      if (path.includes(`/api/v1/${tableInfo.apiPath}`)) {
        tableInfo.mcpEntries.push(`${name} (${method} ${path})`);
      }
    }
  }

  console.log(`✅ Found ${count} endpoints in MCP manifest`);
}

// Identify inconsistencies
function identifyInconsistencies() {
  console.log(`\n🔍 Identifying inconsistencies...\n`);

  // 1. Tables without APIs
  for (const [tableName, tableInfo] of results.tables.entries()) {
    // Skip system tables
    if (tableName.startsWith('setting_') ||
        tableName.includes('_instance_') ||
        tableName.includes('_rbac_') ||
        tableName.includes('_map') ||
        tableName.includes('orchestrator_') ||
        tableName === 'd_entity') {
      continue;
    }

    if (!tableInfo.hasApi) {
      results.inconsistencies.push(`❌ Table ${tableName} (${tableInfo.ddlFile}) has no corresponding API module`);
    }

    // Check for standard CRUD operations
    const apiInfo = results.apis.get(tableInfo.apiPath!);
    if (apiInfo) {
      const operations = {
        'GET list': `GET /api/v1/${tableInfo.apiPath}`,
        'GET single': `GET /api/v1/${tableInfo.apiPath}/:id`,
        'POST create': `POST /api/v1/${tableInfo.apiPath}`,
        'PUT update': `PUT /api/v1/${tableInfo.apiPath}/:id`,
        'DELETE delete': `DELETE /api/v1/${tableInfo.apiPath}/:id`,
      };

      for (const [opName, expectedEndpoint] of Object.entries(operations)) {
        const found = Array.from(apiInfo.endpoints).some(ep => {
          const normalized = ep.replace(/:id/g, ':id').replace(/:(\w+)/g, ':$1');
          return normalized === expectedEndpoint;
        });

        if (!found) {
          tableInfo.missingOperations.push(opName);
        }
      }

      if (tableInfo.missingOperations.length > 0) {
        results.inconsistencies.push(`⚠️  Table ${tableName} API is missing operations: ${tableInfo.missingOperations.join(', ')}`);
      }
    }

    // Check MCP manifest coverage
    if (tableInfo.mcpEntries.length === 0 && tableInfo.hasApi) {
      results.inconsistencies.push(`⚠️  Table ${tableName} has API but no MCP manifest entries`);
    }
  }

  // 2. APIs without DDL tables
  for (const [moduleName, apiInfo] of results.apis.entries()) {
    // Skip utility/system modules
    if (['auth', 'shared', 'meta', 'schema', 'entity-options', 'entity', 'linkage', 'rbac', 'setting', 'upload', 's3-backend', 'collab', 'chat', 'booking'].includes(moduleName)) {
      continue;
    }

    if (!apiInfo.hasDDL) {
      results.inconsistencies.push(`❌ API module ${moduleName} has no corresponding DDL table`);
    }
  }
}

// Print results
function printResults() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 ANALYSIS RESULTS`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📊 Summary:`);
  console.log(`  - Total DDL tables: ${results.tables.size}`);
  console.log(`  - Total API modules: ${results.apis.size}`);
  console.log(`  - Inconsistencies found: ${results.inconsistencies.length}\n`);

  if (results.inconsistencies.length > 0) {
    console.log(`\n🚨 INCONSISTENCIES:\n`);
    for (const issue of results.inconsistencies) {
      console.log(`  ${issue}`);
    }
  } else {
    console.log(`\n✅ No inconsistencies found! All DDL tables have corresponding APIs and MCP entries.`);
  }

  // Detailed table report
  console.log(`\n\n📊 DETAILED TABLE REPORT:\n`);
  console.log(`${'='.repeat(80)}\n`);

  for (const [tableName, tableInfo] of results.tables.entries()) {
    if (tableName.startsWith('setting_') || tableName.includes('_instance_') || tableName.includes('orchestrator_')) {
      continue;
    }

    console.log(`📦 ${tableName}`);
    console.log(`   DDL: ${tableInfo.ddlFile}`);
    console.log(`   Schema: ${tableInfo.schemaName}`);
    console.log(`   Columns: ${tableInfo.columns.size}`);
    console.log(`   API: ${tableInfo.hasApi ? '✅ /api/v1/' + tableInfo.apiPath : '❌ Missing'}`);
    console.log(`   MCP Entries: ${tableInfo.mcpEntries.length > 0 ? '✅ ' + tableInfo.mcpEntries.length : '❌ None'}`);
    if (tableInfo.missingOperations.length > 0) {
      console.log(`   Missing Operations: ${tableInfo.missingOperations.join(', ')}`);
    }
    console.log(``);
  }
}

// Main execution
function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 DDL TO API CONSISTENCY ANALYZER`);
  console.log(`${'='.repeat(80)}`);

  analyzeDDLFiles();
  analyzeAPIRoutes();
  analyzeMCPManifest();
  identifyInconsistencies();
  printResults();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Analysis complete!`);
  console.log(`${'='.repeat(80)}\n`);

  // Return exit code based on inconsistencies
  if (results.inconsistencies.length > 0) {
    process.exit(1);
  }
}

main();
