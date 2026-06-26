import { useState } from 'react';
import handleChangePassword from '../handlers/handleChangePassword';
import { Mail, ArrowLeft } from 'lucide-react';
import Input from '../../ui/Input';
import Button from '../../ui/Button';

export default function ForgotPassword({
  setForgotPasswordData,
  forgotpasswordData,
  setIsLogin,
  setisPasswordChange,
  addToast,
}) {
  const [sending, setSending] = useState(false);

  const back = () => {
    setisPasswordChange(false);
    setIsLogin(true);
  };

  const submit = async () => {
    setSending(true);
    const ok = await handleChangePassword(forgotpasswordData, addToast);
    setSending(false);
    if (ok) {
      setIsLogin(true);
      setisPasswordChange(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <button
        type="button"
        onClick={back}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to log in
      </button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Reset your password
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Enter your email and we&apos;ll send you a secure reset link.
        </p>
      </div>

      <Input
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        label="Email"
        value={forgotpasswordData.email}
        onChange={(e) => setForgotPasswordData({ email: e.target.value })}
        leading={<Mail size={18} />}
      />

      <Button type="submit" size="lg" fullWidth disabled={sending}>
        {sending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Sending…
          </>
        ) : (
          'Send reset link'
        )}
      </Button>
    </form>
  );
}
