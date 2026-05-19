import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Users, Copy, Plus, Trash2, Shield } from 'lucide-react';

interface TeamDetail {
  id: string;
  name: string;
  timezone: string;
  logo_url: string | null;
  userRole: string;
  memberCount: number;
  projectCount: number;
  taskStats: Array<{ status: string; count: number }>;
}

interface Member {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  last_active: string | null;
}

interface MemberResponse {
  data: Member[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const { data: team } = useQuery<TeamDetail>({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const res = await api.get(`/teams/${teamId}`);
      return res.data;
    },
    enabled: !!teamId,
  });

  const { data: membersData } = useQuery<MemberResponse>({
    queryKey: ['team-members', teamId, search, roleFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await api.get(`/teams/${teamId}/members?${params}`);
      return res.data;
    },
    enabled: !!teamId,
  });

  const inviteMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await api.post(`/teams/${teamId}/invite`, { role });
      return res.data;
    },
    onSuccess: (data) => {
      setInviteToken(data.token);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/teams/${teamId}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });

  const canManageMembers = team?.userRole === 'owner' || team?.userRole === 'admin';

  return (
    <div className="space-y-6">
      {/* Team header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team?.name}</h1>
            <p className="text-gray-500 mt-1">Timezone: {team?.timezone}</p>
          </div>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={18} />
              Invite Member
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Members</p>
            <p className="text-2xl font-bold text-gray-900">{team?.memberCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Projects</p>
            <p className="text-2xl font-bold text-gray-900">{team?.projectCount}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">Tasks</p>
            <p className="text-2xl font-bold text-gray-900">
              {team?.taskStats?.reduce((sum, s) => sum + s.count, 0) || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Invite dialog */}
      {showInviteDialog && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Invite Members</h3>
          {inviteToken ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Share this invitation token:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm break-all">
                  {inviteToken}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(inviteToken)}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <Copy size={18} />
                </button>
              </div>
              <button
                onClick={() => {
                  setInviteToken(null);
                  setShowInviteDialog(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {['member', 'admin', 'viewer'].map((role) => (
                <button
                  key={role}
                  onClick={() => inviteMutation.mutate(role)}
                  disabled={inviteMutation.isPending}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 capitalize"
                >
                  Invite as {role}
                </button>
              ))}
              <button
                onClick={() => setShowInviteDialog(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            <Users className="inline mr-2" size={20} />
            Members
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {membersData?.data.map((member) => (
            <div key={member.user_id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <Shield size={12} />
                  {member.role}
                </span>
                {canManageMembers && member.role !== 'owner' && (
                  <button
                    onClick={() => removeMemberMutation.mutate(member.user_id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {membersData?.pagination && membersData.pagination.totalPages > 1 && (
          <div className="mt-4 text-sm text-gray-500 text-center">
            Page {membersData.pagination.page} of {membersData.pagination.totalPages}
          </div>
        )}
      </div>
    </div>
  );
}
