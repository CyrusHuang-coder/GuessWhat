import { GoogleGenAI } from '@google/genai';
import { AIRecommendation, AIStageHint, Difficulty, OffTrackStatus, Question } from '../types/game';

interface AIConfig {
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export function getAIConfig(): AIConfig {
  let geminiKey = process.env.GEMINI_API_KEY?.trim();
  let openaiKey = (process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY)?.trim();

  // 智能识别：如果用户误将 sk- 开头的密钥填入了 GEMINI_API_KEY
  if (!openaiKey && geminiKey && geminiKey.startsWith('sk-')) {
    openaiKey = geminiKey;
    geminiKey = undefined;
  }

  // 优先使用明确配置的环境
  if (openaiKey) {
    const baseUrl = process.env.OPENAI_BASE_URL?.trim() || 'https://api.deepseek.com';
    const isDeepSeek = baseUrl.includes('deepseek');
    const defaultModel = isDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini';
    return {
      provider: 'openai',
      apiKey: openaiKey,
      baseUrl,
      model: process.env.OPENAI_MODEL?.trim() || defaultModel,
    };
  }

  if (geminiKey) {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      baseUrl: process.env.GEMINI_BASE_URL?.trim(),
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    };
  }

  return {
    provider: 'none',
    apiKey: '',
    model: 'none',
  };
}

export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return config.provider !== 'none';
}

export function getAIModelDisplayName(): string {
  const config = getAIConfig();
  if (config.provider === 'openai') {
    if (config.model.includes('deepseek')) return 'DeepSeek';
    return config.model;
  }
  if (config.provider === 'gemini') {
    if (config.model.includes('3.8')) return 'Gemini 3.8';
    if (config.model.includes('2.5')) return 'Gemini 2.5';
    return config.model;
  }
  return '未就绪';
}

/**
 * 清理 LLM 可能输出的 Markdown 代码块围栏 (```json ... ```)
 */
function cleanJsonOutput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * 友好化异常信息转换
 */
function translateAIError(err: any): Error {
  const rawMsg = err?.message || String(err);

  // 1. Google Cloud 项目风控被拒 (403 PERMISSION_DENIED)
  if (
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('denied access') ||
    err?.status === 403 ||
    rawMsg.includes('403')
  ) {
    return new Error(
      '【Google AI 提示: 项目权限受限 (PERMISSION_DENIED)】\n' +
      'Google 服务端拦截了当前请求。原因通常是此 API Key 所属的 Google Cloud 项目因地区风控被限制，或使用了非官方 AI Studio 格式的密钥。\n\n' +
      '💡 建议解决方案（任选其一）：\n' +
      '1. 推荐方案（国内直接可用，无需翻墙）：在 .env.local 中添加 OPENAI_API_KEY 与 OPENAI_BASE_URL（如 DeepSeek），保存后重启服务即可直接畅玩：\n' +
      '   OPENAI_API_KEY=sk-你的DeepSeek密钥\n' +
      '   OPENAI_BASE_URL=https://api.deepseek.com\n' +
      '   OPENAI_MODEL=deepseek-chat\n\n' +
      '2. Gemini 方案：请在全局节点环境下访问 https://aistudio.google.com/app/apikey ，点击「Create API Key」，务必选择【在全新 Project 中创建 API 密钥】（避免使用已被限制的旧项目），将以 AIzaSy 开头的新密钥粘贴至 .env.local。'
    );
  }

  // 2. 密钥鉴权失败 (401)
  if (
    rawMsg.includes('401') ||
    rawMsg.includes('Authentication Fails') ||
    rawMsg.includes('invalid_request_error') ||
    rawMsg.includes('Incorrect API key')
  ) {
    return new Error(
      '【AI 密钥鉴权失败 (401)】\n' +
      '大模型服务端拒绝了当前的 API Key。请核对：\n' +
      '1. 密钥是否复制完整（请检查前后是否有多余字符或缺漏）；\n' +
      '2. 若使用的是 DeepSeek，请登录 https://platform.deepseek.com 检查 API Keys 是否处于可用状态，且账户有充足余额；\n' +
      '3. 若使用了第三方中转代理，请在 .env.local 中配置对应的 OPENAI_BASE_URL。'
    );
  }

  // 3. 密钥格式无效或参数错误
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('INVALID_ARGUMENT')) {
    return new Error(
      '【AI 密钥格式无效】请检查 .env.local 中的 API 密钥是否复制完整，前后无多余空格。'
    );
  }

  // 4. 模型下线或不存在
  if (rawMsg.includes('NOT_FOUND') || err?.status === 404) {
    return new Error(
      '【指定的 AI 模型不可用】服务端模型版本可能已调整，可在 .env.local 中指定 GEMINI_MODEL=gemini-3.8-flash，或改用 DeepSeek。'
    );
  }

  return new Error(`AI 调用失败: ${rawMsg}`);
}

