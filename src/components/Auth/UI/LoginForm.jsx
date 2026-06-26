import { Mail, LockKeyhole, Eye, EyeOff } from 'lucide-react';
import handleLogIn from '../handlers/handLogIn';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebookF } from 'react-icons/fa';
import Input from '../../ui/Input';
import Button from '../../ui/Button';

export default function LoginForm({
  setLoginData,
  setShowLoginPassword,
  loginData,
  showLoginPassword,
  addToast,
  setisPasswordChange,
  isLoading,
  setIsLoading,
}) {
  const submit = () => handleLogIn(loginData, addToast, setIsLoading);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        label="Email"
        value={loginData.email}
        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
        leading={<Mail size={18} />}
      />

      <Input
        type={showLoginPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder="Your password"
        label="Password"
        value={loginData.password}
        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
        leading={<LockKeyhole size={18} />}
        trailing={
          <button
            type="button"
            aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowLoginPassword(!showLoginPassword)}
            className="text-faint transition-colors hover:text-ink"
          >
            {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setisPasswordChange(true)}
          className="text-[13px] font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Forgot password?
        </button>
      </div>

      <Button type="submit" size="lg" fullWidth disabled={isLoading}>
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Signing in…
          </>
        ) : (
          'Log in'
        )}
      </Button>

      <div className="flex items-center gap-3 py-1 text-[12px] text-faint">
        <span className="h-px flex-1 bg-line" />
        or continue with
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 text-sm text-ink transition-colors hover:bg-surface-3"
        >
          <FcGoogle size={18} /> Google
        </button>
        <button
          type="button"
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 text-sm text-ink transition-colors hover:bg-surface-3"
        >
          <FaFacebookF size={16} className="text-[#1877F2]" /> Facebook
        </button>
      </div>
    </form>
  );
}
