import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Check,
  Calendar,
  MoreHorizontal,
  ArrowUpRight,
  Repeat2,
  Tags
} from 'lucide-react';
import type { VisibleNode } from './types';
import { NavigationService } from '../../../_services/navigationService';
import { findTaskByClientId } from './treeAdapter';
import TreeNodeMenu from './TreeNodeMenu';
import LifestyleTraitsEditor from './LifestyleTraitsEditor';
import {
  getLifestyleTraitLabel,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  type LifestyleTraitAllocation,
  type LifestyleTraitId,
} from '@/features/categories/taskCategories';

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
  onUpdateLifestyleTraits: (node: VisibleNode, allocations: LifestyleTraitAllocation[]) => void;
  onDeleteRequest: (nodeIndex: number) => void;
  onCalendarClick: (nodeIndex: number) => void;
  onRepeatClick: (nodeIndex: number) => void;
}

const serializeTask = (task: any): any => {
  const result: any = { title: task.title || '' };

  if (task.subtasks && task.subtasks.length > 0) {
    result.subtasks = task.subtasks.map((subtask: any) => serializeTask(subtask));
  }

  return result;
};

const LIFESTYLE_TRAIT_CHIP_CLASSES: Record<LifestyleTraitId, string> = {
  learning: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
  health: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  social: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  hobby: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
};

function getDateKey(value: string | null | undefined) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function formatDateKeyLabel(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  const label = new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return label || `${month}/${day}`;
}

function getRolloverLabel(node: VisibleNode) {
  const currentDate = getDateKey(node.dueDate);
  const originalDate = getDateKey(node.originalDueDate);
  if (!currentDate || !originalDate || currentDate === originalDate) return null;
  return `Rolled from ${formatDateKeyLabel(originalDate)}`;
}

