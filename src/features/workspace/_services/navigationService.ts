import { shouldElementConsumeKey, isConsumingElement } from "./keyboard-helpers";
import {
  TraversalTreeService,
  type Direction,
  type SemanticDirection,
  type SpatialDirection,
} from "./tree-operations";

type FocusScope = {
  root: HTMLElement;
  lastFocused: HTMLElement | null;
};

export type PushScopeOptions = {
  getInitialFocus?: (root: HTMLElement) => HTMLElement | null;
};

export type FocusPath = {
  regionId: string;
  path: number[];
};

type FocusSelector = {
  regionId?: string;
  selector: string;
};

const scopeStack: FocusScope[] = [];
let currentScope: FocusScope | null = null;
let focusListener: ((e: FocusEvent) => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let mutationObserver: MutationObserver | null = null;
let pendingFocusPath: FocusPath | null = null;
let pendingFocusSelector: FocusSelector | null = null;

export const NavigationService = {
  init(rootElement: HTMLElement) {
    this.cleanup();

    this._setupObserver(rootElement);

    focusListener = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (currentScope && currentScope.root.contains(target)) {
        currentScope.lastFocused = target;
      }
    };

    document.addEventListener("focusin", focusListener);

    keydownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    document.addEventListener("keydown", keydownHandler);

    currentScope = { root: rootElement, lastFocused: null };
  },

  pushScope(root: HTMLElement, options?: PushScopeOptions) {
    const currentFocused = document.activeElement as HTMLElement;

    if (currentScope) {
      currentScope.lastFocused = currentFocused;
      scopeStack.push(currentScope);
    }

    this._cleanupObserver();
    this._setupObserver(root);

    currentScope = {
      root,
      lastFocused: null,
    };

    const initialFocus = options?.getInitialFocus?.(root);
    if (initialFocus) {
      initialFocus.focus();
    }
  },

  popScope() {
    if (!currentScope) return;

    this._cleanupObserver();

    if (scopeStack.length > 0) {
      const restoredScope = scopeStack.pop()!;
      const elementToFocus = restoredScope.lastFocused;

      currentScope = restoredScope;
      this._setupObserver(currentScope.root);

      if (elementToFocus && document.contains(elementToFocus)) {
        elementToFocus.focus();
      }
    } else {
      currentScope = null;
    }
  },

  cleanup() {
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler);
      keydownHandler = null;
    }

    if (focusListener) {
      document.removeEventListener("focusin", focusListener);
      focusListener = null;
    }

    this._cleanupObserver();

    scopeStack.length = 0;
    currentScope = null;
  },

  getCurrentRoot(): HTMLElement | null {
    return currentScope?.root || null;
  },

  _setupObserver(root: HTMLElement) {
    mutationObserver = new MutationObserver(() => {
      if (pendingFocusPath) {
        const pathToResolve = pendingFocusPath;
        pendingFocusPath = null;

        const element = this._findByPath(pathToResolve);
        if (element) {
          element.focus();
        }
      }

      if (pendingFocusSelector) {
        const selectorToResolve = pendingFocusSelector;
        pendingFocusSelector = null;

        const element = this._findBySelector(selectorToResolve);
        if (element) {
          element.focus();
        }
      }
    });

    mutationObserver.observe(root, { childList: true, subtree: true });
  },

  _cleanupObserver() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    pendingFocusPath = null;
    pendingFocusSelector = null;
  },

  getCurrentRegion(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;
    return element.closest("[data-region]") as HTMLElement | null;
  },

  handleKeyDown(e: KeyboardEvent): void {
    if (e.defaultPrevented) {
      return;
    }
    const target = (document.activeElement || e.target) as HTMLElement;
    if (!target) return;
    const key = e.key;

    if (key === "Tab") {
      const direction: SemanticDirection = e.shiftKey ? "backward" : "forward";

      if (isConsumingElement(target)) {
        if (this.navigateWithDirection(target, direction)) {
          e.preventDefault();
          return;
        }
      }

      const handled = this.navigateBetweenRegions(!e.shiftKey);
      if (handled) {
        e.preventDefault();
      }
      return;
    }

    let direction: SpatialDirection | null = null;
    if (key === "ArrowUp") direction = "up";
    else if (key === "ArrowDown") direction = "down";
    else if (key === "ArrowLeft") direction = "left";
    else if (key === "ArrowRight") direction = "right";

    if (direction) {
      if (isConsumingElement(target) && shouldElementConsumeKey(target, direction)) {
        return;
      }
      const handled = this.navigateWithDirection(target, direction);
      if (handled) e.preventDefault();
    }
  },

  navigateWithDirection(element: HTMLElement, direction: Direction): boolean {
    const root = this.getCurrentRoot();
    if (!root) return false;

    const tree = TraversalTreeService.buildScopeTree(root);
    if (!tree) return false;

    console.log("=== FOCUS TREE ===");
    TraversalTreeService.printTree(tree);
    console.log("Current element:", element.tagName, element.id);
    console.log("Direction:", direction);
    console.log("==================");

    const currentNode = TraversalTreeService.findFocusableNode({ tree, element });
    console.log("Current node:", currentNode);
    if (!currentNode) return false;

    const next = TraversalTreeService.findNext({ currentNode, direction });

    if (next) {
      next.focus();
      return true;
    }

    return false;
  },

  navigateBetweenRegions(forward: boolean): boolean {
    const root = this.getCurrentRoot();
    if (!root) return false;

    const tree = TraversalTreeService.buildScopeTree(root);
    if (!tree || tree.regions.length === 0) return false;

    const currentElement = document.activeElement as HTMLElement;
    const currentRegion = this.getCurrentRegion(currentElement);

    if (!currentRegion || !document.contains(currentRegion)) {
      const firstRegion = tree.regions[0];
      if (!firstRegion || firstRegion.children.length === 0) return false;

      const firstFocusable = TraversalTreeService.getLayoutFocusable({
        layout: firstRegion.children[0],
        direction: "first",
      });
      if (firstFocusable) {
        firstFocusable.focus();
        return true;
      }
      return false;
    }

    const currentIndex = tree.regions.findIndex((region) => region.element === currentRegion);
    if (currentIndex === -1) {
      const firstRegion = tree.regions[0];
      if (!firstRegion || firstRegion.children.length === 0) return false;

      const firstFocusable = TraversalTreeService.getLayoutFocusable({
        layout: firstRegion.children[0],
        direction: "first",
      });
      if (firstFocusable) {
        firstFocusable.focus();
        return true;
      }
      return false;
    }

    const nextIndex = forward
      ? (currentIndex + 1) % tree.regions.length
      : (currentIndex - 1 + tree.regions.length) % tree.regions.length;

    const nextRegion = tree.regions[nextIndex];
    if (!nextRegion || nextRegion.children.length === 0) return false;

    const firstFocusable = TraversalTreeService.getLayoutFocusable({
      layout: nextRegion.children[0],
      direction: "first",
    });
    if (firstFocusable) {
      firstFocusable.focus();
      return true;
    }

    return false;
  },

  focusByPath(path: FocusPath, waitForMutation: boolean = true): void {
    if (!this.getCurrentRoot()) return;

    if (waitForMutation) {
      pendingFocusPath = path;
    } else {
      const element = this._findByPath(path);
      if (element) {
        element.focus();
      }
    }
  },

  focusBySelector(target: FocusSelector, waitForMutation: boolean = true): void {
    if (!this.getCurrentRoot()) return;

    if (waitForMutation) {
      pendingFocusSelector = target;
    } else {
      const element = this._findBySelector(target);
      if (element) {
        element.focus();
      }
    }
  },

  _findByPath(focusPath: FocusPath): HTMLElement | null {
    const root = this.getCurrentRoot();
    console.log("Finding by path", focusPath, "in root", root);
    if (!root) return null;

    const tree = TraversalTreeService.buildScopeTree(root);
    if (!tree) return null;

    const region = tree.regions.find((entry) => entry.element.id === focusPath.regionId);
    if (!region) return null;

    if (!focusPath.path || focusPath.path.length === 0) {
      return null;
    }

    let current: any = region;

    for (let i = 0; i < focusPath.path.length; i++) {
      const index = focusPath.path[i];

      if (!current.children || index >= current.children.length || index < 0) {
        return null;
      }

      const child = current.children[index];

      if (i === focusPath.path.length - 1) {
        if (child.type === "focusable") {
          return child.element;
        }
        return null;
      }

      current = child;
    }

    return null;
  },

  _findBySelector(target: FocusSelector): HTMLElement | null {
    const root = this.getCurrentRoot();
    if (!root) return null;

    const searchRoot = target.regionId
      ? (root.querySelector(`#${target.regionId}`) as HTMLElement | null)
      : root;

    if (!searchRoot) return null;

    return searchRoot.querySelector(target.selector) as HTMLElement | null;
  },
};