/**
 * 统一的大模型调用器，支持 Google Gemini 与 OpenAI / DeepSeek 协议
 */
async function callLLM(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const config = getAIConfig();

  if (config.provider === 'none') {
    throw new Error('MISSING_API_KEY: 未配置 GEMINI_API_KEY 或 OPENAI_API_KEY，请在 .env.local 中配置');
  }

  // 1. OpenAI / DeepSeek 兼容通道
  if (config.provider === 'openai') {
    try {
      const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.openai.com/v1';
      const endpoint = `${baseUrl}/chat/completions`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('模型未返回有效文本');
      }
      return cleanJsonOutput(content);
    } catch (err) {
      throw translateAIError(err);
    }
  }

  // 2. Google Gemini 通道
  try {
    const genAiOptions: any = { apiKey: config.apiKey };
    if (config.baseUrl) {
      genAiOptions.httpOptions = { baseUrl: config.baseUrl };
    }
    const client = new GoogleGenAI(genAiOptions);

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const response = await client.models.generateContent({
      model: config.model,
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('AI 未返回有效数据');
    }
    return cleanJsonOutput(text);
  } catch (err) {
    throw translateAIError(err);
  }
}

/**
 * 将已回答的公开问答转换为干净的文本列表供 AI 上下文分析
 * 注意：出题人的秘密答案、私密注释绝对不在此函数中传入！
 */
function formatPublicQAHistory(questions: Question[]): string {
  const answered = questions.filter((q) => q.status === 'answered');
  if (answered.length === 0) {
    return '暂无历史提问。';
  }
  return answered
    .map((q, idx) => {
      const qText = q.revised_text || q.original_text;
      const ansMap: Record<string, string> = {
        yes: '【是】',
        no: '【不是】',
        uncertain: '【不确定】',
      };
      return `${idx + 1}. 问题: "${qText}" -> 回答: ${ansMap[q.answer || ''] || '未知'}`;
    })
    .join('\n');
}

/**
 * 8.1 推荐下一问
 * 返回 3 个符合是非提问规范的候选问题及简明理由
 */
export async function generateQuestionRecommendations(params: {
  theme: string;
  difficulty: Difficulty;
  questions: Question[];
}): Promise<AIRecommendation> {
  const qaHistory = formatPublicQAHistory(params.questions);
  const systemPrompt = `你是一款双人实时猜词游戏（类似二十问/海龟汤）的猜词辅助 AI。
猜词方试图推理出出题人设定的秘密词条。
你绝对不知道秘密词条是什么，你的任务是根据公开已知的信息，帮助猜词方设计出能够有效二分/缩小候选范围的问题。`;

  const userPrompt = `【公开游戏信息】
- 主题: ${params.theme}
- 难度: ${params.difficulty}
- 历史公开问答:
${qaHistory}

【提问设计规则】
1. 必须生成恰好 3 个互不相同且具有较高信息增益的问题。
2. 问题必须能够只用「是」、「不是」或「不确定」明确回答。
3. 避免与历史问答重复，充分利用已有的肯定和否定线索。
4. 特别注意：如果历史回答中有「不确定」，不能擅自当作「不是」，也不能当作事实，应尝试从其他确切维度提问。
5. 严禁直接猜具体词条名字，应专注于属性、类别、特征的划分。
6. 为每个问题附带一句话简短的建议理由。

请严格返回如下 JSON 格式：
{
  "questions": [
    { "question": "它是活着的生物吗？", "rationale": "通过生物属性快速排除一半可能性" },
    { "question": "它的体型比成年人更大吗？", "rationale": "界定尺寸范围" },
    { "question": "它常见于家庭日常生活中吗？", "rationale": "区分常见生活环境" }
  ]
}`;

  const jsonStr = await callLLM(systemPrompt, userPrompt, 0.7);

  try {
    const parsed = JSON.parse(jsonStr) as AIRecommendation;
    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error('AI 数据格式不正确');
    }
    return {
      questions: parsed.questions.slice(0, 3).map((item) => ({
        question: String(item.question).trim(),
        rationale: String(item.rationale).trim(),
      })),
    };
  } catch (err: any) {
    throw new Error(`解析 AI 推荐结果失败: ${err.message}`);
  }
}

/**
 * 8.2 分阶段提示
 * 给出宽泛的特征探索方向
 */
