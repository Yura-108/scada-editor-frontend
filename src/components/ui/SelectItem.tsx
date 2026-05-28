import * as Select from "@radix-ui/react-select";
import {cn} from "@/lib/utils";
import {Check} from "lucide-react";
import React from "react";
import {selectItemClassName} from "@/components/ui/selectStyles";

export default function SelectItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Select.Item>) {
  return (
    <Select.Item className={cn(selectItemClassName, className)} {...props}>
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
        <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}
