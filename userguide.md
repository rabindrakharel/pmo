# Huron Home Services Platform Developer Guide

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Database Design Standards](#database-design-standards)
- [Authentication & Security](#authentication--security)  
- [API Design Patterns](#api-design-patterns)
- [Frontend Architecture](#frontend-architecture)
- [Component Library](#component-library)
- [Page Development Patterns](#page-development-patterns)
- [Development Workflow](#development-workflow)
- [Environment Configuration](#environment-configuration)
- [Adding New Features](#adding-new-features)

## Architecture Overview

### Technology Stack
- **Monorepo Structure**: Multi-app workspace with shared configuration
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Fastify + TypeBox + Drizzle ORM
- **Database**: PostgreSQL with `app` schema (35 tables)
- **Authentication**: JWT-based with secure token management
- **Documentation**: Auto-generated Swagger/OpenAPI docs
- **Real Data**: Complete Canadian home services business context

### Repository Structure
```
├── apps/
│   ├── web/          # React frontend application
│   └── api/          # Fastify backend API
├── db/               # Database schema (35 DDL files)
├── tools/            # Development and deployment scripts
└── infra/            # Infrastructure and Helm charts
```

### Key Design Principles
1. **Real Business Context**: Based on Huron Home Services operations in Ontario
2. **Multi-Dimensional Hierarchies**: Separate business vs geographic organizational structures
3. **Normalized Relations**: Clean many-to-many relationships with minimal columns
4. **Type Safety**: Full TypeScript coverage with schema validation
5. **Security First**: JWT authentication with proper RBAC implementation
6. **Canadian Compliance**: PIPEDA, Ontario regulations, professional licensing

## Database Design Standards

### Current Schema Architecture (2025-09-04)

The database has undergone significant restructuring with clear naming conventions:

#### **Key Naming Changes**
- **`location` → `org`**: Geographic organizational hierarchy (`d_scope_org`)
- **`business` → `biz`**: Business organizational hierarchy (`d_scope_biz`)  
- **Normalized Relations**: All `rel_*` tables use minimal required columns
- **Clear Purpose**: Table names clearly indicate their semantic purpose

#### **Schema Organization (35 Tables)**
```
Extensions & Meta (00-10): Foundation configuration
├── 00___extensions.ddl         # PostgreSQL extensions
├── 01___extensions.ddl         # Additional extensions
├── 02___meta_org_level.ddl     # Business org levels (Corp→Sub-team)
├── 03___meta_biz_level.ddl     # Business function levels
├── 04___meta_geo_level.ddl     # Geographic levels (Region→Address)
├── 05___meta_hr_level.ddl      # HR hierarchy levels
├── 06___meta_client_level.ddl  # Client organization levels
├── 07___meta_project_status.ddl # Project lifecycle statuses
├── 08___meta_project_stage.ddl  # PMBOK project stages
├── 09___meta_task_status.ddl    # Task workflow statuses
└── 10___meta_task_stage.ddl     # Kanban task stages

Core Dimensions (20-37): Master entities
├── 20___d_scope_biz.ddl        # Business organizational hierarchy
├── 21___d_scope_org.ddl        # Geographic organizational hierarchy
├── 22___d_scope_hr.ddl         # HR position hierarchy
├── 23___d_scope_worksite.ddl   # Physical worksite locations
├── 24___d_employee.ddl         # Employee master data (20 employees)
├── 25___d_role.ddl            # Role definitions (15 roles)
├── 26___d_client.ddl          # Client organizations
├── 27___d_artifact.ddl        # Knowledge artifacts (designs, SOWs)
├── 34___d_scope_unified.ddl   # Unified scope registry for RBAC
├── 35___d_scope_project.ddl   # Project definitions
├── 36___d_scope_task.ddl      # Task definitions
└── 37___d_scope_app.ddl       # Application components/routes

Relationship Tables: Normalized many-to-many
├── 23___rel_hr_biz_org.ddl         # HR ↔ Business ↔ Geographic (3-way)
├── 26___rel_emp_role.ddl           # Employee ↔ Role (temporal)
├── 28___rel_artifact_project.ddl   # Artifact ↔ Project
├── 29___rel_artifact_biz.ddl       # Artifact ↔ Business Unit
├── 30___rel_artifact_project_stage.ddl # Artifact ↔ Project Stage
├── 31___rel_artifact_employee.ddl  # Artifact ↔ Employee
├── 32___rel_artifact_role.ddl      # Artifact ↔ Role
├── 33___rel_project_client.ddl     # Project ↔ Client
├── 55___rel_task_employee.ddl      # Task ↔ Employee
└── 90___rel_employee_scope_unified.ddl # Employee ↔ Unified Scope

Operational Tables (50-54): Transaction data
├── 50___ops_formlog_head.ddl   # Dynamic form definitions
├── 51___ops_formlog_records.ddl # Form submission records
├── 52___ops_task_records.ddl   # Task activity logs
├── 53___ops_task_head.ddl      # Task master records
└── 54___d_wiki.ddl            # Wiki knowledge base
```

### Table Naming Conventions
- **Dimension Tables**: `d_*` (e.g., `d_employee`, `d_scope_biz`)
- **Operational Tables**: `ops_*` (e.g., `ops_project_head`, `ops_task_records`)
- **Metadata Tables**: `meta_*` (e.g., `meta_project_status`)
- **Relationship Tables**: `rel_*` (e.g., `rel_emp_role`, `rel_artifact_biz`)

### Standard Field Structure
Every dimension table follows this exact pattern:
```sql
-- Primary identifier
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

-- Standard fields (audit, metadata, SCD type 2) - ALWAYS FIRST
name text NOT NULL,
"descr" text,
tags jsonb NOT NULL DEFAULT '[]'::jsonb,
attr jsonb NOT NULL DEFAULT '{}'::jsonb,
from_ts timestamptz NOT NULL DEFAULT now(),
to_ts timestamptz,
active boolean NOT NULL DEFAULT true,
created timestamptz NOT NULL DEFAULT now(),
updated timestamptz NOT NULL DEFAULT now(),

-- Table-specific fields follow...
```

### Normalized Relationship Patterns
All `rel_*` tables follow this minimal structure:
```sql
CREATE TABLE app.rel_[entity1]_[entity2] (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign key relationships
  [entity1]_id uuid NOT NULL REFERENCES app.d_[entity1](id) ON DELETE CASCADE,
  [entity2]_id uuid NOT NULL REFERENCES app.d_[entity2](id) ON DELETE CASCADE,
  
  -- Temporal tracking
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Minimal relationship-specific context
  [context_field] text,
  
  -- Unique constraint for temporal integrity
  UNIQUE([entity1]_id, [entity2]_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);
```

### Multi-Dimensional Hierarchies

#### **Business Organizational Structure** (`d_scope_biz`)
6-level hierarchy representing internal business structure:
```
Corporation (Level 0)
└── Division (Level 1)
    └── Department (Level 2)
        └── Team (Level 3)
            └── Squad (Level 4)
                └── Sub-team (Level 5)
```

**Real Data Example - Huron Home Services:**
```
Huron Home Services (Corporation)
├── Business Operations Division
│   ├── Landscaping Department
│   │   ├── Residential Landscaping Team
│   │   │   ├── Garden Design Squad
│   │   │   │   ├── Native Plant Specialists
│   │   │   │   └── Water Feature Specialists
│   │   │   └── Installation Squad
│   │   └── Commercial Landscaping Team
│   ├── Snow Removal Department
│   ├── HVAC Services Department
│   └── Plumbing Services Department
└── Corporate Services Division
```

#### **Geographic Organizational Structure** (`d_scope_org`)
8-level hierarchy representing Canadian geographic operations:
```
Corp-Region (Level 0)
└── Country (Level 1)
    └── Province (Level 2)
        └── Economic Region (Level 3)
            └── Metropolitan Area (Level 4)
                └── City (Level 5)
                    └── District (Level 6)
                        └── Address (Level 7)
```

**Real Data Example - Canadian Coverage:**
```
North America Central
└── Canada
    └── Ontario
        ├── Greater Toronto Area
        │   ├── Toronto CMA
        │   │   ├── Mississauga (HQ)
        │   │   │   ├── City Centre
        │   │   │   │   └── 1250 South Service Rd (HQ Address)
        │   │   │   └── Meadowvale
        │   │   ├── Toronto
        │   │   └── Oakville
        │   └── Hamilton CMA
        └── Hamilton-Niagara Peninsula
```

### Real Business Data Context

#### **Employee Structure** (`d_employee` - 20 employees)
- **James Miller** (CEO) - `james.miller@huronhome.ca`
  - Complete executive profile with strategic oversight
  - Multiple role assignments (CEO, PM, SysAdmin)
  - Author/owner of key artifacts and wiki content
- **Executive Team**: CFO, CTO, COO with realistic Canadian salaries
- **Management Layer**: SVPs, VPs, Directors with departmental responsibility  
- **Professional Staff**: Licensed trades, project managers, specialists
- **Operational Staff**: Field workers, technicians, support staff
- **Seasonal Workers**: Part-time and temporary staff for seasonal operations

#### **Role-Based Access Control** (`d_role` + `rel_emp_role`)
15 role definitions from executive to operational:
- **Executive Roles**: CEO, CFO, CTO, COO with ultimate authority
- **Management Roles**: SVP, VP, Department Managers with budget authority
- **Professional Roles**: Landscape Architect, Project Manager, Licensed Technicians
- **Operational Roles**: Installation Specialists, Equipment Operators, CSRs
- **System Roles**: System Administrator, API Integration Specialist

#### **Knowledge Management** (`d_artifact` + `d_wiki`)
- **Design Artifacts**: Landscape templates, commercial standards
- **Policy Documents**: Safety policies, QA manuals, onboarding guides  
- **Wiki Content**: Company vision, project management best practices
- **Ownership Chains**: Clear authorship and approval workflows

### Advanced Patterns

#### **Head/Records Pattern**
Complex entities use separate header and records tables:
```sql
-- Header table for main entity definition
CREATE TABLE app.ops_project_head (
  -- Standard fields + entity-specific definition fields
  project_code text UNIQUE NOT NULL,
  biz_id uuid REFERENCES app.d_scope_biz(id),
  status_id uuid REFERENCES app.meta_project_status(id)
);

-- Records table for historical/detailed data
CREATE TABLE app.ops_project_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES app.ops_project_head(id),
  record_type text NOT NULL,
  record_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created timestamptz DEFAULT now()
);
```

#### **Three-Way Relationship Pattern**
Complex matrix assignments use normalized three-way relationships:
```sql
-- HR positions assigned across business units and geographic locations
CREATE TABLE app.rel_hr_biz_org (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_id uuid NOT NULL REFERENCES app.d_scope_hr(id) ON DELETE CASCADE,
  biz_id uuid NOT NULL REFERENCES app.d_scope_biz(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES app.d_scope_org(id) ON DELETE CASCADE,
  -- Temporal and assignment context
  assignment_type text DEFAULT 'primary',
  assignment_pct numeric(5,2) DEFAULT 100.00,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true
);
```

### Indexing Strategy
Required indexes for performance and query optimization:
```sql
-- Performance indexes for active record filtering
CREATE INDEX idx_table_active ON app.table_name(active) WHERE active = true;
CREATE INDEX idx_table_created ON app.table_name(created);
CREATE INDEX idx_table_from_ts ON app.table_name(from_ts);

-- Full-text search capability
CREATE INDEX gin_table_search ON app.table_name 
  USING gin(to_tsvector('english', name || ' ' || COALESCE(descr, '')));

-- JSONB field indexing for flexible metadata
CREATE INDEX gin_table_tags ON app.table_name USING gin(tags);
CREATE INDEX gin_table_attr ON app.table_name USING gin(attr);

-- Foreign key indexes for relationship performance
CREATE INDEX idx_table_parent ON app.table_name(parent_id);
CREATE INDEX idx_table_level ON app.table_name(level_id);
```

## Authentication & Security

### JWT Authentication Flow
The system uses JWT tokens with the following implementation:

#### Frontend Authentication Context
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login(email: string, password: string): Promise<void>;
  logout(): void;
  refreshUser(): Promise<void>;
}

// Real user example
const jamesMillerUser = {
  id: "uuid-james-miller",
  email: "james.miller@huronhome.ca",
  name: "James Miller",
  roles: ["CEO", "PM", "SYSADMIN"],
  businessScopes: ["Huron Home Services", "Business Operations Division"],
  geographicScopes: ["Ontario", "Greater Toronto Area", "Mississauga"]
};
```

#### Backend Authentication Endpoints
```typescript
// Authentication routes
POST /api/v1/auth/login    // Email + password (james.miller@huronhome.ca)
GET  /api/v1/auth/me       // Current user profile with scopes
POST /api/v1/auth/logout   // Token cleanup
```

### Role-Based Access Control (RBAC)

#### Permission Model
The system implements a comprehensive permission model:
```typescript
enum PermissionLevel {
  READ = 0,     // View access
  UPDATE = 1,   // Modify existing records
  SHARE = 2,    // Share with other users
  DELETE = 3,   // Delete records
  CREATE = 4    // Create new records
}

// Multi-dimensional scope types
interface ScopeTypes {
  business: string;    // d_scope_biz hierarchy
  geographic: string;  // d_scope_org hierarchy
  hr: string;         // d_scope_hr hierarchy
  worksite: string;   // d_scope_worksite locations
  project: string;    // project-specific access
  task: string;       // task-specific access
  app: string;        // application components/routes
}
```

#### Real Authorization Examples
```typescript
// James Miller's permissions (CEO)
const jamesMillerPermissions = {
  business: {
    "Huron Home Services": [0,1,2,3,4],           // Full corporate access
    "Business Operations Division": [0,1,2,3,4],   // Full operational access
    "Landscaping Department": [0,1,2,3,4]          // Departmental oversight
  },
  geographic: {
    "Ontario": [0,1,2,3,4],                        // Provincial oversight
    "Greater Toronto Area": [0,1,2,3,4],           // Regional authority
    "Mississauga": [0,1,2,3,4]                     // HQ location control
  },
  app: {
    "/api/v1/employee": [0,1,2,3,4],               // Full employee API access
    "/dashboard": [0,1,2,3,4],                     // Dashboard access
    "datatable:DataTable": [0,1,2,3,4]            // Component permissions
  }
};
```

### Database Access Security
```sql
-- Employee authentication with bcrypt hashes
SELECT 
  e.id,
  e.email,
  e.name,
  e.password_hash,
  array_agg(DISTINCT r.role_code) as roles
FROM app.d_employee e
LEFT JOIN app.rel_emp_role er ON e.id = er.emp_id AND er.active = true
LEFT JOIN app.d_role r ON er.role_id = r.id
WHERE e.email = $1 AND e.active = true
GROUP BY e.id, e.email, e.name, e.password_hash;

-- Scope-based access validation
SELECT DISTINCT
  s.scope_type,
  s.scope_name,
  rus.permission_level
FROM app.rel_employee_scope_unified rus
JOIN app.d_scope_unified s ON rus.scope_id = s.id
WHERE rus.employee_id = $1 AND rus.active = true;
```

## API Design Patterns

### Module Structure
Each API module follows this standardized pattern:
```
apps/api/src/modules/[entity]/
├── routes.ts      # Route definitions and handlers
├── schemas.ts     # TypeBox validation schemas  
├── service.ts     # Business logic layer
└── queries.ts     # Database queries
```

### Standard CRUD Implementation

#### TypeBox Schema Validation
```typescript
import { Type, Static } from '@sinclair/typebox';

// Employee schema example
const EmployeeSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  employee_number: Type.String(),
  employment_status: Type.String(),
  hire_date: Type.String({ format: 'date' }),
  salary_annual: Type.Optional(Type.Number()),
  roles: Type.Optional(Type.Array(Type.String())),
  business_scopes: Type.Optional(Type.Array(Type.String())),
  created: Type.String(),
  updated: Type.String()
});

const CreateEmployeeSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  email: Type.String({ format: 'email' }),
  employee_number: Type.String({ minLength: 1, maxLength: 50 }),
  first_name: Type.String(),
  last_name: Type.String(),
  hire_date: Type.String({ format: 'date' }),
  employment_status: Type.String(),
  employee_type: Type.String()
});

type Employee = Static<typeof EmployeeSchema>;
type CreateEmployeeRequest = Static<typeof CreateEmployeeSchema>;
```

#### Route Handler with Real Data Context
```typescript
export async function employeeRoutes(fastify: FastifyInstance) {
  // List employees with business context
  fastify.get('/api/v1/employee', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
        employment_status: Type.Optional(Type.String()),
        business_id: Type.Optional(Type.String()),
        role_code: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          data: Type.Array(EmployeeSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        })
      }
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const { limit = 20, offset = 0, search, employment_status, business_id, role_code } = request.query;
      
      // Multi-dimensional filtering with RBAC
      const whereConditions = [
        sql`e.active = true`,
        // Add user-specific business scope filtering
        sql`EXISTS (
          SELECT 1 FROM app.rel_employee_scope_unified resu
          JOIN app.d_scope_unified su ON resu.scope_id = su.id
          WHERE resu.employee_id = ${request.user.id}
          AND su.scope_type = 'business'
          AND resu.permission_level >= 0  -- READ permission
        )`
      ];
      
      if (search) {
        whereConditions.push(
          sql`(e.name ILIKE ${`%${search}%`} OR e.email ILIKE ${`%${search}%`} OR e.employee_number ILIKE ${`%${search}%`})`
        );
      }
      
      if (employment_status) {
        whereConditions.push(sql`e.employment_status = ${employment_status}`);
      }
      
      if (role_code) {
        whereConditions.push(sql`EXISTS (
          SELECT 1 FROM app.rel_emp_role rer
          JOIN app.d_role r ON rer.role_id = r.id
          WHERE rer.emp_id = e.id AND r.role_code = ${role_code} AND rer.active = true
        )`);
      }
      
      const whereClause = sql`WHERE ${sql.join(whereConditions, sql` AND `)}`;
      
      // Query with business context joins
      const [employees, countResult] = await Promise.all([
        db.execute(sql`
          SELECT 
            e.id,
            e.name,
            e.email,
            e.employee_number,
            e.first_name,
            e.last_name,
            e.hire_date,
            e.employment_status,
            e.employee_type,
            e.salary_annual,
            e.created,
            e.updated,
            array_agg(DISTINCT r.role_code) FILTER (WHERE r.role_code IS NOT NULL) as roles,
            array_agg(DISTINCT sb.name) FILTER (WHERE sb.name IS NOT NULL) as business_scopes
          FROM app.d_employee e
          LEFT JOIN app.rel_emp_role rer ON e.id = rer.emp_id AND rer.active = true
          LEFT JOIN app.d_role r ON rer.role_id = r.id
          LEFT JOIN app.rel_artifact_employee rae ON e.id = rae.employee_id AND rae.active = true
          LEFT JOIN app.rel_artifact_biz rab ON rae.artifact_id = rab.artifact_id AND rab.active = true
          LEFT JOIN app.d_scope_biz sb ON rab.biz_id = sb.id
          ${whereClause}
          GROUP BY e.id, e.name, e.email, e.employee_number, e.first_name, e.last_name, 
                   e.hire_date, e.employment_status, e.employee_type, e.salary_annual, e.created, e.updated
          ORDER BY e.name
          LIMIT ${limit}
          OFFSET ${offset}
        `),
        db.execute(sql`
          SELECT COUNT(DISTINCT e.id)::int as count
          FROM app.d_employee e
          ${whereClause}
        `)
      ]);
      
      return {
        data: employees.rows,
        total: countResult.rows[0].count,
        limit,
        offset
      };
    }
  });
}
```

### Database Query Patterns with Business Context

#### Employee Service with Role and Scope Integration
```typescript
export class EmployeeService {
  async findByIdWithContext(id: string, requestingUserId: string) {
    // Get employee with full business context
    const result = await db.execute(sql`
      SELECT 
        e.*,
        json_agg(DISTINCT jsonb_build_object(
          'role_code', r.role_code,
          'role_name', r.name,
          'assignment_type', rer.assignment_type,
          'authority_level', rer.authority_level
        )) FILTER (WHERE r.id IS NOT NULL) as roles,
        json_agg(DISTINCT jsonb_build_object(
          'business_name', sb.name,
          'business_level', sb.level_name,
          'business_code', sb.org_code
        )) FILTER (WHERE sb.id IS NOT NULL) as business_assignments,
        json_agg(DISTINCT jsonb_build_object(
          'geographic_name', so.name,
          'geographic_level', so.level_name,
          'province_code', so.province_code
        )) FILTER (WHERE so.id IS NOT NULL) as geographic_assignments
      FROM app.d_employee e
      LEFT JOIN app.rel_emp_role rer ON e.id = rer.emp_id AND rer.active = true
      LEFT JOIN app.d_role r ON rer.role_id = r.id
      LEFT JOIN app.rel_artifact_employee rae ON e.id = rae.employee_id AND rae.active = true
      LEFT JOIN app.rel_artifact_biz rab ON rae.artifact_id = rab.artifact_id AND rab.active = true
      LEFT JOIN app.d_scope_biz sb ON rab.biz_id = sb.id
      LEFT JOIN app.rel_hr_biz_org rhbo ON e.id = rhbo.hr_id AND rhbo.active = true
      LEFT JOIN app.d_scope_org so ON rhbo.org_id = so.id
      WHERE e.id = ${id} AND e.active = true
      GROUP BY e.id
    `);
    
    return result.rows[0] || null;
  }
  
