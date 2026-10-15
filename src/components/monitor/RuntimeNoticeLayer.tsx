"use client";

import React, {useEffect, useRef, useState} from "react";
import {ShieldAlert} from "lucide-react";
import {setRuntimeNoticeHandler, type RuntimeNotice} from "@/lib/runtime/runtimeEventBus";

/** Сколько висит сообщение: прочитать «Нужен уровень доступа 5» хватает с запасом. */
const NOTICE_MS = 3_000;

/**
 * Отказ в действии — у той точки, где нажали (контракт прав: «всплывающее сообщение у
 * кнопки»). Тост в углу экрана оператор связал бы с кнопкой хуже, а на сенсорной панели
 * мог и не заметить. Монтируется только в живом мониторе; новое сообщение заменяет старое.
 */
export default function RuntimeNoticeLayer() {
  const [notice, setNotice] = useState<(RuntimeNotice & {id: number}) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let seq = 0;
    setRuntimeNoticeHandler(next => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotice({...next, id: ++seq});
      timerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
    });
    return () => {
      setRuntimeNoticeHandler(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!notice) return null;
  return (
    <div
      key={notice.id}
      role="status"
      aria-live="polite"
      onClick={() => setNotice(null)}
      // Над точкой нажатия и чуть выше: палец или курсор не закрывают текст.
      style={{left: notice.point.x, top: notice.point.y - 12}}
      className="fixed z-dropdown -translate-x-1/2 -translate-y-full flex items-center gap-1.5 whitespace-nowrap
        rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/90 px-2.5 py-1.5 text-xs font-medium
        text-amber-800 dark:text-amber-200 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      <ShieldAlert size={14} />
      {notice.text}
    </div>
  );
}
