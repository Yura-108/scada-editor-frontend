import {notFound} from "next/navigation";
import {UiCatalog} from "@/modules/ui-catalog";

export const metadata = {title: "Каталог UI-kit"};

/**
 * Каталог общих компонентов (`shared/ui`) — только в dev-сборке. Вне группы `(app)`: без шапки
 * приложения и без входа (`/dev` не попадает в matcher `proxy.ts`), запросов к бэкенду нет.
 */
export default function UiCatalogPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiCatalog />;
}
