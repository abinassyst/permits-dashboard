'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Target, Award, Clock, AlertTriangle,
  CheckCircle2, XCircle, Users, MapPin, Activity, Zap, Shield, Timer,
  ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, Layers, FileText,
  Hourglass, AlertOctagon, Ban, Scale, GitCompare, Calendar, Briefcase,
  BarChart3, ArrowLeftRight, X, Eye, Download, Search, Grid3X3
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { Permit } from '@/types';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, AreaChart, Area, RadialBarChart, RadialBar, Legend
} from 'recharts';
import { CHART_COLORS, getStatusColor, getPriorityColor, getShortServiceType, formatDate } from '@/lib/utils';

// Types
type CompareBy = 'none' | 'zone' | 'serviceType' | 'assignee' | 'priority' | 'month';
type GroupBy = 'none' | 'zone' | 'serviceType' | 'assignee' | 'priority' | 'status';
type Period = 'week' | 'month' | 'quarter' | 'year';
type DrillDownFilter = {
  title: string;
  permits: Permit[];
} | null;

const COMPARE_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', fill: '#3B82F6' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', fill: '#10B981' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-600 dark:text-purple-400', fill: '#8B5CF6' },
];

// Helper functions
function parseRemainingTimeToHours(remainingTime: string): number {
  const isNegative = remainingTime.startsWith('-');
  const cleanTime = remainingTime.replace('-', '');
  const parts = cleanTime.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const totalHours = hours + minutes / 60;
    return isNegative ? -totalHours : totalHours;
  }
  return 0;
}

function filterByPeriod(permits: Permit[], period: Period): Permit[] {
  if (permits.length === 0) return permits;
  
  // Find the most recent date in the data to use as reference
  const dates = permits.map(p => new Date(p.creationDate).getTime());
  const mostRecentDate = new Date(Math.max(...dates));
  
  const cutoffDate = new Date(mostRecentDate);
  switch (period) {
    case 'week': cutoffDate.setDate(mostRecentDate.getDate() - 7); break;
    case 'month': cutoffDate.setMonth(mostRecentDate.getMonth() - 1); break;
    case 'quarter': cutoffDate.setMonth(mostRecentDate.getMonth() - 3); break;
    case 'year': cutoffDate.setFullYear(mostRecentDate.getFullYear() - 1); break;
  }
  
  const filtered = permits.filter(p => new Date(p.creationDate) >= cutoffDate);
  // If no data in period, return all data
  return filtered.length > 0 ? filtered : permits;
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// Calculate metrics for a set of permits
function calculateMetrics(permits: Permit[]) {
  const total = permits.length;
  const opened = permits.filter(p => p.status === 'Opened').length;
  const closed = permits.filter(p => p.status === 'Closed').length;
  const breached = permits.filter(p => p.remainingTime.startsWith('-')).length;
  const withinSLA = total - breached;
  const slaCompliance = total > 0 ? Math.round((withinSLA / total) * 100) : 100;
  const highPriority = permits.filter(p => p.priority === 'High').length;
  const highPriorityBreached = permits.filter(p => p.priority === 'High' && p.remainingTime.startsWith('-')).length;
  const highPrioritySLA = highPriority > 0 ? Math.round(((highPriority - highPriorityBreached) / highPriority) * 100) : 100;
  
  const processingTimes = permits.map(p => {
    const created = new Date(p.creationDate);
    const updated = new Date(p.updatedDate);
    return Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  });
  const avgProcessingDays = processingTimes.length > 0 
    ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length) : 0;
  
  const completionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
  
  return { total, opened, closed, breached, withinSLA, slaCompliance, highPriority, highPrioritySLA, avgProcessingDays, completionRate };
}

