import React from 'react';
import { Database, Activity } from 'lucide-react';

interface EntityTypeSelectorProps {
  value: 'attribute' | 'transactional';
  onChange: (type: 'attribute' | 'transactional') => void;
}

/**
 * EntityTypeSelector Component
 *
 * Allows users to choose between two entity types:
 * - Attribute-based: Stores properties/characteristics (like settings, categories, people)
 * - Transactional: Stores events/measurements (like sales, tasks, forms)
 *
 * Uses user-friendly terminology instead of "Dimension" and "Fact" tables.
 */
export function EntityTypeSelector({ value, onChange }: EntityTypeSelectorProps) {
  const entityTypes = [
    {
      id: 'attribute' as const,
      name: 'Attribute-based Entity',
      icon: Database,
      description: 'Stores properties, characteristics, or reference data',
      examples: [
        'Settings and categories (product types, task priorities)',
        'People and organizations (employees, clients, vendors)',
        'Locations and hierarchies (offices, departments)',
        'Reference data that changes slowly over time'
      ],
      color: 'blue'
    },
    {
      id: 'transactional' as const,
      name: 'Transactional Entity',
      icon: Activity,
      description: 'Stores events, measurements, or time-series data',
      examples: [
        'Business transactions (orders, invoices, payments)',
        'Activities and events (tasks, meetings, form submissions)',
        'Measurements and metrics (performance data, usage stats)',
        'Data that accumulates over time with timestamps'
      ],
      color: 'green'
    }
  ];

  return (
    <div className="space-y-4">
      {entityTypes.map((type) => {
        const isSelected = value === type.id;
        const Icon = type.icon;

        return (
          <div
            key={type.id}
            onClick={() => onChange(type.id)}
            className={`
              relative p-5 rounded-md border-2 cursor-pointer transition-all
              ${isSelected
                ? `border-${type.color}-500 bg-${type.color}-50`
                : 'border-dark-300 bg-white hover:border-dark-400'
              }
            `}
          >
            {/* Radio Button */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${isSelected
                    ? `border-${type.color}-500 bg-${type.color}-500`
                    : 'border-dark-400'
                  }
                `}>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`
                    p-2 rounded-md
                    ${isSelected
                      ? `bg-${type.color}-100`
                      : 'bg-dark-100'
                    }
                  `}>
                    <Icon className={`
                      h-5 w-5
                      ${isSelected ? `text-${type.color}-600` : 'text-dark-600'}
                    `} />
                  </div>
                  <h3 className="text-lg font-semibold text-dark-900">
                    {type.name}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-sm text-dark-600 mb-3">
                  {type.description}
                </p>

                {/* Examples */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-dark-700 uppercase tracking-wide">
                    Use for:
                  </p>
                  <ul className="space-y-1">
                    {type.examples.map((example, index) => (
                      <li key={index} className="text-sm text-dark-600 flex items-start gap-2">
                        <span className="text-dark-400 mt-1">•</span>
                        <span>{example}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Selected Indicator */}
            {isSelected && (
              <div className={`
                absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-medium
                bg-${type.color}-500 text-white
              `}>
                Selected
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
