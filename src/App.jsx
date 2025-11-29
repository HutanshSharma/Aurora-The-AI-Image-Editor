import { useState, lazy, Suspense } from "react";
import Toast from "./components/Toast";
const AuthPage = lazy(() => import("./components/Auth/Auth"));
const ResetPassword = lazy(() => import("./components/Auth/ResetPassword"));
const VerifyEmail = lazy(() => import("./components/Auth/VerifyEmail"));
const IntroPage = lazy(()=>import("./components/IntroPage/IntroPage"));
const Editor = lazy(()=>import("./components/ImageEditor/Editor"))
import { Routes, Route, Navigate, useLocation} from "react-router-dom"
import ClipLoader from "react-spinners/HashLoader"
import { UserProvider, useUser } from "./store/UserContext";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("refresh_token");
  return token ? children : <Navigate to="/auth" replace />;
}

function LogChecker({ children, location }){
  const token = localStorage.getItem("refresh_token");
  let next_page = '/'
  if(location.pathname !== '/auth') next_page = location.pathname
  return token ? <Navigate to={next_page} replace /> : children; 
}

function EditorWithLoader({ addToast }) {
  const { isLoading } = useUser();
  
  if (isLoading) {
    return (
      <div className="loading-screen bg-black">
      <ClipLoader color="rgba(239,68,68,0.9)" size={50} className="loader"/>
      </div>
    );
  }
  
  return <Editor addToast={addToast} />;
}

function App() {
  const [toasts, setToasts] = useState([])
  const location = useLocation()

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <Suspense fallback={
      <div className="loading-screen bg-black">
      <ClipLoader color="rgba(239,68,68,0.9)" size={50} className="loader"/>
      </div>}>
    <Routes >
      <Route path="/auth" element={
        <LogChecker location={location}>
        <AuthPage addToast={addToast}/>
        </LogChecker>}/>

      <Route path="/intro" element={
        <LogChecker location={location}>
        <IntroPage addToast={addToast}/>
        </LogChecker>}/>

      <Route path="/" element={
        <UserProvider addToast={addToast} >
          <PrivateRoute addToast={addToast} >
            <EditorWithLoader addToast={addToast}/>
          </PrivateRoute>
        </UserProvider>
        } />
      <Route path="/reset_password/:token" element={<ResetPassword addToast={addToast}/>}/>
      <Route path="/verify_email/:token" element={<VerifyEmail addToast={addToast}/>} />
    </Routes>
      {toasts &&
          <div className="fixed bottom-2 right-2 left-2 sm:left-auto sm:bottom-4 sm:right-4 md:bottom-8 md:right-8 flex flex-col gap-3 p-2 sm:p-4 max-w-sm sm:max-w-md ml-auto overflow-hidden z-50">
          {toasts.map((toast) => (
            <Toast 
              key={toast.id}
              id={toast.id}
              message={toast.message} 
              type={toast.type}
              removeToast={removeToast}
            />
          ))}
        </div>}
    </Suspense>
  )
}

export default App
