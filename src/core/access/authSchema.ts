import * as z from 'zod';

// Без JIT: иначе zod при первом разборе проверяет `new Function("")`, а страница обходится без
// `'unsafe-eval'` (#20 п. 1, шаг 6). Настройка глобальная, а схемы на клиенте — только здесь.
z.config({ jitless: true });

export const loginSchema = z.object({
  login: z.string().min(1, { message: 'Введите логин' }),
  password: z.string().min(1, { message: 'Введите пароль' }),
});
