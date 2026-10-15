import {redirect} from "next/navigation";
import {getUser} from "@/lib/getUser";
import AdminClient from "./AdminClient";

/**
 * Администрирование: пользователи, их права в проектах, ветки каталога.
 * Не-админа уводим сразу (claim `admin` из токена) — это удобство: все запросы
 * страницы auth всё равно проверяет сам (403 NOT_ADMIN).
 */
export default async function Page() {
  const user = await getUser();
  if (!user?.admin) redirect("/");
  return <AdminClient />;
}