  async createWithRoleAssignment(data: CreateEmployeeRequest, createdBy: string) {
    // Transaction to create employee and assign default role
    return await db.transaction(async (tx) => {
      // Create employee record
      const [employee] = await tx.execute(sql`
        INSERT INTO app.d_employee (
          name, email, employee_number, first_name, last_name,
          hire_date, employment_status, employee_type
        )
        VALUES (
          ${data.name}, ${data.email}, ${data.employee_number}, 
          ${data.first_name}, ${data.last_name}, ${data.hire_date},
          ${data.employment_status}, ${data.employee_type}
        )
        RETURNING *
      `);
      
      // Assign default role based on employee type
      const defaultRole = await tx.execute(sql`
        SELECT id FROM app.d_role 
        WHERE role_code = ${data.employee_type === 'executive' ? 'VP' : 'CSR'}
        LIMIT 1
      `);
      
      if (defaultRole.rows.length > 0) {
        await tx.execute(sql`
          INSERT INTO app.rel_emp_role (emp_id, role_id, assignment_type, authority_level)
          VALUES (${employee.id}, ${defaultRole.rows[0].id}, 'primary', 'standard')
        `);
      }
      
      return employee;
    });
  }
}
```

## Frontend Architecture

### Application Structure with Business Context
```
apps/web/src/
├── components/
│   ├── common/       # Business-aware utility components
│   ├── layout/       # Application layout with navigation
│   └── ui/           # Reusable UI components
├── contexts/         # React contexts (Auth, Business, Theme)
├── hooks/            # Custom React hooks with API integration
├── lib/              # Utilities and API client
├── pages/            # Route components for business entities
└── types/            # TypeScript type definitions
```

### Business-Aware Component Examples

#### Employee Profile Component
```typescript
interface EmployeeProfileProps {
  employeeId: string;
  showSensitiveData?: boolean;
}

