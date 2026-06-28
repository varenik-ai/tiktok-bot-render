#!/bin/bash
cd "$(dirname "$0")"

echo "🔴 Выходим из старого аккаунта Vercel..."
npx vercel logout 2>/dev/null

echo ""
echo "👤 Входим в новый аккаунт Vercel..."
echo "   Откроется браузер — создай новый аккаунт на vercel.com"
echo "   (можно через GitHub или просто email)"
echo ""
npx vercel login

if [ $? -ne 0 ]; then
  echo "❌ Не удалось войти в Vercel"
  read -p "Нажми Enter для выхода..."
  exit 1
fi

echo ""
echo "🚀 Деплоим бота..."
npx vercel --prod --yes

DEPLOY_STATUS=$?

if [ $DEPLOY_STATUS -eq 0 ]; then
  echo ""
  echo "✅ Деплой успешен!"

  # Получаем URL деплоя
  DEPLOY_URL=$(npx vercel ls --prod 2>/dev/null | grep -v "^Age" | head -2 | tail -1 | awk '{print $2}')

  if [ -n "$DEPLOY_URL" ]; then
    echo "🌐 URL: https://$DEPLOY_URL"
    echo ""
    echo "🔗 Устанавливаем webhook в Telegram..."
    RESULT=$(curl -s "https://api.telegram.org/bot8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM/setWebhook?url=https://${DEPLOY_URL}/api/webhook")
    echo "Результат: $RESULT"
    echo ""
    echo "✅ Всё готово! Бот работает на Vercel независимо от Mac."
    echo "   URL вебхука: https://${DEPLOY_URL}/api/webhook"
  else
    echo ""
    echo "⚠️  Скопируй URL из вывода выше (строка вида xxx.vercel.app)"
    echo "    и пришли его в чат — установлю webhook вручную"
  fi
else
  echo ""
  echo "❌ Ошибка деплоя."
  echo "   Если ошибка 'fair use' — создай аккаунт с другим email"
fi

echo ""
read -p "Нажми Enter для выхода..."
