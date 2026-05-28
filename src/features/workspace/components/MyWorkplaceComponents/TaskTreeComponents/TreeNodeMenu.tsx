import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { NavigationService } from '../../../_services/navigationService';

interface TreeNodeMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  menuButtonRef: React.RefObject<HTMLButtonElement | null>; // Change this line
  onClose: () => void;
  onAddChild: () => void;
  onMakeRoot?: () => void;
  onDelete?: () => void;
  onCopy: () => void;
  showMakeRoot: boolean;
  showDelete: boolean;
}

const TreeNodeMenu: React.FC<TreeNodeMenuProps> = ({
  isOpen,
  position,
  menuButtonRef, // ADD THIS
  onClose,
  onAddChild,
  onMakeRoot,
  onDelete,
  onCopy,
  showMakeRoot,
  showDelete,
}) => {
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuScopePushedRef = useRef(false);
  const addChildMenuItemRef = useRef<HTMLButtonElement>(null);
  const copyMenuItemRef = useRef<HTMLButtonElement>(null);
  const makeRootMenuItemRef = useRef<HTMLButtonElement>(null);
  const deleteMenuItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && menuContainerRef.current) {
      NavigationService.pushScope(menuContainerRef.current, {
        getInitialFocus: (root) => root.querySelector('[data-focusable]') as HTMLElement
      });
      menuScopePushedRef.current = true;
    }

    return () => {
      if (menuScopePushedRef.current) {
        NavigationService.popScope();
        menuScopePushedRef.current = false;
      }
    };
  }, [isOpen]);

  // ADD THIS - click-outside handler
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node) &&
        !menuButtonRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, menuButtonRef]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      onClose();
      return;
    }
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuContainerRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
      data-scope
    >
      <div
        data-region
        id="menu-region"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
        role="menu"
        onKeyDown={handleMenuKeyDown}
      >
        <div data-layout="vertical">
          <button
            type="button"
            ref={addChildMenuItemRef}
            onClick={onAddChild}
            data-focusable
            data-order="0"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            role="menuitem"
          >
            Add Child
          </button>
          <button
            type="button"
            ref={copyMenuItemRef}
            onClick={onCopy}
            data-focusable
            data-order="1"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            role="menuitem"
          >
            Copy
          </button>
          {showMakeRoot && (
            <button
              type="button"
              ref={makeRootMenuItemRef}
              onClick={onMakeRoot!}
              data-focusable
              data-order="2"
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
              role="menuitem"
            >
              Make Root
            </button>
          )}
          {showDelete && (
            <button
              type="button"
              ref={deleteMenuItemRef}
              onClick={onDelete!}
              data-focusable
              data-order={showMakeRoot ? "3" : "2"}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
              role="menuitem"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TreeNodeMenu;
