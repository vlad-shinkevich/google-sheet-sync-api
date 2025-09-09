# Google Drive API Integration

Этот документ описывает интеграцию с Google Drive API через сервисный аккаунт для скачивания приватных файлов.

## Обзор

Проект теперь поддерживает два способа работы с Google Drive:

1. **OAuth авторизация** (существующий функционал) - для пользовательских файлов
2. **Сервисный аккаунт** (новый функционал) - для системных файлов с постоянным доступом

## Новые API эндпоинты

### GET /api/download/[fileId]

Скачивает файл из Google Drive по ID через сервисный аккаунт.

**Параметры:**

- `fileId` (string) - ID файла в Google Drive

**Ответы:**

- `200` - Файл успешно скачан
- `400` - Неверный формат fileId
- `403` - Доступ запрещен
- `404` - Файл не найден
- `413` - Файл слишком большой (>20MB)
- `429` - Превышен лимит запросов
- `500` - Ошибка сервера

**Заголовки ответа:**

- `Content-Type` - MIME тип файла
- `Content-Disposition` - Имя файла для скачивания
- `X-File-Name` - Оригинальное имя файла
- `X-File-Size` - Размер файла в байтах
- `X-File-Type` - MIME тип файла

**Пример:**

```bash
curl "https://your-domain.vercel.app/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

### GET /api/info/[fileId]

Получает метаданные файла из Google Drive.

**Параметры:**

- `fileId` (string) - ID файла в Google Drive

**Ответы:**

- `200` - Метаданные получены
- `400` - Неверный формат fileId
- `403` - Доступ запрещен
- `404` - Файл не найден
- `429` - Превышен лимит запросов
- `500` - Ошибка сервера

**Пример ответа:**

```json
{
  "id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "name": "example.pdf",
  "mimeType": "application/pdf",
  "size": 1024000,
  "sizeFormatted": "1000 KB",
  "createdTime": "2023-01-01T00:00:00.000Z",
  "modifiedTime": "2023-01-01T00:00:00.000Z",
  "webViewLink": "https://drive.google.com/file/d/.../view",
  "downloadUrl": "/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "thumbnailLink": "https://drive.google.com/thumbnail?id=...",
  "parents": ["0BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"],
  "isImage": false,
  "isDocument": false,
  "isSpreadsheet": false,
  "isPresentation": false,
  "isPdf": true,
  "isVideo": false,
  "isAudio": false,
  "isArchive": false
}
```

## Настройка сервисного аккаунта

### 1. Создание сервисного аккаунта

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите проект или создайте новый
3. Включите Google Drive API
4. Перейдите в "IAM & Admin" > "Service Accounts"
5. Создайте новый сервисный аккаунт
6. Скачайте JSON ключ

### 2. Настройка доступа к файлам

Для доступа к файлам в Google Drive:

1. Откройте файл в Google Drive
2. Нажмите "Поделиться"
3. Добавьте email сервисного аккаунта с правами "Читатель"
4. Или поделитесь папкой с файлами

### 3. Переменные окружения

Добавьте в Vercel Dashboard следующие переменные:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

**Важно:**

- Приватный ключ должен быть в формате с символами `\n` вместо переносов строк
- Или используйте переменную без кавычек, если Vercel поддерживает многострочные значения

## Безопасность

### Rate Limiting

- **Download**: 10 запросов в минуту на IP
- **Info**: 30 запросов в минуту на IP

### Валидация

- Проверка формата fileId (28-33 символа, alphanumeric + \_-)
- Ограничение размера файла (20MB)
- Логирование всех запросов

### Права доступа

- Сервисный аккаунт имеет только права чтения (`drive.readonly`)
- Доступ только к файлам, к которым явно предоставлен доступ

## Логирование

Все запросы логируются с информацией:

- Timestamp
- IP адрес
- User Agent
- File ID
- Результат (успех/ошибка)
- Время выполнения
- Размер файла (для download)

Пример лога:

```
[2023-01-01T00:00:00.000Z] INFO DRIVE_DOWNLOAD DOWNLOAD IP:192.168.1.1 UA:Mozilla/5.0... FileID:1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms SUCCESS Time:150ms Size:1024000bytes
```

## Обработка ошибок

### Типичные ошибки:

1. **"Google Drive service not configured"**

   - Не настроены переменные окружения
   - Проверьте `GOOGLE_SERVICE_ACCOUNT_EMAIL` и `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

2. **"Access denied"**

   - Сервисный аккаунт не имеет доступа к файлу
   - Предоставьте доступ к файлу или папке

3. **"File not found"**

   - Неверный fileId
   - Файл был удален
   - Файл не существует

4. **"File too large"**
   - Файл превышает лимит 20MB
   - Используйте другой способ доставки для больших файлов

## Мониторинг

### Health Check

Проверьте статус сервиса:

```bash
curl "https://your-domain.vercel.app/api/health"
```

### Логи в Vercel

Логи доступны в Vercel Dashboard > Functions > View Function Logs

## Примеры использования

### JavaScript/TypeScript

```typescript
// Получить информацию о файле
const response = await fetch(
  "/api/info/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
);
const fileInfo = await response.json();

// Скачать файл
const downloadResponse = await fetch(
  "/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
);
const blob = await downloadResponse.blob();

// Создать ссылку для скачивания
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = fileInfo.name;
a.click();
```

### cURL

```bash
# Получить информацию
curl "https://your-domain.vercel.app/api/info/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

# Скачать файл
curl -O "https://your-domain.vercel.app/api/download/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
```

## Совместимость

Новый функционал полностью совместим с существующим:

- OAuth эндпоинты остались без изменений
- Прокси эндпоинт `/api/proxy` работает как прежде
- CORS настроен для всех эндпоинтов
- Все существующие переменные окружения сохранены

## Ограничения

1. **Размер файла**: максимум 20MB
2. **Rate limiting**: ограничения на количество запросов
3. **Доступ**: только к файлам с явно предоставленным доступом
4. **Типы файлов**: поддерживаются все типы файлов Google Drive
5. **Кэширование**: метаданные кэшируются на 5 минут
