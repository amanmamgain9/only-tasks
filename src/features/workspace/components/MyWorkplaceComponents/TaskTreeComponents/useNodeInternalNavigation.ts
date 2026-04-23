// useNodeInternalNavigation.ts - Simplified internal navigation logic hook
import { useCallback, useMemo, useRef } from 'react';
import type { VisibleNode } from './types';

type FocusLocation = 
  | { nodeIndex: number; element?: string }
  | 'breadcrumb'
  | null;

interface UseNodeInternalNavigationProps {
  node: VisibleNode;
  nodeIndex: number;
  hasChildren: boolean;
  currentFocus: FocusLocation;
  setCurrentFocus: (focus: FocusLocation) => void;
}

export function useNodeInternalNavigation({
  node,
  nodeIndex,
  hasChildren,
  currentFocus,
  setCurrentFocus
}: UseNodeInternalNavigationProps) {
  
  // ========================================================================
  // ELEMENT REFS
  // ========================================================================
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const completionCheckboxRef = useRef<HTMLButtonElement>(null);
  const makeRootButtonRef = useRef<HTMLButtonElement>(null);
  const addChildButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  // ========================================================================
  // COMPUTED PROPERTIES
  // ========================================================================
  const showMakeRootButton = node.nodeType === 'task' && (node.title || '').trim().length > 0;
  const showDeleteButton = node.nodeType === 'task' && !(node).isEphemeral;

  // Element order for internal navigation
  const elementOrder = useMemo(() => {
    const order: string[] = [];
    if (hasChildren) order.push('expand');
    order.push('completion');
    if (showMakeRootButton) order.push('makeRoot');
    order.push('title');
    order.push('addChild');
    if (showDeleteButton) order.push('delete');
    return order;
  }, [hasChildren, showMakeRootButton, showDeleteButton]);

  // ========================================================================
  // FOCUS MANAGEMENT
  // ========================================================================
  
  // Handle focus entering node area - call parent once
  const handleFocusEntered = useCallback((element: string) => {
    // Only notify parent if focus is not already in this node
    if (!currentFocus || typeof currentFocus === 'string' || currentFocus.nodeIndex !== nodeIndex) {
      setCurrentFocus({ nodeIndex, element });
    }
  }, [currentFocus, nodeIndex, setCurrentFocus]);

  // Get current focused element within this node
  const getCurrentFocusedElement = useCallback((): string | null => {
    const activeElement = document.activeElement;
    if (titleInputRef.current === activeElement) return 'title';
    if (expandButtonRef.current === activeElement) return 'expand';
    if (completionCheckboxRef.current === activeElement) return 'completion';
    if (makeRootButtonRef.current === activeElement) return 'makeRoot';
    if (addChildButtonRef.current === activeElement) return 'addChild';
    if (deleteButtonRef.current === activeElement) return 'delete';
    return null;
  }, []);

  // Check if title input needs cursor navigation
  const titleNeedsCursorNavigation = useCallback((direction: 'left' | 'right'): boolean => {
    if (getCurrentFocusedElement() !== 'title' || !titleInputRef.current) return false;
    
    const input = titleInputRef.current;
    const atStart = input.selectionStart === 0;
    const atEnd = input.selectionStart === input.value.length;
    const hasSelection = input.selectionStart !== input.selectionEnd;

    // Let browser handle if not at boundary or has partial selection
    if (hasSelection && !(input.selectionStart === 0 && input.selectionEnd === input.value.length)) {
      return true;
    }
    
    return direction === 'left' ? !atStart : !atEnd;
  }, [getCurrentFocusedElement]);

  // Internal navigation within this node (pure DOM focus, no parent updates)
  const handleInternalNavigation = useCallback((direction: 'left' | 'right'): boolean => {
    // Check if title input needs cursor navigation
    if (titleNeedsCursorNavigation(direction)) {
      return false; // Let browser handle cursor movement
    }

    const currentElement = getCurrentFocusedElement();
    if (!currentElement) return false;

    const currentIndex = elementOrder.indexOf(currentElement);
    if (currentIndex === -1) return false;

    const nextIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= elementOrder.length) return false;

    const nextElement = elementOrder[nextIndex];
    switch (nextElement) {
      case 'title':
        titleInputRef.current?.focus();
        return true;
      case 'expand':
        expandButtonRef.current?.focus();
        return true;
      case 'completion':
        completionCheckboxRef.current?.focus();
        return true;
      case 'makeRoot':
        makeRootButtonRef.current?.focus();
        return true;
      case 'addChild':
        addChildButtonRef.current?.focus();
        return true;
      case 'delete':
        deleteButtonRef.current?.focus();
        return true;
    }
    return false;
  }, [titleNeedsCursorNavigation, getCurrentFocusedElement, elementOrder]);

  // Focus first element in node
  const focusFirst = useCallback(() => {
  // If something in this node already has focus, don't change it
  const currentElement = getCurrentFocusedElement();
  console.log('Current focused element in node:', currentElement);
  if (currentElement) {
    return; // Keep existing focus
  }
  
  // Always focus title when no element is focused
  titleInputRef.current?.focus();
}, [getCurrentFocusedElement]);
  
  // Focus event handlers - notify parent only when focus enters from outside
  const handleTitleFocus = useCallback(() => handleFocusEntered('title'), [handleFocusEntered]);
  const handleExpandFocus = useCallback(() => handleFocusEntered('expand'), [handleFocusEntered]);
  const handleCompletionFocus = useCallback(() => handleFocusEntered('completion'), [handleFocusEntered]);
  const handleMakeRootFocus = useCallback(() => handleFocusEntered('makeRoot'), [handleFocusEntered]);
  const handleAddChildFocus = useCallback(() => handleFocusEntered('addChild'), [handleFocusEntered]);
  const handleDeleteFocus = useCallback(() => handleFocusEntered('delete'), [handleFocusEntered]);

  return {
    // Element refs for JSX
    titleInputRef,
    expandButtonRef,
    completionCheckboxRef,
    makeRootButtonRef,
    addChildButtonRef,
    deleteButtonRef,
    
    // Computed properties
    showMakeRootButton,
    showDeleteButton,
    
    // Navigation functions
    getCurrentFocusedElement,
    handleInternalNavigation,
    focusFirst,
    
    // Focus event handlers
    handleTitleFocus,
    handleExpandFocus,
    handleCompletionFocus,
    handleMakeRootFocus,
    handleAddChildFocus,
    handleDeleteFocus,
  };
}