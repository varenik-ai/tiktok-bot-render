#!/bin/bash
cd "$(dirname "$0")"

TOKEN="nfp_B12cXKcAvM8HxLKLu1RaAJRwV5cAUNdo6843"
BOT_TOKEN="8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM"
FUNC_NAME="tg-hook"
FUNC_URL="https://tiktok-pro-save-bot.netlify.app/.netlify/functions/${FUNC_NAME}"

echo "🚀 Деплоим функцию '$FUNC_NAME'..."
NETLIFY_AUTH_TOKEN="$TOKEN" netlify deploy --prod \
  --dir /tmp/netlify-static-deploy \
  --functions netlify/functions \
  --message "tiktok-bot-new-endpoint"

if [ $? -eq 0 ]; then
  echo ""
  echo "🔗 Обновляем вебхук Telegram -> $FUNC_URL"
  # Сначала удаляем старый вебхук
  curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook" > /dev/null
  sleep 2
  # Ставим новый
  RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${FUNC_URL}")
  echo "Результат: $RESULT"

  echo ""
  echo "🧪 Тестируем функцию напрямую..."
  sleep 3
  RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$FUNC_URL" \
    -H "Content-Type: application/json" \
    -d '{"message":{"chat":{"id":1},"from":{"id":1,"language_code":"ru"},"text":"/start"}}')
  echo "Ответ: $RESP"

  echo ""
  echo "✅ Готово! Проверь @tiktok_pro_save_bot"
else
  echo "❌ Ошибка деплоя"
fi

echo ""
read -p "Нажми Enter для выхода..."
