# Edit History System Documentation

## Overview

This image editor implements a sophisticated **non-linear tree-based history system** that supports branching, allowing users to explore multiple edit paths from any point in time. Unlike traditional linear undo/redo, this system maintains all edit branches, enabling users to compare different editing approaches and make informed decisions.

---

## Architecture

### Core Components

#### 1. **useHistory Hook** (`src/hooks/useHistory.jsx`)
The central state management system that implements the Command Pattern with tree-based branching.

**Key Features:**
- Tree-based history structure (not linear)
- Command Pattern for all state changes
- Debouncing for slider operations to prevent history pollution
- Non-destructive branching (all paths preserved)
- Time-travel capabilities (jump to any historical state)

**State Structure:**
```javascript
{
  state: Object,              // Current editor state
  historyTree: Array,         // Array of history nodes
  currentNodeId: number|null, // ID of current position in history
  nextId: number              // Auto-incrementing ID generator
}
```

**History Node Structure:**
```javascript
{
  id: number,                 // Unique identifier
  command: Command,           // Command object with do/undo functions
  parentId: number|null,      // Parent node ID (null for root)
  children: Array<number>,    // Child node IDs (creates branches)
  state: Object,              // Complete editor state at this point
  timestamp: number,          // Creation timestamp
  label: string               // Human-readable description (optional)
}
```

#### 2. **historyParser Utility** (`src/utils/historyParser.js`)
Transforms raw history tree into UI-friendly format with labels and metadata.

**Functions:**
- `parseHistory()`: Converts history tree to enriched node array
- `generateLabel()`: Creates human-readable descriptions from state changes
- `getPathToNode()`: Computes path from root to any node

**Example Labels:**
- "Brightness: 120%, Contrast: 110%..."
- "Blur: 3, Rotation: 45°"
- "LUT: Arabica 12, Saturation: 80%"

#### 3. **HistoryViewer Component** (`src/components/ImageEditor/HistoryViewer.jsx`)
Visual interface for browsing, comparing, and selecting history states.

**Features:**
- Grid-based thumbnail view
- Visual branch exploration
- Real-time thumbnail generation with all filters applied
- AI-powered predictive branching
- One-click branch switching

#### 4. **Command Pattern** (`src/components/ImageEditor/Editor.jsx`)
Encapsulates state mutations as reversible commands.

```javascript
class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;    // Forward transformation
    this.undo = undoFn; // Reverse transformation
  }
}
```

---

## How It Works

### 1. State Changes & Command Execution

When any edit is made:

```javascript
// Example: Brightness adjustment
execute(new Command(
  (state) => ({ ...state, brightness: 120 }), // do
  (state) => ({ ...state, brightness: 100 })  // undo
));
```

**Process:**
1. `execute()` is called with a Command object
2. Command's `do()` function transforms current state
3. State change validation (minimum threshold check)
4. New history node created with complete state snapshot
5. Node added to tree structure
6. Current position updated to new node

### 2. Tree Structure & Branching

The history tree starts with a root node (initial state) and branches from there:

```
Initial State (null)
    ├─→ Edit 1 (brightness +20)
    │     ├─→ Edit 2 (contrast +10)
    │     │     └─→ Edit 3 (saturation -20)
    │     └─→ Branch A (blur +5)          ← Alternative path
    │           └─→ Branch A.1 (rotation 90)
    └─→ Branch B (LUT: Arabica)           ← Another alternative
```

**Key Characteristics:**
- Any node can have multiple children (branches)
- Each branch preserves complete state
- No history is ever lost
- Users can switch between branches freely

### 3. Undo/Redo Operations

**Undo:**
- Moves current pointer to parent node
- Restores parent's complete state
- Does NOT delete any nodes

**Redo:**
- Moves to first child of current node
- If multiple children exist, chooses first branch
- Restores child's complete state

**Jump to Node:**
- Direct navigation to any historical state
- Bypasses sequential traversal
- Used by HistoryViewer for instant state changes

### 4. Branch Creation

Branches are created in two ways:

**A. Implicit Branching:**
```javascript
// Current position: Edit 2
// User makes a new edit from Edit 1
// Result: New branch from Edit 1 (sibling to Edit 2)
```

**B. Explicit Branching (AI Optimization):**
```javascript
addBranch(optimizedState, "AI Optimized (NeurOP)");
// Creates new branch at current position
// Labeled distinctively for easy identification
```

