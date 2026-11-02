import {confirmModal} from "@/shared/ui/dialog/confirmModal";

/** 409: слияния нет — остаётся перечитать документ, отказавшись от своих правок. */
export async function offerReload(what: string, reload: () => Promise<void>) {
  const ok = await confirmModal({
    title: `${what} уже изменил кто-то другой`,
    description: "Перечитать с сервера? Ваши несохранённые правки пропадут — перенесите их заново.",
    confirmLabel: "Перечитать",
    danger: true,
  });
  if (ok) await reload();
}
