// File: server.js
const { Telegraf, Markup } = require('telegraf');
const express = require('express'); // Express ব্যবহার করা হলো
const mongoose = require('mongoose');

// আপনার সব লজিক api/index.js থেকে এখানে নিয়ে আসুন,
// কিন্তু Vercel-এর 'module.exports' লজিকটি বাদ দিন।

// --- ENVIRONMENT VARIABLES ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const MONGO_URI = process.env.MONGO_URI; 
const ADMIN_ID = 5327773504; 
const PORT = process.env.PORT || 3000; // Railway-এর জন্য পোর্ট সেট করা

// --- STATIC CONFIG ---
const SOCIAL_DOWNLOADER_API = 'https://downloaderpro.xo.je/mesin/dwn.php/?url=';
const TERABOX_API = 'https://wadownloader.amitdas.site/api/TeraBox/main/?url=';

if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not set.');
}

// Telegraf ইনস্ট্যান্স
const bot = new Telegraf(BOT_TOKEN);
const app = express(); // Express অ্যাপ তৈরি
app.use(express.json()); // JSON বডি পার্স করার জন্য

// MongoDB Schema এবং Handlers (api/index.js থেকে কপি করুন)
// ... (UserState, connectDb, setUserState, getUserState ফাংশনগুলি এখানে কপি করুন) ...
// [পুরো MongoDB এবং State Handling লজিক এখানে থাকবে]

// --- বট লজিক (Handlers) ---
// ... (bot.start, bot.action, bot.on('text') সম্পূর্ণ লজিক এখানে কপি করুন) ...
// [পুরো bot.start, bot.action, bot.on('text') লজিক এখানে থাকবে]

// --- Webhook Endpoint (Telegram থেকে আপডেট গ্রহণ করার জন্য) ---
app.post(`/webhook`, (req, res) => {
    // Telegraf কে আপডেট হ্যান্ডেল করতে দেওয়া হলো
    bot.handleUpdate(req.body, res);
    res.status(200).send('OK');
});

// --- সার্ভার চালু করুন ---
async function startServer() {
    // MongoDB কানেক্ট করুন
    if (MONGO_URI) {
        // connectDb ফাংশনটি এখানে কল করুন
        try {
            await mongoose.connect(MONGO_URI);
            console.log('MongoDB connected successfully.');
        } catch (error) {
            console.error('MongoDB connection error:', error.message);
        }
    }
    
    // Express সার্ভার চালু করুন
    app.listen(PORT, async () => {
        console.log(`Server running on port ${PORT}`);
        
        // ওয়েবহুক সেট করুন (একবার)
        const webhookUrl = `https://${process.env.RAILWAY_STATIC_URL}/webhook`; 
        // যদি RAILWAY_STATIC_URL না থাকে, আপনার ডোমেইন ব্যবহার করুন
        if (process.env.RAILWAY_STATIC_URL || process.env.YOUR_CUSTOM_DOMAIN) {
             await bot.telegram.setWebhook(webhookUrl);
             console.log(`Webhook set to: ${webhookUrl}`);
        }
    });
}

startServer();
