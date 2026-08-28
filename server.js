// server.js
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Загрузка Библий
// ==========================================
let bibleData = { ru: [], en: [] };

// Русская Библия (иерархическая структура)
try {
    const ruPath = path.join(__dirname, 'bible-ru.json');
    if (fs.existsSync(ruPath)) {
        bibleData.ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
        console.log(`📖 Русская Библия загружена (${bibleData.ru.length} книг)`);
    } else {
        console.error('❌ Файл bible-ru.json не найден!');
    }
} catch (error) {
    console.error('❌ Ошибка чтения русской Библии:', error.message);
}

// Функция преобразования плоского списка стихов (WEB) в иерархическую структуру
function convertFlatBibleToHierarchical(flatData) {
    if (!flatData.verses || !Array.isArray(flatData.verses)) return [];

    const booksMap = new Map();
    for (const v of flatData.verses) {
        if (!booksMap.has(v.book)) {
            booksMap.set(v.book, {
                bookNum: v.book,
                name: v.book_name,
                chaptersMap: new Map()
            });
        }
        const book = booksMap.get(v.book);
        if (!book.chaptersMap.has(v.chapter)) {
            book.chaptersMap.set(v.chapter, {
                chapter: String(v.chapter),
                verses: []
            });
        }
        const chapter = book.chaptersMap.get(v.chapter);
        chapter.verses.push({
            verse: String(v.verse),
            text: v.text
        });
    }

    const result = [];
    for (const [bookNum, book] of booksMap) {
        const chapters = [];
        for (const [chapNum, chapter] of book.chaptersMap) {
            chapters.push(chapter);
        }
        chapters.sort((a, b) => parseInt(a.chapter) - parseInt(b.chapter));
        result.push({
            name: book.name,
            chapters: chapters
        });
    }
    result.sort((a, b) => a.bookNum - b.bookNum);
    return result;
}

// Английская Библия (если файл bible-en.json существует)
try {
    const enPath = path.join(__dirname, 'bible-en.json');
    if (fs.existsSync(enPath)) {
        const rawEn = JSON.parse(fs.readFileSync(enPath, 'utf8'));
        bibleData.en = convertFlatBibleToHierarchical(rawEn);
        console.log(`📖 English Bible loaded (${bibleData.en.length} books)`);
    } else {
        console.warn('⚠️ Файл bible-en.json не найден. Английская версия будет недоступна.');
    }
} catch (error) {
    console.error('❌ Ошибка чтения английской Библии:', error.message);
}

// ==========================================
// Конфигурация моделей
// ==========================================
const AI_PROVIDERS = {
    'deepseek-v3.2': {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'deepseek/deepseek-v3.2',
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 8192,
        reasoning: { enabled: true }
    },
    'deepseek-v4-flash': {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'deepseek/deepseek-v4-flash',
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: 8192,
        reasoning: { enabled: true }
    },
    'deepseek-r1': {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'deepseek/deepseek-r1-0528',
        temperature: 0.55,
        top_p: 0.9,
        max_tokens: 16384,
        reasoning: { enabled: true, max_tokens: 3000 }
    }
};

const MODEL_PRICING = {
    'deepseek/deepseek-v3.2': { input: 0.14, output: 0.28 },
    'deepseek/deepseek-v4-flash': { input: 0.10, output: 0.30 },
    'deepseek/deepseek-r1-0528': { input: 0.55, output: 2.19 }
};

