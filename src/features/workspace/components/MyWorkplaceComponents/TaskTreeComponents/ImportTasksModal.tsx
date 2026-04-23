// ImportTasksModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, FileJson, Loader2 } from 'lucide-react';
import { PendingImportTask, RawImportTask } from './types';
import { NavigationService } from '../../../_services/navigationService';

interface ImportTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (tasks: PendingImportTask[]) => Promise<void>;
}

const TreePreview: React.FC<{ item: PendingImportTask; depth: number }> = ({ item, depth }) => {
  return (
    <div>
      <div 
        className="py-1 text-sm text-gray-700 dark:text-gray-300"
        style={{ paddingLeft: `${depth * 20}px` }}
      >
        • {item.title}
      </div>
      {item.subtasks?.map((child, idx) => (
        <TreePreview key={idx} item={child} depth={depth + 1} />
      ))}
    </div>
  );
};

const stripUnwantedFields = (tasks: RawImportTask[]): PendingImportTask[] => {
  return tasks.map(task => ({
    title: task.title,
    subtasks: task.subtasks ? stripUnwantedFields(task.subtasks) : undefined
  }));
};

const ImportTasksModal: React.FC<ImportTasksModalProps> = ({ isOpen, onClose, onCommit }) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedData, setParsedData] = useState<PendingImportTask[] | null>(null);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      NavigationService.pushScope(modalRef.current, {
        getInitialFocus: (root) => {
          return root.querySelector('textarea') as HTMLElement;
        }
      });

      return () => {
        NavigationService.popScope();
      };
    }
  }, [isOpen]);

  const handleParse = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const tasks = parsed.tasks || [];
      const cleanTasks = stripUnwantedFields(tasks);
      setParsedData(cleanTasks);
      setError('');
    } catch {
      setError('Invalid JSON format');
      setParsedData(null);
    }
  };

  const handleCommit = async () => {
    if (!parsedData) return;
    
    setIsImporting(true);
    setError('');
    
    try {
      await onCommit(parsedData);
      setJsonText('');
      setParsedData(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (isImporting) return;
    setJsonText('');
    setParsedData(null);
    setError('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isImporting) {
      e.preventDefault();
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        ref={modalRef}
        data-scope
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl h-[85vh] flex flex-col shadow-xl"
        onKeyDown={handleKeyDown}
      >
        <div 
          data-region
          id="import-modal-region"
          data-tab-consume
          className="flex flex-col h-full"
        >
          <div data-layout="vertical" className="flex flex-col h-full">
            {/* Header */}
            <div data-layout="horizontal" data-order="0" className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileJson className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Import Tasks (JSON)</h2>
              </div>
              <button 
                data-focusable
                data-tab-consume
                data-order="0"
                onClick={handleClose}
                disabled={isImporting}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Content */}
            <div data-layout="horizontal" data-order="1" className="flex-1 overflow-hidden flex gap-4 p-4 min-h-0">
              {/* JSON Input Section */}
              <div data-layout="vertical" data-order="0" className="flex-1 flex flex-col min-h-0">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                  Paste JSON
                </label>
                <textarea
                  ref={textareaRef}
                  data-focusable
                  data-tab-consume
                  data-order="0"
                  data-entrypoint-focus
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  disabled={isImporting}
                  placeholder={`{\n  "tasks": [\n    {\n      "title": "Task 1",\n      "subtasks": [\n        {\n          "title": "Subtask 1.1"\n        }\n      ]\n    },\n    {\n      "title": "Task 2"\n    }\n  ]\n}`}
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-0 disabled:opacity-50"
                />
                <div data-layout="horizontal" data-order="1" className="flex items-center gap-2 mt-3 flex-shrink-0">
                  <button
                    data-focusable
                    data-tab-consume
                    data-order="0"
                    onClick={handleParse}
                    disabled={!jsonText.trim() || isImporting}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Parse JSON
                  </button>
                  {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                  )}
                </div>
              </div>

              {/* Preview Section */}
              <div data-layout="vertical" data-order="1" className="flex-1 flex flex-col min-h-0">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                  Preview ({parsedData?.length || 0} tasks)
                </label>
                <div className="flex-1 border border-gray-300 dark:border-gray-600 rounded p-4 overflow-auto bg-gray-50 dark:bg-gray-900 min-h-0">
                  {parsedData && parsedData.length > 0 ? (
                    <div>
                      {parsedData.map((task, idx) => (
                        <TreePreview key={idx} item={task} depth={0} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400 text-sm text-center">
                        {error ? 'Fix errors and parse again' : 'Preview will appear here after parsing'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div data-layout="horizontal" data-order="2" className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Format: {`{ "tasks": [{ "title": "...", "subtasks": [...] }] }`}
              </p>
              <div data-layout="horizontal" data-order="0" className="flex gap-2">
                <button
                  data-focusable
                  data-tab-consume
                  data-order="0"
                  onClick={handleClose}
                  disabled={isImporting}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  data-focusable
                  data-tab-consume
                  data-order="1"
                  onClick={handleCommit}
                  disabled={!parsedData || parsedData.length === 0 || isImporting}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isImporting ? 'Importing...' : `Import ${parsedData?.length || 0} Tasks`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportTasksModal;
