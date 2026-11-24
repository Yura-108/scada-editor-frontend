import {useCallback, useEffect, useRef, type RefObject} from "react";
import {toast} from "sonner";
import {devLog} from "@/shared/lib/devLog";
import {getRenderedElement, getSceneView, type DiagramElement, type ElementEventName} from "@/core/scene";
import {
  collectTagScope, SANDBOX_TIMEOUTS, SandboxTimeoutError, setRuntimeEventHandler,
  setRuntimeLive, setRuntimePropertyValueGetter, setRuntimeScriptHandler, setRuntimeSessionGetter,
  setRuntimeTagQualityGetter, setRuntimeTagWriteHandler, setRuntimeValueGetter, showRuntimeNotice,
  withPropertyRefs, type ActionArgs, type ScreenPoint, type ScriptSandbox,
} from "@/core/runtime";
import {actionDenialText, getCurrentProjectGrant} from "@/core/access";
import type {RuntimeMode} from "./useRuntimeEngine";
import type {RuntimeConnection, RuntimeStatus} from "./runtimeConnection";
import {ingestOperatorWrites, type EngineBuffers} from "./engineBuffers";
import {applyEventResult, scopeValues} from "./applyEventResult";

const log = (...args: unknown[]) => devLog("[monitor:engine]", ...args);

interface Params {
  active: boolean;
  mode: RuntimeMode;
  status: RuntimeStatus;
  buffers: EngineBuffers;
  connRef: RefObject<RuntimeConnection | null>;
  /** Где оператор нажал скрипт (по серверному id) — туда же ляжет отказ ACTION_DENIED. */
  actionPointsRef: RefObject<Map<number, ScreenPoint | undefined>>;
  flushRef: RefObject<() => void>;
  /** Песочница скриптов движка (общая с привязками); null — движок не активен. */
  sandboxRef: RefObject<ScriptSandbox | null>;
}

/**
 * Действия монитора: запуск серверного скрипта (единая точка отказа по правам), обработчики
 * событий фигур, мост записи оператора в ПЛК — и их регистрация в шине, пока движок в живом
 * режиме. Плюс признак «связь есть» для интерфейса вне движка.
 */