export function EmployeeProfile({ employeeId, showSensitiveData = false }: EmployeeProfileProps) {
  const { data: employee, loading, error } = useEmployeeDetails(employeeId);
  const { user } = useAuth();
  
  if (loading) return <div>Loading employee profile...</div>;
  if (error || !employee) return <div>Employee not found</div>;
  
  // Security check for sensitive data access
  const canViewSensitive = showSensitiveData && (
    user.roles.includes('CEO') || 
    user.roles.includes('CFO') || 
    user.id === employeeId
  );
  
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="h-16 w-16 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-xl font-semibold text-white">
            {employee.first_name?.[0]}{employee.last_name?.[0]}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{employee.name}</h1>
          <p className="text-gray-600">{employee.email}</p>
          <p className="text-sm text-gray-500">Employee #{employee.employee_number}</p>
        </div>
      </div>
      
      {/* Role assignments */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Roles</h3>
          <div className="space-y-2">
            {employee.roles?.map((role: any) => (
              <div key={role.role_code} className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  role.authority_level === 'executive' 
                    ? 'bg-purple-100 text-purple-800'
                    : role.authority_level === 'supervisory'
                    ? 'bg-blue-100 text-blue-800'  
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {role.role_name}
                </span>
                <span className="text-sm text-gray-500">({role.assignment_type})</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Business Assignments</h3>
          <div className="space-y-2">
            {employee.business_assignments?.map((biz: any) => (
              <div key={biz.business_code} className="text-sm">
                <div className="font-medium">{biz.business_name}</div>
                <div className="text-gray-500">{biz.business_level}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Sensitive information - conditional rendering */}
      {canViewSensitive && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Compensation & Benefits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Annual Salary</label>
              <p className="mt-1 text-sm text-gray-900">
                {employee.salary_annual ? 
                  `CAD $${employee.salary_annual.toLocaleString()}` : 
                  'Hourly Rate'
                }
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Employment Type</label>
              <p className="mt-1 text-sm text-gray-900">{employee.employee_type}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Business Hierarchy Navigation
```typescript
interface BusinessHierarchyNavProps {
  currentBusinessId?: string;
  onBusinessSelect: (businessId: string) => void;
}

export function BusinessHierarchyNav({ currentBusinessId, onBusinessSelect }: BusinessHierarchyNavProps) {
  const { data: businessHierarchy, loading } = useBusinessHierarchy();
  
  const renderBusinessNode = (business: any, level = 0) => (
    <div key={business.id} style={{ marginLeft: level * 20 }}>
      <button
        onClick={() => onBusinessSelect(business.id)}
        className={`w-full text-left px-3 py-2 rounded text-sm ${
          currentBusinessId === business.id
            ? 'bg-blue-100 text-blue-900 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${
            business.level_name === 'Corporation' ? 'bg-purple-500' :
            business.level_name === 'Division' ? 'bg-blue-500' :
            business.level_name === 'Department' ? 'bg-green-500' :
            business.level_name === 'Team' ? 'bg-yellow-500' :
            'bg-gray-500'
          }`} />
          <span>{business.name}</span>
          <span className="text-xs text-gray-500">({business.level_name})</span>
        </div>
      </button>
      
      {business.children?.map((child: any) => renderBusinessNode(child, level + 1))}
    </div>
  );
  
  if (loading) return <div>Loading business structure...</div>;
  
  return (
    <div className="bg-white shadow rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Business Structure</h3>
      <div className="space-y-1">
        {businessHierarchy?.map((business: any) => renderBusinessNode(business))}
      </div>
    </div>
  );
}
```

### API Client with Business Context
```typescript
// apps/web/src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor with business context
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add business context headers if available
    const currentBusinessId = localStorage.getItem('current_business_id');
    if (currentBusinessId) {
      config.headers['X-Business-Context'] = currentBusinessId;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Business-specific API clients
export const employeeApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    employment_status?: string;
    business_id?: string;
    role_code?: string;
  }) => apiClient.get('/api/v1/employee', { params }),
  
  get: (id: string) => apiClient.get(`/api/v1/employee/${id}`),
  
  getWithContext: (id: string) => apiClient.get(`/api/v1/employee/${id}/context`),
  
  create: (data: CreateEmployeeRequest) => apiClient.post('/api/v1/employee', data),
  
  update: (id: string, data: UpdateEmployeeRequest) => 
    apiClient.put(`/api/v1/employee/${id}`, data),
  
  assignRole: (employeeId: string, roleId: string, context?: any) =>
    apiClient.post(`/api/v1/employee/${employeeId}/roles`, { roleId, ...context }),
  
  delete: (id: string) => apiClient.delete(`/api/v1/employee/${id}`)
};

export const businessApi = {
  getHierarchy: () => apiClient.get('/api/v1/business/hierarchy'),
  
  getByLevel: (level: string) => apiClient.get(`/api/v1/business/level/${level}`),
  
  getEmployees: (businessId: string, params?: any) => 
    apiClient.get(`/api/v1/business/${businessId}/employees`, { params }),
  
  getProjects: (businessId: string, params?: any) =>
    apiClient.get(`/api/v1/business/${businessId}/projects`, { params })
};

export const artifactApi = {
  list: (params?: {
    artifact_type?: string;
    business_id?: string;
    owner_id?: string;
    confidentiality_level?: string;
  }) => apiClient.get('/api/v1/artifact', { params }),
  
  getByBusiness: (businessId: string) => 
    apiClient.get(`/api/v1/artifact/business/${businessId}`),
  
  getByEmployee: (employeeId: string) =>
    apiClient.get(`/api/v1/artifact/employee/${employeeId}`)
};
```

## Component Library

### Business-Aware Data Components

#### Enhanced DataTable with Business Context
```typescript
interface BusinessDataTableProps<T> extends DataTableProps<T> {
  businessId?: string;
  showBusinessColumn?: boolean;
  allowCrossBusiness?: boolean;
  businessFilter?: boolean;
}

export function BusinessDataTable<T>({ 
  businessId,
  showBusinessColumn = false,
  allowCrossBusiness = false,
  businessFilter = false,
  ...props 
}: BusinessDataTableProps<T>) {
  const { user } = useAuth();
  const [businessFilterValue, setBusinessFilterValue] = useState(businessId);
  
  // Enhanced columns with business context
  const enhancedColumns = useMemo(() => {
    const columns = [...props.columns];
    
    if (showBusinessColumn) {
      columns.splice(1, 0, {
        key: 'business_name',
        title: 'Business Unit',
        sortable: true,
        render: (value: string, record: any) => (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>{value}</span>
          </div>
        )
      });
    }
    
    return columns;
  }, [props.columns, showBusinessColumn]);
  
  // Filter data based on business access
  const filteredData = useMemo(() => {
    if (!allowCrossBusiness && businessId) {
      return props.data.filter((item: any) => 
        item.business_id === businessId || 
        item.business_scopes?.includes(businessId)
      );
    }
    return props.data;
  }, [props.data, allowCrossBusiness, businessId]);
  
  return (
    <div>
      {businessFilter && (
        <div className="mb-4">
          <BusinessSelector
            value={businessFilterValue}
            onChange={setBusinessFilterValue}
            placeholder="Filter by business unit..."
          />
        </div>
      )}
      
      <DataTable
        {...props}
        data={filteredData}
        columns={enhancedColumns}
      />
    </div>
  );
}
```

#### Organizational Chart Component
```typescript
interface OrgChartNode {
  id: string;
  name: string;
  title?: string;
  level: string;
  children?: OrgChartNode[];
  employee?: {
    name: string;
    email: string;
    role: string;
  };
}

interface OrgChartProps {
  data: OrgChartNode[];
  type: 'business' | 'geographic' | 'hr';
  onNodeClick?: (node: OrgChartNode) => void;
  showEmployees?: boolean;
}

export function OrgChart({ data, type, onNodeClick, showEmployees = false }: OrgChartProps) {
  const getLevelColor = (level: string, chartType: string) => {
    if (chartType === 'business') {
      switch (level) {
        case 'Corporation': return 'bg-purple-100 border-purple-300 text-purple-900';
        case 'Division': return 'bg-blue-100 border-blue-300 text-blue-900';
        case 'Department': return 'bg-green-100 border-green-300 text-green-900';
        case 'Team': return 'bg-yellow-100 border-yellow-300 text-yellow-900';
        case 'Squad': return 'bg-orange-100 border-orange-300 text-orange-900';
        case 'Sub-team': return 'bg-red-100 border-red-300 text-red-900';
        default: return 'bg-gray-100 border-gray-300 text-gray-900';
      }
    }
    // Geographic and HR color schemes...
    return 'bg-gray-100 border-gray-300 text-gray-900';
  };
  
  const renderNode = (node: OrgChartNode, level = 0) => (
    <div key={node.id} className="flex flex-col items-center">
      <div 
        className={`
          p-4 border-2 rounded-lg cursor-pointer transition-all
          ${getLevelColor(node.level, type)}
          hover:shadow-lg transform hover:scale-105
        `}
        onClick={() => onNodeClick?.(node)}
      >
        <div className="text-center">
          <h3 className="font-semibold text-sm">{node.name}</h3>
          <p className="text-xs opacity-75">{node.level}</p>
          {showEmployees && node.employee && (
            <div className="mt-2 pt-2 border-t border-current border-opacity-20">
              <p className="text-xs font-medium">{node.employee.name}</p>
              <p className="text-xs opacity-75">{node.employee.role}</p>
            </div>
          )}
        </div>
      </div>
      
      {node.children && node.children.length > 0 && (
        <div className="flex flex-col items-center mt-4">
          <div className="w-px h-4 bg-gray-400" />
          <div className="flex space-x-8">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-gray-400" />
                <div className="h-px bg-gray-400" style={{ width: 'calc(100% + 32px)' }} />
                <div className="w-px h-4 bg-gray-400" />
                {renderNode(child, level + 1)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
  
  return (
    <div className="bg-white p-6 rounded-lg shadow overflow-auto">
      <div className="flex flex-col items-center space-y-8">
        {data.map(node => renderNode(node))}
      </div>
    </div>
  );
}
```

## Page Development Patterns

### Business Entity Page Pattern
All business entity pages follow this standardized structure:

```typescript
// apps/web/src/pages/EmployeePage.tsx
export function EmployeePage() {
  const { user } = useAuth();
  const [selectedBusiness, setSelectedBusiness] = useState<string>();
  
  // Multi-dimensional data fetching
  const {
    data: employees,
    total,
    loading,
    params,
    updateParams,
    refetch
  } = useList({
    endpoint: '/api/v1/employee',
    enabled: true,
    params: {
      business_id: selectedBusiness,
      ...(user.businessScopes && { business_filter: user.businessScopes.join(',') })
    }
  });
  
  // Business context statistics
  const stats = useMemo(() => [
    {
      value: total,
      label: 'Total Employees',
      color: 'blue' as const,
      format: 'number' as const,
      icon: Users
    },
    {
      value: employees.filter(e => e.employment_status === 'active').length,
      label: 'Active Employees',
      color: 'green' as const,
      format: 'number' as const,
      icon: UserCheck
    },
    {
      value: employees.filter(e => e.roles?.some(r => r.authority_level === 'executive')).length,
      label: 'Executive Team',
      color: 'purple' as const,
      format: 'number' as const,
      icon: Crown
    }
  ], [employees, total]);
  
  // Business-aware column definitions
  const columns = [
    {
      key: 'name',
      title: 'Employee',
      sortable: true,
      render: (value: string, record: any) => (
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {record.first_name?.[0]}{record.last_name?.[0]}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{record.email}</div>
          </div>
        </div>
      )
    },
    {
      key: 'employee_number',
      title: 'Employee #',
      sortable: true
    },
    {
      key: 'roles',
      title: 'Roles',
      render: (roles: any[]) => roles ? (
        <div className="space-x-1">
          {roles.slice(0, 2).map((role) => (
            <span key={role.role_code} className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
              ${role.authority_level === 'executive' ? 'bg-purple-100 text-purple-800' :
                role.authority_level === 'supervisory' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'}
            `}>
              {role.role_code}
            </span>
          ))}
          {roles.length > 2 && (
            <span className="text-xs text-gray-500">+{roles.length - 2} more</span>
          )}
        </div>
      ) : null
    },
    {
      key: 'business_assignments',
      title: 'Business Units',
      render: (assignments: any[]) => assignments ? (
        <div className="space-y-1">
          {assignments.slice(0, 2).map((biz, idx) => (
            <div key={idx} className="text-sm">
              <span className="font-medium">{biz.business_name}</span>
              <span className="text-gray-500 ml-1">({biz.business_level})</span>
            </div>
          ))}
          {assignments.length > 2 && (
            <div className="text-xs text-gray-500">+{assignments.length - 2} more</div>
          )}
        </div>
      ) : 'Unassigned'
    },
    {
      key: 'employment_status',
      title: 'Status',
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'inactive' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )
    },
    {
      key: 'hire_date',
      title: 'Hire Date',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];
  
  // Action handlers with business context
  const handleView = (employee: any) => {
    // Navigate to employee detail with business context
    window.location.href = `/employee/${employee.id}?business=${selectedBusiness || ''}`;
  };
  
  const handleAssignRole = async (employee: any) => {
    // Role assignment modal with business scope validation
    const canAssignRoles = user.roles.some(r => ['CEO', 'CFO', 'COO'].includes(r));
    if (!canAssignRoles) {
      alert('You do not have permission to assign roles');
      return;
    }
    // Open role assignment modal...
  };
  
  return (
    <Layout 
      createButton={{ 
        label: 'Add Employee', 
        href: `/employee/new${selectedBusiness ? `?business=${selectedBusiness}` : ''}` 
      }}
    >
      <div className="space-y-6">
        {/* Page Header with Business Context */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              {selectedBusiness && (
                <p className="text-sm text-gray-600">
                  Filtered by: {employees[0]?.business_assignments?.[0]?.business_name}
                </p>
              )}
            </div>
          </div>
          
          {/* Business Filter */}
          <div className="w-64">
            <BusinessSelector
              value={selectedBusiness}
              onChange={setSelectedBusiness}
              placeholder="All business units"
              allowClear
            />
          </div>
        </div>
        
        {/* Statistics Grid */}
        <StatsGrid stats={stats} />
        
        {/* Business Data Table */}
        <BusinessDataTable
          data={employees}
          columns={columns}
          loading={loading}
          businessId={selectedBusiness}
          showBusinessColumn={!selectedBusiness}
          allowCrossBusiness={user.roles.includes('CEO')}
          businessFilter={false} // Already handled above
          pagination={{
            current: Math.floor((params.offset || 0) / (params.limit || 20)) + 1,
            pageSize: params.limit || 20,
            total,
            onChange: (page, pageSize) => {
              updateParams({
                limit: pageSize,
                offset: (page - 1) * pageSize
              });
            }
          }}
          searchable
          filterable
          onView={handleView}
          onEdit={handleEdit}
          showDefaultActions
          rowActions={[
            {
              key: 'assign-role',
              label: 'Assign Role',
              icon: Crown,
              onClick: handleAssignRole,
              disabled: (record) => !user.roles.some(r => ['CEO', 'CFO', 'COO'].includes(r)),
              className: 'text-purple-600 hover:text-purple-900'
            }
          ]}
        />
      </div>
    </Layout>
  );
}
```

## Development Workflow

### Database Development Workflow

#### Schema Changes Process
```bash
# 1. Create new DDL file with proper numbering
echo "-- ============================================================================
-- NEW FEATURE TABLE
-- ============================================================================

CREATE TABLE app.d_new_feature (
  -- Standard fields pattern
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  descr text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  
  -- Feature-specific fields
  feature_type text NOT NULL,
  business_id uuid REFERENCES app.d_scope_biz(id)
);

-- Required indexes
CREATE INDEX idx_new_feature_active ON app.d_new_feature(active) WHERE active = true;
CREATE INDEX idx_new_feature_business ON app.d_new_feature(business_id);

-- Sample data with business context
INSERT INTO app.d_new_feature (name, descr, feature_type, business_id) VALUES
('Sample Feature', 'Example feature for Huron Home Services', 'operational',
 (SELECT id FROM app.d_scope_biz WHERE name = 'Business Operations Division'));
" > db/38___d_new_feature.ddl

# 2. Apply schema changes
./tools/db-import.sh

# 3. Update relationship tables if needed
echo "CREATE TABLE app.rel_new_feature_employee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES app.d_new_feature(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES app.d_employee(id) ON DELETE CASCADE,
  relationship_type text DEFAULT 'assigned',
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(feature_id, employee_id, from_ts) DEFERRABLE INITIALLY DEFERRED
);" > db/39___rel_new_feature_employee.ddl
```

#### API Module Development
```bash
# 1. Create module structure
mkdir -p apps/api/src/modules/newfeature
cd apps/api/src/modules/newfeature

