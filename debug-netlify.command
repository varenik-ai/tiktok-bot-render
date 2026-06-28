#!/bin/bash
TOKEN="nfp_B12cXKcAvM8HxLKLu1RaAJRwV5cAUNdo6843"

echo "=== Проверка токена ==="
curl -s "https://api.netlify.com/api/v1/user" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo ""
echo "=== Список сайтов ==="
curl -s "https://api.netlify.com/api/v1/sites" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    if isinstance(d,list):
        print(f'Сайтов: {len(d)}')
        for s in d: print(f'  {s[\"name\"]} -> {s[\"id\"]}')
    else:
        print('Ответ:', d)
except Exception as e:
    print('Ошибка парсинга:', e)
"

echo ""
echo "=== Создание тестового сайта ==="
curl -s -X POST "https://api.netlify.com/api/v1/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"tiktok-pro-save-bot"}'

echo ""
echo ""
read -p "Скопируй весь текст выше и отправь в чат. Нажми Enter..."
