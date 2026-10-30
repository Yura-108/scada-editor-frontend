/**
 * Статусные цвета общих компонентов (`Badge`, `Banner`). Одна таблица на всех: значок
 * «Работает» и плашка об ошибке берут тон отсюда, а не подбирают оттенок по месту —
 * так раньше и разошлись `amber-600`, `amber-700` и `amber-800` у одного предупреждения.
 */
export type Tone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info";

interface ToneStyle {
  /** Текст и значок тона. */
  text: string;
  /** Мягкий фон блока (плашка). */
  soft: string;
  /** Фон погуще — для маленьких значков, которые иначе теряются. */
  strong: string;
  border: string;
  /**
   * Тот же мягкий фон, но поверх непрозрачной подложки: всплывающая плашка висит над
   * холстом, и полупрозрачный фон пропускал бы схему. Ставится вместе с `bg-card`.
   */
  tint: string;
}

export const toneStyles: Record<Tone, ToneStyle> = {
  neutral: {
    text: "text-muted-foreground",
    soft: "bg-muted",
    strong: "bg-muted",
    border: "border-border",
    tint: "bg-linear-to-r from-muted to-muted",
  },
  primary: {
    text: "text-primary",
    soft: "bg-primary/10",
    strong: "bg-primary/15",
    border: "border-primary/30",
    tint: "bg-linear-to-r from-primary/10 to-primary/10",
  },
  success: {
    text: "text-success",
    soft: "bg-success/10",
    strong: "bg-success/15",
    border: "border-success/30",
    tint: "bg-linear-to-r from-success/10 to-success/10",
  },
  warning: {
    text: "text-warning",
    soft: "bg-warning/10",
    strong: "bg-warning/15",
    border: "border-warning/30",
    tint: "bg-linear-to-r from-warning/10 to-warning/10",
  },
  destructive: {
    text: "text-destructive",
    soft: "bg-destructive/10",
    strong: "bg-destructive/15",
    border: "border-destructive/30",
    tint: "bg-linear-to-r from-destructive/10 to-destructive/10",
  },
  info: {
    text: "text-info",
    soft: "bg-info/10",
    strong: "bg-info/15",
    border: "border-info/30",
    tint: "bg-linear-to-r from-info/10 to-info/10",
  },
};
