// components/StartMenu.tsx
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2, FolderOpen, AlertCircle, RefreshCw } from 'lucide-react';

// Типы данных (можно вынести в types/ позже)
interface ProjectData {
  nodes: any[];
  params: any;
}

interface StartMenuProps {
  onProjectLoaded: (data: ProjectData) => void;
}

const fetchProjectData = async (site: string, project: string): Promise<ProjectData> => {
  if (!site.trim() || !project.trim()) {
    throw new Error('Заполните площадку и проект');
  }

  const res = await fetch(
    `http://localhost:8080/api/node/all?site=${encodeURIComponent(site)}&project=${encodeURIComponent(project)}`
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Не удалось загрузить данные');
  }
  console.log(res.json())
  return res.json();
};

export default function StartMenu({ onProjectLoaded }: StartMenuProps) {
  const [site, setSite] = useState('');
  const [project, setProject] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const {
    data,
    error,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['project-tree', site, project],
    queryFn: () => fetchProjectData(site, project),
    enabled: submitted && !!site && !!project, // запрос только после отправки формы
    retry: false,
    staleTime: 1000 * 60 * 10, // 10 минут
  });

  // Если данные успешно загрузились — передаём наверх
  React.useEffect(() => {
    if (data) {
      onProjectLoaded(data);
    }
  }, [data, onProjectLoaded]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!site.trim() || !project.trim()) return;
    setSubmitted(true);
  };

  // Сброс при изменении полей
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setSubmitted(false); // сбрасываем, чтобы можно было искать заново
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Заголовок */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-full mb-6">
            <Search className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
            Поиск проекта
          </h1>
          <p className="text-xl text-white/90">
            Введите площадку и название проекта
          </p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Площадка */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <input
                type="text"
                value={site}
                onChange={handleInputChange(setSite)}
                placeholder="Название площадки"
                className="w-full pl-14 pr-5 py-5 rounded-2xl border-2 border-gray-200 focus:border-purple-500 outline-none transition-all duration-300 text-lg font-medium text-gray-800 placeholder-gray-400"
                required
              />
            </div>

            {/* Проект */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FolderOpen className="h-6 w-6 text-purple-600" />
              </div>
              <input
                type="text"
                value={project}
                onChange={handleInputChange(setProject)}
                placeholder="Название проекта"
                className="w-full pl-14 pr-5 py-5 rounded-2xl border-2 border-gray-200 focus:border-purple-500 outline-none transition-all duration-300 text-lg font-medium text-gray-800 placeholder-gray-400"
                required
              />
            </div>

            {/* Состояния */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-3 text-purple-600">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span className="text-lg font-medium">Загрузка устройств...</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-700 font-medium mb-4">
                  {(error as Error)?.message || 'Ошибка загрузки'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Попробовать снова
                </button>
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={isLoading || !site || !project}
              className="w-full py-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-bold hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              <Search className="w-6 h-6" />
              Найти проект
            </button>
          </form>
        </div>

        <p className="text-center text-white/70 mt-10 text-sm">
          После поиска появится дерево устройств и настройки
        </p>
      </div>
    </div>
  );
}