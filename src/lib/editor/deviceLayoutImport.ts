import {DiagramElement} from "@/types/editorElement.type";
import {PaletteItemType} from "@/types/palette.types";
import {createUuid} from "@/lib/createUuid";
import {instantiateTemplate} from "@/lib/editor/templateInstance";

/**
 * Импорт плана устройств: «какой шаблон взять и в какие координаты поставить».
 *
 * Чистый модуль без сторов и без `toast` — как `conturImport`. Решение, что делать с
 * результатом (спросить режим, показать отчёт), принимает вызывающий.
 */

/**
 * Координаты в файле мелкие: шаг сетки чертежа — 4 единицы, у редактора `GRID = 20`.
 * Множитель 5 переводит один в другой, поэтому устройства встают на узлы сетки без
 * подгонки, а схема целиком занимает примерно 1800×1200.
 */
export const SCALE = 5;

/**
 * Пол толщины линии. Своя константа, а не импорт из `conturImport`: там такая же
 * объявлена без `export`. Причина та же — при обзоре «весь лист» линия тоньше
 * половины пикселя пропадает с экрана совсем.
 */
const MIN_STROKE = 0.5;

export interface DeviceLayoutDevice {
  /** Имя шаблона в палитре: «V», «LS», «UZ». */
  template: string;
  /** Имя устройства на схеме: «V3». */
  name: string;
  /** Узел базы каналов. НЕ уникален: один узел бывает нарисован несколько раз. */
  idNode: string;
  x: number;
  y: number;
}

export interface DeviceLayoutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** В файле необязательна; без неё рендер подставит свою толщину. */
  width?: number;
}

export interface DeviceLayoutFile {
  devices: DeviceLayoutDevice[];
  lines?: DeviceLayoutLine[];
}

export interface DeviceLayoutReport {
  /** Сколько устройств было в файле. */
  devices: number;
  /** Сколько из них удалось поставить. */
  placed: number;
  lines: number;
  /** Шаблонов с таким именем в палитре нет — устройства пропущены. */
  missing: {template: string; count: number; names: string[]}[];
  /** Имя шаблона встречается в палитре несколько раз — взят первый. */
  ambiguous: {template: string; count: number}[];
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Узнаёт формат по ПОЛЯМ, а не по наличию ключа: файл с пустым `devices` ещё ничего не
 * доказывает, а перепутать диалект — значит молча создать мусор вместо схемы.
 */
export const isDeviceLayoutFile = (json: unknown): json is DeviceLayoutFile => {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const devices = (json as {devices?: unknown}).devices;
  if (!Array.isArray(devices) || devices.length === 0) return false;
  const first = devices[0] as Record<string, unknown> | undefined;
  return !!first
    && typeof first.template === "string"
    && isFiniteNumber(first.x)
    && isFiniteNumber(first.y);
};

/**
 * Индекс шаблонов палитры по имени.
 *
 * Фильтр `type === "custom"` обязателен: в палитре лежат ещё и статические элементы
 * (`src/constants/palette.ts`), у которых `template` нет вовсе. Сравнение точное —
 * подстрочный `filterPalette` здесь не годится, по нему «V» совпало бы с «VN», «VH» и «VC».
 */
const buildTemplateIndex = (paletteItems: PaletteItemType[]): Map<string, PaletteItemType[]> => {
  const index = new Map<string, PaletteItemType[]>();
  for (const item of paletteItems) {
    if (item.type !== "custom" || !item.template?.length) continue;
    for (const key of new Set([item.name, item.name.trim().toLowerCase()])) {
      const bucket = index.get(key);
      if (bucket) bucket.push(item);
      else index.set(key, [item]);
    }
  }
  return index;
};

/** Линия чертежа. Эталон полей — ветка `line` в `addElementAt`. */
const buildLine = (line: DeviceLayoutLine, sceneId: number | null): DiagramElement => {
  const x1 = line.x1 * SCALE;
  const y1 = line.y1 * SCALE;
  const x2 = line.x2 * SCALE;
  const y2 = line.y2 * SCALE;

  return {
    id: null,
    key: createUuid(),
    type: "line",
    x1, y1, x2, y2,
    // Точка «тела» линии — её середина: так её ставит addElementAt, и так её
    // двигает перетаскивание. Габарит линии считается по концам, поэтому w/h
    // оставляем такими же, как у линии, созданной руками.
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    w: 80,
    h: 80,
    // Элементы кладёт addImportedElements, а он ничего не перепривязывает —
    // корень сцены проставляем сами.
    parentId: sceneId,
    parentKey: String(sceneId),
    children: [],
    composition: [],
    scripts: [],
    bindings: [],
    properties: [],
    states: [{id: createUuid(), name: "Нормальное", overrides: {}, isDefault: true}],
    // Толщину масштабируем вместе с координатами; если её в файле нет — поле не
    // пишем вовсе, чтобы рендер подставил своё значение по умолчанию.
    ...(isFiniteNumber(line.width)
      ? {strokeWidth: Math.max(line.width * SCALE, MIN_STROKE)}
      : {}),
  } as DiagramElement;
};

export const buildDeviceLayout = (
  file: DeviceLayoutFile,
  paletteItems: PaletteItemType[],
  sceneId: number | null,
): {elements: DiagramElement[]; report: DeviceLayoutReport} => {
  const index = buildTemplateIndex(paletteItems);
  const elements: DiagramElement[] = [];

  const missing = new Map<string, {count: number; names: string[]}>();
  const ambiguous = new Map<string, number>();
  let placed = 0;

  for (const device of file.devices) {
    const found = index.get(device.template)
      ?? index.get(device.template.trim().toLowerCase());

    if (!found?.length) {
      const miss = missing.get(device.template) ?? {count: 0, names: []};
      miss.count += 1;
      miss.names.push(device.name);
      missing.set(device.template, miss);
      continue;
    }

    // Уникальность имён в палитре нигде не проверяется, поэтому дубль — штатная
    // ситуация: берём первый и сообщаем об этом в отчёте.
    if (found.length > 1) {
      ambiguous.set(device.template, (ambiguous.get(device.template) ?? 0) + 1);
    }

    // Каждый экземпляр получает СВОЙ набор ключей внутри instantiateTemplate —
    // общий keyMap на всю пачку схлопнул бы 15 копий шаблона «V» в одну.
    elements.push(...instantiateTemplate(found[0].template!, {
      x: device.x * SCALE,
      y: device.y * SCALE,
      sceneId,
      // Имя видно в «Слоях». Если корень шаблона — прямоугольник без своего `text`,
      // фолбэк ShapeElement напечатает подпись прямо на фигуре (см. план, ловушка 7).
      label: device.name,
      // Узел базы каналов. Своё поле переживает сохранение: buildBaseImage работает
      // по чёрному списку и всё незнакомое укладывает в states[].image.
      extra: {idNode: device.idNode},
    }));
    placed += 1;
  }

  const lines = file.lines ?? [];
  for (const line of lines) {
    elements.push(buildLine(line, sceneId));
  }

  return {
    elements,
    report: {
      devices: file.devices.length,
      placed,
      lines: lines.length,
      missing: [...missing.entries()]
        .map(([template, v]) => ({template, count: v.count, names: v.names}))
        .sort((a, b) => b.count - a.count),
      ambiguous: [...ambiguous.entries()].map(([template, count]) => ({template, count})),
    },
  };
};
