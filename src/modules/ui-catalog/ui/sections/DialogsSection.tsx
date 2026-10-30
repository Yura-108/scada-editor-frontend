"use client";

import React, {useState} from "react";
import {toast} from "sonner";
import {Button} from "@/shared/ui/Button";
import {Field} from "@/shared/ui/field/Field";
import {Input} from "@/shared/ui/field/Input";
import Modal from "@/shared/ui/dialog/Modal";
import {DialogBody, DialogFooter, DialogHeader} from "@/shared/ui/dialog/DialogParts";
import {choiceModal, confirmModal, promptModal} from "@/shared/ui/dialog/confirmModal";
import {useModalStore} from "@/shared/ui/dialog/modalStore";
import {useCloseModal} from "@/shared/ui/dialog/useCloseModal";
import {CatalogSection, Demo} from "../CatalogSection";

const report = (what: string, result: unknown) => toast(`${what}: ${JSON.stringify(result)}`);

export function DialogsSection() {
  return (
    <CatalogSection
      id="dialogs"
      title="Окна"
      description="Только из shared/ui/dialog (свой Radix Dialog ESLint отметит). Окна открываются в портале и берут тему страницы — переключатель вверху."
    >
      <Dialogs />
    </CatalogSection>
  );
}

function Dialogs() {
  const [localOpen, setLocalOpen] = useState(false);
  const openModal = useModalStore(s => s.openModal);

  return (
    <>
      <Demo label="Стек окон">
        <Button onClick={() => openModal(<SampleWindow />, {size: "md"})}>openModal</Button>
      </Demo>
      <Demo label="Вопросы (await → результат во всплывашке)">
        <Button onClick={async () => report("confirm", await confirmModal({title: "Сохранить схему?", description: "Изменения уйдут на сервер."}))}>
          confirmModal
        </Button>
        <Button variant="danger" onClick={async () => report("confirm danger", await confirmModal({
          title: "Удалить схему «Насосная»?", description: "Действие необратимо.", confirmLabel: "Удалить", danger: true,
        }))}>
          confirmModal danger
        </Button>
        <Button onClick={async () => report("prompt", await promptModal({title: "Новая схема", label: "Название", placeholder: "Например: Насосная"}))}>
          promptModal
        </Button>
        <Button onClick={async () => report("choice", await choiceModal({
          title: "Схема уже есть в проекте",
          options: [
            {id: "replace", label: "Заменить", description: "Текущая схема будет перезаписана", danger: true},
            {id: "add", label: "Добавить копией"},
          ],
        }))}>
          choiceModal
        </Button>
      </Demo>
      <Demo label="Локальный Modal (своё состояние open)">
        <Button onClick={() => setLocalOpen(true)}>Modal</Button>
        <Modal
          open={localOpen}
          onClose={() => setLocalOpen(false)}
          title="Переместить в группу"
          description="Окно принадлежит компоненту, а не стеку."
          size="sm"
          footer={<Button variant="primary" onClick={() => setLocalOpen(false)}>Готово</Button>}
        >
          <p className="text-sm text-muted-foreground">Содержимое локального окна.</p>
        </Modal>
      </Demo>
    </>
  );
}

/** Окно стека: из него pushModal кладёт второе поверх — закрыли, и набранное здесь на месте. */
function SampleWindow() {
  const close = useCloseModal();
  const pushModal = useModalStore(s => s.pushModal);
  return (
    <>
      <DialogHeader title="Окно стека" description="openModal открывает его вместо верхнего." />
      <DialogBody>
        <Field label="Наберите что-нибудь и откройте окно поверх">
          <Input placeholder="Текст останется после закрытия верхнего окна" />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button onClick={() => pushModal(<TopWindow />, {size: "sm"})}>pushModal поверх</Button>
        <Button variant="primary" onClick={close}>Закрыть</Button>
      </DialogFooter>
    </>
  );
}

function TopWindow() {
  const close = useCloseModal();
  return (
    <>
      <DialogHeader title="Окно поверх" />
      <DialogBody><p className="text-sm text-muted-foreground">Закройте — нижнее окно останется с набранным текстом.</p></DialogBody>
      <DialogFooter><Button variant="primary" onClick={close}>Закрыть</Button></DialogFooter>
    </>
  );
}
