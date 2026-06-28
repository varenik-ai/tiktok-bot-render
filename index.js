const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = "8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM";
const DAILY_LIMIT = 50;
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

function sendMessage(chatId, text, extra) {
  return tgRequest("sendMessage", Object.assign({ chat_id: chatId, text: text, parse_mode: "HTML" }, extra || {}));
}

function deleteMessage(chatId, messageId) {
  return tgRequest("deleteMessage", { chat_id: chatId, message_id: messageId });
}

function getTikTokVideo(url) {
  return new Promise((resolve, reject) => {
    const formData = "url=" + encodeURIComponent(url) + "&hd=1";
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
      res.on("data", function(c) { buf += c; });
      res.on("end", function() {
        try {
          const json = JSON.parse(buf);
          if (json.code === 0 && json.data) resolve(json.data);
          else reject(new Error("tikwm: " + buf.slice(0, 200)));
        } catch(e) { reject(new Error("parse: " + buf.slice(0, 100))); }
      });
    });
    req.on("error", reject);
    req.write(formData);
    req.end();
  });
}

const app = express();
app.use(express.json());

app.post("/webhook", async function(req, res) {
  res.json({ ok: true });

  const message = req.body && req.body.message;
  if (!message) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const lang = (message.from && message.from.language_code) || "en";
  const isRu = lang.startsWith("ru") || lang.startsWith("uk") || lang.startsWith("be");
  const text = (message.text || "").trim();

  if (text === "/start") {
    await sendMessage(chatId, isRu
      ? "Привет! Отправь ссылку на TikTok видео."
      : "Hello! Send me a TikTok video link."
    );
    return;
  }

  const isTikTok = text.includes("tiktok.com") || text.includes("vm.tiktok.com") || text.includes("vt.tiktok.com");
  if (!isTikTok) {
    await sendMessage(chatId, "Отправь ссылку на TikTok.");
    return;
  }

  if (!checkLimit(userId)) {
    await sendMessage(chatId, "Лимит исчерпан. Возвращайся завтра!");
    return;
  }

  const waitMsg = await sendMessage(chatId, "Скачиваю...");
  const waitMsgId = waitMsg && waitMsg.result && waitMsg.result.message_id;

  try {
    const data = await getTikTokVideo(text);
    const videoUrl = data.hdplay || data.play;
    const fileSize = data.hd_size || data.size || 0;
    const fileSizeMb = fileSize / (1024 * 1024);
    const caption = "Скачано @tiktok_pro_save_bot";

    if (waitMsgId) await deleteMessage(chatId, waitMsgId);

    if (fileSizeMb > 50) {
      await tgRequest("sendMessage", {
        chat_id: chatId,
        text: caption + "\n\nФайл большой — нажми кнопку:",
        reply_markup: JSON.stringify({
          inline_keyboard: [[{ text: "Скачать видео", url: videoUrl }]]
        })
      });
    } else {
      const result = await tgRequest("sendVideo", {
        chat_id: chatId,
        video: videoUrl,
        caption: caption,
        supports_streaming: true
      });
      if (!result || !result.ok) {
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text: caption + "\n\nНажми кнопку:",
          reply_markup: JSON.stringify({
            inline_keyboard: [[{ text: "Скачать видео", url: videoUrl }]]
          })
        });
      }
    }

  } catch(err) {
    if (waitMsgId) await deleteMessage(chatId, waitMsgId);
    await sendMessage(chatId, "Ошибка: " + err.message);
  }
});

app.get("/", function(req, res) { res.json({ ok: true }); });

app.listen(3000, function() {
  console.log("Бот запущен на порту 3000");
});
