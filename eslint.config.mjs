import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Архитектурные правила (docs/architecture.md). Пока всё в режиме 'warn':
// число предупреждений — это счётчик того, сколько ещё переезжать.
// Когда нарушений в слое не останется, его правило можно перевести в 'error'.

// Продуктовые модули src/modules/<имя>. Новый модуль — добавить имя сюда.
const MODULES = ['editor', 'monitor', 'channels', 'automation', 'data', 'logs', 'journal', 'admin', 'auth', 'actions'];

// Импорты только вниз: app → modules → core → shared; app/api → server → shared.
const UP_TO_APP = { group: ['@/app/*'], message: 'Слой app — верхний, из него не импортируют.' };
const INTO_MODULES = { group: ['@/modules/*'], message: 'Модули импортируются только из app.' };
const INTO_CORE = { group: ['@/core/*'], message: 'shared не знает про доменное ядро core.' };
const INTO_SERVER = { group: ['@/server/*'], message: 'server — только для src/app/api (BFF).' };
const DEEP_MODULE = {
  group: ['@/modules/*/*'],
  message: 'В модуль заходят только через его index.ts: @/modules/<имя>.',
};
const DEEP_CORE = { group: ['@/core/*/*'], message: 'В раздел core заходят через его index.ts: @/core/<раздел>.' };
// Старые папки — нижний слой их не знает
const LEGACY = {
  group: ['@/components/*', '@/store/*', '@/lib/*'],
  message: 'Новая структура не зависит от старых папок: сначала перенесите нужный код.',
};

const restrict = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['warn', { patterns }] },
});

// UI-kit: файлы, которым поля и спиннер собирать можно (сами компоненты ui-kit).
const UI_KIT_FIELD_FILES = [
  'src/shared/ui/field/**',
  'src/shared/ui/Spinner.tsx',
  // Редактор текста прямо на холсте: обязан выглядеть как текст фигуры, а не как поле.
  'src/modules/editor/ui/canvas/TextEditorOverlay.tsx',
];
const UI_KIT_FIELD_RULES = [
  {
    selector: "ImportDeclaration[source.value='@radix-ui/react-select']",
    message: 'Выпадающий список — Select из @/shared/ui/field/Select.',
  },
  {
    selector: "ImportDeclaration[source.value='radix-ui'] > ImportSpecifier[imported.name='Select']",
    message: 'Выпадающий список — Select из @/shared/ui/field/Select.',
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: 'Выпадающий список — Select из @/shared/ui/field/Select.',
  },
  {
    selector: "JSXOpeningElement[name.name='textarea']",
    message: 'Многострочное поле — Textarea из @/shared/ui/field/Textarea.',
  },
  {
    selector: 'Literal[value=/animate-spin/]',
    message: 'Индикатор загрузки — Spinner из @/shared/ui/Spinner.',
  },
  {
    selector: 'TemplateElement[value.raw=/animate-spin/]',
    message: 'Индикатор загрузки — Spinner из @/shared/ui/Spinner.',
  },
];
const DIALOG_MESSAGE = 'Окно — openModal/confirmModal/promptModal/choiceModal или Modal из @/shared/ui/dialog.';
const UI_KIT_DIALOG_RULES = [
  { selector: "ImportDeclaration[source.value='@radix-ui/react-dialog']", message: DIALOG_MESSAGE },
  { selector: "ImportDeclaration[source.value='@radix-ui/react-alert-dialog']", message: DIALOG_MESSAGE },
  {
    selector: "ImportDeclaration[source.value='radix-ui'] > ImportSpecifier[imported.name=/^(Alert)?Dialog$/]",
    message: DIALOG_MESSAGE,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Размер файлов и функций (лимиты из docs/architecture.md)
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },

  // Границы новых слоёв
  restrict(['src/shared/**'], [UP_TO_APP, INTO_MODULES, INTO_CORE, INTO_SERVER, LEGACY]),
  restrict(['src/core/**'], [UP_TO_APP, INTO_MODULES, INTO_SERVER, LEGACY]),
  restrict(['src/server/**'], [UP_TO_APP, INTO_MODULES, INTO_CORE, LEGACY]),
  // Модуль не импортирует другие модули и серверный код
  ...MODULES.map((name) =>
    restrict(
      [`src/modules/${name}/**`],
      [
        UP_TO_APP,
        INTO_SERVER,
        DEEP_CORE,
        LEGACY,
        {
          group: MODULES.filter((m) => m !== name).map((m) => `@/modules/${m}`),
          message: 'Модули не импортируют друг друга: общее выносится в core.',
        },
      ],
    ),
  ),
  // Маршруты берут модули и core только через публичный API
  restrict(['src/app/**'], [DEEP_MODULE, DEEP_CORE]),

  // Старые папки: самые вредные обратные зависимости (счётчик для переезда)
  restrict(
    ['src/lib/**'],
    [{ group: ['@/components/*'], message: 'lib — нижний слой, он не импортирует компоненты.' }],
  ),
  restrict(
    ['src/store/**'],
    [{ group: ['@/components/*'], message: 'Стор не импортирует компоненты: вынесите логику в lib.' }],
  ),

  // UI-kit: поля только из shared/ui/field (docs/architecture.md, «UI-kit: поля»), спиннер —
  // только Spinner («UI-kit: общие компоненты»), окна — только из shared/ui/dialog («UI-kit: окна»).
  // Своё правило, а не no-restricted-imports: тот уже настроен по слоям выше, и второй блок с ним
  // перезаписал бы те ограничения для тех же файлов. По той же причине блоков no-restricted-syntax
  // два и они не пересекаются: второй блок для тех же файлов затёр бы первый.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...UI_KIT_FIELD_FILES, 'src/shared/ui/dialog/**'],
    rules: { 'no-restricted-syntax': ['warn', ...UI_KIT_DIALOG_RULES, ...UI_KIT_FIELD_RULES] },
  },
  // Оболочка окон сама собирает Radix Dialog — для неё только правила полей и спиннера.
  {
    files: ['src/shared/ui/dialog/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': ['warn', ...UI_KIT_FIELD_RULES] },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
