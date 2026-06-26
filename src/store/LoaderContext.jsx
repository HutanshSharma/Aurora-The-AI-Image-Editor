import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import ClipLoader from 'react-spinners/HashLoader';

const LoaderContext = createContext({ showLoader: () => {}, hideLoader: () => {} });

const MIN_VISIBLE = 320;

export function LoaderProvider({ children }) {
  const [loader, setLoader] = useState(null); // { message } | null
  const shownAtRef = useRef(0);
  const hideTimerRef = useRef(null);

  const showLoader = useCallback((message = 'Working…') => {
    clearTimeout(hideTimerRef.current);
    shownAtRef.current = Date.now();
    setLoader({ message });
  }, []);

  const hideLoader = useCallback(() => {
    const elapsed = Date.now() - shownAtRef.current;
    clearTimeout(hideTimerRef.current);
    if (elapsed >= MIN_VISIBLE) {
      setLoader(null);
    } else {
      hideTimerRef.current = setTimeout(() => setLoader(null), MIN_VISIBLE - elapsed);
    }
  }, []);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  return (
    <LoaderContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      {loader && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface-2/90 px-8 py-7 shadow-pop">
            <ClipLoader color="#f43f5e" size={44} />
            <p className="text-sm font-medium text-ink">{loader.message}</p>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoader() {
  return useContext(LoaderContext);
}
