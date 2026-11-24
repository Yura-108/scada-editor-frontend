import {notFound} from "next/navigation";
import {SandboxChecks} from "./SandboxChecks";

export const metadata = process.env.NODE_ENV === "development" ? {title: "Песочница скриптов"} : {};

/**
 * Проверка воркера-песочницы скриптов схем (#20 п. 1) — только в dev-сборке, как `/dev/ui`: без
 * входа и без бэкенда. Песочница проверяется в настоящем браузере — в Node воркера нет.
 */
export default function SandboxPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-lg font-semibold text-foreground">Песочница скриптов схем</h1>
      <p className="text-sm text-muted-foreground">
        Привязки и обработчики выполняются в отдельном воркере без сети. Все пункты должны стать «ok».
      </p>
      <SandboxChecks />
    </main>
  );
}
