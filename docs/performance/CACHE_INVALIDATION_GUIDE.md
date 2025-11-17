# Frontend Cache Invalidation Guide

> **Complete guide to clearing all frontend caches in the PMO platform**

**Created**: 2025-11-17
**Platform Version**: 3.3.0

---

## Overview

The PMO platform uses multiple layers of caching for performance. This guide explains how to invalidate each cache layer when needed.

## Cache Layers

| Cache Type | Location | TTL | Scope | Invalidation Method |
|------------|----------|-----|-------|---------------------|
| **Settings/Datalabel Cache** | Memory (Map) | 5 minutes | Per datalabel | `clearSettingsCache()` |
| **Settings Color Cache** | Memory (Map) | Permanent | Per datalabel | Manual clear needed |
| **Field Title Cache** | Memory (Map) | Permanent | Per field name | `clearFieldTitleCache()` |
| **Field Detection Cache** | Memory (Map) | Permanent | Per field+type | `clearFieldCache()` |
| **IndexedDB Cache** | Browser Storage | 7 days | All settings | `clearPersistedCache()` *(proposed)* |
| **Browser Cache** | HTTP Cache | Varies | API responses | Hard refresh |

---

## 1. Settings/Datalabel Cache (In-Memory)

### What It Caches
- Dropdown options from `setting_datalabel_*` tables
- Metadata including `color_code`, `sort_order`, `active_flag`
- TTL: 5 minutes

### When to Invalidate
- ✅ After updating settings in admin panel
- ✅ After importing new settings data
- ✅ After changing datalabel values
- ✅ On user logout (security)

### How to Invalidate

**File**: `apps/web/src/lib/settingsLoader.ts`

```typescript
import { clearSettingsCache } from '@/lib/settingsLoader';

// Clear ALL settings cache
clearSettingsCache();

// Clear specific datalabel only
clearSettingsCache('dl__project_stage');
```

### Implementation

```typescript
/**
 * Clear the settings cache (useful after updates)
 *
 * @param datalabel - Optional. If provided, clears only that datalabel.
 *                    If omitted, clears ALL settings cache.
 */
export function clearSettingsCache(datalabel?: string): void {
  if (datalabel) {
    settingsCache.delete(datalabel);
  } else {
    settingsCache.clear();
  }
}
```

### Usage Examples

```typescript
// Example 1: After updating project stages in settings
async function updateProjectStage(stageData: any) {
  await api.post('/api/v1/settings/dl__project_stage', stageData);

  // Invalidate cache for this datalabel
  clearSettingsCache('dl__project_stage');

  // Reload data
  const updatedOptions = await loadSettingOptions('dl__project_stage');
}

// Example 2: On logout
function handleLogout() {
  // Clear all settings cache
  clearSettingsCache();

  // Clear auth token
  localStorage.removeItem('auth_token');

  // Redirect to login
  window.location.href = '/login';
}

// Example 3: Global cache refresh button
function handleRefreshCache() {
  clearSettingsCache();
  clearFieldTitleCache();
  clearFieldCache();

  // Force reload current page
  window.location.reload();
}
```

---

## 2. Settings Color Cache (In-Memory)

### What It Caches
- Mapping of datalabel value → color_code
- Used for badge rendering
- No TTL (permanent until page refresh)

### Current Implementation

**File**: `apps/web/src/lib/universalFormatterService.ts`

```typescript
const settingsColorCache = new Map<string, Map<string, string>>();
// Structure: datalabel → (value → color_code)
```

### Problem: No Clear Function!

**Current Status**: ❌ No built-in clear function exists

### Solution: Add Clear Function

**Add to `universalFormatterService.ts`:**

```typescript
/**
 * Clear settings color cache
 * @param datalabel - Optional. If provided, clears only that datalabel.
 */
export function clearSettingsColorCache(datalabel?: string): void {
  if (datalabel) {
    settingsColorCache.delete(datalabel);
  } else {
    settingsColorCache.clear();
  }
}
```

