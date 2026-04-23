# Keyboard Navigation System

## Overview

This application implements a **hierarchical, declarative keyboard navigation system** that enables users to navigate the entire UI using only arrow keys and Tab. The system is designed around a tree-based model with regions, layouts, and focusable elements.

### Key Features

✅ **Arrow Key Navigation**: Navigate UI elements spatially (up/down/left/right)
✅ **Tab Navigation**: Move between logical regions
✅ **Intelligent Input Handling**: Respects cursor position in text inputs
✅ **Scope Management**: Support for modal dialogs and nested navigation contexts
✅ **Dynamic DOM**: Handles elements that appear/disappear via mutation observers
✅ **Layout-Aware**: Vertical and horizontal layouts with automatic direction mapping

## Architecture

### Core Components

The navigation system consists of three main services:

1. **NavigationService** (`navigationService.ts`) - Main keyboard navigation controller
2. **TraversalTreeService** (`tree-operations.tsx`) - Tree building and traversal logic
3. **ScopeService** (`scope-service.ts`) - Focus scope stack management

### Data Model

The navigation system builds a tree structure from DOM attributes:

```
ScopeNode (data-scope)
├── RegionNode (data-region)
│   ├── LayoutNode (data-layout="vertical")
│   │   ├── FocusableNode (data-focusable or button/input)
│   │   ├── FocusableNode
│   │   └── LayoutNode (nested layout)
│   │       ├── FocusableNode
│   │       └── FocusableNode
│   └── LayoutNode (data-layout="horizontal")
│       ├── FocusableNode
│       └── FocusableNode
└── RegionNode
    └── LayoutNode
```

### Type Hierarchy

```typescript
// From tree-operations.tsx

export type ScopeNode = {
  type: 'scope';
  element: HTMLElement;
  regions: RegionNode[];
};

export type RegionNode = {
  type: 'region';
  element: HTMLElement;
  wrap: boolean;  // data-wrap attribute
  children: LayoutNode[];
  parent: ScopeNode;
};

export type LayoutNode = {
  type: 'layout';
  element: HTMLElement;
  layout: 'vertical' | 'horizontal';  // data-layout attribute
  wrap: boolean;  // data-wrap attribute
  children: FocusNode[];
  parent: LayoutNode | RegionNode | null;
  entrypointIndex: number | null;  // data-entrypoint-focus child index
};

export type FocusableNode = {
  type: 'focusable';
  element: HTMLElement;
  parent: LayoutNode | null;
};

export type Direction =
  | 'up' | 'down' | 'left' | 'right'  // SpatialDirection
  | 'forward' | 'backward';           // SemanticDirection (Tab)
```

## Usage Guide

### Setting Up Navigation

#### 1. Initialize the Navigation System

```tsx
import { NavigationService } from './_services/navigationService';

function MyApp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootRef.current) {
      NavigationService.init(rootRef.current);
    }

    return () => NavigationService.cleanup();
  }, []);

  return (
    <div ref={rootRef} data-scope>
      {/* Your app content */}
    </div>
  );
}
```

#### 2. Define Regions

Regions are top-level navigation areas (e.g., sidebar, main content, toolbar).

```tsx
<div data-scope>
  <div data-region data-region-order="1">
    {/* Sidebar content */}
  </div>

  <div data-region data-region-order="2">
    {/* Main content */}
  </div>

  <div data-region data-region-order="3">
    {/* Toolbar */}
  </div>
</div>
```

**Tab** moves forward through regions, **Shift+Tab** moves backward.

#### 3. Define Layouts

Layouts control how arrow keys navigate within a region.

```tsx
{/* Vertical layout - ArrowUp/Down navigate */}
<div data-layout="vertical" data-layout-order="1">
  <button data-focusable data-order="1">First</button>
  <button data-focusable data-order="2">Second</button>
  <button data-focusable data-order="3">Third</button>
</div>

{/* Horizontal layout - ArrowLeft/Right navigate */}
<div data-layout="horizontal" data-layout-order="1">
  <button data-focusable data-order="1">Left</button>
  <button data-focusable data-order="2">Center</button>
  <button data-focusable data-order="3">Right</button>
</div>
```

#### 4. Mark Focusable Elements

```tsx
{/* Explicitly mark as focusable */}
<div data-focusable data-order="1" tabIndex={0}>
  Custom focusable element
</div>

{/* Native elements are automatically focusable */}
<button data-order="1">Button</button>
<input data-order="2" />
<textarea data-order="3" />
<select data-order="4" />
```

### Data Attributes Reference

