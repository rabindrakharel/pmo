import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCard {
  value: number | string;
  label: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'gray';
  icon?: LucideIcon;
  format?: 'number' | 'percentage' | 'currency' | 'large';
}

interface StatsGridProps {
  stats: [StatCard, StatCard, StatCard];
  className?: string;
}

export function StatsGrid({ stats, className = '' }: StatsGridProps) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
    gray: 'text-gray-600'
  };

  const formatValue = (value: number | string, format?: string) => {
    if (typeof value === 'string') return value;
    
    switch (format) {
      case 'percentage':
        return `${value}%`;
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: 'USD' 
        }).format(value);
      case 'large':
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
        return value.toString();
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {stats.map((stat, index) => {
        const IconComponent = stat.icon;
        const colorClass = colorClasses[stat.color || 'blue'];
        
        return (
          <div 
            key={index}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center"
          >
            <div className="flex items-center justify-center mb-2">
              {IconComponent && (
                <IconComponent className={`h-5 w-5 ${colorClass} mr-2`} />
              )}
              <div className={`text-lg font-medium ${colorClass}`}>
                {formatValue(stat.value, stat.format)}
              </div>
            </div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}