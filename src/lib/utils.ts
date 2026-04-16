import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Permit, ChartDataItem } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CHART_COLORS = {
  primary: ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
  status: {
    'Approved': '#22C55E',
    'Rejected': '#EF4444',
    'Technical Review': '#F59E0B',
    'Pending': '#8B5CF6',
    'Inspection': '#06B6D4',
    'Need modification': '#F97316',
    'Consultant': '#EC4899',
    'GIF at Plan(2)': '#14B8A6',
    'Technical Review At Plan 201+R': '#6366F1',
  },
  priority: {
    'High': '#EF4444',
    'Medium': '#F59E0B',
    'Low': '#22C55E',
  },
  zones: {
    'Zone A': '#3B82F6',
    'Zone B': '#8B5CF6',
    'Zone C': '#06B6D4',
    'Zone D': '#F59E0B',
  },
  serviceTypes: [
    '#3B82F6', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#22C55E', '#EC4899'
  ],
};

export function getStatusColor(status: string): string {
  return CHART_COLORS.status[status as keyof typeof CHART_COLORS.status] || '#6B7280';
}

export function getPriorityColor(priority: string): string {
  return CHART_COLORS.priority[priority as keyof typeof CHART_COLORS.priority] || '#6B7280';
}

export function getZoneColor(zone: string): string {
  return CHART_COLORS.zones[zone as keyof typeof CHART_COLORS.zones] || '#6B7280';
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const keyValue = String(item[key]);
    (result[keyValue] = result[keyValue] || []).push(item);
    return result;
  }, {} as Record<string, T[]>);
}

export function countBy<T>(array: T[], key: keyof T): Record<string, number> {
  const grouped = groupBy(array, key);
  return Object.keys(grouped).reduce((result, k) => {
    result[k] = grouped[k].length;
    return result;
  }, {} as Record<string, number>);
}

export function getChartData(permits: Permit[], key: keyof Permit, colorMap?: Record<string, string>): ChartDataItem[] {
  const counts = countBy(permits, key);
  const total = permits.length;
  
  return Object.entries(counts)
    .map(([name, value], index) => ({
      name,
      value,
      percentage: Math.round((value / total) * 100),
      color: colorMap?.[name] || CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getShortServiceType(serviceType: string): string {
  const shortNames: Record<string, string> = {
    'Request for Sewerage Connection Point Details': 'Connection Point',
    'Sewerage Site Inspection': 'Site Inspection',
    'Approve the Creation of a New Sewerage Connection Point': 'New Connection',
    'Obtain Copy of Existing Sewerage Setouts': 'Setouts Copy',
    'Issue Approval to Modify the Sewerage Manholes Level': 'Manhole Modify',
    'Issue Approval to Modify the Sewerage Manhole Level': 'Manhole Modify',
    'Approve Temporary Connection to Sewerage Line': 'Temp Connection',
    'Request for External Sewerage Device Approval': 'Ext Device',
    'Request for External Sewerage Route Approval': 'Ext Route',
    'Obtain Cost of Diverting Sewerage Services': 'Diversion Cost',
  };
  return shortNames[serviceType] || serviceType;
}

export function exportToCSV(data: Permit[], filename: string): void {
  const headers = ['Request No', 'Service Type', 'Status', 'Owner', 'Zone', 'Priority', 'Created Date'];
  const rows = data.map(p => [
    p.requestNo,
    p.serviceType,
    p.currentStatus,
    p.owner,
    p.zone,
    p.priority,
    p.creationDate,
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}
