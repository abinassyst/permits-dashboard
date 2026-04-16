'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Permit, DrillDownState, FilterState, BreadcrumbItem } from '@/types';
import permitsData from '@/data/permits';

interface DashboardContextType {
  permits: Permit[];
  filteredPermits: Permit[];
  filters: FilterState;
  drillDown: DrillDownState;
  selectedPermit: Permit | null;
  isModalOpen: boolean;
  setFilters: (filters: FilterState) => void;
  updateFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  navigateDrillDown: (type: DrillDownState['type'], value: string) => void;
  goBackDrillDown: () => void;
  resetDrillDown: () => void;
  openPermitModal: (permit: Permit) => void;
  closePermitModal: () => void;
  getFilteredByDrillDown: () => Permit[];
  setGroupByLevels: (levels: NonNullable<DrillDownState['groupByLevels']>) => void;
  clearGroupByLevels: () => void;
}

const initialFilters: FilterState = {
  serviceType: 'all',
  status: 'all',
  owner: 'all',
  zone: 'all',
  priority: 'all',
  search: '',
};

const initialDrillDown: DrillDownState = {
  level: 0,
  type: null,
  value: null,
  breadcrumb: [{ label: 'Overview', type: null, value: null }],
  groupByLevels: [],
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [permits] = useState<Permit[]>(
    [...permitsData.permits].sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime())
  );
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [drillDown, setDrillDown] = useState<DrillDownState>(initialDrillDown);
  const [selectedPermit, setSelectedPermit] = useState<Permit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const applyFilters = useCallback((data: Permit[]): Permit[] => {
    return data.filter(permit => {
      if (filters.serviceType !== 'all' && permit.serviceType !== filters.serviceType) return false;
      if (filters.status !== 'all' && permit.currentStatus !== filters.status) return false;
      if (filters.owner !== 'all' && permit.owner !== filters.owner) return false;
      if (filters.zone !== 'all' && permit.zone !== filters.zone) return false;
      if (filters.priority !== 'all' && permit.priority !== filters.priority) return false;
      if (filters.search && !permit.requestNo.toLowerCase().includes(filters.search.toLowerCase()) &&
          !permit.owner.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [filters]);

  const filteredPermits = applyFilters(permits);

  const updateFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const navigateDrillDown = useCallback((type: DrillDownState['type'], value: string) => {
    setDrillDown(prev => {
      const newBreadcrumb: BreadcrumbItem[] = [
        ...prev.breadcrumb,
        { label: value, type, value },
      ];
      return {
        level: prev.level + 1,
        type,
        value,
        parentType: prev.type || undefined,
        parentValue: prev.value || undefined,
        breadcrumb: newBreadcrumb,
      };
    });
  }, []);

  const goBackDrillDown = useCallback(() => {
    setDrillDown(prev => {
      if (prev.level === 0) return prev;
      const newBreadcrumb = prev.breadcrumb.slice(0, -1);
      const lastItem = newBreadcrumb[newBreadcrumb.length - 1];
      return {
        level: prev.level - 1,
        type: (lastItem?.type as DrillDownState['type']) || null,
        value: lastItem?.value || null,
        breadcrumb: newBreadcrumb,
      };
    });
  }, []);

  const resetDrillDown = useCallback(() => {
    setDrillDown(initialDrillDown);
  }, []);

  const setGroupByLevels = useCallback((levels: NonNullable<DrillDownState['groupByLevels']>) => {
    setDrillDown(prev => {
      if (levels.length === 0) {
        return initialDrillDown;
      }
      const firstLevel = levels[0];
      return {
        level: 1,
        type: firstLevel,
        value: `_group_${firstLevel}`,
        breadcrumb: [
          { label: 'Overview', type: null, value: null },
          { label: `By ${firstLevel}`, type: firstLevel, value: `_group_${firstLevel}` },
        ],
        groupByLevels: levels,
      };
    });
  }, []);

  const clearGroupByLevels = useCallback(() => {
    setDrillDown(initialDrillDown);
  }, []);

  const getFilteredByDrillDown = useCallback((): Permit[] => {
    let data = filteredPermits;
    
    drillDown.breadcrumb.slice(1).forEach(item => {
      // Skip group-level entries (they don't filter data, just indicate the dimension being viewed)
      if (item.value?.startsWith('_group_')) {
        return;
      }
      
      if (item.type && item.value) {
        data = data.filter(permit => {
          switch (item.type) {
            case 'serviceType': return permit.serviceType === item.value;
            case 'status': return permit.currentStatus === item.value;
            case 'owner': return permit.owner === item.value;
            case 'zone': return permit.zone === item.value;
            case 'priority': return permit.priority === item.value;
            default: return true;
          }
        });
      }
    });
    
    return data;
  }, [filteredPermits, drillDown.breadcrumb]);

  const openPermitModal = useCallback((permit: Permit) => {
    setSelectedPermit(permit);
    setIsModalOpen(true);
  }, []);

  const closePermitModal = useCallback(() => {
    setSelectedPermit(null);
    setIsModalOpen(false);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        permits,
        filteredPermits,
        filters,
        drillDown,
        selectedPermit,
        isModalOpen,
        setFilters,
        updateFilter,
        resetFilters,
        navigateDrillDown,
        goBackDrillDown,
        resetDrillDown,
        openPermitModal,
        closePermitModal,
        getFilteredByDrillDown,
        setGroupByLevels,
        clearGroupByLevels,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
