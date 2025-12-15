/**
 * index.js
 * Single-file Telegram Video Downloader Bot
 * Node.js + Telegraf + MongoDB
 */

import { Telegraf, session, Markup } from "telegraf";
import axios from "axios";
import mongoose from "mongoose";

/* =======================
   ENV
======================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

/* =======================
   DB
======================= */
await mongoose.connect(MONGO_URI);

/* =======================
   BOT INIT
======================= */
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

/* =======================
   /start
======================= */
bot.start(async (ctx) => {
  ctx.session = {};
  await ctx.reply(
    "👋 Welcome to All-in-One Video Downloader Bot\n\nChoose an option 👇",
    Markup.inlineKeyboard([
      [Markup.button.callback("📥 Social Downloader", "SOCIAL")],
      [Markup.button.callback("🎬 Terabox Player", "TERABOX")]
    ])
  );
});

/* =======================
   MAIN MENUS
======================= */
bot.action("SOCIAL", async (ctx) => {
  ctx.session.type = "SOCIAL";
  await ctx.editMessageText(
    "Select platform 👇",
    Markup.inlineKeyboard([
      [Markup.button.callback("📸 Instagram", "IG")],
      [Markup.button.callback("📘 Facebook", "FB")],
      [Markup.button.callback("▶️ YouTube", "YT")],
      [Markup.button.callback("🌐 100+ Sites", "ALL")]
    ])
  );
});

bot.action("TERABOX", async (ctx) => {
  ctx.session.type = "TERABOX";
  await ctx.editMessageText("📎 Send Terabox link");
});

bot.action(["IG", "FB", "YT", "ALL"], async (ctx) => {
  ctx.session.type = "SOCIAL";
  await ctx.reply("📎 Send video link");
});

/* =======================
   LINK HANDLER
======================= */
bot.on("text", async (ctx) => {
  const link = ctx.message.text;

  /* ---------- SOCIAL ---------- */
  if (ctx.session.type === "SOCIAL") {
    const api = `https://downloaderpro.xo.je/mesin/dwn.php/?url=${encodeURIComponent(link)}`;
    const { data } = await axios.get(api);

    ctx.session.media = data;

    await ctx.replyWithPhoto(data.thumbnail, {
      caption: `🎬 ${data.title}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⬇️ Download Video", callback_data: "DL_VIDEO" },
            { text: "🎵 Download Audio", callback_data: "DL_AUDIO" }
          ]
        ]
      }
    });
  }

  /* ---------- TERABOX ---------- */
  if (ctx.session.type === "TERABOX") {
    const api = `https://wadownloader.amitdas.site/api/TeraBox/main/?url=${encodeURIComponent(link)}`;
    const { data } = await axios.get(api);

    ctx.session.tera = data;

    await ctx.replyWithPhoto(data.thumbnail, {
      caption: `🎬 ${data.title}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "▶️ Watch Video", callback_data: "WATCH_TERA" },
            { text: "⬇️ Download Video", callback_data: "DL_TERA" }
          ]
        ]
      }
    });
  }
});

/* =======================
   DOWNLOAD ACTIONS
======================= */
bot.action("DL_VIDEO", async (ctx) => {
  const video = ctx.session.media.medias.find(m => m.type === "video");
  await ctx.replyWithVideo(video.url);
});

bot.action("DL_AUDIO", async (ctx) => {
  const audio = ctx.session.media.medias.find(m => m.type === "audio");
  await ctx.replyWithAudio(audio.url);
});

bot.action("WATCH_TERA", async (ctx) => {
  await ctx.replyWithVideo(ctx.session.tera.media_url);
});

bot.action("DL_TERA", async (ctx) => {
  await ctx.replyWithDocument(ctx.session.tera.media_url);
});

/* =======================
   START BOT
======================= */
bot.launch();
