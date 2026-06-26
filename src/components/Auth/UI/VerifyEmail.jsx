import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MailCheck, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../../../utils/config';
import Spinner from '../../ui/Spinner';
import Button from '../../ui/Button';

export default function VerifyEmail({ addToast }) {
  const [verified, setVerified] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    (async function () {
      try {
        const response = await fetch(`${API_BASE}/auth/verify_email/${token}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/JSON' },
        });
        const resData = await response.json();
        if (!response.ok) {
          addToast(resData.detail, 'error');
          return;
        }
        setVerified(true);
      } catch (error) {
        addToast('Something went wrong. Please try again later.', 'invalid');
        return;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-ink">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(244,63,94,0.18),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="glass flex min-h-80 flex-col items-center justify-center rounded-3xl border border-line p-8 text-center shadow-pop">
          {!verified ? (
            <>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-accent">
                <MailCheck size={26} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Verifying your email</h1>
              <p className="mt-1.5 text-sm text-muted">This will only take a moment…</p>
              <div className="mt-7">
                <Spinner size={40} />
              </div>
            </>
          ) : (
            <>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
                <CheckCircle2 size={28} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Email verified</h1>
              <p className="mt-1.5 text-sm text-muted">
                Your email has been confirmed. You can sign in now.
              </p>
              <Button
                className="mt-7"
                size="lg"
                fullWidth
                onClick={() => navigate('/auth', { replace: true })}
              >
                Continue to sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
