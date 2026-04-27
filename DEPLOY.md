# DEPLOY (Linux)

Практический runbook для разворачивания `scada-editor-frontend` (Next.js) на Linux-сервере.

## 1) Что должно быть предустановлено на сервере

- [ ] `git`
- [ ] `nodejs` (рекомендуемо LTS 20.x или 22.x)
- [ ] `npm`
- [ ] `nginx`
- [ ] `systemd` (обычно уже установлен)
- [ ] `curl`
- [ ] (опционально) `ufw` или `firewalld`
- [ ] (опционально) `certbot` + `python3-certbot-nginx` для HTTPS

Проверка:

```bash
node -v
npm -v
git --version
nginx -v
systemctl --version
```

## 2) Какие доступы нужны команде/аккаунту деплоя

Минимальные права:

- [ ] доступ на чтение/запись каталога приложения (пример: `/opt/scada-editor-frontend`)
- [ ] запуск `npm ci`, `npm run build`
- [ ] управление сервисом `systemd` (`start/stop/restart/status`)
- [ ] чтение `journalctl` для сервиса
- [ ] проверка и перезагрузка `nginx`
- [ ] исходящий доступ с сервера к backend API

Пример sudo-прав:

```bash
sudo systemctl restart scada-editor-frontend
sudo systemctl status scada-editor-frontend --no-pager
sudo journalctl -u scada-editor-frontend -n 200 --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

## 3) Первичная настройка сервера

### 3.1 Установка пакетов (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git curl nginx
```

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3.2 Пользователь и директория приложения

```bash
sudo useradd --system --create-home --shell /bin/bash scada || true
sudo mkdir -p /opt/scada-editor-frontend
sudo chown -R scada:scada /opt/scada-editor-frontend
```

## 4) Переменные окружения (важно)

В коде проекта используются:

- `BACKEND_URL`
- `BACKEND_URL_EDITOR`
- `NODE_ENV`
- `PORT` (для `next start`)

В текущем `.env` есть `BACKEND_URL_AUTH`, `BACKEND_URL_CHANNEL`, `BACKEND_URL_EDITOR`.
Для production-конфига нужно согласовать имена, так как API-роуты читают именно `BACKEND_URL` и `BACKEND_URL_EDITOR`.

Пример `.env.production`:

```dotenv
NODE_ENV=production
PORT=3000
BACKEND_URL=http://backend-channel.internal:8082
BACKEND_URL_EDITOR=http://backend-editor.internal:8083
```

Создание файла:

```bash
sudo -u scada -H bash -lc "cat > /opt/scada-editor-frontend/.env.production << 'EOF'
NODE_ENV=production
PORT=3000
BACKEND_URL=http://backend-channel.internal:8082
BACKEND_URL_EDITOR=http://backend-editor.internal:8083
EOF"
```

## 5) Первый деплой приложения

### 5.1 Клонирование и установка зависимостей

```bash
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && git clone <REPO_URL> ."
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm ci"
```

### 5.2 Сборка

```bash
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm run build"
```

## 6) Настройка systemd

Создать unit:

```bash
sudo tee /etc/systemd/system/scada-editor-frontend.service > /dev/null << 'EOF'
[Unit]
Description=SCADA Editor Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=scada
Group=scada
WorkingDirectory=/opt/scada-editor-frontend
EnvironmentFile=/opt/scada-editor-frontend/.env.production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
Environment=HOSTNAME=127.0.0.1

[Install]
WantedBy=multi-user.target
EOF
```

Применить:

```bash
sudo systemctl daemon-reload
sudo systemctl enable scada-editor-frontend
sudo systemctl start scada-editor-frontend
sudo systemctl status scada-editor-frontend --no-pager
```

Логи:

```bash
sudo journalctl -u scada-editor-frontend -f
```

## 7) Настройка nginx

Создать конфиг:

```bash
sudo tee /etc/nginx/sites-available/scada-editor-frontend.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name <DOMAIN_OR_IP>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
```

Активировать:

```bash
sudo ln -sf /etc/nginx/sites-available/scada-editor-frontend.conf /etc/nginx/sites-enabled/scada-editor-frontend.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Обновление версии (release)

```bash
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && git pull"
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm ci"
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm run build"
sudo systemctl restart scada-editor-frontend
sudo systemctl status scada-editor-frontend --no-pager
```

## 9) Быстрый rollback (минимальный)

Вариант без отдельной release-структуры:

```bash
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && git log --oneline -n 10"
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && git checkout <PREVIOUS_COMMIT>"
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm ci"
sudo -u scada -H bash -lc "cd /opt/scada-editor-frontend && npm run build"
sudo systemctl restart scada-editor-frontend
```

## 10) Сетевые требования

- Входящие:
  - `80/tcp` (и `443/tcp`, если HTTPS)
- Локально на сервере:
  - `127.0.0.1:3000` (Next.js через `systemd`)
- Исходящие с frontend-сервера:
  - доступ к backend URL из `BACKEND_URL` и `BACKEND_URL_EDITOR`

## 11) Проверка после деплоя

```bash
curl -I http://127.0.0.1:3000
curl -I http://<DOMAIN_OR_IP>
sudo systemctl is-active scada-editor-frontend
sudo systemctl is-active nginx
```

---

Если требуется, можно вынести деплой в CI/CD (GitHub Actions/GitLab CI) с теми же шагами: `npm ci` -> `npm run build` -> `systemctl restart`.

