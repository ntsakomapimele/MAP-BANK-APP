import React, { useState } from 'react';
import { Loader2, User } from 'lucide-react';

export default function Profile({
  user,
  displayName,
  profileForm,
  setProfileForm,
  profileSubmitting,
  handleProfileSubmit,
  passwordForm,
  setPasswordForm,
  passwordSubmitting,
  handlePasswordSubmit,
}) {
  const [errors, setErrors] = useState({});

  const handleLocalProfileSubmit = (e) => {
    e.preventDefault();
    const next = {};
    const id = profileForm.id_number || '';
    const phone = profileForm.phone || '';

    if (!/^[0-9]{13}$/.test(id)) {
      next.id_number = 'ID number must contain exactly 13 digits.';
    }
    if (!/^[0-9]{10}$/.test(phone)) {
      next.phone = 'Phone number must contain exactly 10 digits.';
    }

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    // Pass through to parent handler
    handleProfileSubmit(e);
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm animate-fade-slide-up" style={{ animationDelay: '140ms' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Profile Settings</h2>
          <p className="text-sm text-gray-500">Update your profile info and password from one place.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600">
          <User className="w-4 h-4" />
          {displayName || user?.email}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleLocalProfileSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-gray-700">
              <span className="text-xs uppercase tracking-[0.18em]">First name</span>
              <input
                value={profileForm.first_name}
                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block text-sm text-gray-700">
              <span className="text-xs uppercase tracking-[0.18em]">Last name</span>
              <input
                value={profileForm.last_name}
                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </label>
          </div>

          <label className="block text-sm text-gray-700">
            <span className="text-xs uppercase tracking-[0.18em]">Email</span>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block text-sm text-gray-700">
            <span className="text-xs uppercase tracking-[0.18em]">Phone</span>
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                errors.phone ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:border-brand-500'
              }`}
              required
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
          </label>

          <label className="block text-sm text-gray-700">
            <span className="text-xs uppercase tracking-[0.18em]">ID number</span>
            <input
              value={profileForm.id_number}
              onChange={(e) => setProfileForm({ ...profileForm, id_number: e.target.value })}
              className={`mt-2 w-full rounded-xl border px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                errors.id_number ? 'border-red-300 focus:ring-red-100' : 'border-gray-200 focus:border-brand-500'
              }`}
              required
            />
            {errors.id_number && <p className="mt-1 text-xs text-red-600">{errors.id_number}</p>}
          </label>

          <button
            type="submit"
            disabled={profileSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {profileSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">Change Password</h3>
            <p className="text-sm text-gray-500">Update your password to keep your account secure.</p>
          </div>

          <label className="block text-sm text-gray-700">
            <span className="text-xs uppercase tracking-[0.18em]">Current password</span>
            <input
              type="password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <label className="block text-sm text-gray-700">
            <span className="text-xs uppercase tracking-[0.18em]">New password</span>
            <input
              type="password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              required
            />
          </label>

          <button
            type="submit"
            disabled={passwordSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            {passwordSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