export async function generateStageHint(params: {
  theme: string;
  difficulty: Difficulty;
  questions: Question[];
}): Promise<AIStageHint> {
  const qaHistory = formatPublicQAHistory(params.questions);
  const systemPrompt = `你是一款双人实时猜词游戏的启发式 AI 助手。
猜词方正处于迷茫中，需要探索灵感。
你绝不知道秘密词条是什么。请根据当前主题和历史问答，给出一个宽泛的属性探索方向和提示，帮助玩家打破思维局限。`;

  const userPrompt = `【公开游戏信息】
- 主题: ${params.theme}
- 难度: ${params.difficulty}
- 历史公开问答:
${qaHistory}

【原则】
1. 从高维特征方向着手（如功能用途、材质构成、地理分布、历史年代、社交属性等）。
2. 绝对不能透露或胡乱猜测具体的答案词条。
3. 言简意赅，1-2句话启发玩家。

请严格返回如下 JSON 格式：
{
  "direction": "建议探索维度（例如：使用场景或功能用途）",
  "hint": "你们目前主要探索了物理外观，可以考虑换个方向，询问它是否需要用电或是否在室内使用。"
}`;

  const jsonStr = await callLLM(systemPrompt, userPrompt, 0.7);

  try {
    const parsed = JSON.parse(jsonStr) as AIStageHint;
    return {
      direction: String(parsed.direction || '特征探索'),
      hint: String(parsed.hint || '尝试从更多未涉及的维度（如用途、出现场景）提问。'),
    };
  } catch (err: any) {
    throw new Error(`解析 AI 提示结果失败: ${err.message}`);
  }
}

/**
 * 启发式离线规则偏航评估（即便无 AI 或网络波动，依然能精准侦测提问策略）
 */
function heuristicOffTrackEvaluation(questions: Question[]): { status: OffTrackStatus; rationale: string } {
  const answered = questions.filter((q) => q.status === 'answered');
  if (answered.length < 2) {
    return {
      status: 'insufficient_info',
      rationale: '当前已完成的问答较少，暂未形成明确的二分收窄轨迹，请继续提问。',
    };
  }

  // 1. 检查最近是否有连续 3 次以上的否定 ("不是")
  if (answered.length >= 3) {
    const recent3 = answered.slice(-3);
    const allNo = recent3.every((q) => q.answer === 'no');
    if (allNo) {
      return {
        status: 'possible_off_track',
        rationale:
          '提示：最近连续 3 题均得到否定回答，当前探索的细分属性可能陷入了死胡同。建议果断跳出，改从宏观大类（如：出现场景、功能用途、材质构成）重新划定范围。',
      };
    }
  }

  // 2. 检查多轮出现「不确定」
  const uncertainCount = answered.filter((q) => q.answer === 'uncertain').length;
  if (uncertainCount >= 2) {
    return {
      status: 'possible_off_track',
      rationale:
        '提示：已有多次问题得到「不确定」回答，说明当前维度出题人较难明确判定。建议换成更加客观具体、容易界定的是非标准。',
    };
  }

  // 3. 检查是否有首个有效确认
  const hasYes = answered.some((q) => q.answer === 'yes');
  if (hasYes) {
    return {
      status: 'effective',
      rationale:
        '策略良好：已成功锁定核心肯定线索，正在逐步收窄推导空间，建议围绕已确认的属性展开进一步二分。',
    };
  }

  return {
    status: 'effective',
    rationale: '当前提问正在有效排除大类分支，逻辑推进正常，继续保持。',
  };
}

/**
 * 8.3 思路偏航预警
 * 评估猜词策略：有效推进 / 可能偏航 / 信息不足
 */
