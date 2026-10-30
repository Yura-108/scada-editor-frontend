// components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {Spinner} from "@/shared/ui/Spinner";
import { useState } from 'react';
import { confirmLeave } from "@/lib/unsavedGuard";
import {useDeviceLocksStore} from "@/core/devices";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const stopEditing = useDeviceLocksStore(s => s.stopEditing);
  const editingDevices = useDeviceLocksStore(s => s.editingDevices);

  const handleLogout = async () => {
    // Выход уводит со страницы так же, как переход по шапке: черновик раздела пропал бы молча.
    if (!(await confirmLeave())) return;
    setIsLoading(true);
    await stopEditing(editingDevices);

    try {
      // Вызываем API Route, который удалит httpOnly cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      // Редирект на логин + обновление (чтобы Server Components забыли юзера)
      router.replace('/login');
      router.refresh();
    } catch (err) {
      console.error('Ошибка выхода:', err);
      // Даже если сервер упал — всё равно чистим клиент
      router.replace('/login');
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-600 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 disabled:opacity-70"
    >
      {isLoading ? <Spinner size={20} /> : <LogOut className="w-5 h-5" />}
      <span className="font-medium">{isLoading ? 'Выходим...' : 'Выйти'}</span>
    </button>
  );
}


