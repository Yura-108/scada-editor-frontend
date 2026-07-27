# Graph Report - .  (2026-07-27)

## Corpus Check
- 238 files · ~94 359 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 770 nodes · 1429 edges · 50 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output
- Edge kinds: contains: 494 · imports: 427 · imports_from: 418 · calls: 47 · references: 21 · shares_data_with: 14 · implements: 3 · inherits: 3 · conceptually_related_to: 1 · re_exports: 1

## God Nodes (most connected - your core abstractions)
1. `useEditorStore` - 36 edges
2. `getRenderedElement()` - 32 edges
3. `cn()` - 32 edges
4. `protectedRoute()` - 20 edges
5. `useDeviceStore` - 18 edges
6. `ShapeElementProps` - 14 edges
7. `useModalStore` - 13 edges
8. `selectTriggerClassName` - 7 edges
9. `createUuid()` - 7 edges
10. `getElementBoundsRendered()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `TagBinding type {v,id,name,enabled,code,triggers}` --shares_data_with--> `buildComponentTree.ts (Save)`  [INFERRED]
  PHASE4_RUNTIME_PLAN.md → CLAUDE.md
- `TagBinding type {v,id,name,enabled,code,triggers}` --shares_data_with--> `transformElements.ts (Load)`  [INFERRED]
  PHASE4_RUNTIME_PLAN.md → CLAUDE.md
- `groupSelected fast-path fix (composition-aware)` --shares_data_with--> `groupSelected() implementation detail`  [INFERRED]
  ROADMAP.md → selection_summary.txt
- `/monitor route (separate from editor)` --shares_data_with--> `useEditorStore (Zustand)`  [INFERRED]
  PHASE4_RUNTIME_PLAN.md → CLAUDE.md
- `runtimeConnection.ts / openRuntimeConnection` --references--> `protectedRoute()`  [INFERRED]
  PHASE4_RUNTIME_PLAN.md → CLAUDE.md

## Hyperedges (group relationships)
- **Клик кнопки -> серверный скрипт (ACTION flow)** — runtimeintegration_sendAction, runtimeintegration_runScript_function, phase4_useRuntimeEngine, runtimeintegration_writeTag [INFERRED 0.80]
- **Bake/unbake serialization round-trip (composition + bindings)** — claudemd_buildComponentTree, claudemd_transformElements, phase4_TagBinding_type [INFERRED 0.85]
- **Группа vs Компонент — создание/разбор** — claudemd_createComponentFromGroup, claudemd_disassembleComponent, claudemd_groupSelected, selection_groupSelected_impl [INFERRED 0.80]

## Communities

### Community 0 - "Runtime Bindings & Scripts Engine"
Cohesion: 0.05
Nodes (55): BindingsTab(), BindingsTabProps, BindingEditorModalContent(), BindingEditorProps, buildTemplate(), openBindingEditorModal(), TestResult, ChooseObjectPropertyModal() (+47 more)

### Community 1 - "Backend API Route Handlers"
Cohesion: 0.05
Nodes (30): POST, DELETE, GET, POST, GET, POST, GET, GET (+22 more)

### Community 2 - "Editor Store & Layout Core"
Cohesion: 0.06
Nodes (28): Props, Editor, EditorHotkeysDeps, useEditorHotkeys(), elementToGroupLocal(), layoutGroupFromBounds(), resolveParentAbsolute(), snapshotBounds() (+20 more)

### Community 3 - "App Shell & Providers"
Cohesion: 0.08
Nodes (16): geist, inter, queryClient, navItems, getUser(), WebSocketProvider(), ModalRoot(), MultiSelect() (+8 more)

### Community 4 - "Canvas Shape Elements"
Cohesion: 0.12
Nodes (18): EditorRenderContext, ShapeElementProps, Anchor(), AnchorProps, ButtonShapeElement(), ChartShapeElement(), DEMO_BAR_LABELS, DEMO_BAR_VALUES (+10 more)

### Community 5 - "Canvas Rendering Core"
Cohesion: 0.10
Nodes (18): CanvasContextMenu(), CanvasContextMenuProps, CanvasMenuItem, ThemeColors, useThemeColors(), ZoomControls(), ZoomControlsProps, CanvasProps (+10 more)

### Community 6 - "Editor Side Panels"
Cohesion: 0.10
Nodes (16): LayersPanel(), TYPE_ICONS, MultiPropertiesPanel(), PropertiesPanel(), TabType, AlarmLogPanel(), EditorPanel(), EditorPanelProps (+8 more)

### Community 7 - "SVG Primitive Shapes"
Cohesion: 0.09
Nodes (13): Props, Button(), ButtonProps, Checkbox(), CheckboxProps, CircleProps, PathProps, PolygonProps (+5 more)

### Community 8 - "Device/Channel Modals"
Cohesion: 0.13
Nodes (14): useDeviceStore, Props, PropertyType, propertyTypeOptions, Props, valueTypeOptions, Props, Props (+6 more)

### Community 9 - "Component Grouping Modals"
Cohesion: 0.11
Nodes (12): elementRegistry, getDescendants(), AddComponentModal(), AddComponentModalProps, ModalProps, MoveToGroupModal(), MoveToGroupModalProps, Select() (+4 more)

### Community 10 - "Runtime Binding Architecture (docs)"
Cohesion: 0.10
Nodes (25): buildComponentTree.ts (Save), protectedRoute(), transformElements.ts (Load), BindingsTab / BindingEditorModal UI, ComponentCreateDto (bindings, component_property_id), TagBinding type {v,id,name,enabled,code,triggers}, applyRuntimeBatch({stateNameByKey, propsByKey}), buildBindingIndex(elements) (+17 more)

### Community 11 - "Component Palette & Templates"
Cohesion: 0.12
Nodes (15): paletteItems, PaletteItemProps, buildBaseImage(), buildComponentNode(), buildComponentTree(), buildPaletteComponentTree(), buildShapeDescriptor(), buildSingleComponentTree() (+7 more)

### Community 12 - "Group vs Component Lifecycle"
Cohesion: 0.10
Nodes (22): isComponentEl / isLeafPrimitive classifiers, createComponentFromGroup ("Создать компонент"), disassembleComponent, groupSelected, sceneBelongsToCurrentProject guard, useEditorStore (Zustand), MonitorClient.tsx, clearRuntime() action (+14 more)

### Community 13 - "Canvas Context Menu & Interactions"
Cohesion: 0.15
Nodes (11): buildItemMenu(), BuildItemMenuDeps, DeviceAction, editorElementMenuItems, editorGroupMenuItems, ParamAction, handleAddProperty(), DynamicContextMenu() (+3 more)

### Community 14 - "Device Parameters UI"
Cohesion: 0.15
Nodes (10): paramMenuItems, isParamChecked(), ParamWidget, resolveParamWidget(), TRUTHY, isEditingDevice(), useUnlockEditingOnUnload(), DeviceParamsType (+2 more)

### Community 15 - "Element Geometry Helpers"
Cohesion: 0.18
Nodes (9): HoverHighlightDeps, useHoverHighlight(), getAbsoluteRenderedPosition(), getElementBounds(), getRenderedElement(), ElementBounds, POSITION_OVERRIDE_KEYS, InputShapeElement() (+1 more)

### Community 16 - "Logs Feature"
Cohesion: 0.16
Nodes (5): formatLocalDateTime(), getDescription(), LogsState, useLogsStore, LogDetailsModalProps

### Community 17 - "Properties & Events Panel"
Cohesion: 0.16
Nodes (13): basePropertySchema, elementPropertyMap, MultiPropertiesPanelProps, PropertiesPanelProps, TabType, EVENTS, EventsTab(), EventsTabProps (+5 more)

### Community 18 - "Monitor Interaction & Stage Hooks"
Cohesion: 0.16
Nodes (12): findHandler(), hasScript(), isInteractive(), MonitorInteractionLayer(), Props, SelectionRect, getAbsoluteRenderedPos(), getSelectionBounds() (+4 more)

### Community 19 - "Modal Infrastructure"
Cohesion: 0.22
Nodes (8): cn(), ModalOptions, ModalState, ModalVariant, useModalStore, TitleWithHint(), InputModalProps, ScriptModalProps

### Community 20 - "Scene Load & Parsing"
Cohesion: 0.17
Nodes (8): isTagBinding(), parseBindings(), EVENT_NAMES, isEnvelopedHandler(), parseEvents(), BackendPropertyDto, BackendStateDto, ComponentDto

### Community 21 - "Device Tree Search"
Cohesion: 0.20
Nodes (8): treeSearch(), DeviceStoreState, NodeParamType, NodeType, OpenCreateProjectModal(), OpenCreateSiteModal(), Props, OpenCreateDeviveModal()

### Community 22 - "Channels Device Tree"
Cohesion: 0.15
Nodes (7): nodeMenuItems, DeviceNodeType, DeviceParamsFromAddFunc, DeviceParamsLayoutType, DeviceTreeResponse, nodeType, ParamType

### Community 23 - "Drag Guides & Zoom"
Cohesion: 0.21
Nodes (9): collectGuideCandidates(), findGuideMatch(), GuideCandidates, GuideMatch, MultiDragAndGuidesDeps, useMultiDragAndGuides(), useZoomControls(), ZoomControlsDeps (+1 more)

### Community 24 - "Editor Toolbar & Project Modals"
Cohesion: 0.24
Nodes (5): useEditorStore, usePaletteStore, openChooseSceneModal(), Props, openProjectModal()

### Community 25 - "Editor Element Type Definitions"
Cohesion: 0.20
Nodes (11): BaseCanvasElement, CanvasSchema, ComponentCreateDto, ComponentState, DiagramElement, ElementScript, ElementType, GroupElement (+3 more)

### Community 26 - "Login/Register Forms"
Cohesion: 0.28
Nodes (4): LoginFormData, FormData, loginSchema, registerSchema

### Community 27 - "Image Element Placement"
Cohesion: 0.39
Nodes (5): PendingPlacementDeps, usePendingPlacement(), fitImageSize(), pickImageFile(), ImageShapeElement()

### Community 28 - "Binding Type Definitions"
Cohesion: 0.25
Nodes (7): BindingDto, ElementEventEntry, ElementEventHandler, ElementEventName, ElementEvents, PropertyRef, TagBinding

### Community 29 - "Palette DTO Types"
Cohesion: 0.29
Nodes (6): ComponentCreateDTO, ComponentsResponseDTO, ComponentStateResponseDTO, PaletteItemCreateDTO, PaletteItemResponseDTO, PaletteItemType

### Community 30 - "Auth API Routes"
Cohesion: 0.47
Nodes (1): callAuth()

### Community 31 - "Next.js Middleware Proxy"
Cohesion: 0.40
Nodes (3): authRoutes, config, protectedRoutes

### Community 32 - "Context Menu Types"
Cohesion: 0.50
Nodes (3): ContextMenuItem, ContextMenuProps, ContextMenuType

### Community 33 - "Multi-select with Edit Component"
Cohesion: 0.50
Nodes (2): MultiSelectWithEditProps, Option

### Community 34 - "Tree Node Title Renderer"
Cohesion: 0.50
Nodes (2): TitleRenderer, TitleRendererProps

### Community 35 - "Add Device Param Modal"
Cohesion: 0.67
Nodes (1): AddParamModalProps

### Community 36 - "Canvas Architecture Docs"
Cohesion: 0.67
Nodes (3): Canvas.tsx (thin orchestrator), canvas/ render modules (ShapeElement, GroupNode, EditorRenderContext, useStageInteractions), getRenderedElement(el)

### Community 37 - "rewrite.js Utility Script"
Cohesion: 0.67
Nodes (2): code, fs

### Community 38 - "Tag Property DTOs"
Cohesion: 1.00
Nodes (2): PropertyCreateDto, PropertyCreateRequestDto

### Community 39 - "Modal Layout Wrapper"
Cohesion: 0.67
Nodes (1): ModalProps

### Community 44 - "ESLint Config"
Cohesion: 1.00
Nodes (1): eslintConfig

### Community 47 - "Next.js Config"
Cohesion: 1.00
Nodes (1): nextConfig

### Community 48 - "Dormant STOMP WebSocket Client"
Cohesion: 1.00
Nodes (2): safeSubscribeDeviceTree.ts (dead code, unused), wsClient.ts STOMP/SockJS client (dormant, for device base)

### Community 49 - "PostCSS Config"
Cohesion: 1.00
Nodes (1): config

### Community 50 - "Device Tree Selection (docs)"
Cohesion: 1.00
Nodes (2): DeviceTreePanel (rc-tree), useDeviceStore.selectedDevice (single selection)

### Community 51 - "Log Entry Type"
Cohesion: 1.00
Nodes (1): LogEntry

### Community 57 - "Tags Route Fix Note"
Cohesion: 1.00
Nodes (1): PUT /api/editor/tags/[id] route (was 404)

### Community 58 - "Undo History Reset Note"
Cohesion: 1.00
Nodes (1): temporal.clear() on loadScene/createScene/setCurrentProject

### Community 59 - "Optimistic Concurrency TODO"
Cohesion: 1.00
Nodes (1): version:0 hardcoded (no optimistic concurrency)

### Community 60 - "Server writeTag() Function"
Cohesion: 1.00
Nodes (1): writeTag() server-side function

## Knowledge Gaps
- **203 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `fs`, `code` (+198 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Auth API Routes`** (1 nodes): `callAuth()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Multi-select with Edit Component`** (2 nodes): `MultiSelectWithEditProps`, `Option`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tree Node Title Renderer`** (2 nodes): `TitleRenderer`, `TitleRendererProps`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Add Device Param Modal`** (1 nodes): `AddParamModalProps`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `rewrite.js Utility Script`** (2 nodes): `code`, `fs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tag Property DTOs`** (2 nodes): `PropertyCreateDto`, `PropertyCreateRequestDto`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Modal Layout Wrapper`** (1 nodes): `ModalProps`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ESLint Config`** (1 nodes): `eslintConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `nextConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dormant STOMP WebSocket Client`** (2 nodes): `safeSubscribeDeviceTree.ts (dead code, unused)`, `wsClient.ts STOMP/SockJS client (dormant, for device base)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Device Tree Selection (docs)`** (2 nodes): `DeviceTreePanel (rc-tree)`, `useDeviceStore.selectedDevice (single selection)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Log Entry Type`** (1 nodes): `LogEntry`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tags Route Fix Note`** (1 nodes): `PUT /api/editor/tags/[id] route (was 404)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Undo History Reset Note`** (1 nodes): `temporal.clear() on loadScene/createScene/setCurrentProject`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Optimistic Concurrency TODO`** (1 nodes): `version:0 hardcoded (no optimistic concurrency)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Server writeTag() Function`** (1 nodes): `writeTag() server-side function`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Modal Infrastructure` to `App Shell & Providers`, `Runtime Bindings & Scripts Engine`, `Editor Side Panels`, `Properties & Events Panel`, `SVG Primitive Shapes`, `Logs Feature`, `Device/Channel Modals`, `Editor Toolbar & Project Modals`, `Device Tree Search`, `Component Grouping Modals`, `Tree Node Title Renderer`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `useEditorStore` connect `Editor Toolbar & Project Modals` to `Runtime Bindings & Scripts Engine`, `Canvas Context Menu & Interactions`, `Canvas Rendering Core`, `Editor Store & Layout Core`, `Editor Side Panels`, `Properties & Events Panel`, `Component Palette & Templates`, `Image Element Placement`, `Monitor Interaction & Stage Hooks`, `Drag Guides & Zoom`, `Element Geometry Helpers`, `Canvas Shape Elements`, `Component Grouping Modals`, `Device/Channel Modals`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `getRenderedElement()` connect `Element Geometry Helpers` to `Runtime Bindings & Scripts Engine`, `Monitor Interaction & Stage Hooks`, `Canvas Context Menu & Interactions`, `Properties & Events Panel`, `SVG Primitive Shapes`, `Canvas Shape Elements`, `Canvas Rendering Core`, `Image Element Placement`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _203 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Runtime Bindings & Scripts Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05052631578947368 - nodes in this community are weakly interconnected._
- **Should `Backend API Route Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.05152394775036284 - nodes in this community are weakly interconnected._
- **Should `Editor Store & Layout Core` be split into smaller, more focused modules?**
  _Cohesion score 0.056429232192414434 - nodes in this community are weakly interconnected._