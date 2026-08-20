import { redirect } from 'next/navigation';

/**
 * Корень приложения собственной страницы не имеет — сразу уводим в рабочую область.
 * Обычно сюда не доходит (redirect делает proxy.ts по наличию токена), но раньше
 * здесь рендерился пустой div, и любой промах мимо proxy давал белый экран.
 */
export default function Home() {
  redirect('/channels');
}
