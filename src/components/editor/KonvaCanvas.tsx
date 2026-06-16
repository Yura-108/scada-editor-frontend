"use client";

import React, {useMemo, useRef, useEffect, useState} from "react";
import {useDroppable} from "@dnd-kit/core";
import {useEditorStore} from "@/store/useEditorStore";
import {GRID} from "@/lib/utils";
import {DiagramElement, GroupElement, LeafElement} from "@/types/editorElement.type";
import isIntersecting from "@/lib/isIntersecting";
import {Stage, Layer, Rect, Circle, Line, Text, Group, Path} from "react-konva";
import Konva from "konva";
import {DynamicContextMenu} from "@/components/ui/ContextMenuRadixUI";
import {editorElementMenuItems} from "@/constants/contextMenuItems";
import {getDescendants} from "@/lib/getDescendants";
import {OpenCreateFaceplateModal} from "@/components/ui/OpenCreateFaceplateModal";
import {handleAddProperty} from "@/lib/handleAddProperty";
import {getRenderedElement} from "@/lib/getRenderedElement";
import {Html} from "react-konva-utils";

export default function Canvas() {
  // Logic here
  return <div></div>;
}

