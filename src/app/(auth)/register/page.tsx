'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
  });

  const router = useRouter();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setServerError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: data.login,
          password: data.password,
        }),
        credentials: 'include',
      });

      // Ответ обязательно проверяем: раньше тело просто парсилось и любой отказ
      // сервера (занятый логин, 400, 500) был неотличим от успешной регистрации.
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setServerError(error.message || 'Не удалось зарегистрироваться');
        return;
      }

      router.push('/channels');
      router.refresh();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Фон и центрирование задаёт layout группы (auth); мёртвый `bg-linear-to-br`
    // без from-*/to-* убран вместе с обёрткой.
    <div className="w-full max-w-md">
      <div className="bg-white dark:bg-neutral-900/95 border border-transparent dark:border-neutral-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Создать аккаунт
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Заполните форму для регистрации</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Поле логина */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <input
              {...register('login')}
              type="text"
              // Без autoComplete менеджеры паролей не предлагают сохранить пару.
              autoComplete="username"
              placeholder="Придумайте логин"
              className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 ${
                errors.login
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-200 dark:border-neutral-700 focus:border-indigo-500 dark:focus:border-indigo-400'
              } bg-white dark:bg-neutral-950 outline-none transition-all duration-300 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-neutral-500 text-lg font-medium`}
            />
            {errors.login && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                {errors.login.message}
              </p>
            )}
          </div>

          {/* Поле пароля */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Придумайте пароль"
              className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 ${
                errors.password
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-200 dark:border-neutral-700 focus:border-indigo-500 dark:focus:border-indigo-400'
              } bg-white dark:bg-neutral-950 outline-none transition-all duration-300 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-neutral-500 text-lg font-medium`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              aria-pressed={showPassword}
              title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
              ) : (
                <Eye className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
              )}
            </button>
            {errors.password && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Подтверждение пароля */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Повторите пароль"
              className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 ${
                errors.confirmPassword
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-200 dark:border-neutral-700 focus:border-indigo-500 dark:focus:border-indigo-400'
              } bg-white dark:bg-neutral-950 outline-none transition-all duration-300 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-neutral-500 text-lg font-medium`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
              aria-pressed={showConfirmPassword}
              title={showConfirmPassword ? 'Скрыть подтверждение пароля' : 'Показать подтверждение пароля'}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
              ) : (
                <Eye className="h-5 w-5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" />
              )}
            </button>
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Ошибка от сервера */}
          {serverError && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl text-center font-medium">
              {serverError}
            </div>
          )}

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-5 rounded-2xl bg-linear-to-r from-indigo-600 to-blue-600 text-white text-xl font-bold hover:from-indigo-500 hover:to-blue-500 transform hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
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
          <p className="text-gray-600 dark:text-gray-400">
            Уже есть аккаунт?{' '}
            {/* Link + абсолютный путь: относительный href="login/" вёл бы
                на /register/login, а не на страницу входа. */}
            <Link
              href="/login"
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
