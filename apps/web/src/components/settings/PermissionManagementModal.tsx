import { useState, useEffect } from 'react';
import { X, Shield, Users, Database } from 'lucide-react';
import { EntityInstancePicker } from '../shared/EntityInstancePicker';
import { useEntityInstancePicker } from '../../hooks/useEntityInstancePicker';

interface Entity {
  code: string;
  name: string;
  ui_label: string;
}

interface Role {
  id: string;
  name: string;
  role_code?: string;
  role_category?: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  title?: string;
}

interface PermissionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const PERMISSION_LEVELS = [
  { value: 0, label: 'View', description: 'Read access to entity data', color: 'bg-blue-100 text-blue-800' },
  { value: 1, label: 'Edit', description: 'Modify existing entity (inherits View)', color: 'bg-green-100 text-green-800' },
  { value: 2, label: 'Share', description: 'Share entity with others (inherits Edit + View)', color: 'bg-yellow-100 text-yellow-800' },
  { value: 3, label: 'Delete', description: 'Soft delete entity (inherits Share + Edit + View)', color: 'bg-orange-100 text-orange-800' },
  { value: 4, label: 'Create', description: 'Create new entities (inherits all lower permissions)', color: 'bg-purple-100 text-purple-800' },
  { value: 5, label: 'Owner', description: 'Full control including permission management', color: 'bg-red-100 text-red-800' },
];