// DrillDown Modal Component
function DrillDownModal({ drillDown, onClose, onViewPermit }: {
  drillDown: DrillDownFilter;
  onClose: () => void;
  onViewPermit: (permit: Permit) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'requestNo' | 'priority' | 'status' | 'remainingTime'>('remainingTime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  if (!drillDown) return null;
  
  const filteredPermits = drillDown.permits
    .filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.requestNo.toLowerCase().includes(q) || 
             p.serviceType.toLowerCase().includes(q) ||
             p.owner.toLowerCase().includes(q) ||
             p.zone.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let cmp = 0;
      switch(sortField) {
        case 'requestNo': cmp = a.requestNo.localeCompare(b.requestNo); break;
        case 'priority': 
          const pOrder = { High: 3, Medium: 2, Low: 1 };
          cmp = (pOrder[b.priority as keyof typeof pOrder] || 0) - (pOrder[a.priority as keyof typeof pOrder] || 0);
          break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'remainingTime': 
          cmp = parseRemainingTimeToHours(a.remainingTime) - parseRemainingTimeToHours(b.remainingTime);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{drillDown.title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{drillDown.permits.length} permits</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-[calc(85vh-120px)]">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700/50 sticky top-0">
              <tr>
                <th onClick={() => handleSort('requestNo')} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600">
                  Request No {sortField === 'requestNo' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Service Type</th>
                <th onClick={() => handleSort('priority')} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600">
                  Priority {sortField === 'priority' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('status')} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600">
                  Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Zone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Assignee</th>
                <th onClick={() => handleSort('remainingTime')} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600">
                  Time Left {sortField === 'remainingTime' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredPermits.map(permit => {
                const hours = parseRemainingTimeToHours(permit.remainingTime);
                const timeColor = hours < 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/20' 
                  : hours < 24 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' 
                  : 'text-green-600 bg-green-50 dark:bg-green-900/20';
                
                return (
                  <tr key={permit.requestNo} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{permit.requestNo}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{getShortServiceType(permit.serviceType)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(permit.priority)}`}>
                        {permit.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(permit.status)}`}>
                        {permit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{permit.zone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{permit.owner.split(' ').slice(0, 2).join(' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${timeColor}`}>
                        {permit.remainingTime}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(permit.creationDate)}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => onViewPermit(permit)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredPermits.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No permits found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compare Selector Component - Compare by field, Group by another field
function CompareSelector({ 
  compareBy, 
  setCompareBy, 
  groupBy,
  setGroupBy,
  compareValues, 
  setCompareValues, 
  options 
}: {
  compareBy: CompareBy;
  setCompareBy: (by: CompareBy) => void;
  groupBy: GroupBy;
  setGroupBy: (by: GroupBy) => void;
  compareValues: string[];
  setCompareValues: (values: string[]) => void;
  options: { zones: string[]; months: string[]; serviceTypes: string[]; assignees: string[]; priorities: string[] };
}) {
  const compareConfig: { id: CompareBy; label: string; icon: React.ReactNode; options: string[] }[] = [
    { id: 'none', label: 'Off', icon: <XCircle className="w-4 h-4" />, options: [] },
    { id: 'zone', label: 'Zone', icon: <MapPin className="w-4 h-4" />, options: options.zones },
    { id: 'assignee', label: 'Assignee', icon: <Users className="w-4 h-4" />, options: options.assignees },
    { id: 'serviceType', label: 'Service', icon: <Briefcase className="w-4 h-4" />, options: options.serviceTypes },
    { id: 'priority', label: 'Priority', icon: <Zap className="w-4 h-4" />, options: options.priorities },
    { id: 'month', label: 'Month', icon: <Calendar className="w-4 h-4" />, options: options.months },
  ];

  const groupConfig: { id: GroupBy; label: string; icon: React.ReactNode }[] = [
    { id: 'none', label: 'None', icon: <XCircle className="w-4 h-4" /> },
    { id: 'zone', label: 'Zone', icon: <MapPin className="w-4 h-4" /> },
    { id: 'assignee', label: 'Assignee', icon: <Users className="w-4 h-4" /> },
    { id: 'serviceType', label: 'Service', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'priority', label: 'Priority', icon: <Zap className="w-4 h-4" /> },
    { id: 'status', label: 'Status', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const currentOptions = compareConfig.find(c => c.id === compareBy)?.options || [];

  const handleCompareByChange = (by: CompareBy) => {
    setCompareBy(by);
    if (by === 'none') {
      setCompareValues([]);
      setGroupBy('none');
    } else {
      const opts = compareConfig.find(c => c.id === by)?.options || [];
      if (opts.length >= 2) {
        setCompareValues(opts.slice(0, 2));
      }
      // Reset group by if it's the same as compare by
      if (groupBy === by) {
        setGroupBy('none');
      }
    }
  };

  const addComparison = () => {
    if (compareValues.length < 3 && currentOptions.length > compareValues.length) {
      const nextOpt = currentOptions.find(opt => !compareValues.includes(opt));
      if (nextOpt) setCompareValues([...compareValues, nextOpt]);
    }
  };

  const removeComparison = (index: number) => {
    if (compareValues.length > 2) {
      setCompareValues(compareValues.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex flex-col gap-4">
        {/* Compare By Selection */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compare By:</span>
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1">
            {compareConfig.map(opt => (
              <button
                key={opt.id}
                onClick={() => handleCompareByChange(opt.id)}
                disabled={opt.id !== 'none' && opt.options.length < 2}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  compareBy === opt.id
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : opt.id !== 'none' && opt.options.length < 2
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Compare Values + Group By */}
        {compareBy !== 'none' && currentOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 dark:border-slate-700">
            {/* Compare Values */}
            <div className="flex items-center gap-2 flex-wrap">
              {compareValues.map((val, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <select
                    value={val}
                    onChange={e => {
                      const newValues = [...compareValues];
                      newValues[idx] = e.target.value;
                      setCompareValues(newValues);
                    }}
                    className={`px-3 py-2 ${COMPARE_COLORS[idx].bg} border ${COMPARE_COLORS[idx].border} rounded-lg text-sm font-medium ${COMPARE_COLORS[idx].text}`}
                  >
                    {currentOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {compareValues.length > 2 && (
                    <button onClick={() => removeComparison(idx)} className="p-1 text-gray-400 hover:text-red-500">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                  {idx < compareValues.length - 1 && <span className="text-gray-400 mx-1">vs</span>}
                </div>
              ))}
              {compareValues.length < 3 && currentOptions.length > compareValues.length && (
                <button 
                  onClick={addComparison}
                  className="px-3 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  + Add
                </button>
              )}
            </div>

            {/* Group By */}
            <div className="flex items-center gap-2 ml-auto">
              <Layers className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Group By:</span>
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as GroupBy)}
                className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-medium text-purple-600 dark:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {groupConfig.filter(g => g.id !== compareBy).map(g => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Comparison KPI Card
function CompareKPICard({ title, value1, value2, label1, label2, icon, color1 = 'blue', color2 = 'emerald' }: {
  title: string; value1: string | number; value2: string | number; label1: string; label2: string; icon: React.ReactNode; color1?: string; color2?: string;
}) {
  const v1 = typeof value1 === 'string' ? parseFloat(value1) : value1;
  const v2 = typeof value2 === 'string' ? parseFloat(value2) : value2;
  const diff = v1 - v2;
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-lg transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700">{icon}</div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className={`p-3 rounded-xl bg-${color1}-50 dark:bg-${color1}-900/20 border border-${color1}-200 dark:border-${color1}-800`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{label1}</p>
          <p className={`text-2xl font-bold text-${color1}-600 dark:text-${color1}-400`}>{value1}</p>
        </div>
        <div className={`p-3 rounded-xl bg-${color2}-50 dark:bg-${color2}-900/20 border border-${color2}-200 dark:border-${color2}-800`}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{label2}</p>
          <p className={`text-2xl font-bold text-${color2}-600 dark:text-${color2}-400`}>{value2}</p>
        </div>
      </div>
      
      {diff !== 0 && (
        <div className={`mt-3 text-center text-xs font-medium ${diff > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
          {label1} is {Math.abs(diff).toFixed(1)} {diff > 0 ? 'higher' : 'lower'}
        </div>
      )}
    </div>
  );
}

// Comparison Bar Chart - Supports up to 3 comparisons
function CompareBarChart({ data, labels, title }: {
  data: Record<string, string | number>[];
  labels: string[];
  title: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }} />
          <Legend />
          {labels.map((label, idx) => (
            <Bar key={idx} dataKey={`value${idx + 1}`} name={label} fill={COMPARE_COLORS[idx].fill} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// SLA Status Badge
function SLAStatusBadge({ status, count }: { status: 'critical' | 'warning' | 'good'; count: number }) {
  const config = {
    critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Critical' },
    warning: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'At Risk' },
    good: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'On Track' }
  };
  const { bg, text, label } = config[status];
  
  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <p className={`text-3xl font-bold ${text}`}>{count}</p>
      <p className={`text-sm ${text} font-medium`}>{label}</p>
    </div>
  );
}

// Executive KPI Card
function ExecutiveKPICard({ title, value, subtitle, trend, icon, color, target }: {
  title: string; value: string | number; subtitle?: string; trend?: { value: number; isPositive: boolean };
  icon: React.ReactNode; color: string; target?: { value: number; label: string };
}) {
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500`} />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>{icon}</div>
          {trend && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              trend.isPositive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {trend.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        {target && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${typeof value === 'string' && parseFloat(value) >= target.value ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, (typeof value === 'string' ? parseFloat(value) : value) / target.value * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500">{target.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// SLA Breakdown Card
function SLABreakdownCard({ title, icon, children, className = '' }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700">{icon}</div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// Large SLA Gauge - Improved visual
function LargeSLAGauge({ value, target = 95 }: { value: number; target?: number }) {
  const meetsTarget = value >= target;
  const color = value >= target ? '#22C55E' : value >= target - 10 ? '#F59E0B' : '#EF4444';
  const bgColor = value >= target ? '#DCFCE7' : value >= target - 10 ? '#FEF3C7' : '#FEE2E2';
  
  return (
    <div className="relative flex flex-col items-center py-4">
      {/* Semicircle gauge */}
      <div className="relative" style={{ width: 180, height: 100 }}>
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Background arc */}
          <path
            d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 10 90 A 80 80 0 0 1 170 90"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 251.2} 251.2`}
          />
          {/* Center text */}
          <text x="90" y="85" textAnchor="middle" className="text-3xl font-bold" fill={color} style={{ fontSize: '36px', fontWeight: 'bold' }}>
            {value}%
          </text>
        </svg>
      </div>
      
      {/* Target indicator */}
      <div className={`mt-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
        meetsTarget 
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}>
        {meetsTarget ? '✓ Meeting Target' : `✗ ${target - value}% below target`}
      </div>
    </div>
  );
}

// Zone Performance Card
function ZonePerformanceCard({ zone, permits, slaRate, breached, avgDays }: { zone: string; permits: number; slaRate: number; breached: number; avgDays: number }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${slaRate >= 90 ? 'bg-green-100 dark:bg-green-900/30' : slaRate >= 70 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
        <MapPin className={`w-6 h-6 ${slaRate >= 90 ? 'text-green-600' : slaRate >= 70 ? 'text-amber-600' : 'text-red-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 dark:text-white truncate">{zone}</h4>
        <p className="text-sm text-gray-500">{permits} permits • {avgDays}d avg</p>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${slaRate >= 90 ? 'text-green-600' : slaRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{slaRate}%</p>
        <p className="text-xs text-red-500">{breached} breached</p>
      </div>
    </div>
  );
}

// Main Executive View Component
export default function ExecutiveView() {
  const { permits, getFilteredByDrillDown, openPermitModal } = useDashboard();
  const allFilteredPermits = getFilteredByDrillDown();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [compareBy, setCompareBy] = useState<CompareBy>('none');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [compareValues, setCompareValues] = useState<string[]>([]);
  const [drillDown, setDrillDown] = useState<DrillDownFilter>(null);

  // Helper to open drill-down modal
  const openDrillDown = (title: string, permits: Permit[]) => {
    setDrillDown({ title, permits });
  };

  // Filter permits by period
  const filteredPermits = useMemo(() => filterByPeriod(allFilteredPermits, selectedPeriod), [allFilteredPermits, selectedPeriod]);

  // Get unique values for comparison - use filteredPermits for zone/serviceType/assignee, allFilteredPermits for months
  const comparisonOptions = useMemo(() => {
    const zones = Array.from(new Set(filteredPermits.map(p => p.zone))).sort();
    const serviceTypes = Array.from(new Set(filteredPermits.map(p => getShortServiceType(p.serviceType)))).sort();
    const assignees = Array.from(new Set(filteredPermits.map(p => p.owner))).sort();
    const priorities = ['High', 'Medium', 'Low'];
    
    // Generate last 6 months based on all data (not period-filtered)
    const dataMonths = Array.from(new Set(allFilteredPermits.map(p => getMonthName(new Date(p.creationDate))))).slice(0, 6);
    
    return { zones, months: dataMonths, serviceTypes, assignees, priorities };
  }, [filteredPermits, allFilteredPermits]);

  // Get comparison data sets (up to 3)
  const comparisonSets = useMemo(() => {
    if (compareBy === 'none' || compareValues.length === 0) return [];
    
    return compareValues.map(val => {
      let filtered = compareBy === 'month' 
        ? [...allFilteredPermits]  // Use all data when comparing by month
        : [...filteredPermits];
      
      // Filter by the compare dimension
      if (compareBy === 'zone') {
        filtered = filtered.filter(p => p.zone === val);
      } else if (compareBy === 'assignee') {
        filtered = filtered.filter(p => p.owner === val);
      } else if (compareBy === 'serviceType') {
        filtered = filtered.filter(p => getShortServiceType(p.serviceType) === val);
      } else if (compareBy === 'priority') {
        filtered = filtered.filter(p => p.priority === val);
      } else if (compareBy === 'month') {
        filtered = filtered.filter(p => getMonthName(new Date(p.creationDate)) === val);
      }
      
      return { label: val, permits: filtered, metrics: calculateMetrics(filtered) };
    });
  }, [filteredPermits, allFilteredPermits, compareBy, compareValues]);

  // Get grouped data for comparison view
  const groupedData = useMemo(() => {
    // Only calculate if we have comparison data and a group by dimension selected
    if (compareBy === 'none' || compareValues.length === 0 || comparisonSets.length === 0) {
      return { groupValues: [], data: [], groupMetrics: [], hasGrouping: false };
    }
    
    // If no grouping selected, return empty but valid structure
    if (groupBy === 'none') {
      return { groupValues: [], data: [], groupMetrics: [], hasGrouping: false };
    }
    
    // Get unique values for the group dimension
    const getGroupValue = (p: Permit): string => {
      switch (groupBy) {
        case 'zone': return p.zone;
        case 'assignee': return p.owner.split(' ').slice(0, 2).join(' ');
        case 'serviceType': return getShortServiceType(p.serviceType);
        case 'priority': return p.priority;
        case 'status': return p.status;
        default: return 'Other';
      }
    };

    // Collect all unique group values across all comparison sets
    const allGroupValues = new Set<string>();
    comparisonSets.forEach(set => {
      set.permits.forEach(p => allGroupValues.add(getGroupValue(p)));
    });
    const groupValues = Array.from(allGroupValues).sort();

    // Build grouped data structure
    const data = groupValues.map(groupVal => {
      const row: Record<string, string | number> = { name: groupVal };
      comparisonSets.forEach((set, idx) => {
        const count = set.permits.filter(p => getGroupValue(p) === groupVal).length;
        row[`value${idx + 1}`] = count;
        row[`label${idx + 1}`] = set.label;
      });
      return row;
    });

    // Calculate group metrics for each comparison
    const groupMetrics = groupValues.map(groupVal => {
      const metricsPerComparison = comparisonSets.map(set => {
        const permits = set.permits.filter(p => getGroupValue(p) === groupVal);
        return { 
          label: set.label, 
          permits,
          ...calculateMetrics(permits)
        };
      });
      return { groupValue: groupVal, comparisons: metricsPerComparison };
    });

    return { groupValues, data, groupMetrics, hasGrouping: true };
  }, [compareBy, groupBy, comparisonSets, compareValues]);

  // Standard metrics (non-compare mode)
  const metrics = useMemo(() => {
    const m = calculateMetrics(filteredPermits);
    const criticalSLA = filteredPermits.filter(p => parseRemainingTimeToHours(p.remainingTime) < 0).length;
    const atRiskSLA = filteredPermits.filter(p => { const h = parseRemainingTimeToHours(p.remainingTime); return h >= 0 && h <= 24; }).length;
    const onTrackSLA = filteredPermits.filter(p => parseRemainingTimeToHours(p.remainingTime) > 24).length;
    
    const backlogAging = {
      lessThan3Days: filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d < 3; }).length,
      threeTo7Days: filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d >= 3 && d <= 7; }).length,
      moreThan7Days: filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d > 7; }).length,
    };
    
    const zoneStats = filteredPermits.reduce((acc, p) => {
      if (!acc[p.zone]) acc[p.zone] = { total: 0, breached: 0, totalDays: 0 };
      acc[p.zone].total++;
      if (p.remainingTime.startsWith('-')) acc[p.zone].breached++;
      acc[p.zone].totalDays += Math.ceil((new Date(p.updatedDate).getTime() - new Date(p.creationDate).getTime()) / 86400000);
      return acc;
    }, {} as Record<string, { total: number; breached: number; totalDays: number }>);
    
    const ownerStats = filteredPermits.reduce((acc, p) => {
      if (!acc[p.owner]) acc[p.owner] = { active: 0, completed: 0, breached: 0 };
      if (p.status === 'Opened') acc[p.owner].active++;
      if (p.status === 'Closed') acc[p.owner].completed++;
      if (p.remainingTime.startsWith('-')) acc[p.owner].breached++;
      return acc;
    }, {} as Record<string, { active: number; completed: number; breached: number }>);
    
    const categoryStats = filteredPermits.reduce((acc, p) => { acc[p.permitCategory] = (acc[p.permitCategory] || 0) + 1; return acc; }, {} as Record<string, number>);
    const priorityStats = filteredPermits.reduce((acc, p) => { acc[p.priority] = (acc[p.priority] || 0) + 1; return acc; }, {} as Record<string, number>);
    
    return { ...m, criticalSLA, atRiskSLA, onTrackSLA, backlogAging, zoneStats, ownerStats, categoryStats, priorityStats };
  }, [filteredPermits]);

  // Comparison chart data
  const comparisonChartData = useMemo(() => {
    // Status comparison
    const statusData = ['Opened', 'Closed'].map(status => {
      const item: Record<string, string | number> = { name: status };
      comparisonSets.forEach((set, idx) => {
        item[`value${idx + 1}`] = set.permits.filter(p => p.status === status).length;
      });
      return item;
    });
    
    // Priority comparison
    const priorityData = ['High', 'Medium', 'Low'].map(priority => {
      const item: Record<string, string | number> = { name: priority };
      comparisonSets.forEach((set, idx) => {
        item[`value${idx + 1}`] = set.permits.filter(p => p.priority === priority).length;
      });
      return item;
    });
    
    // SLA comparison
    const slaData = ['Within SLA', 'Breached'].map(sla => {
      const item: Record<string, string | number> = { name: sla };
      comparisonSets.forEach((set, idx) => {
        item[`value${idx + 1}`] = sla === 'Within SLA' 
          ? set.permits.filter(p => !p.remainingTime.startsWith('-')).length
          : set.permits.filter(p => p.remainingTime.startsWith('-')).length;
      });
      return item;
    });
    
    return { statusData, priorityData, slaData };
  }, [comparisonSets]);

  const periodLabel = { week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year' }[selectedPeriod];

  // COMPARISON MODE VIEW
  if (compareBy !== 'none' && comparisonSets.length >= 2) {
    const compareLabels = comparisonSets.map(s => s.label);
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Comparison View</h1>
              <p className="text-indigo-200">
                Comparing by {compareBy.charAt(0).toUpperCase() + compareBy.slice(1)}: {compareLabels.join(' vs ')}
                {groupBy !== 'none' && <span className="ml-2">• Grouped by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl p-1">
              {(['week', 'month', 'quarter', 'year'] as const).map(period => (
                <button key={period} onClick={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPeriod === period ? 'bg-white text-indigo-700 shadow-lg' : 'text-white hover:bg-white/20'}`}>
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Compare Selector */}
        <CompareSelector 
          compareBy={compareBy}
          setCompareBy={setCompareBy}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          compareValues={compareValues} 
          setCompareValues={setCompareValues} 
          options={comparisonOptions} 
        />

        {/* Comparison KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Permits */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700"><FileText className="w-5 h-5 text-gray-600" /></div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Total Permits</h3>
            </div>
            <div className={`grid grid-cols-${comparisonSets.length} gap-2`}>
              {comparisonSets.map((set, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${COMPARE_COLORS[idx].bg} border ${COMPARE_COLORS[idx].border}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{set.label}</p>
                  <p className={`text-xl font-bold ${COMPARE_COLORS[idx].text}`}>{set.metrics.total}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* SLA Compliance */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700"><Shield className="w-5 h-5 text-gray-600" /></div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">SLA Compliance</h3>
            </div>
            <div className={`grid grid-cols-${comparisonSets.length} gap-2`}>
              {comparisonSets.map((set, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${COMPARE_COLORS[idx].bg} border ${COMPARE_COLORS[idx].border}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{set.label}</p>
                  <p className={`text-xl font-bold ${COMPARE_COLORS[idx].text}`}>{set.metrics.slaCompliance}%</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Completion Rate */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700"><CheckCircle2 className="w-5 h-5 text-gray-600" /></div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Completion Rate</h3>
            </div>
            <div className={`grid grid-cols-${comparisonSets.length} gap-2`}>
              {comparisonSets.map((set, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${COMPARE_COLORS[idx].bg} border ${COMPARE_COLORS[idx].border}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{set.label}</p>
                  <p className={`text-xl font-bold ${COMPARE_COLORS[idx].text}`}>{set.metrics.completionRate}%</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Avg Processing */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700"><Timer className="w-5 h-5 text-gray-600" /></div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Avg Processing</h3>
            </div>
            <div className={`grid grid-cols-${comparisonSets.length} gap-2`}>
              {comparisonSets.map((set, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${COMPARE_COLORS[idx].bg} border ${COMPARE_COLORS[idx].border}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{set.label}</p>
                  <p className={`text-xl font-bold ${COMPARE_COLORS[idx].text}`}>{set.metrics.avgProcessingDays}d</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CompareBarChart data={comparisonChartData.statusData} labels={compareLabels} title="Status Distribution" />
          <CompareBarChart data={comparisonChartData.priorityData} labels={compareLabels} title="Priority Distribution" />
          <CompareBarChart data={comparisonChartData.slaData} labels={compareLabels} title="SLA Performance" />
        </div>

        {/* Grouped Breakdown Section - Only shown when Group By is active */}
        {groupedData.hasGrouping && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-indigo-600" />
                Breakdown by {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">{groupedData.groupValues.length} groups</span>
            </div>
            
            {groupedData.data.length > 0 ? (
              <>
                {/* Grouped Bar Chart */}
                <div className="h-80 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupedData.data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={70} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => {
                          const idx = parseInt(name.replace('value', '')) - 1;
                          return [value, compareLabels[idx]];
                        }}
                      />
                      <Legend />
                      {comparisonSets.map((set, idx) => (
                        <Bar key={idx} dataKey={`value${idx + 1}`} name={set.label} fill={COMPARE_COLORS[idx].fill} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Grouped Metrics Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</th>
                        {comparisonSets.map((set, idx) => (
                          <th key={idx} className={`text-center py-3 px-4 font-semibold ${COMPARE_COLORS[idx].text}`}>{set.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupedData.groupMetrics.map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                          <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{row.groupValue}</td>
                          {row.comparisons.map((comp, idx) => (
                            <td key={idx} className="text-center py-3 px-4">
                              <div className="flex flex-col items-center">
                                <span className={`text-lg font-bold ${COMPARE_COLORS[idx].text}`}>{comp.total}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  SLA: {comp.slaCompliance}%
                                </span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">No data available for this grouping</p>
            )}
          </div>
        )}

        {/* Detailed Metrics - Dynamic grid based on number of comparisons */}
        <div className={`grid grid-cols-1 md:grid-cols-${comparisonSets.length} gap-6`}>
          {comparisonSets.map((set, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className={`text-lg font-semibold ${COMPARE_COLORS[idx].text} mb-4 flex items-center gap-2`}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPARE_COLORS[idx].fill }} /> {set.label} Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400">High Priority</span>
                  <span className="font-bold">{set.metrics.highPriority}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400">High Priority SLA</span>
                  <span className="font-bold">{set.metrics.highPrioritySLA}%</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400">Breached</span>
                  <span className="font-bold text-red-600">{set.metrics.breached}</span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                  <span className="text-gray-600 dark:text-gray-400">Opened / Closed</span>
                  <span className="font-bold">{set.metrics.opened} / {set.metrics.closed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // STANDARD VIEW (no comparison)
  const zonePerformance = Object.entries(metrics.zoneStats).map(([zone, stats]) => ({
    zone, permits: stats.total, slaRate: stats.total > 0 ? Math.round(((stats.total - stats.breached) / stats.total) * 100) : 100,
    breached: stats.breached, avgDays: stats.total > 0 ? Math.round(stats.totalDays / stats.total) : 0
  })).sort((a, b) => b.permits - a.permits);

  const ownerWorkload = Object.entries(metrics.ownerStats).map(([name, stats]) => ({ name: name.split(' ').slice(0, 2).join(' '), ...stats })).sort((a, b) => (b.active + b.completed) - (a.active + a.completed)).slice(0, 6);
  const categoryData = Object.entries(metrics.categoryStats).map(([name, count], idx) => ({ name, value: count, color: CHART_COLORS.serviceTypes[idx % CHART_COLORS.serviceTypes.length] })).sort((a, b) => b.value - a.value);
  const priorityData = Object.entries(metrics.priorityStats).map(([name, count]) => ({ name, value: count, color: getPriorityColor(name) }));

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Permits Executive Dashboard</h1>
            <p className="text-blue-200">Real-time performance analytics • {periodLabel}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl p-1">
            {(['week', 'month', 'quarter', 'year'] as const).map(period => (
              <button key={period} onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPeriod === period ? 'bg-white text-blue-700 shadow-lg' : 'text-white hover:bg-white/20'}`}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => openDrillDown('All Permits', filteredPermits)}>
            <div className="flex items-center gap-3"><FileText className="w-8 h-8 text-blue-200" /><div><p className="text-3xl font-bold">{metrics.total}</p><p className="text-sm text-blue-200">Total Permits</p></div></div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => openDrillDown('Closed Permits', filteredPermits.filter(p => p.status === 'Closed'))}>
            <div className="flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-green-300" /><div><p className="text-3xl font-bold">{metrics.closed}</p><p className="text-sm text-blue-200">Closed</p></div></div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => openDrillDown('In Progress Permits', filteredPermits.filter(p => p.status === 'Opened'))}>
            <div className="flex items-center gap-3"><Clock className="w-8 h-8 text-amber-300" /><div><p className="text-3xl font-bold">{metrics.opened}</p><p className="text-sm text-blue-200">In Progress</p></div></div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => openDrillDown('SLA Breached Permits', filteredPermits.filter(p => p.remainingTime.startsWith('-')))}>
            <div className="flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-red-300" /><div><p className="text-3xl font-bold">{metrics.breached}</p><p className="text-sm text-blue-200">SLA Breached</p></div></div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => openDrillDown('High Priority Permits', filteredPermits.filter(p => p.priority === 'High'))}>
            <div className="flex items-center gap-3"><Zap className="w-8 h-8 text-orange-300" /><div><p className="text-3xl font-bold">{metrics.highPriority}</p><p className="text-sm text-blue-200">High Priority</p></div></div>
          </div>
        </div>
      </div>

      {/* Compare Selector */}
      <CompareSelector 
        compareBy={compareBy}
        setCompareBy={setCompareBy}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        compareValues={compareValues} 
        setCompareValues={setCompareValues} 
        options={comparisonOptions} 
      />

      {/* SLA Performance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SLABreakdownCard title="Overall SLA Compliance" icon={<Target className="w-5 h-5 text-gray-600 dark:text-gray-400" />} className="lg:row-span-2">
          <div className="flex flex-col items-center">
            <LargeSLAGauge value={metrics.slaCompliance} target={95} />
            <div className="w-full mt-6 grid grid-cols-3 gap-3">
              <div className="cursor-pointer hover:scale-105 transition-transform" onClick={() => openDrillDown('SLA Breached (Critical)', filteredPermits.filter(p => parseRemainingTimeToHours(p.remainingTime) < 0))}>
                <SLAStatusBadge status="critical" count={metrics.criticalSLA} />
              </div>
              <div className="cursor-pointer hover:scale-105 transition-transform" onClick={() => openDrillDown('At Risk (<24h)', filteredPermits.filter(p => { const h = parseRemainingTimeToHours(p.remainingTime); return h >= 0 && h <= 24; }))}>
                <SLAStatusBadge status="warning" count={metrics.atRiskSLA} />
              </div>
              <div className="cursor-pointer hover:scale-105 transition-transform" onClick={() => openDrillDown('On Track (>24h)', filteredPermits.filter(p => parseRemainingTimeToHours(p.remainingTime) > 24))}>
                <SLAStatusBadge status="good" count={metrics.onTrackSLA} />
              </div>
            </div>
          </div>
        </SLABreakdownCard>

        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('Within SLA', filteredPermits.filter(p => !p.remainingTime.startsWith('-')))}>
            <ExecutiveKPICard title="SLA Compliance" value={`${metrics.slaCompliance}%`} subtitle={`${metrics.withinSLA} of ${metrics.total} within SLA`} icon={<Shield className="w-5 h-5 text-white" />} color="from-green-500 to-emerald-600" target={{ value: 95, label: '95%' }} />
          </div>
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('High Priority', filteredPermits.filter(p => p.priority === 'High'))}>
            <ExecutiveKPICard title="High Priority SLA" value={`${metrics.highPrioritySLA}%`} subtitle={`${metrics.highPriority} high priority permits`} icon={<Zap className="w-5 h-5 text-white" />} color="from-orange-500 to-red-600" target={{ value: 98, label: '98%' }} />
          </div>
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('All Permits', filteredPermits)}>
            <ExecutiveKPICard title="Avg Processing" value={`${metrics.avgProcessingDays}d`} subtitle="Average processing time" icon={<Timer className="w-5 h-5 text-white" />} color="from-blue-500 to-cyan-600" target={{ value: 5, label: '≤5d' }} />
          </div>
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('Closed Permits', filteredPermits.filter(p => p.status === 'Closed'))}>
            <ExecutiveKPICard title="Completion Rate" value={`${metrics.completionRate}%`} subtitle={`${metrics.closed} permits closed`} icon={<CheckCircle2 className="w-5 h-5 text-white" />} color="from-purple-500 to-violet-600" />
          </div>
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('At Risk (<24h)', filteredPermits.filter(p => { const h = parseRemainingTimeToHours(p.remainingTime); return h >= 0 && h <= 24; }))}>
            <ExecutiveKPICard title="At Risk" value={metrics.atRiskSLA} subtitle="Expiring in <24 hours" icon={<AlertOctagon className="w-5 h-5 text-white" />} color="from-amber-500 to-orange-600" />
          </div>
          <div className="cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => openDrillDown('SLA Breached', filteredPermits.filter(p => p.remainingTime.startsWith('-')))}>
            <ExecutiveKPICard title="Breached" value={metrics.criticalSLA} subtitle="Requires immediate action" icon={<Ban className="w-5 h-5 text-white" />} color="from-red-500 to-rose-600" />
          </div>
        </div>
      </div>

      {/* Backlog & Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SLABreakdownCard title="Backlog Aging" icon={<Hourglass className="w-5 h-5 text-gray-600" />}>
          <div className="space-y-3">
            <div 
              className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              onClick={() => openDrillDown('Backlog < 3 days', filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d < 3; }))}
            >
              <span className="text-sm text-green-700 dark:text-green-400">{"< 3 days"}</span>
              <span className="text-xl font-bold text-green-600">{metrics.backlogAging.lessThan3Days}</span>
            </div>
            <div 
              className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              onClick={() => openDrillDown('Backlog 3-7 days', filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d >= 3 && d <= 7; }))}
            >
              <span className="text-sm text-amber-700 dark:text-amber-400">3-7 days</span>
              <span className="text-xl font-bold text-amber-600">{metrics.backlogAging.threeTo7Days}</span>
            </div>
            <div 
              className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => openDrillDown('Backlog > 7 days', filteredPermits.filter(p => { if (p.status !== 'Opened') return false; const d = Math.ceil((Date.now() - new Date(p.creationDate).getTime()) / 86400000); return d > 7; }))}
            >
              <span className="text-sm text-red-700 dark:text-red-400">{"> 7 days"}</span>
              <span className="text-xl font-bold text-red-600">{metrics.backlogAging.moreThan7Days}</span>
            </div>
          </div>
        </SLABreakdownCard>

        <SLABreakdownCard title="Priority Distribution" icon={<Scale className="w-5 h-5 text-gray-600" />}>
          <div className="space-y-3">
            {priorityData.map((p, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 p-2 rounded-lg -mx-2 transition-colors"
                onClick={() => openDrillDown(`${p.name} Priority Permits`, filteredPermits.filter(permit => permit.priority === p.name))}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-sm flex-1">{p.name}</span>
                <span className="font-semibold">{p.value}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={priorityData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Bar dataKey="value" radius={4}>{priorityData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </SLABreakdownCard>

        <SLABreakdownCard title="By Category" icon={<Briefcase className="w-5 h-5 text-gray-600" />}>
          <div className="space-y-3">
            {categoryData.map((item, idx) => {
              const maxValue = Math.max(...categoryData.map(c => c.value));
              const percentage = maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0;
              return (
                <div 
                  key={idx} 
                  className="group cursor-pointer"
                  onClick={() => openDrillDown(`${item.name} Permits`, filteredPermits.filter(p => p.permitCategory === item.name))}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-md" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: item.color }}>{item.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                      style={{ width: `${percentage}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </SLABreakdownCard>

        <SLABreakdownCard title="Team Workload" icon={<Users className="w-5 h-5 text-gray-600" />}>
          <div className="space-y-3">
            {ownerWorkload.slice(0, 5).map((owner, idx) => {
              const total = owner.active + owner.completed;
              const activePercent = total > 0 ? Math.round((owner.active / total) * 100) : 0;
              // Need full name for filtering
              const fullName = Object.entries(metrics.ownerStats).find(([name]) => name.split(' ').slice(0, 2).join(' ') === owner.name)?.[0] || owner.name;
              return (
                <div 
                  key={idx} 
                  className="group p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  onClick={() => openDrillDown(`${owner.name}'s Permits`, filteredPermits.filter(p => p.owner.split(' ').slice(0, 2).join(' ') === owner.name))}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {owner.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{owner.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-600">{owner.active}</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        <span className="text-xs font-semibold text-green-600">{owner.completed}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden flex">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${activePercent}%` }} />
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${100 - activePercent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SLABreakdownCard>
      </div>

      {/* Zone Performance */}
      <SLABreakdownCard title="Zone Performance" icon={<MapPin className="w-5 h-5 text-gray-600" />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zonePerformance.map((zone, idx) => (
            <div 
              key={idx} 
              className="cursor-pointer" 
              onClick={() => openDrillDown(`${zone.zone} Permits`, filteredPermits.filter(p => p.zone === zone.zone))}
            >
              <ZonePerformanceCard {...zone} />
            </div>
          ))}
        </div>
      </SLABreakdownCard>

      {/* DrillDown Modal */}
      {drillDown && (
        <DrillDownModal 
          drillDown={drillDown} 
          onClose={() => setDrillDown(null)} 
          onViewPermit={(permit) => { setDrillDown(null); openPermitModal(permit); }}
        />
      )}
    </div>
  );
}
