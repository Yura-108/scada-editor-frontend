import Canvas from "@/components/editor/Canvas";

interface EditorPanelProps {
  /** Ширина открытой правой панели (px) — прокидывается в панель зума Canvas. */
  rightInset?: number;
}

export function EditorPanel({ rightInset = 0 }: EditorPanelProps) {
  return (
    <div className="h-full w-full">
      <Canvas controlsRightInset={rightInset} />
    </div>
  );
}
