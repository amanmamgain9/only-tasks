import React, { useCallback, useState, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
  MoreHorizontal,
  ArrowUpRight
} from 'lucide-react';
import type { VisibleNode } from './types';
import { NavigationService } from '../../../_services/navigationService';
import { findTaskByClientId } from './treeAdapter';
import TreeNodeMenu from './TreeNodeMenu';

interface TreeNodeProps {
  node: VisibleNode;
  nodeIndex: number;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  tasks: any[];
  onToggleExpansion: (node: VisibleNode) => void;
  onToggleCompletion: (node: VisibleNode) => void;
  onMakeRoot: (node: VisibleNode) => void;
  onAddChild: (nodeIndex: number) => void;
  onUpdateTitle: (node: VisibleNode, newTitle: string) => void;
  onDeleteRequest: (nodeIndex: number) => void;
  onCalendarClick: (nodeIndex: number) => void;
}

const serializeTask = (task: any): any => {
  const result: any = { title: task.title || '' };

  if (task.subtasks && task.subtasks.length > 0) {
    result.subtasks = task.subtasks.map((subtask: any) => serializeTask(subtask));
  }

  return result;
};

const TreeNodeComponent: React.FC<TreeNodeProps> = ({
  node,
  nodeIndex,
  depth,
  hasChildren,
  isExpanded,
  tasks,
  onToggleExpansion,
  onToggleCompletion,
  onMakeRoot,
  onAddChild,
  onUpdateTitle,
  onDeleteRequest,
  onCalendarClick,
}) => {
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const completionCheckboxRef = useRef<HTMLButtonElement>(null);
  const makeRootButtonRef = useRef<HTMLButtonElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const showMakeRootButton = node.nodeType === 'task' && (node.title || '').trim().length > 0;
  const showDeleteButton = node.nodeType === 'task' && !node.isEphemeral;

  const openMenu = useCallback(() => {
    const rect = menuButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 150;
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - menuWidth,
      });
    }
    setIsMenuOpen(true);
  }, []);

  const toggleMenu = useCallback(() => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    } else {
      openMenu();
    }
  }, [isMenuOpen, openMenu]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const focused = document.activeElement;

    if (e.key === ' ' || e.key === 'Enter') {
      if (focused === expandButtonRef.current) {
        e.preventDefault();
        onToggleExpansion(node);
        return;
      }
      if (focused === completionCheckboxRef.current) {
        e.preventDefault();
        onToggleCompletion(node);
        return;
      }
      if (focused === makeRootButtonRef.current) {
        e.preventDefault();
        onMakeRoot(node);
        return;
      }
      if (focused === calendarButtonRef.current) {
        e.preventDefault();
        onCalendarClick(nodeIndex);
        return;
      }
      if (focused === menuButtonRef.current) {
        e.preventDefault();
        toggleMenu();
        return;
      }
    }
  }, [node, nodeIndex, onToggleExpansion, onToggleCompletion, onMakeRoot, onCalendarClick, toggleMenu]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    onUpdateTitle(node, newTitle);

    const target = e.target;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }, [node, onUpdateTitle]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpansion(node);
  }, [node, onToggleExpansion]);

  const handleCompletionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCompletion(node);
  }, [node, onToggleCompletion]);

  const handleMakeRootClick = useCallback(() => {
    setIsMenuOpen(false);
    onMakeRoot(node);
  }, [node, onMakeRoot]);

  const handleCalendarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCalendarClick(nodeIndex);
  }, [nodeIndex, onCalendarClick]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMenu();
  }, [toggleMenu]);

  const handleAddChildClick = useCallback(() => {
    setIsMenuOpen(false);
    onAddChild(nodeIndex);
  }, [nodeIndex, onAddChild]);

  const handleDeleteClick = useCallback(() => {
    setIsMenuOpen(false);
    onDeleteRequest(nodeIndex);
  }, [nodeIndex, onDeleteRequest]);

  const handleCopyClick = useCallback(async () => {
    setIsMenuOpen(false);
    const task = findTaskByClientId(tasks, node.id);
    if (!task) return;
    const data = serializeTask(task);
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  }, [node.id, tasks]);

  const handleMenuClose = useCallback(() => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const indentationStyle = { paddingLeft: `${depth * 20 + 12}px` };

  return (
    <>
        <div
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={false}
          className="group flex items-start gap-0.5 md:gap-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 focus-within:bg-blue-50 dark:focus-within:bg-blue-900/20 transition-colors select-none border-b border-gray-200 dark:border-gray-700 last:border-b-0"
        style={indentationStyle}
        data-node-id={node.id}
        data-node-type={node.nodeType}
        data-task-id={node.taskId}
        data-layout="horizontal"
        data-order={nodeIndex.toString()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="flex-shrink-0 flex items-center h-6 mt-1">
          {hasChildren ? (
            <button
              type="button"
              ref={expandButtonRef}
              onClick={handleExpandClick}
              data-focusable
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          ) : (
            <div className="size-6 select-none" />
          )}
        </div>

        <div className="flex-shrink-0 flex items-center h-6 mt-1">
          <button
            ref={completionCheckboxRef}
            onClick={handleCompletionClick}
            data-focusable
            type="button"
            className={`size-4 rounded border flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none ${node.isCompleted
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
              }`}
            title="Toggle completion"
            aria-pressed={node.isCompleted}
          >
            {node.isCompleted && <Check className="size-2.5 text-white" />}
          </button>
        </div>

        {showMakeRootButton ? (
          <div className="flex-shrink-0 flex items-center h-6 mt-1">
            <button
              type="button"
              ref={makeRootButtonRef}
              onClick={handleMakeRootClick}
              data-focusable
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none"
              title="Make Root"
            >
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="size-6 select-none" />
        )}

        <div className="flex-1 relative min-w-0">
          <textarea
            ref={titleInputRef}
            aria-label="Task title"
            value={node.title || ''}
            onChange={handleInputChange}
            data-entrypoint-focus
            data-focusable
            className={`w-full bg-transparent border-none outline-none text-sm py-1 pr-8 pl-1 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 focus:rounded resize-none overflow-hidden ${node.isCompleted
              ? 'line-through text-gray-500 dark:text-gray-400'
              : 'text-gray-700 dark:text-gray-300'
              } placeholder-gray-400 dark:placeholder-gray-500`}
            placeholder="Enter task title"
            rows={1}
            style={{
              minHeight: '24px',
              lineHeight: '1.5'
            }}
          />
          <button
            type="button"
            ref={calendarButtonRef}
            onClick={handleCalendarClick}
            data-focusable
            className="absolute right-1 top-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none opacity-0 group-focus-within:opacity-100 focus-visible:opacity-100"
            title="Set date"
          >
            <Calendar className="size-4" />
          </button>
        </div>

        <div className="flex-shrink-0 flex items-center h-6 mt-1 relative">
          <button
            type="button"
            ref={menuButtonRef}
            onClick={handleMenuClick}
            data-focusable
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 select-none"
            title="Actions"
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      <TreeNodeMenu
        isOpen={isMenuOpen}
        position={menuPosition}
        menuButtonRef={menuButtonRef}
        onClose={handleMenuClose}
        onAddChild={handleAddChildClick}
        onMakeRoot={showMakeRootButton ? handleMakeRootClick : undefined}
        onDelete={showDeleteButton ? handleDeleteClick : undefined}
        onCopy={handleCopyClick}
        showMakeRoot={showMakeRootButton}
        showDelete={showDeleteButton}
      />
    </>
  );
};

export default TreeNodeComponent;
