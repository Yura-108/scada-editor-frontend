import React from "react";

export function TooltipBtn({
  icon,
  label,
  onClick,
  disabled,
  className,
  badge = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  /** Точка-индикатор в углу кнопки (например, «есть несохранённые изменения»). */
  badge?: boolean;
}) {
  return (
    <div className="relative group/tip">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={className ?? `flex items-center justify-center w-9 h-9 rounded-xl
          bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-900 dark:text-white
          hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          active:translate-y-0.5 disabled:opacity-20 transition-all`}
      >
        {icon}
        {badge && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-neutral-900"
          />
        )}
      </button>
      {/* group-focus-within — подсказка видна и при переходе клавиатурой. */}
      <span
        role="tooltip"
        className="
        absolute top-full left-1/2 -translate-x-1/2 mt-2 z-dropdown
        px-2 py-1 text-xs font-medium rounded-lg whitespace-nowrap
        bg-gray-900 dark:bg-gray-700 text-white
        opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 pointer-events-none
        transition-opacity duration-150
      ">
        {label}
      </span>
    </div>
  );
}

/** Разделитель групп кнопок тулбара. */
export function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />;
}
