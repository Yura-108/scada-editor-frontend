import {NextResponse} from "next/server";

/**
 * Прокси ручек выпусков проекта (контракт docs/contract/2026-09-29-project-release-contract.md).
 *
 * Тело и статус — как есть: 409 («проект не в эксплуатации», `no_prod_release`) и 404 («сцены
 * нет в выпуске») это состояния, которые показывает интерфейс, а не сбои. В отличие от
 * `passThrough`, пробрасывается заголовок `X-Release-Version` — по нему монитор знает, какой
 * выпуск он рисует.
 */
export const RELEASE_VERSION_HEADER = "X-Release-Version";

export const passThroughRelease = async (response: Response) => {
  const text = await response.text().catch(() => "");
  const headers: Record<string, string> = {
    "Content-Type": response.headers.get("content-type") ?? "application/json",
  };
  const release = response.headers.get(RELEASE_VERSION_HEADER);
  if (release) headers[RELEASE_VERSION_HEADER] = release;
  return new NextResponse(text || null, {status: response.status, headers});
};