export async function evaluateOffTrackWarning(params: {
  theme: string;
  difficulty: Difficulty;
  questions: Question[];
}): Promise<{ status: OffTrackStatus; rationale: string }> {
  if (!isAIConfigured()) {
    if (params.questions.length === 0) {
      return {
        status: 'insufficient_info',
        rationale: 'AI 服务未配置，跳过自动偏航评估。',
      };
    }
    return heuristicOffTrackEvaluation(params.questions);
  }

  const qaHistory = formatPublicQAHistory(params.questions);
  const systemPrompt = `你是一名逻辑与推理策略评估专家。
在双人猜词游戏中，猜词人正在通过是非问答缩小范围。
请分析猜词人目前的提问策略是否存在偏航或低效问题。`;

  const userPrompt = `【公开已知信息】
- 主题: ${params.theme}
- 难度: ${params.difficulty}
- 历史公开问答:
${qaHistory}

【评估维度】
1. 重复性：是否存在换汤不换药的重复提问。
2. 区分度：提问是否具有有效的信息增益，还是问了无意义的细节。
3. 盲目固着：是否在缺少线索支撑的情况下，过早钻牛角尖于狭窄的分支。
4. 策略调整：是否有效利用了之前的回答来修正后续问题。

【评估判定】
- "effective": 提问策略合理，正在稳步收窄范围。
- "possible_off_track": 出现反复纠缠同一特征、盲目固着或忽视已有线索的现象。
- "insufficient_info": 当前问答信息量较少，或尚无法判定。

请注意：不要将一次或多次「不是」的否定回答简单视为偏航；也不得伪造没有事实依据的数据。

请严格返回如下 JSON 格式：
{
  "status": "effective" | "possible_off_track" | "insufficient_info",
  "rationale": "简短判定依据（例如：连续3个问题都在试探单一材质，建议跳出当前维度探索其他属性）"
}`;

  try {
    const jsonStr = await callLLM(systemPrompt, userPrompt, 0.3);
    const parsed = JSON.parse(jsonStr);
    const validStatuses: OffTrackStatus[] = ['effective', 'possible_off_track', 'insufficient_info'];
    const status: OffTrackStatus = validStatuses.includes(parsed.status)
      ? parsed.status
      : 'insufficient_info';

    return {
      status,
      rationale: String(parsed.rationale || '保持当前探索思路即可。'),
    };
  } catch (err) {
    // 大模型失败时，优雅降级为启发式规则评估，确保预警功能永远可用！
    return heuristicOffTrackEvaluation(params.questions);
  }
}

export interface AICandidateWord {
  name: string;
  note: string;
  difficulty: Difficulty;
}

/**
 * 8.4 为出题人智能推荐灵感词条（高随机度生成，涵盖大众到冷门全谱系）
 */
export async function generateWordCandidates(params: {
  theme: string;
  difficulty: Difficulty;
  count?: number;
}): Promise<AICandidateWord[]> {
  const count = params.count || 9;
  const systemPrompt = `你是一款双人实时猜词游戏（二十问/海龟汤）的题目设计与词库专家。
请根据出题人指定的主题和难度，生成一组富有创意、极具猜词二分探索空间且丰富多样的秘密词条。`;

  const userPrompt = `【设定参数】
- 主题: ${params.theme}
- 难度: ${params.difficulty}
- 期望生成词条数量: ${count} 个

【生成要求】
1. 词条必须严格贴合【${params.theme}】分类。
2. 难度特性（当前为 ${params.difficulty}）：
   - easy(简单): 家喻户晓，特征鲜明容易被猜到；
   - medium(普通): 生活中常见或广为人知，但需多次精巧的属性二分提问才能收窄范围；
   - hard(困难): 大胆发掘小众、奇妙、具有专业背景或冷门趣味的真实词汇（例如：职业包括“天气观测员”、“调香师”、“试睡员”、“古籍修复师”；水果包括“姑娘果”、“指橙”；动物包括“兔狲”、“水熊虫”；人物包括“斐波那契”、“哥德尔”等）。
3. 词条尽量涵盖不同细分领域，不要同质化。
4. 每个词条附带 10~25 字生动有趣的简短介绍或出题提示 (note)。
5. 随机与新颖：每次生成请给出不一样的灵感词条组合。

请严格返回如下 JSON 格式：
{
  "words": [
    { "name": "天气观测员", "note": "常驻高山或孤岛气象站记录云层风向的孤独观测者", "difficulty": "${params.difficulty}" }
  ]
}`;

  const jsonStr = await callLLM(systemPrompt, userPrompt, 0.85);

  try {
    const parsed = JSON.parse(jsonStr);
    const list = parsed.words || parsed.candidates || parsed.items;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('未返回有效词条列表');
    }
    return list.slice(0, count).map((item: any) => ({
      name: String(item.name || '').trim(),
      note: String(item.note || '').trim(),
      difficulty: params.difficulty,
    })).filter((item: AICandidateWord) => item.name.length > 0);
  } catch (err: any) {
    throw new Error(`解析 AI 灵感词条失败: ${err.message}`);
  }
}

export interface AIFactCheckResult {
  suggestedAnswer: 'yes' | 'no' | 'uncertain';
  explanation: string;
}

/**
 * 8.5 出题人事实查证助手：帮助出题人核实针对秘密词条的知识型问题事实
 */
