#!/bin/bash
BOT_TOKEN="8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM"
FUNC_URL="https://tiktok-pro-save-bot.netlify.app/.netlify/functions/tg-hook"

echo "🔗 Ставим вебхук..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${FUNC_URL}&drop_pending_updates=true"

echo ""
echo ""
echo "✅ Вебхук установлен на: $FUNC_URL"
echo ""
echo "👉 Теперь открой Telegram и отправь /start боту @tiktok_pro_save_bot"
echo ""
read -p "Нажми Enter после теста..."

echo ""
echo "=== Статус вебхука после теста ==="
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
echo ""