### 5. Debouncing & State Coalescing

To prevent history pollution from rapid slider adjustments:

```javascript
// Slider movements are debounced (300ms)
// Only final value creates history node
// Intermediate values are ignored

// Example:
// User drags brightness slider: 100 → 105 → 110 → 115 → 120
// History records: 100 → 120 (single node)
```

**Implementation:**
- `isSliderCommand` flag identifies slider operations
- Debounce timer tracks last change
- Original and final states stored for accurate history node
- Minimum threshold prevents micro-changes from creating nodes

### 6. Thumbnail Generation

Each history node has a visual preview:

```javascript
// Thumbnail generation process:
1. Create canvas from original image
2. Apply LUT if present (using cached LUT data)
3. Apply all CSS filters (brightness, contrast, etc.)
4. Apply transformations (rotation, flip)
5. Scale to thumbnail size (max 300px)
6. Cache result for performance
```

**Optimization:**
- LUT data is cached to avoid repeated parsing
- Thumbnails generated in batch when viewer opens
- Loading state displayed during generation
- JPEG compression (85% quality) for efficiency

### 7. AI-Powered Predictive Branching

Advanced feature using neural networks to suggest optimized edits:

```javascript
// User clicks "AI Optimize" at branch point
1. Collect all branch endpoints from current position
2. Build complete history path for each branch
3. Feed all paths to NeurOP neural model
4. Model analyzes patterns and generates optimal parameters
5. Create new branch with AI-suggested state
6. Label: "AI Optimized (NeurOP)" or "Smart Optimized (model name)"
```

**Supported Models:**
- NeurOP (Neural Optimization)
- HDRNet Lite (for color grading)
- Heuristic optimization (fallback)

---

## State Management Flow

### Complete Edit Cycle

```
User Action
    ↓
Command Created
    ↓
execute(command) called
    ↓
State Change Validation
    ├─→ Change too small → Ignore
    └─→ Significant change → Continue
         ↓
    Create History Node
         ↓
    Add to Tree Structure
         ↓
    Update Current Position
         ↓
    Trigger Re-render
         ↓
    UI Updates (Canvas, Sliders, etc.)
         ↓
    Thumbnail Generation (if viewer open)
         ↓
    Mark as Unsaved Change
```

### Save Operation

```
saveImage() called
    ↓
Create canvas with current image
    ↓
Convert to blob (PNG format)
    ↓
Upload to backend via FormData
    ↓
Clear unsaved changes flag
    ↓
Update user's image gallery
```

**Note:** Save operation does NOT affect history tree - it only persists the final result.

---

## Component Integration

### Editor Component (`src/components/ImageEditor/Editor.jsx`)

**Initialization:**
```javascript
const initialEditorState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  opacity: 100,
  sharpen: 0,
  hue: 0,
  selectedLUT: null,
};

const {
  state: editorState,
  execute,
  undo: handleUndo,
  redo: handleRedo,
  canUndo,
  canRedo,
  historyTree,
  currentNodeId,
  jumpToNode,
  addBranch,
  initialState: historyInitialState
} = useHistory(initialEditorState);
```

**Keyboard Shortcuts:**
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Y` / `Cmd+Shift+Z`: Redo

### HistoryViewer UI

**Display Modes:**

1. **Linear Path View** (default):
   - Shows current branch path
   - Displays: Initial State → Edit 1 → Edit 2 → ... → Current
   - Highlights current position (blue border)
   - Shows completed edits (green checkmark)

2. **Branch Exploration View**:
   - Activated when current node has multiple children
   - Shows all branches side-by-side
   - 4-node preview per branch
   - Color-coded for distinction
   - Select button to switch branches

**Visual Indicators:**
- **Blue border + "Now" badge**: Current position
- **Green checkmark**: Past edit in current path
- **Purple badge + number**: Branch point with count
- **Branch columns**: Alternative editing paths

---

## Advanced Features

### 1. Branch Deduplication

Prevents creating duplicate branches:

```javascript
// Before creating new branch:
// 1. Check if sibling node exists with identical state
// 2. Compare all state properties with tolerance
// 3. If match found, reuse existing node
// 4. Otherwise, create new branch
```

**Tolerance:**
- Numbers: Must differ by > 1
- Other types: Must be exactly equal

### 2. State Restoration Prevention

```javascript
// isRestoring flag prevents infinite loops:
// - Set to true before state restoration
// - Blocks execute() from creating new nodes
// - Cleared after restoration complete
```

### 3. Memory Management

**Strategies:**
- History tree stored in refs (not state) to avoid re-renders
- Only current state stored in React state
- Thumbnails cached per viewer session
- LUT data cached globally
- Old thumbnails garbage collected when viewer closes

### 4. Merge Operations

When segments are edited and merged:

```javascript
handleApplyEditedSegments(editedObjects)
    ↓
