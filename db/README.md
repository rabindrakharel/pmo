# PMO Database Schema - 5-Layer RBAC Architecture

A sophisticated **PostgreSQL database** implementing a **5-layer RBAC architecture** for comprehensive entity management and fine-grained access control in the **Huron Home Services PMO Platform**.

## 🏗️ Database Overview

### 🎯 System Specifications
- **Database Engine**: PostgreSQL 16+ with PostGIS, pgcrypto, uuid-ossp extensions
- **Architecture**: 5-layer RBAC system with 12 entity types
- **Tables**: 20+ core tables across foundation, rules, permissions, instances, and access control layers
- **Sample Data**: Complete Canadian business context - Huron Home Services operations
- **Employee Records**: 25+ employees from CEO to seasonal workers
- **Business Context**: Landscaping, snow removal, HVAC, plumbing, solar energy services

## 🏗️ 5-Layer RBAC Architecture

The database implements a sophisticated **5-layer permission architecture**:

```
🏗️ RBAC ARCHITECTURE FLOW
Layer 1: meta_entity_types (12 entity types) → Foundation Layer
    ↓ 
Layer 2: meta_entity_hierarchy (parent→child creation rules) → Rules Layer
    ↓ 
Layer 3: meta_entity_hierarchy_permission_mapping (permission matrix) → Permission Layer
    ↓
Layer 4: entity_id_hierarchy_mapping (actual instance relationships) → Instance Layer
    ↓
Layer 5: rel_employee_entity_action_rbac (specific user grants) → Access Control Layer
```

### **Layer 1: Foundation** (`15___meta_entity_types.ddl`)
Defines 12 core entity types across 4 categories:
- **Organizational**: hr, biz, org, client
- **Operational**: project, task, worksite  
- **Personnel**: employee, role
- **Content**: wiki, form, artifact

### **Layer 2: Rules** (`16___meta_entity_hierarchy.ddl`)
Defines parent-child creation relationships:
- Business units can create projects, wikis, forms
- Projects can create tasks, artifacts
- HR positions can create employee assignments

### **Layer 3: Permissions** (`18___meta_entity_hierarchy_permission_mapping.ddl`)
Permission matrix with granular actions:
- **Self-permissions**: view, edit, share on same entity type
- **Creation permissions**: create child entities within parent scope
- **Validation rules**: Enforces permission logic constraints

### **Layer 4: Instances** (`17___entity_id_hierarchy_mapping.ddl`)
Tracks actual relationships between entity instances:
- Maps project assignments to client relationships
- Links employees to business unit hierarchies
- Maintains temporal history of organizational changes

### **Layer 5: Access Control** (`19___rel_employee_entity_rbac.ddl`)
Individual user permissions on specific entities:
- James Miller (CEO) has comprehensive access across all entities
- Department managers have scope-limited permissions
- Field workers have task-specific access rights

## 📊 Core Business Entity Tables

### **Personnel System**
| **Table** | **File** | **Purpose** |
|-----------|----------|-------------|
| `d_employee` | `12___d_employee.ddl` | 25+ employees from CEO to seasonal workers |
| `d_role` | `13___d_role.ddl` | Executive to field worker role definitions |
| `rel_emp_role` | `14___rel_emp_role.ddl` | Employee-role assignments with temporal tracking |

### **Business Operations**
| **Table** | **File** | **Purpose** |
|-----------|----------|-------------|
| `d_biz` | `20___d_biz.ddl` | 3-level business hierarchy (Corp→Division→Dept) |
| `d_project` | `35___d_project.ddl` | 10+ strategic projects with full lifecycle management |
| `d_client` | `14___d_client.ddl` | 12+ diverse client portfolio |

### **Content Management**
| **Table** | **File** | **Purpose** |
|-----------|----------|-------------|
| `d_wiki` | `54___d_wiki.ddl` | Knowledge base and documentation |
| `d_artifact` | `27___d_artifact.ddl` | Design templates and business documents |
| `ops_formlog_head` | `50___ops_formlog_head.ddl` | Dynamic form definitions |

## 🎯 James Miller - CEO Comprehensive Access

The system implements **comprehensive permissions** for James Miller (CEO):

### **Self-Permissions** (view/edit/share):
- ✅ All business units (complete business hierarchy)
- ✅ All projects (entire project portfolio)
- ✅ All employees (full personnel management)
- ✅ All roles (complete role administration)
- ✅ All clients (client relationship management)
- ✅ All content entities (wikis, forms, tasks, artifacts)

### **Creation Permissions**:
- ✅ Business units → wiki, form, task, project, artifact creation
- ✅ Projects → wiki, form, task, artifact creation within scope
- ✅ Clients → project, task creation for engagement
- ✅ All hierarchical relationships with proper validation

## 🗂️ File Organization

### **DDL Loading Order** (Dependency-Optimized)
```
01___extensions.ddl                                    # PostgreSQL extensions
04___meta_entity_org_level.ddl → 21___d_org.ddl      # Geographic hierarchy
05___meta_entity_hr_level.ddl → 22___d_hr.ddl        # HR positions  
12___d_employee.ddl → 19___rel_employee_entity_rbac.ddl # Personnel → Permissions
15___meta_entity_types.ddl                            # Foundation layer
16___meta_entity_hierarchy.ddl                        # Rules layer
17___entity_id_hierarchy_mapping.ddl                  # Instance relationships
18___meta_entity_hierarchy_permission_mapping.ddl     # Permission matrix
20___d_biz.ddl                                        # Business hierarchy
35___d_project.ddl                                    # Project management
```

### **Database Tools**
```bash
./tools/db-import.sh      # Import complete schema and data
./tools/status.sh         # Check database status
```

## 🔧 Key Design Patterns

### **Standard Table Structure**
All dimension tables follow identical patterns:
```sql
CREATE TABLE app.your_entity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Standard fields (always first)
  name text NOT NULL,
  "descr" text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  attr jsonb NOT NULL DEFAULT '{}'::jsonb,
  from_ts timestamptz NOT NULL DEFAULT now(),
  to_ts timestamptz,
  active boolean NOT NULL DEFAULT true,
  created timestamptz NOT NULL DEFAULT now(),
  updated timestamptz NOT NULL DEFAULT now(),
  -- Entity-specific fields...
);
```

### **RBAC Integration**
Every entity automatically integrates with the 5-layer RBAC system:
1. **Entity type** defined in foundation layer
2. **Hierarchy rules** define creation relationships  
3. **Permission matrix** expands to granular actions
4. **Instance mapping** tracks actual relationships
5. **User grants** provide specific access rights

### **Temporal Data Support**
- **SCD Type 2**: Complete audit trails with `from_ts`/`to_ts`
- **Soft Deletes**: `active` boolean for status management
- **Audit Tracking**: `created`/`updated` timestamps on all records

## 🚀 Developer Resources

- **[Complete Onboarding Guide](./userguide.md)** - Step-by-step guide for adding new entities
- **[Schema Navigation Guide](../README.md#schema-navigation--er-relationships-guide)** - Architecture overview and relationships
- **[API Integration](../apps/api/README.md)** - Backend API modules and authentication

---

This database schema represents a **production-ready foundation** for enterprise project management with comprehensive RBAC, real Canadian business context, and scalable architecture supporting the complete Huron Home Services operations.



