#!/bin/bash
cd "$(dirname "$0")"

echo "🔴 Останавливаем старые процессы..."
pkill -f "node index.js" 2>/dev/null
pkill -f ngrok 2>/dev/null
sleep 2

echo "🚀 Запускаем бота..."
node index.js &
BOT_PID=$!
sleep 2

echo "🌐 Запускаем ngrok..."
ngrok http 3000 --log=stdout --log-format=json > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 4

echo "📡 Получаем ngrok URL..."
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
  echo "❌ ngrok не запустился. Проверь установлен ли ngrok."
  read -p "Нажми Enter для выхода..."
  exit 1
fi

echo "✅ ngrok URL: $NGROK_URL"

echo "🔗 Устанавливаем webhook..."
WEBHOOK_RESULT=$(curl -s "https://api.telegram.org/bot8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM/setWebhook?url=${NGROK_URL}/webhook")
echo "Webhook: $WEBHOOK_RESULT"

echo ""
echo "✅ Всё запущено!"
echo "   Бот PID: $BOT_PID"
echo "   ngrok URL: $NGROK_URL"
echo ""
echo "⚠️ Не закрывай это окно — бот работает пока оно открыто"
wait $BOT_PID
