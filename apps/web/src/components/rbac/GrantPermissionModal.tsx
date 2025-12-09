import React, { useState, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { PermissionLevelSelector, PermissionBadge, getPermissionLabel, PERMISSION_LEVELS } from './PermissionLevelSelector';
import { InheritanceModeSelector, InheritanceModeBadge, InheritanceMode } from './InheritanceModeSelector';
import { ChildPermissionMapper } from './ChildPermissionMapper';
import { EntityInstancePicker } from '../shared/EntityInstancePicker';
import { API_CONFIG } from '../../lib/config/api';

interface Entity {
  code: string;
  name: string;
  ui_label: string;
  ui_icon?: string;
  child_entity_codes?: string[];
}

interface GrantPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: string;
  roleName: string;
  onSuccess?: () => void;
}

// Step configuration
type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1 as Step, label: 'Target', description: 'What to grant access to' },
  { number: 2 as Step, label: 'Permission', description: 'Access level' },
  { number: 3 as Step, label: 'Inheritance', description: 'Child entity behavior' },
  { number: 4 as Step, label: 'Options', description: 'Special settings' }
];

const ALL_ENTITIES_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Grant Permission Modal
 * 4-step wizard for granting permissions with inheritance configuration
 */
export function GrantPermissionModal({
  isOpen,
  onClose,
  roleId,
  roleName,
  onSuccess
}: GrantPermissionModalProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Form state
  const [entityCode, setEntityCode] = useState('');
  const [scope, setScope] = useState<'all' | 'specific'>('all');
  const [entityInstanceId, setEntityInstanceId] = useState<string | null>(null);
  const [permission, setPermission] = useState(0);
  const [inheritanceMode, setInheritanceMode] = useState<InheritanceMode>('none');
  const [childPermissions, setChildPermissions] = useState<Record<string, number>>({ _default: 0 });
  const [isDeny, setIsDeny] = useState(false);
  const [expiresTs, setExpiresTs] = useState('');

  // Data loading
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected entity details
  const selectedEntity = useMemo(() => {
    return entities.find(e => e.code === entityCode);
  }, [entities, entityCode]);

  // Entity labels for child permission mapper
  const entityLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    entities.forEach(e => {
      labels[e.code] = e.ui_label || e.name;
    });
    return labels;
  }, [entities]);

  const entityIcons = useMemo(() => {
    const icons: Record<string, string> = {};
    entities.forEach(e => {
      if (e.ui_icon) icons[e.code] = e.ui_icon;
    });
    return icons;
  }, [entities]);

  // Fetch entities
  useEffect(() => {
    if (isOpen) {
      fetchEntities();
    }
  }, [isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setEntityCode('');
      setScope('all');
      setEntityInstanceId(null);
      setPermission(0);
      setInheritanceMode('none');
      setChildPermissions({ _default: 0 });
      setIsDeny(false);
      setExpiresTs('');
      setError(null);
    }
  }, [isOpen]);

  const fetchEntities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/entity/types`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json();
        // API returns {data: [...]} structure
        setEntities(Array.isArray(result) ? result : (result.data || []));
      }
    } catch (err) {
      console.error('Error fetching entities:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const payload: Record<string, unknown> = {
        role_id: roleId,
        entity_code: entityCode,
        entity_instance_id: scope === 'all' ? ALL_ENTITIES_ID : entityInstanceId,
        permission,
        inheritance_mode: inheritanceMode,
        child_permissions: inheritanceMode === 'mapped' ? childPermissions : {},
        is_deny: isDeny,
      };
      // Only include expires_ts if it has a value (not empty string)
      if (expiresTs && expiresTs.trim() !== '') {
        payload.expires_ts = new Date(expiresTs).toISOString();
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/v1/entity_rbac/grant-permission`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to grant permission');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!entityCode && (scope === 'all' || !!entityInstanceId);
      case 2:
        return true; // Permission always has a default value
      case 3:
        return true; // Inheritance mode always has a default value
      case 4:
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  if (!isOpen) return null;

  const getEntityIcon = (code: string) => {
    const entity = entities.find(e => e.code === code);
    const iconName = entity?.ui_icon;
    if (iconName && (LucideIcons as any)[iconName]) {
      const Icon = (LucideIcons as any)[iconName];
      return <Icon className="h-5 w-5" />;
    }
    return <LucideIcons.Box className="h-5 w-5" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-dark-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl">
              <LucideIcons.Shield className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-dark-800">Grant Permission</h2>
              <p className="text-sm text-dark-500">to {roleName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-dark-600 hover:bg-dark-100 rounded-lg transition-colors"
          >
            <LucideIcons.X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 bg-dark-50 border-b border-dark-200">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.number}>
                <button
                  type="button"
                  onClick={() => step.number < currentStep && setCurrentStep(step.number)}
                  disabled={step.number > currentStep}
                  className={`flex items-center gap-2 transition-colors ${
                    step.number === currentStep
                      ? "text-slate-700"
                      : step.number < currentStep
                        ? "text-dark-600 hover:text-slate-600"
                        : "text-dark-400"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    step.number === currentStep
                      ? "bg-slate-600 text-white"
                      : step.number < currentStep
                        ? "bg-slate-200 text-slate-700"
                        : "bg-dark-200 text-dark-500"
                  }`}>
                    {step.number < currentStep ? (
                      <LucideIcons.Check className="h-4 w-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium">{step.label}</div>
                    <div className="text-xs text-dark-500">{step.description}</div>
                  </div>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded ${
                    step.number < currentStep ? "bg-slate-300" : "bg-dark-200"
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600" />
            </div>
          ) : (
            <>
              {/* Step 1: Target Selection */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 mb-2">
                      Entity Type *
                    </label>
                    <select
                      value={entityCode}
                      onChange={(e) => {
                        setEntityCode(e.target.value);
                        setEntityInstanceId(null);
                      }}
                      className="w-full px-4 py-3 text-sm border border-dark-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                    >
                      <option value="">Select entity type...</option>
                      {entities.map((entity) => (
                        <option key={entity.code} value={entity.code}>
                          {entity.ui_label || entity.name} ({entity.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {entityCode && (
                    <div>
                      <label className="block text-sm font-medium text-dark-700 mb-3">
                        Scope
                      </label>
                      <div className="space-y-3">
                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          scope === 'all'
                            ? "border-slate-500 bg-slate-50"
                            : "border-dark-200 hover:border-dark-300"
                        }`}>
                          <input
                            type="radio"
                            checked={scope === 'all'}
                            onChange={() => {
                              setScope('all');
                              setEntityInstanceId(null);
                            }}
                            className="w-5 h-5 text-slate-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <LucideIcons.Globe className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium text-dark-800">
                                All {selectedEntity?.ui_label || entityCode}s (Type-Level)
                              </span>
                            </div>
                            <p className="text-xs text-dark-500 mt-1">
                              Permission applies to all instances, current and future
                            </p>
                          </div>
                        </label>

                        <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          scope === 'specific'
                            ? "border-slate-500 bg-slate-50"
                            : "border-dark-200 hover:border-dark-300"
                        }`}>
                          <input
                            type="radio"
                            checked={scope === 'specific'}
                            onChange={() => setScope('specific')}
                            className="w-5 h-5 text-slate-600 mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <LucideIcons.Target className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-dark-800">
                                Specific Instance
                              </span>
                            </div>
                            <p className="text-xs text-dark-500 mt-1 mb-3">
                              Permission applies to one specific {selectedEntity?.ui_label || entityCode}
                            </p>

                            {scope === 'specific' && (
                              <EntityInstancePicker
                                entityCode={entityCode}
                                selectedInstanceId={entityInstanceId}
                                onSelect={setEntityInstanceId}
                                placeholder={`Search ${selectedEntity?.ui_label || entityCode}...`}
                              />
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Permission Level */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-dark-100 rounded-full">
                      {getEntityIcon(entityCode)}
                      <span className="font-medium text-dark-700">
                        {selectedEntity?.ui_label || entityCode}
                      </span>
                      {scope === 'all' ? (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          All Instances
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Specific Instance
                        </span>
                      )}
                    </div>
                  </div>

                  <PermissionLevelSelector
                    value={permission}
                    onChange={setPermission}
                    showDeny={false}
                  />
                </div>
              )}

              {/* Step 3: Inheritance Configuration */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-sm text-slate-700">
                      <strong>Current Selection:</strong> {getPermissionLabel(permission)} on{' '}
                      {scope === 'all' ? `all ${selectedEntity?.ui_label || entityCode}s` : 'specific instance'}
                    </div>
                  </div>

                  <InheritanceModeSelector
                    value={inheritanceMode}
                    onChange={setInheritanceMode}
                  />

                  {/* Child Permission Mapper (for mapped mode) */}
                  {inheritanceMode === 'mapped' && selectedEntity?.child_entity_codes && (
                    <ChildPermissionMapper
                      value={childPermissions}
                      onChange={setChildPermissions}
                      childEntityCodes={selectedEntity.child_entity_codes}
                      entityLabels={entityLabels}
                      entityIcons={entityIcons}
                    />
                  )}

                  {/* Info about inheritance modes */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-start gap-2">
                      <LucideIcons.Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-700">
                        {inheritanceMode === 'none' && (
                          <span>Permission applies only to the selected entity. Child entities won't inherit any permissions.</span>
                        )}
                        {inheritanceMode === 'cascade' && (
                          <span>All child entities will receive the same permission level ({getPermissionLabel(permission)}) recursively.</span>
                        )}
                        {inheritanceMode === 'mapped' && (
                          <span>Configure different permission levels for each child entity type. Unlisted types use the default.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Special Options */}
              {currentStep === 4 && (
                <div className="space-y-6">
                  {/* Explicit Deny Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 mb-3">
                      Special Options
                    </label>
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isDeny
                        ? "border-red-400 bg-red-50"
                        : "border-dark-200 hover:border-dark-300"
                    }`}>
                      <input
                        type="checkbox"
                        checked={isDeny}
                        onChange={(e) => setIsDeny(e.target.checked)}
                        className="w-5 h-5 text-red-600 rounded mt-0.5"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <LucideIcons.ShieldOff className="h-4 w-4 text-red-500" />
                          <span className="font-medium text-red-700">Explicit DENY</span>
                        </div>
                        <p className="text-xs text-red-600 mt-1">
                          Blocks this permission even if granted elsewhere. Use for restricted access.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Expiration */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 mb-2">
                      Expiration (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={expiresTs}
                      onChange={(e) => setExpiresTs(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-dark-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-400"
                    />
                    <p className="text-xs text-dark-500 mt-2">
                      Leave empty for permanent permission. Use for temporary access like contractors.
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-sm font-medium text-slate-700 mb-3">Preview</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 w-24">Role:</span>
                        <span className="font-medium text-dark-800">{roleName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 w-24">Entity:</span>
                        <div className="flex items-center gap-2">
                          {getEntityIcon(entityCode)}
                          <span className="font-medium text-dark-800">
                            {selectedEntity?.ui_label || entityCode}
                          </span>
                          {scope === 'all' && (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">All</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 w-24">Permission:</span>
                        <PermissionBadge level={permission} isDeny={isDeny} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-dark-500 w-24">Inheritance:</span>
                        <InheritanceModeBadge mode={inheritanceMode} size="sm" />
                      </div>
                      {inheritanceMode === 'mapped' && Object.keys(childPermissions).length > 0 && (
                        <div className="flex items-start gap-2">
                          <span className="text-dark-500 w-24">Children:</span>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(childPermissions).map(([code, level]) => (
                              <span key={code} className="text-xs bg-dark-100 px-2 py-0.5 rounded">
                                {code === '_default' ? '*' : entityLabels[code] || code} → {getPermissionLabel(level)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {expiresTs && (
                        <div className="flex items-center gap-2">
                          <span className="text-dark-500 w-24">Expires:</span>
                          <span className="text-amber-600">{new Date(expiresTs).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <LucideIcons.AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-200 bg-dark-50">
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : prevStep}
            className="px-4 py-2 text-sm font-medium text-dark-700 hover:bg-dark-100 rounded-lg transition-colors"
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-dark-500">
              Step {currentStep} of {STEPS.length}
            </span>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:outline-none shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <LucideIcons.ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-slate-600 text-white rounded-lg hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:outline-none shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Granting...
                  </>
                ) : (
                  <>
                    <LucideIcons.Shield className="h-4 w-4" />
                    Grant Permission
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
