import os, re
rules = {
    "bg-neutral-950": "bg-neutral-50 dark:bg-neutral-950",
    "bg-neutral-900": "bg-white dark:bg-neutral-900",
    "bg-neutral-800": "bg-neutral-100 dark:bg-neutral-800",
    "border-neutral-800": "border-neutral-200 dark:border-neutral-800",
    "border-neutral-700": "border-neutral-300 dark:border-neutral-700",
    "text-neutral-200": "text-neutral-800 dark:text-neutral-200",
    "text-neutral-300": "text-neutral-700 dark:text-neutral-300",
    "text-neutral-400": "text-neutral-600 dark:text-neutral-400",
    "bg-gray-950": "bg-gray-50 dark:bg-gray-950",
    "bg-gray-900": "bg-white dark:bg-gray-900",
    "bg-gray-800": "bg-gray-100 dark:bg-gray-800",
    r"bg-\[\#0d0d0d\]": "bg-white dark:bg-[#0d0d0d]",
    r"bg-\[\#0f0f1a\]": "bg-white dark:bg-[#0f0f1a]",
    "border-gray-900": "border-gray-200 dark:border-gray-900",
    "border-gray-800": "border-gray-200 dark:border-gray-800",
    "border-gray-700": "border-gray-300 dark:border-gray-700",
    "text-gray-200": "text-gray-800 dark:text-gray-200",
    "text-gray-300": "text-gray-700 dark:text-gray-300",
    "text-gray-400": "text-gray-600 dark:text-gray-400",
}
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            original = content
            for old, new in rules.items():
                pattern = r"(?<!dark:)" + old.replace("[", r"\[").replace("]", r"\]")
                content = re.sub(pattern, new, content)
                content = content.replace(f"dark:{new}", new)
            if content != original:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
print("Done Python")
