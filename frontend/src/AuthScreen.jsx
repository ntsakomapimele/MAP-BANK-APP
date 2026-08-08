import { useState } from 'react';
import {
  Landmark,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Send,
  TrendingUp,
  Wallet,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from './AuthContext';

// DRF validation errors can show up as {field: ["msg", ...]} or {detail: "msg"}.
// Flatten whatever shape comes back into a single readable string.
function extractErrorMessage(err) {
  const data = err?.response?.data;
  if (!data) return 'Something went wrong. Please try again.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  const messages = [];
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val)) messages.push(...val);
    else if (typeof val === 'string') messages.push(val);
  }
  return messages.length > 0 ? messages.join(' ') : 'Something went wrong. Please try again.';
}

function Field({ label, delay, children }) {
  return (
    <div className="animate-fade-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full p-2.5 border border-gray-200 rounded-lg bg-white/70 transition-all duration-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white focus:outline-none focus:-translate-y-0.5';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    id_number: '',
  });

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.username, form.password);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Branding / aurora panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-mint-600 animate-aurora">
        <div className="absolute inset-0 bg-noise opacity-40" />

        {/* Floating gradient blobs */}
        <div className="absolute -top-16 -left-10 w-72 h-72 bg-white/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-16 w-80 h-80 bg-mint-400/30 rounded-full blur-3xl animate-blob-delay" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-brand-300/30 rounded-full blur-3xl animate-blob-delay-2" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3 animate-fade-slide-down">
            <div className="bg-white/15 backdrop-blur-sm border border-white/20 p-3 rounded-2xl animate-logo-pulse">
              <Landmark className="w-6 h-6" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">MAP Bank</span>
          </div>

          <div className="space-y-6 animate-fade-slide-up" style={{ animationDelay: '120ms' }}>
            <h2 className="font-display text-4xl font-semibold leading-tight max-w-md">
              Banking that moves as fast as you do.
            </h2>
            <p className="text-white/75 max-w-sm">
              Real-time balances, instant transfers, and a clear view of every rand in and out —
              all in one place.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              {[
                { icon: TrendingUp, label: 'Track balances in real time', delay: 0 },
                { icon: Send, label: 'Send money in a couple of taps', delay: 120 },
                { icon: ShieldCheck, label: 'Secured, token-based sign-in', delay: 240 },
              ].map(({ icon: Icon, label, delay }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 bg-white/10 border border-white/15 backdrop-blur-sm rounded-xl px-4 py-3 w-fit animate-fade-slide-right"
                  style={{ animationDelay: `${300 + delay}ms` }}
                >
                  <span
                    className="p-1.5 bg-white/15 rounded-lg animate-gentle-bounce"
                    style={{ animationDelay: `${delay}ms`, '--tilt': '0deg' }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-sm text-white/90">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/50 animate-fade-in" style={{ animationDelay: '600ms' }}>
            © {new Date().getFullYear()} MAP Bank. A demo banking experience.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle ambient blobs on the form side too, kept faint */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-200/40 rounded-full blur-3xl animate-blob pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-mint-400/20 rounded-full blur-3xl animate-blob-delay pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="flex flex-col items-center mb-6 lg:hidden animate-fade-slide-down">
            <div className="bg-gradient-to-br from-brand-600 to-mint-600 text-white p-3 rounded-2xl mb-3 animate-logo-pulse">
              <Landmark className="w-7 h-7" />
            </div>
            <h1 className="font-display text-2xl font-bold text-gray-800">MAP Bank</h1>
          </div>

          <div className="hidden lg:block mb-6 animate-fade-slide-down">
            <h1 className="font-display text-2xl font-bold text-gray-800">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {mode === 'login' ? 'Sign in to your account' : 'Takes less than a minute'}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl shadow-brand-900/5 border border-white space-y-4 animate-scale-in">
            <p className="text-sm text-gray-500 text-center lg:hidden">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </p>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-start gap-2 animate-fade-slide-down">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form key={mode} onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" delay={0}>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={update('first_name')}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last name" delay={40}>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={update('last_name')}
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}

              <Field label="Username" delay={mode === 'register' ? 80 : 0}>
                <input
                  type="text"
                  required
                  value={form.username}
                  onChange={update('username')}
                  className={inputClass}
                  autoComplete="username"
                />
              </Field>

              {mode === 'register' && (
                <>
                  <Field label="Email" delay={120}>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={update('email')}
                      className={inputClass}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Phone" delay={160}>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={update('phone')}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="ID number" delay={200}>
                    <input
                      type="text"
                      required
                      value={form.id_number}
                      onChange={update('id_number')}
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              <Field label="Password" delay={mode === 'register' ? 200 : 40}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={update('password')}
                    className={`${inputClass} pr-10`}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-600 transition-all duration-200 hover:scale-110"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'register' && (
                  <p className="text-xs text-gray-400 mt-1">At least 8 characters, not too common or predictable.</p>
                )}
              </Field>

              <button
                type="submit"
                disabled={loading}
                className="group w-full py-3 bg-gradient-to-r from-brand-600 to-mint-600 bg-[length:180%_100%] bg-left hover:bg-right disabled:from-brand-300 disabled:to-brand-300 text-white font-medium rounded-lg transition-all duration-500 flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-brand-600/20 animate-fade-slide-up"
                style={{ animationDelay: `${mode === 'register' ? 240 : 80}ms` }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                )}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="text-sm text-center text-gray-500 animate-fade-in" style={{ animationDelay: '300ms' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button onClick={switchMode} className="text-brand-600 font-medium hover:underline underline-offset-2">
                {mode === 'login' ? 'Register' : 'Sign in'}
              </button>
            </p>
          </div>

          <div
            className="hidden lg:flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-5 animate-fade-in"
            style={{ animationDelay: '450ms' }}
          >
            <Wallet className="w-3.5 h-3.5" />
            Your money, always within reach.
          </div>
        </div>
      </div>
    </div>
  );
}