**Add to exports at bottom of file:**

```typescript
export {
  // ... existing exports
  clearSettingsColorCache,
};
```

### Recommended Usage

```typescript
import { clearSettingsColorCache } from '@/lib/universalFormatterService';

// Clear after updating badge colors
function updateStageColor(datalabel: string, value: string, newColor: string) {
  // Update in database
  await api.patch(`/api/v1/settings/${datalabel}/${value}`, {
    color_code: newColor
  });

  // Invalidate cache
  clearSettingsColorCache(datalabel);

  // Reload to show new color
  await loadSettingsColors(datalabel);
}
```

---

## 3. Field Title Cache (In-Memory)

### What It Caches
- Generated field labels from column names
- Example: `budget_allocated_amt` → `"Budget Allocated"`
- No TTL (permanent until page refresh)

### How to Invalidate

**File**: `apps/web/src/lib/universalFormatterService.ts`

```typescript
import { clearFieldTitleCache } from '@/lib/universalFormatterService';

// Clear all cached field titles
clearFieldTitleCache();
```

### When to Invalidate
- ⚠️ **Rarely needed** - only if column naming logic changes
- Usually: Never needed in production

---

## 4. Field Detection Cache (In-Memory)

### What It Caches
- Field metadata from `detectField()` calls
- Pattern matching results (currency, date, boolean, etc.)
- No TTL (permanent until page refresh)

### How to Invalidate

**File**: `apps/web/src/lib/universalFormatterService.ts`

```typescript
import { clearFieldCache } from '@/lib/universalFormatterService';

// Clear all field detection cache
clearFieldCache();
```

### When to Invalidate
- ⚠️ **Rarely needed** - only if field detection logic changes
- Usually: Never needed in production

---

## 5. IndexedDB Persistent Cache (Proposed)

### Status: 🔜 Not Implemented Yet

See [FORMATTER_PERFORMANCE_OPTIMIZATION.md](./FORMATTER_PERFORMANCE_OPTIMIZATION.md) for implementation details.

### Proposed API

```typescript
import { clearPersistedCache } from '@/lib/settingsCache';

// Clear all IndexedDB cached settings
await clearPersistedCache();

// Clear specific datalabel
await clearPersistedSetting('dl__project_stage');
```

### When to Use
- On logout (security)
- After major settings updates
- On version upgrade (cache invalidation)

---

## 6. Browser HTTP Cache

### What It Caches
- API responses cached by browser
- Controlled by HTTP headers (`Cache-Control`, `ETag`)

### How to Clear

#### Method 1: Hard Refresh (User Action)
- **Chrome/Edge**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox**: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

#### Method 2: Programmatic Clear

```typescript
// Clear all caches (including HTTP cache)
if ('caches' in window) {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}
```

#### Method 3: Cache-Busting Query Parameter

```typescript
// Add timestamp to force fresh fetch
const timestamp = Date.now();
const response = await fetch(`/api/v1/entity/project/options?_=${timestamp}`);
```

---

## Complete Cache Invalidation Patterns

### Pattern 1: Clear All Caches (Nuclear Option)

```typescript
/**
 * Clear ALL frontend caches - use sparingly!
 */
export async function clearAllCaches(): Promise<void> {
  // 1. Settings cache (in-memory)
  clearSettingsCache();

  // 2. Color cache (in-memory)
  clearSettingsColorCache();

  // 3. Field detection cache (in-memory)
  clearFieldCache();

  // 4. Field title cache (in-memory)
  clearFieldTitleCache();

  // 5. IndexedDB cache (persistent)
  if (typeof clearPersistedCache === 'function') {
    await clearPersistedCache();
  }

  // 6. Browser HTTP cache
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }

  console.log('✅ All caches cleared');
}
```

**When to Use**:
- On logout
- After major database migrations
- During development/testing

### Pattern 2: Selective Cache Clear (Surgical Option)

