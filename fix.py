import os, re
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            original = content
            content = re.sub(r"bg-white\s*(dark:)?(?:bg-white\s*)+", "bg-white ", content)
            content = re.sub(r"bg-neutral-50\s*(dark:)?(?:bg-neutral-50\s*)+", "bg-neutral-50 ", content)
            content = re.sub(r"bg-neutral-100\s*(dark:)?(?:bg-neutral-100\s*)+", "bg-neutral-100 ", content)
            content = re.sub(r"bg-gray-50\s*(dark:)?(?:bg-gray-50\s*)+", "bg-gray-50 ", content)
            content = re.sub(r"bg-gray-100\s*(dark:)?(?:bg-gray-100\s*)+", "bg-gray-100 ", content)
            content = re.sub(r"border-neutral-200\s*(dark:)?(?:border-neutral-200\s*)+", "border-neutral-200 ", content)
            content = re.sub(r"border-neutral-300\s*(dark:)?(?:border-neutral-300\s*)+", "border-neutral-300 ", content)
            content = re.sub(r"border-gray-200\s*(dark:)?(?:border-gray-200\s*)+", "border-gray-200 ", content)
            content = re.sub(r"border-gray-300\s*(dark:)?(?:border-gray-300\s*)+", "border-gray-300 ", content)
            content = re.sub(r"text-neutral-800\s*(dark:)?(?:text-neutral-800\s*)+", "text-neutral-800 ", content)
            content = re.sub(r"text-neutral-700\s*(dark:)?(?:text-neutral-700\s*)+", "text-neutral-700 ", content)
            content = re.sub(r"text-neutral-600\s*(dark:)?(?:text-neutral-600\s*)+", "text-neutral-600 ", content)
            content = re.sub(r"text-gray-800\s*(dark:)?(?:text-gray-800\s*)+", "text-gray-800 ", content)
            content = re.sub(r"text-gray-700\s*(dark:)?(?:text-gray-700\s*)+", "text-gray-700 ", content)
            content = re.sub(r"text-gray-600\s*(dark:)?(?:text-gray-600\s*)+", "text-gray-600 ", content)
            content = re.sub(r"text-gray-900\s*(dark:)?(?:text-gray-900\s*)+", "text-gray-900 ", content)
            # fix double darks: dark:dark:
            content = re.sub(r"dark:\s*dark:", "dark:", content)
            if content != original:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
print("Done inner cleanup")
