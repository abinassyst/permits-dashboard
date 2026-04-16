'use client';

import { useMemo, useState, useCallback, createContext, useContext } from 'react';
import { 
  ArrowRight, 
  BarChart3, 
  TrendingUp, 
  Grid3X3, 
  PieChartIcon, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  MapPin, 
  AlertTriangle,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
  Gauge,
  Target,
  BarChart2,
  LineChart as LineChartIcon,
  AreaChart as AreaChartIcon,
  TrendingDown,
  ArrowDownRight,
  Maximize2,
  Table2,
  ArrowUpRight,
  Columns3,
  X,
  Minimize2
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { Permit } from '@/types';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  ComposedChart
} from 'recharts';
import { CHART_COLORS, getStatusColor, getPriorityColor, getShortServiceType, formatDate } from '@/lib/utils';

// ============================================
// TYPES
// ============================================
type DrillDownMode = 'filter' | 'groupBy';
type ChartType = 'pie' | 'bar' | 'horizontalBar' | 'line' | 'area' | 'radial';
type ViewMode = 'chart' | 'grid';

// Focus Mode Context
interface FocusContextType {
  focusedChart: string | null;
  setFocusedChart: (id: string | null) => void;
}
const FocusContext = createContext<FocusContextType>({ focusedChart: null, setFocusedChart: () => {} });

interface GroupStatistics {
  name: string;
  shortName: string;
  count: number;
  percentage: number;
  color: string;
  avgProcessingDays: number;
  highPriorityCount: number;
  slaBreached: number;
  opened: number;
  closed: number;
}

interface DrillDownOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: 'serviceType' | 'status' | 'owner' | 'zone' | 'priority';
}

const drillDownOptions: DrillDownOption[] = [
  { id: 'serviceType', label: 'By Service Type', description: 'Analyze by service category', icon: <BarChart3 className="w-5 h-5" />, type: 'serviceType' },
  { id: 'status', label: 'By Status', description: 'View status distribution', icon: <TrendingUp className="w-5 h-5" />, type: 'status' },
  { id: 'owner', label: 'By Owner', description: 'Workload distribution', icon: <Users className="w-5 h-5" />, type: 'owner' },
  { id: 'zone', label: 'By Zone', description: 'Geographic analysis', icon: <MapPin className="w-5 h-5" />, type: 'zone' },
  { id: 'priority', label: 'By Priority', description: 'Priority breakdown', icon: <AlertTriangle className="w-5 h-5" />, type: 'priority' },
];