# 2. Create schema definitions
cat > schemas.ts << 'EOF'
import { Type, Static } from '@sinclair/typebox';

export const NewFeatureSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  descr: Type.Optional(Type.String()),
  feature_type: Type.String(),
  business_id: Type.Optional(Type.String()),
  business_name: Type.Optional(Type.String()),
  created: Type.String(),
  updated: Type.String()
});

export const CreateNewFeatureSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  descr: Type.Optional(Type.String()),
  feature_type: Type.String(),
  business_id: Type.String({ format: 'uuid' })
});

export type NewFeature = Static<typeof NewFeatureSchema>;
export type CreateNewFeatureRequest = Static<typeof CreateNewFeatureSchema>;
EOF

# 3. Create route handlers with business context
cat > routes.ts << 'EOF'
import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { sql } from 'drizzle-orm';
import { db } from '../../../lib/database';
import { NewFeatureSchema, CreateNewFeatureSchema } from './schemas';

export async function newFeatureRoutes(fastify: FastifyInstance) {
  // List with business context filtering
  fastify.get('/api/v1/newfeature', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        offset: Type.Optional(Type.Number({ minimum: 0 })),
        search: Type.Optional(Type.String()),
        feature_type: Type.Optional(Type.String()),
        business_id: Type.Optional(Type.String())
      }),
      response: {
        200: Type.Object({
          data: Type.Array(NewFeatureSchema),
          total: Type.Number(),
          limit: Type.Number(),
          offset: Type.Number()
        })
      }
    },
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      // Implementation with business context validation...
    }
  });
}
EOF