| Attribute | Required | Description | Example |
|-----------|----------|-------------|---------|
| `data-scope` | Root only | Marks the navigation root | `<div data-scope>` |
| `data-region` | Yes | Defines a navigation region | `<div data-region data-region-order="1">` |
| `data-region-order` | Recommended | Order for Tab navigation | `data-region-order="1"` |
| `data-layout` | Yes | Defines layout direction | `data-layout="vertical"` |
| `data-layout-order` | Recommended | Order within parent | `data-layout-order="1"` |
| `data-focusable` | Optional | Marks non-standard focusable | `data-focusable` |
| `data-order` | Recommended | Order within layout | `data-order="1"` |
| `data-wrap` | Optional | Enable wrapping at boundaries | `data-wrap` |
| `data-entrypoint-focus` | Optional | Initial focus in layout | Mark one child |
| `data-tab-consume` | Optional | Make input consume Tab | `data-tab-consume` |

### Ordering System

Orders can be hierarchical using dot notation:

```tsx
<div data-layout="vertical">
  <button data-order="1">First</button>
  <button data-order="1.5">Between 1 and 2</button>
  <button data-order="2">Second</button>
  <button data-order="10">Much later</button>
</div>
```

**Comparison**: `"1" < "1.5" < "2" < "10" < "999"` (default)

## Advanced Features

### Nested Layouts

Layouts can be nested for complex UI structures:

```tsx
<div data-layout="vertical">
  <button data-order="1">Top</button>

  {/* Nested horizontal layout */}
  <div data-layout="horizontal" data-order="2">
    <button data-order="1">Left</button>
    <button data-order="2">Center</button>
    <button data-order="3">Right</button>
  </div>

  <button data-order="3">Bottom</button>
</div>
```

**Navigation behavior**:
- ArrowDown from "Top" → "Left" (enters nested layout)
- ArrowRight in nested layout → "Center" → "Right"
- ArrowDown from "Right" → "Bottom" (exits nested layout)

### Scope Management (Modals)

For modal dialogs and temporary navigation contexts:

```tsx
import { NavigationService } from './_services/navigationService';

function MyModal({ onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modalRef.current) {
      // Push new scope - traps focus in modal
      NavigationService.pushScope(modalRef.current, {
        getInitialFocus: (root) => {
          // Return first focusable element or specific target
          return root.querySelector('[data-autofocus]') as HTMLElement;
        }
      });
    }

    return () => {
      // Pop scope - restore previous focus
      NavigationService.popScope();
    };
  }, []);

  return (
    <div ref={modalRef}>
      <div data-region data-region-order="1">
        <div data-layout="vertical">
          <button data-autofocus data-order="1">OK</button>
          <button data-order="2" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

### Input Consumption

The system intelligently handles inputs to avoid conflicts with cursor movement:

#### Text Inputs

```tsx
{/* Horizontal navigation with text input */}
<div data-layout="horizontal">
  <button data-order="1">Prev</button>
  <input data-order="2" type="text" />
  <button data-order="3">Next</button>
</div>
```

**Behavior**:
- When cursor is **not at boundary**: Arrow keys move cursor
- When cursor is **at start** and press Left: Navigate to "Prev" button
- When cursor is **at end** and press Right: Navigate to "Next" button

#### Textareas

```tsx
<div data-layout="vertical">
  <button data-order="1">Above</button>
  <textarea data-order="2" />
  <button data-order="3">Below</button>
</div>
```

**Behavior** (multi-line):
- On **first line** and press Up: Navigate to "Above" button
- On **last line** and press Down: Navigate to "Below" button
- Not on first/last line: Arrow keys navigate within textarea

#### Number Inputs

```tsx
<input type="number" data-order="1" />
```

**Behavior**:
- ArrowUp/Down increment/decrement value (consumed by input)
- ArrowLeft/Right navigate out when at boundaries

#### Tab Consumption

```tsx
{/* Make textarea consume Tab for indentation */}
<textarea data-tab-consume />
```

When focused, pressing Tab inserts a tab character instead of navigating.

### Focus Restoration After Mutation

When the DOM changes (e.g., item deleted), the system can restore focus:

```tsx
import { NavigationService, type FocusPath } from './_services/navigationService';

function deleteItem(itemId: string) {
  // Get focus path before deletion
  const focusPath: FocusPath = {
    regionId: 'my-region',
    path: [0, 2]  // layout index 0, focusable index 2
  };

  // Delete the item
  await deleteItemAPI(itemId);

  // Restore focus after DOM updates
  NavigationService.focusByPath(focusPath, true);
}
```

## Implementation Details

### Keyboard Event Flow

```
1. User presses key
2. NavigationService.handleKeyDown(e)
3. Check if currently focused element should consume the key
   ├─ If yes: Let browser handle it (return)
   └─ If no: Proceed to step 4
