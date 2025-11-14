import {useState, useRef, useEffect} from "react";
import './SelectContextMenu.scss';
import type {DeviceParamsType} from "../../types/nodeType.ts";
import {addParam, deleteParam, patchParam} from "../../utils/treeApi.ts";
import * as React from "react";

type MenuState = {
  visible: boolean;
  x: number;
  y: number;
  targetType: 'select' | 'option';
  targetValue?: string;
};

const menuItemStyle: React.CSSProperties = {
  padding: '4px 10px',
  cursor: 'pointer',
};

interface SelectContextMenuProps {
  name: string;
  title: string;
  value: DeviceParamsType[];
  parentKey: string;
}

const SelectContextMenu: React.FC<SelectContextMenuProps> = ({name, title, value, parentKey}) => {
  const [contextMenu, setContextMenu] = useState<MenuState>({
    visible: false,
    x: 0,
    y: 0,
    targetType: 'select',
  });

  const [options, setOptions] = useState<DeviceParamsType[]>(value);

  const selectRef = useRef<HTMLSelectElement>(null);

  const handleContextMenu = (e: React.MouseEvent<HTMLSelectElement>) => {
    e.preventDefault();

    const { clientX, clientY } = e;

    const target = e.target as HTMLElement;

    if (target.tagName === 'OPTION') {
      const optionValue = (target as HTMLOptionElement).value;

      // 👉 выделим опцию вручную
      if (selectRef.current) {
        const options = Array.from(selectRef.current.options);
        options.forEach(opt => {
          opt.selected = opt.value === optionValue;
        });
      }

      setContextMenu({
        visible: true,
        x: clientX,
        y: clientY,
        targetType: 'option',
        targetValue: (target as HTMLOptionElement).value,
      });
    } else {
      setContextMenu({
        visible: true,
        x: clientX,
        y: clientY,
        targetType: 'select',
      });
    }
  };

  const handleMenuClick = async (action: string) => {
    if (contextMenu.targetType === 'option') {
      const valueToDelete = contextMenu.targetValue;
      const target = options.find(p => p.value === valueToDelete);

      if (!target) {
        alert('Параметр не найден');
        return;
      }
      if (action === "Удалить") {
        try {
          console.log('удалить')
          await deleteParam(target.key);
          setOptions(prev => prev.filter(p => p.key !== target.key));
        } catch (err) {
          console.error('Ошибка при удалении:', err);
          alert('Не удалось удалить параметр.');
        }
      }

      if (action === 'Изменить') {
        const newValue = prompt('Новое значение параметра:', target.value);
        if (!newValue || newValue === target.value) return;
        const patchPayload = {
          key: target.key,
          value: newValue
        }
        try {
          await patchParam([patchPayload]);
          setOptions(prev =>
            prev.map(p => p.key === target.key ? { ...p, value: newValue } : p)
          );
        } catch (err) {
          console.error('Ошибка при изменении:', err);
          alert('Не удалось изменить параметр.');
        }
      }

    } else {
      const newName = prompt('Введите название параметра:')?.trim();

      if (!newName) return;

      const tempParam = {
        parentKey: parentKey,
        name: title,
        value: newName
      };
      try {
        const param = await addParam(tempParam);
        setOptions(prev => [...prev, param]);
      } catch (error) {
        console.error('Ошибка при добавлении:', error);
        alert('Не удалось добавить параметр. Попробуйте ещё раз.');
      }

    }

    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) closeMenu()
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  return (
    <div onClick={closeMenu} className={"select__container"}>
      <label htmlFor={name}>{title}</label>
      <select
        ref={selectRef}
        id={name}
        name={name}
        multiple
        onContextMenu={handleContextMenu}
      >
        {options.map(optionNode => (
          <option key={optionNode.key} value={optionNode.value}>{optionNode.value}</option>
        ))}
      </select>

      {contextMenu.visible && (
        <ul
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #ccc',
            padding: '4px 0',
            margin: 0,
            listStyle: 'none',
            zIndex: 1000,
            width: 120,
          }}
        >
          {contextMenu.targetType === 'option' ? (
            <>
              <li onClick={() => handleMenuClick('Изменить')} style={menuItemStyle}>Изменить</li>
              <li onClick={() => handleMenuClick('Удалить')} style={menuItemStyle}>Удалить</li>
            </>
          ) : (
            <li onClick={() => handleMenuClick('Добавить')} style={menuItemStyle}>Добавить</li>
          )}
        </ul>
      )}
    </div>
  )
};

export default SelectContextMenu;