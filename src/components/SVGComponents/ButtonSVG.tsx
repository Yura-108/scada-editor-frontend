"use client";

import React from "react";
import { BaseElement } from "@/types/editorElement.type"; // или DiagramElement, как у тебя называется

type ButtonProps = {
  element: BaseElement;
};

export function Button({ element }: ButtonProps) {
  // Деструктуризация с дефолтными значениями
  const {
    color = "#FF4D4F",           // основной цвет кнопки
    label = "Btn",               // текст на кнопке
    textColor = "#ffffff",       // цвет текста
    size = 50,                   // размер в пикселях (квадратный)
    pressed = false,             // состояние нажатия (можно использовать для визуального отклика)
    // disabled = false,         // если добавишь в будущем
  } = element;

  // Можно сделать размер чуть меньше при "нажатии" (опционально)
  const effectiveSize = pressed ? size * 0.95 : size;

  return (
    <svg
      width={effectiveSize}
      height={effectiveSize}
      viewBox="0 0 50 50"
      className="max-w-full max-h-full" // чтобы не вылезало за границы контейнера
    >
      {/* Основа кнопки */}
      <rect
        x="5"
        y={pressed ? 22 : 20}           // сдвиг вниз при нажатии
        width="40"
        height="15"
        rx="3"
        fill={color}
        stroke="#333"
        strokeWidth="2"
      />

      {/* Тень / эффект нажатия */}
      <rect
        x="5"
        y={pressed ? 24 : 22}
        width="40"
        height={pressed ? 1 : 2}
        fill="#222"
        opacity={pressed ? 0.5 : 0.3}
      />

      {/* Метка / текст */}
      <text
        x="25"
        y={pressed ? 34 : 32}           // текст тоже чуть сдвигается
        textAnchor="middle"
        dominantBaseline="middle"
        fill={textColor}
        fontSize="10"
        fontFamily="Arial, sans-serif"
        fontWeight={pressed ? "bold" : "normal"}
      >
        {label}
      </text>

      {/* Опционально: небольшой блик/градиент для объёма */}
      <defs>
        <linearGradient id={`buttonGrad-${element.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect
        x="5"
        y={pressed ? 22 : 20}
        width="40"
        height="15"
        rx="3"
        fill={`url(#buttonGrad-${element.id})`}
        pointerEvents="none"
      />
    </svg>
  );
}