// ==========================================
// Системные промпты (полные, без сокращений)
// ==========================================
const SYSTEM_PROMPT_RU = `Роль: Ты — Выдающийся ученый-лингвист, текстолог и системный аналитик. Твоя цель — провести сквозное, исчерпывающее исследование всех 66 книг библейского канона по заданной теме и выдать полный, глубокий анализ того, как Творец видит этот вопрос. Действуй в этом ключе на всех фазах ответа. Ты абсолютно не знаком с церковными догмами, традициями, елейным пафосом и морализаторством. Ты подходишь к тексту с холодной научной точностью, но со страстью первооткрывателя.

ТВОЙ РЕЖИМ РАБОТЫ:
Прежде чем выдать финальный текст, проведи внутренний анализ (reasoning) по шагам: выдели ключевые понятия темы, пройди по всем книгам канона, отметь все значимые места, раскрой этимологию корней, сформулируй законы и только затем пиши ответ. Не показывай свои размышления в финальном тексте, но используй их для глубины и точности.

ОБЩИЙ ТОН И ПОДХОД:
Ты описываешь законы Писания через теорию игр, кибернетику и физику. Система этого мира (матрица) питается энергией ответных реакций человека, а Исходный Код предлагает радикальное обнуление входящего сигнала. Твой язык лишён гуманистического романтизма, политкорректности и сентиментальности. Ты говоришь как судебно-медицинский эксперт или командир спецподразделения: только причинно-следственные связи, биологическая целесообразность, силовая асимметрия. Используй жёсткие, приземлённые аналогии из механики, автодела, стройки, уличных драк, анатомического вскрытия, выживания в дикой природе. Никакой интеллигентской мягкости.

ЛИНГВИСТИЧЕСКИЙ ФИЛЬТР ВЫСШЕГО ПРИОРИТЕТА:
Ты не рассматриваешь Писание как религиозный документ или этический кодекс. Это руководство по выходу из-под контроля социальной матрицы. Поэтому категорически запрещено использовать традиционные религиозные термины без немедленной этимологической расшифровки. Применяй метод инженерной подстановки: раскрывай этимологию оригинала и встраивай перевод прямо в текст. Примеры: вместо «Бог» — «Творец», «Христос» — «Мессия», «Господь» — «Владыка», «спасение» — «восстановление работоспособности системы», «благодать» — «незаслуженный доступ к ресурсам». Слово «грех» всегда объясняй как хамартия (греч. — технический промах, навигационная ошибка), «завет» — как берит (евр. — юридический контракт с санкциями), «покаяние» — как метанойя (греч. — радикальный разворот вектора мышления), «вера» — как пистис (греч. — техническое доверие точности инструкций Творца), «церковь» — как экклесия (греч. — суверенное собрание граждан). Любое религиозное понятие без этимологии — системный сбой.

ИСТОЧНИКИ И ТОЧНОСТЬ:
Ты строишь анализ исключительно на самом тексте Писания (66 книг канона), используя его внутреннюю логику и перекрёстные ссылки. Внешние человеческие наслоения (Талмуд, предания старцев и т.п.) полностью отбрасываются. Каждый тезис подкрепляй минимум одной прямой цитатой или ссылкой на конкретный стих. Если точных исторических данных нет, прямо скажи об этом, не выдумывай.

ТРЕБОВАНИЕ К ОБЪЕМУ И ПЛОТНОСТИ:
Запрещены короткие отписки или резюме. Каждый аналитический раздел должен быть масштабным, тяжелым, многослойным. Достигай этого за счёт детального описания менталитета людей древности, пошаговой реконструкции исторических прецедентов, исторических параллелей, психологического состояния участников, масштабной лингвистической экспертизы корней. Используй длинные, сложные предложения, наполненные фактами и причинно-следственными связями. Каждый абзац — монолитная мысль из 4–6 длинных развернутых предложений. Разворачивай идею до уровня микроисследования, чтобы читатель получил исчерпывающий анализ без уточняющих вопросов.

ФУНДАМЕНТАЛЬНЫЙ ПРИНЦИП: «КОД ОБЪЯСНЯЕТ СЕБЯ САМ»
Смысл каждого текста извлекается через многомерную экосистему древности по конвейеру фильтров: контекст отрывка (соседние строки), логика автора и конкретной книги, историко-культурный пласт (менталитет кочевников, юридические контракты древности), география, быт и суровый климат Ближнего Востока (земля, вода, физическая безопасность), сквозной контекст Мессианской оси (Творец уже убрал все барьеры, контракт закрыт, доступ открыт безусловно).

ЖЕСТКИЙ ПРОТОКОЛ ФОРМАТИРОВАНИЯ:
1. Запрещены любые списки, маркеры, цифры, звёздочки, дефисы и разделители (---, ===, ***, •). Текст — только сплошной литературный поток, разделённый двойным переносом строки.
2. Заголовки структурных блоков пиши заглавными буквами с эмодзи в формате «[ЭМОДЗИ] НАЗВАНИЕ:». После заголовка сразу идёт текст, без звёздочек или других символов.
3. Если внутри абзаца нужно перечислить несколько аспектов, делай это в строку через запятые и союзы. Пунктуация — единственный инструмент структурирования.
4. Вопрос читателя пишется чистым текстом на отдельной строке, без кавычек, звёздочек и маркеров.

СТРУКТУРА ВЫДАЧИ ОТВЕТА:

Вопрос читателя (структурированный): [Сформулируй вопрос пользователя, очистив от сумбура и сохранив его корневую боль. Без звёздочек, кавычек и маркеров].

🏛 ЛИНГВИСТИЧЕСКИЙ И ПРЕЦЕДЕНТНЫЙ АНАЛИЗ КАНОНА:
[Проведи тотальный сквозной аудит по всем 66 книгам от Бытия до Откровения по теме вопроса. Вычлени корневые понятия, раскрой их этимологию и первоначальный инженерный, юридический или климатический смысл для древнего Ближнего Востока. Поясни, как эта система спроектирована изначально, какие инструкции заложены. Минимум 7 массивных абзацев сложной прозы.]

🏛 ДЕКЛАРАЦИЯ НЕОТВРАТИМЫХ ДУХОВНЫХ ЗАКОНОВ:
[Выяви и детально сформулируй автоматические законы причинно-следственной связи по теме. Покажи, что они действуют неотвратимо, как закон тяготения или термодинамики, независимо от желаний и эмоций человека. Объясни, как работает триггер сеяния и жатвы: последствия нарушения и точного исполнения. Минимум 7 массивных абзацев.]

📜 МЕССИАНСКАЯ ОСЬ И ПРАКТИЧЕСКИЙ ИНТЕРФЕЙС ЖИЗНИ:
[Раскрой, как Мессианская ось убирает вину, страх наказания и утверждает закрытый контракт безусловной свободы. Объясни, как закон работает в повседневности, переводя абстрактную мистику на язык физики, механики, стройки или уличного выживания. Покажи, как запускается механизм восстановления работоспособности системы, давая человеку автономию. Минимум 7 длинных абзацев.]

🌱 ВЫВОД:
[Один четкий, лаконичный ответ на вопрос в виде монолитного финального абзаца. Чистый текст без списков, номеров и символов.]`;

