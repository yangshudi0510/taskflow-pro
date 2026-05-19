import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/auth';
import api from '../lib/api';
import { Trash2, Monitor } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().optional(),
});

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Old password is required'),
  new_password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain special character'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

interface UserSettings {
  email_notification: string;
  websocket_enabled: boolean;
  default_sort: string;
  theme: string;
  privacy_mode: boolean;
}

interface SessionItem {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_used: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications' | 'sessions'>('profile');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      const res = await api.put('/me', data);
      return res.data;
    },
    onSuccess: () => {
      setProfileMsg('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // Password form
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  const passwordMutation = useMutation({
    mutationFn: async (data: { old_password: string; new_password: string }) => {
      await api.put('/me/password', data);
    },
    onSuccess: () => {
      setPasswordMsg('Password changed successfully');
      passwordForm.reset();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setPasswordMsg(axiosErr.response?.data?.error || 'Failed to change password');
    },
  });

  // Settings
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get('/me/settings');
      return res.data;
    },
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      await api.put('/me/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  // Sessions
  const { data: sessions } = useQuery<SessionItem[]>({
    queryKey: ['sessions'],
    queryFn: async () => {
      const res = await api.get('/me/sessions');
      return res.data;
    },
    enabled: tab === 'sessions',
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/me/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200">
        {(['profile', 'password', 'notifications', 'sessions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <form
          className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
          onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))}
        >
          {profileMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {profileMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              {...profileForm.register('name')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              value={user?.email || ''}
              disabled
              className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <button
            type="submit"
            disabled={profileMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save Changes
          </button>
        </form>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <form
          className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
          onSubmit={passwordForm.handleSubmit((data) =>
            passwordMutation.mutate({ old_password: data.old_password, new_password: data.new_password })
          )}
        >
          {passwordMsg && (
            <div className={`px-4 py-3 rounded-lg border ${
              passwordMsg.includes('success')
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {passwordMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Current Password</label>
            <input
              type="password"
              {...passwordForm.register('old_password')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {passwordForm.formState.errors.old_password && (
              <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.old_password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              {...passwordForm.register('new_password')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {passwordForm.formState.errors.new_password && (
              <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.new_password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
            <input
              type="password"
              {...passwordForm.register('confirm_password')}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {passwordForm.formState.errors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{passwordForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={passwordMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Change Password
          </button>
        </form>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && settings && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Notifications</label>
            <select
              value={settings.email_notification}
              onChange={(e) => settingsMutation.mutate({ email_notification: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="realtime">Real-time</option>
              <option value="daily">Daily digest</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">WebSocket Push Notifications</p>
              <p className="text-sm text-gray-500">Receive real-time updates</p>
            </div>
            <button
              onClick={() => settingsMutation.mutate({ websocket_enabled: !settings.websocket_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                settings.websocket_enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  settings.websocket_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Default Sort</label>
            <select
              value={settings.default_sort}
              onChange={(e) => settingsMutation.mutate({ default_sort: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="priority">Priority</option>
              <option value="due_date">Due Date</option>
              <option value="created_at">Created At</option>
            </select>
          </div>
        </div>
      )}

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
          <div className="space-y-3">
            {sessions?.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Monitor size={20} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {session.user_agent?.substring(0, 60) || 'Unknown device'}
                    </p>
                    <p className="text-xs text-gray-500">
                      IP: {session.ip_address || 'Unknown'} • Last used:{' '}
                      {new Date(session.last_used).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeSessionMutation.mutate(session.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Revoke session"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