const CHART_TYPE_OPTIONS: { id: ChartType; label: string; icon: React.ReactNode }[] = [
  { id: 'pie', label: 'Pie', icon: <PieChartIcon className="w-4 h-4" /> },
  { id: 'bar', label: 'Bar', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'horizontalBar', label: 'H-Bar', icon: <BarChart2 className="w-4 h-4 rotate-90" /> },
  { id: 'line', label: 'Line', icon: <LineChartIcon className="w-4 h-4" /> },
  { id: 'area', label: 'Area', icon: <AreaChartIcon className="w-4 h-4" /> },
  { id: 'radial', label: 'Radial', icon: <Gauge className="w-4 h-4" /> },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================
function calculateSLAMetrics(permits: Permit[]) {
  const total = permits.length;
  const breached = permits.filter(p => p.remainingTime.startsWith('-')).length;
  const onTrack = total - breached;
  const avgRemainingTime = permits.reduce((acc, p) => {
    const time = parseInt(p.remainingTime.replace(/[^-\d]/g, '')) || 0;
    return acc + time;
  }, 0) / (total || 1);
  
  return {
    total,
    breached,
    onTrack,
    breachRate: total > 0 ? Math.round((breached / total) * 100) : 0,
    avgRemainingTime: Math.abs(Math.round(avgRemainingTime))
  };
}

function calculateGroupStats(permits: Permit[], groupKey: string, groupValue: string): GroupStatistics {
  const highPriority = permits.filter(p => p.priority === 'High').length;
  const slaBreached = permits.filter(p => p.remainingTime.startsWith('-')).length;
  const opened = permits.filter(p => p.status === 'Opened').length;
  const closed = permits.filter(p => p.status === 'Closed').length;
  
  const avgDays = permits.reduce((acc, p) => {
    const created = new Date(p.creationDate);
    const updated = new Date(p.updatedDate);
    const days = Math.abs((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    return acc + (isNaN(days) ? 0 : days);
  }, 0) / (permits.length || 1);

  return {
    name: groupValue,
    shortName: groupKey === 'serviceType' ? getShortServiceType(groupValue) : groupValue,
    count: permits.length,
    percentage: 0,
    color: '',
    avgProcessingDays: Math.round(avgDays * 10) / 10,
    highPriorityCount: highPriority,
    slaBreached,
    opened,
    closed
  };
}

// ============================================
// FOCUS MODE OVERLAY
// ============================================
function FocusModeOverlay({ 
  children, 
  title, 
  onClose 
}: { 
  children: React.ReactNode; 
  title: string; 
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-750">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// DRILL DOWN MODE SELECTOR (for per-visual use)
// ============================================
function DrillDownModeSelector({ mode, setMode }: { mode: DrillDownMode; setMode: (m: DrillDownMode) => void }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-700 rounded-xl">
      <button
        onClick={() => setMode('filter')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'filter'
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>Filter Drill-Down</span>
      </button>
      <button
        onClick={() => setMode('groupBy')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          mode === 'groupBy'
            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
        }`}
      >
        <Layers className="w-4 h-4" />
        <span>Group By Drill-Down</span>
      </button>
    </div>
  );
}

// ============================================
// CHART TYPE SELECTOR
// ============================================
function ChartTypeSelector({ chartType, setChartType }: { chartType: ChartType; setChartType: (t: ChartType) => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg">
      {CHART_TYPE_OPTIONS.map(ct => (
        <button
          key={ct.id}
          onClick={() => setChartType(ct.id)}
          title={ct.label}
          className={`p-2 rounded-md transition-all ${
            chartType === ct.id
              ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {ct.icon}
        </button>
      ))}
    </div>
  );
}

// ============================================
// VIEW MODE TOGGLE
// ============================================
function ViewToggle({ viewMode, setViewMode }: { viewMode: ViewMode; setViewMode: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
      <button
        onClick={() => setViewMode('chart')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'chart' 
            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <PieChartIcon className="w-4 h-4" />
        Charts
      </button>
      <button
        onClick={() => setViewMode('grid')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewMode === 'grid' 
            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <Grid3X3 className="w-4 h-4" />
        Grid
      </button>
    </div>
  );
}

// ============================================
// SLA DASHBOARD
// ============================================
function SLADashboard({ permits }: { permits: Permit[] }) {
  const slaMetrics = useMemo(() => calculateSLAMetrics(permits), [permits]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">SLA Compliance</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {100 - slaMetrics.breachRate}%
          </span>
          <span className="text-xs text-emerald-600 mb-1">On Track</span>
        </div>
        <div className="mt-2 h-2 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${100 - slaMetrics.breachRate}%` }}
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-xs font-medium text-red-700 dark:text-red-400">SLA Breached</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-red-900 dark:text-red-100">{slaMetrics.breached}</span>
          <span className="text-xs text-red-600 mb-1">({slaMetrics.breachRate}%)</span>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Active Permits</span>
        </div>
        <span className="text-3xl font-bold text-blue-900 dark:text-blue-100">
          {permits.filter(p => p.status === 'Opened').length}
        </span>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-400">Closed</span>
        </div>
        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {permits.filter(p => p.status === 'Closed').length}
        </span>
      </div>
    </div>
  );
}

// ============================================
// STAT CARD (Compact)
// ============================================
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-800',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-800',
  };

  return (
    <div className={`${colorClasses[color]} rounded-xl p-3 border flex items-center gap-3 transition-all hover:shadow-sm`}>
      <div className="p-2 rounded-lg bg-white/50 dark:bg-slate-800/50">
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// ============================================
// STATISTICS CARDS
// ============================================
function StatisticsCards({ permits }: { permits: Permit[] }) {
  const stats = useMemo(() => {
    const total = permits.length;
    const highPriority = permits.filter(p => p.priority === 'High').length;
    const opened = permits.filter(p => p.status === 'Opened').length;
    const closed = permits.filter(p => p.status === 'Closed').length;
    const slaBreached = permits.filter(p => p.remainingTime.startsWith('-')).length;
    const uniqueOwners = new Set(permits.map(p => p.owner)).size;
    const uniqueZones = new Set(permits.map(p => p.zone)).size;

    const avgDays = permits.reduce((acc, p) => {
      const created = new Date(p.creationDate);
      const updated = new Date(p.updatedDate);
      const days = Math.abs((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      return acc + (isNaN(days) ? 0 : days);
    }, 0) / (total || 1);

    return {
      total, highPriority, opened, closed, slaBreached, uniqueOwners, uniqueZones,
      avgDays: Math.round(avgDays * 10) / 10,
      completionRate: total > 0 ? Math.round((closed / total) * 100) : 0
    };
  }, [permits]);

  const statItems = [
    { label: 'Total', value: stats.total, color: 'blue', icon: <BarChart3 className="w-4 h-4" /> },
    { label: 'Completed', value: `${stats.completionRate}%`, color: 'green', icon: <CheckCircle2 className="w-4 h-4" /> },
    { label: 'Avg Days', value: `${stats.avgDays}d`, color: 'amber', icon: <Clock className="w-4 h-4" /> },
    { label: 'High Priority', value: stats.highPriority, color: 'red', icon: <AlertTriangle className="w-4 h-4" /> },
    { label: 'Owners', value: stats.uniqueOwners, color: 'violet', icon: <Users className="w-4 h-4" /> },
    { label: 'Zones', value: stats.uniqueZones, color: 'cyan', icon: <MapPin className="w-4 h-4" /> },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400',
    red: 'from-red-500/10 to-red-500/5 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400',
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400',
    cyan: 'from-cyan-500/10 to-cyan-500/5 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400',
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {statItems.map((item, idx) => (
        <div 
          key={idx}
          className={`bg-gradient-to-br ${colorClasses[item.color]} rounded-xl p-3 border transition-all hover:shadow-md`}
        >
          <div className="flex items-center gap-2 mb-1">
            {item.icon}
            <span className="text-xs font-medium opacity-80">{item.label}</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================
// DYNAMIC CHART RENDERER
// ============================================
function DynamicChart({ 
  data, 
  chartType, 
  onItemClick,
  height = 320 
}: { 
  data: GroupStatistics[]; 
  chartType: ChartType;
  onItemClick?: (name: string) => void;
  height?: number;
}) {
  const chartData = data.map((d, i) => ({
    ...d,
    fill: d.color || CHART_COLORS.serviceTypes[i % CHART_COLORS.serviceTypes.length]
  }));

  const handleClick = (entry: any) => {
    if (onItemClick && entry?.name) {
      onItemClick(entry.name);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 p-4 min-w-[200px]">
          <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.shortName || data.name}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Count:</span>
              <span className="font-medium text-gray-900 dark:text-white">{data.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Percentage:</span>
              <span className="font-medium text-gray-900 dark:text-white">{data.percentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">High Priority:</span>
              <span className="font-medium text-red-600">{data.highPriorityCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SLA Breached:</span>
              <span className="font-medium text-orange-600">{data.slaBreached}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Days:</span>
              <span className="font-medium text-blue-600">{data.avgProcessingDays}d</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate responsive radii for pie chart
  const outerRadius = Math.min(height / 2 - 10, 120);
  const innerRadius = Math.max(outerRadius * 0.5, 15);

  switch (chartType) {
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="count"
              onClick={handleClick}
              className="cursor-pointer"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="shortName" 
              angle={-45} 
              textAnchor="end" 
              height={50}
              tick={{ fontSize: 9 }}
              interval={0}
            />
            <YAxis tick={{ fontSize: 9 }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" onClick={handleClick} className="cursor-pointer" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'horizontalBar':
      return (
        <ResponsiveContainer width="100%" height={Math.max(height, chartData.length * 25)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis type="number" tick={{ fontSize: 9 }} />
            <YAxis dataKey="shortName" type="category" width={110} tick={{ fontSize: 9 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" onClick={handleClick} className="cursor-pointer" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="shortName" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 9 }} interval={0} />
            <YAxis tick={{ fontSize: 9 }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="count" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={{ fill: '#3B82F6', strokeWidth: 1, r: 4, cursor: 'pointer' }}
              activeDot={{ r: 6, cursor: 'pointer', onClick: (e: any, payload: any) => handleClick(payload.payload) }}
            />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="shortName" angle={-45} textAnchor="end" height={50} tick={{ fontSize: 9 }} interval={0} />
            <YAxis tick={{ fontSize: 9 }} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="count" 
              stroke="#3B82F6" 
              strokeWidth={2}
              fill="url(#colorCount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'radial':
      const radialData = chartData.slice(0, 6);
      const radialBarSize = Math.max(8, Math.min(20, height / 10));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RadialBarChart 
            cx="50%" 
            cy="50%" 
            innerRadius="30%" 
            outerRadius="95%" 
            barSize={radialBarSize} 
            data={radialData}
            startAngle={180}
            endAngle={-180}
          >
            <RadialBar
              background
              dataKey="count"
              onClick={handleClick}
              className="cursor-pointer"
            />
            <Tooltip content={<CustomTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
}

// ============================================
// GROUPED ACCORDION DATA GRID
// ============================================
function GroupedDataGrid({ 
  permits, 
  groupBy, 
  onViewDetails 
}: { 
  permits: Permit[]; 
  groupBy: 'serviceType' | 'status' | 'owner' | 'zone' | 'priority';
  onViewDetails: (permit: Permit) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({});

  const getGroupValue = (permit: Permit) => {
    switch (groupBy) {
      case 'serviceType': return permit.serviceType;
      case 'status': return permit.currentStatus;
      case 'owner': return permit.owner;
      case 'zone': return permit.zone;
      case 'priority': return permit.priority;
      default: return '';
    }
  };

  const groupedData = useMemo(() => {
    const groups: Record<string, Permit[]> = {};
    permits.forEach(permit => {
      const key = getGroupValue(permit);
      if (!groups[key]) groups[key] = [];
      groups[key].push(permit);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [permits, groupBy]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const pageSize = 5;

  return (
    <div className="space-y-3">
      {groupedData.map(([groupName, groupPermits]) => {
        const isExpanded = expandedGroups.has(groupName);
        const page = currentPage[groupName] || 1;
        const totalPages = Math.ceil(groupPermits.length / pageSize);
        const paginatedPermits = groupPermits.slice((page - 1) * pageSize, page * pageSize);
        
        const groupStats = calculateGroupStats(groupPermits, groupBy, groupName);
        const slaMetrics = calculateSLAMetrics(groupPermits);

        return (
          <div key={groupName} className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${isExpanded ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-200 dark:bg-slate-600'}`}>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-blue-600" /> : <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {groupBy === 'serviceType' ? getShortServiceType(groupName) : groupName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{groupPermits.length} permits</p>
                </div>
              </div>
              
              {/* Group Statistics */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-500">SLA Compliance</p>
                  <p className={`font-semibold ${slaMetrics.breachRate > 20 ? 'text-red-600' : 'text-green-600'}`}>
                    {100 - slaMetrics.breachRate}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">High Priority</p>
                  <p className="font-semibold text-red-600">{groupStats.highPriorityCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Avg Days</p>
                  <p className="font-semibold text-blue-600">{groupStats.avgProcessingDays}d</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Open/Closed</p>
                  <p className="font-semibold text-gray-700 dark:text-gray-300">{groupStats.opened}/{groupStats.closed}</p>
                </div>
              </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-slate-700">
                {/* Mobile Stats */}
                <div className="md:hidden grid grid-cols-4 gap-2 p-3 bg-gray-50/50 dark:bg-slate-800/50">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">SLA</p>
                    <p className="text-sm font-semibold text-green-600">{100 - slaMetrics.breachRate}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">High</p>
                    <p className="text-sm font-semibold text-red-600">{groupStats.highPriorityCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Days</p>
                    <p className="text-sm font-semibold text-blue-600">{groupStats.avgProcessingDays}d</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="text-sm font-semibold">{groupStats.opened}/{groupStats.closed}</p>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-slate-700/30">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Request</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Owner</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Priority</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">SLA</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
                      {paginatedPermits.map(permit => (
                        <tr key={permit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <td className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400">{permit.requestNo}</td>
                          <td className="px-4 py-2">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${getStatusColor(permit.currentStatus)}20`, color: getStatusColor(permit.currentStatus) }}
                            >
                              {permit.currentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{permit.owner}</td>
                          <td className="px-4 py-2">
                            <span 
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${getPriorityColor(permit.priority)}20`, color: getPriorityColor(permit.priority) }}
                            >
                              {permit.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs font-medium ${permit.remainingTime.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
                              {permit.remainingTime.startsWith('-') ? 'Breached' : 'On Track'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <button 
                              onClick={() => onViewDetails(permit)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
                    <span className="text-xs text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, [groupName]: Math.max(1, page - 1) }))}
                        disabled={page === 1}
                        className="p-1 rounded border disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => ({ ...prev, [groupName]: Math.min(totalPages, page + 1) }))}
                        disabled={page === totalPages}
                        className="p-1 rounded border disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// STANDARD DATA GRID
// ============================================
function DataGrid({ permits, onViewDetails }: { permits: Permit[]; onViewDetails: (permit: Permit) => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(permits.length / pageSize);
  const paginatedData = permits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-700/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Request No</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Service Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Owner</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Zone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">SLA</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
            {paginatedData.map((permit) => (
              <tr key={permit.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{permit.requestNo}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate" title={permit.serviceType}>
                  {getShortServiceType(permit.serviceType)}
                </td>
                <td className="px-4 py-3">
                  <span 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${getStatusColor(permit.currentStatus)}20`, color: getStatusColor(permit.currentStatus) }}
                  >
                    {permit.currentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{permit.owner}</td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{permit.zone}</td>
                <td className="px-4 py-3">
                  <span 
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${getPriorityColor(permit.priority)}20`, color: getPriorityColor(permit.priority) }}
                  >
                    {permit.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${permit.remainingTime.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
                    {permit.remainingTime.startsWith('-') ? 'Breached' : 'On Track'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button 
                    onClick={() => onViewDetails(permit)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, permits.length)} of {permits.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DRILL-DOWN TOOLBAR (Power BI Style) - Enhanced with Mode Selector
// ============================================
function DrillDownToolbar({
  dimension,
  onDrillDown,
  onExpandAll,
  onShowAsTable,
  onFocusMode,
  mode,
  onModeChange,
  showExpandAll = true
}: {
  dimension: DrillDownOption['type'];
  onDrillDown: (dimension: DrillDownOption['type'], value: string) => void;
  onExpandAll?: () => void;
  onShowAsTable?: () => void;
  onFocusMode?: () => void;
  mode: DrillDownMode;
  onModeChange?: (mode: DrillDownMode) => void;
  showExpandAll?: boolean;
}) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const tools = [
    { 
      id: 'drill', 
      icon: <ArrowDownRight className="w-3.5 h-3.5" />, 
      label: 'Drill Down',
      tooltip: mode === 'filter' ? 'Click chart to filter' : 'Click to drill into group',
      action: () => onDrillDown(dimension, `_group_${dimension}`)
    },
    ...(showExpandAll ? [{ 
      id: 'expand', 
      icon: <Maximize2 className="w-3.5 h-3.5" />, 
      label: 'Expand All',
      tooltip: 'Expand to next level',
      action: onExpandAll
    }] : []),
    { 
      id: 'focus', 
      icon: <Maximize2 className="w-3.5 h-3.5" />, 
      label: 'Focus Mode',
      tooltip: 'Expand to full screen',
      action: onFocusMode
    },
    { 
      id: 'table', 
      icon: <Table2 className="w-3.5 h-3.5" />, 
      label: 'Show as Table',
      tooltip: 'View data as table',
      action: onShowAsTable
    },
  ];

  return (
    <div className="flex items-center gap-1">
      {/* Mode Selector Dropdown */}
      {onModeChange && (
        <div className="relative">
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            onBlur={() => setTimeout(() => setShowModeDropdown(false), 150)}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'filter'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
            }`}
          >
            {mode === 'filter' ? <Filter className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showModeDropdown && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
              <button
                onClick={() => { onModeChange('filter'); setShowModeDropdown(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  mode === 'filter' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter Mode
              </button>
              <button
                onClick={() => { onModeChange('groupBy'); setShowModeDropdown(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  mode === 'groupBy' ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Group Mode
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tool Buttons */}
      <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
        {tools.map(tool => (
          <div key={tool.id} className="relative">
            <button
              onClick={tool.action}
              onMouseEnter={() => setShowTooltip(tool.id)}
              onMouseLeave={() => setShowTooltip(null)}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-600 transition-all"
              title={tool.tooltip}
            >
              {tool.icon}
            </button>
            {showTooltip === tool.id && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                {tool.tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MINI CHART CARD (for multi-chart dashboard)
// ============================================
function MiniChartCard({
  title,
  icon,
  data,
  chartType,
  dimension,
  onDrillDown,
  onChartTypeChange,
  mode,
  onModeChange
}: {
  title: string;
  icon: React.ReactNode;
  data: GroupStatistics[];
  chartType: ChartType;
  dimension: DrillDownOption['type'];
  onDrillDown: (dimension: DrillDownOption['type'], value: string) => void;
  onChartTypeChange: (dimension: DrillDownOption['type'], chartType: ChartType) => void;
  mode: DrillDownMode;
  onModeChange?: (mode: DrillDownMode) => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const topItems = data.slice(0, 5);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const chartContent = (height: number = 200) => showTable ? (
    <div className={`h-[${height}px] overflow-auto`} style={{ height }}>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Name</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Count</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">%</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">High</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">SLA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr 
              key={idx} 
              className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              onClick={() => onDrillDown(dimension, item.name)}
            >
              <td className="py-1.5 px-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-gray-700 dark:text-gray-300">{item.shortName}</span>
              </td>
              <td className="py-1.5 px-2 text-right font-medium text-gray-900 dark:text-white">{item.count}</td>
              <td className="py-1.5 px-2 text-right text-gray-500">{item.percentage}%</td>
              <td className="py-1.5 px-2 text-right text-red-600">{item.highPriorityCount}</td>
              <td className="py-1.5 px-2 text-right">
                <span className={item.slaBreached > 0 ? 'text-red-600' : 'text-green-600'}>
                  {item.slaBreached}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div style={{ height }}>
      <DynamicChart 
        data={data} 
        chartType={chartType} 
        onItemClick={(value) => onDrillDown(dimension, value)}
        height={height}
      />
    </div>
  );

  return (
    <>
      {/* Focus Mode Overlay */}
      {isFocused && (
        <FocusModeOverlay title={title} onClose={() => setIsFocused(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  {icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
                  <p className="text-sm text-gray-500">{total} total items</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onModeChange && (
                  <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => onModeChange('filter')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        mode === 'filter'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filter
                    </button>
                    <button
                      onClick={() => onModeChange('groupBy')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        mode === 'groupBy'
                          ? 'bg-violet-600 text-white shadow'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Group By
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowTable(!showTable)}
                  className={`p-2 rounded-lg transition-all ${showTable ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Table2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
                  {CHART_TYPE_OPTIONS.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => onChartTypeChange(dimension, ct.id)}
                      className={`p-2 rounded-md transition-all ${
                        chartType === ct.id
                          ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      {ct.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {chartContent(400)}
            {/* Legend in focus mode */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onDrillDown(dimension, item.name)}
                  className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.shortName}</p>
                    <p className="text-xs text-gray-500">{item.count} ({item.percentage}%)</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </FocusModeOverlay>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-750">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              {icon}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h4>
              <p className="text-xs text-gray-500">{total} total</p>
            </div>
          </div>
          
          {/* Power BI Style Toolbar */}
          <div className="flex items-center gap-2">
            <DrillDownToolbar 
              dimension={dimension}
              onDrillDown={onDrillDown}
              onShowAsTable={() => setShowTable(!showTable)}
              onFocusMode={() => setIsFocused(true)}
              mode={mode}
              onModeChange={onModeChange}
              showExpandAll={false}
            />
            
            {/* Chart Type Selector */}
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
              {CHART_TYPE_OPTIONS.slice(0, 4).map(ct => (
                <button
                  key={ct.id}
                  onClick={() => onChartTypeChange(dimension, ct.id)}
                  className={`p-1.5 rounded-md transition-all ${
                    chartType === ct.id
                      ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {ct.icon}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart or Table */}
        <div className="p-4">
          {chartContent(200)}
        </div>

        {/* Legend / Top Items */}
        {!showTable && (
          <div className="px-4 pb-4 space-y-1">
            {topItems.map((item, index) => (
              <button
                key={index}
                onClick={() => onDrillDown(dimension, item.name)}
                className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group text-left"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.shortName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{item.count}</span>
                  <span className="text-xs text-gray-400">({item.percentage}%)</span>
                  <ArrowRight className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                </div>
              </button>
            ))}
            {data.length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{data.length - 5} more</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================
// SLA TREND CHART
// ============================================
function SLATrendChart({ permits, onDrillDown, mode, onModeChange }: { permits: Permit[]; onDrillDown?: (dimension: DrillDownOption['type'], value: string) => void; mode?: DrillDownMode; onModeChange?: (mode: DrillDownMode) => void }) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  const trendData = useMemo(() => {
    const breached = permits.filter(p => p.remainingTime.startsWith('-')).length;
    const onTrack = permits.length - breached;
    const high = permits.filter(p => p.priority === 'High').length;
    const medium = permits.filter(p => p.priority === 'Medium').length;
    const low = permits.filter(p => p.priority === 'Low').length;

    return [
      { name: 'On Track', value: onTrack, fill: '#10B981' },
      { name: 'Breached', value: breached, fill: '#EF4444' },
    ];
  }, [permits]);

  const priorityData = useMemo(() => {
    return [
      { name: 'High', value: permits.filter(p => p.priority === 'High').length, fill: '#EF4444' },
      { name: 'Medium', value: permits.filter(p => p.priority === 'Medium').length, fill: '#F59E0B' },
      { name: 'Low', value: permits.filter(p => p.priority === 'Low').length, fill: '#10B981' },
    ];
  }, [permits]);

  const slaMetrics = calculateSLAMetrics(permits);
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const chartTools = [
    { id: 'drill', icon: <ArrowDownRight className="w-3.5 h-3.5" />, tooltip: 'Drill into SLA data', action: () => {} },
    { id: 'expand', icon: <Maximize2 className="w-3.5 h-3.5" />, tooltip: 'Focus mode', action: () => setIsFocused(true) },
    { id: 'table', icon: <Table2 className="w-3.5 h-3.5" />, tooltip: 'Show as table', action: () => {} },
  ];

  const slaContent = (
    <>
      <div className="grid grid-cols-2 gap-6">
        {/* SLA Compliance Gauge */}
        <div className="relative">
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                cx="50%" 
                cy="50%" 
                innerRadius="60%" 
                outerRadius="100%" 
                barSize={15} 
                data={[{ name: 'Compliance', value: 100 - slaMetrics.breachRate, fill: '#10B981' }]}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar background={{ fill: '#E5E7EB' }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">{100 - slaMetrics.breachRate}%</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">Compliance</span>
          </div>
        </div>

        {/* Priority Distribution */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Priority Distribution</p>
          <div className="space-y-3">
            {priorityData.map(item => (
              <div key={item.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all" 
                    style={{ 
                      width: `${permits.length > 0 ? (item.value / permits.length) * 100 : 0}%`,
                      backgroundColor: item.fill 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{slaMetrics.onTrack}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">On Track</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{slaMetrics.breached}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Breached</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{permits.filter(p => p.status === 'Opened').length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{permits.filter(p => p.status === 'Closed').length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Focus Mode Overlay */}
      {isFocused && (
        <FocusModeOverlay title="SLA Performance Overview" onClose={() => setIsFocused(false)}>
          <div className="space-y-6">
            {slaContent}
          </div>
        </FocusModeOverlay>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">SLA Performance Overview</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Real-time compliance monitoring</p>
            </div>
          </div>
          
          {/* Power BI Style Toolbar with Mode Selector */}
          <div className="flex items-center gap-2">
            {/* Mode Selector Dropdown */}
            {onModeChange && (
              <div className="relative">
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  onBlur={() => setTimeout(() => setShowModeDropdown(false), 150)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'filter'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                  }`}
                >
                  {mode === 'filter' ? <Filter className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showModeDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
                    <button
                      onClick={() => { onModeChange('filter'); setShowModeDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                        mode === 'filter' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filter Mode
                    </button>
                    <button
                      onClick={() => { onModeChange('groupBy'); setShowModeDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                        mode === 'groupBy' ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Group Mode
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
              {chartTools.map(tool => (
                <div key={tool.id} className="relative">
                  <button
                    onClick={tool.action}
                    onMouseEnter={() => setShowTooltip(tool.id)}
                    onMouseLeave={() => setShowTooltip(null)}
                    className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-600 transition-all"
                  >
                    {tool.icon}
                  </button>
                  {showTooltip === tool.id && (
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                      {tool.tooltip}
                      <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {slaContent}
      </div>
    </>
  );
}

// ============================================
// OWNER WORKLOAD CHART
// ============================================
function OwnerWorkloadChart({ permits, onDrillDown, mode, onModeChange }: { permits: Permit[]; onDrillDown: (dimension: DrillDownOption['type'], value: string) => void; mode?: DrillDownMode; onModeChange?: (mode: DrillDownMode) => void }) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showTable, setShowTable] = useState(false);
  
  const ownerData = useMemo(() => {
    const groups: Record<string, { total: number; high: number; breached: number }> = {};
    permits.forEach(permit => {
      if (!groups[permit.owner]) {
        groups[permit.owner] = { total: 0, high: 0, breached: 0 };
      }
      groups[permit.owner].total++;
      if (permit.priority === 'High') groups[permit.owner].high++;
      if (permit.remainingTime.startsWith('-')) groups[permit.owner].breached++;
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        total: data.total,
        high: data.high,
        breached: data.breached,
        onTrack: data.total - data.breached
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [permits]);

  const chartTools = [
    { id: 'drill', icon: <ArrowDownRight className="w-3.5 h-3.5" />, tooltip: 'Drill into owner data', action: () => {} },
    { id: 'expand', icon: <Maximize2 className="w-3.5 h-3.5" />, tooltip: 'Focus mode', action: () => setIsFocused(true) },
    { id: 'table', icon: <Table2 className="w-3.5 h-3.5" />, tooltip: 'Show as table', action: () => setShowTable(!showTable) },
  ];

  const chartContent = showTable ? (
    <div className="h-[200px] overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Owner</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Total</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">On Track</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Breached</th>
          </tr>
        </thead>
        <tbody>
          {ownerData.map((item, idx) => (
            <tr 
              key={idx} 
              className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              onClick={() => onDrillDown('owner', item.name)}
            >
              <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300 truncate">{item.name}</td>
              <td className="py-1.5 px-2 text-right font-medium text-gray-900 dark:text-white">{item.total}</td>
              <td className="py-1.5 px-2 text-right text-green-600">{item.onTrack}</td>
              <td className="py-1.5 px-2 text-right text-red-600">{item.breached}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ownerData} layout="vertical" margin={{ left: 0, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="opacity-30" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis 
            type="category" 
            dataKey="name" 
            tick={{ fontSize: 10 }} 
            width={80}
            tickFormatter={(value) => value.split(' ').slice(0, 2).join(' ')}
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-100 dark:border-slate-700 p-3">
                    <p className="font-semibold text-gray-900 dark:text-white mb-2">{data.name}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-medium">{data.total}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">On Track:</span>
                        <span className="font-medium text-green-600">{data.onTrack}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-gray-500">Breached:</span>
                        <span className="font-medium text-red-600">{data.breached}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="onTrack" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} cursor="pointer" onClick={(data) => onDrillDown('owner', data.name)} />
          <Bar dataKey="breached" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(data) => onDrillDown('owner', data.name)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      {/* Focus Mode Overlay */}
      {isFocused && (
        <FocusModeOverlay title="Owner Workload Analysis" onClose={() => setIsFocused(false)}>
          <div className="space-y-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ownerData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    width={120}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="onTrack" name="On Track" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} cursor="pointer" onClick={(data) => onDrillDown('owner', data.name)} />
                  <Bar dataKey="breached" name="Breached" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(data) => onDrillDown('owner', data.name)} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Owner Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ownerData.map((owner, idx) => (
                <button
                  key={idx}
                  onClick={() => onDrillDown('owner', owner.name)}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{owner.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{owner.total} total</span>
                    <span className="text-xs text-green-600">{owner.onTrack} ✓</span>
                    <span className="text-xs text-red-600">{owner.breached} ✗</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </FocusModeOverlay>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Owner Workload</h4>
              <p className="text-xs text-gray-500">Workload distribution & SLA status</p>
            </div>
        </div>
        
        {/* Power BI Style Toolbar with Mode Selector */}
        <div className="flex items-center gap-2">
          {/* Mode Selector Dropdown */}
          {onModeChange && (
            <div className="relative">
              <button
                onClick={() => setShowModeDropdown(!showModeDropdown)}
                onBlur={() => setTimeout(() => setShowModeDropdown(false), 150)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  mode === 'filter'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                }`}
              >
                {mode === 'filter' ? <Filter className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModeDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
                  <button
                    onClick={() => { onModeChange('filter'); setShowModeDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                      mode === 'filter' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Filter Mode
                  </button>
                  <button
                    onClick={() => { onModeChange('groupBy'); setShowModeDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                      mode === 'groupBy' ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Group Mode
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
            {chartTools.map(tool => (
              <div key={tool.id} className="relative">
                <button
                  onClick={tool.action}
                  onMouseEnter={() => setShowTooltip(tool.id)}
                  onMouseLeave={() => setShowTooltip(null)}
                  className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-600 transition-all"
                >
                  {tool.icon}
                </button>
                {showTooltip === tool.id && (
                  <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                    {tool.tooltip}
                    <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {chartContent}
    </div>
    </>
  );
}

// ============================================
// ZONE HEATMAP
// ============================================
function ZoneHeatmap({ permits, onDrillDown, mode, onModeChange }: { permits: Permit[]; onDrillDown: (dimension: DrillDownOption['type'], value: string) => void; mode?: DrillDownMode; onModeChange?: (mode: DrillDownMode) => void }) {
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showTable, setShowTable] = useState(false);
  
  const zoneData = useMemo(() => {
    const groups: Record<string, { total: number; high: number; breached: number }> = {};
    permits.forEach(permit => {
      if (!groups[permit.zone]) {
        groups[permit.zone] = { total: 0, high: 0, breached: 0 };
      }
      groups[permit.zone].total++;
      if (permit.priority === 'High') groups[permit.zone].high++;
      if (permit.remainingTime.startsWith('-')) groups[permit.zone].breached++;
    });

    const zoneColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
    return Object.entries(groups)
      .map(([name, data], index) => ({
        name,
        total: data.total,
        high: data.high,
        breached: data.breached,
        breachRate: data.total > 0 ? Math.round((data.breached / data.total) * 100) : 0,
        color: zoneColors[index % zoneColors.length]
      }))
      .sort((a, b) => b.total - a.total);
  }, [permits]);

  const maxTotal = Math.max(...zoneData.map(z => z.total));

  const chartTools = [
    { id: 'drill', icon: <ArrowDownRight className="w-3.5 h-3.5" />, tooltip: 'Drill into zone', action: () => {} },
    { id: 'expand', icon: <Maximize2 className="w-3.5 h-3.5" />, tooltip: 'Focus mode', action: () => setIsFocused(true) },
    { id: 'table', icon: <Table2 className="w-3.5 h-3.5" />, tooltip: 'Show as table', action: () => setShowTable(!showTable) },
  ];

  const zoneTableView = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Zone</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Total</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">High</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Breached</th>
            <th className="text-right py-2 px-2 font-medium text-gray-600 dark:text-gray-400">Breach %</th>
          </tr>
        </thead>
        <tbody>
          {zoneData.map((zone, idx) => (
            <tr 
              key={idx} 
              className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              onClick={() => onDrillDown('zone', zone.name)}
            >
              <td className="py-1.5 px-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
                <span className="text-gray-700 dark:text-gray-300">{zone.name}</span>
              </td>
              <td className="py-1.5 px-2 text-right font-medium text-gray-900 dark:text-white">{zone.total}</td>
              <td className="py-1.5 px-2 text-right text-orange-600">{zone.high}</td>
              <td className="py-1.5 px-2 text-right text-red-600">{zone.breached}</td>
              <td className="py-1.5 px-2 text-right">
                <span className={zone.breachRate > 20 ? 'text-red-600' : 'text-green-600'}>{zone.breachRate}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const zoneCards = (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {zoneData.map((zone, index) => (
        <button
          key={zone.name}
          onClick={() => onDrillDown('zone', zone.name)}
          className="relative p-4 rounded-xl border-2 border-gray-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all group overflow-hidden"
          style={{ 
            background: `linear-gradient(135deg, ${zone.color}15 0%, ${zone.color}05 100%)`
          }}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 transition-all"
            style={{ 
              height: `${(zone.total / maxTotal) * 60}%`,
              background: `${zone.color}30`
            }}
          />
          <div className="relative">
            <p className="text-xs text-gray-500 dark:text-gray-400">{zone.name}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{zone.total}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs font-medium ${zone.breachRate > 20 ? 'text-red-600' : 'text-green-600'}`}>
                {zone.breachRate}% breach
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-orange-600">{zone.high} high</span>
            </div>
          </div>
          <ArrowRight className="absolute top-3 right-3 w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* Focus Mode Overlay */}
      {isFocused && (
        <FocusModeOverlay title="Zone Distribution Analysis" onClose={() => setIsFocused(false)}>
          <div className="space-y-4">
            {zoneCards}
          </div>
        </FocusModeOverlay>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">Zone Distribution</h4>
              <p className="text-xs text-gray-500">Geographic permit analysis</p>
            </div>
          </div>
          
          {/* Power BI Style Toolbar with Mode Selector */}
          <div className="flex items-center gap-2">
            {/* Mode Selector Dropdown */}
            {onModeChange && (
              <div className="relative">
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  onBlur={() => setTimeout(() => setShowModeDropdown(false), 150)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    mode === 'filter'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
                  }`}
                >
                  {mode === 'filter' ? <Filter className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showModeDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
                    <button
                      onClick={() => { onModeChange('filter'); setShowModeDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                        mode === 'filter' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      Filter Mode
                    </button>
                    <button
                      onClick={() => { onModeChange('groupBy'); setShowModeDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                        mode === 'groupBy' ? 'text-violet-600 bg-violet-50 dark:bg-violet-900/20' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Group Mode
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
              {chartTools.map(tool => (
                <div key={tool.id} className="relative">
                  <button
                    onClick={tool.action}
                    onMouseEnter={() => setShowTooltip(tool.id)}
                    onMouseLeave={() => setShowTooltip(null)}
                    className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-600 transition-all"
                  >
                    {tool.icon}
                  </button>
                  {showTooltip === tool.id && (
                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                      {tool.tooltip}
                      <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {showTable ? zoneTableView : zoneCards}
      </div>
    </>
  );
}

// ============================================
// OVERVIEW LEVEL
// ============================================
function OverviewLevel({ mode: initialMode }: { mode: DrillDownMode }) {
  const { filteredPermits, navigateDrillDown, openPermitModal } = useDashboard();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [mode, setMode] = useState<DrillDownMode>(initialMode);
  const [chartTypes, setChartTypes] = useState<Record<string, ChartType>>({
    serviceType: 'horizontalBar',
    status: 'pie',
    priority: 'pie',
    owner: 'bar',
    zone: 'bar'
  });

  const handleChartTypeChange = (dimension: DrillDownOption['type'], chartType: ChartType) => {
    setChartTypes(prev => ({ ...prev, [dimension]: chartType }));
  };

  const handleDrillDown = (dimension: DrillDownOption['type'], value: string) => {
    if (mode === 'groupBy') {
      navigateDrillDown(dimension, `_group_${dimension}`);
    } else {
      navigateDrillDown(dimension, value);
    }
  };

  const getGroupStats = (dimension: DrillDownOption['type']) => {
    const getFieldValue = (permit: Permit) => {
      switch (dimension) {
        case 'serviceType': return permit.serviceType || 'N/A';
        case 'status': return permit.currentStatus || 'N/A';
        case 'owner': return permit.owner || 'N/A';
        case 'zone': return permit.zone || 'N/A';
        case 'priority': return permit.priority || 'N/A';
        default: return '';
      }
    };

    const groups: Record<string, Permit[]> = {};
    filteredPermits.forEach(permit => {
      const key = getFieldValue(permit);
      if (!groups[key]) groups[key] = [];
      groups[key].push(permit);
    });

    const total = filteredPermits.length;
    return Object.entries(groups)
      .map(([name, permits], index) => {
        const stats = calculateGroupStats(permits, dimension, name);
        return {
          ...stats,
          percentage: total > 0 ? Math.round((permits.length / total) * 100) : 0,
          color: dimension === 'status' 
            ? getStatusColor(name) 
            : dimension === 'priority'
              ? getPriorityColor(name)
              : CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length]
        };
      })
      .sort((a, b) => b.count - a.count);
  };

  return (
    <div className="space-y-4">
      {/* Unified Dashboard Header - Compact Design */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-gray-100 dark:border-slate-700 p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* SLA Gauge - Compact */}
          <div className="col-span-12 sm:col-span-4 lg:col-span-2 flex flex-col items-center justify-center">
            <div className="relative w-28 h-28">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart 
                  cx="50%" 
                  cy="50%" 
                  innerRadius="70%" 
                  outerRadius="100%" 
                  barSize={10} 
                  data={[{ name: 'Compliance', value: 100 - calculateSLAMetrics(filteredPermits).breachRate, fill: '#10B981' }]}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar background={{ fill: '#E5E7EB' }} dataKey="value" cornerRadius={10} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{100 - calculateSLAMetrics(filteredPermits).breachRate}%</span>
                <span className="text-xs text-gray-500">SLA</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="col-span-12 sm:col-span-8 lg:col-span-6 grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-xl font-bold text-green-600 dark:text-green-400">{calculateSLAMetrics(filteredPermits).onTrack}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Track</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{calculateSLAMetrics(filteredPermits).breached}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Breached</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{filteredPermits.filter(p => p.status === 'Opened').length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-slate-700">
              <p className="text-xl font-bold text-gray-600 dark:text-gray-400">{filteredPermits.filter(p => p.status === 'Closed').length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Closed</p>
            </div>
          </div>

          {/* Priority Distribution - Compact */}
          <div className="col-span-12 lg:col-span-4 flex flex-col justify-center gap-2">
            {[
              { name: 'High', value: filteredPermits.filter(p => p.priority === 'High').length, color: '#EF4444', bg: 'bg-red-500' },
              { name: 'Medium', value: filteredPermits.filter(p => p.priority === 'Medium').length, color: '#F59E0B', bg: 'bg-amber-500' },
              { name: 'Low', value: filteredPermits.filter(p => p.priority === 'Low').length, color: '#10B981', bg: 'bg-emerald-500' },
            ].map(item => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12">{item.name}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.bg} rounded-full transition-all`}
                    style={{ width: `${filteredPermits.length > 0 ? (item.value / filteredPermits.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Permits" value={filteredPermits.length} icon={<BarChart3 className="w-4 h-4" />} color="blue" />
        <StatCard label="Completion" value={`${Math.round((filteredPermits.filter(p => p.status === 'Closed').length / filteredPermits.length) * 100) || 0}%`} icon={<CheckCircle2 className="w-4 h-4" />} color="green" />
        <StatCard label="High Priority" value={filteredPermits.filter(p => p.priority === 'High').length} icon={<AlertTriangle className="w-4 h-4" />} color="red" />
        <StatCard label="Unique Owners" value={new Set(filteredPermits.map(p => p.owner)).size} icon={<Users className="w-4 h-4" />} color="violet" />
        <StatCard label="Active Zones" value={new Set(filteredPermits.map(p => p.zone)).size} icon={<MapPin className="w-4 h-4" />} color="cyan" />
        <StatCard label="Avg Days" value={`${Math.round((filteredPermits.reduce((acc, p) => acc + Math.abs((new Date(p.updatedDate).getTime() - new Date(p.creationDate).getTime()) / (1000 * 60 * 60 * 24)), 0) / (filteredPermits.length || 1)) * 10) / 10}d`} icon={<Clock className="w-4 h-4" />} color="amber" />
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Analysis Dashboard</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mode === 'filter' ? 'Click any chart element to filter' : 'Click to group and expand'}
          </p>
        </div>
        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
      </div>

      {viewMode === 'chart' ? (
        <>
          {/* Second Row: Status + Priority + Service Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MiniChartCard
              title="By Status"
              icon={<TrendingUp className="w-4 h-4" />}
              data={getGroupStats('status')}
              chartType={chartTypes.status}
              dimension="status"
              onDrillDown={handleDrillDown}
              onChartTypeChange={handleChartTypeChange}
              mode={mode}
              onModeChange={setMode}
            />
            <MiniChartCard
              title="By Priority"
              icon={<AlertTriangle className="w-4 h-4" />}
              data={getGroupStats('priority')}
              chartType={chartTypes.priority}
              dimension="priority"
              onDrillDown={handleDrillDown}
              onChartTypeChange={handleChartTypeChange}
              mode={mode}
              onModeChange={setMode}
            />
            <MiniChartCard
              title="By Service Type"
              icon={<BarChart3 className="w-4 h-4" />}
              data={getGroupStats('serviceType')}
              chartType={chartTypes.serviceType}
              dimension="serviceType"
              onDrillDown={handleDrillDown}
              onChartTypeChange={handleChartTypeChange}
              mode={mode}
              onModeChange={setMode}
            />
          </div>

          {/* Third Row: Owner Workload + Zone Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OwnerWorkloadChart permits={filteredPermits} onDrillDown={handleDrillDown} mode={mode} onModeChange={setMode} />
            <ZoneHeatmap permits={filteredPermits} onDrillDown={handleDrillDown} mode={mode} onModeChange={setMode} />
          </div>
        </>
      ) : mode === 'groupBy' ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
          <div className="mb-4">
            <h4 className="font-semibold text-gray-900 dark:text-white">Grouped Data View</h4>
            <p className="text-sm text-gray-500">Select a grouping dimension:</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {drillDownOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleDrillDown(opt.type, `_group_${opt.type}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                >
                  {opt.icon}
                  <span className="text-sm font-medium">{opt.label}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <DataGrid permits={filteredPermits} onViewDetails={openPermitModal} />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
          <DataGrid permits={filteredPermits} onViewDetails={openPermitModal} />
        </div>
      )}
    </div>
  );
}

// ============================================
// TREEMAP COMPONENT (Power BI Style)
// ============================================
interface TreemapItem {
  name: string;
  shortName: string;
  value: number;
  percentage: number;
  color: string;
  slaRate: number;
  highPriority: number;
}

function Treemap({ 
  data, 
  onItemClick,
  maxValue 
}: { 
  data: TreemapItem[]; 
  onItemClick?: (item: TreemapItem) => void;
  maxValue: number;
}) {
  // Calculate treemap layout using squarified algorithm
  const calculateLayout = (items: TreemapItem[], width: number, height: number) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    let currentX = 0;
    let currentY = 0;
    let remainingWidth = width;
    let remainingHeight = height;
    let isHorizontal = width >= height;
    
    const result: { item: TreemapItem; x: number; y: number; w: number; h: number }[] = [];
    
    items.forEach((item, index) => {
      const ratio = item.value / total;
      
      if (isHorizontal) {
        const itemWidth = remainingWidth * ratio * (items.length / (items.length - index));
        result.push({
          item,
          x: currentX,
          y: currentY,
          w: Math.min(itemWidth, remainingWidth),
          h: remainingHeight
        });
        currentX += itemWidth;
        remainingWidth -= itemWidth;
        if (remainingWidth < 50) {
          currentX = 0;
          currentY += remainingHeight * 0.5;
          remainingWidth = width;
          remainingHeight *= 0.5;
          isHorizontal = !isHorizontal;
        }
      } else {
        const itemHeight = remainingHeight * ratio * (items.length / (items.length - index));
        result.push({
          item,
          x: currentX,
          y: currentY,
          w: remainingWidth,
          h: Math.min(itemHeight, remainingHeight)
        });
        currentY += itemHeight;
        remainingHeight -= itemHeight;
        if (remainingHeight < 50) {
          currentY = 0;
          currentX += remainingWidth * 0.5;
          remainingHeight = height;
          remainingWidth *= 0.5;
          isHorizontal = !isHorizontal;
        }
      }
    });
    
    return result;
  };

  return (
    <div className="relative w-full h-[300px] rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
      <div className="absolute inset-0 flex flex-wrap">
        {data.map((item, index) => {
          const widthPercent = Math.max(20, Math.sqrt(item.percentage) * 10);
          return (
            <div
              key={item.name}
              onClick={() => onItemClick?.(item)}
              className="relative group cursor-pointer transition-all duration-300 hover:z-10 hover:scale-[1.02] border border-white/20"
              style={{
                backgroundColor: item.color,
                flexGrow: item.value,
                flexBasis: `${Math.max(150, item.percentage * 3)}px`,
                minHeight: '80px'
              }}
            >
              {/* Content */}
              <div className="absolute inset-2 flex flex-col justify-between">
                <div>
                  <p className="font-semibold text-white text-sm drop-shadow-md truncate">{item.shortName}</p>
                  <p className="text-white/80 text-xs">{item.value} permits</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/20 rounded-full h-1.5">
                    <div 
                      className="h-full rounded-full bg-white/80"
                      style={{ width: `${item.slaRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/90 font-medium">{item.slaRate}%</span>
                </div>
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-3 transform scale-95 group-hover:scale-100 transition-transform">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.name}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Permits:</span>
                      <span className="font-medium text-gray-900 dark:text-white">{item.value}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">SLA Rate:</span>
                      <span className={`font-medium ${item.slaRate >= 80 ? 'text-green-600' : item.slaRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{item.slaRate}%</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">High Priority:</span>
                      <span className="font-medium text-orange-600">{item.highPriority}</span>
                    </div>
                  </div>
                  <button className="mt-2 w-full text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1">
                    <ArrowDownRight className="w-3 h-3" />
                    Drill Down
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// DECOMPOSITION TREE (Power BI Style)
// ============================================
function DecompositionTree({ 
  data, 
  dimension,
  onDrillDown,
  availableDimensions,
  getSubGroups
}: { 
  data: any[];
  dimension: string;
  onDrillDown: (dimension: DrillDownOption['type']) => void;
  availableDimensions: DrillDownOption[];
  getSubGroups: (permits: Permit[], dimension: DrillDownOption['type']) => any[];
}) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [selectedSubDimension, setSelectedSubDimension] = useState<DrillDownOption['type'] | null>(null);
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const isExpanded = expandedNode === item.name;
        const subGroups = isExpanded && selectedSubDimension 
          ? getSubGroups(item.permits, selectedSubDimension) 
          : [];
        const subMaxCount = subGroups.length > 0 ? Math.max(...subGroups.map((s: any) => s.count)) : 0;
        
        return (
          <div key={item.name} className="relative">
            {/* Connection line to parent */}
            {index > 0 && (
              <div className="absolute -top-3 left-6 w-px h-3 bg-gray-300 dark:bg-slate-600" />
            )}
            
            {/* Main Node */}
            <div className={`relative rounded-xl border-2 transition-all duration-300 ${
              isExpanded 
                ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20' 
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
            }`}>
              {/* Color indicator bar */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
                style={{ backgroundColor: item.color }}
              />
              
              <div className="p-4 pl-6">
                {/* Header Row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">{item.shortName}</span>
                      <span className="text-xs text-gray-500">{item.count} permits • {item.percentage}%</span>
                    </div>
                  </div>
                  
                  {/* Visual Bar */}
                  <div className="flex-1 max-w-[200px] hidden sm:block">
                    <div className="h-8 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden relative">
                      <div 
                        className="absolute inset-y-0 left-0 rounded-lg transition-all duration-500"
                        style={{ 
                          width: `${(item.count / maxCount) * 100}%`,
                          backgroundColor: item.color 
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{item.count}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Pills */}
                  <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.slaMetrics.breachRate <= 10 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : item.slaMetrics.breachRate <= 30
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {100 - item.slaMetrics.breachRate}% SLA
                    </div>
                    {item.stats.highPriorityCount > 0 && (
                      <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        {item.stats.highPriorityCount} High
                      </div>
                    )}
                  </div>

                  {/* Expand Button */}
                  {availableDimensions.length > 0 && (
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedNode(null);
                          setSelectedSubDimension(null);
                        } else {
                          setExpandedNode(item.name);
                          setSelectedSubDimension(availableDimensions[0]?.type || null);
                        }
                      }}
                      className={`p-2 rounded-lg transition-all ${
                        isExpanded 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Expanded Sub-Tree */}
                {isExpanded && availableDimensions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    {/* Dimension Selector */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs text-gray-500">Break down by:</span>
                      <div className="flex gap-1">
                        {availableDimensions.map(dim => (
                          <button
                            key={dim.id}
                            onClick={() => setSelectedSubDimension(dim.type)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              selectedSubDimension === dim.type
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {dim.icon}
                            {dim.label.replace('By ', '')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sub-groups visualization */}
                    {selectedSubDimension && subGroups.length > 0 && (
                      <div className="relative pl-8">
                        {/* Connecting line */}
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-300 dark:bg-slate-600" />
                        
                        <div className="space-y-2">
                          {subGroups.slice(0, 5).map((sub: any, subIdx: number) => (
                            <div key={sub.name} className="relative flex items-center gap-3">
                              {/* Horizontal connector */}
                              <div className="absolute -left-5 top-1/2 w-5 h-px bg-gray-300 dark:bg-slate-600" />
                              
                              {/* Sub-node */}
                              <div className="flex-1 flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: sub.color }}
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
                                  {sub.shortName}
                                </span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full"
                                      style={{ 
                                        width: `${(sub.count / subMaxCount) * 100}%`,
                                        backgroundColor: sub.color 
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-8 text-right">
                                    {sub.count}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {subGroups.length > 5 && (
                            <p className="text-xs text-gray-400 pl-4">+{subGroups.length - 5} more</p>
                          )}
                        </div>

                        {/* Drill-down action */}
                        <button
                          onClick={() => selectedSubDimension && onDrillDown(selectedSubDimension)}
                          className="mt-3 ml-0 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Add {selectedSubDimension && availableDimensions.find(d => d.type === selectedSubDimension)?.label.replace('By ', '')} as Group Level
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// VISUAL CARD GRID (Tableau Style)
// ============================================
function VisualCardGrid({ 
  data, 
  onItemClick,
  dimension 
}: { 
  data: any[];
  onItemClick?: (item: any) => void;
  dimension: string;
}) {
  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {data.map((item, index) => (
        <div
          key={item.name}
          onClick={() => onItemClick?.(item)}
          className="group relative bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
        >
          {/* Top color bar */}
          <div 
            className="h-1.5"
            style={{ backgroundColor: item.color }}
          />
          
          {/* Content */}
          <div className="p-4">
            {/* Title */}
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {item.shortName}
            </h4>
            
            {/* Main metric */}
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{item.count}</span>
              <span className="text-xs text-gray-500">permits</span>
            </div>
            
            {/* Visual bar */}
            <div className="mb-3">
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: item.color 
                  }}
                />
              </div>
            </div>
            
            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500 block">SLA</span>
                <span className={`font-semibold ${
                  item.slaMetrics.breachRate <= 10 ? 'text-green-600' : 
                  item.slaMetrics.breachRate <= 30 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {100 - item.slaMetrics.breachRate}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">High</span>
                <span className="font-semibold text-orange-600">{item.stats.highPriorityCount}</span>
              </div>
            </div>
          </div>
          
          {/* Hover action indicator */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ArrowDownRight className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// DATA TABLE VIEW FOR GROUPED DATA
// ============================================
function GroupedDataTable({ 
  groupedData, 
  permits,
  currentGroupDimension,
  onViewPermit,
  typeLabels
}: { 
  groupedData: any[];
  permits: Permit[];
  currentGroupDimension: string;
  onViewPermit: (permit: Permit) => void;
  typeLabels: Record<string, string>;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([groupedData[0]?.name]));
  const [sortField, setSortField] = useState<string>('requestNo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortPermits = (permits: Permit[]) => {
    return [...permits].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'requestNo': aVal = a.requestNo; bVal = b.requestNo; break;
        case 'status': aVal = a.currentStatus; bVal = b.currentStatus; break;
        case 'owner': aVal = a.owner; bVal = b.owner; break;
        case 'priority': aVal = a.priority; bVal = b.priority; break;
        case 'creationDate': aVal = new Date(a.creationDate); bVal = new Date(b.creationDate); break;
        default: aVal = a.requestNo; bVal = b.requestNo;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filterPermits = (permits: Permit[]) => {
    if (!searchTerm) return permits;
    const term = searchTerm.toLowerCase();
    return permits.filter(p => 
      p.requestNo.toLowerCase().includes(term) ||
      p.owner.toLowerCase().includes(term) ||
      p.currentStatus.toLowerCase().includes(term) ||
      p.serviceType.toLowerCase().includes(term)
    );
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Search and controls */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search permits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{permits.length} total permits</span>
            <span className="text-gray-300">|</span>
            <button 
              onClick={() => setExpandedGroups(new Set(groupedData.map(g => g.name)))}
              className="text-blue-600 hover:text-blue-700"
            >
              Expand All
            </button>
            <button 
              onClick={() => setExpandedGroups(new Set())}
              className="text-blue-600 hover:text-blue-700"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* Grouped Tables */}
      <div className="divide-y divide-gray-200 dark:divide-slate-700">
        {groupedData.map((group) => {
          const isExpanded = expandedGroups.has(group.name);
          const filteredPermits = filterPermits(group.permits);
          const sortedPermits = sortPermits(filteredPermits);

          return (
            <div key={group.name}>
              {/* Group Header */}
              <div 
                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => toggleGroup(group.name)}
              >
                <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="font-medium text-gray-900 dark:text-white">{group.shortName}</span>
                <span className="text-sm text-gray-500">({group.count} permits)</span>
                <div className="flex-1" />
                <div className="flex items-center gap-3 text-xs">
                  <span className={`px-2 py-0.5 rounded-full ${
                    group.slaMetrics.breachRate <= 10 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : group.slaMetrics.breachRate <= 30
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {100 - group.slaMetrics.breachRate}% SLA
                  </span>
                  <span className="text-green-600">{group.stats.opened} open</span>
                  <span className="text-gray-400">{group.stats.closed} closed</span>
                </div>
              </div>

              {/* Expanded Table */}
              {isExpanded && (
                <div className="bg-gray-50/50 dark:bg-slate-900/30">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-100 dark:bg-slate-700/50">
                          <SortHeader field="requestNo" label="Request #" />
                          <SortHeader field="status" label="Status" />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Service Type</th>
                          <SortHeader field="owner" label="Owner" />
                          <SortHeader field="priority" label="Priority" />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Zone</th>
                          <SortHeader field="creationDate" label="Created" />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">SLA</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {sortedPermits.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                              No permits match your search
                            </td>
                          </tr>
                        ) : (
                          sortedPermits.map((permit) => (
                            <tr 
                              key={permit.id} 
                              className="bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <span className="font-medium text-blue-600 hover:text-blue-700 cursor-pointer" onClick={() => onViewPermit(permit)}>
                                  {permit.requestNo}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: `${getStatusColor(permit.currentStatus)}20`, color: getStatusColor(permit.currentStatus) }}
                                >
                                  {permit.currentStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={permit.serviceType}>
                                {getShortServiceType(permit.serviceType)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{permit.owner}</td>
                              <td className="px-4 py-3">
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: `${getPriorityColor(permit.priority)}20`, color: getPriorityColor(permit.priority) }}
                                >
                                  {permit.priority}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{permit.zone}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(permit.creationDate)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-medium ${permit.remainingTime.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
                                    {permit.remainingTime}
                                  </span>
                                  {permit.remainingTime.startsWith('-') && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => onViewPermit(permit)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MULTI-LEVEL GROUP VIEW
// ============================================
type GroupViewStyle = 'tree' | 'treemap' | 'cards' | 'list' | 'data' | 'sunburst' | 'flow' | 'bubbles' | 'matrix';

// Type for nested group data (multi-level grouping)
interface NestedPermitGroupData {
  name: string;
  shortName: string;
  count: number;
  permits: Permit[];
  percentage: number;
  color: string;
  slaMetrics: ReturnType<typeof calculateSLAMetrics>;
  stats: ReturnType<typeof calculateGroupStats>;
  children?: NestedPermitGroupData[];
  level: number;
  path: string[];
}

// Helper to get field value from permit
const getPermitFieldValue = (permit: Permit, dimension: DrillDownOption['type']): string => {
  switch (dimension) {
    case 'serviceType': return permit.serviceType;
    case 'status': return permit.currentStatus;
    case 'owner': return permit.owner;
    case 'zone': return permit.zone;
    case 'priority': return permit.priority;
    default: return '';
  }
};

// Recursive Tree Node Component for Multi-Level Grouping (Permits)
interface NestedPermitTreeNodeProps {
  group: NestedPermitGroupData;
  expandedGroups: Set<string>;
  toggleGroup: (name: string) => void;
  typeLabels: Record<string, string>;
  groupByLevels: NonNullable<import('@/types').DrillDownState['groupByLevels']>;
  navigateDrillDown: (type: DrillDownOption['type'], value: string) => void;
  openPermitModal: (permit: Permit) => void;
}

function NestedPermitTreeNode({ group, expandedGroups, toggleGroup, typeLabels, groupByLevels, navigateDrillDown, openPermitModal }: NestedPermitTreeNodeProps) {
  const pathKey = group.path.join('/');
  const isExpanded = expandedGroups.has(pathKey);
  const hasChildren = group.children && group.children.length > 0;
  const currentLevelType = groupByLevels[group.level];
  const isLastLevel = group.level === groupByLevels.length - 1;
  
  // Indentation based on level
  const paddingLeft = group.level * 24;
  
  // Different background shades for different levels
  const levelBgColors = [
    'bg-white dark:bg-slate-800',
    'bg-gray-50 dark:bg-slate-800/80',
    'bg-gray-100/50 dark:bg-slate-800/60',
    'bg-gray-100 dark:bg-slate-800/40',
  ];
  const bgColor = levelBgColors[Math.min(group.level, levelBgColors.length - 1)];
  const slaRate = 100 - group.slaMetrics.breachRate;

  return (
    <div className={`border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden ${bgColor}`}>
      <button 
        onClick={() => toggleGroup(pathKey)} 
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        style={{ paddingLeft: `${paddingLeft + 16}px` }}
      >
        {/* Level indicator */}
        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold flex-shrink-0">
          {group.level + 1}
        </span>
        
        {/* Expand/collapse icon */}
        {(hasChildren || !isLastLevel) ? (
          isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronUp className="w-5 h-5 text-gray-400 rotate-180" />
        ) : (
          <div className="w-5" />
        )}
        
        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
        
        <div className="flex-1 text-left">
          <span className="font-medium text-gray-900 dark:text-white">{group.name}</span>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({typeLabels[currentLevelType]})</span>
        </div>
        
        <span className="text-sm text-gray-500 dark:text-gray-400">{group.count} permits</span>
        
        <div className="flex items-center gap-2 ml-4">
          <div className="w-20 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full" 
              style={{ 
                width: `${slaRate}%`, 
                backgroundColor: slaRate >= 80 ? '#22C55E' : slaRate >= 50 ? '#F59E0B' : '#EF4444'
              }} 
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-12">{slaRate}% SLA</span>
        </div>
        
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            navigateDrillDown(currentLevelType, group.name); 
          }} 
          className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-2" style={{ paddingLeft: `${paddingLeft + 16}px` }}>
          {/* Render child groups if available */}
          {hasChildren && (
            <div className="space-y-2 pt-2">
              {group.children!.map((child) => (
                <NestedPermitTreeNode
                  key={child.path.join('/')}
                  group={child}
                  expandedGroups={expandedGroups}
                  toggleGroup={toggleGroup}
                  typeLabels={typeLabels}
                  groupByLevels={groupByLevels}
                  navigateDrillDown={navigateDrillDown}
                  openPermitModal={openPermitModal}
                />
              ))}
            </div>
          )}
          
          {/* Show permits at last level */}
          {isLastLevel && (
            <div className="pr-4 pt-2">
              <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Request #</th>
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Service</th>
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Owner</th>
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Priority</th>
                      <th className="text-right p-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.permits.slice(0, 5).map(permit => (
                      <tr key={permit.id} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                        <td className="p-3 font-mono text-gray-900 dark:text-white">{permit.requestNo}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{getShortServiceType(permit.serviceType)}</td>
                        <td className="p-3">
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-medium" 
                            style={{ backgroundColor: `${getStatusColor(permit.currentStatus)}20`, color: getStatusColor(permit.currentStatus) }}
                          >
                            {permit.currentStatus}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-400">{permit.owner}</td>
                        <td className="p-3">
                          <span 
                            className="px-2 py-1 rounded-full text-xs font-medium" 
                            style={{ backgroundColor: `${getPriorityColor(permit.priority)}20`, color: getPriorityColor(permit.priority) }}
                          >
                            {permit.priority}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button 
                            onClick={() => openPermitModal(permit)} 
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-xs font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {group.permits.length > 5 && (
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                    +{group.permits.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// STUNNING VISUALIZATIONS
// ============================================

// Sunburst Chart - Radial Hierarchy Visualization
interface SunburstViewProps {
  data: NestedPermitGroupData[];
  groupByLevels: string[];
  typeLabels: Record<string, string>;
  onSegmentClick?: (group: NestedPermitGroupData) => void;
}

function SunburstView({ data, groupByLevels, typeLabels, onSegmentClick }: SunburstViewProps) {
  const [hoveredSegment, setHoveredSegment] = useState<NestedPermitGroupData | null>(null);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  
  // Flatten nested data into segments with calculated angles
  const flattenData = useCallback((nodes: NestedPermitGroupData[], parentStartAngle = 0, parentEndAngle = 360, level = 0): Array<{
    group: NestedPermitGroupData;
    startAngle: number;
    endAngle: number;
    level: number;
    innerRadius: number;
    outerRadius: number;
  }> => {
    const segments: Array<{
      group: NestedPermitGroupData;
      startAngle: number;
      endAngle: number;
      level: number;
      innerRadius: number;
      outerRadius: number;
    }> = [];
    
    const totalCount = nodes.reduce((sum, n) => sum + n.count, 0);
    let currentAngle = parentStartAngle;
    const angleRange = parentEndAngle - parentStartAngle;
    
    const baseRadius = 60;
    const ringWidth = 50;
    
    nodes.forEach(node => {
      const proportion = totalCount > 0 ? node.count / totalCount : 0;
      const nodeAngle = proportion * angleRange;
      const endAngle = currentAngle + nodeAngle;
      
      segments.push({
        group: node,
        startAngle: currentAngle,
        endAngle: endAngle,
        level,
        innerRadius: baseRadius + level * ringWidth,
        outerRadius: baseRadius + (level + 1) * ringWidth - 4
      });
      
      if (node.children && node.children.length > 0) {
        segments.push(...flattenData(node.children, currentAngle, endAngle, level + 1));
      }
      
      currentAngle = endAngle;
    });
    
    return segments;
  }, []);
  
  const segments = useMemo(() => flattenData(data), [data, flattenData]);
  
  // SVG arc path generator
  const describeArc = (cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    const x1 = cx + innerR * Math.cos(startRad);
    const y1 = cy + innerR * Math.sin(startRad);
    const x2 = cx + outerR * Math.cos(startRad);
    const y2 = cy + outerR * Math.sin(startRad);
    const x3 = cx + outerR * Math.cos(endRad);
    const y3 = cy + outerR * Math.sin(endRad);
    const x4 = cx + innerR * Math.cos(endRad);
    const y4 = cy + innerR * Math.sin(endRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1}
            L ${x2} ${y2}
            A ${outerR} ${outerR} 0 ${largeArc} 1 ${x3} ${y3}
            L ${x4} ${y4}
            A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1} ${y1}
            Z`;
  };
  
  const cx = 200;
  const cy = 200;
  
  // Level colors for gradient effect
  const levelGradients = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-orange-500 to-orange-600',
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
          <Target className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sunburst Hierarchy</h3>
          <p className="text-xs text-gray-500">
            {groupByLevels.map(l => typeLabels[l]).join(' → ')}
          </p>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sunburst Chart */}
        <div className="flex-1 flex justify-center">
          <svg width="400" height="400" viewBox="0 0 400 400">
            {/* Background rings for visual depth */}
            {groupByLevels.map((_, idx) => (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={60 + (idx + 1) * 50}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-100 dark:text-slate-700"
              />
            ))}
            
            {/* Segments */}
            {segments.map((seg, idx) => {
              const isHovered = hoveredSegment?.path.join('/') === seg.group.path.join('/');
              const isInSelectedPath = selectedPath.length > 0 && 
                seg.group.path.slice(0, selectedPath.length).join('/') === selectedPath.join('/');
              
              return (
                <g key={idx}>
                  <path
                    d={describeArc(cx, cy, seg.innerRadius, seg.outerRadius, seg.startAngle, seg.endAngle)}
                    fill={seg.group.color}
                    stroke="white"
                    strokeWidth="2"
                    className={`cursor-pointer transition-all duration-300 ${
                      isHovered ? 'opacity-100 drop-shadow-lg' : 
                      isInSelectedPath ? 'opacity-90' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{
                      transform: isHovered ? `scale(1.02)` : 'scale(1)',
                      transformOrigin: `${cx}px ${cy}px`,
                      filter: isHovered ? 'brightness(1.1)' : 'none'
                    }}
                    onMouseEnter={() => setHoveredSegment(seg.group)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    onClick={() => {
                      setSelectedPath(seg.group.path);
                      onSegmentClick?.(seg.group);
                    }}
                  />
                  {/* Label for larger segments */}
                  {seg.endAngle - seg.startAngle > 20 && seg.level === 0 && (
                    <text
                      x={cx + (seg.innerRadius + (seg.outerRadius - seg.innerRadius) / 2) * Math.cos(((seg.startAngle + seg.endAngle) / 2 - 90) * Math.PI / 180)}
                      y={cy + (seg.innerRadius + (seg.outerRadius - seg.innerRadius) / 2) * Math.sin(((seg.startAngle + seg.endAngle) / 2 - 90) * Math.PI / 180)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-xs font-medium fill-white pointer-events-none"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                    >
                      {seg.group.shortName?.substring(0, 8)}
                    </text>
                  )}
                </g>
              );
            })}
            
            {/* Center circle with stats */}
            <circle cx={cx} cy={cy} r="55" className="fill-gray-50 dark:fill-slate-900" />
            <text x={cx} y={cy - 10} textAnchor="middle" className="text-2xl font-bold fill-gray-900 dark:fill-white">
              {data.reduce((sum, d) => sum + d.count, 0)}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="text-xs fill-gray-500">
              Total Permits
            </text>
          </svg>
        </div>
        
        {/* Legend & Details */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Level Legend */}
          <div className="space-y-3">
            {groupByLevels.map((level, idx) => (
              <div key={level} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${levelGradients[idx % levelGradients.length]}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ring {idx + 1}: {typeLabels[level]}
                </span>
              </div>
            ))}
          </div>
          
          {/* Hovered/Selected Info */}
          {hoveredSegment && (
            <div className="mt-4 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredSegment.color }} />
                <span className="font-semibold text-gray-900 dark:text-white">{hoveredSegment.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Count</span>
                  <p className="font-bold text-gray-900 dark:text-white">{hoveredSegment.count}</p>
                </div>
                <div>
                  <span className="text-gray-500">Share</span>
                  <p className="font-bold text-gray-900 dark:text-white">{hoveredSegment.percentage}%</p>
                </div>
                <div>
                  <span className="text-gray-500">SLA Rate</span>
                  <p className={`font-bold ${
                    hoveredSegment.slaMetrics.breachRate <= 10 ? 'text-green-500' :
                    hoveredSegment.slaMetrics.breachRate <= 30 ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {100 - hoveredSegment.slaMetrics.breachRate}%
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Level</span>
                  <p className="font-bold text-gray-900 dark:text-white">{hoveredSegment.level + 1}</p>
                </div>
              </div>
              {hoveredSegment.path.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                  <span className="text-xs text-gray-500">Path:</span>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {hoveredSegment.path.map((p, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="text-xs bg-gray-200 dark:bg-slate-600 px-2 py-0.5 rounded-full">{p}</span>
                        {i < hoveredSegment.path.length - 1 && <ChevronRight className="w-3 h-3 text-gray-400" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Top Groups List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top Groups</h4>
            {data.slice(0, 5).map((group, idx) => (
              <div 
                key={group.path.join('/')}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredSegment(group)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: group.color }}>
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{group.name}</p>
                  <p className="text-xs text-gray-500">{group.count} permits</p>
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{group.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Flow/Waterfall View - Animated cascading cards
interface FlowViewProps {
  data: NestedPermitGroupData[];
  groupByLevels: string[];
  typeLabels: Record<string, string>;
  onItemClick?: (group: NestedPermitGroupData) => void;
}

function FlowView({ data, groupByLevels, typeLabels, onItemClick }: FlowViewProps) {
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());
  
  // Get all items at each level
  const levelData = useMemo(() => {
    const levels: NestedPermitGroupData[][] = [];
    
    const collectByLevel = (nodes: NestedPermitGroupData[], level: number) => {
      if (!levels[level]) levels[level] = [];
      nodes.forEach(node => {
        levels[level].push(node);
        if (node.children && node.children.length > 0) {
          collectByLevel(node.children, level + 1);
        }
      });
    };
    
    collectByLevel(data, 0);
    return levels;
  }, [data]);
  
  const totalPermits = data.reduce((sum, d) => sum + d.count, 0);
  
  // Color palette for flow connections
  const flowColors = [
    'from-blue-500 via-blue-400 to-cyan-400',
    'from-purple-500 via-purple-400 to-pink-400',
    'from-orange-500 via-orange-400 to-amber-400',
    'from-green-500 via-green-400 to-emerald-400',
    'from-rose-500 via-rose-400 to-red-400',
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 overflow-x-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Flow</h3>
          <p className="text-xs text-gray-500">
            Visualizing {totalPermits} permits across {groupByLevels.length} levels
          </p>
        </div>
      </div>
      
      <div className="relative min-w-[600px]">
        {/* Level Headers */}
        <div className="flex items-stretch mb-6" style={{ gap: '2rem' }}>
          {groupByLevels.map((level, idx) => (
            <div key={level} className="flex-1 min-w-[200px]">
              <div className={`text-center p-3 rounded-xl bg-gradient-to-r ${flowColors[idx % flowColors.length]} text-white shadow-lg`}>
                <div className="text-xs opacity-80 uppercase tracking-wider">Level {idx + 1}</div>
                <div className="font-bold">{typeLabels[level]}</div>
                {levelData[idx] && (
                  <div className="text-xs opacity-80 mt-1">{levelData[idx].length} groups</div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Flow Cards */}
        <div className="relative">
          {/* Connection lines container */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            <defs>
              {flowColors.map((_, idx) => (
                <linearGradient key={idx} id={`flowGradient${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={`rgb(${idx === 0 ? '59,130,246' : idx === 1 ? '168,85,247' : idx === 2 ? '249,115,22' : '34,197,94'})`} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={`rgb(${idx === 0 ? '6,182,212' : idx === 1 ? '236,72,153' : idx === 2 ? '251,191,36' : '52,211,153'})`} stopOpacity="0.5" />
                </linearGradient>
              ))}
            </defs>
          </svg>
          
          {/* Level columns */}
          <div className="flex items-start relative" style={{ gap: '2rem', zIndex: 1 }}>
            {groupByLevels.map((level, levelIdx) => (
              <div key={level} className="flex-1 min-w-[200px] space-y-3">
                {levelData[levelIdx]?.sort((a, b) => b.count - a.count).slice(0, 8).map((group, groupIdx) => {
                  const slaRate = 100 - group.slaMetrics.breachRate;
                  const isExpanded = expandedFlows.has(group.path.join('/'));
                  const hasChildren = group.children && group.children.length > 0;
                  
                  return (
                    <div 
                      key={group.path.join('/')}
                      className={`relative group animate-in slide-in-from-left duration-500`}
                      style={{ animationDelay: `${(levelIdx * 100) + (groupIdx * 50)}ms` }}
                    >
                      {/* Flow card */}
                      <div 
                        className={`relative p-4 rounded-xl bg-white dark:bg-slate-700 border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                          isExpanded ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-gray-200 dark:border-slate-600'
                        }`}
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedFlows(prev => {
                              const next = new Set(prev);
                              if (next.has(group.path.join('/'))) {
                                next.delete(group.path.join('/'));
                              } else {
                                next.add(group.path.join('/'));
                              }
                              return next;
                            });
                          }
                          onItemClick?.(group);
                        }}
                      >
                        {/* Color accent bar */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                          style={{ backgroundColor: group.color }}
                        />
                        
                        <div className="flex items-start justify-between gap-3 pl-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">{group.shortName}</p>
                            <p className="text-xs text-gray-500 mt-1">{group.count} permits</p>
                          </div>
                          
                          {/* Circular progress for count */}
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                className="fill-none stroke-gray-200 dark:stroke-slate-600"
                                strokeWidth="4"
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                className="fill-none"
                                stroke={group.color}
                                strokeWidth="4"
                                strokeDasharray={`${(group.percentage / 100) * 125.6} 125.6`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">{group.percentage}%</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* SLA bar */}
                        <div className="mt-3 pl-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">SLA Compliance</span>
                            <span className={`font-medium ${
                              slaRate >= 80 ? 'text-green-500' : slaRate >= 50 ? 'text-amber-500' : 'text-red-500'
                            }`}>{slaRate}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${slaRate}%`,
                                backgroundColor: slaRate >= 80 ? '#22C55E' : slaRate >= 50 ? '#F59E0B' : '#EF4444'
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Flow arrow indicator */}
                        {hasChildren && levelIdx < groupByLevels.length - 1 && (
                          <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${flowColors[levelIdx % flowColors.length]} flex items-center justify-center shadow-lg transition-transform ${isExpanded ? 'scale-110' : 'group-hover:scale-110'}`}>
                              <ArrowRight className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {levelData[levelIdx]?.length > 8 && (
                  <div className="text-center text-xs text-gray-500 py-2">
                    +{levelData[levelIdx].length - 8} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Nested Bubbles View - Circle Packing Visualization
interface BubblesViewProps {
  data: NestedPermitGroupData[];
  groupByLevels: string[];
  typeLabels: Record<string, string>;
  onBubbleClick?: (group: NestedPermitGroupData) => void;
}

function BubblesView({ data, groupByLevels, typeLabels, onBubbleClick }: BubblesViewProps) {
  const [hoveredBubble, setHoveredBubble] = useState<NestedPermitGroupData | null>(null);
  const [zoomedGroup, setZoomedGroup] = useState<NestedPermitGroupData | null>(null);
  
  const containerSize = 500;
  
  // Calculate bubble positions and sizes using simple circle packing
  const calculateLayout = useCallback((nodes: NestedPermitGroupData[], containerRadius: number, centerX: number, centerY: number) => {
    const bubbles: Array<{
      group: NestedPermitGroupData;
      x: number;
      y: number;
      r: number;
    }> = [];
    
    const totalCount = nodes.reduce((sum, n) => sum + n.count, 0);
    
    // Sort by size descending for better packing
    const sortedNodes = [...nodes].sort((a, b) => b.count - a.count);
    
    // Spiral layout for simple but effective packing
    let angle = 0;
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
    const spiralGrowth = containerRadius / (nodes.length + 1);
    
    sortedNodes.forEach((node, idx) => {
      const proportion = totalCount > 0 ? node.count / totalCount : 1 / nodes.length;
      const radius = Math.max(20, Math.sqrt(proportion) * containerRadius * 0.6);
      
      // Spiral positioning
      const spiralRadius = (idx + 1) * spiralGrowth * 0.8;
      const x = centerX + spiralRadius * Math.cos(angle + idx * angleStep);
      const y = centerY + spiralRadius * Math.sin(angle + idx * angleStep);
      
      bubbles.push({ group: node, x, y, r: radius });
    });
    
    return bubbles;
  }, []);
  
  const displayData = zoomedGroup?.children || data;
  const bubbles = useMemo(() => 
    calculateLayout(displayData, containerSize / 2 - 20, containerSize / 2, containerSize / 2),
    [displayData, calculateLayout]
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bubble Hierarchy {zoomedGroup && `• ${zoomedGroup.name}`}
            </h3>
            <p className="text-xs text-gray-500">
              {zoomedGroup 
                ? `Level ${zoomedGroup.level + 2}: ${typeLabels[groupByLevels[zoomedGroup.level + 1]] || 'Details'}`
                : `Level 1: ${typeLabels[groupByLevels[0]]}`
              }
            </p>
          </div>
        </div>
        
        {zoomedGroup && (
          <button
            onClick={() => setZoomedGroup(null)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Bubble visualization */}
        <div className="flex-1 flex justify-center">
          <div 
            className="relative rounded-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800"
            style={{ width: containerSize, height: containerSize }}
          >
            {/* Background decorative circles */}
            <div className="absolute inset-8 rounded-full border-2 border-dashed border-gray-200 dark:border-slate-600 opacity-50" />
            <div className="absolute inset-16 rounded-full border-2 border-dashed border-gray-200 dark:border-slate-600 opacity-30" />
            
            {/* Bubbles */}
            {bubbles.map((bubble, idx) => {
              const isHovered = hoveredBubble?.path.join('/') === bubble.group.path.join('/');
              const hasChildren = bubble.group.children && bubble.group.children.length > 0;
              const slaRate = 100 - bubble.group.slaMetrics.breachRate;
              
              return (
                <div
                  key={bubble.group.path.join('/')}
                  className={`absolute rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center overflow-hidden animate-in zoom-in ${
                    isHovered ? 'z-20 scale-110' : 'z-10'
                  }`}
                  style={{
                    left: bubble.x - bubble.r,
                    top: bubble.y - bubble.r,
                    width: bubble.r * 2,
                    height: bubble.r * 2,
                    animationDelay: `${idx * 50}ms`,
                    boxShadow: isHovered 
                      ? `0 0 0 3px white, 0 0 0 5px ${bubble.group.color}, 0 20px 50px -10px ${bubble.group.color}60`
                      : `0 4px 20px -5px ${bubble.group.color}40`
                  }}
                  onMouseEnter={() => setHoveredBubble(bubble.group)}
                  onMouseLeave={() => setHoveredBubble(null)}
                  onClick={() => {
                    if (hasChildren) {
                      setZoomedGroup(bubble.group);
                    }
                    onBubbleClick?.(bubble.group);
                  }}
                >
                  {/* Gradient background */}
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${bubble.group.color} 0%, ${bubble.group.color}dd 100%)`
                    }}
                  />
                  
                  {/* SLA ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx={bubble.r}
                      cy={bubble.r}
                      r={bubble.r - 3}
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth="4"
                    />
                    <circle
                      cx={bubble.r}
                      cy={bubble.r}
                      r={bubble.r - 3}
                      fill="none"
                      stroke={slaRate >= 80 ? '#22C55E' : slaRate >= 50 ? '#F59E0B' : '#EF4444'}
                      strokeWidth="4"
                      strokeDasharray={`${(slaRate / 100) * (2 * Math.PI * (bubble.r - 3))} ${2 * Math.PI * (bubble.r - 3)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Content */}
                  <div className="relative z-10 text-center text-white p-2">
                    {bubble.r > 35 && (
                      <p className="font-bold text-xs truncate max-w-full"
                         style={{ maxWidth: bubble.r * 1.4 }}>
                        {bubble.group.shortName}
                      </p>
                    )}
                    <p className="font-bold text-sm">{bubble.group.count}</p>
                    {bubble.r > 45 && (
                      <p className="text-xs opacity-80">{bubble.group.percentage}%</p>
                    )}
                  </div>
                  
                  {/* Zoom indicator */}
                  {hasChildren && (
                    <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                      <Maximize2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Details sidebar */}
        <div className="w-full lg:w-64 space-y-4">
          {/* Hovered info */}
          {hoveredBubble && (
            <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 mb-3">
                <div 
                  className="w-4 h-4 rounded-full shadow-lg"
                  style={{ backgroundColor: hoveredBubble.color }}
                />
                <span className="font-bold text-gray-900 dark:text-white">{hoveredBubble.name}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{hoveredBubble.count}</p>
                  <p className="text-xs text-gray-500">Permits</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2 text-center">
                  <p className={`text-lg font-bold ${
                    hoveredBubble.slaMetrics.breachRate <= 10 ? 'text-green-500' :
                    hoveredBubble.slaMetrics.breachRate <= 30 ? 'text-amber-500' : 'text-red-500'
                  }`}>{100 - hoveredBubble.slaMetrics.breachRate}%</p>
                  <p className="text-xs text-gray-500">SLA</p>
                </div>
              </div>
              
              {hoveredBubble.children && hoveredBubble.children.length > 0 && (
                <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 text-center">
                  Click to explore {hoveredBubble.children.length} sub-groups →
                </p>
              )}
            </div>
          )}
          
          {/* Legend */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Groups</h4>
            {displayData.slice(0, 6).map(group => (
              <div 
                key={group.path.join('/')}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredBubble(group)}
                onMouseLeave={() => setHoveredBubble(null)}
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{group.shortName}</span>
                <span className="text-xs font-medium text-gray-500">{group.count}</span>
              </div>
            ))}
            {displayData.length > 6 && (
              <p className="text-xs text-gray-400 text-center">+{displayData.length - 6} more</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Matrix/Heatmap View - 2D Grid intersection visualization
interface MatrixViewProps {
  data: NestedPermitGroupData[];
  groupByLevels: string[];
  typeLabels: Record<string, string>;
  permits: Permit[];
  onCellClick?: (rowGroup: NestedPermitGroupData, colValue: string) => void;
}

function MatrixView({ data, groupByLevels, typeLabels, permits, onCellClick }: MatrixViewProps) {
  const [hoveredCell, setHoveredCell] = useState<{row: string, col: string, count: number} | null>(null);
  
  // For matrix, use first two levels
  const rowDimension = groupByLevels[0];
  const colDimension = groupByLevels[1] || 'status';
  
  // Get unique values for columns
  const colValues = useMemo(() => {
    const values = new Set<string>();
    permits.forEach(p => {
      const val = getPermitFieldValue(p, colDimension as any);
      if (val) values.add(val);
    });
    return Array.from(values).sort();
  }, [permits, colDimension]);
  
  // Build matrix data
  const matrixData = useMemo(() => {
    return data.map(rowGroup => {
      const cells: Record<string, { count: number; percentage: number; slaRate: number }> = {};
      let rowTotal = 0;
      
      colValues.forEach(colVal => {
        const matchingPermits = rowGroup.permits.filter(p => 
          getPermitFieldValue(p, colDimension as any) === colVal
        );
        const count = matchingPermits.length;
        rowTotal += count;
        
        const slaBreached = matchingPermits.filter(p => p.remainingTime.startsWith('-')).length;
        const slaRate = count > 0 ? Math.round(((count - slaBreached) / count) * 100) : 100;
        
        cells[colVal] = { count, percentage: 0, slaRate };
      });
      
      // Calculate percentages
      colValues.forEach(colVal => {
        cells[colVal].percentage = rowTotal > 0 ? Math.round((cells[colVal].count / rowTotal) * 100) : 0;
      });
      
      return { row: rowGroup, cells };
    });
  }, [data, colValues, colDimension]);
  
  // Find max count for heatmap intensity
  const maxCount = useMemo(() => {
    let max = 0;
    matrixData.forEach(row => {
      Object.values(row.cells).forEach(cell => {
        if (cell.count > max) max = cell.count;
      });
    });
    return max;
  }, [matrixData]);
  
  // Get heatmap color based on value
  const getHeatColor = (count: number, slaRate: number) => {
    const intensity = maxCount > 0 ? count / maxCount : 0;
    
    // Base on SLA: green = good, red = bad, intensity = opacity
    if (slaRate >= 80) {
      return `rgba(34, 197, 94, ${0.2 + intensity * 0.6})`;
    } else if (slaRate >= 50) {
      return `rgba(251, 191, 36, ${0.2 + intensity * 0.6})`;
    } else {
      return `rgba(239, 68, 68, ${0.2 + intensity * 0.6})`;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl">
            <Grid3X3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Matrix Heatmap</h3>
            <p className="text-xs text-gray-500">
              {typeLabels[rowDimension]} × {typeLabels[colDimension]}
            </p>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.6)' }} />
            <span className="text-gray-500">Good SLA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(251, 191, 36, 0.6)' }} />
            <span className="text-gray-500">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
            <span className="text-gray-500">Critical</span>
          </div>
        </div>
      </div>
      
      {/* Hovered cell info */}
      {hoveredCell && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 animate-in fade-in duration-150">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500">{typeLabels[rowDimension]}:</span>
              <span className="ml-1 font-semibold text-gray-900 dark:text-white">{hoveredCell.row}</span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <div>
              <span className="text-xs text-gray-500">{typeLabels[colDimension]}:</span>
              <span className="ml-1 font-semibold text-gray-900 dark:text-white">{hoveredCell.col}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{hoveredCell.count}</span>
              <span className="text-gray-500">permits</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 sticky left-0 z-10">
                {typeLabels[rowDimension]}
              </th>
              {colValues.map(col => (
                <th 
                  key={col}
                  className="p-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 border-b-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 min-w-[100px]"
                >
                  <div className="truncate max-w-[100px]">{col}</div>
                </th>
              ))}
              <th className="p-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, rowIdx) => (
              <tr key={row.row.path.join('/')} className="group">
                <td className="p-3 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky left-0 z-10">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.row.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
                      {row.row.shortName}
                    </span>
                  </div>
                </td>
                {colValues.map(col => {
                  const cell = row.cells[col];
                  const isHovered = hoveredCell?.row === row.row.name && hoveredCell?.col === col;
                  
                  return (
                    <td 
                      key={col}
                      className={`p-2 border-b border-gray-100 dark:border-slate-700 text-center cursor-pointer transition-all duration-200 ${
                        isHovered ? 'ring-2 ring-blue-500 ring-inset' : ''
                      }`}
                      style={{ 
                        backgroundColor: cell.count > 0 ? getHeatColor(cell.count, cell.slaRate) : 'transparent'
                      }}
                      onMouseEnter={() => setHoveredCell({ row: row.row.name, col, count: cell.count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => onCellClick?.(row.row, col)}
                    >
                      {cell.count > 0 && (
                        <div className="animate-in zoom-in duration-200">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{cell.count}</span>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {cell.slaRate}% SLA
                          </div>
                        </div>
                      )}
                      {cell.count === 0 && (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="p-3 border-b border-gray-100 dark:border-slate-700 text-center bg-gray-50 dark:bg-slate-900/50">
                  <span className="font-bold text-gray-900 dark:text-white">{row.row.count}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-slate-900/50">
              <td className="p-3 font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-50 dark:bg-slate-900/50">
                Total
              </td>
              {colValues.map(col => {
                const colTotal = matrixData.reduce((sum, row) => sum + row.cells[col].count, 0);
                return (
                  <td key={col} className="p-3 text-center font-bold text-gray-900 dark:text-white">
                    {colTotal}
                  </td>
                );
              })}
              <td className="p-3 text-center font-bold text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/20">
                {permits.length}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MultiLevelGroupView({ mode }: { mode: DrillDownMode }) {
  const { drillDown, navigateDrillDown, getFilteredByDrillDown, openPermitModal } = useDashboard();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [groupChartTypes, setGroupChartTypes] = useState<Record<string, ChartType>>({});
  const [viewStyle, setViewStyle] = useState<GroupViewStyle>('sunburst');
  const [sortBy, setSortBy] = useState<'count' | 'name' | 'sla'>('count');

  // Check if we're using multi-level grouping from groupByLevels
  const groupByLevels = drillDown.groupByLevels || [];
  const isMultiLevel = groupByLevels.length > 1;

  // Get current grouping dimension from the last _group_ entry (fallback for single-level)
  const currentGroupDimension = useMemo(() => {
    // If we have groupByLevels, use the first one
    if (groupByLevels.length > 0) {
      return groupByLevels[0];
    }
    // Fallback to breadcrumb-based detection
    for (let i = drillDown.breadcrumb.length - 1; i >= 0; i--) {
      const item = drillDown.breadcrumb[i];
      if (item.value?.startsWith('_group_')) {
        return item.value.replace('_group_', '') as DrillDownOption['type'];
      }
    }
    return 'status' as DrillDownOption['type'];
  }, [drillDown.breadcrumb, groupByLevels]);

  // Get dimensions already used for grouping
  const usedDimensions = useMemo(() => {
    const used = new Set<string>();
    if (groupByLevels.length > 0) {
      groupByLevels.forEach(level => used.add(level));
    } else {
      drillDown.breadcrumb.forEach(item => {
        if (item.value?.startsWith('_group_')) {
          used.add(item.value.replace('_group_', ''));
        }
      });
    }
    return used;
  }, [drillDown.breadcrumb, groupByLevels]);

  // Available dimensions for next level grouping
  const availableDimensions = useMemo(() => {
    return drillDownOptions.filter(opt => !usedDimensions.has(opt.type));
  }, [usedDimensions]);

  const permits = getFilteredByDrillDown();

  const getFieldValue = (permit: Permit, dimension: DrillDownOption['type']) => {
    switch (dimension) {
      case 'serviceType': return permit.serviceType;
      case 'status': return permit.currentStatus;
      case 'owner': return permit.owner;
      case 'zone': return permit.zone;
      case 'priority': return permit.priority;
      default: return '';
    }
  };

  // Build nested group data for multi-level grouping
  const buildNestedGroups = useCallback((
    data: Permit[],
    levels: typeof groupByLevels,
    currentLevel: number = 0,
    path: string[] = [],
    totalCount: number = data.length
  ): NestedPermitGroupData[] => {
    if (currentLevel >= levels.length || data.length === 0) return [];
    
    const levelType = levels[currentLevel];
    const groups: Record<string, Permit[]> = {};
    
    data.forEach(p => {
      const val = getPermitFieldValue(p, levelType);
      if (!groups[val]) groups[val] = [];
      groups[val].push(p);
    });

    return Object.entries(groups).map(([name, items], index) => {
      const newPath = [...path, name];
      const slaMetrics = calculateSLAMetrics(items);
      const stats = calculateGroupStats(items, levelType, name);
      
      return {
        name,
        shortName: levelType === 'serviceType' ? getShortServiceType(name) : (name.length > 15 ? name.substring(0, 15) + '...' : name),
        count: items.length,
        permits: items,
        percentage: Math.round((items.length / totalCount) * 100),
        color: levelType === 'status' 
          ? getStatusColor(name) 
          : levelType === 'priority' 
            ? getPriorityColor(name) 
            : CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length],
        slaMetrics,
        stats,
        children: currentLevel < levels.length - 1 
          ? buildNestedGroups(items, levels, currentLevel + 1, newPath, totalCount)
          : undefined,
        level: currentLevel,
        path: newPath,
      };
    }).sort((a, b) => {
      if (sortBy === 'count') return b.count - a.count;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (100 - b.slaMetrics.breachRate) - (100 - a.slaMetrics.breachRate);
    });
  }, [sortBy]);

  // Multi-level nested group data
  const nestedGroupData = useMemo(() => {
    if (!isMultiLevel) return [];
    return buildNestedGroups(permits, groupByLevels);
  }, [permits, groupByLevels, isMultiLevel, buildNestedGroups]);

  // Group permits by current dimension (single-level)
  const groupedData = useMemo(() => {
    const groups: Record<string, Permit[]> = {};
    permits.forEach(permit => {
      const key = getFieldValue(permit, currentGroupDimension);
      if (!groups[key]) groups[key] = [];
      groups[key].push(permit);
    });
    return Object.entries(groups)
      .map(([name, groupPermits], index) => ({
        name,
        shortName: currentGroupDimension === 'serviceType' ? getShortServiceType(name) : name,
        permits: groupPermits,
        count: groupPermits.length,
        percentage: Math.round((groupPermits.length / permits.length) * 100),
        color: currentGroupDimension === 'status' 
          ? getStatusColor(name)
          : currentGroupDimension === 'priority'
            ? getPriorityColor(name)
            : CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length],
        stats: calculateGroupStats(groupPermits, currentGroupDimension, name),
        slaMetrics: calculateSLAMetrics(groupPermits)
      }))
      .sort((a, b) => b.count - a.count);
  }, [permits, currentGroupDimension]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const handleNextLevelGroup = (dimension: DrillDownOption['type']) => {
    navigateDrillDown(dimension, `_group_${dimension}`);
  };

  const getGroupChartType = (groupName: string) => groupChartTypes[groupName] || 'pie';
  
  const setGroupChartType = (groupName: string, chartType: ChartType) => {
    setGroupChartTypes(prev => ({ ...prev, [groupName]: chartType }));
  };

  // Calculate sub-group statistics for each group
  const getSubGroupStats = (groupPermits: Permit[], subDimension: DrillDownOption['type']) => {
    const subGroups: Record<string, Permit[]> = {};
    groupPermits.forEach(permit => {
      const key = getFieldValue(permit, subDimension);
      if (!subGroups[key]) subGroups[key] = [];
      subGroups[key].push(permit);
    });
    
    const total = groupPermits.length;
    return Object.entries(subGroups)
      .map(([name, permits], index) => {
        const stats = calculateGroupStats(permits, subDimension, name);
        return {
          ...stats,
          percentage: total > 0 ? Math.round((permits.length / total) * 100) : 0,
          color: subDimension === 'status' 
            ? getStatusColor(name)
            : subDimension === 'priority'
              ? getPriorityColor(name)
              : CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length]
        };
      })
      .sort((a, b) => b.count - a.count);
  };

  const typeLabels: Record<string, string> = {
    serviceType: 'Service Type',
    status: 'Status',
    owner: 'Owner',
    zone: 'Zone',
    priority: 'Priority',
  };

  // Prepare treemap data
  const treemapData: TreemapItem[] = groupedData.map(g => ({
    name: g.name,
    shortName: g.shortName,
    value: g.count,
    percentage: g.percentage,
    color: g.color,
    slaRate: 100 - g.slaMetrics.breachRate,
    highPriority: g.stats.highPriorityCount
  }));

  const viewStyleOptions: { id: GroupViewStyle; label: string; icon: React.ReactNode; gradient?: string }[] = [
    { id: 'sunburst', label: 'Sunburst', icon: <Target className="w-4 h-4" />, gradient: 'from-violet-500 to-purple-600' },
    { id: 'flow', label: 'Flow', icon: <Activity className="w-4 h-4" />, gradient: 'from-cyan-500 to-blue-600' },
    { id: 'bubbles', label: 'Bubbles', icon: <Layers className="w-4 h-4" />, gradient: 'from-pink-500 to-rose-600' },
    { id: 'matrix', label: 'Matrix', icon: <Grid3X3 className="w-4 h-4" />, gradient: 'from-amber-500 to-orange-600' },
    { id: 'tree', label: 'Tree', icon: <Layers className="w-4 h-4" /> },
    { id: 'treemap', label: 'Treemap', icon: <Grid3X3 className="w-4 h-4" /> },
    { id: 'cards', label: 'Cards', icon: <Columns3 className="w-4 h-4" /> },
    { id: 'list', label: 'List', icon: <Table2 className="w-4 h-4" /> },
    { id: 'data', label: 'Data', icon: <Eye className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Compact Header Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Left: Current grouping info */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {isMultiLevel 
                  ? `Multi-Level: ${groupByLevels.map(l => typeLabels[l]).join(' → ')}`
                  : `Grouped by ${typeLabels[currentGroupDimension]}`
                }
              </span>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <span className="text-gray-500">{permits.length} permits</span>
              <span className="text-gray-300 dark:text-slate-600">|</span>
              <span className="text-gray-500">
                {isMultiLevel ? nestedGroupData.length : groupedData.length} groups
              </span>
              <span className="text-gray-300 dark:text-slate-600">|</span>
              <span className="text-gray-500">
                {isMultiLevel ? groupByLevels.length : usedDimensions.size} level{(isMultiLevel ? groupByLevels.length : usedDimensions.size) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Right: View style selector + Sort */}
          <div className="flex items-center gap-4">
            {isMultiLevel && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort:</span>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as 'count' | 'name' | 'sla')}
                  className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                >
                  <option value="count">Count</option>
                  <option value="name">Name</option>
                  <option value="sla">SLA %</option>
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 mr-1">View:</span>
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-xl overflow-x-auto">
                {viewStyleOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setViewStyle(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                      viewStyle === opt.id
                        ? opt.gradient 
                          ? `bg-gradient-to-r ${opt.gradient} text-white shadow-lg`
                          : 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {opt.icon}
                    <span className="hidden md:inline">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add Dimension buttons - only for single-level mode */}
        {!isMultiLevel && availableDimensions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Add group level:</span>
              {availableDimensions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => handleNextLevelGroup(opt.type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-700 dark:hover:text-blue-400 rounded-lg text-xs font-medium transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                >
                  {opt.icon}
                  <span>{typeLabels[opt.type]}</span>
                  <ArrowRight className="w-3 h-3 opacity-50" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Different views */}
      {viewStyle === 'treemap' && (
        <Treemap 
          data={treemapData}
          maxValue={Math.max(...treemapData.map(d => d.value))}
          onItemClick={(item) => {
            if (availableDimensions.length > 0) {
              // Could drill down here
            }
          }}
        />
      )}

      {/* Sunburst View - Radial Hierarchy */}
      {viewStyle === 'sunburst' && (
        <SunburstView
          data={isMultiLevel ? nestedGroupData : groupedData.map(g => ({
            ...g,
            slaMetrics: g.slaMetrics,
            stats: g.stats,
            children: [],
            level: 0,
            path: [g.name]
          }))}
          groupByLevels={isMultiLevel ? groupByLevels : [currentGroupDimension]}
          typeLabels={typeLabels}
          onSegmentClick={(group) => {
            toggleGroup(group.path.join('/'));
          }}
        />
      )}

      {/* Flow View - Cascading Data Flow */}
      {viewStyle === 'flow' && (
        <FlowView
          data={isMultiLevel ? nestedGroupData : groupedData.map(g => ({
            ...g,
            slaMetrics: g.slaMetrics,
            stats: g.stats,
            children: [],
            level: 0,
            path: [g.name]
          }))}
          groupByLevels={isMultiLevel ? groupByLevels : [currentGroupDimension]}
          typeLabels={typeLabels}
          onItemClick={(group) => {
            toggleGroup(group.path.join('/'));
          }}
        />
      )}

      {/* Bubbles View - Circle Packing */}
      {viewStyle === 'bubbles' && (
        <BubblesView
          data={isMultiLevel ? nestedGroupData : groupedData.map(g => ({
            ...g,
            slaMetrics: g.slaMetrics,
            stats: g.stats,
            children: [],
            level: 0,
            path: [g.name]
          }))}
          groupByLevels={isMultiLevel ? groupByLevels : [currentGroupDimension]}
          typeLabels={typeLabels}
          onBubbleClick={(group) => {
            toggleGroup(group.path.join('/'));
          }}
        />
      )}

      {/* Matrix View - Heatmap Grid */}
      {viewStyle === 'matrix' && (
        <MatrixView
          data={isMultiLevel ? nestedGroupData : groupedData.map(g => ({
            ...g,
            slaMetrics: g.slaMetrics,
            stats: g.stats,
            children: [],
            level: 0,
            path: [g.name]
          }))}
          groupByLevels={isMultiLevel ? groupByLevels : [currentGroupDimension, 'status']}
          typeLabels={typeLabels}
          permits={permits}
          onCellClick={(rowGroup, colValue) => {
            console.log('Matrix cell clicked:', rowGroup.name, colValue);
          }}
        />
      )}

      {viewStyle === 'cards' && (
        <VisualCardGrid 
          data={groupedData}
          dimension={currentGroupDimension}
          onItemClick={(item) => {
            if (availableDimensions.length > 0) {
              toggleGroup(item.name);
            }
          }}
        />
      )}

      {/* Tree View - Multi-Level */}
      {viewStyle === 'tree' && isMultiLevel && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <div className="space-y-2">
            {nestedGroupData.map((group) => (
              <NestedPermitTreeNode
                key={group.path.join('/')}
                group={group}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                typeLabels={typeLabels}
                groupByLevels={groupByLevels}
                navigateDrillDown={navigateDrillDown}
                openPermitModal={openPermitModal}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tree View - Single Level */}
      {viewStyle === 'tree' && !isMultiLevel && (
        <DecompositionTree 
          data={groupedData}
          dimension={currentGroupDimension}
          onDrillDown={handleNextLevelGroup}
          availableDimensions={availableDimensions}
          getSubGroups={getSubGroupStats}
        />
      )}

      {viewStyle === 'list' && (
        <div className="space-y-3">
          {groupedData.map((group, groupIndex) => {
            const isExpanded = expandedGroups.has(group.name);
            const chartType = getGroupChartType(group.name);

            return (
              <div 
                key={group.name}
                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden"
              >
                {/* Compact Group Header */}
                <div 
                  className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  onClick={() => toggleGroup(group.name)}
                >
                  {/* Color bar */}
                  <div 
                    className="w-1 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  
                  {/* Name and count */}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white truncate block">
                      {group.shortName}
                    </span>
                    <span className="text-xs text-gray-500">{group.count} permits</span>
                  </div>
                  
                  {/* Visual bar */}
                  <div className="flex-1 max-w-[150px] hidden lg:block">
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${group.percentage}%`,
                          backgroundColor: group.color 
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Metrics */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className={`px-2 py-1 rounded-full font-medium ${
                      group.slaMetrics.breachRate <= 10 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : group.slaMetrics.breachRate <= 30
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {100 - group.slaMetrics.breachRate}% SLA
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                      <span className="text-green-600">{group.stats.opened} open</span>
                      <span className="text-gray-400">{group.stats.closed} closed</span>
                      <span className="text-red-500">{group.stats.slaBreached} breached</span>
                    </div>
                  </div>
                  
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 p-4 bg-gray-50/50 dark:bg-slate-900/50">
                    {availableDimensions.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-500">Breakdown by:</span>
                          {availableDimensions.slice(0, 3).map(dim => (
                            <button
                              key={dim.id}
                              onClick={(e) => { e.stopPropagation(); handleNextLevelGroup(dim.type); }}
                              className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 text-xs hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                            >
                              {dim.icon}
                              <span className="text-gray-600 dark:text-gray-400">{typeLabels[dim.type]}</span>
                            </button>
                          ))}
                        </div>
                        
                        {/* Sub-group bars */}
                        <div className="space-y-2">
                          {getSubGroupStats(group.permits, availableDimensions[0]?.type || 'status').slice(0, 5).map((sub, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div 
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: sub.color }}
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400 w-32 truncate">{sub.shortName}</span>
                              <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${sub.percentage}%`,
                                    backgroundColor: sub.color 
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{sub.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick permit preview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.permits.slice(0, 3).map(permit => (
                        <div 
                          key={permit.id}
                          onClick={() => openPermitModal(permit)}
                          className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                        >
                          <span className="text-sm font-medium text-blue-600">{permit.requestNo}</span>
                          <span className="text-xs text-gray-400 truncate flex-1">{permit.owner}</span>
                          <span className={`text-xs font-medium ${permit.remainingTime.startsWith('-') ? 'text-red-500' : 'text-green-500'}`}>
                            {permit.remainingTime.startsWith('-') ? '⚠' : '✓'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {group.permits.length > 3 && (
                      <p className="text-xs text-gray-400 mt-2 text-center">+{group.permits.length - 3} more permits</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewStyle === 'data' && (
        <GroupedDataTable 
          groupedData={groupedData}
          permits={permits}
          currentGroupDimension={currentGroupDimension}
          onViewPermit={openPermitModal}
          typeLabels={typeLabels}
        />
      )}
    </div>
  );
}

// ============================================
// GROUP LEVEL (Legacy - redirect to MultiLevelGroupView)
// ============================================
function GroupLevel({ mode }: { mode: DrillDownMode }) {
  return <MultiLevelGroupView mode={mode} />;
}

// ============================================
// DETAIL LEVEL
// ============================================
function DetailLevel({ mode }: { mode: DrillDownMode }) {
  const { drillDown, getFilteredByDrillDown, navigateDrillDown, openPermitModal } = useDashboard();
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [chartType, setChartType] = useState<ChartType>('bar');
  
  const permits = getFilteredByDrillDown();

  const availableDimensions = useMemo(() => {
    const usedTypes = new Set(drillDown.breadcrumb.map(b => b.type).filter(Boolean));
    return drillDownOptions.filter(opt => !usedTypes.has(opt.type));
  }, [drillDown.breadcrumb]);

  const [selectedDimension, setSelectedDimension] = useState<DrillDownOption['type'] | null>(
    availableDimensions[0]?.type || null
  );

  const groupStats = useMemo(() => {
    if (!selectedDimension) return [];

    const getFieldValue = (permit: Permit) => {
      switch (selectedDimension) {
        case 'serviceType': return permit.serviceType;
        case 'status': return permit.currentStatus;
        case 'owner': return permit.owner;
        case 'zone': return permit.zone;
        case 'priority': return permit.priority;
        default: return '';
      }
    };
    
    const groups: Record<string, Permit[]> = {};
    permits.forEach(permit => {
      const key = getFieldValue(permit);
      if (!groups[key]) groups[key] = [];
      groups[key].push(permit);
    });
    
    const total = permits.length;
    return Object.entries(groups)
      .map(([name, groupPermits], index) => {
        const stats = calculateGroupStats(groupPermits, selectedDimension, name);
        return {
          ...stats,
          percentage: total > 0 ? Math.round((groupPermits.length / total) * 100) : 0,
          color: selectedDimension === 'status' 
            ? getStatusColor(name) 
            : selectedDimension === 'priority'
              ? getPriorityColor(name)
              : CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length]
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [permits, selectedDimension]);

  const handleDrillDown = (value: string) => {
    if (selectedDimension) {
      navigateDrillDown(selectedDimension, value);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Filtered to <span className="font-bold">{permits.length} permits</span>
            </p>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600">{permits.filter(p => p.status === 'Opened').length} Active</span>
            <span className="text-gray-500">{permits.filter(p => p.status === 'Closed').length} Closed</span>
            <span className="text-red-600">{permits.filter(p => p.remainingTime.startsWith('-')).length} SLA Breached</span>
          </div>
        </div>
      </div>

      <SLADashboard permits={permits} />
      <StatisticsCards permits={permits} />

      {availableDimensions.length > 0 && selectedDimension && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Continue Analysis</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select another dimension to analyze</p>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
              {viewMode === 'chart' && <ChartTypeSelector chartType={chartType} setChartType={setChartType} />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {availableDimensions.map(option => (
              <button
                key={option.id}
                onClick={() => setSelectedDimension(option.type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedDimension === option.type
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-2 border-blue-500'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 border-2 border-transparent hover:border-gray-300'
                }`}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          {viewMode === 'chart' ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <DynamicChart data={groupStats} chartType={chartType} onItemClick={handleDrillDown} height={350} />
              </div>
              <div className="lg:col-span-2 space-y-2 max-h-[350px] overflow-y-auto">
                {groupStats.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleDrillDown(item.name)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group border border-gray-100 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{item.shortName}</p>
                        <p className="text-xs text-gray-500">{item.highPriorityCount} high priority</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{item.count}</p>
                        <p className="text-xs text-gray-500">{item.percentage}%</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : mode === 'groupBy' && selectedDimension ? (
            <GroupedDataGrid permits={permits} groupBy={selectedDimension} onViewDetails={openPermitModal} />
          ) : (
            <DataGrid permits={permits} onViewDetails={openPermitModal} />
          )}
        </div>
      )}

      {availableDimensions.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-card border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Matching Permits</h3>
          <DataGrid permits={permits} onViewDetails={openPermitModal} />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function DrillDownView() {
  const { drillDown } = useDashboard();
  const [mode, setMode] = useState<DrillDownMode>('filter');
  
  const renderLevel = () => {
    if (drillDown.level === 0) {
      return <OverviewLevel mode={mode} />;
    }
    
    if (drillDown.value?.startsWith('_group_')) {
      return <GroupLevel mode={mode} />;
    }
    
    return <DetailLevel mode={mode} />;
  };

  return (
    <div className="space-y-6">
      {drillDown.level === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Data Analysis</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click any chart element to drill down - use each visual's options menu for mode
            </p>
          </div>
        </div>
      )}

      {renderLevel()}
    </div>
  );
}
