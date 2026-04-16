'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Eye, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { Permit, SortState } from '@/types';
import { cn, formatDate, getStatusColor, getPriorityColor, truncateText, exportToCSV, getShortServiceType } from '@/lib/utils';

export default function PermitsTable() {
  const { getFilteredByDrillDown, openPermitModal } = useDashboard();
  const [sortState, setSortState] = useState<SortState>({ column: 'creationDate', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const permits = getFilteredByDrillDown();

  const sortedPermits = useMemo(() => {
    if (!sortState.column || !sortState.direction) return permits;

    return [...permits].sort((a, b) => {
      const aVal = a[sortState.column!];
      const bVal = b[sortState.column!];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortState.direction === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [permits, sortState]);

  const totalPages = Math.ceil(sortedPermits.length / pageSize);
  const paginatedPermits = sortedPermits.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (column: keyof Permit) => {
    setSortState(prev => ({
      column,
      direction: prev.column === column 
        ? prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc'
        : 'asc'
    }));
  };

  const SortIcon = ({ column }: { column: keyof Permit }) => {
    if (sortState.column !== column) {
      return <ArrowUp className="w-3 h-3 text-gray-300" />;
    }
    if (sortState.direction === 'asc') {
      return <ArrowUp className="w-3 h-3 text-blue-500" />;
    }
    if (sortState.direction === 'desc') {
      return <ArrowDown className="w-3 h-3 text-blue-500" />;
    }
    return <ArrowUp className="w-3 h-3 text-gray-300" />;
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <span 
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ 
        backgroundColor: `${getStatusColor(status)}20`,
        color: getStatusColor(status)
      }}
    >
      {status}
    </span>
  );

  const PriorityBadge = ({ priority }: { priority: string }) => (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ 
        backgroundColor: `${getPriorityColor(priority)}20`,
        color: getPriorityColor(priority)
      }}
    >
      {priority}
    </span>
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-gray-100 dark:border-slate-700 overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Permits Details</h3>
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
            {permits.length} records
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
          <button
            onClick={() => exportToCSV(permits, 'permits-export')}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-750">
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('requestNo')}
              >
                <div className="flex items-center gap-2">
                  Request No
                  <SortIcon column="requestNo" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('serviceType')}
              >
                <div className="flex items-center gap-2">
                  Service Type
                  <SortIcon column="serviceType" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('currentStatus')}
              >
                <div className="flex items-center gap-2">
                  Status
                  <SortIcon column="currentStatus" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('owner')}
              >
                <div className="flex items-center gap-2">
                  Owner
                  <SortIcon column="owner" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('zone')}
              >
                <div className="flex items-center gap-2">
                  Zone
                  <SortIcon column="zone" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center gap-2">
                  Priority
                  <SortIcon column="priority" />
                </div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => handleSort('creationDate')}
              >
                <div className="flex items-center gap-2">
                  Created
                  <SortIcon column="creationDate" />
                </div>
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {paginatedPermits.map((permit) => (
              <tr 
                key={permit.id}
                className="hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {permit.requestNo}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300" title={permit.serviceType}>
                    {getShortServiceType(permit.serviceType)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={permit.currentStatus} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {truncateText(permit.owner, 20)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {permit.zone}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={permit.priority} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(permit.creationDate)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openPermitModal(permit)}
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

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-slate-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, permits.length)} of {permits.length} entries
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={cn(
              "p-2 rounded-lg transition-colors",
              currentPage === 1 
                ? "text-gray-300 cursor-not-allowed" 
                : "text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={cn(
                  "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                  currentPage === pageNum
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700"
                )}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={cn(
              "p-2 rounded-lg transition-colors",
              currentPage === totalPages 
                ? "text-gray-300 cursor-not-allowed" 
                : "text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
