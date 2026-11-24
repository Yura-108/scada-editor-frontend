'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { Info } from 'lucide-react';
import { isLoginLeaveReason, LOGIN_LEAVE_MESSAGES } from '@/core/access';
import { Banner } from '@/shared/ui/Banner';

/**
 * Почему пользователь снова на странице входа (`?reason=` ставит `authInterceptor`):
 * сеанс завершён или учётка отключена. Без причины — ничего не показывает.
 */
export function LeaveNotice() {
  const reason = useSearchParams().get('reason');
  if (!isLoginLeaveReason(reason)) return null;
  return (
    <Banner tone={reason === 'disabled' ? 'warning' : 'info'} icon={Info} className="mb-6">
      {LOGIN_LEAVE_MESSAGES[reason]}
    </Banner>
  );
}