4. Build navigation tree from DOM
5. Find current focusable node in tree
6. Calculate next focusable based on direction
7. Focus next element
8. Prevent default if navigation occurred
```

### Key Consumption Logic

From `keyboard-helpers.ts`:

```typescript
export function shouldElementConsumeKey(
  element: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right'
): boolean {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type') || 'text';

  // Number inputs consume up/down
  if (tagName === 'input' && type === 'number' &&
      (direction === 'up' || direction === 'down')) return true;

  // Text inputs consume left/right
  if (tagName === 'input' && ['text', 'email', 'password', ...].includes(type)) {
    if (direction === 'left' || direction === 'right') return true;
  }

  // Textareas have complex multi-line logic (see source)
  if (tagName === 'textarea') {
    // ... check cursor position and line boundaries
  }

  // Selects consume up/down
  if (tagName === 'select' && (direction === 'up' || direction === 'down'))
    return true;

  // Date/time inputs consume all arrows
  if (tagName === 'input' && ['date', 'time', ...].includes(type)) return true;

  return false;
}
```

### Tree Building Algorithm

From `tree-operations.tsx`:

```typescript
export function buildTree({ element, parent }: {
  element: HTMLElement;
  parent: Node | null
}): Node | null {
  // 1. Check for data-scope (root)
  if (element.hasAttribute('data-scope')) {
    const node: ScopeNode = { type: 'scope', element, regions: [] };
    // Recursively build regions
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }
    sortByOrder(node.regions);  // Sort by data-region-order
    return node;
  }

  // 2. Check for data-region
  if (element.hasAttribute('data-region')) {
    const node: RegionNode = { type: 'region', element, children: [], parent };
    parent.regions.push(node);
    // Build layouts
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }
    sortByOrder(node.children);
    return node;
  }

  // 3. Check for data-layout
  if (element.hasAttribute('data-layout')) {
    const node: LayoutNode = {
      type: 'layout',
      element,
      layout: element.getAttribute('data-layout') as 'vertical' | 'horizontal',
      children: [],
      parent
    };
    // Build focusables
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }
    sortByOrder(node.children);
    node.entrypointIndex = findEntrypointIndex(node.children);
    return node;
  }

  // 4. Check if focusable
  if (isFocusable(element)) {
    const node: FocusableNode = { type: 'focusable', element, parent };
    if (parent?.type === 'layout') {
      parent.children.push(node);
    }
    return node;
  }

  // 5. Not a navigation element - recurse children
  for (const child of element.children) {
    if (child instanceof HTMLElement) buildTree({ element: child, parent });
  }
  return null;
}
```

## Testing

The navigation system has comprehensive tests in `_services/tests/`:

### Test Files

- `basicLayoutNavigation.test.ts` - Vertical and horizontal layouts
- `nestedLayoutNavigation.test.ts` - Nested layout hierarchies
- `compositeFocusableNavigation.test.ts` - Complex focusable patterns
- `consumingElementNavigation.test.ts` - Input consumption edge cases
- `nestedLayoutBoundaries.test.ts` - Boundary crossing behavior

### Writing Tests

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { NavigationService } from '../navigationService';

describe('My Navigation Test', () => {
  beforeEach(() => {
    NavigationService.cleanup();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    NavigationService.cleanup();
    document.body.innerHTML = '';
  });

  test('Navigate with arrow keys', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    root.innerHTML = `
      <div data-region="main" data-region-order="1">
        <div data-layout="vertical">
          <button data-order="1" id="btn1">First</button>
          <button data-order="2" id="btn2">Second</button>
        </div>
      </div>
    `;

    NavigationService.init(root);

    const btn1 = document.getElementById('btn1') as HTMLElement;
    const btn2 = document.getElementById('btn2') as HTMLElement;

    btn1.focus();

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);

    expect(document.activeElement).toBe(btn2);
  });
});
```

## Common Patterns

### Sidebar + Main Content

```tsx
<div data-scope>
  {/* Sidebar */}
  <div data-region data-region-order="1">
    <div data-layout="vertical">
      <button data-order="1">Dashboard</button>
      <button data-order="2">Projects</button>
      <button data-order="3">Tasks</button>
    </div>
  </div>

  {/* Main content */}
  <div data-region data-region-order="2">
    <div data-layout="vertical">
      <div data-layout="horizontal" data-order="1">
        <button data-order="1">New</button>
        <button data-order="2">Edit</button>
        <button data-order="3">Delete</button>
      </div>

      <div data-order="2">
        {/* Content list - each item focusable */}
      </div>
    </div>
  </div>
</div>
```

