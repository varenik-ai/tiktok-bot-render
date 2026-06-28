const express = require("express");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN || "8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM";
const DAILY_LIMIT = 10;
const COUNTERS_FILE = path.join(__dirname, "counters.json");

function getCounters() {
  try {
    if (fs.existsSync(COUNTERS_FILE)) return JSON.parse(fs.readFileSync(COUNTERS_FILE, "utf8"));
  } catch {}
  return {};
}

function saveCounters(data) {
  try { fs.writeFileSync(COUNTERS_FILE, JSON.stringify(data), "utf8"); } catch {}
}

function checkLimit(userId) {
  const counters = getCounters();
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${today}`;
  const count = counters[key] || 0;
  if (count >= DAILY_LIMIT) return false;
  counters[key] = count + 1;
  saveCounters(counters);
  return true;
}

function tgRequest(method, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "api.telegram.org",
      path: `/bot${BOT_TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    };
    const req = https.request(options, res => {
      let buf = "";
      res.on("data", c => buf += c);
      res.on("end", () => resolve(JSON.parse(buf)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(chatId, text, extra = {}) {
  return tgRequest("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

function deleteMessage(chatId, messageId) {
  return tgRequest("deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function getTikTokVideo(url) {
  return new Promise((resolve, reject) => {
    const formData = `url=${encodeURIComponent(url)}&hd=1`;
    const options = {
      hostname: "www.tikwm.com",
      path: "/api/",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(formData),
        "User-Agent": "Mozilla/5.0"
      }
    };
    const req = https.request(options, res => {
      let buf = "";
      res.on("data", c => buf += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(buf);
          if (json.code === 0 && json.data) resolve(json.data);
          else reject(new Error("tikwm: " + JSON.stringify(json).slice(0, 100)));
        } catch { reject(new Error("parse error: " + buf.slice(0, 100))); }
      });
    });
    req.on("error", reject);
    req.write(formData);
    req.end();
  });
}

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  res.json({ ok: true });

  const message = req.body?.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const lang = message.from?.language_code || "en";
  const isRu = lang.startsWith("ru") || lang.startsWith("uk") || lang.startsWith("be");
  const text = message.text?.trim() || "";

  if (text === "/start") {
    await sendMessage(chatId,
      isRu
        ? `👋 <b>Привет!</b>\n\nЯ скачиваю видео из TikTok <b>без водяного знака</b>.\n\nПросто отправь мне ссылку на видео TikTok — и я пришлю тебе чистый mp4.\n\n📎 Пример:\n<code>https://www.tiktok.com/@user/video/123456</code>`
        : `👋 <b>Hello!</b>\n\nI download TikTok videos <b>without watermark</b>.\n\nJust send me a TikTok link and I'll send you a clean mp4.\n\n📎 Example:\n<code>https://www.tiktok.com/@user/video/123456</code>`
    );
    return;
  }

  const isTikTok = text.includes("tiktok.com") || text.includes("vm.tiktok.com") || text.includes("vt.tiktok.com");
  if (!isTikTok) {
    await sendMessage(chatId,
      isRu
        ? "❌ Отправь ссылку на видео TikTok.\n\nПример:\n<code>https://www.tiktok.com/@user/video/123</code>"
        : "❌ Send a TikTok video link.\n\nExample:\n<code>https://www.tiktok.com/@user/video/123</code>"
    );
    return;
  }

  if (!checkLimit(userId)) {
    await sendMessage(chatId,
      isRu
        ? `⛔ <b>Лимит на сегодня исчерпан</b>\n\nБесплатно доступно ${DAILY_LIMIT} скачиваний в день.\nВозвращайся завтра! 🌅`
        : `⛔ <b>Daily limit reached</b>\n\n${DAILY_LIMIT} free downloads per day.\nCome back tomorrow! 🌅`
    );
    return;
  }

  const waitMsg = await sendMessage(chatId,
    isRu ? "⏳ Скачиваю видео, подожди секунду..." : "⏳ Downloading, please wait..."
  );
  const waitMsgId = waitMsg?.result?.message_id;

  try {
    const data = await getTikTokVideo(text);
    const videoUrl = data.hdplay || data.play;
    const fileSize = data.hd_size || data.size || 0;
    const fileSizeMb = fileSize / (1024 * 1024);
    const caption = isRu
      ? "❤️ Скачано @tiktok_pro_save_bot"
      : "❤️ Downloaded by @tiktok_pro_save_bot";

    if (waitMsgId) await deleteMessage(chatId, waitMsgId);

    if (fileSizeMb > 50) {
      // Тяжёлое видео — кнопка для скачивания
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: caption + (isRu
          ? `\n\n📦 ${fileSizeMb.toFixed(1)} МБ · нажми кнопку чтобы скачать`
          : `\n\n📦 ${fileSizeMb.toFixed(1)} MB · tap button to download`),
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{
            text: isRu ? "⬇️ Скачать видео" : "⬇️ Download video",
            url: videoUrl
          }]]
        })
      });
    } else {
      // Лёгкое видео — Telegram скачивает сам
      const result = await tgRequest("sendVideo", {
        chat_id: chatId,
        video: videoUrl,
        caption,
        supports_streaming: true
      });
      if (!result?.ok) {
        // Фоллбек — кнопка
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: caption + (isRu ? "\n\n⬇️ Нажми чтобы скачать" : "\n\n⬇️ Tap to download"),
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [[{
              text: isRu ? "⬇️ Скачать видео" : "⬇️ Download video",
              url: videoUrl
            }]]
          })
        });
      }
    }

  } catch (err) {
    if (waitMsgId) await deleteMessage(chatId, waitMsgId);
    await sendMessage(chatId,
      isRu
        ? `❌ <b>Не удалось скачать видео</b>\n\nВозможные причины:\n• Видео приватное\n• Неверная ссылка\n• Попробуй ещё раз через минуту`
        : `❌ <b>Failed to download video</b>\n\nPossible reasons:\n• Private video\n• Invalid link\n• Try again in a minute`
    );
  }
});

app.get("/", (req, res) => res.json({ ok: true, bot: "TikTok Saver Pro" }));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Бот запущен на порту ${PORT}`);
  console.log(`📡 Запусти ngrok: ngrok http ${PORT}`);
});
