import { User, Mail, LockKeyhole, Eye, EyeOff, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import handleSignUp from '../handlers/handleSignUp';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebookF } from 'react-icons/fa';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { cn } from '../../ui/cn';

function Requirement({ met, children }) {
  return (
    <li className="flex items-center gap-2 text-[12px] transition-colors">
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
          met ? 'bg-success/20 text-success' : 'bg-surface-3 text-faint',
        )}
      >
        {met ? <Check size={11} strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-current" />}
      </span>
      <span className={met ? 'text-muted' : 'text-faint'}>{children}</span>
    </li>
  );
}

export default function SignUpForm({
  setShowSignupPassword,
  setSignupData,
  signupData,
  showSignupPassword,
  requirements,
  setShowComfirmPassword,
  showConfirmPassword,
  addToast,
  setIsLogin,
  isLoading,
  setIsLoading,
}) {
  const navigate = useNavigate();
  const submit = () =>
    handleSignUp(signupData, requirements, addToast, setIsLogin, setIsLoading, navigate);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        type="text"
        autoComplete="name"
        placeholder="Your name"
        label="Full name"
        value={signupData.name}
        onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
        leading={<User size={18} />}
      />

      <Input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        label="Email"
        value={signupData.email}
        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
        leading={<Mail size={18} />}
      />

      <div>
        <Input
          type={showSignupPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Create a password"
          label="Password"
          value={signupData.password}
          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
          leading={<LockKeyhole size={18} />}
          trailing={
            <button
              type="button"
              aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowSignupPassword(!showSignupPassword)}
              className="text-faint transition-colors hover:text-ink"
            >
              {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        <ul className="mt-3 space-y-1.5 pl-0.5">
          <Requirement met={requirements.length}>At least 8 characters</Requirement>
          <Requirement met={requirements.numberOrSymbol}>
            A number (0–9) or symbol
          </Requirement>
          <Requirement met={requirements.caseRequirement}>
            Upper &amp; lowercase letters
          </Requirement>
        </ul>
      </div>

      <Input
        type={showConfirmPassword ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder="Re-type password"
        label="Confirm password"
        value={signupData.confirmPassword}
        onChange={(e) =>
          setSignupData({ ...signupData, confirmPassword: e.target.value })
        }
        leading={<LockKeyhole size={18} />}
        trailing={
          <button
            type="button"
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowComfirmPassword(!showConfirmPassword)}
            className="text-faint transition-colors hover:text-ink"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <Button type="submit" size="lg" fullWidth disabled={isLoading}>
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Creating account…
          </>
        ) : (
          'Create account'
        )}
      </Button>

      <div className="flex items-center gap-3 py-1 text-[12px] text-faint">
        <span className="h-px flex-1 bg-line" />
        or sign up with
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
