import {useCallback, useEffect, type RefObject} from "react";
import {toast} from "sonner";
import {devLog} from "@/shared/lib/devLog";
import {getRenderedElement, getSceneView, type DiagramElement, type ElementEventName} from "@/core/scene";
import {
  collectTagScope, compileEventScript, executeEventScript, setRuntimeEventHandler, setRuntimeLive,
  setRuntimePropertyValueGetter, setRuntimeScriptHandler, setRuntimeSessionGetter, setRuntimeTagQualityGetter,
  setRuntimeTagWriteHandler, setRuntimeValueGetter, showRuntimeMenu, showRuntimeNotice, withPropertyRefs,
  type ActionArgs, type ScreenPoint,
} from "@/core/runtime";
import {actionDenialText, getCurrentProjectGrant} from "@/core/access";
import type {RuntimeMode} from "./useRuntimeEngine";
import type {RuntimeConnection, RuntimeStatus} from "./runtimeConnection";
import {ingestOperatorWrites, type EngineBuffers} from "./engineBuffers";
import {openSceneFromScript} from "./openSceneFromScript";

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
}

/**
 * Действия монитора: запуск серверного скрипта (единая точка отказа по правам), обработчики
 * событий фигур, мост записи оператора в ПЛК — и их регистрация в шине, пока движок в живом
 * режиме. Плюс признак «связь есть» для интерфейса вне движка.
 */
export function useRuntimeActions({active, mode, status, buffers, connRef, actionPointsRef, flushRef}: Params) {
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

  // Обработчик кликов по фигурам в мониторе (из слоя интеракции Canvas):
  // компилирует и исполняет element.events[event], пишет свойства в общий буфер
  // и применяет self-интенты. Использует стабильные ref-ы — deps пустые.
  const runEvent = useCallback((elementKey: string, event: ElementEventName, point?: ScreenPoint) => {
    const store = getSceneView();
    const el = store.elements.find(e => e.key === elementKey);
    const handler = el?.events?.find(e => e.event_type === event)?.handler;
    if (!el || !handler || !handler.code?.trim()) return;

    const scope = withPropertyRefs(collectTagScope(el.properties), handler.propertyRefs);
    const compiled = compileEventScript(el.key, handler, scope);
    if ("error" in compiled) {
      console.warn(`[monitor:event] ${event} «${el.label ?? el.key}» не скомпилирован: ${compiled.error}`);
      return;
    }
    // onClick вызывает runScript("Имя", args?) — тот же мост, что и у пунктов меню монитора.
    const runScript = (name: string, args?: ActionArgs) => runScriptOn(el, name, args, point);

    const res = executeEventScript(compiled, buffers.values, buffers.valuesByProp, getRenderedElement(el), runScript);
    if ("error" in res) {
      console.warn(`[monitor:event] ${event} ошибка исполнения: ${res.error}`);
      return;
    }

    // Записи свойств → тот же буфер, что и WS properties[]: на них реагируют
    // биндинги других элементов. НЕ трогаем valuesByPropRef здесь: flush сравнивает
    // pending со «старым» valuesByPropRef, чтобы понять, что значение изменилось —
    // предварительная запись сделала бы изменение «no-op», и биндинги бы не сработали.
    // flush (вызывается синхронно ниже) сам обновит valuesByPropRef для следующего клика.
    for (const w of res.writes) {
      buffers.pendingProps.set(w.propertyId, w.value);
    }

    // Интенты setProp/setState — на сам элемент, применяем немедленно.
    if (res.intents.length) {
      const stateNameByKey: Record<string, string> = {};
      const propsByKey: Record<string, Record<string, unknown>> = {};
      for (const intent of res.intents) {
        if (intent.kind === "state") stateNameByKey[el.key] = intent.stateName;
        else (propsByKey[el.key] ??= {})[intent.key] = intent.value;
      }
      store.applyRuntimeBatch({stateNameByKey, propsByKey});
    }

    log(`событие ${event} по «${el.label ?? el.key}»: записей ${res.writes.length}, интентов ${res.intents.length}`);
    if (res.writes.length) flushRef.current();

    // Переход — последним: записи setProperty уже ушли во flush выше, а смена схемы
    // заменит elements, и применять интенты было бы уже не к чему.
    if (res.openScene !== undefined) {
      void openSceneFromScript(res.openScene, el.label ?? el.key);
      // Меню выбора поверх схемы, которая сейчас сменится, было бы не к месту.
      if (res.menu) console.warn(`[monitor:event] ${event} «${el.label ?? el.key}»: openScene и showMenu сразу — меню не показано`);
      return;
    }
    // Меню выбора рисует холст: пункт подтверждается и уходит через emitRuntimeScript.
    // Без точки клика (не из слоя интеракции) показывать его негде.
    if (res.menu && point) showRuntimeMenu({elementKey: el.key, point, items: res.menu});
  }, [runScriptOn, buffers, flushRef]);

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
