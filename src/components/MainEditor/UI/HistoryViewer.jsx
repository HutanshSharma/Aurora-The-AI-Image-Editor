import { useState, useEffect, useMemo, useRef } from 'react';
import { History, X, Sparkles } from 'lucide-react';
import { runPredictiveBranch } from '../../ColorGradingUtils/predictive_core.js';
import { registerAdaptiveLUT } from '../../ColorGradingUtils/adaptiveLutStore.js';
import { parseHistory } from '../../../utils/historyParser.js';
import { applyLUT, parseCubeLUT, getAvailableLUTs } from '../Utils/LUTUtils.js';
import ClipLoader from 'react-spinners/HashLoader';
import HistoryGraph from './HistoryGraph.jsx';
import HistoryTimeline from './HistoryTimeline.jsx';
import HistoryBranchSheet from './HistoryBranchSheet.jsx';

const thumbKey = (id) => (id === null ? 'root' : String(id));

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

const HistoryViewer = ({
  uploadedImage,
  initialState,
  historyTree,
  currentNodeId,
  onJumpToNode,
  isSaving,
  addBranch,
  isOpen = false,
  onClose,
  addToast,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [thumbnails, setThumbnails] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPredictiveProcessing, setIsPredictiveProcessing] = useState(false);
  const [branchSheetNode, setBranchSheetNode] = useState(null);

  const lutCacheRef = useRef({});
  const thumbsRef = useRef({});
  const isDesktop = useIsDesktop();

  const [selectedId, setSelectedId] = useState(currentNodeId);
  const prevOpenRef = useRef(isOpen);
  const prevCurRef = useRef(currentNodeId);
  if (isOpen !== prevOpenRef.current) {
    prevOpenRef.current = isOpen;
    prevCurRef.current = currentNodeId;
    if (isOpen && selectedId !== currentNodeId) setSelectedId(currentNodeId); 
  } else if (isOpen && currentNodeId !== prevCurRef.current) {
    prevCurRef.current = currentNodeId;
    if (selectedId !== currentNodeId) setSelectedId(currentNodeId);
  }

  const snapshots = useMemo(
    () => (isOpen ? parseHistory(initialState, historyTree, currentNodeId) : []),
    [isOpen, initialState, historyTree, currentNodeId],
  );

  const nodeMap = useMemo(() => {
    const m = new Map();
    snapshots.forEach((s) => m.set(s.id, s));
    return m;
  }, [snapshots]);

  const { activeSet, activePath } = useMemo(() => {
    const ids = new Set();
    const chain = [];
    let cur = selectedId;
    let guard = 0;
    while (guard++ < 100000) {
      chain.push(cur);
      ids.add(cur);
      if (cur === null) break;
      const node = nodeMap.get(cur);
      if (!node) break;
      cur = node.parentId;
    }
    return { activeSet: ids, activePath: chain.reverse() };
  }, [nodeMap, selectedId]);

  const forwardPath = useMemo(() => {
    const path = [];
    let cur = selectedId;
    let guard = 0;
    while (guard++ < 100000) {
      const kids = nodeMap.get(cur)?.children || [];
      if (kids.length === 1) {
        cur = kids[0];
        path.push(cur);
      } else {
        break;
      }
    }
    return path;
  }, [nodeMap, selectedId]);

  const getThumb = (id) => thumbnails[thumbKey(id)] || null;

  const generateThumbnail = async (image, state) => {
    try {
      const canvas = document.createElement('canvas');
      const maxSize = 300;
      const width = image.width;
      const height = image.height;
      const scale = Math.min(maxSize / width, maxSize / height);
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (state.selectedLUT) {
        try {
          let lut = lutCacheRef.current[state.selectedLUT.file];
          if (!lut) {
            const response = await fetch(`/luts/${state.selectedLUT.file}`);
            const lutText = await response.text();
            lut = parseCubeLUT(lutText);
            lutCacheRef.current[state.selectedLUT.file] = lut;
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
      if (filters.length > 0) finalCtx.filter = filters.join(' ');

      finalCtx.save();
      finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
      if (state.rotation) finalCtx.rotate((state.rotation * Math.PI) / 180);
      const drawWidth = finalCanvas.width * (state.flipH ? -1 : 1);
      const drawHeight = finalCanvas.height * (state.flipV ? -1 : 1);
      finalCtx.drawImage(canvas, -finalCanvas.width / 2, -finalCanvas.height / 2, drawWidth, drawHeight);
      finalCtx.restore();

      return finalCanvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null;
    }
  };

  useEffect(() => {
    thumbsRef.current = {};
    setThumbnails({});
  }, [uploadedImage]);

  useEffect(() => {
    if (!uploadedImage || !isOpen || snapshots.length === 0) return;
    const missing = snapshots.filter((s) => !(thumbKey(s.id) in thumbsRef.current));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      setIsGenerating(true);
      for (const snap of missing) {
        if (cancelled) return;
        const url = await generateThumbnail(uploadedImage, snap.state);
        if (cancelled) return;
        thumbsRef.current = { ...thumbsRef.current, [thumbKey(snap.id)]: url };
        setThumbnails(thumbsRef.current);
      }
      if (!cancelled) setIsGenerating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadedImage, snapshots, isOpen]);

  const handleClose = () => {
    setBranchSheetNode(null);
    if (selectedId !== currentNodeId) onJumpToNode?.(selectedId);
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose?.();
    }, 280);
  };

  const handleSelect = (nodeId) => {
    setSelectedId(nodeId);
    setBranchSheetNode(null);
  };

  const handlePredictiveBranch = async () => {
    if (!uploadedImage || !addBranch || isPredictiveProcessing) return;
    if (selectedId !== currentNodeId) onJumpToNode?.(selectedId);
    setIsPredictiveProcessing(true);
    try {
      const currentNode = historyTree.find((n) => n.id === selectedId);
      if (!currentNode || !currentNode.children || currentNode.children.length === 0) {
        addToast?.('Create a couple of variations at this point first — then AI can optimize between them.', 'info');
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
        const node = historyTree.find((n) => n.id === nodeId);
        if (!node) return [];
        if (!node.children || node.children.length === 0) {
          return [{ ...node, state: { ...node.state, baseImage: baseImageData } }];
        }
        const endpoints = [];
        node.children.forEach((childId) => {
          endpoints.push(...getAllBranchEndpoints(childId));
        });
        return endpoints;
      };

      const allEndpoints = [];
      currentNode.children.forEach((childId) => {
        allEndpoints.push(...getAllBranchEndpoints(childId));
      });

      const allBranchesHistory = [];
      const pathToCurrent = [];
      pathToCurrent.push({ id: null, state: { ...initialState, baseImage: baseImageData }, timestamp: 0 });

      if (selectedId !== null) {
        const buildPath = (nodeId) => {
          const node = historyTree.find((n) => n.id === nodeId);
          if (!node) return [];
          if (node.parentId !== null) {
            const parentPath = buildPath(node.parentId);
            return [...parentPath, { ...node, state: { ...node.state, baseImage: baseImageData } }];
          }
          return [{ ...node, state: { ...node.state, baseImage: baseImageData } }];
        };
        pathToCurrent.push(...buildPath(selectedId));
      }

      allBranchesHistory.push(...pathToCurrent);
      allBranchesHistory.push(...allEndpoints);

      const slideIndex = allBranchesHistory.findIndex((h) => h.id === selectedId);
      if (slideIndex === -1) {
        console.error('Current node not found in history');
        setIsPredictiveProcessing(false);
        return;
      }

      const result = await runPredictiveBranch(allBranchesHistory, slideIndex, baseImageData);

      if (result.aiParams) {
        const optimizedState = {
          ...currentNode.state,
          brightness: result.aiParams.brightness ?? 100,
          contrast: result.aiParams.contrast ?? 100,
          saturation: result.aiParams.saturation ?? 100,
        };
        if (result.wbLUT) {
          const wbId = registerAdaptiveLUT(result.wbLUT);
          optimizedState.selectedLUT = { name: 'AI White Balance', file: `__adaptive_${wbId}`, adaptive: true, adaptiveId: wbId };
        } else if (result.aiParams.lutId) {
          const lutObj = getAvailableLUTs().find((l) => l.file === result.aiParams.lutId);
          optimizedState.selectedLUT = lutObj || null;
          optimizedState.lutStrength = Math.max(0, Math.min(100, 50 + (result.aiParams.lutStrengthDelta || 0)));
        }
        const branchLabel = result.isAI
          ? `AI Optimized (${result.modelUsed})`
          : `Smart Optimized (${result.modelUsed})`;
        const newId = addBranch(optimizedState, branchLabel);
        if (newId !== undefined && newId !== null) setSelectedId(newId);
      } else {
        addToast?.('AI optimization failed to produce results. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Predictive branch processing failed:', error);
      addToast?.('AI optimization is currently unavailable. Please try again later.', 'error');
    } finally {
      setIsPredictiveProcessing(false);
    }
  };

  if (!uploadedImage) return null;

  return (
    <>
      {isSaving && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface-2 p-8 shadow-pop">
            <ClipLoader color="#f43f5e" size={48} />
            <p className="text-sm text-muted">Saving…</p>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-60 flex flex-col bg-background"
          style={{ animation: isClosing ? 'fadeOut 0.28s ease-out' : 'fadeIn 0.28s ease-out' }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/60 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-accent">
                <History size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold leading-tight text-ink">Version history</h2>
                <p className="text-[12px] text-muted">
                  {isGenerating ? 'Rendering previews…' : `${snapshots.length} version${snapshots.length === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {addBranch && (
                <button
                  onClick={handlePredictiveBranch}
                  disabled={isPredictiveProcessing}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-linear-to-r from-accent to-accent-press px-3.5 text-[13px] font-semibold text-white shadow-glow transition-opacity hover:opacity-95 disabled:opacity-50"
                >
                  {isPredictiveProcessing ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  <span className="hidden sm:inline">{isPredictiveProcessing ? 'Optimizing…' : 'AI optimize'}</span>
                </button>
              )}
              <button
                onClick={handleClose}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {snapshots.length <= 1 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-faint">
                  <History size={28} />
                </div>
                <p className="text-lg font-semibold text-ink">No history yet</p>
                <p className="mt-1 text-sm">Make an edit and your versions will appear here.</p>
              </div>
            ) : isDesktop ? (
              <HistoryGraph
                nodeMap={nodeMap}
                rootId={null}
                activeSet={activeSet}
                currentId={selectedId}
                getThumb={getThumb}
                onSelect={handleSelect}
              />
            ) : (
              <HistoryTimeline
                activePath={activePath}
                forwardPath={forwardPath}
                nodeMap={nodeMap}
                currentId={selectedId}
                getThumb={getThumb}
                onSelect={handleSelect}
                onOpenBranches={(node) => setBranchSheetNode(node)}
              />
            )}
          </div>
        </div>
      )}

      <HistoryBranchSheet
        open={!!branchSheetNode}
        node={branchSheetNode}
        nodeMap={nodeMap}
        activeSet={activeSet}
        getThumb={getThumb}
        onSelect={handleSelect}
        onClose={() => setBranchSheetNode(null)}
      />
    </>
  );
};

export default HistoryViewer;
