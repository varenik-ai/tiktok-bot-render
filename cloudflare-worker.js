const BOT_TOKEN = "8798922176:AAFVcmS0Dz7O-GAAZKaAsS3B2f-pqYSViyM";
const DAILY_LIMIT = 10;

// In-memory counters (сбрасываются при cold start, норма для serverless)
const counters = {};

function checkLimit(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${userId}_${today}`;
  const count = counters[key] || 0;
  if (count >= DAILY_LIMIT) return false;
  counters[key] = count + 1;
  return true;
}

async function tgRequest(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function sendMessage(chatId, text, extra = {}) {
  return tgRequest("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

function deleteMessage(chatId, messageId) {
  return tgRequest("deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function getTikTokVideo(url) {
  const errors = [];

  // API 1: tikwm.com POST
  try {
    const formData = `url=${encodeURIComponent(url)}&hd=1`;
    const res = await fetch("https://www.tikwm.com/api/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
      body: formData,
    });
    const json = await res.json();
    if (json.code === 0 && json.data) return json.data;
    errors.push("tikwm: " + (json.msg || json.code));
  } catch (e) { errors.push("tikwm err: " + e.message); }

  // API 2: tikwm.com GET
  try {
    const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const json = await res.json();
    if (json.code === 0 && json.data) return json.data;
    errors.push("tikwm-get: " + (json.msg || json.code));
  } catch (e) { errors.push("tikwm-get err: " + e.message); }

  // API 3: douyin.wtf
  try {
    const res = await fetch(`https://api.douyin.wtf/api?url=${encodeURIComponent(url)}&minimal=false`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const json = await res.json();
    // douyin.wtf returns different structure
    const videoUrl = json.video?.play_addr?.url_list?.[0] || json.video?.download_addr?.url_list?.[0];
    if (videoUrl) return { play: videoUrl, hdplay: videoUrl, size: 0, hd_size: 0 };
    errors.push("douyin.wtf: " + JSON.stringify(json).slice(0, 80));
  } catch (e) { errors.push("douyin.wtf err: " + e.message); }

  // API 4: tikmate.app
  try {
    const res = await fetch(`https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const json = await res.json();
    if (json.token && json.id) {
      const dlUrl = `https://tikmate.app/download/${json.token}/${json.id}.mp4`;
      return { play: dlUrl, hdplay: dlUrl, size: 0, hd_size: 0 };
    }
    errors.push("tikmate: " + JSON.stringify(json).slice(0, 80));
  } catch (e) { errors.push("tikmate err: " + e.message); }

  // API 5: snaptik.app
  try {
    const pageRes = await fetch("https://snaptik.app/", { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await pageRes.text();
    const tokenMatch = html.match(/name="token"\s+value="([^"]+)"/);
    if (tokenMatch) {
      const token = tokenMatch[1];
      const formData = `url=${encodeURIComponent(url)}&token=${encodeURIComponent(token)}`;
      const dlRes = await fetch("https://snaptik.app/abc2.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
        body: formData,
      });
      const dlJson = await dlRes.json();
      const videoUrl = dlJson.url || dlJson.videoUrl || dlJson.data?.url;
      if (videoUrl) return { play: videoUrl, hdplay: videoUrl, size: 0, hd_size: 0 };
      errors.push("snaptik: " + JSON.stringify(dlJson).slice(0, 80));
    } else {
      errors.push("snaptik: no token");
    }
  } catch (e) { errors.push("snaptik err: " + e.message); }

  throw new Error(errors.join(" | "));
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = update?.message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const lang = message.from?.language_code || "en";
    const isRu = lang.startsWith("ru") || lang.startsWith("uk") || lang.startsWith("be");
    const text = message.text?.trim() || "";

    if (text === "/start") {
      await sendMessage(
        chatId,
        isRu
          ? `👋 <b>Привет!</b>\n\nЯ скачиваю видео из TikTok <b>без водяного знака</b>.\n\nПросто отправь мне ссылку на видео TikTok — и я пришлю тебе чистый mp4.\n\n📎 Пример:\n<code>https://www.tiktok.com/@user/video/123456</code>`
          : `👋 <b>Hello!</b>\n\nI download TikTok videos <b>without watermark</b>.\n\nJust send me a TikTok link and I'll send you a clean mp4.\n\n📎 Example:\n<code>https://www.tiktok.com/@user/video/123456</code>`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const isTikTok =
      text.includes("tiktok.com") ||
      text.includes("vm.tiktok.com") ||
      text.includes("vt.tiktok.com");

    if (!isTikTok) {
      await sendMessage(
        chatId,
        isRu
          ? "❌ Отправь ссылку на видео TikTok.\n\nПример:\n<code>https://www.tiktok.com/@user/video/123</code>"
          : "❌ Send a TikTok video link.\n\nExample:\n<code>https://www.tiktok.com/@user/video/123</code>"
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!checkLimit(userId)) {
      await sendMessage(
        chatId,
        isRu
          ? `⛔ <b>Лимит на сегодня исчерпан</b>\n\nБесплатно доступно ${DAILY_LIMIT} скачиваний в день.\nВозвращайся завтра! 🌅`
          : `⛔ <b>Daily limit reached</b>\n\n${DAILY_LIMIT} free downloads per day.\nCome back tomorrow! 🌅`
      );
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const waitMsg = await sendMessage(
      chatId,
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
        await tgRequest("sendMessage", {
          chat_id: chatId,
          text:
            caption +
            (isRu
              ? `\n\n📦 ${fileSizeMb.toFixed(1)} МБ · нажми кнопку`
              : `\n\n📦 ${fileSizeMb.toFixed(1)} MB · tap to download`),
          parse_mode: "HTML",
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: isRu ? "⬇️ Скачать видео" : "⬇️ Download video", url: videoUrl }],
            ],
          }),
        });
      } else {
        const result = await tgRequest("sendVideo", {
          chat_id: chatId,
          video: videoUrl,
          caption,
          supports_streaming: true,
        });
        if (!result?.ok) {
          await tgRequest("sendMessage", {
            chat_id: chatId,
            text:
              caption +
              (isRu ? "\n\n⬇️ Нажми чтобы скачать" : "\n\n⬇️ Tap to download"),
            parse_mode: "HTML",
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: isRu ? "⬇️ Скачать видео" : "⬇️ Download video", url: videoUrl }],
              ],
            }),
          });
        }
      }
    } catch (err) {
      if (waitMsgId) await deleteMessage(chatId, waitMsgId);
      await sendMessage(
        chatId,
        `❌ <b>Debug error:</b>\n<code>${String(err).slice(0, 300)}</code>`
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