# 4. Register module
echo "export * from './newfeature/routes';" >> apps/api/src/modules/index.ts
```

### Frontend Component Development

#### Business-Aware Component Creation
```bash
# 1. Create component with business context template
mkdir -p apps/web/src/components/business
cat > apps/web/src/components/business/NewFeatureCard.tsx << 'EOF'
import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface NewFeatureCardProps {
  feature: {
    id: string;
    name: string;
    feature_type: string;
    business_name?: string;
    created: string;
  };
  onSelect?: (feature: any) => void;
  showBusiness?: boolean;
}

export function NewFeatureCard({ feature, onSelect, showBusiness = true }: NewFeatureCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onSelect?.(feature)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{feature.name}</h3>
          <Badge variant={feature.feature_type === 'operational' ? 'blue' : 'gray'}>
            {feature.feature_type}
          </Badge>
        </div>
        
        {showBusiness && feature.business_name && (
          <p className="text-sm text-gray-600 mb-2">
            Business: {feature.business_name}
          </p>
        )}
        
        <p className="text-xs text-gray-500">
          Created: {new Date(feature.created).toLocaleDateString()}
        </p>
      </div>
    </Card>
  );
}
EOF

# 2. Create page component
cat > apps/web/src/pages/NewFeaturePage.tsx << 'EOF'
import React from 'react';
import { Layout } from '../components/layout/Layout';
import { NewFeatureCard } from '../components/business/NewFeatureCard';
import { useList } from '../hooks/useList';
import { Grid, Plus } from 'lucide-react';

