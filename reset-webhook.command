#!/bin/bash
BOT_TOKEN="8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM"

echo "🗑️  Удаляем старый вебхук..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"

echo ""
echo "⏳ Ждём 10 минут пока Netlify сбросит rate limit..."
echo "   (закрывать окно не нужно)"
for i in {10..1}; do
  echo "   $i мин..."
  sleep 60
done

echo ""
echo "🔗 Ставим вебхук заново..."
RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://tiktok-pro-save-bot.netlify.app/.netlify/functions/tg-hook")
echo "Результат: $RESULT"

echo ""
echo "🧪 Тест функции..."
curl -s -w "\nHTTP:%{http_code}" -X POST \
  "https://tiktok-pro-save-bot.netlify.app/.netlify/functions/tg-hook" \
  -H "Content-Type: application/json" \
  -d '{"message":{"chat":{"id":1},"from":{"id":1,"language_code":"ru"},"text":"/start"}}'

echo ""
echo ""
echo "✅ Теперь отправь /start боту @tiktok_pro_save_bot"
echo ""
read -p "Нажми Enter..."
