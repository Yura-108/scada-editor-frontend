'use client';

// app/not-found.tsx
import Link from 'next/link';
import { Home, ArrowLeft, Sparkles } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center px-4">
      <div className="max-w-4xl w-full text-center">
        {/* Большая анимированная 404 */}
        <div className="relative mb-12">
          <h1 className="text-9xl md:text-[12rem] font-black text-white opacity-20 selecture-20 tracking-tighter select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-bounce">
              <Sparkles className="w-20 h-20 md:w-32 md:h-32 text-yellow-300" />
            </div>
          </div>
        </div>

        {/* Текст */}
        <div className="relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
            Ой-ой! Страница пропала в космосе
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow">
            Кажется, вы зашли туда, куда даже наши разработчики боятся ходить...
          </p>

          {/* Карточка с действиями */}
          <div className="inline-block bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12 transform hover:scale-105 transition-all duration-300">
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/app"
                className="group flex items-center gap-3 px-8 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-2xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-110 transition-all duration-300 shadow-lg"
              >
                <Home className="w-6 h-6 group-hover:animate-pulse" />
                На главную
              </Link>

              <button
                onClick={() => window.history.back()}
                className="group flex items-center gap-3 px-8 py-5 bg-white/20 backdrop-blur border-2 border-white/30 text-white text-xl font-bold rounded-2xl hover:bg-white/30 transition-all duration-300"
              >
                <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                Вернуться назад
              </button>
            </div>

            <p className="mt-8 text-gray-600 text-sm">
              Или просто подождите... возможно, страница сама найдётся
            </p>
          </div>

          {/* Декоративные элементы */}
          <div className="mt-16 flex justify-center gap-8 opacity-30">
            <div className="animate-pulse">
              <div className="w-3 h-3 bg-yellow-300 rounded-full"></div>
            </div>
            <div className="animate-pulse delay-75">
              <div className="w-4 h-4 bg-pink-300 rounded-full"></div>
            </div>
            <div className="animate-pulse delay-150">
              <div className="w-3 h-3 bg-purple-300 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
