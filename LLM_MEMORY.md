# LLM Memory – PMO Enterprise Platform

## 1. Project Snapshot
- Canadian home-services PMO solution for Huron Home Services; core flows cover projects, tasks, clients, and RBAC-driven operations (`README.md`).
- Monorepo delivers Fastify API, React 19 frontend, and Postgres schema; scripts in `tools/` orchestrate containerized services.
- Settings architecture recently audited and normalized to snake_case categories across DDL, API, and web config (`SETTINGS_AUDIT_REPORT.md`).

## 2. System Architecture
- **Frontend (`apps/web`)**: Vite + React + Tailwind. Entity behavior centralized in `apps/web/src/lib/entityConfig.ts`, covering columns, forms, settings-driven dropdowns, and child-tab routing. Layout + navigation components live under `apps/web/src/components/`.
- **Backend (`apps/api`)**: Fastify service exposing `/api/v1/<entity>` endpoints; enforces RBAC and JWT authentication (see `apps/api/README.md`).
- **Database (`db`)**: Postgres 14+ schema `app` with 29 tables. Relationships are managed by linker tables (`entity_id_map`, `entity_id_rbac_map`, `rel_emp_role`) instead of foreign keys (`db/README.md`). Each DDL file includes semantics, create statements, and curated seed data.

## 3. Data Model & Settings Landscape
- **Core entities (13)** include offices, businesses, projects, tasks, employees, clients, worksites, positions, roles, artifacts, wiki, forms, and reports (`README.md`, `db/README.md`).
- **Settings tables (10 confirmed)**: `setting_office_level`, `setting_business_level`, `setting_project_stage`, `setting_task_stage`, `setting_client_level`, `setting_position_level`, `setting_customer_tier`, `setting_opportunity_funnel_level`, `setting_industry_sector`, `setting_acquisition_channel`.
- **Missing DDL coverage**: `setting_project_status`, `setting_task_status`, `setting_hr_level` are referenced historically but absent from DDL source of truth; either remove references or author new `.ddl` files and register them in `tools/db-import.sh` (`SETTINGS_AUDIT_REPORT.md`).
- **Naming convention**: snake_case for all API categories, settings identifiers, and DB columns. Only TypeScript type names remain camelCase. Audit removed kebabCase/mixed-case fallbacks (`SETTINGS_AUDIT_REPORT.md`, `entityConfig.ts`).
- **Frontend settings usage**: entity config fields marked with `loadOptionsFromSettings` expect matching snake_case categories (e.g., `project_stage`, `customer_tier`) and rely on `/api/v1/setting?category=<name>` responses.

## 4. RBAC & Permission Model
- `entity_id_rbac_map` stores per-entity permission arrays `{0:view,1:edit,2:share,3:delete,4:create}`. `entity_id='all'` grants type-wide access; UUIDs scope to single records (`README.md`, `CLAUDE.md`).
- Permission checks combine multiple rows; creating a project plus assigning to a business requires `project` create and specific `biz` edit rights.
- All seeded access focuses on James Miller (ID `8260b1b0-5efc-4611-ad33-ee76c0cf7f13`), who currently owns full platform permissions.

## 5. Tooling & Operational Workflows
- **Startup**: `./tools/start-all.sh` boots Docker stack (Postgres, Redis, MinIO, MailHog), loads schema, and runs API (4000) + web (5173) servers (`tools/README.md`).
- **Schema management**: `./tools/db-import.sh` drops/reimports all 28 DDL files; supports `--dry-run`, `--verbose`, `--skip-validation`. Any new DDL must be added to its import list and re-run (`db/README.md`, `tools/README.md`).
- **API verification**: `./tools/test-api.sh METHOD PATH [JSON]` performs authenticated calls with formatted output. Example: `./tools/test-api.sh GET /api/v1/project`.
- **Logs**: `./tools/logs-api.sh` and `./tools/logs-web.sh` tail service output for diagnostics.

## 6. Testing Accounts & Environments
- **Primary test user**: James Miller (`james.miller@huronhome.ca` / `password123`). Credentials are hard-coded for tooling and should be used by agents when authenticating (`README.md`, `CLAUDE.md`, `tools/README.md`).
- Internal environments default to `http://localhost:5173` (web) and `http://localhost:4000` (API/docs). Modify via `API_URL`, `API_TEST_EMAIL`, `API_TEST_PASSWORD`, `NO_AUTH` environment variables when running test scripts.

## 7. Outstanding Actions & Watchpoints
- Purge or retrofit legacy settings references (`projectStatus`, `taskStatus`, `hrLevel`) in frontend configs and Settings UI; align to validated table list (`SETTINGS_AUDIT_REPORT.md`).
- If business logic requires the missing settings, author DDL files with full semantics/data blocks and register them with the import script (`db/README.md` guidelines).
- Maintain snake_case discipline for any new API categories, database columns, and settings metadata to prevent regression of the audit fixes.
- When curating data, ensure dependencies (e.g., level IDs) match existing settings and re-run `db-import.sh` to validate sample data integrity (`db/README.md`).
