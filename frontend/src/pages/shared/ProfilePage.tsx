import { FormEvent, useState } from 'react';
import { Button, Field, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { parseError, post } from '../../services/api';

export function ProfileForm() {
  const { user, profile, updateProfile } = useAuth();
  const toast = useToast();
  const isStudent = user!.role === 'student';
  const [v, setV] = useState({
    name: user!.name || '',
    phone: user!.phone || profile?.phone || '',
    address: profile?.address || '',
    parentName: profile?.parentName || '',
    parentPhone: profile?.parentPhone || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = 'Name is required';
    if (!v.phone.trim()) errs.phone = 'Phone is required';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { name: v.name, phone: v.phone };
      if (user!.role !== 'admin' && v.address) payload.address = v.address;
      if (isStudent) {
        if (v.parentName) payload.parentName = v.parentName;
        if (v.parentPhone) payload.parentPhone = v.parentPhone;
      }
      await updateProfile(payload);
      toast.success('Profile updated');
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
      <h2 className="text-base font-semibold text-navy-900">Personal details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" error={errors.name} required>
          <input className="input" value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Email" hint="Contact the administrator to change your email">
          <input className="input" value={user!.email} disabled />
        </Field>
        <Field label="Phone" error={errors.phone} required>
          <input className="input" value={v.phone} onChange={set('phone')} />
        </Field>
        {isStudent && (
          <>
            <Field label="Student ID">
              <input className="input" value={profile?.studentId || ''} disabled />
            </Field>
            <Field label="Class / Division">
              <input className="input" value={`${profile?.className || ''} ${profile?.division || ''}`} disabled />
            </Field>
            <Field label="Parent name">
              <input className="input" value={v.parentName} onChange={set('parentName')} />
            </Field>
            <Field label="Parent contact" error={errors.parentPhone}>
              <input className="input" value={v.parentPhone} onChange={set('parentPhone')} />
            </Field>
          </>
        )}
        {user!.role === 'driver' && (
          <Field label="License number">
            <input className="input" value={profile?.licenseNumber || ''} disabled />
          </Field>
        )}
        {user!.role !== 'admin' && (
          <div className="sm:col-span-2">
            <Field label="Address" error={errors.address}>
              <textarea className="input" rows={2} value={v.address} onChange={set('address')} />
            </Field>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save changes</Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (v.newPassword !== v.confirm) return setErr('New passwords do not match');
    if (v.newPassword.length < 8 || !/\d/.test(v.newPassword) || !/[A-Za-z]/.test(v.newPassword)) {
      return setErr('Use at least 8 characters with letters and numbers');
    }
    setSaving(true);
    try {
      await post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      toast.success('Password changed');
      setV({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e2) {
      setErr(parseError(e2).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="text-base font-semibold text-navy-900">Change password</h2>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Current password">
          <input className="input" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />
        </Field>
        <Field label="New password">
          <input className="input" type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirm new password">
          <input className="input" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Update password</Button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" subtitle="Manage your personal information and security." />
      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
      </div>
    </>
  );
}
