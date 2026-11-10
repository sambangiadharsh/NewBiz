import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Check,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShoppingBag,
  ShieldCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { paymentsApi, PaymentVerificationResult } from '../lib/ordersApi';

// Poll every 5s, stop after 2.5 minutes (30 attempts) or on terminal status
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 30;

// Lightweight Pure Canvas Confetti (Zero external dependencies)
function triggerConfetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const count = 120;
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    vRot: number;
    alpha: number;
  }> = [];

  const colors = ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6'];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 160,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 12 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      alpha: 1,
    });
  }

  let animationFrameId: number;
  let startTime = Date.now();

  const render = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > 3500) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // drag
      p.rotation += p.vRot;
      p.alpha = Math.max(0, 1 - elapsed / 3500);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });

    animationFrameId = requestAnimationFrame(render);
  };

  animationFrameId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(animationFrameId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get('orderId') || '';
  const txnId = searchParams.get('txnId') || '';
  const customerId = searchParams.get('customerId') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [result, setResult] = useState<PaymentVerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [retrying, setRetrying] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Polling state
  const [pollCount, setPollCount] = useState<number>(0);
  const [nextPollIn, setNextPollIn] = useState<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasTriggeredConfetti = useRef<boolean>(false);

  const clearTimers = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setNextPollIn(seconds);
    countdownRef.current = setInterval(() => {
      setNextPollIn((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const verifyOnce = useCallback(async (attempt: number): Promise<boolean> => {
    try {
      const res = await paymentsApi.verifyPayment(orderId, txnId || undefined, customerId || undefined);
      if (!isMountedRef.current) return true;
      setResult(res);
      setLoading(false);
      setPollCount(attempt);
      if (res.status === 'SUCCESS' || res.status === 'FAILED') return true;
      return false;
    } catch (err: any) {
      if (!isMountedRef.current) return true;
      setLoading(false);
      setErrorMsg(err.message || 'Payment verification failed');
      return false;
    }
  }, [orderId, txnId, customerId]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setErrorMsg('No order ID provided in payment return URL.');
      return;
    }

    isMountedRef.current = true;

    const poll = async (attempt: number) => {
      if (!isMountedRef.current) return;
      setPollCount(attempt);
      if (attempt === 1) setLoading(true);

      const done = await verifyOnce(attempt);
      if (done || !isMountedRef.current) return;

      if (attempt < MAX_POLLS) {
        startCountdown(POLL_INTERVAL_MS / 1000);
        pollTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) poll(attempt + 1);
        }, POLL_INTERVAL_MS);
      } else {
        if (isMountedRef.current) {
          setResult({ status: 'PENDING', orderId, message: 'Still processing. Please check again in a moment.' });
          setLoading(false);
        }
      }
    };

    poll(1);

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [orderId, txnId, verifyOnce]);

  // Trigger celebration confetti on success
  useEffect(() => {
    if (result?.status === 'SUCCESS' && !hasTriggeredConfetti.current && confettiCanvasRef.current) {
      hasTriggeredConfetti.current = true;
      triggerConfetti(confettiCanvasRef.current);
    }
  }, [result]);

  const handleManualCheck = async () => {
    clearTimers();
    setLoading(true);
    setResult(null);
    setErrorMsg('');
    const done = await verifyOnce(pollCount + 1);
    if (!done && isMountedRef.current) {
      startCountdown(POLL_INTERVAL_MS / 1000);
      pollTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) verifyOnce(pollCount + 2);
      }, POLL_INTERVAL_MS);
    }
  };

  const handleRetryPayment = async () => {
    if (!orderId) return;
    try {
      setRetrying(true);
      const session = await paymentsApi.retryPayment(orderId);
      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl;
      } else {
        throw new Error('No checkout URL received for payment retry.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to retry payment. Please try again.');
      setRetrying(false);
    }
  };

  const handleCopyOrderNumber = () => {
    const textToCopy = result?.orderNumber || orderId;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 overflow-hidden bg-slate-50/70 text-slate-900">
      {/* Full-screen Confetti Canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="pointer-events-none fixed inset-0 z-50 w-full h-full"
      />

      <div className="relative z-10 w-full max-w-md">

        {/* ────────── 1. LOADING / VERIFYING STATE ────────── */}
        {loading && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xl shadow-slate-200/40 space-y-6">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary-100 animate-ping opacity-40" />
              <div className="w-16 h-16 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-500/25">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                PhonePe Secure Handshake
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verifying Payment</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Confirming transaction status with PhonePe. Please hold on...
              </p>
            </div>
          </div>
        )}

        {/* ────────── 2. ERROR STATE ────────── */}
        {!loading && errorMsg && !result && (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-10 text-center shadow-xl shadow-slate-200/40 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verification Error</h2>
              <p className="text-xs text-rose-600 font-medium max-w-xs mx-auto">{errorMsg}</p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleManualCheck}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200"
              >
                Check Again
              </button>
              <Link
                to="/profile"
                className="flex-1 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-primary-500/20"
              >
                View Orders
              </Link>
            </div>
          </div>
        )}

        {/* ────────── 3. SUCCESS / CONFIRMED STATE (CLEAN LIGHT THEME) ────────── */}
        {!loading && result && result.status === 'SUCCESS' && (
          <div className="bg-white rounded-3xl border border-emerald-200/80 p-8 sm:p-10 text-center shadow-xl shadow-emerald-500/10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Glowing Success Icon */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-40" />
              <div className="relative w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-100">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>
            </div>

            {/* Header Text */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[11px] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Payment Confirmed
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Order Confirmed!</h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Thank you! Your payment via PhonePe was successful and your order is in progress.
              </p>
            </div>

            {/* Minimal Digital Receipt Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Order ID</span>
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-900 transition-all active:scale-95 shadow-xs"
                  title="Click to copy"
                >
                  <span>{result.orderNumber || `#${orderId}`}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>PhonePe Verified</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Secured
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                to="/profile"
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold text-center transition-all"
              >
                View Orders
              </Link>
              <Link
                to="/"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs text-center shadow-md shadow-primary-500/20 active:scale-[0.99] transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Continue Shopping</span>
              </Link>
            </div>

          </div>
        )}

        {/* ────────── 4. PAYMENT FAILED / DECLINED ────────── */}
        {!loading && result && result.status === 'FAILED' && (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-10 text-center shadow-xl shadow-slate-200/40 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <XCircle className="w-9 h-9 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-700 font-extrabold text-[11px] uppercase tracking-wider border border-rose-200">
                Payment Not Completed
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Transaction Declined</h2>
              <p className="text-xs text-rose-600 max-w-xs mx-auto">
                {result.failureReason || 'Your bank or PhonePe was unable to authorize the charge.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRetryPayment}
                disabled={retrying}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'Redirecting to PhonePe...' : 'Retry Payment Now'}</span>
              </button>

              <Link
                to="/profile"
                className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold text-center transition-all"
              >
                Go to My Orders
              </Link>
            </div>
          </div>
        )}

        {/* ────────── 5. AWAITING BANK CONFIRMATION (POLLING) ────────── */}
        {!loading && result && result.status === 'PENDING' && (
          <div className="bg-white rounded-3xl border border-amber-200 p-8 sm:p-10 text-center shadow-xl shadow-slate-200/40 space-y-6">
            
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-40" />
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-extrabold text-[11px] uppercase tracking-wider border border-amber-200">
                Awaiting Bank Confirmation
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Processing Payment</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Updating automatically once PhonePe verifies your bank transfer.
              </p>
            </div>

            {/* Live countdown pill */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
              {nextPollIn > 0 ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Checking again in <span className="font-mono font-black tabular-nums text-amber-900">{nextPollIn}s</span></span>
                </>
              ) : (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Checking now...</span>
                </>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleManualCheck}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Check Now
              </button>
              <Link
                to="/profile"
                className="flex-1 py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs text-center transition-all shadow-md shadow-primary-500/20"
              >
                View in Orders
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