export function useRuntimeActions({active, mode, status, buffers, connRef, actionPointsRef, flushRef, sandboxRef}: Params) {
  // Мост к серверному Java-скрипту: находим скрипт компонента по имени и шлём ACTION
  // по WS. sendAction ждёт ЧИСЛОВОЙ серверный id — ElementScript.id это String(серверный
  // id) после loadScene (см. transformElements); если id не число (напр. uuid у ещё не
  // сохранённого скрипта), команду не шлём.
  //
  // Вынесено из runEvent: тем же путём идут и пункты меню монитора (скрипты с
  // displayed), у которых события-повода нет, и пункты меню выбора `showMenu`.
  //
  // `args` уже проверены (normalizeActionArgs) — здесь только доставка.
  //
  // Это же — ЕДИНАЯ точка отказа по правам: кнопка с `onClick` вызывает runScript из JS, и
  // имя скрипта известно только при выполнении, заранее такую кнопку не погасить. Поэтому
  // без «управления» или с уровнем ниже `access_level` ACTION не уходит, а у точки нажатия
  // появляется причина. Сервер проверяет то же самое (по prod) и ответит ACTION_DENIED.
  const runScriptOn = useCallback((el: DiagramElement, name: string, args?: ActionArgs, point?: ScreenPoint) => {
    const script = el.scripts?.find(s => s.name === name);
    if (!script) {
      console.warn(`[monitor:event] runScript: скрипт «${name}» не найден у «${el.label ?? el.key}»`);
      return;
    }
    const denial = actionDenialText(getCurrentProjectGrant(), script.accessLevel);
    if (denial) {
      log(`runScript «${name}» не отправлен: ${denial}`);
      if (!showRuntimeNotice(denial, point)) toast.warning(denial);
      return;
    }
    const scriptId = Number(script.id);
    if (!Number.isFinite(scriptId)) {
      console.warn(`[monitor:event] runScript: у скрипта «${name}» нет числового серверного id (${script.id})`);
      return;
    }
    // Запоминаем, где нажали: ACTION_DENIED несёт только scriptId.
    actionPointsRef.current.set(scriptId, point);
    connRef.current?.sendAction(scriptId, args);
  }, [connRef, actionPointsRef]);

  // Пункт меню монитора: запуск скрипта по ключу элемента и имени скрипта.
  const runScriptByKey = useCallback((elementKey: string, scriptName: string, args?: ActionArgs, point?: ScreenPoint) => {
    const el = getSceneView().elements.find(e => e.key === elementKey);
    if (!el) return;
    runScriptOn(el, scriptName, args, point);
  }, [runScriptOn]);

  // Живая сессия обработчиков: новый объект на каждую регистрацию в шине. Песочница общая для
  // живого режима и архива, поэтому поздний ответ клика сверяем ещё и с этим — в архиве он
  // не должен ни запустить действие, ни поменять вид элемента.
  const liveRef = useRef<object | null>(null);

  // Обработчик кликов по фигурам в мониторе (из слоя интеракции Canvas): element.events[event]
  // выполняется в песочнице (#20 п. 1) над значениями скоупа на момент клика; результат —
  // записи свойств, интенты и вызовы runScript — применяет страница (applyEventResult).
  const runEvent = useCallback((elementKey: string, event: ElementEventName, point?: ScreenPoint) => {
    const sandbox = sandboxRef.current;
    const live = liveRef.current;
    const {elements} = getSceneView();
    const el = elements.find(e => e.key === elementKey);
    const handler = el?.events?.find(e => e.event_type === event)?.handler;
    if (!sandbox || !live || !el || !handler || !handler.code?.trim()) return;

    const scope = withPropertyRefs(collectTagScope(el.properties), handler.propertyRefs);
    const id = `${el.key}:${event}`;
    const name = el.label ?? el.key;
    void sandbox.runEventOnce({id, elementKey: el.key, handler, scope}, scopeValues(scope, buffers), getRenderedElement(el))
      .then(result => {
        // Пока ждали ответа, схема могла смениться (или монитор — уйти из живого режима):
        // поздний результат на другую схему не кладём — ни записей, ни ACTION, ни перехода.
        if (sandboxRef.current !== sandbox || liveRef.current !== live || getSceneView().elements !== elements) {
          log(`событие ${event} по «${name}»: схема сменилась, результат отброшен`);
          return;
        }
        if ("error" in result) {
          const what = result.stage === "compile" ? "не скомпилирован" : "ошибка исполнения";
          console.warn(`[monitor:event] ${event} «${name}» ${what}: ${result.error}`);
          return;
        }
        // onClick вызывает runScript("Имя", args?) — тот же мост, что и у пунктов меню монитора.
        const runScript = (scriptName: string, args?: ActionArgs) => runScriptOn(el, scriptName, args, point);
        applyEventResult({el, event, point, result, buffers, runScript, flush: () => flushRef.current()});
      })
      .catch(err => {
        if (err instanceof SandboxTimeoutError) {
          const text = `Обработчик «${name}» не ответил за ${SANDBOX_TIMEOUTS.event / 1000} с и остановлен — проверьте циклы`;
          console.warn(`[monitor:event] ${event}: ${text}`);
          if (!showRuntimeNotice(text, point)) toast.warning(text);
        } else {
          // Воркер перезапущен из-за чужого зависания или закрыт при выходе из живого режима.
          log(`событие ${event} по «${name}» не выполнено: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
  }, [runScriptOn, buffers, flushRef, sandboxRef]);

  /**
   * Значения, записанные оператором в ПЛК («Опции»), вливаются в общий поток ОДИН раз.
   *
   * Немедленно, а не со следующим кадром: иначе записанное появилось бы на схеме, только
   * когда (и если) по тегу придёт очередное сообщение — у редко меняющихся тегов это
   * минуты. Кладём в тот же буфер, что и телеметрия, и синхронно зовём flush — приём из
   * runEvent. Предзаписывать buffers.values НЕЛЬЗЯ: no-op-страж во flush счёл бы изменение
   * отсутствующим и ни одна привязка не сработала бы.
   *
   * Приоритета у записанного значения нет — первый же кадр по этому тегу его вытеснит.
   * Тег после записи волен меняться скриптом, другим оператором или самим контроллером.
   */
  const onTagsWritten = useCallback((writes: {tagId: string; value: string}[]) => {
    ingestOperatorWrites(buffers, writes);
    flushRef.current();
  }, [buffers, flushRef]);

  // Регистрируем обработчики в шине, пока движок активен: события (клик по фигуре),
  // прямой запуск скрипта (пункт меню монитора), чтение текущих значений тегов и
  // уведомление о записи значений в ПЛК.
  //
  // В архиве — не регистрируем ничего: записи в ПЛК там невозможны по построению, и клик,
  // дошедший до скрипта, не должен ни запустить действие, ни поменять вид элемента.
  useEffect(() => {
    if (!active || mode !== "live") return;
    liveRef.current = {};
    setRuntimeEventHandler(runEvent);
    setRuntimeScriptHandler(runScriptByKey);
    // Значения тегов держит движок, а не стор — окно «Опции» читает их геттером.
    setRuntimeValueGetter(tagId => buffers.values.get(tagId));
    // Инспектор объектов: значения локальных свойств и качество тегов — не только открытой
    // схемы. Свойства приходят по всему проекту; теги вне схемы — только те, что инспектор
    // зарегистрировал в runtimeTagInterest (иначе подписка на сцену их не присылает).
    setRuntimePropertyValueGetter(id => buffers.valuesByProp.get(id));
    setRuntimeTagQualityGetter(tagId => buffers.tagMeta.get(tagId)?.quality);
    setRuntimeTagWriteHandler(onTagsWritten);
    setRuntimeSessionGetter(() => connRef.current?.getSessionId() ?? null);
    return () => {
      liveRef.current = null;
      setRuntimeEventHandler(null);
      setRuntimeScriptHandler(null);
      setRuntimeValueGetter(null);
      setRuntimePropertyValueGetter(null);
      setRuntimeTagQualityGetter(null);
      setRuntimeTagWriteHandler(null);
      setRuntimeSessionGetter(null);
    };
  }, [active, mode, runEvent, runScriptByKey, onTagsWritten, buffers, connRef]);

  // Признак «связь есть» для интерфейса вне движка (пункты меню монитора).
  useEffect(() => {
    setRuntimeLive(mode === "live" && status === "live");
    return () => setRuntimeLive(false);
  }, [mode, status]);
}
