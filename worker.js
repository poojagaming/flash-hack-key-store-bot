
/*
 FLASH HACK KEY STORE
 Cloudflare Worker + Telegram Bot + Supabase

 Cloudflare variables/secrets:
 TELEGRAM_BOT_TOKEN
 WEBHOOK_SECRET
 SUPABASE_URL
 SUPABASE_ANON_KEY
 UPI_QR_URL
 ADMIN_CHAT_ID
 SUPPORT_URL (optional)

 Webhook path: /telegram
*/

const PLANS = {
  p1: { name: "Plan 1", amount: 50 },
  p2: { name: "Plan 2", amount: 150 },
  p3: { name: "Plan 3", amount: 300 }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return new Response("FLASH HACK KEY STORE Worker is running.");
    }

    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }

    if (
      !env.WEBHOOK_SECRET ||
      request.headers.get("X-Telegram-Bot-Api-Secret-Token") !==
        env.WEBHOOK_SECRET
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;

    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    try {
      if (update.callback_query) {
        await handleCallback(update.callback_query, env);
      } else if (update.message) {
        await handleMessage(update.message, env);
      }
    } catch (error) {
      console.error("FLASH BOT ERROR:", error?.stack || error);

      const chatId =
        update?.message?.chat?.id ??
        update?.callback_query?.message?.chat?.id;

      if (chatId) {
        try {
          await sendMessage(
            env,
            chatId,
            "⚠️ Abhi technical problem hai. Dobara try karein ya Support se contact karein."
          );
        } catch (sendError) {
          console.error("Telegram error:", sendError);
        }
      }
    }

    return new Response("OK");
  }
};

