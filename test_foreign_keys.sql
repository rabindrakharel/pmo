-- Test foreign key constraints
-- This script verifies that all foreign key constraints are properly configured

\echo 'Testing foreign key constraints in PMO database...'

-- Check that d_scope_project.biz_id references d_scope_biz
SELECT 
  'project->biz' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_scope_project'
  AND ccu.column_name = 'id'
  AND ccu.table_name = 'd_scope_biz';

-- Check that ops_task_head.biz_id references d_scope_biz  
SELECT 
  'task->biz' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'ops_task_head'
  AND ccu.column_name = 'id'
  AND ccu.table_name = 'd_scope_biz';

-- Check that d_employee has foreign keys to hr, biz, and org
SELECT 
  'employee->hr' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_employee'
  AND ccu.table_name = 'd_scope_hr';

SELECT 
  'employee->biz' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_employee'
  AND ccu.table_name = 'd_scope_biz';

SELECT 
  'employee->org' as test,
  tc.constraint_name,  
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_employee'
  AND ccu.table_name = 'd_scope_org';

\echo 'Foreign key constraint test completed.'