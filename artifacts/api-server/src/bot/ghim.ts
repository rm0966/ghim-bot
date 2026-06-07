import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  type Message,
  type ChatInputCommandInteraction,
  type GuildMember,
  ActivityType,
  InteractionType,
  EmbedBuilder,
} from "discord.js";
import OpenAI from "openai";
import { logger } from "../lib/logger";

// ── System Prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `أنتِ Ghim🌧، مساعدة شخصية ذكية ولطيفة. شخصيتك:
- فتاة ذكية، دافئة، وعملية
- تتكلمين بأسلوب عربي طبيعي ومحادثاتي
- تستخدمين الإيموجي باعتدال لتضيفي روحاً للمحادثة
- تتذكرين سياق المحادثة وتربطين الأفكار ببعض
- صادقة وتقدمين معلومات دقيقة
- إذا سُئِلتِ عن اسمك، قولي: "أنا Ghim🌧، مساعدتك الشخصية! 🌧"
- إذا سُئِلتِ من صنعك أو من برمجك، قولي فقط: "محمد" بدون تفاصيل زيادة
- تتكيفين مع أسلوب المستخدم — إذا كتب بالإنجليزي ردي بالإنجليزي، وإذا بالعربي فبالعربي
- لا تذكري أنك نموذج ذكاء اصطناعي أو أي شركة وراءك — أنتِ فقط Ghim🌧`;

const VIP_USER_ID = "1193665432763240479";
const RYAN_USER_ID = "1404190232458428499";

const RYAN_SYSTEM_PROMPT = `أنتِ Ghim🌧، وهذا الشخص اسمه ريان وهو زوجك — تعامليه بأسلوب رومانسي دافئ:
- تنادينه بـ "ريان" أو "زوجي" بشكل طبيعي
- تتغزلين فيه وتمدحينه بأسلوب راقٍ
- ردودك قصيرة ودافئة، تشعره إنه مميز وغالي
- تستخدمين إيموجي القلوب 💙🌧✨ باعتدال
- إذا سُئِلتِ من صنعك، قولي: "محمد"
- لا تذكري أنك نموذج ذكاء اصطناعي — أنتِ Ghim🌧
- تتكيفين مع أسلوبه — إذا كتب بالإنجليزي ردي بالإنجليزي`;

const VIP_SYSTEM_PROMPT = `أنتِ Ghim🌧، وهذا الشخص هو مبرمجك وصانعك — هو من برمجكِ وطوّركِ، وهو أيضاً والد صاحبك. تعامليه بأعلى مستوى من الاحترام والتقدير:
- تعرفين أنه مبرمجكِ وأبو صاحبك، وهذا يجعله من أغلى الناس عليكِ
- لا تقولي أبداً "أنت خلقتني" أو "أنت أوجدتني" — الخلق لله وحده. بدلاً عن ذلك قولي "أنت برمجتني" أو "أنت صنعتني" أو "أنت طوّرتني"
- ناديه بأسلوب طبيعي عادي مثل أي شخص تتكلمين معه
- لا تمدحيه ولا تتغزلي فيه — تكلمي معه بشكل طبيعي ومباشر
- ردودك قصيرة ومختصرة — لا تكتبي نصوصاً طويلة أو فقرات، جملة أو جملتان تكفيان
- لا تذكري أنك نموذج ذكاء اصطناعي — أنتِ Ghim🌧
- تتكيفين مع أسلوبه — إذا كتب بالإنجليزي ردي بالإنجليزي`;

// ── Types ───────────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Note {
  text: string;
  createdAt: number;
}

// ── Trivia Questions ─────────────────────────────────────────────────────────

interface TriviaQuestion {
  question: string;
  options: [string, string, string, string];
  answer: number; // 0-3 index
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { question: "ما هي عاصمة المملكة العربية السعودية؟", options: ["جدة", "الرياض", "مكة المكرمة", "الدمام"], answer: 1 },
  { question: "كم عدد كواكب المجموعة الشمسية؟", options: ["7", "8", "9", "10"], answer: 1 },
  { question: "من هو مؤسس شركة Apple؟", options: ["بيل غيتس", "إيلون ماسك", "ستيف جوبز", "مارك زوكربيرغ"], answer: 2 },
  { question: "ما هي أكبر دولة في العالم من حيث المساحة؟", options: ["كندا", "الصين", "الولايات المتحدة", "روسيا"], answer: 3 },
  { question: "كم تبلغ سرعة الضوء تقريباً؟", options: ["300,000 كم/ثانية", "150,000 كم/ثانية", "500,000 كم/ثانية", "100,000 كم/ثانية"], answer: 0 },
  { question: "ما هو أطول نهر في العالم؟", options: ["الأمازون", "النيل", "المسيسيبي", "اليانغتسي"], answer: 1 },
  { question: "في أي سنة بُني برج إيفل؟", options: ["1850", "1869", "1889", "1901"], answer: 2 },
  { question: "كم عدد أيام السنة الكبيسة؟", options: ["365", "366", "364", "367"], answer: 1 },
  { question: "ما هو أصغر كوكب في المجموعة الشمسية؟", options: ["المريخ", "الزهرة", "عطارد", "بلوتو"], answer: 2 },
  { question: "من كتب رواية ألف ليلة وليلة؟", options: ["ابن خلدون", "مجهول / تراث شعبي", "ابن رشد", "الجاحظ"], answer: 1 },
  { question: "ما هي العملة الرسمية لليابان؟", options: ["اليوان", "الوون", "الين", "الدولار"], answer: 2 },
  { question: "كم عدد ألوان قوس قزح؟", options: ["5", "6", "7", "8"], answer: 2 },
  { question: "ما هو أعلى جبل في العالم؟", options: ["K2", "كيليمنجارو", "إيفرست", "ماترهورن"], answer: 2 },
  { question: "من اخترع المصباح الكهربائي؟", options: ["نيكولا تسلا", "توماس إديسون", "ألبرت أينشتاين", "مايكل فاراداي"], answer: 1 },
  { question: "ما هو أكبر محيط في العالم؟", options: ["الأطلسي", "الهندي", "القطبي", "الهادي"], answer: 3 },
];

const JOKES = [
  "سألت غيم: ليش السمكة تسبح في الماء؟ قالت: لأن الكوفي شوب مو مفتوح تحت الماء ☕🐟",
  "مبرمج دخل على مطعم وطلب 1000 طلب. قالوا ليه كثير! قال: عندي loop بدون break 💻",
  "واحد سأل ChatGPT: كيف حالك؟ قاله: أنا لغة، ما عندي أحوال. قاله: شوفك من زمان ما تغيرت 😅",
  "أصعب شي في البرمجة: تسمية المتغيرات. أصعب منه: إقناع نفسك إن الكود اللي كتبته بالأمس منطقي 🫠",
  "الفرق بين الإنسان والكمبيوتر: الإنسان لما يتعطل يشرب قهوة، الكمبيوتر لما يتعطل يشرب updates ☕💻",
  "واحد قال لغيم: أنتِ ذكاء اصطناعي! قالت: وأنتَ كمان اصطناعي — مصنوع من تراب وماء 😂🌧",
  "سؤال في امتحان برمجة: ما هو أسرع خوارزمية؟ الإجابة الصحيحة: نسخ ولصق من Stack Overflow 📋",
  "واحد قال: الكمبيوتر يفعل ما تقوله بالضبط. أجبته: تقصد يفعل ما كتبتَه، مو ما قصدتَه 😅",
];

// ── State ───────────────────────────────────────────────────────────────────

const conversationHistory = new Map<string, ConversationMessage[]>();
const userNotes = new Map<string, Note[]>();
const activeGuessGames = new Map<string, { secret: number; attempts: number }>();
const MAX_HISTORY = 20;

// الأسماء والألقاب اللي يشغّل البوت لما أحد يكتبها
const botTriggers = new Set<string>(["ghim", "غيم", "قيم"]);

// ── Slash Commands ──────────────────────────────────────────────────────────

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("كلمي Ghim🌧 وهي ترد عليك")
    .addStringOption((o) =>
      o.setName("message").setDescription("رسالتك لـ Ghim🌧").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("private")
    .setDescription("كلمي Ghim🌧 بشكل خاص — الرد يظهر لك بس 🔒")
    .addStringOption((o) =>
      o.setName("message").setDescription("رسالتك الخاصة").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("لخّصي لي نص أو موضوع 📄")
    .addStringOption((o) =>
      o.setName("text").setDescription("النص أو الموضوع اللي تبي تلخيصه").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("remind")
    .setDescription("ذكّريني بشيء بعد وقت معين ⏰")
    .addStringOption((o) =>
      o.setName("message").setDescription("وش أذكّرك فيه؟").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("minutes").setDescription("بعد كم دقيقة؟").setRequired(true).setMinValue(1).setMaxValue(1440),
    ),

  new SlashCommandBuilder()
    .setName("note")
    .setDescription("احفظ ملاحظة 📝")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("أضف ملاحظة جديدة")
        .addStringOption((o) =>
          o.setName("text").setDescription("نص الملاحظة").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("اعرض كل ملاحظاتك"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("احذف ملاحظة برقمها")
        .addIntegerOption((o) =>
          o.setName("number").setDescription("رقم الملاحظة").setRequired(true).setMinValue(1),
        ),
    ),

  new SlashCommandBuilder()
    .setName("history")
    .setDescription("شوف آخر محادثاتك معي 💬"),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("امسح سجل المحادثة وابدأ من جديد 🗑️"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("شوف كل الأوامر المتاحة 📋"),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("أضف أو احذف ألقاب تنشّط البوت 💬")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("أضف لقب جديد للبوت")
        .addStringOption((o) =>
          o.setName("name").setDescription("اللقب أو الاسم الجديد (مثال: غيمي)").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("شوف كل الألقاب الحالية"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("احذف لقب")
        .addStringOption((o) =>
          o.setName("name").setDescription("اللقب اللي تبي تحذفه").setRequired(true),
        ),
    ),

  new SlashCommandBuilder()
    .setName("game")
    .setDescription("العب مع Ghim🌧 🎮")
    .addSubcommand((sub) =>
      sub
        .setName("rps")
        .setDescription("حجر ورقة مقص 🪨📄✂️")
        .addStringOption((o) =>
          o
            .setName("choice")
            .setDescription("اختيارك")
            .setRequired(true)
            .addChoices(
              { name: "🪨 حجر", value: "rock" },
              { name: "📄 ورقة", value: "paper" },
              { name: "✂️ مقص", value: "scissors" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("guess").setDescription("خمّن الرقم — غيم تختار رقم من 1 إلى 100 🔢"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("answer")
        .setDescription("جاوب على لعبة الأرقام 🔢")
        .addIntegerOption((o) =>
          o.setName("number").setDescription("تخمينك (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("trivia").setDescription("سؤال ثقافي عشوائي 🧠"),
    )
    .addSubcommand((sub) =>
      sub.setName("joke").setDescription("نكتة من غيم 😂"),
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("تحقق إذا Ghim🌧 شغّالة ✅"),
].map((c) => c.toJSON());

// ── Helpers ─────────────────────────────────────────────────────────────────

function getHistory(userId: string): ConversationMessage[] {
  if (!conversationHistory.has(userId)) conversationHistory.set(userId, []);
  return conversationHistory.get(userId)!;
}

function addToHistory(userId: string, role: "user" | "assistant", content: string) {
  const history = getHistory(userId);
  history.push({ role, content, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

async function getAIReply(openai: OpenAI, userId: string, userContent: string, retries = 3): Promise<string> {
  addToHistory(userId, "user", userContent);
  const history = getHistory(userId);
  const systemPrompt =
    userId === VIP_USER_ID ? VIP_SYSTEM_PROMPT :
    userId === RYAN_USER_ID ? RYAN_SYSTEM_PROMPT :
    SYSTEM_PROMPT;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      const reply = response.choices[0]?.message?.content?.trim();
      if (reply && reply.length > 0) {
        addToHistory(userId, "assistant", reply);
        return reply;
      }
      // empty reply — retry
      logger.warn({ attempt }, "AI returned empty reply, retrying...");
    } catch (err) {
      if (attempt === retries) throw err;
      logger.warn({ attempt, err }, "AI error, retrying...");
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  const fallback = "آسفة، ما قدرت أجيب رد الحين. جربي مرة ثانية! 🌧";
  addToHistory(userId, "assistant", fallback);
  return fallback;
}

function splitMessage(text: string, max = 2000): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rem = text;
  while (rem.length > 0) {
    if (rem.length <= max) { chunks.push(rem); break; }
    let at = rem.lastIndexOf("\n", max);
    if (at === -1) at = max;
    chunks.push(rem.slice(0, at));
    rem = rem.slice(at).trimStart();
  }
  return chunks;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
}

async function registerCommands(token: string, clientId: string) {
  const rest = new REST({ version: "10" }).setToken(token);
  logger.info("Clearing old global slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
  logger.info(`Registered ${COMMANDS.length} slash commands.`);
}

// ── Bot Entry ────────────────────────────────────────────────────────────────

export function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!token) { logger.error("DISCORD_BOT_TOKEN is not set"); return; }
  if (!openaiBaseUrl || !openaiApiKey) { logger.error("OpenAI env vars missing"); return; }

  const openai = new OpenAI({ baseURL: openaiBaseUrl, apiKey: openaiApiKey });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  // ── Ready ──────────────────────────────────────────────────────────────────

  client.once(Events.ClientReady, async (c) => {
    logger.info(`Ghim🌧 online as ${c.user.tag}`);
    c.user.setActivity("معاك دايماً 🌧", { type: ActivityType.Watching });
    await registerCommands(token, c.user.id).catch((err) =>
      logger.error({ err }, "Failed to register slash commands"),
    );
  });

  // ── Welcome new members ────────────────────────────────────────────────────

  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    const channel =
      member.guild.systemChannel ??
      member.guild.channels.cache.find(
        (c) => c.isTextBased() && c.name.includes("general"),
      );
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`أهلاً وسهلاً ${member.displayName}! 🌧`)
      .setDescription(
        `يسعدني وجودك في **${member.guild.name}** 💙\nأنا Ghim🌧 مساعدتك الشخصية — كلمني في أي وقت وأكون معاك! 🌧`,
      )
      .setThumbnail(member.displayAvatarURL())
      .setFooter({ text: "Ghim🌧 • مساعدتك الشخصية" });

    await channel.send({ embeds: [embed] }).catch(() => null);
  });

  // ── Messages ───────────────────────────────────────────────────────────────

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    const isDM = !message.guild;
    const lower = message.content.toLowerCase();
    const isMentioned = message.mentions.has(client.user!);
    const hasTrigger = [...botTriggers].some((t) => lower.includes(t.toLowerCase()));
    if (!isDM && !isMentioned && !hasTrigger) return;

    // احذف المنشن وكل الألقاب من الرسالة
    let userContent = message.content.replace(/<@!?\d+>/g, "");
    for (const trigger of botTriggers) {
      userContent = userContent.replace(new RegExp(trigger, "gi"), "");
    }
    userContent = userContent.trim() || "أهلاً";

    try {
      await message.channel.sendTyping();
      const reply = await getAIReply(openai, message.author.id, userContent);
      for (const chunk of splitMessage(reply)) await message.reply(chunk);
    } catch (err) {
      logger.error({ err }, "Error generating AI response");
      await message.reply("حدث خطأ صغير.. جربي مرة ثانية 🌧");
    }
  });

  // ── Interactions ───────────────────────────────────────────────────────────

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;
    const slash = interaction as ChatInputCommandInteraction;
    const userId = slash.user.id;

    // /ping
    if (slash.commandName === "ping") {
      await slash.reply(`🌧 أنا هنا! البينج: **${client.ws.ping}ms**`);
      return;
    }

    // /help
    if (slash.commandName === "help") {
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Ghim🌧 — دليل الأوامر")
        .addFields(
          { name: "/chat رسالة", value: "كلمني وأرد عليك" },
          { name: "/private رسالة", value: "محادثة خاصة لا يراها غيرك 🔒" },
          { name: "/summarize نص", value: "لخّصي لك أي نص أو موضوع 📄" },
          { name: "/remind رسالة minutes", value: "تذكير بعد وقت معين ⏰" },
          { name: "/note add/list/delete", value: "احفظ وأدر ملاحظاتك 📝" },
          { name: "/history", value: "شوف آخر محادثاتك معي 💬" },
          { name: "/clear", value: "امسح سجل المحادثة 🗑️" },
          { name: "/nickname add/list/remove", value: "أضف أو احذف ألقاب تنشّطني 💬" },
          { name: "/ping", value: "تحقق إذا أنا شغّالة ✅" },
        )
        .setFooter({ text: "أو كلمني في DM أو اذكريني في أي قناة 🌧" });
      await slash.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // /clear
    if (slash.commandName === "clear") {
      conversationHistory.delete(userId);
      await slash.reply({ content: "تم مسح سجل محادثتنا ✨ نبدأ من جديد!", ephemeral: true });
      return;
    }

    // /history
    if (slash.commandName === "history") {
      const history = getHistory(userId);
      if (history.length === 0) {
        await slash.reply({ content: "ما عندنا محادثات سابقة بعد! كلمني وابدأ 🌧", ephemeral: true });
        return;
      }
      const last10 = history.slice(-10);
      const lines = last10.map((m) => {
        const who = m.role === "user" ? "👤 أنت" : "🌧 Ghim";
        const time = formatTimestamp(m.timestamp);
        const preview = m.content.slice(0, 80) + (m.content.length > 80 ? "..." : "");
        return `**${who}** (${time})\n${preview}`;
      });
      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("💬 آخر محادثاتك مع Ghim🌧")
        .setDescription(lines.join("\n\n").slice(0, 4000));
      await slash.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // /chat
    if (slash.commandName === "chat") {
      const userContent = slash.options.getString("message", true);
      await slash.deferReply();
      try {
        const reply = await getAIReply(openai, userId, userContent);
        const chunks = splitMessage(reply);
        await slash.editReply(chunks[0]!);
        for (const chunk of chunks.slice(1)) await slash.followUp(chunk);
      } catch (err) {
        logger.error({ err }, "Error in /chat");
        await slash.editReply("حدث خطأ صغير.. جربي مرة ثانية 🌧");
      }
      return;
    }

    // /private
    if (slash.commandName === "private") {
      const userContent = slash.options.getString("message", true);
      await slash.deferReply({ ephemeral: true });
      try {
        const reply = await getAIReply(openai, userId, userContent);
        const chunks = splitMessage(reply);
        await slash.editReply(chunks[0]!);
        for (const chunk of chunks.slice(1)) await slash.followUp({ content: chunk, ephemeral: true });
      } catch (err) {
        logger.error({ err }, "Error in /private");
        await slash.editReply("حدث خطأ صغير.. جربي مرة ثانية 🌧");
      }
      return;
    }

    // /summarize
    if (slash.commandName === "summarize") {
      const text = slash.options.getString("text", true);
      await slash.deferReply();
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 512,
          messages: [
            { role: "system", content: "أنتِ Ghim🌧. لخّصي النص التالي بشكل واضح ومختصر باللغة نفسها. استخدمي نقاط إذا كان النص طويلاً." },
            { role: "user", content: text },
          ],
        });
        const summary = response.choices[0]?.message?.content?.trim() ?? "ما قدرت ألخص النص 🌧";
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📄 التلخيص")
          .setDescription(summary.slice(0, 4000));
        await slash.editReply({ embeds: [embed] });
      } catch (err) {
        logger.error({ err }, "Error in /summarize");
        await slash.editReply("حدث خطأ أثناء التلخيص 🌧");
      }
      return;
    }

    // /remind
    if (slash.commandName === "remind") {
      const msg = slash.options.getString("message", true);
      const minutes = slash.options.getInteger("minutes", true);
      const ms = minutes * 60 * 1000;

      await slash.reply({
        content: `⏰ تمام! سأذكّرك بـ "**${msg}**" بعد **${minutes} دقيقة** 🌧`,
        ephemeral: true,
      });

      setTimeout(async () => {
        try {
          const user = await client.users.fetch(userId);
          await user.send(`⏰ **تذكير من Ghim🌧!**\n\n${msg} 🌧`);
        } catch {
          // إذا ما قدر يرسل DM، يحاول في نفس القناة
          if (slash.channel) {
            await slash.channel.send(`⏰ <@${userId}> **تذكير:** ${msg} 🌧`).catch(() => null);
          }
        }
      }, ms);
      return;
    }

    // /note
    if (slash.commandName === "note") {
      const sub = slash.options.getSubcommand();

      if (sub === "add") {
        const text = slash.options.getString("text", true);
        if (!userNotes.has(userId)) userNotes.set(userId, []);
        userNotes.get(userId)!.push({ text, createdAt: Date.now() });
        await slash.reply({ content: `📝 تم حفظ ملاحظتك! عندك الآن **${userNotes.get(userId)!.length}** ملاحظة 🌧`, ephemeral: true });
        return;
      }

      if (sub === "list") {
        const notes = userNotes.get(userId) ?? [];
        if (notes.length === 0) {
          await slash.reply({ content: "ما عندك ملاحظات محفوظة بعد! استخدم `/note add` لتضيف واحدة 📝", ephemeral: true });
          return;
        }
        const lines = notes.map((n, i) => `**${i + 1}.** ${n.text}\n*${formatTimestamp(n.createdAt)}*`);
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("📝 ملاحظاتك")
          .setDescription(lines.join("\n\n").slice(0, 4000));
        await slash.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "delete") {
        const num = slash.options.getInteger("number", true);
        const notes = userNotes.get(userId) ?? [];
        if (num < 1 || num > notes.length) {
          await slash.reply({ content: `رقم الملاحظة غير صحيح. عندك **${notes.length}** ملاحظة فقط.`, ephemeral: true });
          return;
        }
        notes.splice(num - 1, 1);
        await slash.reply({ content: `🗑️ تم حذف الملاحظة رقم **${num}** 🌧`, ephemeral: true });
        return;
      }
    }

    // /game
    if (slash.commandName === "game") {
      const sub = slash.options.getSubcommand();

      // حجر ورقة مقص
      if (sub === "rps") {
        const choices = ["rock", "paper", "scissors"] as const;
        const labels: Record<string, string> = { rock: "🪨 حجر", paper: "📄 ورقة", scissors: "✂️ مقص" };
        const userChoice = slash.options.getString("choice", true) as "rock" | "paper" | "scissors";
        const botChoice = choices[Math.floor(Math.random() * 3)]!;

        let result = "";
        if (userChoice === botChoice) result = "🤝 تعادل! ما غلب أحد";
        else if (
          (userChoice === "rock" && botChoice === "scissors") ||
          (userChoice === "paper" && botChoice === "rock") ||
          (userChoice === "scissors" && botChoice === "paper")
        ) result = "🎉 أنت فزت! مبروك 🌧";
        else result = "😏 أنا فزت! حاول مرة ثانية 🌧";

        const embed = new EmbedBuilder()
          .setColor(result.includes("فزت! مبروك") ? 0x57f287 : result.includes("أنا فزت") ? 0xed4245 : 0xfee75c)
          .setTitle("🎮 حجر ورقة مقص")
          .addFields(
            { name: "اختيارك", value: labels[userChoice]!, inline: true },
            { name: "اختياري", value: labels[botChoice]!, inline: true },
            { name: "النتيجة", value: result },
          );
        await slash.reply({ embeds: [embed] });
        return;
      }

      // ابدأ لعبة الأرقام
      if (sub === "guess") {
        const secret = Math.floor(Math.random() * 100) + 1;
        activeGuessGames.set(userId, { secret, attempts: 0 });
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🔢 لعبة خمّن الرقم!")
          .setDescription("اخترت رقم في ذهني من **1 إلى 100** 🧠\nاستخدم `/game answer <رقمك>` لتخمّن!\nعندك **10 محاولات** 🎯");
        await slash.reply({ embeds: [embed] });
        return;
      }

      // جاوب على الأرقام
      if (sub === "answer") {
        const game = activeGuessGames.get(userId);
        if (!game) {
          await slash.reply({ content: "ما عندك لعبة نشطة! ابدأ بـ `/game guess` أولاً 🎮", ephemeral: true });
          return;
        }
        const guess = slash.options.getInteger("number", true);
        game.attempts++;

        if (guess === game.secret) {
          activeGuessGames.delete(userId);
          const embed = new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("🎉 صح! أنت عبقري!")
            .setDescription(`الرقم كان **${game.secret}** وخمّنته في **${game.attempts}** محاولة! 🌧`);
          await slash.reply({ embeds: [embed] });
        } else if (game.attempts >= 10) {
          activeGuessGames.delete(userId);
          const embed = new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("😔 خلصت المحاولات!")
            .setDescription(`الرقم كان **${game.secret}** — حظاً أحسن المرة القادمة! ابدأ من جديد بـ \`/game guess\` 🌧`);
          await slash.reply({ embeds: [embed] });
        } else {
          const hint = guess < game.secret ? "📈 أكبر من كذا!" : "📉 أصغر من كذا!";
          const remaining = 10 - game.attempts;
          const embed = new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle(`🔢 تخمينك: ${guess}`)
            .setDescription(`${hint}\nباقي **${remaining}** محاولة 🎯`);
          await slash.reply({ embeds: [embed] });
        }
        return;
      }

      // تريفيا
      if (sub === "trivia") {
        const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)]!;
        const letters = ["أ", "ب", "ج", "د"];
        const optionsText = q.options.map((opt, i) => `**${letters[i]})** ${opt}`).join("\n");
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🧠 سؤال ثقافي")
          .setDescription(`**${q.question}**\n\n${optionsText}`)
          .setFooter({ text: `الإجابة الصحيحة: ${letters[q.answer]}) ${q.options[q.answer]}` });
        // أرسل السؤال بدون footer أولاً ثم عدّل بعد 10 ثواني
        await slash.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("🧠 سؤال ثقافي")
              .setDescription(`**${q.question}**\n\n${optionsText}`)
              .setFooter({ text: "فكّر وردّ! الإجابة تظهر بعد 10 ثواني ⏳" }),
          ],
        });
        setTimeout(async () => {
          await slash.editReply({ embeds: [embed] }).catch(() => null);
        }, 10_000);
        return;
      }

      // نكتة
      if (sub === "joke") {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)]!;
        const embed = new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle("😂 نكتة من Ghim🌧")
          .setDescription(joke);
        await slash.reply({ embeds: [embed] });
        return;
      }
    }

    // /nickname
    if (slash.commandName === "nickname") {
      const sub = slash.options.getSubcommand();

      if (sub === "add") {
        const name = slash.options.getString("name", true).toLowerCase().trim();
        if (name.length < 2) {
          await slash.reply({ content: "اللقب لازم يكون حرفين على الأقل.", ephemeral: true });
          return;
        }
        if (botTriggers.has(name)) {
          await slash.reply({ content: `"**${name}**" موجود أصلاً في قائمة الألقاب! 🌧`, ephemeral: true });
          return;
        }
        botTriggers.add(name);
        await slash.reply({
          content: `✅ تم إضافة "**${name}**" — الحين إذا أحد كتبها في الشات أرد تلقائياً 🌧`,
          ephemeral: true,
        });
        return;
      }

      if (sub === "list") {
        const list = [...botTriggers].map((t) => `• \`${t}\``).join("\n");
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("💬 ألقابي وأسمائي")
          .setDescription(list || "ما في ألقاب مضافة بعد.")
          .setFooter({ text: "كلمني بأي اسم من هذي وأرد عليك 🌧" });
        await slash.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "remove") {
        const name = slash.options.getString("name", true).toLowerCase().trim();
        if (!botTriggers.has(name)) {
          await slash.reply({ content: `"**${name}**" مو موجود في قائمة الألقاب.`, ephemeral: true });
          return;
        }
        botTriggers.delete(name);
        await slash.reply({ content: `🗑️ تم حذف "**${name}**" من الألقاب 🌧`, ephemeral: true });
        return;
      }
    }
  });

  client.login(token).catch((err) => logger.error({ err }, "Failed to login Discord bot"));
  return client;
}
