import * as Select from "@radix-ui/react-select";
import {cn} from "@/lib/utils";
import {Check} from "lucide-react";
import React from "react";

export default function SelectItem({ children, ...props }: React.ComponentProps<typeof Select.Item>) {
  return (
    <Select.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-lg px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 outline-none",
        "data-highlighted:bg-gray-100 dark:bg-gray-800 data-[state=checked]:bg-gray-100 dark:bg-gray-800/60"
      )}
      {...props}
    >
      <Select.ItemText>{children}</Select.ItemText>
      <Select.ItemIndicator className="absolute right-3 inline-flex items-center">
        <Check className="h-4 w-4 text-indigo-500" />
      </Select.ItemIndicator>
    </Select.Item>
  );
}

