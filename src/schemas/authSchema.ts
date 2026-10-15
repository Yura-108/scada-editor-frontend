import * as z from 'zod';

export const loginSchema = z.object({
  login: z.string().min(1, { message: 'Введите логин' }),
  password: z.string().min(1, { message: 'Введите пароль' }),
});