### Form with Mixed Inputs

```tsx
<div data-region data-region-order="1">
  <div data-layout="vertical">
    <input type="text" data-order="1" placeholder="Name" />
    <input type="email" data-order="2" placeholder="Email" />
    <textarea data-order="3" placeholder="Notes" />
    <select data-order="4">
      <option>Option 1</option>
    </select>

    <div data-layout="horizontal" data-order="5">
      <button data-order="1">Cancel</button>
      <button data-order="2">Save</button>
    </div>
  </div>
</div>
```

### Grid/List with Wrapping

```tsx
<div data-region data-region-order="1">
  <div data-layout="horizontal" data-wrap data-layout-order="1">
    <div data-focusable data-order="1" tabIndex={0}>Item 1</div>
    <div data-focusable data-order="2" tabIndex={0}>Item 2</div>
    <div data-focusable data-order="3" tabIndex={0}>Item 3</div>
    <div data-focusable data-order="4" tabIndex={0}>Item 4</div>
  </div>
</div>
```

With `data-wrap`, pressing Right on last item wraps to first item.

## Debugging

### Enable Debug Logging

The NavigationService logs tree structure and navigation attempts:

```typescript
// In navigationService.ts, navigateWithDirection():
console.log('=== FOCUS TREE ===');
TraversalTreeService.printTree(tree);
console.log('Current element:', element.tagName, element.id);
console.log('Direction:', direction);
console.log('==================');
```

### Inspect the Navigation Tree

```typescript
// In browser console:
const root = NavigationService.getCurrentRoot();
const tree = TraversalTreeService.buildScopeTree(root);
TraversalTreeService.printTree(tree);
```

### Common Issues

**Problem**: Arrow keys not navigating
**Solution**: Check that elements have `data-layout` and `data-focusable` attributes

**Problem**: Tab skips regions
**Solution**: Ensure regions have `data-region-order` attributes

**Problem**: Input consumes all arrow keys
**Solution**: Check `shouldElementConsumeKey()` logic for that input type

**Problem**: Focus lost after DOM mutation
**Solution**: Use `NavigationService.focusByPath()` to restore focus

## Best Practices

1. **Always set data-order**: Explicit ordering prevents unexpected navigation
2. **Use semantic regions**: Group related UI elements in regions
3. **Test with keyboard only**: Ensure all functionality is accessible
4. **Avoid deep nesting**: Keep layout hierarchy shallow when possible
5. **Mark entry points**: Use `data-entrypoint-focus` for initial focus in complex layouts
6. **Handle scope cleanup**: Always call `popScope()` when unmounting modals
7. **Validate tree structure**: Use debug logging to verify tree builds correctly

## API Reference

### NavigationService

#### `init(rootElement: HTMLElement): void`
Initialize navigation system for a root element.

#### `cleanup(): void`
Remove all event listeners and clear scope stack.

#### `pushScope(root: HTMLElement, options?: PushScopeOptions): void`
Push a new focus scope (e.g., for modals).

#### `popScope(): void`
Pop the current scope and restore previous focus.

#### `getCurrentRoot(): HTMLElement | null`
Get the current navigation root element.

#### `navigateWithDirection(element: HTMLElement, direction: Direction): boolean`
Navigate from element in the given direction. Returns true if navigation occurred.

#### `navigateBetweenRegions(forward: boolean): boolean`
Navigate between regions (Tab/Shift+Tab). Returns true if navigation occurred.

#### `focusByPath(path: FocusPath, waitForMutation: boolean): void`
Focus an element by its path in the tree. If `waitForMutation` is true, waits for DOM mutation before focusing.

### ScopeService

Legacy service, prefer `NavigationService` for new code.

### Helper Functions

#### `shouldElementConsumeKey(element: HTMLElement, direction: Direction): boolean`
Check if element should consume the arrow key for internal navigation.

#### `isConsumingElement(element: HTMLElement): boolean`
Check if element is an input that consumes keyboard events.

---

**Last Updated**: November 2024
**Related Files**:
- `navigationService.ts` - Main navigation service
- `tree-operations.tsx` - Tree building and traversal
- `scope-service.ts` - Scope management (legacy)
- `keyboard-helpers.ts` - Input consumption logic
- `tests/*Navigation.test.ts` - Test suite