/* ---------------- TELEGRAM MESSAGE HANDLER ---------------- */

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  if (!text) return;

  if (text === "/start" || text === "/menu") {
    return sendMessage(
      env,
      chatId,
      "🔥 FLASH HACK KEY STORE 🔥\n\n" +
        "Welcome!\n\n" +
        "🛒 Buy Key se apna plan chunein.\n" +
        "💳 Payment ke baad UTR submit karein.\n" +
        "🔐 Payment verify hone aur key assign hone ke baad order check karein.",
      mainMenu(env)
    );
  }

  if (text === "/help") {
    return sendMessage(
      env,
      chatId,
      "📘 HOW TO ORDER\n\n" +
        "1. Buy Key dabayein.\n" +
        "2. Plan chunein.\n" +
        "3. Apna naam aur mobile bhejein.\n" +
        "4. QR scan karke payment karein.\n" +
        "5. UTR submit karein.\n" +
        "6. Admin verification aur key assignment ka wait karein.\n\n" +
        "Order check:\n/order ORDER_NUMBER ACCESS_CODE",
      mainMenu(env)
    );
  }

  if (text === "/orders" || text === "My Orders") {
    return sendMessage(
      env,
      chatId,
      "📦 Order check karne ke liye bhejein:\n\n" +
        "/order ORDER_NUMBER ACCESS_CODE"
    );
  }

  if (text.startsWith("/order ")) {
    const parts = text.split(/\s+/);

    if (parts.length !== 3) {
      return sendMessage(
        env,
        chatId,
        "Sahi format:\n/order ORDER_NUMBER ACCESS_CODE"
      );
    }

    const result = await callSupabaseRpc(
      env,
      "check_my_order",
      {
        p_order_number: parts[1],
        p_access_code: parts[2]
      }
    );

    if (!result.ok) {
      console.error("Order check failed:", result.data);

      return sendMessage(
        env,
        chatId,
        "Order check nahi ho paya. Order details check karein ya Support se contact karein."
      );
    }

    const order = Array.isArray(result.data)
      ? result.data[0]
      : result.data;

    if (!order) {
      return sendMessage(
        env,
        chatId,
        "❌ Order nahi mila. Order Number aur Access Code check karein."
      );
    }

    const status =
      order.status ||
      order.payment_status ||
      order.order_status ||
      "Pending";

    const assignedKey =
      order.key ||
      order.assigned_key ||
      order.license_key ||
      order.product_key;

    let reply =
      "📦 FLASH HACK STORE — ORDER STATUS\n\n" +
      "Order: " + (order.order_number || parts[1]) + "\n" +
      "Status: " + status;

    if (assignedKey) {
      reply += "\n\n🔑 Assigned Key:\n" + assignedKey;
    } else {
      reply +=
        "\n\nPayment verify hone aur key assign hone ke baad dobara check karein.";
    }

    return sendMessage(env, chatId, reply, mainMenu(env));
  }

  /*
    Customer plan prompt ka reply karke:
    Rahul Kumar, 9876543210
  */
  const repliedText = message.reply_to_message?.text || "";
  const planMatch = repliedText.match(/FLASH_PLAN:(p[123])/);

  if (planMatch) {
    const planKey = planMatch[1];
    const plan = PLANS[planKey];

    const fields = text
      .split(/[,،|]/)
      .map(value => value.trim())
      .filter(Boolean);

    if (fields.length < 2) {
      return sendMessage(
        env,
        chatId,
        "Naam aur mobile number ek saath bhejein.\n\n" +
          "Example:\nRahul Kumar, 9876543210"
      );
    }

    const phone = fields[fields.length - 1].replace(/\D/g, "");
    const customerName = fields.slice(0, -1).join(",").trim();

    if (
      !customerName ||
      phone.length < 10 ||
      phone.length > 13
    ) {
      return sendMessage(
        env,
        chatId,
        "Naam ya mobile number sahi nahi hai.\n\n" +
          "Example:\nRahul Kumar, 9876543210"
      );
    }

    if (!env.UPI_QR_URL) {
      return sendMessage(
        env,
        chatId,
        "⚠️ Payment QR configure nahi hai. Admin se contact karein."
      );
    }

    const caption =
      "💳 FLASH HACK KEY STORE PAYMENT\n\n" +
      "Plan: " + plan.name + "\n" +
      "Amount: ₹" + plan.amount + "\n" +
      "Customer: " + customerName + "\n" +
      "Mobile: " + phone + "\n\n" +
      "1. QR scan karke ₹" + plan.amount + " payment karein.\n" +
      "2. Payment successful hone ke baad UTR submit karein.\n\n" +
      "UTR submit format:\n" +
      "PAY, " + planKey + ", " +
      encodeURIComponent(customerName) + ", " +
      phone + ", YOUR_UTR";

    await sendPhoto(env, chatId, env.UPI_QR_URL, caption);

    return sendMessage(
      env,
      chatId,
      "📌 Payment ke baad upar diye gaye format ko copy karein.\n\n" +
        "YOUR_UTR ki jagah apna transaction UTR number likhein.\n\n" +
        "⚠️ UTR submit karne se payment automatically verified nahi hota. Admin verification ke baad hi key assign hogi."
    );
  }

  /*
    UTR format:
    PAY, p1, Rahul%20Kumar, 9876543210, 123456789012
  */
  if (/^PAY\s*,/i.test(text)) {
    const fields = text.split(",").map(value => value.trim());

    if (fields.length !== 5) {
      return sendMessage(
        env,
        chatId,
        "UTR format sahi nahi hai.\n\n" +
          "PAY, p1, Rahul%20Kumar, 9876543210, YOUR_UTR"
      );
    }

    const planKey = fields[1].toLowerCase();
    const plan = PLANS[planKey];

    if (!plan) {
      return sendMessage(
        env,
        chatId,
        "Invalid plan. /start dabakar dobara plan chunein."
      );
    }

    let customerName;

    try {
      customerName = decodeURIComponent(fields[2]);
    } catch {
      customerName = fields[2];
    }

    const phone = fields[3].replace(/\D/g, "");
    const utr = fields[4].replace(/\s/g, "");

    if (
      !customerName ||
      phone.length < 10 ||
      phone.length > 13 ||
      !/^\d{10,22}$/.test(utr)
    ) {
      return sendMessage(
        env,
        chatId,
        "Naam, mobile ya UTR sahi nahi hai. Details dobara check karein."
      );
    }

    const accessCode = randomAccessCode(8);

    const payload = {
      p_customer_name: customerName,
      p_contact: phone,
      p_plan_name: plan.name,
      p_amount: plan.amount,
      p_access_code: accessCode,
      p_utr: utr,
      p_phone_number: phone,
      p_telegram_link: message.from?.username
        ? "https://t.me/" + message.from.username
        : null
    };

    const result = await callSupabaseRpc(
      env,
      "create_order_after_utr",
      payload
    );

    if (!result.ok) {
      console.error("Create order failed:", result.data);

      return sendMessage(
        env,
        chatId,
        "❌ Order save nahi hua.\n\n" +
          "Dobara payment na karein. Admin/Support se contact karein."
      );
    }

    const row = Array.isArray(result.data)
      ? result.data[0]
      : result.data;

    const orderNumber =
      row?.order_number ||
      row?.order_no ||
      row?.id;

    if (!orderNumber) {
      console.error("Unexpected RPC response:", result.data);

      return sendMessage(
        env,
        chatId,
        "Order request process hui, lekin order number response mein nahi mila. Admin se contact karein."
      );
    }

    await sendMessage(
      env,
      chatId,
      "✅ ORDER SUBMITTED\n\n" +
        "Order Number: " + orderNumber + "\n" +
        "Access Code: " + accessCode + "\n" +
        "Plan: " + plan.name + "\n" +
        "Amount: ₹" + plan.amount + "\n" +
        "UTR: " + utr + "\n\n" +
        "Payment admin verify karega. Order Number aur Access Code save rakhein.\n\n" +
        "Order check karne ke liye:\n" +
        "/order " + orderNumber + " " + accessCode
    );

    if (env.ADMIN_CHAT_ID) {
      await sendMessage(
        env,
        env.ADMIN_CHAT_ID,
        "🆕 NEW ORDER — PAYMENT REVIEW\n\n" +
          "Customer: " + customerName + "\n" +
          "Mobile: " + phone + "\n" +
          "Plan: " + plan.name + "\n" +
          "Amount: ₹" + plan.amount + "\n" +
          "UTR: " + utr + "\n" +
          "Order: " + orderNumber + "\n" +
          "Telegram ID: " + message.from.id + "\n\n" +
          "⚠️ Bank/UPI app mein payment verify karein. Sirf UTR milne par payment approve na karein."
      );
    }

    return;
  }

  return sendMessage(
    env,
    chatId,
    "Menu kholne ke liye /start dabayein.",
    mainMenu(env)
  );
}

