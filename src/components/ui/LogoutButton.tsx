// components/LogoutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useDeviceStore } from "@/store/useDeviceStore";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const stopEditing = useDeviceStore(s => s.stopEditing);
  const editingDevices = useDeviceStore(s => s.editingDevices);

  const handleLogout = async () => {
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
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="flex items-center gap-3 w-full px-4 py-3 text-left text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all duration-200 disabled:opacity-70"
    >
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
      <span className="font-medium">{isLoading ? 'Выходим...' : 'Выйти из аккаунта'}</span>
    </button>
  );
}
