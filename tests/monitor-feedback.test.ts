import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentProjectGrant } from '@/core/access';
import { useMonitorRecipes, type MonitorRecipes } from '@/modules/monitor/api/procedures';
import { NoReleaseNotice } from '@/modules/monitor/ui/MonitorNotice';
import { MonitorStatusBadges } from '@/modules/monitor/ui/MonitorStatusBadges';
import { ProcedureHud } from '@/modules/monitor/ui/ProcedureHud';
import { ProcedurePanel } from '@/modules/monitor/ui/ProcedurePanel';

vi.mock('@/core/access', () => ({ useCurrentProjectGrant: vi.fn() }));
vi.mock('@/core/project', () => ({
  useOpenScene: (selector: (state: unknown) => unknown) =>
    selector({ currentProject: { id: 27 }, releaseVersionNo: 4 }),
}));
vi.mock('@/modules/monitor/api/procedures', () => ({ useMonitorRecipes: vi.fn() }));
vi.mock('@/modules/monitor/model/procedures/useProcedureControls', () => ({
  useProcedureControls: () => ({ busy: false, denied: {} }),
}));
vi.mock('@/modules/monitor/model/useProcedureStore', () => ({
  useProcedureStore: () => ({ recipeId: 'previous-recipe', status: { completed: false } }),
}));

const emptyRecipes: MonitorRecipes = {
  recipes: [],
  isLoading: false,
  loadError: null,
  reload: vi.fn(),
};

beforeEach(() => {
  vi.mocked(useMonitorRecipes).mockReturnValue(emptyRecipes);
  vi.mocked(useCurrentProjectGrant).mockReturnValue({
    edit: false,
    view: true,
    operate: true,
    level: 1,
  });
});

describe('Рецепты в мониторе', () => {
  it('показывает оператору одно сообщение, блокирует запуск и скрывает плашку', () => {
    const panel = renderToStaticMarkup(createElement(ProcedurePanel));

    expect(panel).toContain('В проекте пока нет рецептов. Обратитесь к технологу.');
    expect(panel).not.toContain('Выберите рецепт, чтобы увидеть');
    expect(panel).not.toContain('Сделать prod');
    expect(panel.match(/<button\b[^>]*\bdisabled=""/g)).toHaveLength(2);
    expect(panel).toContain('Запустить');
    expect(panel).not.toContain('Подтвердить');
    expect(renderToStaticMarkup(createElement(ProcedureHud))).toBe('');
  });

  it('показывает действия по выпуску пользователю с правом «Правка»', () => {
    vi.mocked(useCurrentProjectGrant).mockReturnValue({
      edit: true,
      view: true,
      operate: false,
      level: null,
    });

    const panel = renderToStaticMarkup(createElement(ProcedurePanel));

    expect(panel).toContain('Сделать prod');
    expect(panel).not.toContain('Обратитесь к технологу');
  });

  it('отличает ошибку загрузки от пустого списка', () => {
    vi.mocked(useMonitorRecipes).mockReturnValue({
      ...emptyRecipes,
      loadError: 'Сервер недоступен',
    });

    const panel = renderToStaticMarkup(createElement(ProcedurePanel));

    expect(panel).toContain('Не удалось загрузить рецепты');
    expect(panel).toContain('Повторить');
    expect(panel).not.toContain('В проекте пока нет рецептов');
    expect(panel).not.toContain('Выберите рецепт, чтобы увидеть');
  });
});

describe('Статус монитора', () => {
  const badges = {
    isArchive: false,
    status: 'closed' as const,
    statusDetail: null,
    isStale: false,
    compileErrors: new Map<string, string>(),
    runtimeErrors: new Map<string, string>(),
    releaseVersionNo: null,
  };

  it('не показывает старую причину отключения до выбора схемы', () => {
    const html = renderToStaticMarkup(
      createElement(MonitorStatusBadges, {
        ...badges,
        hasScene: false,
        status: 'reconnecting',
        statusDetail: 'Старое сообщение runtime',
        isStale: true,
      }),
    );

    expect(html).toContain('Схема не выбрана');
    expect(html).not.toContain('Старое сообщение runtime');
    expect(html).not.toContain('Нет соединения');
  });

  it('сохраняет статус отключения для открытой схемы', () => {
    const html = renderToStaticMarkup(
      createElement(MonitorStatusBadges, { ...badges, hasScene: true }),
    );

    expect(html).toContain('Нет соединения');
  });

  it('различает отсутствие рабочего выпуска, вывод из эксплуатации и недоступность схем', () => {
    expect(
      renderToStaticMarkup(
        createElement(NoReleaseNotice, {
          prodVersionNo: null,
          inOperation: false,
        }),
      ),
    ).toContain('У проекта ещё нет выпуска для показа');
    expect(
      renderToStaticMarkup(
        createElement(NoReleaseNotice, {
          prodVersionNo: 4,
          inOperation: false,
        }),
      ),
    ).toContain('Проект не введён в эксплуатацию');
    expect(
      renderToStaticMarkup(
        createElement(NoReleaseNotice, {
          prodVersionNo: undefined,
          inOperation: undefined,
        }),
      ),
    ).toContain('Схемы проекта сейчас недоступны');
  });
});