function getTargetProgressPeriodLabel(targetProgress: NonNullable<VisibleNode['recurrenceTargetProgress']>) {
  if (targetProgress.period === 'week') return 'this week';
  return formatDateKeyLabel(targetProgress.localDate);
}

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
  onUpdateLifestyleTraits,
  onDeleteRequest,
  onCalendarClick,
  onRepeatClick,
}) => {
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const completionCheckboxRef = useRef<HTMLButtonElement>(null);
  const makeRootButtonRef = useRef<HTMLButtonElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const repeatButtonRef = useRef<HTMLButtonElement>(null);
  const lifestyleTraitsButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLifestyleEditorOpen, setIsLifestyleEditorOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const isCategoryRoot = node.systemType === 'category_root';
  const isRecurrenceTemplate = node.recurrenceRole === 'template';
  const targetProgress = node.recurrenceTargetProgress ?? null;
  const isRecurrenceTarget = Boolean(targetProgress);
  const showMakeRootButton = node.nodeType === 'task' && !isCategoryRoot && !isRecurrenceTarget && (node.title || '').trim().length > 0;
  const showDeleteButton = node.nodeType === 'task' && !isCategoryRoot && !isRecurrenceTarget && !node.isEphemeral;
  const showCalendarButton = !isCategoryRoot && !isRecurrenceTarget;
  const showRepeatButton = !isCategoryRoot && !isRecurrenceTarget && !node.isEphemeral && (node.title || '').trim().length > 0;
  const showMenuButton = !isCategoryRoot && !isRecurrenceTarget;
  const categoryAllocations = useMemo(
    () => normalizeTaskCategoryAllocations(node.categoryAllocations),
    [node.categoryAllocations],
  );
  const primaryCategory = categoryAllocations[0];
  const isLifestyleTask = primaryCategory?.category === 'lifestyle';
  const showLifestyleTraitsButton = node.nodeType === 'task' && !isCategoryRoot && !isRecurrenceTarget && !node.isEphemeral && isLifestyleTask && (node.title || '').trim().length > 0;
  const lifestyleTraits = useMemo(
    () => normalizeLifestyleTraitAllocations(node.lifestyleTraits),
    [node.lifestyleTraits],
  );
  const primaryLifestyleTrait = lifestyleTraits[0];
  const lifestyleSummary = lifestyleTraits
    .map((allocation) => `${getLifestyleTraitLabel(allocation.trait)} ${allocation.weight}%`)
    .join(' / ');
  const rolloverLabel = getRolloverLabel(node);

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
      if (focused === repeatButtonRef.current) {
        e.preventDefault();
        onRepeatClick(nodeIndex);
        return;
      }
      if (focused === lifestyleTraitsButtonRef.current) {
        e.preventDefault();
        setIsLifestyleEditorOpen(true);
        return;
      }
      if (focused === menuButtonRef.current) {
        e.preventDefault();
        toggleMenu();
        return;
      }
    }
  }, [node, nodeIndex, onToggleExpansion, onToggleCompletion, onMakeRoot, onCalendarClick, onRepeatClick, toggleMenu]);

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

  const handleRepeatClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRepeatClick(nodeIndex);
  }, [nodeIndex, onRepeatClick]);

  const handleLifestyleTraitsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLifestyleEditorOpen(true);
  }, []);

  const handleLifestyleTraitsSave = useCallback((allocations: LifestyleTraitAllocation[]) => {
    onUpdateLifestyleTraits(node, allocations);
    setIsLifestyleEditorOpen(false);
    lifestyleTraitsButtonRef.current?.focus();
  }, [node, onUpdateLifestyleTraits]);

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
          className={`group flex items-start gap-0.5 border-b border-gray-200 py-2 transition-colors last:border-b-0 focus-within:bg-blue-50 hover:bg-gray-50 dark:border-gray-700 dark:focus-within:bg-blue-900/20 dark:hover:bg-gray-800 md:gap-2 ${
            isCategoryRoot ? 'bg-slate-50/80 dark:bg-slate-900/60' : ''
          }`}
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
          {isCategoryRoot || (isRecurrenceTemplate && !isRecurrenceTarget) ? (
            <div
              className="flex size-4 items-center justify-center rounded border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              title={isRecurrenceTemplate ? 'Recurring template' : undefined}
            >
              {isRecurrenceTemplate && <Repeat2 className="size-3" />}
            </div>
          ) : (
            <button
              ref={completionCheckboxRef}
              onClick={handleCompletionClick}
              data-focusable
              type="button"
              className={`size-4 rounded border flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none ${node.isCompleted
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
                }`}
              title={isRecurrenceTarget ? 'Add target completion' : 'Toggle completion'}
              aria-pressed={node.isCompleted}
            >
              {node.isCompleted && <Check className="size-2.5 text-white" />}
            </button>
          )}
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
          {isCategoryRoot ? (
            <div
              data-entrypoint-focus
              data-focusable
              tabIndex={0}
              aria-readonly="true"
              className="w-full cursor-default rounded px-1 py-1 text-sm font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 dark:text-slate-100"
            >
              <span className="pointer-events-none">{node.title || 'Category'}</span>
            </div>
          ) : (
            <>
              <textarea
                ref={titleInputRef}
                aria-label="Task title"
                value={node.title || ''}
                onChange={isRecurrenceTarget ? undefined : handleInputChange}
                readOnly={isRecurrenceTarget}
                data-entrypoint-focus
                data-focusable
                className={`w-full bg-transparent border-none outline-none text-sm py-1 pr-16 pl-1 focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 focus:rounded resize-none overflow-hidden ${node.isCompleted
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
              {showRepeatButton && (
                <button
                  type="button"
                  ref={repeatButtonRef}
                  onClick={handleRepeatClick}
                  data-focusable
                  className={`absolute right-8 top-1 rounded p-1 transition-all focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 select-none ${
                    isRecurrenceTemplate
                      ? 'text-cyan-600 opacity-100 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-900/30'
                      : 'text-gray-600 opacity-0 hover:bg-gray-200 group-focus-within:opacity-100 focus-visible:opacity-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                  title="Set repeat"
                >
                  <Repeat2 className="size-4" />
                </button>
              )}
              {showCalendarButton && (
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
              )}
              {rolloverLabel && (
                <div className="ml-1 mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {rolloverLabel}
                </div>
              )}
              {targetProgress && (
                <div className="ml-1 mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <span>
                    {targetProgress.completedCount}/{targetProgress.targetCount} {getTargetProgressPeriodLabel(targetProgress)}
                  </span>
                  {targetProgress.completedCount >= targetProgress.targetCount ? (
                    <span className="text-green-600 dark:text-green-400">target met</span>
                  ) : (
                    <span>
                      {targetProgress.targetCount - targetProgress.completedCount} left
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {showLifestyleTraitsButton && (
          <div className="flex-shrink-0 flex items-center h-6 mt-1">
            <button
              type="button"
              ref={lifestyleTraitsButtonRef}
              onClick={handleLifestyleTraitsClick}
              data-focusable
              className={`inline-flex h-7 max-w-[10rem] items-center gap-1.5 truncate rounded-full border px-2.5 text-xs font-medium outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                primaryLifestyleTrait
                  ? LIFESTYLE_TRAIT_CHIP_CLASSES[primaryLifestyleTrait.trait]
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
              title={lifestyleSummary || 'Set lifestyle traits'}
            >
              <Tags className="size-3.5 shrink-0" />
              <span className="truncate">
                {primaryLifestyleTrait
                  ? `${getLifestyleTraitLabel(primaryLifestyleTrait.trait)} ${primaryLifestyleTrait.weight}%`
                  : 'Traits'}
              </span>
              {lifestyleTraits.length > 1 && (
                <span className="shrink-0 text-[11px] opacity-70">+{lifestyleTraits.length - 1}</span>
              )}
            </button>
          </div>
        )}

        <div className="flex-shrink-0 flex items-center h-6 mt-1 relative">
          {showMenuButton ? (
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
          ) : (
            <div className="size-6" />
          )}
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

      <LifestyleTraitsEditor
        isOpen={isLifestyleEditorOpen}
        title={node.title || ''}
        allocations={lifestyleTraits}
        onClose={() => setIsLifestyleEditorOpen(false)}
        onSave={handleLifestyleTraitsSave}
      />
    </>
  );
};

export default TreeNodeComponent;
