// File: api/webhook.js
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

// Vercel Environment Variables থেকে টোকেন নিন
const BOT_TOKEN = process.env.BOT_TOKEN; 
const VERCEL_URL = process.env.VERCEL_URL; // VERCEL_URL টি অবশ্যই সেট করবেন (যেমন: my-bot.vercel.app)

if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not set in Environment Variables.');
}

const bot = new Telegraf(BOT_TOKEN);

// --- API Endpoint গুলি ---
const SOCIAL_DOWNLOADER_API = 'https://downloaderpro.xo.je/mesin/dwn.php/?url=';
const TERABOX_API = 'https://wadownloader.amitdas.site/api/TeraBox/main/?url=';

// Vercel Serverless এ Map/Object ব্যবহার করা ঝুঁকিপূর্ণ কারণ এটি প্রতিবার রিকোয়েস্টে রিসেট হতে পারে।
// তবে আপাতত এই প্রাথমিক ধাপে, আমরা এটি ইনলাইন-কিউ-এর (inline query) বিকল্প হিসেবে ব্যবহার করছি।
// দ্বিতীয় অংশে আমরা MongoDB ব্যবহার করে এই সমস্যার সমাধান করব।
const userSelections = {}; 

/**
 * ইউজার স্টেট সেট/রিসেট করার ফাংশন 
 * @param {number} chatId 
 * @param {string} state 
 */
function setUserState(chatId, state) {
    userSelections[chatId] = state;
}

/**
 * ইউজার স্টেট তুলে নেওয়ার ফাংশন
 * @param {number} chatId
 * @returns {string | undefined}
 */
function getUserState(chatId) {
    const state = userSelections[chatId];
    delete userSelections[chatId]; // স্টেট একবার ব্যবহার হলেই ডিলিট করে দেওয়া হচ্ছে
    return state;
}


// --- ১. /start কমান্ড: ওয়েলকাম মেসেজ ও বাটন ---
bot.start((ctx) => {
    // স্টেট রিসেট
    setUserState(ctx.chat.id, null);

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

// --- ২. সোশ্যাল ডাউনলোডার বাটন হ্যান্ডলিং ---
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

// --- ৩. Terabox প্লেয়ার বাটন হ্যান্ডলিং ---
bot.action('TERABOX_PLAYER', (ctx) => {
    setUserState(ctx.chat.id, 'TERABOX_LINK_EXPECTED');
    ctx.editMessageText('অনুগ্রহ করে **Terabox লিঙ্কটি** দিন যা আপনি ডাউনলোড বা দেখতে চান।');
});

// --- ৪. সোশ্যাল প্ল্যাটফর্ম নির্বাচন হ্যান্ডলিং ---
bot.action(/SOCIAL_(INSTAGRAM|FACEBOOK|YOUTUBE|OTHER)/, (ctx) => {
    const platform = ctx.match[1];
    setUserState(ctx.chat.id, `SOCIAL_LINK_EXPECTED_${platform}`);
    ctx.editMessageText(`আপনি **${platform}** নির্বাচন করেছেন। অনুগ্রহ করে **ভিডিও লিঙ্কটি** দিন।`);
});

// --- ৫. মূল মেনুতে ফিরে যাওয়া ---
bot.action('BACK_TO_MAIN', (ctx) => {
    setUserState(ctx.chat.id, null); // স্টেট রিসেট
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


// --- ৬. ব্যবহারকারীর লিঙ্ক গ্রহণ ও API কল (অনলি টেক্সট মেসেজ) ---
bot.on('text', async (ctx) => {
    const url = ctx.message.text.trim();
    const chatId = ctx.chat.id;
    const currentSelection = getUserState(chatId); // স্টেট নিয়ে ডিলিট করে দেওয়া হলো

    // লিঙ্ক ভ্যালিডেশন
    if (!url.startsWith('http')) {
        return ctx.reply('এটি কোনো বৈধ লিঙ্ক বলে মনে হচ্ছে না। দয়া করে একটি সঠিক URL দিন।');
    }

    if (currentSelection && currentSelection.startsWith('TERABOX_LINK_EXPECTED')) {
        // ৬.১. Terabox লিঙ্ক প্রসেসিং
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

    } else if (currentSelection && currentSelection.startsWith('SOCIAL_LINK_EXPECTED')) {
        // ৬.২. সোশ্যাল মিডিয়া লিঙ্ক প্রসেসিং
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
        // কোনো স্টেট সেট না থাকলে
        ctx.reply('দয়া করে প্রথমে **/start** কমান্ড দিয়ে শুরু করুন এবং একটি ডাউনলোড অপশন নির্বাচন করুন।');
    }
});


// --- Vercel Serverless Function Export ---
// এই অংশটি Vercel-এর জন্য আবশ্যক
module.exports = async (req, res) => {
    // Vercel এ ওয়েবহুক সেট করার জন্য শুধুমাত্র একবার রান করার লজিক
    // যদি VERCEL_URL সেট করা থাকে এবং আপনি 'set_webhook' নামে একটি HTTP রিকোয়েস্ট পাঠান
    if (req.query.set_webhook === 'true' && VERCEL_URL) {
        try {
            const webhookUrl = `https://${VERCEL_URL}/api/webhook`;
            await bot.telegram.setWebhook(webhookUrl);
            console.log(`Webhook set to: ${webhookUrl}`);
            return res.status(200).send('Webhook set successfully!');
        } catch (error) {
            console.error('Error setting webhook:', error);
            return res.status(500).send('Error setting webhook.');
        }
    }
    
    // টেলিগ্রাম আপডেট হ্যান্ডেল করা
    if (req.method === 'POST' && req.body) {
        try {
            await bot.handleUpdate(req.body, res); 
            // Telegraf নিজেই 200 রেসপন্স পাঠাতে পারে, তাই এখানে আবার sending 'OK' একটি অতিরিক্ত সুরক্ষা
            return res.status(200).send('OK'); 
        } catch (err) {
            console.error('Error handling update:', err);
            return res.status(500).send('Internal Server Error');
        }
    }

    res.status(405).send('Method Not Allowed');
};