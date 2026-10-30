"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/shared/lib/cn"
import { usePortalContainer } from "../portalContainer"
import { useFieldContext } from "./Field"
import { fieldBase, type FieldSize } from "./fieldStyles"

/** Пункт простого списка: `value` уходит в `onValueChange`, `label` — то, что видно. */
export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

// Radix запрещает пункт со значением "" (им он обозначает «ничего не выбрано»), а в наших
// списках пустое значение бывает осмысленным — «Без проверки», «Все». Такой пункт внутри
// получает служебное значение, наружу по-прежнему уходит "".
const EMPTY = "__empty__"

type SelectProps = Omit<React.ComponentProps<typeof SelectPrimitive.Root>, "value" | "defaultValue" | "onValueChange"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Задан — список рисуется сам (триггер + пункты); не задан — из `children`, по частям. */
  options?: SelectOption[]
  placeholder?: string
  size?: FieldSize
  id?: string
  className?: string
  /** Подсказка и подпись для скринридера — на триггер (корень Radix в DOM не рисуется). */
  title?: string
  "aria-label"?: string
}

/**
 * Выпадающий список приложения — один на все экраны (Radix).
 *
 * Простой случай — `<Select value onValueChange options placeholder />`. Пункты с иконкой или
 * разметкой собираются из частей: `<Select><SelectTrigger/><SelectContent><SelectItem/>…`.
 */
function Select({ options, placeholder, size = "md", id, className, title, "aria-label": ariaLabel, value, defaultValue, onValueChange, children, ...props }: SelectProps) {
  if (!options) {
    return (
      <SelectPrimitive.Root data-slot="select" value={value} defaultValue={defaultValue} onValueChange={onValueChange} {...props}>
        {children}
      </SelectPrimitive.Root>
    )
  }
  const hasEmpty = options.some((o) => o.value === "")
  const encode = (v: string | undefined) => (hasEmpty && v === "" ? EMPTY : v)
  return (
    <SelectPrimitive.Root
      data-slot="select"
      value={encode(value)}
      defaultValue={encode(defaultValue)}
      onValueChange={(v) => onValueChange?.(v === EMPTY ? "" : v)}
      {...props}
    >
      <SelectTrigger id={id} size={size} className={className} title={title} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={encode(o.value)!} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectPrimitive.Root>
  )
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

/** Триггер — та же рамка и высота, что у `Input`. Внутри `Field` подписан его подписью. */
function SelectTrigger({
  className,
  size = "md",
  id,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: FieldSize
}) {
  const field = useFieldContext()
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      id={id ?? field?.id}
      aria-labelledby={field?.labelId}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        fieldBase,
        "flex items-center justify-between gap-1.5 text-left text-sm whitespace-nowrap select-none",
        "data-placeholder:text-muted-foreground",
        "data-[size=md]:h-10 data-[size=md]:pl-3 data-[size=md]:pr-2.5",
        "data-[size=sm]:h-8 data-[size=sm]:pl-2.5 data-[size=sm]:pr-2",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

/** Список раскрывается под триггером, шириной не меньше его (`popper`). */
function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  const container = usePortalContainer()
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "relative z-dropdown max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin)",
          "overflow-x-hidden overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        position={position}
        align={align}
        sideOffset={sideOffset}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className="p-1 data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)"
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none",
        "focus:bg-accent focus:text-accent-foreground data-[state=checked]:font-medium",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-primary">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn("z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn("z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
