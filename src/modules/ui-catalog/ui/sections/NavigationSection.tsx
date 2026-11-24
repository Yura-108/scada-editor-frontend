"use client";

import React, {useId, useState} from "react";
import {Database, FileText, Settings, Table2} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {Button} from "@/shared/ui/Button";
import {Tabs, tabPanelProps} from "@/shared/ui/Tabs";
import {PageHeader} from "@/shared/ui/page/PageHeader";
import {CatalogSection, Demo} from "../CatalogSection";

type Tab = "tables" | "vars" | "settings";

export function NavigationSection() {
  return (
    <CatalogSection
      id="navigation"
      title="Навигация"
      description="Tabs — вкладки (dirty — точка несохранённых правок), PageHeader — шапка раздела внутри PageFrame: заголовок слева, свои элементы, действия справа."
    >
      <Navigation />
    </CatalogSection>
  );
}

function Navigation() {
  const id = useId();
  const [tab, setTab] = useState<Tab>("tables");
  const items = [
    {value: "tables", label: "Таблицы", icon: Table2},
    {value: "vars", label: "Переменные", icon: Database, dirty: true},
    {value: "settings", label: "Настройки", icon: Settings},
  ] as const;

  return (
    <>
      <Demo label="Tabs" className="block">
        <Tabs id={id} aria-label="Разделы данных" value={tab} onValueChange={setTab} items={items} />
        <div {...tabPanelProps(id, tab)} className="pt-2 text-sm text-muted-foreground">
          Содержимое вкладки «{items.find(i => i.value === tab)?.label}».
        </div>
      </Demo>
      <Demo label="Tabs stretch" className="block">
        <Tabs aria-label="Разделы данных (на всю ширину)" value={tab} onValueChange={setTab} items={items} stretch />
      </Demo>
      <Demo label="PageHeader (заголовок виден от xl или с alwaysShowTitle)" className="block space-y-2">
        <div className="overflow-hidden rounded-lg border">
          <PageHeader title="Журнал" icon={FileText} description="события за сутки" alwaysShowTitle />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <PageHeader
            title="Данные"
            icon={Database}
            alwaysShowTitle
            actions={<><Badge tone="warning">Не сохранено</Badge><Button size="sm" variant="primary">Сохранить</Button></>}
          >
            <Button size="sm">Свой элемент</Button>
          </PageHeader>
        </div>
      </Demo>
    </>
  );
}