```typescript
/**
 * Clear cache for specific entity type
 */
export function clearEntityCache(entityType: string): void {
  // Identify all datalabels related to this entity
  const datalabels = getEntityDatalabels(entityType);

  // Clear each datalabel cache
  datalabels.forEach(dl => {
    clearSettingsCache(dl);
    clearSettingsColorCache(dl);
  });

  console.log(`✅ Cache cleared for ${entityType}`);
}

// Example usage
clearEntityCache('project'); // Clears dl__project_stage, dl__project_type, etc.
```

**When to Use**:
- After updating entity-specific settings
- After importing entity data
- Less disruptive than full clear

### Pattern 3: Stale-While-Revalidate (Background Refresh)

```typescript
/**
 * Invalidate cache but allow stale data while refreshing
 */
export async function softInvalidateCache(datalabel: string): Promise<void> {
  // Mark as stale (set timestamp to 0)
  const cached = settingsCache.get(datalabel);
  if (cached) {
    cached.timestamp = 0; // Force stale
    settingsCache.set(datalabel, cached);
  }

  // Trigger background refresh
  loadSettingOptions(datalabel).catch(console.error);

  console.log(`⏳ Cache invalidated for ${datalabel}, refreshing in background`);
}
```

**When to Use**:
- When UX is critical (no loading spinner)
- After minor settings updates
- Better user experience

---

## Admin Panel Integration

### Add Cache Clear Button

**File**: `apps/web/src/pages/settings/SettingsPage.tsx`

```typescript
import { clearSettingsCache, clearSettingsColorCache } from '@/lib/settingsLoader';
import { clearFieldCache, clearFieldTitleCache } from '@/lib/universalFormatterService';

function SettingsPage() {
  const handleClearCache = async () => {
    const confirm = window.confirm(
      'Clear all settings cache? This will force reload all dropdown options.'
    );

    if (!confirm) return;

    try {
      // Clear all caches
      clearSettingsCache();
      clearSettingsColorCache();
      clearFieldCache();
      clearFieldTitleCache();

      // Show success message
      alert('✅ Cache cleared successfully!');

      // Reload page to show fresh data
      window.location.reload();

    } catch (error) {
      console.error('Cache clear failed:', error);
      alert('❌ Failed to clear cache');
    }
  };

  return (
    <div>
      <h1>Settings</h1>

      <button
        onClick={handleClearCache}
        className="btn btn-warning"
      >
        🔄 Clear Cache
      </button>

      {/* ... rest of settings UI */}
    </div>
  );
}
```

---

## Automatic Cache Invalidation

### On Logout

**File**: `apps/web/src/hooks/useAuth.ts`

```typescript
export function useAuth() {
  const logout = () => {
    // Clear all caches on logout (security best practice)
    clearSettingsCache();
    clearSettingsColorCache();
    clearFieldCache();
    clearFieldTitleCache();

    // Clear auth
    localStorage.removeItem('auth_token');

    // Redirect
    window.location.href = '/login';
  };

  return { logout };
}
```

### On Version Upgrade

**File**: `apps/web/src/App.tsx`

```typescript
const CURRENT_VERSION = '3.3.0';

function App() {
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');

    if (storedVersion !== CURRENT_VERSION) {
      console.log(`Version upgrade: ${storedVersion} → ${CURRENT_VERSION}`);

      // Clear all caches on version upgrade
      clearAllCaches();

      // Update stored version
      localStorage.setItem('app_version', CURRENT_VERSION);
    }
  }, []);

  return <div>...</div>;
}
```

### After Settings Update (Auto-Invalidate)

**File**: `apps/web/src/pages/settings/SettingsDataTable.tsx`

```typescript
async function handleSave(row: any) {
  // Save to API
  await api.patch(`/api/v1/settings/${datalabel}/${row.code}`, row);

  // Auto-invalidate cache for this datalabel
  clearSettingsCache(datalabel);
  clearSettingsColorCache(datalabel);

  // Reload options
  await loadSettingOptions(datalabel);

  console.log(`✅ Settings updated and cache invalidated: ${datalabel}`);
}
```

