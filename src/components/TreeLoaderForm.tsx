// components/ProjectTreeLoader.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Search, AlertCircle } from 'lucide-react';

const fetchProjectData = async (site: string, project: string) => {
  const res = await fetch(
    `/api/projects/tree?site=${encodeURIComponent(site)}&project=${encodeURIComponent(project)}`
  );
  if (!res.ok) throw new Error('Не удалось загрузить данные');
  return res.json();
};

export default function TreeLoaderForm({
                                            site,
                                            project,
                                            onSuccess,
                                          }: {
  site: string;
  project: string;
  onSuccess: (data: any) => void;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['project-tree', site, project],
    queryFn: () => fetchProjectData(site, project),
    enabled: !!site && !!project, // запрос только если поля заполнены
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 font-medium">Ошибка загрузки данных</p>
        <button onClick={() => refetch()} className="mt-4 text-purple-600 hover:underline">
          Попробовать снова
        </button>
      </div>
    );
  }

  if (data) {
    onSuccess(data);
    return null;
  }

  return null;
}