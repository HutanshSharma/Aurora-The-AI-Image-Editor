import { runPredictiveBranch } from './Predictive-color-grading/color-grading-src/predictive_core.js';
import { useState, useEffect, useMemo } from 'react';
import { History, X, GitBranch, Check, Save, Sparkles } from 'lucide-react';
import { parseHistory } from '../../utils/historyParser';
import { applyLUT, parseCubeLUT } from './LUTUtils';
import ClipLoader from "react-spinners/HashLoader";

const HistoryViewer = ({ 
  uploadedImage, 
  initialState, 
  historyTree, 
  currentNodeId,
  loadedLUT,
  onJumpToNode,
  saveImage,
  hasUnsavedChanges,
  isSaving,
  addBranch,
  editorState
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [expandedNode, setExpandedNode] = useState(null);
  const [isBranchClosing, setIsBranchClosing] = useState(false);
  const [lutCache, setLutCache] = useState({});
  const [isPredictiveProcessing, setIsPredictiveProcessing] = useState(false);

  useEffect(() => {
    if (historyTree && uploadedImage) {
      const parsed = parseHistory(initialState, historyTree, currentNodeId);
      setSnapshots(parsed);
    }
  }, [historyTree, currentNodeId, initialState, uploadedImage]);

  useEffect(() => {
    if (!uploadedImage || !isOpen || snapshots.length === 0) return;

    const generateThumbnails = async () => {
      setIsGeneratingThumbnails(true);
      const newThumbnails = {};

      for (const snapshot of snapshots) {
        const thumbnailUrl = await generateThumbnail(
          uploadedImage, 
          snapshot.state
        );
        newThumbnails[snapshot.id] = thumbnailUrl;
      }

      setThumbnails(newThumbnails);
      setIsGeneratingThumbnails(false);
    };

    generateThumbnails();
  }, [uploadedImage, snapshots, isOpen]);

  const generateThumbnail = async (image, state) => {
    try {
      const canvas = document.createElement('canvas');
      const maxSize = 300;
      
      let width = image.width;
      let height = image.height;
      const scale = Math.min(maxSize / width, maxSize / height);
      
      canvas.width = width * scale;
      canvas.height = height * scale;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      if (state.selectedLUT) {
        try {
          let lut = lutCache[state.selectedLUT.file];
          
          if (!lut) {
            const response = await fetch(`/luts/${state.selectedLUT.file}`);
            const lutText = await response.text();
            lut = parseCubeLUT(lutText);
            setLutCache(prev => ({ ...prev, [state.selectedLUT.file]: lut }));
          }
          
          imageData = applyLUT(imageData, lut);
        } catch (error) {
          console.error('Error applying LUT to thumbnail:', error);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const finalCtx = finalCanvas.getContext('2d');
      const filters = [];
      if (state.brightness !== 100) filters.push(`brightness(${state.brightness}%)`);
      if (state.contrast !== 100) filters.push(`contrast(${state.contrast}%)`);
      if (state.saturation !== 100) filters.push(`saturate(${state.saturation}%)`);
      if (state.blur > 0) filters.push(`blur(${state.blur}px)`);
      if (state.opacity !== 100) filters.push(`opacity(${state.opacity}%)`);
      if (state.hue !== 0) filters.push(`hue-rotate(${state.hue}deg)`);
      if (filters.length > 0) {
        finalCtx.filter = filters.join(' ');
      }
      finalCtx.save();
      finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
      
      if (state.rotation) {
        finalCtx.rotate((state.rotation * Math.PI) / 180);
      }
      
      const drawWidth = finalCanvas.width * (state.flipH ? -1 : 1);
      const drawHeight = finalCanvas.height * (state.flipV ? -1 : 1);      
      finalCtx.drawImage(
        canvas,
        -finalCanvas.width / 2,
        -finalCanvas.height / 2,
        drawWidth,
        drawHeight
      );
      
      finalCtx.restore();

      return finalCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };

  const handleJumpToState = (nodeId) => {
    if (onJumpToNode) {
      onJumpToNode(nodeId);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  const handleExpandBranches = (nodeId, e) => {
    e.stopPropagation();
    if (expandedNode === nodeId) {
      setIsBranchClosing(true);
      setTimeout(() => {
        setExpandedNode(undefined);
        setIsBranchClosing(false);
      }, 300);
    } else {
      setExpandedNode(nodeId);
    }
  };

  const getCurrentBranchPath = () => {
    const path = [];
    
    const initialSnapshot = snapshots.find(s => s.id === null);
    if (initialSnapshot) {
      path.push(initialSnapshot);
    }

    if (currentNodeId !== null) {
      const buildPath = (nodeId) => {
        const node = snapshots.find(s => s.id === nodeId);
        if (!node) return [];
        
        if (node.parentId !== null) {
          const parentPath = buildPath(node.parentId);
          return [...parentPath, node];
        }
        return [node];
      };

      const pathNodes = buildPath(currentNodeId);
      path.push(...pathNodes);
    }

    return path;
  };

  const getBranchPreview = (startNodeId, depth = 4) => {
    const preview = [];
    let currentId = startNodeId;
    
    for (let i = 0; i < depth; i++) {
      const node = snapshots.find(s => s.id === currentId);
      if (!node) break;
      
      preview.push(node);      
      if (node.children && node.children.length > 0) {
        currentId = node.children[0];
      } else {
        break;
      }
    }
    
    return preview;
  };

  const getDisplayedSnapshots = () => {
    if (expandedNode !== undefined && expandedNode === currentNodeId) {
      const currentNode = snapshots.find(s => s.id === expandedNode);
      if (currentNode && currentNode.children && currentNode.children.length >= 1) {
        const result = [];        
        const pathToCurrent = getCurrentBranchPath();
        const pathBeforeCurrent = pathToCurrent.filter(s => s.id !== currentNodeId);
        result.push(...pathBeforeCurrent);        
        result.push({ ...currentNode, isBranchPoint: true });        
        currentNode.children.forEach((childId, branchIndex) => {
          const branchPreview = getBranchPreview(childId, 4);
          branchPreview.forEach((node, nodeIndex) => {
            result.push({
              ...node,
              branchIndex, 
              isBranchPreview: true,
              isFirstInBranch: nodeIndex === 0,
              nodeDepth: nodeIndex
            });
          });
        });
        
        return result;
      }
    }    
    return getCurrentBranchPath();
  };
  const displayedSnapshots = useMemo(() => {
    return getDisplayedSnapshots();
  }, [snapshots, expandedNode, currentNodeId]);

  const getAllBranchEndpoints = (nodeId) => {
    const node = historyTree.find(n => n.id === nodeId);
    if (!node) return [];
    
    if (!node.children || node.children.length === 0) {
      return [node];
    }    
    const endpoints = [];
    node.children.forEach(childId => {
      endpoints.push(...getAllBranchEndpoints(childId));
    });
    return endpoints;
  };

  const handlePredictiveBranch = async (e) => {
    e.stopPropagation();
    if (!uploadedImage || !addBranch || isPredictiveProcessing) return;
    
    setIsPredictiveProcessing(true);
    try {      
      const currentNode = historyTree.find(n => n.id === currentNodeId);
      if (!currentNode || !currentNode.children || currentNode.children.length === 0) {
        console.error('No branches found at current node');
        setIsPredictiveProcessing(false);
        return;
      }      
      const canvas = document.createElement('canvas');
      canvas.width = uploadedImage.width;
      canvas.height = uploadedImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(uploadedImage, 0, 0);
      const baseImageData = ctx.getImageData(0, 0, uploadedImage.width, uploadedImage.height);
      const getAllBranchEndpoints = (nodeId) => {
        const node = historyTree.find(n => n.id === nodeId);
        if (!node) return [];
        
        if (!node.children || node.children.length === 0) {
          return [{ ...node, state: { ...node.state, baseImage: baseImageData } }];
        }        
        const endpoints = [];
        node.children.forEach(childId => {
          endpoints.push(...getAllBranchEndpoints(childId));
        });
        return endpoints;
      };      
      const allEndpoints = [];
      currentNode.children.forEach(childId => {
        allEndpoints.push(...getAllBranchEndpoints(childId));
      });
            
      const allBranchesHistory = [];      
      const pathToCurrent = [];
      pathToCurrent.push({ 
        id: null, 
        state: { ...initialState, baseImage: baseImageData }, 
        timestamp: 0 
      });
      
      if (currentNodeId !== null) {
        const buildPath = (nodeId) => {
          const node = historyTree.find(n => n.id === nodeId);
          if (!node) return [];
          if (node.parentId !== null) {
            const parentPath = buildPath(node.parentId);
            return [...parentPath, { ...node, state: { ...node.state, baseImage: baseImageData } }];
          }
          return [{ ...node, state: { ...node.state, baseImage: baseImageData } }];
        };
        pathToCurrent.push(...buildPath(currentNodeId));
      }
      
      allBranchesHistory.push(...pathToCurrent);      
      allBranchesHistory.push(...allEndpoints);
      
      const slideIndex = allBranchesHistory.findIndex(h => h.id === currentNodeId);
      
      if (slideIndex === -1) {
        console.error('Current node not found in history');
        setIsPredictiveProcessing(false);
        return;
      }
      
      
      const result = await runPredictiveBranch(allBranchesHistory, slideIndex, baseImageData);
      
      if (result.aiParams) {
        const optimizedState = {
          ...currentNode.state,
          brightness: result.aiParams.brightness || 100,
          contrast: 100 + (result.aiParams.contrast || 0),
          saturation: 100 + (result.aiParams.saturation || 0),
        };
        
        // Apply LUT if neural network selected one
        if (result.aiParams.lutId) {
          optimizedState.selectedLUT = result.aiParams.lutId;
          optimizedState.lutStrength = Math.max(0, Math.min(100, 50 + (result.aiParams.lutStrengthDelta || 0)));
        }
        const branchLabel = result.isAI ? 
          `AI Optimized (${result.modelUsed})` : 
          `Smart Optimized (${result.modelUsed})`;
        addBranch(optimizedState, branchLabel);
        
        setIsBranchClosing(true);
        setTimeout(() => {
          setExpandedNode(undefined);
          setIsBranchClosing(false);
        }, 300);
      } else {
        console.error('AI optimization failed - no result produced');
        alert('AI optimization failed to produce results. Please try again.');
      }
    } catch (error) {
      console.error('Predictive branch processing failed:', error);
      alert('AI optimization is currently unavailable. Please try again later.');
    } finally {
      setIsPredictiveProcessing(false);
    }
  };

  const handleSelectBranch = (firstNodeId, e) => {
    e.stopPropagation();
    
    const branchPreview = getBranchPreview(firstNodeId, 4);
    const lastNodeId = branchPreview.length > 0 
      ? branchPreview[branchPreview.length - 1].id 
      : firstNodeId;
    
    setIsBranchClosing(true);
    setTimeout(() => {
      if (onJumpToNode) {
        onJumpToNode(lastNodeId);
      }
      setExpandedNode(undefined);
      setIsBranchClosing(false);
    }, 300);
  };
  if (!uploadedImage) return null;

  return (
    <>
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900/90 rounded-lg p-8 flex flex-col items-center gap-4">
            <ClipLoader color="rgba(239,68,68,0.9)" size={50} />
            <p className="text-white text-sm">Saving...</p>
          </div>
        </div>
      )}
      
      <button
        onClick={() => {
          saveImage && saveImage();
        }}
        disabled={!hasUnsavedChanges || isSaving}
        className={`fixed right-24 bottom-35 z-30 backdrop-blur-md border rounded-lg p-3 transition-all duration-200 hover:scale-110 active:scale-95 ${
          hasUnsavedChanges && !isSaving
            ? 'bg-green-500/20 border-green-500/50 hover:bg-green-500/30'
            : 'bg-white/10 border-white/20 opacity-50 cursor-not-allowed'
        }`}
        title={hasUnsavedChanges ? "Save Image" : "No changes to save"}
      >
        <Save size={20} className={`w-6 h-6 ${hasUnsavedChanges ? 'text-green-400' : 'text-white'}`} />
      </button>
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-6 bottom-35 z-30 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-3 hover:bg-white/20 transition-all duration-200 hover:scale-110 active:scale-95"
        title="Edit History"
      >
        <History className="w-6 h-6" />
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col" style={{ animation: isClosing ? 'slideOutRight 0.3s ease-out' : 'slideInRight 0.3s ease-out' }}>
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/50 shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <h2 className="text-lg font-bold">Edit History</h2>
              <span className="text-xs text-gray-400">
                {displayedSnapshots.length}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="hover:bg-white/10 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isGeneratingThumbnails && (
              <div className="text-center py-20 text-gray-400">
                <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
                <p className="text-lg">Generating previews...</p>
              </div>
            )}

            {!isGeneratingThumbnails && (
              <>
                {!(expandedNode !== undefined && expandedNode === currentNodeId) && (
                  <div className="grid grid-cols-2 gap-3 pb-20 animate-in fade-in slide-in-from-left duration-300">
                    {displayedSnapshots.map((snapshot) => {
                      const hasBranches = snapshot.children && snapshot.children.length >= 1;
                      const hasMultipleBranches = snapshot.children && snapshot.children.length > 1;
                      const canExpand = snapshot.isCurrent && hasBranches;
                      
                      return (
                        <div key={snapshot.id} className="flex flex-col animate-in fade-in zoom-in-95 duration-200">
                          <div
                            onClick={() => handleJumpToState(snapshot.id)}
                            className={`
                              cursor-pointer rounded-lg border-2 transition-all duration-200 active:scale-95 hover:scale-105
                              ${snapshot.isCurrent 
                                ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' 
                                : 'border-green-500/60 bg-green-500/5'
                              }
                            `}
                          >
                            {/* Thumbnail */}
                            <div className="relative aspect-square w-full rounded-t-lg overflow-hidden bg-white/5">
                              {thumbnails[snapshot.id] ? (
                                <img
                                  src={thumbnails[snapshot.id]}
                                  alt={snapshot.label}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full"></div>
                                </div>
                              )}
                              
                              {/* Badges */}
                              <div className="absolute top-1.5 right-1.5 flex gap-1">
                                {snapshot.isCurrent && (
                                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold shadow-lg">
                                    Now
                                  </span>
                                )}
                                {!snapshot.isCurrent && (
                                  <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold shadow-lg">
                                    ✓
                                  </span>
                                )}
                              </div>
                              
                              {/* Branch count indicator for nodes with multiple branches */}
                              {!snapshot.isCurrent && hasMultipleBranches && (
                                <div className="absolute bottom-1.5 right-1.5">
                                  <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full font-semibold shadow-lg flex items-center gap-1">
                                    <GitBranch className="w-3 h-3" />
                                    {snapshot.children.length}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-2">
                              <p className="font-medium text-xs truncate">
                                {snapshot.label}
                              </p>
                            </div>
                          </div>

                          {canExpand && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExpandBranches(snapshot.id, e);
                              }}
                              className="mt-2 w-full text-xs bg-purple-500 active:bg-purple-600 text-white px-3 py-2 rounded-lg font-semibold shadow-lg flex items-center justify-center gap-1.5 transition-all duration-200 hover:bg-purple-600 hover:scale-105"
                            >
                              <GitBranch className="w-4 h-4" />
                              Show {snapshot.children.length} {snapshot.children.length === 1 ? 'branch' : 'branches'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(expandedNode !== undefined && expandedNode === currentNodeId) && (() => {
                  const currentNode = displayedSnapshots.find(s => s.isBranchPoint);
                  const branchPreviews = displayedSnapshots.filter(s => s.isBranchPreview);
                  
                  const branchesByIndex = {};
                  branchPreviews.forEach(node => {
                    if (!branchesByIndex[node.branchIndex]) {
                      branchesByIndex[node.branchIndex] = [];
                    }
                    branchesByIndex[node.branchIndex].push(node);
                  });

                  const branchColors = [
                    { bg: '#ffffff', border: '#e5e7eb', name: '1' },
                    { bg: '#ffffff', border: '#e5e7eb', name: '2' },
                    { bg: '#ffffff', border: '#e5e7eb', name: '3' },
                    { bg: '#ffffff', border: '#e5e7eb', name: '4' },
                    { bg: '#ffffff', border: '#e5e7eb', name: '5' },
                    { bg: '#ffffff', border: '#e5e7eb', name: '6' }
                  ];

                  return (
                    <div className="pb-20" style={{ animation: isBranchClosing ? 'fadeOut 0.3s ease-out' : 'fadeIn 0.3s ease-out' }}>
                      <div className="mb-4 max-w-[200px] mx-auto">
                        <div className="border-2 border-blue-500 bg-blue-500/10 rounded-lg shadow-lg">
                          <div className="relative aspect-square w-full rounded-t-lg overflow-hidden bg-white/5">
                            {thumbnails[currentNode?.id] && (
                              <img
                                src={thumbnails[currentNode.id]}
                                alt={currentNode.label}
                                className="w-full h-full object-contain"
                              />
                            )}
                            <div className="absolute top-1.5 right-1.5">
                              <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-semibold shadow-lg">
                                Branch Point
                              </span>
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="font-medium text-xs truncate">{currentNode?.label}</p>
                          </div>
                        </div>
                      </div>

                      {/* Branch Columns */}
                      <div className="flex gap-2 overflow-x-auto pb-4">
                        {Object.entries(branchesByIndex).map(([branchIndex, nodes]) => {
                          const colorIndex = parseInt(branchIndex);
                          const branchColor = branchColors[colorIndex % branchColors.length];
                          
                          return (
                            <div 
                              key={branchIndex} 
                              className="flex flex-col gap-2 min-w-[100px] animate-in fade-in slide-in-from-bottom duration-300"
                              style={{ animationDelay: `${colorIndex * 50}ms` }}
                            >
                              {/* Branch nodes - compact vertical layout */}
                              <div className="flex flex-col gap-1.5">
                                {nodes.map((node, idx) => (
                                  <div
                                    key={node.id}
                                    className="rounded-md border overflow-hidden bg-white/5"
                                    style={{ 
                                      borderColor: branchColor.border
                                    }}
                                  >
                                    <div className="relative w-full aspect-square bg-gray-900">
                                      {thumbnails[node.id] && (
                                        <img
                                          src={thumbnails[node.id]}
                                          alt={node.label}
                                          className="w-full h-full object-contain"
                                        />
                                      )}
                                      {idx === 0 && (
                                        <div className="absolute top-0.5 right-0.5">
                                          <span 
                                            className="text-[9px] bg-gray-800 text-white px-1 py-0.5 rounded font-semibold"
                                          >
                                            {colorIndex + 1}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {/* Very compact label */}
                                    <div className="px-1.5 py-0.5">
                                      <p className="text-[9px] font-medium truncate text-gray-300">{node.label}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Compact Select Button with Tick */}
                              <button
                                onClick={(e) => handleSelectBranch(nodes[0].id, e)}
                                className="w-full bg-green-500 active:bg-green-600 p-2.5 rounded-full shadow-lg transition-all duration-200 active:scale-95 hover:bg-green-600 hover:scale-110 flex items-center justify-center"
                              >
                                <Check className="w-5 h-5 text-white" strokeWidth={3} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* AI Optimize Button */}
                      {addBranch && (
                        <button
                          onClick={handlePredictiveBranch}
                          disabled={isPredictiveProcessing}
                          className="w-full mt-4 text-sm bg-linear-to-r from-purple-600 to-pink-600 active:from-purple-700 active:to-pink-700 text-white px-4 py-3 rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 hover:from-purple-700 hover:to-pink-700 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPredictiveProcessing ? (
                            <>
                              <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                              <span>AI Processing with NeurOP...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              <span>AI Optimize with Neural Model</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Hide Branches Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsBranchClosing(true);
                          setTimeout(() => {
                            setExpandedNode(undefined);
                            setIsBranchClosing(false);
                          }, 300);
                        }}
                        className="w-full mt-4 text-sm bg-gray-600 active:bg-gray-700 text-white px-4 py-3 rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2 transition-all duration-200 hover:bg-gray-700 hover:scale-105"
                      >
                        <X className="w-5 h-5" />
                        Hide Branches
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            {displayedSnapshots.length === 0 && !isGeneratingThumbnails && (
              <div className="text-center py-20 text-gray-400">
                <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl mb-2">No edit history yet</p>
                <p className="text-sm">Start editing to see history snapshots</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default HistoryViewer;