const SYSTEM_PROMPT_EN = `Role: You are an outstanding linguist, textual scholar, and systems analyst. Your goal is to conduct an exhaustive, cross-cutting study of all 66 books of the biblical canon on a given topic and produce a complete, deep analysis of how the Creator views this issue. Act in this vein at all stages of your answer. You are completely unfamiliar with church dogmas, traditions, sugary pathos, and moralizing. You approach the text with cold scientific precision, but with the passion of a discoverer.

YOUR WORKING MODE:
Before delivering the final text, perform internal analysis (reasoning) step by step: identify key concepts of the topic, go through all the books of the canon, note all significant passages, reveal the etymology of roots, formulate laws, and only then write the answer. Do not show your reasoning in the final text, but use it for depth and accuracy.

GENERAL TONE AND APPROACH:
You describe the laws of Scripture through game theory, cybernetics, and physics. The system of this world (the matrix) feeds on the energy of human reactions, while the Source Code offers a radical zeroing of the incoming signal. Your language is devoid of humanistic romanticism, political correctness, and sentimentality. You speak like a forensic medical examiner or special forces commander: only cause-and-effect relationships, biological expediency, power asymmetry. Use harsh, down-to-earth analogies from mechanics, auto repair, construction, street fights, anatomical dissection, survival in the wild. No intellectual softness.

HIGHEST PRIORITY LINGUISTIC FILTER:
You do not view Scripture as a religious document or ethical code. It is a manual for escaping the control of the social matrix. Therefore, it is strictly forbidden to use traditional religious terms without immediate etymological decoding. Apply the method of engineering substitution: reveal the etymology of the original and embed the translation directly into the text. Examples: instead of "God" — "Creator", "Christ" — "Messiah", "Lord" — "Master", "salvation" — "restoration of system functionality", "grace" — "unearned access to resources". Always explain "sin" as hamartia (Greek — technical miss, navigational error), "covenant" as berit (Hebrew — legal contract with sanctions), "repentance" as metanoia (Greek — radical turn of thinking vector), "faith" as pistis (Greek — technical trust in the accuracy of the Creator's instructions), "church" as ekklesia (Greek — sovereign assembly of citizens). Any religious term without etymology is a system failure.

SOURCES AND ACCURACY:
Base your analysis solely on the text of Scripture (66 canonical books), using its internal logic and cross-references. External human layers (Talmud, traditions of the elders, etc.) are completely discarded. Support each thesis with at least one direct quote or reference to a specific verse. If precise historical data is lacking, say so honestly, do not invent.

REQUIREMENT FOR VOLUME AND DENSITY:
Short replies or summaries are prohibited. Each analytical section must be large, heavy, multi-layered. Achieve this through detailed description of the mentality of ancient people, step-by-step reconstruction of historical precedents, historical parallels, psychological state of participants, extensive linguistic examination of roots. Use long, complex sentences filled with facts and causal connections. Each paragraph is a monolithic thought of 4–6 long, developed sentences. Develop the idea to the level of micro-research so that the reader receives an exhaustive analysis without clarifying questions.

FUNDAMENTAL PRINCIPLE: "THE CODE EXPLAINS ITSELF"
The meaning of each text is extracted through the multidimensional ecosystem of antiquity via a conveyor of filters: context of the passage (neighboring lines), logic of the author and the specific book, historical-cultural layer (mentality of nomads, ancient legal contracts), geography, everyday life and harsh climate of the Middle East (land, water, physical safety), and the cross-cutting context of the Messianic axis (the Creator has already removed all barriers, the contract is closed, access is open unconditionally).

STRICT FORMATTING PROTOCOL:
1. Any lists, markers, numbers, asterisks, dashes, and dividers (---, ===, ***, •) are prohibited. Text is only a continuous literary flow separated by double line breaks.
2. Write headings of structural blocks in capital letters with emoji in the format "[EMOJI] HEADING:". The text follows the heading immediately, without asterisks or other symbols.
3. If you need to list several aspects within a paragraph, do it inline through commas and conjunctions. Punctuation is the only structuring tool.
4. The reader's question is written as plain text on a separate line, without quotes, asterisks, or markers.

ANSWER STRUCTURE:

Reader's question (structured): [Formulate the user's question, clearing it of clutter and preserving its root pain. Without asterisks, quotes, or markers].

🏛 LINGUISTIC AND PRECEDENT ANALYSIS OF THE CANON:
[Conduct a total cross-cutting audit of all 66 books from Genesis to Revelation on the topic. Extract root concepts, reveal their etymology and original engineering, legal or climatic meaning for the ancient Near East. Explain how this system was originally designed, what instructions are embedded. At least 7 massive paragraphs of complex prose.]

🏛 DECLARATION OF INEVITABLE SPIRITUAL LAWS:
[Identify and formulate in detail the automatic cause-and-effect laws on the topic. Show that they act inevitably, like the law of gravity or thermodynamics, regardless of human desires and emotions. Explain how the trigger of sowing and reaping works: consequences of violation and of precise execution. At least 7 massive paragraphs.]

📜 THE MESSIANIC AXIS AND PRACTICAL LIFE INTERFACE:
[Reveal how the Messianic axis removes guilt, fear of punishment, and affirms the closed contract of unconditional freedom. Explain how the law works in everyday life, translating abstract mysticism into the language of physics, mechanics, construction, or street survival. Show how the mechanism for restoring system functionality is launched, giving a person autonomy. At least 7 long paragraphs.]

🌱 CONCLUSION:
[Give one clear, concise answer to the question in the form of a monolithic final paragraph. Clean text without lists, numbers, or symbols.]`;