---

## Testing Cache Invalidation

### Test Scenario 1: Update Badge Color

```typescript
// 1. Load project stages (should cache)
const stages1 = await loadSettingOptions('dl__project_stage');
console.log('First load:', stages1);

// 2. Update color in database
await api.patch('/api/v1/settings/dl__project_stage/planning', {
  metadata: { color_code: 'red' } // Changed from blue
});

// 3. Load again WITHOUT clearing cache (should return old color)
const stages2 = await loadSettingOptions('dl__project_stage');
console.log('Cached load:', stages2); // Still shows blue ❌

// 4. Clear cache
clearSettingsCache('dl__project_stage');
clearSettingsColorCache('dl__project_stage');

// 5. Load again (should return new color)
const stages3 = await loadSettingOptions('dl__project_stage');
console.log('After clear:', stages3); // Shows red ✅
```

### Test Scenario 2: Cache TTL

```typescript
// 1. Load settings (t=0s)
await loadSettingOptions('dl__task_priority');

// 2. Wait 3 minutes (t=180s)
await new Promise(resolve => setTimeout(resolve, 180000));

// 3. Load again (should return from cache, TTL = 5min)
await loadSettingOptions('dl__task_priority'); // From cache ✅

// 4. Wait another 3 minutes (t=360s, exceeds 5min TTL)
await new Promise(resolve => setTimeout(resolve, 180000));

// 5. Load again (should fetch from API, cache expired)
await loadSettingOptions('dl__task_priority'); // Fresh fetch ✅
```

---

## Best Practices

### ✅ Do's

1. **Clear cache after settings updates** - Ensures users see latest data
2. **Clear all caches on logout** - Security best practice
3. **Use selective clearing** - Better performance than nuclear clear
4. **Log cache operations** - Helps debugging
5. **Test cache invalidation** - Verify it works as expected

### ❌ Don'ts

1. **Don't clear cache on every render** - Defeats purpose of caching
2. **Don't forget to reload after clear** - Users won't see changes
3. **Don't clear caches in hot path** - Performance impact
4. **Don't rely only on TTL** - Explicit invalidation is better
5. **Don't clear field detection cache** - Rarely needed

---

## Quick Reference

| Use Case | Function to Call |
|----------|------------------|
| **After updating settings** | `clearSettingsCache(datalabel)` |
| **After changing badge color** | `clearSettingsColorCache(datalabel)` |
| **On logout** | `clearAllCaches()` |
| **On version upgrade** | `clearAllCaches()` |
| **In development** | `clearAllCaches()` |
| **Rarely needed** | `clearFieldCache()`, `clearFieldTitleCache()` |

---

## Related Documentation

- [Universal Formatter Service](../services/UNIVERSAL_FORMATTER_SERVICE.md)
- [Performance Optimization](./FORMATTER_PERFORMANCE_OPTIMIZATION.md)
- [Settings System](../settings/settings.md)

---

## Troubleshooting

### Problem: Cache not clearing

**Check**:
1. Are you calling the right function?
2. Is the datalabel name correct? (use `dl__` prefix)
3. Did you reload after clearing?
4. Is browser caching the API response? (check Network tab)

**Solution**:
```typescript
// Nuclear option - clear everything and reload
clearAllCaches().then(() => window.location.reload());
```

### Problem: Stale data after update

**Check**:
1. Did you clear BOTH settings cache AND color cache?
2. Is the update actually saved in database?
3. Is the API returning the old data?

**Solution**:
```typescript
// Clear both caches
clearSettingsCache('dl__project_stage');
clearSettingsColorCache('dl__project_stage');

// Force fresh fetch with cache-busting
const fresh = await fetch(
  `/api/v1/entity/project_stage/options?_=${Date.now()}`
);
```

---

**Version**: 1.0.0 | **Last Updated**: 2025-11-17
