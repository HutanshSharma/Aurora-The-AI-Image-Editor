import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand2, Scissors, Palette } from 'lucide-react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPassword from './ForgotPassword';
import Panel from './Panel';
import Beams from './Beams';
import Segmented from '../../ui/Segmented';
import Spinner from '../../ui/Spinner';
import { cn } from '../../ui/cn';

export default function AuthPage({ addToast }) {
  const [isLogin, setIsLogin] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowComfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [forgotpasswordData, setForgotPasswordData] = useState({ email: '' });
  const [isPasswordChange, setisPasswordChange] = useState(false);

  const checkPasswordRequirements = (password) => ({
    length: password.length >= 8,
    numberOrSymbol: /[0-9!@#$%^&*]/.test(password),
    caseRequirement: /[a-z]/.test(password) && /[A-Z]/.test(password),
  });

  const requirements = checkPasswordRequirements(signupData.password);

  const view = isPasswordChange ? 'forgot' : isLogin ? 'login' : 'signup';

  const toggleAuth = (v) => {
    setisPasswordChange(false);
    setIsLogin(v === 'login');
  };

  const authTabs = [
    { value: 'login', label: 'Log in' },
    { value: 'signup', label: 'Register' },
  ];

  const layerCls = (active) =>
    cn(
      'col-start-1 row-start-1 transition-all duration-300 ease-out',
      active ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-1 opacity-0',
    );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-ink">
      {/* WebGL beams */}
      <div className="absolute inset-0">
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={50}
          lightColor="rgb(239,68,68)"
          speed={3}
          noiseIntensity={2}
          scale={0.2}
          rotation={20}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/30 lg:bg-linear-to-r" />

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed inset-0 z-80 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-line glass px-10 py-8">
              <Spinner size={44} />
              <p className="text-sm text-muted">Authenticating…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-8">
        <div className="hidden items-center justify-center lg:flex">
          <Panel />
        </div>

        <div className="flex min-h-screen flex-col justify-end lg:min-h-0 lg:justify-center">
          <motion.div
            className="flex flex-col items-center px-6 pb-8 pt-10 text-center lg:hidden"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
            }}
          >
            <motion.div
              className="mb-5"
              variants={{ hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1 } }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-linear-to-br from-accent to-accent-press shadow-soft">
                <Sparkles size={28} className="text-white" />
              </div>
            </motion.div>

            <motion.h1
              className="bg-linear-to-br from-white to-accent/80 bg-clip-text text-5xl font-bold tracking-tight text-transparent"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              Aurora
            </motion.h1>

            <motion.p
              className="mt-2 max-w-60 text-[15px] leading-snug text-muted"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              Studio-grade photo editing, right in your pocket.
            </motion.p>

            <motion.div
              className="mt-5 flex flex-wrap items-center justify-center gap-2"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
            >
              {[
                { icon: Wand2, label: 'One-tap edits' },
                { icon: Scissors, label: 'Cutout' },
                { icon: Palette, label: 'Color grade' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-3 py-1.5 text-[12px] font-medium text-muted backdrop-blur-sm"
                >
                  <Icon size={13} className="text-accent" />
                  {label}
                </span>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full glass border border-line shadow-pop
                       rounded-t-3xl px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]
                       sm:mx-auto sm:max-w-md sm:rounded-3xl sm:pb-6
                       lg:mx-0"
          >
            <div className="grid">
              {/* Log in */}
              <div
                className={layerCls(view === 'login')}
                aria-hidden={view !== 'login'}
                inert={view !== 'login'}
              >
                <Segmented className="mb-6" value={view} onChange={toggleAuth} options={authTabs} />
                <LoginForm
                  setLoginData={setLoginData}
                  showLoginPassword={showLoginPassword}
                  loginData={loginData}
                  setShowLoginPassword={setShowLoginPassword}
                  addToast={addToast}
                  setisPasswordChange={setisPasswordChange}
                  setIsLogin={setIsLogin}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              </div>

              {/* Register */}
              <div
                className={layerCls(view === 'signup')}
                aria-hidden={view !== 'signup'}
                inert={view !== 'signup'}
              >
                <Segmented className="mb-6" value={view} onChange={toggleAuth} options={authTabs} />
                <SignUpForm
                  setShowSignupPassword={setShowSignupPassword}
                  setSignupData={setSignupData}
                  signupData={signupData}
                  showSignupPassword={showSignupPassword}
                  requirements={requirements}
                  setShowComfirmPassword={setShowComfirmPassword}
                  showConfirmPassword={showConfirmPassword}
                  addToast={addToast}
                  setIsLogin={setIsLogin}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                />
              </div>

              {/* Forgot password */}
              <div
                className={layerCls(view === 'forgot')}
                aria-hidden={view !== 'forgot'}
                inert={view !== 'forgot'}
              >
                <ForgotPassword
                  setForgotPasswordData={setForgotPasswordData}
                  forgotpasswordData={forgotpasswordData}
                  setIsLogin={setIsLogin}
                  setisPasswordChange={setisPasswordChange}
                  addToast={addToast}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
