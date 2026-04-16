'use client';

import { useMemo } from 'react';
import { X, Calendar, MapPin, User, FileText, Clock, Tag, AlertCircle } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { formatDate, getStatusColor, getPriorityColor } from '@/lib/utils';

export default function PermitModal() {
  const { selectedPermit, isModalOpen, closePermitModal } = useDashboard();

  if (!isModalOpen || !selectedPermit) return null;

  const statusColor = getStatusColor(selectedPermit.currentStatus);
  const priorityColor = getPriorityColor(selectedPermit.priority);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closePermitModal}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Permit Details</p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedPermit.requestNo}
            </h2>
          </div>
          <button
            onClick={closePermitModal}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Status and Priority */}
          <div className="flex items-center gap-3 mb-6">
            <span 
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: `${statusColor}20`,
                color: statusColor
              }}
            >
              {selectedPermit.currentStatus}
            </span>
            <span 
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: `${priorityColor}20`,
                color: priorityColor
              }}
            >
              {selectedPermit.priority} Priority
            </span>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
              selectedPermit.status === 'Opened' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'
            }`}>
              {selectedPermit.status}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Service Type */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">Service Type</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.serviceType}</p>
            </div>

            {/* Owner */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Owner</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.owner}</p>
            </div>

            {/* Location */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span className="text-sm font-medium">Location</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.location}</p>
            </div>

            {/* Zone */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Zone</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.zone}</p>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-medium">Category</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.permitCategory}</p>
            </div>

            {/* Created Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Created Date</span>
              </div>
              <p className="text-gray-900 dark:text-white">{formatDate(selectedPermit.creationDate)}</p>
            </div>

            {/* Updated Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <p className="text-gray-900 dark:text-white">{formatDate(selectedPermit.updatedDate)}</p>
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Assigned Employee</span>
              </div>
              <p className="text-gray-900 dark:text-white">{selectedPermit.finalEmployee}</p>
            </div>

            {/* SLA */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">Remaining Time</span>
              </div>
              <p className={`font-medium ${
                selectedPermit.remainingTime.startsWith('-') 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {selectedPermit.remainingTime}
              </p>
            </div>

            {/* Remarks */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Remarks</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-gray-900 dark:text-white" dir="auto">
                  {selectedPermit.finalRemarks}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-slate-700">
          <button
            onClick={closePermitModal}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              window.print();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
