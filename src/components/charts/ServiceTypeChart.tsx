'use client';

import { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Sector
} from 'recharts';
import { Layers, MousePointer } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { getChartData, CHART_COLORS, getShortServiceType, cn } from '@/lib/utils';

const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill={fill} className="text-sm font-semibold">
        {payload.name.length > 20 ? payload.name.substring(0, 20) + '...' : payload.name}
      </text>
      <text x={cx} y={cy + 15} textAnchor="middle" fill="#999" className="text-xs">
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        fill={fill}
      />
    </g>
  );
};

export default function ServiceTypeChart() {
  const { getFilteredByDrillDown, navigateDrillDown, drillDown } = useDashboard();
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

  const data = useMemo(() => {
    const permits = getFilteredByDrillDown();
    const chartData = getChartData(permits, 'serviceType');
    return chartData.map((item, index) => ({
      ...item,
      shortName: getShortServiceType(item.name),
      color: CHART_COLORS.serviceTypes[index % CHART_COLORS.serviceTypes.length],
    }));
  }, [getFilteredByDrillDown]);

  const handleClick = (data: any) => {
    if (data && data.name) {
      navigateDrillDown('serviceType', data.name);
    }
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 shadow-lg rounded-lg p-3 border border-gray-100 dark:border-slate-700">
          <p className="font-medium text-gray-900 dark:text-white text-sm">{data.shortName}</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Count: <span className="font-semibold">{data.value}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">
            {data.percentage}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-gray-100 dark:border-slate-700 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Permits by Service Type</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('pie')}
            className={cn(
              "p-2 rounded-lg transition-all",
              chartType === 'pie' 
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8v8l6.92 4.62C16.86 18.5 14.58 20 12 20z"/>
            </svg>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={cn(
              "p-2 rounded-lg transition-all",
              chartType === 'bar' 
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" 
                : "text-gray-400 hover:text-gray-600"
            )}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 9h4v11H4zm6-5h4v16h-4zm6 8h4v8h-4z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          ) : (
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                tick={{ fontSize: 10 }} 
                width={110}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-1 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <MousePointer className="w-3 h-3" />
        <span>Click on segments to drill down</span>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.slice(0, 4).map((item, index) => (
          <div 
            key={index} 
            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
            onClick={() => handleClick(item)}
          >
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: item.color }} 
            />
            <span className="text-gray-600 dark:text-gray-300 truncate">{item.shortName}</span>
            <span className="text-gray-400 ml-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
