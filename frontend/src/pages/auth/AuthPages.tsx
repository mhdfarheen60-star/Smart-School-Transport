import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { gradientStyle, LogoMark } from '../../components/brand';
import { homeFor, useAuth } from '../../context/AuthContext';
import { parseError } from '../../services/api';
import { Button, Field } from '../../components/ui';
import type { Role } from '../../types';

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen items-stretch">
      <div className="hidden w-1/2 flex-col justify-between p-12 text-white lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="h-8 w-8" />
          <span className="text-lg font-semibold">Smart School Transport</span>
        </Link>
        <div>
          <h2 className="text-5xl font-semibold leading-[0.95] tracking-tight">
            Safer journeys.
            <span className="block animate-shiny" style={gradientStyle}>
              Revitalized
            </span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-[1.5] text-white/60">
            Bus assignments, routes, pickup and drop-off tracking, and instant updates — for students, drivers and
            school management in one place.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-white/50">
            <ShieldCheck className="h-4 w-4" /> Role-based access · Encrypted credentials
          </div>
        </div>
        <div className="text-xs text-white/40">Developed by Muhammed Farheen P K</div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="liquid-glass w-full max-w-md rounded-3xl bg-black/40 p-8 backdrop-blur-2xl"
        >
          <Link to="/" className="mb-6 flex items-center gap-2 lg:hidden">
            <LogoMark className="h-7 w-7" />
            <span className="font-semibold">Smart School Transport</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 text-center text-sm text-white/50">{footer}</div>
        </motion.div>
      </div>
    </div>
  );
}

export function LoginPage({ portal }: { portal?: Role }) {
  const { login, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const label = portal === 'admin' ? 'Administrator' : portal === 'driver' ? 'Driver' : 'Student';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Enter your email and password');
    setLoading(true);
    setError('');
    try {
      const u = await login(email.trim(), password);
      if (portal && u.role !== portal) {
        logout();
        setError(`This account is not a ${label.toLowerCase()} account. Use the correct portal.`);
        return;
      }
      const from = (loc.state as any)?.from as string | undefined;
      nav(from && from.startsWith(`/${u.role}`) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell
      title={`${label} sign in`}
      subtitle="Enter your credentials to continue."
      footer={
        <div className="space-y-1">
          {(!portal || portal === 'student') && (
            <div>
              New student? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link>
            </div>
          )}
          <div className="flex justify-center gap-3 text-xs">
            {portal !== undefined && portal !== 'student' && <Link to="/login" className="hover:underline">Student login</Link>}
            {portal !== 'driver' && <Link to="/driver/login" className="hover:underline">Driver login</Link>}
            {portal !== 'admin' && <Link to="/admin/login" className="hover:underline">Admin login</Link>}
          </div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <Field label="Email">
          <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [v, setV] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const required: [string, string][] = [
    ['name', 'Full name'],
    ['studentId', 'Student ID'],
    ['className', 'Class'],
    ['division', 'Division'],
    ['address', 'Address'],
    ['phone', 'Contact number'],
    ['parentPhone', 'Parent contact'],
    ['email', 'Email'],
    ['password', 'Password'],
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    for (const [k, l] of required) if (!v[k]?.trim()) errs[k] = `${l} is required`;
    if (v.password && (v.password.length < 8 || !/\d/.test(v.password) || !/[A-Za-z]/.test(v.password))) {
      errs.password = 'Use at least 8 characters with letters and numbers';
    }
    if (v.password !== v.confirm) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    setFormError('');
    try {
      const { confirm: _c, ...payload } = v;
      await register(payload);
      nav('/student', { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      setFormError(p.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = (k: string, label: string, type = 'text', hint?: string) => (
    <Field label={label} error={errors[k]} hint={hint} required>
      <input className={`input ${errors[k] ? 'input-error' : ''}`} type={type} value={v[k] || ''} onChange={set(k)} autoComplete="off" />
    </Field>
  );

  return (
    <Shell
      title="Student registration"
      subtitle="Create your account to request school transport."
      footer={
        <>
          Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3" noValidate>
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {formError}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {inp('name', 'Full name')}
          {inp('studentId', 'Student ID')}
          {inp('className', 'Class')}
          {inp('division', 'Division')}
          {inp('phone', 'Contact number', 'tel')}
          {inp('parentName', 'Parent name')}
          {inp('parentPhone', 'Parent contact', 'tel')}
          {inp('email', 'Email', 'email')}
        </div>
        <Field label="Address" error={errors.address} required>
          <textarea className={`input ${errors.address ? 'input-error' : ''}`} rows={2} value={v.address || ''} onChange={set('address')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {inp('password', 'Password', 'password', 'Min 8 chars, letters + numbers')}
          {inp('confirm', 'Confirm password', 'password')}
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </Shell>
  );
}
