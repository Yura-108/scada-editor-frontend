import {useEffect, useMemo, useState } from 'react';
import { useDeviceStore } from "@/store/useDeviceStore";

interface AddParamModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, value: string) => void;
}

export function AddParamModal({ open, onClose, onAdd }: AddParamModalProps) {
  const {paramsTypes} = useDeviceStore();

  const filteredParams = useMemo(
    () => paramsTypes.filter(p => p.type !== 'option'),
    [paramsTypes]
  );
  const [value, setValue] = useState('');
  const [name, setName] = useState(filteredParams[0]?.id ?? '');

  useEffect(() => {
    if (filteredParams.length > 0) {
      setName(filteredParams[0].id);
    }
  }, [filteredParams]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);


  const handleSubmit = () => {
    if (!value.trim()) return;
    onAdd(name, value);
    setValue('');
    setName(filteredParams[0].id);
    onClose();
  };

  if (!open || filteredParams.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Фон с блюром */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-lg"
        onClick={onClose}
      />

      {/* Само окно */}
      <div
        className={`
          relative z-10
          w-full max-w-md
          bg-white/10 backdrop-blur-2xl
          border border-white/20
          rounded-2xl overflow-hidden
          shadow-2xl shadow-black/30
          ring-1 ring-white/10
          animate-in fade-in zoom-in-95 duration-200
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="px-6 py-5 text-lg font-semibold text-white border-b border-white/15 bg-black/10">
          Добавление параметра
        </div>

        {/* Контент */}
        <div className="p-6 space-y-5 text-white">
          {/* Тип */}
          <div>
            <label htmlFor={"typeParam"} className="block mb-1.5 text-sm font-medium opacity-90">
              Тип поля
            </label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="
                w-full px-4 py-2.5 appearance-none
                bg-white/10 backdrop-blur-sm
                border border-white/20 rounded-lg
                text-white
                focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30
                transition-all duration-200
                cursor-pointer
              "
            >
              {filteredParams.map(paramType => (
                <option className="text-black bg-white" key={paramType.id} value={paramType.id}>
                  {paramType.name}
                </option>
              ))}
            </select>

          </div>
          {/* Значение параметра */}
          <div>
            <label htmlFor="valueParam" className="block mb-1.5 text-sm font-medium opacity-90">
              Значение параметра
            </label>
            <input
              id="valueParam"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Например: dark или 120"
              className={`
                w-full px-4 py-2.5
                bg-white/10 backdrop-blur-sm
                border border-white/20 rounded-lg
                text-white placeholder:text-white/50
                focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30
                transition-all duration-200
              `}
            />
          </div>


        </div>

        {/* Футер */}
        <div className="px-6 py-5 border-t border-white/15 flex justify-end gap-3 bg-black/5">
          <button
            onClick={onClose}
            className={`
              px-5 py-2.5 text-sm font-medium
              text-white/80 hover:text-white
              bg-white/5 hover:bg-white/15
              border border-white/10 hover:border-white/30
              rounded-lg transition-all duration-200
            `}
          >
            Отмена
          </button>

          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className={`
              px-5 py-2.5 text-sm font-medium
              bg-white/20 hover:bg-white/30
              text-white
              rounded-lg transition-all duration-200
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-sm
            `}
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}