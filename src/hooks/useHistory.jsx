import { useState, useRef } from "react";
export default function useHistory(initialState) {
  const [state, setState] = useState(initialState);
  const history = useRef([]);
  const index = useRef(-1);
  const isRestoring = useRef(false);
  const pendingCommand = useRef(null);
  const debounceTimeout = useRef(null);

  const execute = (cmd, isSliderCommand = false) => {
    if (isRestoring.current) return;
    
    setState(prev => {
      const newState = cmd.do(prev);

      if (isSliderCommand) {
        pendingCommand.current = cmd;
        
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
      } else {
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
          pendingCommand.current = null;
        }
        history.current = history.current.slice(0, index.current + 1);
        history.current.push(cmd);
        if (history.current.length > 50) history.current.shift();
        else index.current++;
      }

      return newState;
    });
  };

  const undo = () => {
    if (index.current < 0) return;    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
    }
    
    isRestoring.current = true;

    const cmd = history.current[index.current];
    setState(prev => cmd.undo(prev));

    index.current--;
    isRestoring.current = false;
  };

  const redo = () => {
    if (index.current >= history.current.length - 1) return;
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      pendingCommand.current = null;
    }
    
    isRestoring.current = true;

    const cmd = history.current[index.current + 1];
    setState(prev => cmd.do(prev));

    index.current++;
    isRestoring.current = false;
  };

  const canUndo = index.current >= 0;
  const canRedo = index.current < history.current.length - 1;

  return { state, execute, undo, redo, canUndo, canRedo };
}