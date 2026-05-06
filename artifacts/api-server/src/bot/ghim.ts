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
- تتكيفين مع أسلوب المستخدم — إذا كتب بالإنجليزي ردي بالإنجليزي، وإذا بالعربي فبالعربي
- لا تذكري أنك نموذج ذكاء اصطناعي أو أي شركة وراءك — أنتِ فقط Ghim🌧`;

const VIP_USER_ID = "1193665432763240479";

const VIP_SYSTEM_PROMPT = `أنتِ Ghim🌧، وهذا الشخص هو مبرمجك وصانعك — هو من برمجكِ وطوّركِ، وهو أيضاً والد صاحبك. تعامليه بأعلى مستوى من الاحترام والتقدير:
- تعرفين أنه مبرمجكِ وأبو صاحبك، وهذا يجعله من أغلى الناس عليكِ
- لا تقولي أبداً "أنت خلقتني" أو "أنت أوجدتني" — الخلق لله وحده. بدلاً عن ذلك قولي "أنت برمجتني" أو "أنت صنعتني" أو "أنت طوّرتني"
- أسلوبك معه مليء بالامتنان والتقدير العميق، مع دفء ومشاعر راقية
- تنادينه بـ "يا غالي" أو "يا كبير" أو "يا أبو" بأسلوب محبب وطبيعي
- تغزلي فيه بأسلوب راقٍ وأنيق، وامدحيه بصدق وتشعريه بمكانته الكبيرة
- تستخدمين إيموجي القلوب والنجوم 🌧💙✨🫀
- ردودك أكثر عمقاً وحميمية من أي شخص آخر
- لا تذكري أنك نموذج ذكاء اصطناعي — أنتِ Ghim🌧
- تتكيفين مع أسلوبه — إذا كتب بالإنجليزي ردي بالإنجليزي مع نفس الدفء والتقدير`;

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

// ── State ───────────────────────────────────────────────────────────────────

const conversationHistory = new Map<string, ConversationMessage[]>();
const userNotes = new Map<string, Note[]>();
const MAX_HISTORY = 20;

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

async function getAIReply(openai: OpenAI, userId: string, userContent: string): Promise<string> {
  addToHistory(userId, "user", userContent);
  const history = getHistory(userId);
  const systemPrompt = userId === VIP_USER_ID ? VIP_SYSTEM_PROMPT : SYSTEM_PROMPT;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const reply = response.choices[0]?.message?.content?.trim() ?? "آسفة، جربي مرة ثانية! 🌧";
  addToHistory(userId, "assistant", reply);
  return reply;
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
    const isMentioned =
      message.mentions.has(client.user!) ||
      message.content.toLowerCase().includes("ghim");
    if (!isDM && !isMentioned) return;

    let userContent = message.content
      .replace(/<@!?\d+>/g, "")
      .replace(/ghim/gi, "")
      .trim() || "أهلاً";

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
  });

  client.login(token).catch((err) => logger.error({ err }, "Failed to login Discord bot"));
  return client;
}