export function PermissionManagementModal({ isOpen, onClose, onSave }: PermissionManagementModalProps) {
  const [personType, setPersonType] = useState<'role' | 'employee'>('role');
  const [selectedPerson, setSelectedPerson] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedEntityInstance, setSelectedEntityInstance] = useState<'all' | string>('all');
  const [selectedPermission, setSelectedPermission] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string>('');

  const [roles, setRoles] = useState<Role[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use the hook to get instance data for summary display
  const { instances } = useEntityInstancePicker({
    entityCode: selectedEntity || null,
    enabled: selectedEntityInstance !== 'all' && !!selectedEntity
  });

  // Fetch roles, employees, and entities
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Fetch roles
      const rolesRes = await fetch(`${apiBaseUrl}/api/v1/role?limit=100`, { headers });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      // Fetch employees
      const employeesRes = await fetch(`${apiBaseUrl}/api/v1/employee?limit=100`, { headers });
      if (employeesRes.ok) {
        const employeesData = await employeesRes.json();
        setEmployees(employeesData.data || []);
      }

      // Fetch entities
      const entitiesRes = await fetch(`${apiBaseUrl}/api/v1/entity/types`, { headers });
      if (entitiesRes.ok) {
        const entitiesData = await entitiesRes.json();
        setEntities(entitiesData.entities || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantPermission = async () => {
    // Validation
    if (!selectedPerson) {
      alert('Please select a role or employee');
      return;
    }

    if (!selectedEntity) {
      alert('Please select an entity type');
      return;
    }

    if (selectedEntityInstance !== 'all' && !selectedEntityInstance) {
      alert('Please select a specific entity instance or choose "Type-Level" for all instances');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

      const payload = {
        person_entity_name: personType,
        person_entity_id: selectedPerson,
        entity_name: selectedEntity,
        entity_id: selectedEntityInstance,
        permission: selectedPermission,
        expires_ts: expiresAt || null,
      };

      const response = await fetch(`${apiBaseUrl}/api/v1/rbac/grant-permission`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert('Permission granted successfully!');
        onSave?.();
        onClose();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error || 'Failed to grant permission'}`);
      }
    } catch (error) {
      console.error('Error granting permission:', error);
      alert('Failed to grant permission');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-300">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-dark-900">Grant Permission</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Person Type Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-2">
                  Grant Permission To:
                </label>
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setPersonType('role');
                      setSelectedPerson('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-all ${
                      personType === 'role'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-dark-300 text-dark-700 hover:border-dark-400'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Role
                  </button>
                  <button
                    onClick={() => {
                      setPersonType('employee');
                      setSelectedPerson('');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md border transition-all ${
                      personType === 'employee'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-white border-dark-300 text-dark-700 hover:border-dark-400'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    Employee
                  </button>
                </div>
              </div>

              {/* Person Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-2">
                  Select {personType === 'role' ? 'Role' : 'Employee'}:
                </label>
                <select
                  value={selectedPerson}
                  onChange={(e) => setSelectedPerson(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select {personType === 'role' ? 'Role' : 'Employee'} --</option>
                  {personType === 'role'
                    ? roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} {role.role_code ? `(${role.role_code})` : ''}
                        </option>
                      ))
                    : employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} - {employee.email}
                        </option>
                      ))}
                </select>
              </div>

              {/* Entity Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-2">
                  <Database className="h-4 w-4 inline mr-1" />
                  Select Entity Type:
                </label>
                <select
                  value={selectedEntity}
                  onChange={(e) => setSelectedEntity(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Entity --</option>
                  {entities.map((entity) => (
                    <option key={entity.code} value={entity.code}>
                      {entity.name} ({entity.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity Instance Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-2">
                  Permission Scope:
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="scope-all"
                      checked={selectedEntityInstance === 'all'}
                      onChange={() => setSelectedEntityInstance('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="scope-all" className="text-sm text-dark-700">
                      Type-Level: All instances of {selectedEntity || 'entity'} (entity_id='all')
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      id="scope-specific"
                      checked={selectedEntityInstance !== 'all'}
                      onChange={() => setSelectedEntityInstance('')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="scope-specific" className="text-sm text-dark-700">
                      Instance-Level: Specific {selectedEntity || 'entity'} instance
                    </label>
                  </div>

                  {/* Entity Instance Picker (shown when Instance-Level is selected) */}
                  {selectedEntityInstance !== 'all' && selectedEntity && (
                    <div className="ml-6 mt-3">
                      <EntityInstancePicker
                        entityCode={selectedEntity}
                        selectedInstanceId={selectedEntityInstance === '' ? null : selectedEntityInstance}
                        onSelect={(id) => setSelectedEntityInstance(id)}
                        showAllOption={false}
                        placeholder={`Search ${entities.find(e => e.code === selectedEntity)?.name || selectedEntity} by name...`}
                        maxHeight="300px"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Permission Level Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-3">
                  Permission Level:
                </label>
                <div className="space-y-2">
                  {PERMISSION_LEVELS.map((level) => (
                    <div
                      key={level.value}
                      onClick={() => setSelectedPermission(level.value)}
                      className={`p-3 rounded-md border cursor-pointer transition-all ${
                        selectedPermission === level.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-dark-300 hover:border-dark-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            checked={selectedPermission === level.value}
                            onChange={() => setSelectedPermission(level.value)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded font-medium ${level.color}`}>
                                {level.value}
                              </span>
                              <span className="font-medium text-dark-900">{level.label}</span>
                            </div>
                            <p className="text-xs text-dark-600 mt-1">{level.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Expiration */}
              <div>
                <label className="block text-sm font-medium text-dark-900 mb-2">
                  Expiration (Optional):
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Leave empty for permanent permission. Use for temporary contractor access.
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm">
                <p className="text-blue-900 font-medium mb-2">Permission Grant Summary:</p>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>• <strong>Person:</strong> {personType} - {
                    selectedPerson
                      ? personType === 'role'
                        ? roles.find(r => r.id === selectedPerson)?.name || 'Unknown'
                        : employees.find(e => e.id === selectedPerson)?.name || 'Unknown'
                      : 'Not selected'
                  }</li>
                  <li>• <strong>Entity Type:</strong> {
                    selectedEntity
                      ? entities.find(e => e.code === selectedEntity)?.name || selectedEntity
                      : 'Not selected'
                  }</li>
                  <li>• <strong>Scope:</strong> {
                    selectedEntityInstance === 'all'
                      ? `All ${entities.find(e => e.code === selectedEntity)?.name || 'entities'}`
                      : selectedEntityInstance
                        ? instances.find(i => i.id === selectedEntityInstance)?.name || `Specific instance (${selectedEntityInstance.slice(0, 8)}...)`
                        : 'Not selected'
                  }</li>
                  <li>• <strong>Permission:</strong> Level {selectedPermission} - {PERMISSION_LEVELS[selectedPermission]?.label}</li>
                  <li>• <strong>Expires:</strong> {expiresAt || 'Never'}</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-300">
          <button
            onClick={onClose}
            className="px-4 py-2 text-dark-700 hover:bg-dark-100 rounded-md transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleGrantPermission}
            disabled={saving || !selectedPerson || !selectedEntity}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Granting...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Grant Permission
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
