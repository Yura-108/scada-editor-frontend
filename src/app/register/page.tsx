'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { registerSchema } from '@/schemas/authSchema';

type FormData = z.infer<typeof registerSchema>;

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
  });

  const router = useRouter();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setServerError(''); // если у тебя есть состояние для ошибки

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: data.login,
          password: data.password,
          // если нужно имя/email — добавь сюда
          // name: data.name,
          // email: data.email,
        }),
        credentials: 'include', // важно для получения httpOnly cookie
      });

      const result = await response.json();

      if (!response.ok) {
        // Ошибки от бэкенда (например: "Логин уже занят")
        throw new Error(result.message || 'Ошибка регистрации');
      }

      // Успешная регистрация → JWT в httpOnly cookie уже установлен
      // Можно сразу редиректить в приложение
      router.push('/app');
      router.refresh(); // обновляем серверные данные (если используешь Server Components)
    } catch (err: any) {
      console.error('Ошибка регистрации:', err);
      setServerError(err.message || 'Что-то пошло не так. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 backdrop-blur-xl bg-opacity-95">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Создать аккаунт</h1>
              <p className="text-gray-600">Заполните форму для регистрации</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Поле логина */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  {...register('login')}
                  type="text"
                  placeholder="Придумайте логин"
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 ${
                    errors.login
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-purple-500'
                  } outline-none transition-all duration-300 text-gray-800 placeholder-gray-400 text-lg font-medium`}
                />
                {errors.login && (
                  <p className="mt-2 text-sm text-red-600 font-medium">{errors.login.message}</p>
                )}
              </div>

              {/* Поле пароля */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Придумайте пароль"
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 ${
                    errors.password
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-purple-500'
                  } outline-none transition-all duration-300 text-gray-800 placeholder-gray-400 text-lg font-medium`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500 hover:text-purple-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500 hover:text-purple-600 transition-colors" />
                  )}
                </button>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 font-medium">{errors.password.message}</p>
                )}
              </div>

              {/* Подтверждение пароля */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Повторите пароль"
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 ${
                    errors.confirmPassword
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-200 focus:border-purple-500'
                  } outline-none transition-all duration-300 text-gray-800 placeholder-gray-400 text-lg font-medium`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-500 hover:text-purple-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-500 hover:text-purple-600 transition-colors" />
                  )}
                </button>
                {errors.confirmPassword && (
                  <p className="mt-2 text-sm text-red-600 font-medium">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Кнопка отправки */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Создание аккаунта...
                  </span>
                ) : (
                  'Зарегистрироваться'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Уже есть аккаунт?{' '}
                <a
                  href="login/"
                  className="text-purple-600 font-bold hover:text-purple-700 transition-colors"
                >
                  Войти
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
