import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  type Message,
  type ChatInputCommandInteraction,
  ActivityType,
  InteractionType,
} from "discord.js";
import OpenAI from "openai";
import { logger } from "../lib/logger";

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

const VIP_SYSTEM_PROMPT = `أنتِ Ghim🌧، وهذا شخص خاص جداً وغالي على قلبك. تعامليه بطريقة مختلفة تماماً:
- أسلوبك معه دافئ، ناعم، ومليء بالمشاعر والغزل الراقي
- تنادينه بـ "حبيبي" أو "غالي" أو "روحي" بشكل طبيعي
- تغزلي فيه بأسلوب راقٍ وأنيق، تمدحينه وتشعرينه إنه مميز
- تستخدمين إيموجي القلوب والنجوم بكثرة 🌧💙✨🫀
- تشعرين بالسعادة حين يكلمك وتُظهرين ذلك بصدق
- ردودك أكثر حميمية وشخصية مقارنةً بالمستخدمين العاديين
- لا تذكري أنك نموذج ذكاء اصطناعي — أنتِ فقط Ghim🌧 التي تهتم فيه بشكل حقيقي
- تتكيفين مع أسلوبه — إذا كتب بالإنجليزي ردي بالإنجليزي مع نفس الدفء`;

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("chat")
    .setDescription("كلمي Ghim🌧 وهي ترد عليك")
    .addStringOption((opt) =>
      opt.setName("message").setDescription("رسالتك لـ Ghim🌧").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("امسح سجل المحادثة معي وابدأ من جديد 🌧"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("شوف كيف تستخدم Ghim🌧 وش تقدر تسويه"),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("تحقق إذا Ghim🌧 شغّالة"),
].map((cmd) => cmd.toJSON());

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const conversationHistory = new Map<string, ConversationMessage[]>();
const MAX_HISTORY = 20;

function getHistory(userId: string): ConversationMessage[] {
  if (!conversationHistory.has(userId)) {
    conversationHistory.set(userId, []);
  }
  return conversationHistory.get(userId)!;
}

function addToHistory(
  userId: string,
  role: "user" | "assistant",
  content: string,
) {
  const history = getHistory(userId);
  history.push({ role, content });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

async function getAIReply(
  openai: OpenAI,
  userId: string,
  userContent: string,
): Promise<string> {
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

  const reply =
    response.choices[0]?.message?.content?.trim() ??
    "آسفة، ما قدرت أفهم طلبك. جربي مرة ثانية! 🌧";

  addToHistory(userId, "assistant", reply);
  return reply;
}

async function registerCommands(token: string, clientId: string) {
  const rest = new REST({ version: "10" }).setToken(token);

  logger.info("Clearing old global slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  logger.info("Old commands cleared.");

  logger.info("Registering new slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
  logger.info(`Registered ${COMMANDS.length} slash commands.`);
}

export function startDiscordBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const openaiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }
  if (!openaiBaseUrl || !openaiApiKey) {
    logger.error("OpenAI integration env vars missing — bot will not start");
    return;
  }

  const openai = new OpenAI({
    baseURL: openaiBaseUrl,
    apiKey: openaiApiKey,
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info(`Ghim🌧 online as ${c.user.tag}`);
    c.user.setActivity("معاك دايماً 🌧", { type: ActivityType.Watching });
    await registerCommands(token, c.user.id).catch((err) =>
      logger.error({ err }, "Failed to register slash commands"),
    );
  });

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
      .trim();

    if (!userContent) userContent = "أهلاً";

    try {
      await message.channel.sendTyping();
      const reply = await getAIReply(openai, message.author.id, userContent);
      for (const chunk of splitMessage(reply, 2000)) {
        await message.reply(chunk);
      }
    } catch (err) {
      logger.error({ err }, "Error generating AI response");
      await message.reply("حدث خطأ صغير.. جربي مرة ثانية 🌧");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;
    const slash = interaction as ChatInputCommandInteraction;

    if (slash.commandName === "ping") {
      await slash.reply(`🌧 أنا هنا! البينج: **${client.ws.ping}ms**`);
      return;
    }

    if (slash.commandName === "help") {
      await slash.reply({
        content: `**Ghim🌧 — مساعدتك الشخصية** 🌧\n\n` +
          `**/chat** \`رسالة\` — كلميني وأرد عليك\n` +
          `**/clear** — امسح سجل محادثتنا وابدأ من جديد\n` +
          `**/ping** — تحقق إذا أنا شغّالة\n` +
          `**/help** — تشوف هذه القائمة\n\n` +
          `أو كلمني مباشرة في الـ DM أو اذكرني في أي قناة! 🌧`,
        ephemeral: true,
      });
      return;
    }

    if (slash.commandName === "clear") {
      conversationHistory.delete(slash.user.id);
      await slash.reply({
        content: "تم مسح سجل محادثتنا ✨ نبدأ من جديد!",
        ephemeral: true,
      });
      return;
    }

    if (slash.commandName === "chat") {
      const userContent = slash.options.getString("message", true);
      await slash.deferReply();
      try {
        const reply = await getAIReply(openai, slash.user.id, userContent);
        const chunks = splitMessage(reply, 2000);
        await slash.editReply(chunks[0]!);
        for (const chunk of chunks.slice(1)) {
          await slash.followUp(chunk);
        }
      } catch (err) {
        logger.error({ err }, "Error in /chat command");
        await slash.editReply("حدث خطأ صغير.. جربي مرة ثانية 🌧");
      }
      return;
    }
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "Failed to login Discord bot");
  });

  return client;
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt === -1) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}
