// Общее для редактора и монитора: отображаемый вид элемента, геометрия, лист и вид,
// сериализация. Внутри core/scene файлы импортируют друг друга относительно, а не
// через этот index — иначе index замкнул бы цикл сам на себя.
export {useRuntimeOverlayStore} from "./runtimeOverlayStore";
export {bindActiveStateReader, readActiveStates} from "./activeStates";
export {bindSceneViewStore, getSceneView, useSceneView, type SceneViewState, type SceneViewStore} from "./sceneView";
export type {ArchiveSeries, TrendPoint} from "./trendTypes";

// Отображаемый вид
export * from "./render/getRenderedElement";

// Элемент и индекс схемы
export * from "./element/elementIndex";
export * from "./element/dashArray";
export * from "./element/monitorMenu";
export * from "./element/trendSettings";
export * from "./element/curvePoints";
export * from "./element/tableBindings";
export * from "./element/tableCells";
export * from "./element/tableLayout";
export * from "./element/zOrder";
export * from "./element/trendGeometry";
export * from "./element/pickImageFile";

// Геометрия
export {default as getAbsolutePosition} from "./geometry/getAbsolutePosition";
export * from "./geometry/getElementBounds";
// ElementBounds здесь — тот же тип, что в getElementBounds, поэтому он не переэкспортируется.
export {
  GROUP_PADDING, resolveParentAbsolute, resolveParentAbsoluteIndexed, unionBounds, elementToGroupLocal,
  layoutGroupFromBounds, snapshotBounds,
} from "./geometry/groupLayout";
export * from "./geometry/boundsContributor";
export * from "./geometry/getAbsoluteRenderedPos";
export * from "./geometry/getSelectionBounds";
export * from "./geometry/viewportCulling";
export * from "./geometry/shiftPositions";
export * from "./geometry/measureText";
export * from "./geometry/grid";

// Лист и вид
export * from "./sheet/sheet";
export * from "./sheet/monitorView";
export * from "./sheet/revealCamera";
export * from "./sheet/zoomLimits";

// Сериализация
export * from "./serialization/buildComponentTree";
export {default as transformElements} from "./serialization/transformElements";
export * from "./serialization/transformElements";
export * from "./serialization/parseBindings";
export * from "./serialization/parseEvents";
export * from "./serialization/conturImport";
