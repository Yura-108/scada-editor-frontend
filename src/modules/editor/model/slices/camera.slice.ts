import type {DiagramElement, ElementType} from "@/types/editorElement.type";
// переедут в core/scene вместе с геометрией (шаг 8)
import {getElementIndex} from "@/lib/editor/elementIndex";
import {getElementBoundsRendered} from "@/lib/getElementBounds";
import {cameraToReveal} from "@/lib/editor/revealCamera";

/**
 * Зона «Камера и холст» стора редактора: что видно на холсте и чем «вооружён» курсор.
 * Ничего отсюда не попадает ни в undo, ни в сохранение — `partialize` стора берёт только
 * `elements`. Вид для монитора (`setMonitorView`) и размер листа (`setSheet`) — данные
 * сцены, поэтому они не здесь, а в документе.
 *
 * Слайс — часть единого `useEditorStore` (docs/architecture.md, шаг 6): другие зоны могут
 * писать `camera` своим `set()` (например, при загрузке сцены), здесь — только свои экшены.
 */
export interface CameraSlice {
  camera: {x: number, y: number, zoom: number};
  setCameraPan: (dx: number, dy: number) => void;
  setCameraZoom: (newZoom: number) => void;
  setCamera: (x: number, y: number, zoom: number) => void;
  /**
   * Подвести камеру к элементу, если он вне видимой области (иначе ничего не делает).
   * Для панели «Слои»: выделение само по себе холст не двигает, и выбранный элемент
   * мог оказаться далеко за краем экрана.
   */
  ensureElementVisible: (key: string) => void;

  canvasRect: DOMRect | null;
  setCanvasRect: (rect: DOMRect) => void;

  /**
   * «Вооружённый» инструмент палитры: клик по элементу палитры сохраняет сюда его
   * тип/шаблон, следующий клик по холсту ставит элемент в эту точку и сбрасывает
   * pendingPlacement в null (постановка по одному). id — id элемента палитры (для
   * подсветки именно его и toggle). Не попадает в историю undo (не меняет elements).
   */
  pendingPlacement: { id: number; type: ElementType; template?: DiagramElement[] } | null;
  setPendingPlacement: (p: { id: number; type: ElementType; template?: DiagramElement[] } | null) => void;
}

/** Что слайсу нужно от остального стора. */
type CameraDeps = CameraSlice & {elements: DiagramElement[]};

type CameraSet = (
  partial: Partial<CameraSlice> | ((state: CameraDeps) => Partial<CameraSlice>),
) => void;

export const createCameraSlice = (set: CameraSet, get: () => CameraDeps): CameraSlice => ({
  camera: {x: 0, y: 0, zoom: 1},
  setCameraPan: (dx, dy) => {
    set(state => ({
      camera: {...state.camera, x: state.camera.x + dx, y: state.camera.y + dy}
    }))
  },
  setCameraZoom: (newZoom) => {
    set(state => ({
      camera: {...state.camera, zoom: newZoom}
    }))
  },
  setCamera: (x, y, zoom) => set({camera: {x, y, zoom}}),

  ensureElementVisible: (key) => {
    const {elements, canvasRect, camera} = get();
    if (!canvasRect) return;
    const el = getElementIndex(elements).byKey[key];
    if (!el) return;
    const next = cameraToReveal(getElementBoundsRendered(el, elements), camera, canvasRect);
    // null — элемент уже виден. Пишем только реальное движение: лишний set()
    // перерисовал бы холст на ровном месте.
    if (next) set({camera: next});
  },

  canvasRect: null,
  setCanvasRect: (rect) => set({canvasRect: rect}),

  pendingPlacement: null,
  setPendingPlacement: (p) => set({pendingPlacement: p}),
});
