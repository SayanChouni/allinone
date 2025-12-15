// File: server.js - All-in-One Video Downloader Bot (Railway Server)
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');

// --- ENVIRONMENT VARIABLES ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const ADMIN_ID = 5327773504; // আপনার দেওয়া অ্যাডমিন আইডি (নম্বর হিসেবে)
const PORT = process.env.PORT || 3000; // Railway-এর জন্য পোর্ট সেট করা

// --- STATIC CONFIG ---
const SOCIAL_DOWNLOADER_API = 'https://downloaderpro.xo.je/mesin/dwn.php/?url=';
const TERABOX_API = 'https://wadownloader.amitdas.site/api/TeraBox/main/?url=';

// BOT_TOKEN না থাকলে অ্যাপ্লিকেশন ক্র্যাশ করবে (Railway-এর সমস্যার সমাধান)
if (!BOT_TOKEN) {
    console.error("FATAL: BOT_TOKEN is not set in Environment Variables.");
    // 1ms অপেক্ষা করে ক্র্যাশ করা হলো, যাতে লগটি দেখা যায়
    setTimeout(() => {
        throw new Error('BOT_TOKEN is not set.');
    }, 1); 
}

// Telegraf এবং Express ইনস্ট্যান্স
const bot = new Telegraf(BOT_TOKEN);
const app = express();
app.use(express.json()); // JSON বডি পার্স করার জন্য

// --- MONGODB SCHEMA ---
const userStateSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    state: { type: String, default: null },
    lastUpdated: { type: Date, default: Date.now }
});

const UserState = mongoose.models.UserState || mongoose.model('UserState', userStateSchema);

// --- MONGODB CONNECTION & STATE HANDLERS ---
async function connectDb() {
    if (!MONGO_URI) return;
    if (mongoose.connections[0].readyState) return;
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected successfully.');
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
    }
}

async function setUserState(chatId, state) {
    if (!MONGO_URI || !mongoose.connections[0].readyState) return;
    try {
        await UserState.findOneAndUpdate(
            { chatId },
            { state, lastUpdated: Date.now() },
            { upsert: true, new: true }
        );
    } catch (e) {
        console.error("Failed to set state:", e.message);
    }
}

async function getUserState(chatId) {
    if (!MONGO_URI || !mongoose.connections[0].readyState) return null;
    try {
        const doc = await UserState.findOneAndDelete({ chatId });
        return doc ? doc.state : null;
    } catch (e) {
        console.error("Failed to get/delete state:", e.message);
        return null;
    }
}

// --- বট লজিক (Handlers) ---

bot.start(async (ctx) => {
    await setUserState(ctx.chat.id, null);

    const welcomeMessage = `
**👋 স্বাগতম! আমি আপনার অল-ইন-ওয়ান ভিডিও ডাউনলোডার এবং প্লেয়ার বট!**
আপনি কোন পরিষেবা থেকে ভিডিও ডাউনলোড বা দেখতে চান তা নির্বাচন করুন।
`;
    
    const mainKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🌐 সোশ্যাল ডাউনলোডার', 'SOCIAL_DOWNLOADER')],
        [Markup.button.callback('📦 Terabox প্লেয়ার ও ডাউনলোডার', 'TERABOX_PLAYER')],
    ]);

    ctx.replyWithMarkdown(welcomeMessage, mainKeyboard);
});

bot.action('SOCIAL_DOWNLOADER', (ctx) => {
    ctx.editMessageText('আপনার পছন্দের প্ল্যাটফর্ম নির্বাচন করুন:', {
        reply_markup: Markup.inlineKeyboard([
            [
                Markup.button.callback('📷 Instagram', 'SOCIAL_INSTAGRAM'),
                Markup.button.callback('📘 Facebook', 'SOCIAL_FACEBOOK'),
            ],
            [
                Markup.button.callback('▶️ YouTube', 'SOCIAL_YOUTUBE'),
                Markup.button.callback('➕ 100+ সাইট', 'SOCIAL_OTHER'),
            ],
            [Markup.button.callback('⬅️ মূল মেনু', 'BACK_TO_MAIN')],
        ]),
    });
});

bot.action('TERABOX_PLAYER', async (ctx) => {
    await setUserState(ctx.chat.id, 'TERABOX_LINK_EXPECTED');
    ctx.editMessageText('অনুগ্রহ করে **Terabox লিঙ্কটি** দিন যা আপনি ডাউনলোড বা দেখতে চান।');
});

bot.action(/SOCIAL_(INSTAGRAM|FACEBOOK|YOUTUBE|OTHER)/, async (ctx) => {
    const platform = ctx.match[1];
    await setUserState(ctx.chat.id, `SOCIAL_LINK_EXPECTED_${platform}`);
    ctx.editMessageText(`আপনি **${platform}** নির্বাচন করেছেন। অনুগ্রহ করে **ভিডিও লিঙ্কটি** দিন।`);
});

bot.action('BACK_TO_MAIN', async (ctx) => {
    await setUserState(ctx.chat.id, null);
    const welcomeMessage = `
**👋 স্বাগতম! আমি আপনার অল-ইন-ওয়ান ভিডিও ডাউনলোডার এবং প্লেয়ার বট!**
আপনি কোন পরিষেবা থেকে ভিডিও ডাউনলোড বা দেখতে চান তা নির্বাচন করুন।
`;
    ctx.editMessageText(welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🌐 সোশ্যাল ডাউনলোডার', 'SOCIAL_DOWNLOADER')],
            [Markup.button.callback('📦 Terabox প্লেয়ার ও ডাউনলোডার', 'TERABOX_PLAYER')],
        ]),
    });
});


