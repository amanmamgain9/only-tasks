// TreeRootEditor.tsx
import React, { useCallback } from 'react';
import { Calendar, Clock } from 'lucide-react';
import type { TreeNode } from './types';

// ========================================================================
// TYPES
// ========================================================================
interface TreeRootEditorProps {
  rootNode: TreeNode;
  onUpdateRoot: (updates: Partial<TreeNode>) => void;
}

// ========================================================================
// COMPONENT
// ========================================================================
const TreeRootEditor: React.FC<TreeRootEditorProps> = ({ 
  rootNode, 
  onUpdateRoot 
}) => {
  // ========================================================================
  // HANDLERS - Direct store calls, no local state
  // ========================================================================
  const handleEstimatedTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const minutes = value ? parseInt(value, 10) : null;
    onUpdateRoot({ estimatedTimeMinutes: minutes });
  }, [onUpdateRoot]);

  const handleDueDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onUpdateRoot({ dueDate: value || null });
  }, [onUpdateRoot]);

  // ========================================================================
  // RENDER HELPERS
  // ========================================================================
  const renderTaskForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estimated Time */}
        <div>
          <label htmlFor="root-estimated-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Estimated Time (minutes)
          </label>
          <div className="relative">
            <input
              id="root-estimated-time"
              type="number"
              aria-label="Estimated time in minutes"
              min="0"
              step="15"
              value={rootNode.estimatedTimeMinutes ?? ''}
              onChange={handleEstimatedTimeChange}
              className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g. 60"
            />
            <Clock className="absolute left-3 top-2.5 size-4 text-gray-400" />
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label htmlFor="root-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Due Date
          </label>
          <div className="relative">
            <input
              id="root-due-date"
              type="date"
              aria-label="Due date"
              value={rootNode.dueDate ?? ''}
              onChange={handleDueDateChange}
              className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Calendar className="absolute left-3 top-2.5 size-4 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTaskDisplay = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {rootNode.title}
        </h2>
      </div>
      {renderTaskForm()}
    </div>
  );

  const renderProjectDisplay = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        {rootNode.title}
      </h2>
    </div>
  );

  // ========================================================================
  // RENDER
  // ========================================================================
  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
      {rootNode.nodeType === 'project'
        ? renderProjectDisplay()
        : renderTaskDisplay()}
    </div>
  );
};

TreeRootEditor.displayName = 'TreeRootEditor';
export default TreeRootEditor;
