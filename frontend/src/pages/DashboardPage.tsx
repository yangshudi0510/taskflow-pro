import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Users, FolderKanban } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  role: string;
  memberCount: number;
  projectCount: number;
}

export default function DashboardPage() {
  const { data: teams, isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await api.get('/teams');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition"
          >
            <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
            <p className="text-sm text-gray-500 mt-1">Role: {team.role}</p>
            <div className="mt-4 flex gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users size={16} />
                <span>{team.memberCount} members</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FolderKanban size={16} />
                <span>{team.projectCount} projects</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(!teams || teams.length === 0) && (
        <div className="text-center py-12">
          <p className="text-gray-500">No teams yet. Create your first team to get started!</p>
        </div>
      )}
    </div>
  );
}