export function NewFeaturePage() {
  const { data: features, loading } = useList({
    endpoint: '/api/v1/newfeature',
    enabled: true
  });

  return (
    <Layout createButton={{ label: 'Add Feature', href: '/newfeature/new' }}>
      <div className="space-y-6">
        <div className="flex items-center">
          <Grid className="h-8 w-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">New Features</h1>
        </div>

        {loading ? (
          <div>Loading features...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <NewFeatureCard
                key={feature.id}
                feature={feature}
                onSelect={(f) => window.location.href = `/newfeature/${f.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
EOF

# 3. Add route
echo "import { NewFeaturePage } from './pages/NewFeaturePage';" >> apps/web/src/App.tsx
echo "<Route path=\"/newfeature\" element={<ProtectedRoute><NewFeaturePage /></ProtectedRoute>} />" >> apps/web/src/App.tsx
```

## Environment Configuration

### Development Environment Setup

#### Environment Variables
```bash
# Backend (.env)
DATABASE_URL="postgresql://app:app@localhost:5434/app"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
DEV_BYPASS_OIDC=true
NODE_ENV=development

# Frontend (.env)
VITE_API_BASE_URL=http://localhost:4000
VITE_ENABLE_DEBUG=true
VITE_COMPANY_NAME="Huron Home Services"
VITE_COMPANY_LOCATION="Mississauga, Ontario"
```

#### Development Scripts
```bash
# Start complete development environment
./tools/start-all.sh

# Individual service management
./tools/start-db.sh      # PostgreSQL + Redis
./tools/start-api.sh     # Backend API server
./tools/start-web.sh     # Frontend dev server

# Database management
./tools/db-import.sh     # Apply all DDL files
./tools/db-status.sh     # Check database status

# Testing
./tools/test-api-endpoints.sh  # Test API endpoints
pnpm typecheck             # TypeScript checking
pnpm lint                  # Code quality
```

## Adding New Features

### Feature Development Checklist

When adding new business functionality to the Huron Home Services platform:

#### 1. Database Design ✅
- [ ] Create DDL file with proper numbering (next available 40+)
- [ ] Follow standard field structure (id, name, descr, tags, attr, timestamps)
- [ ] Add business context foreign keys (`business_id`, `employee_id`, etc.)
- [ ] Include proper indexes for performance
- [ ] Create relationship tables with normalized structure
- [ ] Insert meaningful sample data with Canadian business context

#### 2. API Development ✅  
- [ ] Create module directory structure
- [ ] Define TypeBox schemas with business validation
- [ ] Implement CRUD endpoints with business scope filtering
- [ ] Add authentication and business authorization middleware
- [ ] Include business context in query responses
- [ ] Register routes in module index
- [ ] Test endpoints with real James Miller credentials

#### 3. Frontend Implementation ✅
- [ ] Add business-aware navigation item
- [ ] Create route with business context parameters
- [ ] Implement page following business entity pattern
- [ ] Add business filtering and scope validation
- [ ] Create reusable business-context components
- [ ] Implement proper loading states and error handling
- [ ] Add business-specific styling and branding

#### 4. Business Integration ✅
- [ ] Ensure proper business hierarchy access
- [ ] Validate employee role-based permissions  
- [ ] Test with different business scope assignments
- [ ] Verify geographic organizational context
- [ ] Check artifact ownership and access control
- [ ] Validate wiki content permissions

#### 5. Canadian Compliance ✅
- [ ] Follow PIPEDA personal information handling
- [ ] Implement Ontario regulatory requirements
- [ ] Add professional licensing tracking if applicable
- [ ] Include municipal compliance support
- [ ] Validate bilingual support (English/French)

### Example: Complete Feature Implementation

For a comprehensive example of implementing a new feature in the Huron Home Services platform, see the previous sections covering database schema design, API implementation, and frontend development with full business context integration.

This developer guide provides the complete foundation for building enterprise-grade features within the Canadian home services business context, ensuring all new development follows established patterns and maintains the sophisticated business logic that makes this platform production-ready.