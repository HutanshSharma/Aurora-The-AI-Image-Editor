import { useState, useRef } from "react";

class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

export default function useHistory(initialState) {
  const [state, setState] = useState(initialState);

  const historyTree = useRef([]);
  const currentNodeId = useRef(null);
  const nextId = useRef(0);
  
  const isRestoring = useRef(false);
  const pendingCommand = useRef(null);
  const debounceTimeout = useRef(null);
  const originalStateRef = useRef(null); 
  const finalStateRef = useRef(null); 
  const debounceCounterRef = useRef(0);

  const execute = (cmd, isSliderCommand = false, forceStartValue = null, forceFinalValue = null) => {
    if (isRestoring.current) return;
    
    setState(prev => {
      const newState = cmd.do(prev);

      if (isSliderCommand) {
      } else {
        let stateChanged = true;
        
        if (forceStartValue !== null && forceFinalValue !== null) {
          stateChanged = Math.abs(forceFinalValue - forceStartValue) > 1;
        } else {
          stateChanged = Object.keys(newState).some(key => {
            if (typeof newState[key] === 'number' && typeof prev[key] === 'number') {
              return Math.abs(newState[key] - prev[key]) > 0.5;
            }
            return newState[key] !== prev[key];
          });
        }
        
        if (!stateChanged) {
          console.log('State change too small, not creating history node');
          return newState; 
        }
        
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
          pendingCommand.current = null;
          originalStateRef.current = null;
          finalStateRef.current = null;
          debounceCounterRef.current = 0;
        }        
        const newNode = {
          id: nextId.current++,
          command: cmd,
          parentId: currentNodeId.current,
          children: [],
          state: newState,
          timestamp: Date.now()
        };
        
        if (currentNodeId.current !== null) {
          const parentNode = historyTree.current.find(n => n.id === currentNodeId.current);
          if (parentNode) {
            parentNode.children.push(newNode.id);
          }
        }
        
        historyTree.current.push(newNode);
        currentNodeId.current = newNode.id;
      }

      return newState;
    });
  };

  const undo = () => {
    if (currentNodeId.current === null) return;
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
      originalStateRef.current = null;
      finalStateRef.current = null;
    }
    
    isRestoring.current = true;

    const currentNode = historyTree.current.find(n => n.id === currentNodeId.current);
    if (currentNode && currentNode.parentId !== null) {
      const parentNode = historyTree.current.find(n => n.id === currentNode.parentId);
      setState(parentNode ? parentNode.state : initialState);
      currentNodeId.current = currentNode.parentId;
    } else if (currentNode && currentNode.parentId === null) {
      setState(initialState);
      currentNodeId.current = null;
    }

    isRestoring.current = false;
  };

  const redo = () => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
      originalStateRef.current = null;
      finalStateRef.current = null;
      debounceCounterRef.current = 0;
    }    
    const currentNode = currentNodeId.current === null 
      ? null 
      : historyTree.current.find(n => n.id === currentNodeId.current);
    
    const childrenIds = currentNode?.children || 
      historyTree.current.filter(n => n.parentId === null).map(n => n.id);
    
    if (childrenIds.length === 0) return;
    
    isRestoring.current = true;
    const childNode = historyTree.current.find(n => n.id === childrenIds[0]);
    if (childNode) {
      setState(childNode.state);
      currentNodeId.current = childNode.id;
    }

    isRestoring.current = false;
  };
  const jumpToNode = (nodeId) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
      originalStateRef.current = null;
      finalStateRef.current = null;
      debounceCounterRef.current = 0;
    }

    isRestoring.current = true;

    if (nodeId === null) {
      setState(initialState);
      currentNodeId.current = null;
    } else {
      const targetNode = historyTree.current.find(n => n.id === nodeId);
      if (targetNode) {
        setState(targetNode.state);
        currentNodeId.current = nodeId;
      }
    }

    isRestoring.current = false;
  };

  const addBranch = (newState, label = 'AI Optimized') => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
      originalStateRef.current = null;
      finalStateRef.current = null;
      debounceCounterRef.current = 0;
    }
    const currentParent = currentNodeId.current !== null 
      ? historyTree.current.find(n => n.id === currentNodeId.current)
      : null;
    
    if (currentParent) {
      const existingChild = currentParent.children.find(childId => {
        const childNode = historyTree.current.find(n => n.id === childId);
        if (!childNode) return false;
        
        const keys = new Set([...Object.keys(childNode.state), ...Object.keys(newState)]);
        for (const key of keys) {
          const oldVal = childNode.state[key];
          const newVal = newState[key];
          
          if (typeof oldVal === 'number' && typeof newVal === 'number') {
            if (Math.abs(oldVal - newVal) > 1) return false; 
          } else if (oldVal !== newVal) {
            return false;
          }
        }
        return true; 
      });
      
      if (existingChild) {
        console.log('Similar state detected, skipping branch creation');
        return existingChild;
      }
    }

    const newNode = {
      id: nextId.current++,
      command: {
        do: () => newState,
        undo: (prev) => prev
      },
      parentId: currentNodeId.current,
      children: [],
      state: newState,
      timestamp: Date.now(),
      label: label
    };

    if (currentNodeId.current !== null) {
      const parentNode = historyTree.current.find(n => n.id === currentNodeId.current);
      if (parentNode) {
        parentNode.children.push(newNode.id);
      }
    }

    historyTree.current.push(newNode);
    currentNodeId.current = newNode.id;
    setState(newState);

    return newNode.id;
  };

  const canUndo = currentNodeId.current !== null;
  const canRedo = () => {
    const currentNode = currentNodeId.current === null 
      ? null 
      : historyTree.current.find(n => n.id === currentNodeId.current);
    const childrenIds = currentNode?.children || 
      historyTree.current.filter(n => n.parentId === null).map(n => n.id);
    return childrenIds.length > 0;
  };

  return { 
    state, 
    execute, 
    undo, 
    redo, 
    canUndo, 
    canRedo: canRedo(),
    historyTree: historyTree.current,
    currentNodeId: currentNodeId.current,
    jumpToNode,
    addBranch,
    initialState
  };
}