bot.on('text', async (ctx) => {
    const url = ctx.message.text.trim();
    const chatId = ctx.chat.id;

    const currentSelection = await getUserState(chatId); 

    if (!currentSelection) {
        return ctx.reply('দয়া করে প্রথমে **/start** কমান্ড দিয়ে শুরু করুন এবং একটি ডাউনলোড অপশন নির্বাচন করুন।');
    }

    if (!url.startsWith('http')) {
        return ctx.reply('এটি কোনো বৈধ লিঙ্ক বলে মনে হচ্ছে না। দয়া করে একটি সঠিক URL দিন।');
    }

    if (currentSelection.startsWith('TERABOX_LINK_EXPECTED')) {
        // Terabox লজিক...
        try {
            await ctx.reply('🔗 Terabox লিঙ্কটি প্রক্রিয়া করা হচ্ছে...');
            const response = await axios.get(`${TERABOX_API}${encodeURIComponent(url)}`);
            const data = response.data;

            if (data.status === 'success' && data.media_url) {
                const caption = `**📦 Terabox ফাইল পাওয়া গেছে:**\n\n**শিরোনাম:** ${data.title}`;
                const teraboxKeyboard = Markup.inlineKeyboard([
                    [
                        Markup.button.url('▶️ WATCH VIDEO', data.media_url),
                        Markup.button.url('⬇️ DOWNLOAD VIDEO', data.media_url),
                    ],
                    [Markup.button.callback('⬅️ মূল মেনু', 'BACK_TO_MAIN')],
                ]);

                await ctx.replyWithPhoto(data.thumbnail || data.media_url, { 
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_markup: teraboxKeyboard 
                });
            } else {
                ctx.reply('❌ Terabox লিঙ্ক থেকে তথ্য পুনরুদ্ধার করা যায়নি।');
            }
        } catch (error) {
            console.error('Terabox API Error:', error.message);
            ctx.reply('😞 API কল করার সময় একটি ত্রুটি হয়েছে।');
        }

    } else if (currentSelection.startsWith('SOCIAL_LINK_EXPECTED')) {
        // সোশ্যাল মিডিয়া লজিক...
        try {
            await ctx.reply('🔗 ভিডিও লিঙ্কটি প্রক্রিয়া করা হচ্ছে...');
            const response = await axios.get(`${SOCIAL_DOWNLOADER_API}${encodeURIComponent(url)}`);
            const data = response.data;
            
            if (data.statusCode === 200 && data.medias && data.medias.length > 0) {
                const videoMedias = data.medias.filter(m => m.type === 'video' && m.url);
                const audioMedias = data.medias.filter(m => m.type === 'audio' && m.url);

                const caption = `**🌐 ভিডিও পাওয়া গেছে!**\n\n**শিরোনাম:** ${data.title}\n\nআপনার পছন্দসই ফরম্যাট নির্বাচন করুন:`;
                
                let downloadKeyboard = [];
                
                if (videoMedias.length > 0) {
                    downloadKeyboard.push([Markup.button.url(`⬇️ Download Video (${videoMedias[0].resolution || 'Best'})`, videoMedias[0].url)]);
                }
                if (audioMedias.length > 0) {
                    downloadKeyboard.push([Markup.button.url(`🎵 Download Audio (${audioMedias[0].quality || 'Best'})`, audioMedias[0].url)]);
                }

                downloadKeyboard.push([Markup.button.callback('⬅️ মূল মেনু', 'BACK_TO_MAIN')]);
                
                if (downloadKeyboard.length > 1) { 
                    await ctx.replyWithPhoto(data.thumbnail || videoMedias[0]?.thumbnail || url, { 
                        caption: caption,
                        parse_mode: 'Markdown',
                        reply_markup: Markup.inlineKeyboard(downloadKeyboard) 
                    });
                } else {
                    ctx.reply('❌ এই লিঙ্কটির জন্য কোনো ডাউনলোড অপশন খুঁজে পাওয়া যায়নি।');
                }
            } else {
                ctx.reply('❌ এই লিঙ্ক থেকে ভিডিও/অডিও তথ্য পুনরুদ্ধার করা যায়নি।');
            }
        } catch (error) {
            console.error('Social Downloader API Error:', error.message);
            ctx.reply('😞 API কল করার সময় একটি ত্রুটি হয়েছে।');
        }

    } else {
        ctx.reply('দয়া করে প্রথমে **/start** কমান্ড দিয়ে শুরু করুন এবং একটি ডাউনলোড অপশন নির্বাচন করুন।');
    }
});

// --- Webhook Endpoint (Telegram থেকে আপডেট গ্রহণ করার জন্য) ---
// Railway পাবলিক URL-এ '/webhook' রুট হিসেবে সেট করা হবে
app.post(`/webhook`, (req, res) => {
    // Telegraf কে আপডেট হ্যান্ডেল করতে দেওয়া হলো
    bot.handleUpdate(req.body, res)
        .then(() => res.status(200).send('OK'))
        .catch(err => {
            console.error("Telegraf Update Handling Error:", err);
            res.status(500).send('Internal Server Error');
        });
});

// --- সার্ভার চালু করুন ---
async function startServer() {
    // MongoDB কানেক্ট করুন
    if (MONGO_URI) {
        await connectDb();
    }
    
    // Express সার্ভার চালু করুন
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        
        // ওয়েবহুক সেট করুন (একবার)
        const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
        
        if (RAILWAY_URL) {
            // URL এ HTTPS যোগ করা হলো
            const webhookUrl = `https://${RAILWAY_URL}/webhook`; 
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`Webhook set to: ${webhookUrl}`);
        } else {
            console.warn("WARNING: RAILWAY_STATIC_URL or custom domain not found. Webhook not set.");
            console.warn("Please manually set webhook using 'https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/webhook'");
        }
    });
}

startServer();
