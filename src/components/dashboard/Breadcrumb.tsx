'use client';

import { ChevronRight, Home, BarChart3, Users, MapPin, AlertTriangle, FileText } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { DrillDownState } from '@/types';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, React.ReactNode> = {
  serviceType: <FileText className="w-4 h-4" />,
  status: <BarChart3 className="w-4 h-4" />,
  owner: <Users className="w-4 h-4" />,
  zone: <MapPin className="w-4 h-4" />,
  priority: <AlertTriangle className="w-4 h-4" />,
};

const typeLabels: Record<string, string> = {
  serviceType: 'Service Types',
  status: 'Status',
  owner: 'Owners',
  zone: 'Zones',
  priority: 'Priority',
};

function formatBreadcrumbLabel(item: { label: string; type: string | null; value: string | null }): string {
  if (item.value?.startsWith('_group_')) {
    const type = item.value.replace('_group_', '');
    return typeLabels[type] || item.label;
  }
  return item.label;
}

export default function Breadcrumb() {
  const { drillDown, goBackDrillDown, resetDrillDown, navigateDrillDown } = useDashboard();

  if (drillDown.breadcrumb.length <= 1) {
    return null;
  }

  const handleClick = (index: number) => {
    if (index === 0) {
      resetDrillDown();
    } else {
      // Go back to specific level
      const stepsBack = drillDown.breadcrumb.length - 1 - index;
      for (let i = 0; i < stepsBack; i++) {
        goBackDrillDown();
      }
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 px-4 py-3">
      <nav className="flex items-center gap-2 flex-wrap">
        {drillDown.breadcrumb.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            <button
              onClick={() => handleClick(index)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                index === drillDown.breadcrumb.length - 1
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 cursor-default"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white"
              )}
              disabled={index === drillDown.breadcrumb.length - 1}
            >
              {index === 0 && <Home className="w-4 h-4" />}
              {index > 0 && item.type && typeIcons[item.type]}
              <span>{formatBreadcrumbLabel(item)}</span>
            </button>
          </div>
        ))}
      </nav>
    </div>
  );
}