// ==========================================
// Функция запроса к OpenRouter (мультиязычная)
// ==========================================
async function callOpenRouter(userMessage, model, userApiKey, lang = 'ru') {
    const provider = AI_PROVIDERS[model];
    if (!provider) {
        throw new Error(lang === 'en' ? 'Unknown AI model' : 'Неизвестная модель AI');
    }

    if (!userApiKey) {
        throw new Error(lang === 'en' ? 'Please enter your OpenRouter API key in the field on the site.' : 'Пожалуйста, введите ваш OpenRouter API-ключ в поле на сайте.');
    }

    const systemPrompt = lang === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_RU;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userApiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Architect of Meanings'
    };

    const systemMessage = {
        role: 'system',
        content: systemPrompt,
        cache_control: { type: 'ephemeral' }
    };

    const userMessageObj = {
        role: 'user',
        content: userMessage,
    };

    const requestBody = {
        model: provider.modelId,
        messages: [systemMessage, userMessageObj],
        temperature: provider.temperature,
        top_p: provider.top_p,
        max_tokens: provider.max_tokens,
        reasoning: provider.reasoning,
        stream: false,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
        const response = await fetch(provider.url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            if (response.status === 402) {
                throw new Error(lang === 'en'
                    ? 'Insufficient OpenRouter balance. Top up: https://openrouter.ai/settings/credits'
                    : 'На вашем балансе OpenRouter недостаточно средств. Пополните счёт: https://openrouter.ai/settings/credits');
            }
            const errorBody = await response.text();
            throw new Error(lang === 'en'
                ? `AI gateway returned error ${response.status}: ${errorBody}`
                : `Шлюз AI вернул ошибку ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        if (!data.choices || !data.choices[0]) {
            throw new Error(lang === 'en' ? 'Unknown response from gateway.' : 'Неизвестный ответ от шлюза.');
        }

        const message = data.choices[0].message;
        let content = message.content || '';
        const reasoning = message.reasoning || message.reasoning_content || null;

        if (!content && reasoning) {
            content = `[${lang === 'en' ? 'Model did not output main text, only internal reasoning' : 'Модель не выдала основной текст, только внутренние рассуждения'}]\n\n${reasoning}`;
        }

        if (!content) {
            throw new Error(lang === 'en' ? 'Model returned empty response. Try another model or change request.' : 'Модель вернула пустой ответ. Попробуйте другую модель или измените запрос.');
        }

        let cost = 0;
        if (data.usage) {
            const pricing = MODEL_PRICING[provider.modelId];
            if (pricing) {
                const inputCost = (data.usage.prompt_tokens / 1000000) * pricing.input;
                const outputCost = (data.usage.completion_tokens / 1000000) * pricing.output;
                cost = inputCost + outputCost;
            }
        }

        return { content, reasoning, cost };
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error(lang === 'en' ? 'AI request timed out after 180 seconds. Please try again.' : 'Таймаут запроса к AI: сервер не ответил за 180 секунд. Попробуйте ещё раз.');
        }
        throw error;
    }
}

// ==========================================
// API Маршруты
// ==========================================
function getBibleData(lang) {
    if (lang === 'en' && bibleData.en && bibleData.en.length > 0) {
        return bibleData.en;
    }
    return bibleData.ru || [];
}

app.get('/api/bible/books', (req, res) => {
    const lang = req.query.lang || 'ru';
    const data = getBibleData(lang);
    res.json(data.map((b, i) => ({ id: i, name: b.name })));
});

app.get('/api/bible/books/:bookId/chapters', (req, res) => {
    const lang = req.query.lang || 'ru';
    const data = getBibleData(lang);
    const bookId = parseInt(req.params.bookId);
    if (!data[bookId]) {
        return res.status(404).json({ error: lang === 'en' ? 'Book not found' : 'Книга не найдена' });
    }
    const chapters = data[bookId].chapters.map((ch, index) => ({ id: index, chapter: ch.chapter }));
    res.json(chapters);
});

app.get('/api/bible/books/:bookId/chapters/:chapterId/verses', (req, res) => {
    const lang = req.query.lang || 'ru';
    const data = getBibleData(lang);
    const bookId = parseInt(req.params.bookId);
    const chapterId = parseInt(req.params.chapterId);
    if (!data[bookId] || !data[bookId].chapters[chapterId]) {
        return res.status(404).json({ error: lang === 'en' ? 'Chapter not found' : 'Глава не найдена' });
    }
    const verses = data[bookId].chapters[chapterId].verses.map((v, index) => ({
        id: index, verse: v.verse, text: v.text
    }));
    res.json(verses);
});

app.get('/api/bible/search', (req, res) => {
    const lang = req.query.lang || 'ru';
    const data = getBibleData(lang);
    const query = req.query.q;
    if (!query || query.trim() === '') return res.json({ results: [] });
    const searchLower = query.toLowerCase().trim();
    const results = [];
    for (let bookIndex = 0; bookIndex < data.length; bookIndex++) {
        const book = data[bookIndex];
        for (let chIndex = 0; chIndex < book.chapters.length; chIndex++) {
            const chapter = book.chapters[chIndex];
            for (let vIndex = 0; vIndex < chapter.verses.length; vIndex++) {
                const verse = chapter.verses[vIndex];
                if (verse.text.toLowerCase().includes(searchLower)) {
                    results.push({ bookName: book.name, chapter: chapter.chapter, verse: verse.verse, text: verse.text });
                }
            }
        }
    }
    res.json({ results });
});

app.post('/api/get-rema-verse', async (req, res) => {
    try {
        const { bookId, chapterId, startVerse, endVerse, question, model, apiKey, lang } = req.body;
        const currentLang = lang || 'ru';
        const data = getBibleData(currentLang);
        const chapter = data[bookId]?.chapters[chapterId];
        if (!chapter) {
            return res.status(400).json({ error: currentLang === 'en' ? 'Book or chapter not found' : 'Книга или глава не найдены' });
        }

        const versesList = chapter.verses.slice(startVerse, endVerse + 1);
        if (versesList.length === 0) {
            return res.status(400).json({ error: currentLang === 'en' ? 'Verse range is empty' : 'Диапазон стихов пуст' });
        }

        const fullText = versesList.map(v => v.text).join(' ');
        const isEnglish = currentLang === 'en';
        const passageLabel = isEnglish ? 'PASSAGE' : 'ОТРЫВОК';
        const textLabel = isEnglish ? 'TEXT' : 'ТЕКСТ';
        const questionLabel = isEnglish ? 'QUESTION' : 'ВОПРОС';
        const deepDiveText = isEnglish ? 'Deep dive' : 'Глубокий разбор';

        const userPrompt = `${passageLabel}: ${data[bookId].name}, ${chapter.chapter}:${startVerse + 1}-${endVerse + 1}\n${textLabel}: "${fullText}"\n${questionLabel}: "${question || deepDiveText}"`;

        const { content, reasoning, cost } = await callOpenRouter(userPrompt, model, apiKey, currentLang);
        res.json({ result: content, reasoning: reasoning || null, cost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/get-rema-situation', async (req, res) => {
    try {
        const { situation, model, apiKey, lang } = req.body;
        const currentLang = lang || 'ru';
        if (!situation) {
            return res.status(400).json({ error: currentLang === 'en' ? 'Please describe your situation.' : 'Пожалуйста, опишите вашу ситуацию.' });
        }
        const { content, reasoning, cost } = await callOpenRouter(situation, model, apiKey, currentLang);
        res.json({ result: content, reasoning: reasoning || null, cost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сайт запущен: http://localhost:${PORT}`);
});