mergeSegmentsIntoImage(editedObjects)
    ↓
Create composite canvas
    ↓
Update uploadedImage
    ↓
Trigger re-segmentation
    ↓
Mark unsaved changes
```

**Note:** Merge operations affect the base image, not the history tree. History tracks parameter changes, not pixel-level edits.

---

## Performance Considerations

### Optimization Techniques

1. **Debouncing**: Prevents rapid slider movements from creating hundreds of nodes
2. **State Validation**: Minimum threshold prevents micro-changes from creating nodes
3. **Thumbnail Caching**: Generated once and reused
4. **LUT Caching**: Parsed once per LUT file
5. **Ref-based Storage**: History tree in refs avoids React re-render overhead
6. **Lazy Thumbnail Generation**: Only generated when viewer opens
7. **JPEG Compression**: Thumbnails compressed to 85% quality

### Scalability

**Current Limits:**
- No hard limit on history nodes
- Practical limit: ~500-1000 nodes before UI slowdown
- Each node: ~1-2KB (state object)
- Each thumbnail: ~10-20KB (compressed)

**Recommended Best Practices:**
- Debounce all continuous operations
- Validate state changes before creating nodes
- Clear history on image load (optional)
- Periodic history pruning (future enhancement)

---

## API Reference

### useHistory Hook

```javascript
const {
  state,           // Current editor state
  execute,         // (Command, isSlider, forceStart, forceEnd) => void
  undo,            // () => void
  redo,            // () => void
  canUndo,         // boolean
  canRedo,         // boolean
  historyTree,     // Array<HistoryNode>
  currentNodeId,   // number | null
  jumpToNode,      // (nodeId) => void
  addBranch,       // (newState, label) => number
  initialState     // Object
} = useHistory(initialState);
```

### Command Class

```javascript
const cmd = new Command(
  (prevState) => newState,  // do function
  (prevState) => prevState  // undo function
);
```

### History Parser

```javascript
import { parseHistory, getPathToNode } from '@/utils/historyParser';

// Parse tree into UI-friendly format
const snapshots = parseHistory(initialState, historyTree, currentNodeId);

// Get path from root to specific node
const path = getPathToNode(historyTree, nodeId);
```

---

## Example Usage

### Basic Edit Operation

```javascript
// Adjust brightness
execute(new Command(
  (s) => ({ ...s, brightness: 120 }),
  (s) => ({ ...s, brightness: editorState.brightness })
));
```

### Slider with Debouncing

```javascript
// Slider onChange handler
const handleBrightnessChange = (value) => {
  execute(
    new Command(
      (s) => ({ ...s, brightness: value }),
      (s) => ({ ...s, brightness: editorState.brightness })
    ),
    true,  // isSliderCommand
    editorState.brightness,  // forceStartValue
    value  // forceFinalValue
  );
};
```

### Create AI Branch

```javascript
// From AI optimization
const optimizedState = {
  ...editorState,
  brightness: 115,
  contrast: 105,
  saturation: 95
};

addBranch(optimizedState, "AI Optimized (NeurOP)");
```

### Jump to Historical State

```javascript
// From HistoryViewer click
const handleJumpToState = (nodeId) => {
  jumpToNode(nodeId);
};
```

---
## Conclusion

This tree-based history system provides users with unprecedented flexibility in exploring creative options. By maintaining all edit branches and enabling instant comparisons, users can make more informed decisions and never lose work. The Command Pattern ensures clean, reversible operations, while the tree structure naturally supports non-destructive workflows.

The system balances power with performance through intelligent debouncing, state validation, and caching strategies. Integration with AI models for predictive branching adds a layer of intelligent assistance, helping users discover optimal edits they might not have considered.

**Key Takeaways:**
- Non-linear tree structure preserves all editing paths
- Command Pattern ensures reversibility
- Debouncing prevents history pollution
- Visual branch exploration aids decision-making
- AI integration suggests optimal edits
- Performant through strategic caching and validation
