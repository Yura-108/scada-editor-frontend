import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import React from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // const cookieStore = cookies();
  // const token = cookieStore.get('token')?.value;
  //
  // if (!token) {
  //   redirect('/login');
  // }

  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
