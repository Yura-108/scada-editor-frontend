import * as z from 'zod';

export const loginSchema = z.object({
  login: z.string().min(1, { message: 'Введите логин' }),
  password: z.string().min(1, { message: 'Введите пароль' }),
});

export const registerSchema = z
  .object({
    login: z
      .string()
      .min(3, 'Логин должен содержать минимум 3 символа')
      .max(20, 'Логин слишком длинный'),
    password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });
