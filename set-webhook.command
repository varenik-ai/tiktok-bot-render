#!/bin/bash
BOT_TOKEN="8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM"
WORKER_URL="https://tiktok-bot.varenik-ai.workers.dev"

echo "🗑️  Удаляем старый вебхук..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true"

echo ""
sleep 2

echo "🔗 Ставим вебхук на Cloudflare Worker..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WORKER_URL}"

echo ""
echo ""
echo "=== Статус ==="
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

echo ""
echo ""
echo "✅ Готово! Теперь отправь /start боту @tiktok_pro_save_bot в Telegram"
echo ""
read -p "Нажми Enter..."
