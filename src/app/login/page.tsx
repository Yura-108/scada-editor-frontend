'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@/schemas/authSchema';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include', // важно для httpOnly cookies
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        setServerError(error.message || 'Неверный логин или пароль');
      }

      // Успешный вход → редирект в рабочую область
      router.push('/channels');
      router.refresh(); // обновляем серверные данные (если используешь Server Components)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message || 'Что-то пошло не так');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8">
          {/* Заголовок */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-indigo-500 to-purple-600 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-gray-900 dark:text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">С возвращением!</h1>
            <p className="text-gray-600 mt-2">Войдите в свой аккаунт</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  {...register('login')}
                  id="login"
                  type="text"
                  placeholder="Логин"
                  aria-invalid={!!errors.login}
                  aria-describedby={errors.login ? 'login-error' : undefined}
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 transition-all duration-300 text-lg font-medium
                    ${
                      errors.login
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:border-purple-500'
                    } outline-none text-gray-800 placeholder-gray-400`}
                />
              </div>
              {errors.login && (
                <p id="login-error" className="text-sm text-red-600 font-medium leading-5">
                  {errors.login.message}
                </p>
              )}
            </div>

            {/* Пароль */}
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 11c1.104 0 2-.896 2-2s-.896-2-2-2-2 .896-2 2 .896 2 2 2zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z"
                    />
                  </svg>
                </div>
                <input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl border-2 transition-all duration-300 text-lg font-medium
                    ${
                      errors.password
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 focus:border-purple-500'
                    } outline-none text-gray-800 placeholder-gray-400`}
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
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-red-600 font-medium leading-5">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Ошибка от сервера */}
            {serverError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center font-medium">
                {serverError}
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600  text-white text-xl font-bold hover:from-indigo-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
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
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Входим...
                </>
              ) : (
                'Войти в аккаунт'
              )}
            </button>
          </form>

          {/* Ссылка на регистрацию */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Нет аккаунта?{' '}
              <a
                href="/register"
                className="text-purple-600 font-bold hover:text-purple-700 transition-colors"
              >
                Зарегистрироваться
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