/* ---------------- BUTTON HANDLER ---------------- */

async function handleCallback(query, env) {
  const chatId = query.message.chat.id;

  await telegram(env, "answerCallbackQuery", {
    callback_query_id: query.id
  });

  if (query.data === "buy_key") {
    return sendMessage(
      env,
      chatId,
      "🛒 APNA PLAN CHUNEIN\n\n" +
        "Plan 1 — ₹50\n" +
        "Plan 2 — ₹150\n" +
        "Plan 3 — ₹300",
      {
        inline_keyboard: [
          [{ text: "Plan 1 — ₹50", callback_data: "plan:p1" }],
          [{ text: "Plan 2 — ₹150", callback_data: "plan:p2" }],
          [{ text: "Plan 3 — ₹300", callback_data: "plan:p3" }],
          [{ text: "⬅️ Main Menu", callback_data: "home" }]
        ]
      }
    );
  }

  if (query.data?.startsWith("plan:")) {
    const planKey = query.data.split(":")[1];
    const plan = PLANS[planKey];

    if (!plan) {
      return sendMessage(env, chatId, "Invalid plan. /start dabayein.");
    }

    return sendMessage(
      env,
      chatId,
      "✅ SELECTED: " + plan.name + "\n" +
        "💰 Amount: ₹" + plan.amount + "\n\n" +
        "Ab is message par Reply karke apna naam aur mobile bhejein.\n\n" +
        "Example:\nRahul Kumar, 9876543210\n\n" +
        "FLASH_PLAN:" + planKey
    );
  }

  if (query.data === "my_orders") {
    return sendMessage(
      env,
      chatId,
      "📦 ORDER STATUS\n\n" +
        "Apna order check karne ke liye bhejein:\n\n" +
        "/order ORDER_NUMBER ACCESS_CODE"
    );
  }

  if (query.data === "help") {
    return sendMessage(
      env,
      chatId,
      "📘 HELP\n\n" +
        "1. Buy Key dabayein.\n" +
        "2. Plan select karein.\n" +
        "3. Naam aur mobile bhejein.\n" +
        "4. QR se payment karein.\n" +
        "5. UTR submit karein.\n" +
        "6. Payment verification ka wait karein.\n\n" +
        "Order check: /order ORDER_NUMBER ACCESS_CODE"
    );
  }

  if (query.data === "home") {
    return sendMessage(
      env,
      chatId,
      "🔥 FLASH HACK KEY STORE\n\nOption chunein:",
      mainMenu(env)
    );
  }
}

/* ---------------- MENUS ---------------- */

function mainMenu(env) {
  const supportUrl =
    env.SUPPORT_URL || "https://t.me/VCORE_LOADER";

  return {
    inline_keyboard: [
      [{ text: "🛒 Buy Key", callback_data: "buy_key" }],
      [
        { text: "📦 My Orders", callback_data: "my_orders" },
        { text: "ℹ️ Help", callback_data: "help" }
      ],
      [{ text: "💬 Support", url: supportUrl }]
    ]
  };
}

/* ---------------- TELEGRAM API ---------------- */

async function sendMessage(
  env,
  chatId,
  text,
  replyMarkup
) {
  const body = {
    chat_id: chatId,
    text: String(text),
    disable_web_page_preview: true
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  return telegram(env, "sendMessage", body);
}

async function sendPhoto(
  env,
  chatId,
  photoUrl,
  caption
) {
  return telegram(env, "sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption: caption
  });
}

async function telegram(env, method, body) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const response = await fetch(
    "https://api.telegram.org/bot" +
      env.TELEGRAM_BOT_TOKEN +
      "/" + method,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(
      "Telegram " + method + " failed: " +
      JSON.stringify(result)
    );
  }

  return result.result;
}

/* ---------------- SUPABASE RPC ---------------- */

async function callSupabaseRpc(env, rpcName, payload) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  const baseUrl = String(env.SUPABASE_URL).replace(/\/+$/, "");

  const response = await fetch(
    baseUrl + "/rest/v1/rpc/" + rpcName,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": env.SUPABASE_ANON_KEY,
        "authorization": "Bearer " + env.SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    }
  );

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

/* ---------------- RANDOM ACCESS CODE ---------------- */

function randomAccessCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(
    new Uint8Array(length)
  );

  let result = "";

  for (let i = 0; i < bytes.length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }

  return result;
        }
