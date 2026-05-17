/**
 * @param {Object} initialState 
 * @param {Array} historyTree
 * @param {number} currentNodeId
 * @returns {Array}
 */
export function parseHistory(initialState, historyTree, currentNodeId) {
  if (!historyTree || historyTree.length === 0) {
    return [{
      id: null,
      state: initialState,
      label: 'Initial State',
      timestamp: Date.now(),
      isCurrent: currentNodeId === null,
      parentId: null,
      children: historyTree.filter(n => n.parentId === null).map(n => n.id),
      depth: 0,
      branchIndex: 0
    }];
  }
  const nodeMap = new Map();
  historyTree.forEach(node => nodeMap.set(node.id, node));
  const enrichedNodes = [];
  const rootChildren = historyTree.filter(n => n.parentId === null);
  enrichedNodes.push({
    id: null,
    state: initialState,
    label: 'Initial State',
    timestamp: Date.now(),
    isCurrent: currentNodeId === null,
    parentId: null,
    children: rootChildren.map(n => n.id),
    depth: 0,
    branchIndex: 0
  });

  const processNode = (node, depth, branchIndex) => {
    const label = generateLabel(node.state, node.id);
    
    enrichedNodes.push({
      id: node.id,
      state: node.state,
      label: label,
      timestamp: node.timestamp,
      isCurrent: node.id === currentNodeId,
      parentId: node.parentId,
      children: node.children,
      depth: depth,
      branchIndex: branchIndex
    });

    node.children.forEach((childId, index) => {
      const childNode = nodeMap.get(childId);
      if (childNode) {
        processNode(childNode, depth + 1, index);
      }
    });
  };

  rootChildren.forEach((node, index) => {
    processNode(node, 1, index);
  });

  return enrichedNodes;
}

/**
 * @param {Object} state 
 * @param {number} id
 * @returns {string}
 */
function generateLabel(state, id) {
  const changes = [];
  
  if (state.brightness !== 100) changes.push(`Brightness: ${state.brightness}%`);
  if (state.contrast !== 100) changes.push(`Contrast: ${state.contrast}%`);
  if (state.saturation !== 100) changes.push(`Saturation: ${state.saturation}%`);
  if (state.blur > 0) changes.push(`Blur: ${state.blur}`);
  if (state.sharpen > 0) changes.push(`Sharpen: ${state.sharpen}`);
  if (state.hue !== 0) changes.push(`Hue: ${state.hue}°`);
  if (state.opacity !== 100) changes.push(`Opacity: ${state.opacity}%`);
  if (state.rotation !== 0) changes.push(`Rotation: ${state.rotation}°`);
  if (state.flipH) changes.push('Flipped H');
  if (state.flipV) changes.push('Flipped V');
  if (state.selectedLUT) changes.push(`LUT: ${state.selectedLUT.name}`);

  if (changes.length === 0) {
    return `Edit ${id !== null ? id + 1 : 0}`;
  }

  return changes.slice(0, 2).join(', ') + (changes.length > 2 ? '...' : '');
}

/**
 * @param {Array} historyTree 
 * @param {number} nodeId
 * @returns {Array}
 */
export function getPathToNode(historyTree, nodeId) {
  if (nodeId === null) return [];
  
  const path = [];
  let currentId = nodeId;
  
  while (currentId !== null) {
    const node = historyTree.find(n => n.id === currentId);
    if (!node) break;
    path.unshift(currentId);
    currentId = node.parentId;
  }
  
  return path;
}
