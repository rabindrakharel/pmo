import React, { useState, useEffect } from 'react';
import { Link2, ArrowDown, ArrowUp, Building2, Package, Settings } from 'lucide-react';
import { getIconComponent } from '../../lib/iconMapping';

interface EntityLinkageEditorProps {
  parentEntities: string[];
  childEntities: string[];
  onParentChange: (parents: string[]) => void;
  onChildChange: (children: string[]) => void;
}

interface EntityType {
  code: string;
  name: string;
  ui_label: string;
  ui_icon: string;
  display_order: number;
}

/**
 * EntityLinkageEditor Component
 *
 * Allows users to define parent-child relationships for the new entity.
 * - Parent entities: This entity can belong to...
 * - Child entities: This entity can contain...
 *
 * Fetches available entity types from API and displays them grouped by category.
 */
export function EntityLinkageEditor({
  parentEntities,
  childEntities,
  onParentChange,
  onChildChange
}: EntityLinkageEditorProps) {
  const [availableEntities, setAvailableEntities] = useState<EntityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntityTypes = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

        const response = await fetch(`${apiBaseUrl}/api/v1/entity/types`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAvailableEntities(data.filter((e: EntityType) => e.code !== 'entity')); // Exclude 'entity' itself
        }
      } catch (error) {
        console.error('Error fetching entity types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntityTypes();
  }, []);

  const handleParentToggle = (entityCode: string) => {
    if (parentEntities.includes(entityCode)) {
      onParentChange(parentEntities.filter(e => e !== entityCode));
    } else {
      onParentChange([...parentEntities, entityCode]);
    }
  };

  const handleChildToggle = (entityCode: string) => {
    if (childEntities.includes(entityCode)) {
      onChildChange(childEntities.filter(e => e !== entityCode));
    } else {
      onChildChange([...childEntities, entityCode]);
    }
  };

  // Group entities by category for better UX
  const coreEntities = availableEntities.filter(e =>
    ['business', 'office', 'project', 'task', 'client', 'employee'].includes(e.code)
  );

  const productEntities = availableEntities.filter(e =>
    ['product', 'inventory', 'order', 'shipment', 'invoice'].includes(e.code)
  );

  const otherEntities = availableEntities.filter(e =>
    !coreEntities.includes(e) && !productEntities.includes(e)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark-700"></div>
      </div>
    );
  }

  const EntityCheckboxGroup = ({
    title,
    icon: Icon,
    entities,
    selectedParents,
    selectedChildren
  }: {
    title: string;
    icon: React.ComponentType<any>;
    entities: EntityType[];
    selectedParents: string[];
    selectedChildren: string[];
  }) => {
    if (entities.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-dark-600" />
          <h4 className="text-sm font-medium text-dark-700">{title}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {entities.map((entity) => {
            const EntityIcon = getIconComponent(entity.ui_icon);
            const isParent = selectedParents.includes(entity.code);
            const isChild = selectedChildren.includes(entity.code);

            return (
              <div
                key={entity.code}
                className="bg-white border border-dark-300 rounded-md p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="p-2 bg-dark-100 rounded-md">
                      <EntityIcon className="h-4 w-4 text-dark-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-900 mb-2">
                      {entity.name}
                    </p>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs text-dark-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isParent}
                          onChange={() => handleParentToggle(entity.code)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <ArrowUp className="h-3 w-3" />
                        <span>Can be parent</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-dark-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChild}
                          onChange={() => handleChildToggle(entity.code)}
                          className="w-4 h-4 text-green-600 rounded"
                        />
                        <ArrowDown className="h-3 w-3" />
                        <span>Can be child</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Link2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Entity Relationships
            </h4>
            <p className="text-xs text-blue-700 mb-2">
              Define how this entity relates to other entities in your system.
            </p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>
                <strong>Parent entities:</strong> This entity can belong to these entities
                (e.g., a Task can belong to a Project)
              </li>
              <li>
                <strong>Child entities:</strong> This entity can contain these entities
                (e.g., a Project can contain Tasks)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Summary */}
      {(parentEntities.length > 0 || childEntities.length > 0) && (
        <div className="bg-dark-50 border border-dark-300 rounded-lg p-4">
          <h4 className="text-sm font-medium text-dark-700 mb-2">Selected Relationships</h4>
          <div className="flex flex-col gap-2 text-sm">
            {parentEntities.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 text-blue-600" />
                <span className="text-dark-600">
                  Parents: <strong>{parentEntities.join(', ')}</strong>
                </span>
              </div>
            )}
            {childEntities.length > 0 && (
              <div className="flex items-center gap-2">
                <ArrowDown className="h-4 w-4 text-green-600" />
                <span className="text-dark-600">
                  Children: <strong>{childEntities.join(', ')}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Entity Selection */}
      <EntityCheckboxGroup
        title="Core Entities"
        icon={Building2}
        entities={coreEntities}
        selectedParents={parentEntities}
        selectedChildren={childEntities}
      />

      <EntityCheckboxGroup
        title="Product & Operations"
        icon={Package}
        entities={productEntities}
        selectedParents={parentEntities}
        selectedChildren={childEntities}
      />

      <EntityCheckboxGroup
        title="Other Entities"
        icon={Settings}
        entities={otherEntities}
        selectedParents={parentEntities}
        selectedChildren={childEntities}
      />
    </div>
  );
}
