FLASH HACK KEY STORE — Telegram Bot

FEATURES
- /start menu, Buy Key website link, Support, Help, Cancel
- My Orders checks the existing Supabase RPC check_my_order
- /admin command is restricted by Telegram numeric IDs, but does not verify payment or assign keys.

SECURITY
- BotFather token private rakhein.
- Supabase service_role/secret key kabhi use na karein. Publishable key ya legacy anon public key use karein.
- Customer UTR ko payment proof samajh kar automatically paid mark na karein; real transaction verify karein.
- Existing RPC expected: check_my_order(p_order_number text, p_access_code text). Website currently uses this signature.

ANDROID PHONE SETUP (Render Background Worker)
1. ZIP extract karein.
2. GitHub mobile website/app par repository banayein: flash-hack-key-store-bot. Is folder ke files repository root par upload karein.
3. render.com par sign in karein; New + > Background Worker choose karein (Static Site nahi).
4. GitHub repo connect karein. Build command: npm install. Start command: npm start.
5. Environment Variables add karein:
   TELEGRAM_BOT_TOKEN = BotFather token
   SUPABASE_URL = Supabase Project URL
   SUPABASE_ANON_KEY = publishable/anon public key
   STORE_URL = live Netlify website URL
   SUPPORT_URL = support Telegram link
   ADMIN_TELEGRAM_IDS = optional numeric Telegram user ID(s), comma separated
6. Worker create karein. Logs mein “FLASH HACK KEY STORE Telegram bot started.” aana chahiye.
7. Telegram bot par /start test karein. Buy Key website kholega. My Orders mein test order number aur uska secret access code daal kar status check karein.

IMPORTANT
- Supabase service_role key bot, APK, ya public website mein mat daalein.
- Existing live database par fresh_setup.sql mat chalayein.
- Bot polling ko continuous process chahiye, isliye Background Worker use karein.
