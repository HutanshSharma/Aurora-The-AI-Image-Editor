import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import handleResetPassword from '../handlers/handleResetPassword';
import { LockKeyhole, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { cn } from '../../ui/cn';

function Requirement({ met, children }) {
  return (
    <li className="flex items-center gap-2 text-[12px]">
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

export default function ResetPassword({ addToast }) {
  const { token } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowComfirmPassword] = useState(false);
  const [password, setPassword] = useState({ password: '', confirmpassword: '' });
  const navigate = useNavigate();

  const checkPasswordRequirements = (pwd) => ({
    length: pwd.length >= 8,
    numberOrSymbol: /[0-9!@#$%^&*]/.test(pwd),
    caseRequirement: /[a-z]/.test(pwd) && /[A-Z]/.test(pwd),
  });

  const requirements = checkPasswordRequirements(password.password);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(244,63,94,0.18),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-accent">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-1.5 text-sm text-muted">Choose a new password for your account.</p>
        </div>

        <form
          className="glass space-y-4 rounded-3xl border border-line p-6 shadow-pop"
          onSubmit={(e) => {
            e.preventDefault();
            handleResetPassword(password, requirements, addToast, token, navigate);
          }}
        >
          <div>
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="New password"
              label="New password"
              value={password.password}
              onChange={(e) => setPassword({ ...password, password: e.target.value })}
              leading={<LockKeyhole size={18} />}
              trailing={
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-faint transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              }
            />
            <ul className="mt-3 space-y-1.5 pl-0.5">
              <Requirement met={requirements.length}>At least 8 characters</Requirement>
              <Requirement met={requirements.numberOrSymbol}>A number (0–9) or symbol</Requirement>
              <Requirement met={requirements.caseRequirement}>Upper &amp; lowercase letters</Requirement>
            </ul>
          </div>

          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-type password"
            label="Confirm password"
            value={password.confirmpassword}
            onChange={(e) => setPassword({ ...password, confirmpassword: e.target.value })}
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

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button type="submit" size="lg" fullWidth>
              Reset password
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate('/auth', { replace: true })}
            >
              Back to log in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
