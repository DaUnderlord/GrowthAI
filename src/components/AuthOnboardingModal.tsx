import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import {
  registerUser,
  loginWithEmail,
  loginWithGoogle,
  resetPasswordForEmail,
  isSupabaseConfigured,
} from '../lib/supabase';
import { BrandMark } from './BrandIcons';

interface AuthOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUser: UserProfile;
  isAuthenticated: boolean;
  onLogin: (user: UserProfile) => void;
  onRegisterUser?: (newUser: UserProfile) => void;
  initialMode?: 'signin' | 'forgot' | 'wizard';
}

const GOALS = [
  { id: 'lead_gen', label: 'Lead generation' },
  { id: 'viral_reach', label: 'Reach & awareness' },
  { id: 'sales', label: 'Sales conversion' },
  { id: 'automation', label: 'Team automation' },
];

const INDUSTRIES = [
  { id: 'saas', label: 'SaaS / Tech' },
  { id: 'fmcg', label: 'FMCG' },
  { id: 'education', label: 'Education' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'sme', label: 'Local SME' },
];

export const AuthOnboardingModal: React.FC<AuthOnboardingModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  onLogin,
  onRegisterUser,
  initialMode = 'signin',
}) => {
  const [viewMode, setViewMode] = useState<'signin' | 'forgot' | 'wizard'>(initialMode);
  const [wizardStep, setWizardStep] = useState(1);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [teamSize, setTeamSize] = useState('6-20');
  const [regRole] = useState<UserRole>('admin');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['lead_gen']);
  const [selectedIndustry, setSelectedIndustry] = useState('saas');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setViewMode(initialMode);
      setWizardStep(1);
      setAnalysisProgress(0);
      setAnalysisComplete(false);
      setForgotSent(false);
      setLoginError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (viewMode !== 'wizard' || wizardStep !== 4 || analysisComplete) return;
    setAnalysisProgress(12);
    const t1 = setTimeout(() => setAnalysisProgress(42), 700);
    const t2 = setTimeout(() => setAnalysisProgress(78), 1400);
    const t3 = setTimeout(() => {
      setAnalysisProgress(100);
      setAnalysisComplete(true);
    }, 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [viewMode, wizardStep, analysisComplete]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const userProfile = await loginWithEmail(loginEmail.trim(), loginPassword);
      onLogin(userProfile);
      onClose();
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const userProfile = await loginWithGoogle();
      onLogin(userProfile);
      onClose();
    } catch (err: any) {
      if (String(err?.message || '').includes('Redirecting to Google')) return;
      setLoginError(err.message || 'Google sign in failed.');
      setIsSubmitting(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoginError(null);
    setIsSubmitting(true);
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      setForgotSent(true);
      setResetSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      setLoginError(err.message || 'Could not send reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishWizard = async () => {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const newUser = await registerUser(
        regEmail.trim(),
        regPassword,
        regFullName.trim() || 'Agency Leader',
        regPhone,
        agencyName.trim() || 'Growth Agency',
        regRole,
        undefined,
        { industry: selectedIndustry, goals: selectedGoals }
      );
      onRegisterUser?.(newUser);
      onLogin(newUser);
      onClose();
    } catch (err: any) {
      setLoginError(err.message || 'Registration failed.');
      setWizardStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((g) => g !== id) : prev) : [...prev, id]
    );
  };

  const stepTitle =
    wizardStep === 1
      ? 'Create your account'
      : wizardStep === 2
        ? 'Your agency'
        : wizardStep === 3
          ? 'Focus areas'
          : 'Preparing workspace';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[#070b12]/90 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <div className="relative flex h-full w-full max-w-5xl overflow-hidden bg-[#0a1018] sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-white/[0.08]">
        {/* Atmospheric panel */}
        <div className="relative hidden w-[42%] overflow-hidden md:block">
          <img src="/brand/splash-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/55 to-transparent" />
          <div className="relative z-10 flex h-full flex-col justify-end p-8">
            <BrandMark className="h-12 w-12 rounded-xl" />
            <h2 className="font-display mt-6 text-3xl font-medium text-white">Growth that stays calm</h2>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
              Campaigns, content, and insight — without the dashboard noise.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:p-8">
          {isAuthenticated && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.04] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="mb-8 flex items-center gap-3 md:hidden">
            <BrandMark className="h-9 w-9" />
            <span className="font-display text-xl text-white">GrowthOS</span>
          </div>

          {!isSupabaseConfigured() && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Supabase is not configured for this deployment. In Vercel, add{' '}
              <code className="text-amber-50">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-amber-50">VITE_SUPABASE_ANON_KEY</code> (or{' '}
              <code className="text-amber-50">SUPABASE_URL</code> +{' '}
              <code className="text-amber-50">SUPABASE_ANON_KEY</code>), then redeploy.
            </div>
          )}

          {loginError && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {loginError}
            </div>
          )}

          {viewMode === 'signin' && (
            <div className="fade-rise mx-auto w-full max-w-md space-y-6">
              <div>
                <h3 className="font-display text-3xl font-medium text-white">Welcome back</h3>
                <p className="mt-2 text-sm text-slate-400">Sign in to your agency workspace.</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">Email</span>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                    placeholder="you@agency.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">Password</span>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-slate-500"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <div className="flex justify-end">
                  <button type="button" onClick={() => setViewMode('forgot')} className="text-link text-xs">
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isSubmitting} className="primary-button w-full justify-center">
                  {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Sign in'}
                </button>
              </form>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="secondary-button w-full justify-center"
              >
                Continue with Google
              </button>

              <p className="text-center text-xs text-slate-500">
                New here?{' '}
                <button type="button" onClick={() => setViewMode('wizard')} className="text-link">
                  Create workspace
                </button>
              </p>
            </div>
          )}

          {viewMode === 'forgot' && (
            <div className="fade-rise mx-auto w-full max-w-md space-y-6">
              <div>
                <h3 className="font-display text-3xl font-medium text-white">Reset password</h3>
                <p className="mt-2 text-sm text-slate-400">
                  We&apos;ll email you a secure Supabase reset link.
                </p>
              </div>

              {resetSuccessMessage && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {resetSuccessMessage}
                </div>
              )}

              {!forgotSent ? (
                <form onSubmit={handleSendReset} className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs text-slate-500">Work email</span>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                    />
                  </label>
                  <button type="submit" disabled={isSubmitting} className="primary-button w-full justify-center">
                    {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setViewMode('signin')} className="primary-button w-full justify-center">
                  Back to sign in
                </button>
              )}

              <button type="button" onClick={() => setViewMode('signin')} className="text-link mx-auto block text-xs">
                ← Return to sign in
              </button>
            </div>
          )}

          {viewMode === 'wizard' && (
            <div className="fade-rise mx-auto w-full max-w-md space-y-6">
              <div>
                <p className="eyebrow-label">
                  Step {wizardStep} of 4
                </p>
                <h3 className="font-display mt-2 text-3xl font-medium text-white">{stepTitle}</h3>
              </div>

              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-500"
                  style={{ width: `${(wizardStep / 4) * 100}%` }}
                />
              </div>

              {wizardStep === 1 && (
                <div className="space-y-3">
                  <input
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Work email"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Password (min 6 characters)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  />
                  <input
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  />
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-3">
                  <input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Agency name"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  />
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-white outline-none focus:border-[color:var(--accent)]"
                  >
                    <option value="1-5">1–5 people</option>
                    <option value="6-20">6–20 people</option>
                    <option value="21-50">21–50 people</option>
                    <option value="50+">50+ people</option>
                  </select>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs text-slate-500">Goals</p>
                    <div className="flex flex-wrap gap-2">
                      {GOALS.map((g) => {
                        const active = selectedGoals.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleGoal(g.id)}
                            className={`rounded-full px-3 py-1.5 text-xs transition ${
                              active
                                ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/40'
                                : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/10'
                            }`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-slate-500">Industry</p>
                    <div className="grid grid-cols-2 gap-2">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => setSelectedIndustry(ind.id)}
                          className={`rounded-xl px-3 py-2.5 text-left text-xs transition ${
                            selectedIndustry === ind.id
                              ? 'bg-[color:var(--accent-soft)] text-white ring-1 ring-[color:var(--accent)]/40'
                              : 'bg-white/[0.03] text-slate-400 ring-1 ring-white/10'
                          }`}
                        >
                          {ind.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4 py-4 text-center">
                  <p className="font-display text-2xl text-white">
                    {analysisComplete ? 'Workspace ready' : 'Setting things up'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {analysisComplete
                      ? 'Your GrowthOS workspace is ready to open.'
                      : 'Calibrating goals and industry focus…'}
                  </p>
                  <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-500"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                {wizardStep > 1 && wizardStep < 4 ? (
                  <button type="button" onClick={() => setWizardStep((s) => s - 1)} className="secondary-button">
                    Back
                  </button>
                ) : (
                  <button type="button" onClick={() => setViewMode('signin')} className="text-link text-xs">
                    Sign in instead
                  </button>
                )}

                {wizardStep < 4 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1 && (!regEmail.trim() || regPassword.length < 6)) {
                        setLoginError('Enter a valid email and password (min 6 characters).');
                        return;
                      }
                      setLoginError(null);
                      setWizardStep((s) => s + 1);
                    }}
                    className="primary-button"
                  >
                    Continue
                  </button>
                )}

                {wizardStep === 4 && analysisComplete && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinishWizard}
                    className="primary-button"
                  >
                    {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Enter GrowthOS'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
