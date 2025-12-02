'use client';

import {useEffect, useRef, useState} from "react";
import {Check, Edit2, Plus, X} from "lucide-react";
import clsx from "clsx";

export type Option = {
  id: string;
  label: string;
  color?: string;
};

type MultiSelectWithEditProps = {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  onOptionsChange?: (options: Option[]) => void;
  placeholder?: string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
}

export default function MultiSelectWithEdit({
                                              options: initialOptions,
                                              value,
                                              onChange,
                                              onOptionsChange,
                                              placeholder = "Выберите или создайте...",
                                              allowCreate = true,
                                              allowEdit = true,
                                              allowDelete = true
                                            }: MultiSelectWithEditProps) {
  const [options, setOptions] = useState<Option[]>(initialOptions);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOptions(initialOptions)
  }, [initialOptions]);

  useEffect(() => {
    const handleClickOutSide = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutSide);
    return () => document.removeEventListener('mousedown', handleClickOutSide);
  }, []);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))

  const selectedOptions = options.filter(opt => value.includes(opt.id));

  const handleToggle = (id: string) => {
    const newValue = value.includes(id)
      ? value.filter(v => v !== id)
      : [...value, id];
    onChange(newValue);
  }

  const handleCreate = () => {
    if (!search.trim() || !allowCreate) return;
    const newOption: Option = {
      id: `custom-${Date.now()}`,
      label: search.trim(),
      color: '#3b82f6',
    };
    const newOptions = [...options, newOption];
    setOptions(newOptions);
    onOptionsChange?.(newOptions);
    onChange([...value, newOption.id]);
    setSearch('');
  };

  const handleEditStart = (option: Option) => {
    setEditingId(option.id);
    setEditValue(option.label);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleEditSave = () => {
    if (!editingId || !editValue.trim()) return;
    const newOptions = options.map(opt =>
      opt.id === editingId ? { ...opt, label: editValue.trim() } : opt
    );
    setOptions(newOptions);
    onOptionsChange?.(newOptions);
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = (id: string) => {
    const newOptions = options.filter(opt => opt.id !== id);
    setOptions(newOptions);
    onOptionsChange?.(newOptions);
    onChange(value.filter(v => v !== id));
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Выбранные теги + инпут */}
      <div
        onClick={() => setIsOpen(true)}
        className={clsx(
          'min-h-12 px-3 py-2 border rounded-lg flex flex-wrap gap-2 items-center cursor-text bg-white transition-all',
          isOpen ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        {selectedOptions.map(opt => (
          <span
            key={opt.id}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
          >
            {opt.label}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(opt.id);
              }}
              className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const matched = filteredOptions.find(o => !value.includes(o.id));
              if (matched) handleToggle(matched.id);
              else if (allowCreate && search.trim()) handleCreate();
            }
            if (e.key === 'Backspace' && !search && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          className="flex-1 min-w-32 outline-none text-sm"
        />
      </div>

      {/* Выпадающий список */}
      {isOpen && (
        <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {search && allowCreate && !options.some(o => o.label.toLowerCase() === search.toLowerCase()) && (
            <button
              onClick={handleCreate}
              className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-gray-50 text-blue-600 font-medium"
            >
              <Plus className="w-4 h-4" />
              Создать {search}
            </button>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Ничего не найдено
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className="text-black px-4 py-2 hover:bg-gray-50 flex items-center justify-between group"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={value.includes(option.id)}
                    onChange={() => handleToggle(option.id)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  {editingId === option.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 border border-blue-500 rounded flex-1 text-sm"
                      autoFocus
                    />
                  ) : (
                    <span className="text-sm">{option.label}</span>
                  )}
                </label>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {allowEdit && editingId !== option.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(option);
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  )}
                  {editingId === option.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSave();
                      }}
                      className="p-1 hover:bg-green-100 rounded"
                    >
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </button>
                  )}
                  {allowDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(option.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded"
                    >
                      <X className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}