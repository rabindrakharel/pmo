-- Test entity table references
-- This script verifies that all foreign key references to entity tables are correct

\echo 'Testing entity table references consistency...'

-- Test that d_biz references entity_org_level correctly
SELECT 
  'biz->entity_org_level' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_biz'
  AND ccu.table_name = 'entity_org_level';

-- Test that d_hr references entity_org_level correctly  
SELECT 
  'hr->entity_org_level' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_hr'
  AND ccu.table_name = 'entity_org_level';

-- Test that d_org references entity_org_level correctly
SELECT 
  'org->entity_org_level' as test,
  tc.constraint_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'app'
  AND tc.table_name = 'd_org'
  AND ccu.table_name = 'entity_org_level';

\echo 'Entity table reference test completed.'