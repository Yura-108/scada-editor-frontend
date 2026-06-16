import os, re
rules = {
    # Fix standard double text-gray-900 cases:
    r"text-gray-900\s*(dark:)?(?:text-gray-900\s*)+": "text-gray-900 ",
    r"text-gray-900\s*(dark:)?(?:text-gray-900)*\s*dark:text-white": "text-gray-900 dark:text-white",
}
for root, dirs, files in os.walk("src"):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            original = content
            for old, new in rules.items():
                content = re.sub(old, new, content)
            if content != original:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
print("Done inner cleanup 2")
