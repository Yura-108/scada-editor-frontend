'use client';

import React, { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { UnsavedNotice } from '@/shared/ui/UnsavedNotice';
import { VersionHistoryList } from '@/core/project';
import { Collapsible } from '@/shared/ui/codeModalParts';
import { CatalogSection, Demo } from '../CatalogSection';
import { SAMPLE_VERSIONS } from '../../lib/sampleData';

export function MiscSection() {
  return (
    <CatalogSection
      id="misc"
      title="Прочее"
      description="История версий документа, плашка несохранённых правок и сворачиваемые блоки."
    >
      <Misc />
    </CatalogSection>
  );
}

function Misc() {
  const [dirty, setDirty] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  return (
    <>
      <Demo label="VersionHistoryList" className="block space-y-2">
        <Button size="sm" onClick={() => setDirty((d) => !d)}>
          {dirty ? 'Без правок' : 'Есть несохранённые правки'}
        </Button>
        <VersionHistoryList
          versions={SAMPLE_VERSIONS}
          currentVersion={5}
          dirty={dirty}
          onRestore={() => {}}
        />
      </Demo>
      <Demo label="UnsavedNotice (в углу окна)">
        <Button size="sm" onClick={() => setUnsaved((v) => !v)}>
          {unsaved ? 'Скрыть' : 'Показать'} UnsavedNotice
        </Button>
        {unsaved && (
          <UnsavedNotice
            details="таблицы: 2"
            onSave={() => setUnsaved(false)}
            onDiscard={() => setUnsaved(false)}
          />
        )}
      </Demo>
      <Demo label="Collapsible (окна редакторов кода)" className="block">
        <Collapsible title="Доступные переменные" badge={<Badge>3</Badge>}>
          <p className="px-3 py-2 text-sm text-muted-foreground">value, prev, tag</p>
        </Collapsible>
      </Demo>
    </>
  );
}