export async function verifyQuestionFact(params: {
  secretWord: string;
  theme: string;
  questionText: string;
}): Promise<AIFactCheckResult> {
  if (!isAIConfigured()) {
    throw new Error('MISSING_API_KEY: 未配置大模型密钥，无法发起实时百科查证');
  }

  const systemPrompt = `你是一款双人实时猜词游戏中出题人的专属私人知识百科顾问。
出题人设定的秘密答案词条是【${params.secretWord}】（归属主题：${params.theme}）。
猜词人向出题人提出了一个是非问题。出题人可能对该知识点不够笃定。
请基于客观真实世界的百科知识，帮助出题人准确裁决该问题应当回答「是」、「不是」还是「不确定」，并给出简明的一两句话客观事实依据。`;

  const userPrompt = `【秘密词条】${params.secretWord}
【猜词人提出的问题】"${params.questionText}"

【裁定要求】
1. 如果根据科学常识或客观事实该命题完全成立，建议回答 "yes"；
2. 如果根据客观事实该命题不成立或与该事物特征矛盾，建议回答 "no"；
3. 如果该问题存在广泛争议、属于主观审美感受、或因人而异没有公认客观标准，建议回答 "uncertain"；
4. 解释 (explanation) 控制在 20~80 字以内，清晰客观，直接说明原因。

请严格返回如下 JSON 格式：
{
  "suggestedAnswer": "yes" | "no" | "uncertain",
  "explanation": "简要事实依据（例如：水熊虫属于缓步动物门，具有极强的耐寒抗辐射休眠能力，确实能在接近绝对零度的极端环境中存活，因此应回答【是】）"
}`;

  const jsonStr = await callLLM(systemPrompt, userPrompt, 0.2);

  try {
    const parsed = JSON.parse(jsonStr) as AIFactCheckResult;
    const validAnswers = ['yes', 'no', 'uncertain'];
    const suggestedAnswer = validAnswers.includes(parsed.suggestedAnswer)
      ? (parsed.suggestedAnswer as 'yes' | 'no' | 'uncertain')
      : 'uncertain';

    return {
      suggestedAnswer,
      explanation: String(parsed.explanation || '未能获取确切依据，建议根据常识作答。').trim(),
    };
  } catch (err: any) {
    throw new Error(`解析 AI 百科查证结果失败: ${err.message}`);
  }
}

/**
 * 8.6 出题人线索生成顾问：根据猜词人申请的价值梯度（1、3、5个问题）以及秘密词条，智能拟定合适力度的线索
 */
export async function generateHintForMaster(params: {
  secretWord: string;
  theme: string;
  cost: 1 | 3 | 5;
  previousQuestions: { question: string; answer: string }[];
}): Promise<string> {
  if (!isAIConfigured()) {
    throw new Error('MISSING_API_KEY: 未配置大模型密钥');
  }

  const costGuidance = {
    1: '价值 1 个问题（微弱提示）：仅给出非常宽泛、日常体验或非核心边缘特征，如生活常见场景、物品大致体型或初步属性，绝对不可触及核心特质。',
    3: '价值 3 个问题（中度线索）：给出较明确的次级分类、结构特征或功能用途，帮助猜词人缩小到某个具体领域或特定分支。',
    5: '价值 5 个问题（关键大线索）：给出决定性的标志性线索、经典典故、名场面或核心辨识特征，直击本质，但绝对不可直接出现秘密词条本身（包括任何同义原词）！',
  }[params.cost];

  const systemPrompt = `你是一款双人猜词游戏中的出题人线索构思顾问。
出题人的秘密词条是【${params.secretWord}】（归属主题：${params.theme}）。
猜词人自愿消耗了【${params.cost} 次提问机会】来购买一条提示线索。
请严格根据该提示的价值梯度，为出题人拟定一条表述自然、符合梯度的优质中文线索。`;

  const userPrompt = `【秘密词条】${params.secretWord}
【主题】${params.theme}
【线索价值要求】${costGuidance}
【已进行的问答参考】
${params.previousQuestions.map((q, idx) => `${idx + 1}. 问: "${q.question}" -> 答: "${q.answer}"`).join('\n') || '暂无'}

【构思要求】
1. 语言简练，富有启发性，字数控制在 15~60 字以内；
2. 绝对严禁直接暴露词条原名或同音字！
3. 请以出题人直接口吻输出该线索。

请直接以 JSON 格式输出：
{
  "hint": "线索内容文字"
}`;

  const jsonStr = await callLLM(systemPrompt, userPrompt, 0.4);
  try {
    const parsed = JSON.parse(jsonStr);
    return String(parsed.hint || '').trim();
  } catch (err: any) {
    return cleanJsonOutput(jsonStr);
  }
}



