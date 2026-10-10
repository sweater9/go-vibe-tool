const C = 'concept';
export const pages = [
{
slug: 'what-is-ai', title: 'What is Artificial Intelligence?', kind: C, group: 'Foundations',
question: 'What is AI and how does it differ from machine learning?',
summary: 'AI is the broad field of building software that performs tasks we normally associate with human judgement. Machine learning and generative AI are subsets of it.',
short: 'AI is a broad label for software that does tasks needing perception, language or decision-making. Most modern AI is **machine learning**: systems that learn patterns from data instead of following hand-written rules.',
aliases: ['artificial intelligence', 'what is artificial intelligence', 'AI basics', 'AI explained', 'machine learning vs AI', 'AI for beginners', 'AI fundamentals'],
keywords: ['machine learning', 'deep learning', 'neural network', 'training', 'inference', 'model', 'narrow AI', 'rules'],
related: ['generative-ai', 'large-language-models', 'transformers', 'ai-evaluation'],
sections: [
['What is it?', `"Artificial intelligence" is an umbrella term, not a single technology. It covers any software built to perform tasks that normally need human-like judgement: recognising a face in a photo, translating a sentence, recommending a film, flagging a fraudulent payment, or holding a conversation.

The terms nest inside each other:

- **AI**: the whole field.
- **Machine learning (ML)**: the part of AI where a system *learns* its behaviour from examples rather than being programmed rule by rule.
- **Deep learning**: ML that uses large layered *neural networks*. It powers most of today's headline results in vision, speech and language.
- **Generative AI**: deep-learning models that produce new content — text, images, audio, code. See [[generative-ai]].

An important caveat: every system in everyday use today is "narrow". It is good at the task it was trained for and can fail in surprising ways outside it. "AI" does not imply understanding, intent or common sense.`],
['Why does it matter?', `AI has moved from research labs into ordinary software. Spam filters, search ranking, voice typing, photo apps, code editors and customer-support tools all use it. Knowing the basics helps you in three practical ways:

- You can judge what a tool is likely to do well (pattern recognition at scale) and badly (guaranteed facts, rare edge cases).
- You can ask better questions of vendors and colleagues: What data was it trained on? How is it evaluated? What happens when it is wrong?
- You can avoid both extremes — treating AI as magic, or dismissing it as a toy.`],
['How does it work?', `The classic way to write software is to hand the computer explicit rules: *if the email contains these words, mark it as spam*. That breaks down when rules are too numerous or too fuzzy to write down, such as "what does a cat look like?"

Machine learning flips the process:

1. **Collect examples** — for instance thousands of emails labelled spam / not spam.
2. **Train** — an algorithm adjusts millions (or billions) of numeric parameters so the model's outputs match the examples as closely as possible.
3. **Evaluate** — test the model on examples it has not seen, to measure how well it generalises.
4. **Use it (inference)** — feed new inputs to the trained model and read its output.

The result is a *model*: a large file of numbers (parameters, also called weights) plus the code to run it. It has no stored list of rules; its behaviour is spread across those numbers. That is why ML systems can be powerful and also hard to explain or debug.`],
['Example', `Suppose you want to detect support tickets that mention a refund.

- **Rule-based approach:** search for the word "refund". It misses "I want my money back" and wrongly matches "no refund needed".
- **Machine-learning approach:** train a classifier on several thousand tickets labelled by a human. It learns that phrases like "money back", "charged twice" and "cancel and reimburse" tend to co-occur with refund requests — including phrasings nobody listed.

The ML version is more flexible, but it will still make mistakes, and you need a held-out set of labelled tickets to measure how often.`],
['When should I use it?', `AI/ML is a good fit when:

- the task is about patterns in messy data (text, images, audio, behaviour);
- the rules are too many or too fuzzy to write by hand;
- an occasional error is tolerable, or a human reviews the output.

A plain program is usually better when the rules are clear and exact (tax calculation, permissions, unit conversion), when you need guaranteed repeatable results, or when an error is unacceptable and cannot be checked.`],
['Common mistakes', `- **Treating "AI" as one thing.** A recommender, an image classifier and a chatbot are very different systems with different failure modes.
- **Assuming it understands.** Models find statistical patterns; they can sound confident while being wrong (see [[ai-hallucinations]]).
- **Skipping evaluation.** "It looked good in the demo" is not evidence. See [[ai-evaluation]].
- **Using AI where a rule would do.** A deterministic function is cheaper, faster and fully predictable.`]
]},

{
slug: 'generative-ai', title: 'What is Generative AI?', kind: C, group: 'Foundations',
question: 'What is generative AI and what can it do?',
summary: 'Generative AI models create new content — text, images, audio, video and code — by learning the patterns in very large training sets.',
short: 'Generative AI **produces new content** that resembles its training data, instead of only classifying or predicting. Chat assistants, image generators and code assistants are all generative AI.',
aliases: ['gen AI', 'genAI', 'generative artificial intelligence', 'what can generative AI do', 'text to image', 'AI content generation'],
keywords: ['diffusion', 'language model', 'image generation', 'foundation model', 'synthetic content', 'creative AI'],
related: ['what-is-ai', 'large-language-models', 'multimodal-ai', 'ai-hallucinations'],
sections: [
['What is it?', `Traditional ML is mostly *discriminative*: given an input, choose a label or number ("spam", "$312,000"). Generative AI models instead learn the structure of the data itself well enough to **produce new samples** — a paragraph, a picture, a melody, a function in Python.

Common families:

- **Language models** generate text (and code) one piece at a time. See [[large-language-models]].
- **Diffusion models** generate images (and some video/audio) by starting from noise and repeatedly refining it towards something that matches a text description.
- **Multimodal models** accept or produce more than one kind of content. See [[multimodal-ai]].

Many of these are built on a [[transformers|transformer]] architecture, although image generators commonly combine it with diffusion techniques.`],
['Why does it matter?', `For the first time, a general-purpose interface — plain language — can drive software across many tasks: drafting, summarising, translating, explaining code, extracting data from documents, brainstorming. That lowers the skill barrier for tasks that used to need specialised tools or people.

It also introduces new risks that older software did not have: fluent but wrong output, leaked sensitive data, copyright and attribution questions, and content that is hard to tell from human work. A useful mental model is *fast, tireless, well-read assistant that sometimes makes things up* — valuable, but needing review.`],
['How does it work?', `At a high level, training and use look like this:

1. **Pre-training** on a very large collection of text, images or other data. For a language model the training task is simply to predict what comes next; to do that well across a huge variety of text, the model ends up capturing grammar, facts, styles and reasoning patterns.
2. **Adaptation** — optional extra training so the model follows instructions and behaves helpfully and safely (see [[fine-tuning]]).
3. **Generation (inference)** — given your prompt, the model produces output step by step. There is a controlled amount of randomness, so the same prompt can give different results.

The model does not look answers up in a database. It generates plausible output from patterns stored in its parameters, which is why it can be creative and also why it can be wrong. Techniques like [[rag]] add real source material to the prompt to reduce that risk.`],
['Example', `A practical workflow for a support team:

1. Paste a long customer email thread into an assistant.
2. Ask for a three-bullet summary and a draft reply in a friendly tone.
3. A human checks the facts (dates, refund amounts), edits, and sends.

The model saves reading and drafting time; the human remains accountable for accuracy. Removing step 3 is where most real-world problems begin.`],
['When should I use it?', `It works well for first drafts, summarising, rewriting, translation, classification of messy text, explaining unfamiliar code, brainstorming and transforming formats (notes to email, table to JSON).

Be cautious or add verification when exact facts, numbers, legal/medical/financial correctness or citations matter, when the output is published unreviewed, or when the input contains confidential data (see [[ai-privacy-and-security]]).`],
['Common mistakes', `- **Using it as a search engine or database.** It generates; it does not retrieve, unless you add retrieval ([[rag]]).
- **Believing confident tone means accuracy.**
- **Pasting sensitive data into a service you have not vetted.**
- **Expecting identical output every time.** Generation is probabilistic.`]
]},

{
slug: 'large-language-models', title: 'What is a Large Language Model (LLM)?', kind: C, group: 'Foundations',
question: 'What is an LLM and how does it generate text?',
summary: 'A large language model is a neural network trained on vast amounts of text to predict the next token, which lets it write, summarise, translate, reason about text and write code.',
short: 'An LLM is a very large neural network trained to **predict the next token** in text. Repeating that prediction produces whole answers. ChatGPT-style assistants are built on LLMs.',
aliases: ['LLM', 'LLMs', 'large language model', 'what is an LLM', 'how do LLMs work', 'language model', 'GPT explained', 'foundation model'],
keywords: ['next token prediction', 'parameters', 'pre-training', 'instruction tuning', 'inference', 'temperature', 'sampling', 'transformer'],
related: ['tokens', 'context-windows', 'transformers', 'prompt-engineering', 'ai-hallucinations', 'fine-tuning'],
sections: [
['What is it?', `A **large language model** is a neural network, usually a [[transformers|transformer]], trained on a very large body of text (and often code) to model language. "Large" refers to the number of internal parameters — commonly billions — and the amount of training data.

Its core skill is deceptively simple: given some text, estimate which [[tokens|token]] is likely to come next. Because language contains facts, logic, style and instructions, getting good at that one task produces a model that can answer questions, summarise, translate, classify, extract information and write code.

An LLM is the engine; the product around it (a chat app, a coding assistant, an [[ai-agents|agent]]) adds interface, instructions, tools and memory.`],
['Why does it matter?', `LLMs are the foundation of most current generative AI products. Understanding them tells you why they behave as they do:

- They are **good at language and patterns**, so drafting and summarising work well.
- They have a **limited working memory** (the [[context-windows|context window]]).
- They can **state falsehoods fluently** ([[ai-hallucinations]]), because they generate plausible text rather than looking up verified facts.
- They have a **knowledge cut-off**: they do not know events after their training data unless you supply that information.`],
['How does it work?', `A simplified view of one answer:

1. Your text is split into [[tokens]].
2. The tokens flow through the network's layers. Attention mechanisms let each token take account of the other tokens in the prompt (see [[transformers]]).
3. The model outputs a probability for every token in its vocabulary being next.
4. One token is chosen (settings such as *temperature* control how adventurous the choice is), appended to the text, and the process repeats until the answer is finished.

Training happens in stages. **Pre-training** teaches general language ability from raw text. **Instruction tuning and preference tuning** then teach the model to follow requests and respond helpfully. Running the finished model to produce output is called **inference**.

Everything the model "knows" is encoded in its parameters, and the only short-term information it has is what is inside the current prompt. It does not learn from your conversation unless the provider separately retrains it.`],
['Example', `Prompt: "The capital of France is"

The model assigns high probability to " Paris", low probability to other tokens, picks one and continues. The same mechanism, repeated thousands of times, produces an email, an essay or a function. Asked for something it has no reliable pattern for — such as the title of an obscure paper — it will still produce *plausible-looking* text, which is how invented citations arise.`],
['When should I use it?', `Use an LLM when the task is language-shaped and a human or a check can validate the result: drafting, summarising, rewriting, extracting fields from messy text, classification, brainstorming, code assistance.

Prefer something else when you need guaranteed arithmetic or lookups (call a calculator or database through [[function-calling]]), when answers must come from your own documents ([[rag]]), or when exact reproducibility is mandatory.`],
['Common mistakes', `- **Assuming it has live, up-to-date knowledge.** Unless connected to search or tools, it does not.
- **Assuming it remembers earlier chats.** Each request only knows what is sent in it; apps re-send history. See [[context-windows]] and [[agent-memory]].
- **Confusing the model with the product.** Behaviour depends on the model *and* the system prompt, tools and settings around it ([[system-prompts]]).
- **Judging by one good answer.** Test with many realistic cases ([[ai-evaluation]]).`]
]},

{
slug: 'tokens', title: 'What are Tokens in AI?', kind: C, group: 'Foundations',
question: 'What is a token and why do tokens matter for AI cost and limits?',
summary: 'Tokens are the chunks of text — whole words, word pieces or punctuation — that language models read and write. Limits and pricing are usually measured in them.',
short: 'A token is the unit of text a model processes: often a word, part of a word, or punctuation mark. English averages very roughly **three-quarters of a word per token**, but it varies by language and model.',
aliases: ['token', 'tokenization', 'tokenisation', 'tokenizer', 'what is a token', 'token count', 'token limit', 'token pricing', 'BPE'],
keywords: ['byte pair encoding', 'subword', 'vocabulary', 'context window', 'cost', 'input tokens', 'output tokens'],
related: ['large-language-models', 'context-windows', 'embeddings', 'prompt-engineering'],
sections: [
['What is it?', `Language models do not read letters or whole words directly. A **tokenizer** first converts text into a sequence of **tokens** — pieces drawn from a fixed vocabulary — and each token is mapped to a number. The model only ever sees and produces those numbers.

A token can be a whole common word (" the"), a fragment of a longer word ("un" + "believ" + "able"), a punctuation mark, a space, or a single character. Many tokenizers use a method such as *byte-pair encoding* that learns frequent fragments from data, so common words are one token and rare words are split into several.`],
['Why does it matter?', `Tokens are the unit that most things are measured in:

- **Context window:** the model can handle only a limited number of tokens per request (your prompt plus its answer). See [[context-windows]].
- **Cost:** hosted model APIs commonly price by tokens processed and generated, often with different rates for input and output. Check your provider's current pricing.
- **Speed:** longer outputs take longer because tokens are produced one after another.
- **Odd behaviour:** because models see tokens rather than letters, tasks like counting letters in a word or reversing a string can go wrong.`],
['How does it work?', `A rough rule of thumb for English is that one token is about four characters, or about three-quarters of an average word. That is only an estimate: code, numbers, and non-English languages often need more tokens for the same meaning, and every model family has its own tokenizer, so the same text can have a different count in different models.

Example (illustrative — exact splits depend on the tokenizer):

\`\`\`
"Tokenization is useful."
→ ["Token", "ization", " is", " useful", "."]   (about 5 tokens)
\`\`\`

For a precise number, use the tokenizer or token-counting facility published by the model provider you actually use.`],
['Example', `You paste a 6,000-word report and ask for a summary. If the report is roughly 8,000 tokens, those count against the context window and against your bill (if billed per token) before the model writes a single word of the summary. If the model's limit is smaller than your prompt plus the reply you want, the request fails or the text must be cut or chunked.

Practical consequence: be deliberate about what you include. Sending only the relevant sections is cheaper, faster and often more accurate than sending everything.`],
['When should I use it?', `Think in tokens when you are:

- estimating cost for an application that will make many calls;
- deciding how much source material fits in a prompt;
- designing [[chunking]] for [[rag]], where chunk sizes are commonly set in tokens;
- debugging truncated answers (the output limit was hit).`],
['Common mistakes', `- **Equating tokens with words.** They differ, and the ratio changes by language.
- **Forgetting output tokens.** The reply counts toward the limit too.
- **Reusing one model's token count for another.** Tokenizers differ.
- **Ignoring system prompts and tool definitions.** Hidden instructions also consume tokens.`]
]},

{
slug: 'context-windows', title: 'What is a Context Window?', kind: C, group: 'Foundations',
question: 'What is a context window and why does AI forget things?',
summary: 'The context window is the maximum amount of text, measured in tokens, that a model can consider in a single request. Anything outside it is invisible to the model.',
short: 'The context window is the model\'s **working memory for one request**: your instructions, the conversation, any documents, and the reply must all fit inside it. It is not long-term memory.',
aliases: ['context length', 'context size', 'token limit', 'why does AI forget', 'AI memory limit', 'long context', 'context window size', 'lost in the middle'],
keywords: ['tokens', 'attention', 'conversation history', 'truncation', 'summarization', 'long documents', 'rag'],
related: ['tokens', 'large-language-models', 'agent-memory', 'rag', 'chunking', 'prompt-engineering'],
sections: [
['What is it?', `Each time you call a language model, everything it can use must be placed in that single request: the system instructions, your messages, earlier turns of the conversation, any pasted documents or tool results, and room for the answer. The **context window** is the upper limit on that total, measured in [[tokens]].

If the content exceeds the limit, something has to give: the request is rejected, the oldest messages are dropped, or you must shorten the input. The model cannot see anything outside the window.`],
['Why does it matter?', `It explains many everyday frustrations:

- "The AI forgot what I said earlier" — in a long chat the early messages may have been trimmed or summarised away.
- "It ignored part of my document" — the part may not have fit, or it was buried among too much text.
- "It's slow and expensive on long inputs" — more tokens means more processing.

It also shapes system design. Instead of stuffing everything into the window, developers retrieve only the relevant parts ([[rag]]), store durable facts outside the model ([[agent-memory]]), and summarise old turns.`],
['How does it work?', `Chat products create the illusion of memory by **re-sending the conversation** with every new message. The model itself is stateless between requests.

Window sizes differ widely between models and change as new models are released, so check the current documentation for the model you use rather than relying on a remembered number.

Bigger is not automatically better. Research on long-context use (for example the paper "Lost in the Middle") has found that models can use information at the start and end of a long prompt more reliably than information in the middle, and long inputs add cost and latency. Quality depends on the model and the task, so measure it on your own material ([[ai-evaluation]]).`],
['Example', `A support assistant has a 100-page policy manual. Options:

1. **Paste the whole manual every time.** Simple, but costly, slow, and it may not fit.
2. **Retrieve first.** Index the manual ([[embeddings]], [[vector-databases]]), fetch the three most relevant sections for each question, and put only those in the prompt. This is [[rag]].
3. **Summarise history.** Keep recent turns verbatim, compress older turns into a short summary.

Most production systems combine 2 and 3.`],
['When should I use it?', `Design around the window whenever inputs can grow: long chats, document analysis, code repositories, agents that accumulate tool outputs. Put the most important instructions and facts where they are easy to find (clearly labelled, not buried), remove irrelevant text, and measure token usage during testing.`],
['Common mistakes', `- **Thinking the context window is memory that persists.** It resets with each request.
- **Filling it "because it fits".** Extra noise can reduce accuracy and raises cost.
- **Not reserving room for the reply.** Long prompts can leave too little space for the answer.
- **Assuming a large window removes the need for retrieval.** Often it does not.`]
]},

{
slug: 'transformers', title: 'What is a Transformer? (Attention Explained)', kind: C, group: 'Foundations',
question: 'What is the transformer architecture and what does attention do?',
summary: 'The transformer is the neural-network design behind most modern language models. Its key idea, attention, lets every token weigh how relevant every other token is.',
short: 'A transformer is a neural-network architecture that processes all tokens in a sequence together and uses **attention** to decide which tokens matter for understanding each other token.',
aliases: ['transformer', 'transformer model', 'attention', 'self-attention', 'attention is all you need', 'transformer architecture', 'what is attention in AI'],
keywords: ['neural network', 'encoder', 'decoder', 'parallel', 'queries keys values', 'GPT', 'BERT'],
related: ['large-language-models', 'tokens', 'embeddings', 'context-windows', 'generative-ai'],
sections: [
['What is it?', `The **transformer** is a neural-network architecture introduced in the 2017 paper "Attention Is All You Need" (Vaswani et al.). It replaced earlier designs (recurrent networks) that read text one word at a time, and it is the basis of most large language models, including the "T" in GPT (Generative Pre-trained **Transformer**).

Its central mechanism is **attention**: a way for each token to look at all the other tokens in the input and decide how much each one should influence its own meaning.`],
['Why does it matter?', `Two properties made transformers dominant:

- **Context awareness.** In "The trophy didn't fit in the suitcase because *it* was too big", attention helps the model link "it" to "trophy" rather than "suitcase".
- **Parallel training.** Because tokens in a sequence are processed together rather than strictly one by one, training can use modern hardware efficiently, which made it practical to train very large models on very large datasets.

The trade-off is that attention compares tokens with each other, so cost grows with input length. That is one reason context windows have limits ([[context-windows]]) and long prompts cost more.`],
['How does it work?', `A simplified picture, without the mathematics:

1. Text becomes [[tokens]], and each token becomes a vector of numbers (an [[embeddings|embedding]]), with information about its position.
2. In each **attention layer**, every token produces a *query* ("what am I looking for?"), a *key* ("what do I offer?") and a *value* ("what information do I carry?"). Tokens whose keys match a query strongly contribute more of their values.
3. Several attention "heads" run in parallel, each free to pick up different relationships (grammar, reference, topic).
4. A small feed-forward network further transforms each token, and this attention-plus-transform block is stacked many times.
5. In a text-generating model, the final layer produces probabilities for the next token.

GPT-style models are "decoder-only": each token may attend only to earlier tokens, which suits left-to-right generation. Other designs (such as BERT-style encoders) look in both directions and are often used for understanding tasks and for producing embeddings.`],
['Example', `Take the sentence "She poured water into the glass because it was empty."

For the token "it", attention scores relate it strongly to "glass" and weakly to "water", based on patterns the model learned in training. That relationship feeds into later layers, which is part of how the model resolves what the sentence means. Nothing here is hand-coded; the weighting patterns are learned.`],
['When should I use it?', `You rarely "choose" a transformer directly; you choose a model built on one. Knowing the idea helps you reason about behaviour: why order and wording in a prompt matter, why long inputs are costly, and why different model types (generative decoders vs. embedding encoders) suit different jobs.`],
['Common mistakes', `- **Thinking attention equals human attention or understanding.** It is a mathematical weighting.
- **Assuming "transformer" means "text only".** Transformers are also used for images, audio and multimodal models ([[multimodal-ai]]).
- **Assuming attention shows the model's "reasoning".** Attention patterns are not a reliable explanation of why an answer was produced.`]
]},

{
slug: 'multimodal-ai', title: 'What is Multimodal AI?', kind: C, group: 'Foundations',
question: 'What does multimodal AI mean and what can it do?',
summary: 'Multimodal AI models work with more than one type of data — for example text, images, audio and video — in the same system.',
short: 'A multimodal model can take in, and sometimes produce, several kinds of content such as **text plus images or audio**, so you can ask questions about a photo or a chart.',
aliases: ['multimodal', 'multi-modal AI', 'vision language model', 'VLM', 'image understanding', 'AI that sees images', 'speech and text AI', 'multimodal model'],
keywords: ['vision', 'audio', 'OCR', 'image captioning', 'text to image', 'speech recognition', 'video'],
related: ['generative-ai', 'large-language-models', 'transformers', 'embeddings', 'ai-privacy-and-security'],
sections: [
['What is it?', `A **modality** is a type of data: text, images, audio, video, sensor readings, tables. Early AI systems were *unimodal* — one model for text, a different one for images. A **multimodal** model handles several modalities together, so one request can mix them: "Here is a screenshot of an error; explain it", or "Describe this chart and extract the numbers as a table".

Multimodal systems may accept multiple input types, produce multiple output types, or both. What a specific model supports varies — check its documentation instead of assuming.`],
['Why does it matter?', `Much real information is not plain text: invoices, whiteboards, slides, diagrams, handwritten notes, screenshots, voice recordings. Multimodal models let you work with these directly, which enables accessibility features (describing images), document processing, visual debugging, and voice interfaces.`],
['How does it work?', `Different media are converted into a common internal representation so the same network can relate them:

1. Each modality has an **encoder** that turns raw input (image patches, audio frames, text tokens) into vectors ([[embeddings]]).
2. Those vectors are placed in a shared space, so the model can connect the word "dog" with images of dogs.
3. A [[transformers|transformer]] processes the combined sequence, and a decoder produces text (or another modality) as output.

Training typically uses paired data such as images with captions. Some systems are built as a single model trained on all modalities; others chain specialised components (for instance speech recognition → language model → speech synthesis). Both approaches exist.`],
['Example', `Workflow: you photograph a receipt and ask a multimodal model to return the merchant, date and total as JSON. The model reads the image, extracts the text, and structures it. You still need to validate the result — misread digits are a classic failure — for instance by checking that line items sum to the total.`],
['When should I use it?', `Use it when the information you need is visual or audible and manual transcription would be slow: document and form extraction, describing images, analysing charts or screenshots, voice assistants. Use traditional tools when you need exact, auditable extraction (dedicated OCR with validation) or when the images contain sensitive material you cannot share with a hosted service.`],
['Common mistakes', `- **Assuming perfect visual accuracy.** Models can misread small text, dense charts and handwriting, and can describe things that are not in the image.
- **Forgetting privacy.** Images often contain faces, addresses, badges or screen contents. See [[ai-privacy-and-security]].
- **Assuming every model does every modality.** Verify input and output support.
- **Not validating extracted numbers.**`]
]},

{
slug: 'prompt-engineering', title: 'Prompt Engineering: How to Write Better AI Prompts', kind: C, group: 'Prompting',
question: 'How do I write effective prompts for AI models?',
summary: 'Prompt engineering is the practice of giving a model clear instructions, context, examples and format requirements so it produces useful, reliable output.',
short: 'Good prompts state the **task, context, constraints and desired output format**, and show an example when wording alone is ambiguous. Then you test and revise.',
aliases: ['prompt engineering', 'how to write prompts', 'how do I create better AI prompts', 'prompting tips', 'prompt techniques', 'few-shot prompting', 'zero-shot', 'chain of thought', 'prompt design', 'write better prompts'],
keywords: ['instructions', 'few-shot', 'examples', 'role', 'format', 'JSON', 'iteration', 'chain of thought', 'structured output'],
related: ['system-prompts', 'common-prompting-mistakes', 'context-windows', 'ai-hallucinations', 'ai-evaluation', 'function-calling'],
tool: { id: 'ai-prompt-builder', note: `If you want a structure to start from, the **AI Prompt Builder** walks you through six sections — role, request, context, process, tone and output — and assembles them into a single prompt you can copy into any AI assistant.` },
sections: [
['What is it?', `A **prompt** is the input you give a model. **Prompt engineering** is the craft of designing that input so the output is useful and dependable. It is less about secret phrases and more about the same things that make instructions to a human colleague work: clarity, context and a definition of "done".

A model cannot read your mind or see your files. It only has the text (and any other inputs) in the request, so anything not stated is guessed.`],
['Why does it matter?', `Vague prompts produce generic or off-target answers; precise prompts produce answers you can use with little editing. For developers, prompt quality directly affects the reliability of an application: a prompt is part of your program, and small wording changes can change behaviour. Treat prompts as something to version, test and review, not as throwaway text.`],
['How does it work?', `A dependable structure covers these elements (use the ones that apply):

1. **Task** — what to do, in one clear sentence.
2. **Context** — who it is for, background, the relevant source text. Put long source material clearly delimited (for example between labelled markers).
3. **Constraints** — length, tone, what to avoid, what to do if information is missing.
4. **Output format** — bullets, table, JSON with named fields, headings.
5. **Examples** — one to a few input→output pairs ("few-shot") when the format or style is hard to describe. Zero-shot means no examples.
6. **A way out** — permit "I don't know" or "not in the provided text" so the model is not pushed to invent an answer.

Additional techniques:

- **Ask for reasoning on hard problems** — telling the model to work through steps often helps with multi-step logic or arithmetic, though results vary by model, and many current models reason by default.
- **Break big tasks into steps** — extract first, then analyse, then write.
- **Iterate** — change one thing at a time and compare outputs on several test inputs.`],
['Example', `Weak prompt:

\`\`\`
Summarise this article.
\`\`\`

Stronger prompt:

\`\`\`
You are helping a busy product manager.
Summarise the article between the <article> tags in exactly 3 bullet points,
each under 20 words. Then list any decisions the article says must be made.
If the article contains no decisions, write "No decisions mentioned."
Use only information in the article.

<article>
...text here...
</article>
\`\`\`

The second version defines audience, length, format, a fallback, and a grounding rule.`],
['When should I use it?', `Invest in prompt design whenever you will reuse a prompt, when output feeds another system, or when errors are costly. For a one-off casual question, a short natural request is fine; follow up to refine. When prompting alone cannot supply the knowledge or consistency you need, move to [[rag]] (to add information) or [[fine-tuning]] (to change behaviour) — see [[rag-vs-fine-tuning]].`],
['Common mistakes', `See [[common-prompting-mistakes]] for a fuller list. The usual culprits are vague goals, missing context, no output format, contradictory instructions, and testing on a single example. Remember too that a prompt is not a security boundary — see [[prompt-injection]].`]
]},

{
slug: 'system-prompts', title: 'What is a System Prompt?', kind: C, group: 'Prompting',
question: 'What is a system prompt and how is it different from a user prompt?',
summary: 'A system prompt is the standing set of instructions that defines how an AI model or assistant should behave, separate from what a user types in each message.',
short: 'A system prompt is **developer-supplied instruction text** that sets role, rules, tone and constraints for a whole conversation. The user prompt is the individual request. System prompts guide behaviour but are not a security guarantee.',
aliases: ['system prompt', 'system message', 'system instructions', 'custom instructions', 'developer message', 'system prompt vs user prompt', 'role prompt', 'what is a system prompt'],
keywords: ['instructions', 'persona', 'guardrails', 'roles', 'user prompt', 'assistant message', 'prompt injection', 'leakage'],
related: ['prompt-engineering', 'common-prompting-mistakes', 'prompt-injection', 'agent-tools', 'context-windows'],
tool: { id: 'ai-prompt-builder', note: `Drafting the role, context, process and output sections of a system prompt is much like filling in the **AI Prompt Builder** sections. It can help you organise the text, which you then adapt for your application.` },
sections: [
['What is it?', `Chat-style model APIs typically accept messages with different **roles**. The usual ones are:

- **System** (some APIs call it *developer*): standing instructions from whoever builds the application.
- **User**: what the end user types.
- **Assistant**: the model's previous replies.
- **Tool**: results returned from tools ([[function-calling]]).

The exact role names and how strongly each is weighted vary by provider, so consult the documentation of the model you use. The idea is constant: a system prompt is the "job description" the model carries into every turn.`],
['Why does it matter?', `The same underlying model can behave like a terse code reviewer, a patient tutor or a strict data-extraction engine, purely based on the system prompt. For an application it is the cheapest and fastest place to control behaviour: tone, scope ("only answer questions about our product"), output format, escalation rules, and how to handle missing information.`],
['How does it work?', `The system prompt is simply text placed at the start of the context, so it:

- **uses tokens** on every request ([[tokens]], [[context-windows]]);
- **is followed on a best-effort basis.** Models are trained to prioritise it, but they can still drift or be talked around;
- **can be inferred or extracted** by a determined user in some setups, so it should not hold secrets.

Good system prompts are concrete and ordered by importance:

1. Role and audience.
2. What the assistant should and should not do.
3. How to use supplied information (e.g. "answer only from the provided documents; otherwise say you don't know").
4. Output format and tone.
5. What to do in edge cases (unclear request, out-of-scope request, sensitive topic).`],
['Example', `\`\`\`
You are the support assistant for Acme Billing.
- Answer only questions about Acme invoices, plans and refunds.
- Use only the policy excerpts provided in <policy> tags. If the answer is not there,
  say you are not sure and offer to connect the user to a human agent.
- Never ask for full card numbers.
- Keep answers under 120 words, in a friendly, plain tone.
\`\`\`

Each rule maps to a behaviour you can test: out-of-scope questions, missing policy, a user pasting a card number, and answer length.`],
['When should I use it?', `Use a system prompt for anything that should hold for the whole session or product: persona, scope, format, safety rules, and tool-use guidance. Use the user message for the specific task. Version-control system prompts, and re-run your test cases ([[ai-evaluation]]) after each change.`],
['Common mistakes', `- **Putting secrets in it** (API keys, private rules). Assume it can leak.
- **Treating it as a firewall.** Instructions can be overridden by crafted input; enforce permissions in code. See [[prompt-injection]].
- **Making it enormous and contradictory.** Long, conflicting rules reduce compliance and cost tokens on every call.
- **Never testing edge cases.** Test refusals, missing data and adversarial inputs.`]
]},

{
slug: 'common-prompting-mistakes', title: 'Common Prompting Mistakes (and How to Fix Them)', kind: C, group: 'Prompting',
question: 'Why are my AI prompts giving bad answers?',
summary: 'Most poor AI output traces back to a handful of prompt problems: vague goals, missing context, no format, conflicting instructions and no testing.',
short: 'If answers are generic, wrong or inconsistent, check for **vague goals, missing context, undefined format, conflicting rules, no fallback for missing information, and testing on only one example**.',
aliases: ['prompt mistakes', 'bad prompts', 'why is AI giving wrong answers', 'prompt troubleshooting', 'fix my prompt', 'prompt anti-patterns', 'AI ignores my instructions'],
keywords: ['vague', 'ambiguity', 'format', 'negative instructions', 'iteration', 'testing', 'long prompts', 'conflicting instructions'],
related: ['prompt-engineering', 'system-prompts', 'ai-hallucinations', 'how-to-reduce-hallucinations', 'context-windows'],
tool: { id: 'ai-prompt-builder', note: `Several of these mistakes — missing context, no stated output format, no tone — disappear when each part has its own box. The **AI Prompt Builder** is one way to check you have filled them in before sending.` },
sections: [
['What is it?', `Prompts fail in predictable ways. Because the model can only act on the text it receives, most "bad AI answers" are really under-specified requests. This page lists the common failures with a fix for each, so you can debug a prompt systematically.`],
['Why does it matter?', `Debugging by guesswork wastes time and leads to superstition ("it works if I say please in capitals"). Naming the failure mode lets you make a targeted change and test it. In applications, the same mistakes cause inconsistent behaviour that is expensive to find later.`],
['How does it work?', `Symptom → likely cause → fix:

| Symptom | Likely cause | Fix |
|---|---|---|
| Generic, bland answer | Goal and audience not stated | State who it is for and what decision or action it supports |
| Answer ignores your data | Data missing, buried, or too long | Include the relevant text, delimit it, trim the rest ([[context-windows]]) |
| Wrong format | Format only implied | Specify the exact format; add a short example |
| Invented facts | No source and no permission to say "unknown" | Supply sources and allow "not found" ([[how-to-reduce-hallucinations]]) |
| Instruction skipped | Too many rules, or rules conflict | Prioritise, remove duplicates, split into steps |
| Inconsistent across runs | Ambiguity or high randomness | Tighten wording, add examples, lower temperature if available |
| Works on one test, fails on others | Tested once | Build a small set of varied cases ([[ai-evaluation]]) |`],
['Example', `Before: "Write something about our new feature."

Problems: no audience, no length, no format, no facts about the feature.

After:

\`\`\`
Write a 120-word announcement for existing customers about the new CSV export.
Facts: available on all paid plans; exports up to 50,000 rows; found under Reports > Export.
Tone: friendly, no hype. End with one sentence linking to the help article.
Do not mention features not listed above.
\`\`\`

Every sentence removes a guess the model would otherwise make.`],
['When should I use it?', `Run through this list whenever a prompt underperforms, before you conclude the model is "not good enough". If a well-formed prompt still fails, the problem may be missing knowledge ([[rag]]), a task that needs a tool ([[function-calling]]), or a task better solved by ordinary code.`],
['Common mistakes', `Beyond the table above:

- **Only saying what not to do.** "Don't be formal" is weaker than "write in a casual, conversational tone".
- **Over-engineering magic phrases.** Clear instructions beat tricks.
- **Changing many things at once,** so you cannot tell which change helped.
- **Pasting confidential data into prompts** without considering where it goes ([[ai-privacy-and-security]]).`]
]},

{
slug: 'ai-hallucinations', title: 'AI Hallucinations: Why Models Make Things Up', kind: C, group: 'Reliability',
question: 'What are AI hallucinations and why do they happen?',
summary: 'A hallucination is output that sounds plausible but is false, unsupported or fabricated. It follows from how language models generate text.',
short: 'AI hallucination means a model **generates confident, plausible content that is not true or not supported by its sources** — invented facts, quotes, citations or code. It cannot be eliminated entirely, only reduced and checked.',
aliases: ['hallucination', 'hallucinations', 'AI making things up', 'why does AI lie', 'fabricated citations', 'AI confabulation', 'false AI answers', 'LLM hallucination', 'AI wrong answers'],
keywords: ['fabrication', 'confabulation', 'grounding', 'citations', 'factuality', 'confidence', 'verification', 'fake references'],
related: ['how-to-reduce-hallucinations', 'rag', 'large-language-models', 'ai-evaluation', 'prompt-engineering'],
tool: { id: 'fact-anchor-checker', note: `When you have a model's answer *and* the source text it should be based on, the **Fact Anchor Checker** compares each claim against the evidence you supply and flags what is supported, partially supported, or not found. It checks claims against your supplied evidence only — it cannot independently verify facts that aren't in that text.` },
sections: [
['What is it?', `A **hallucination** is a model output that is fluent and confident but wrong: an invented statistic, a book that does not exist, a legal case that was never decided, a function that is not in the library. Two useful distinctions:

- **Factual errors:** the output contradicts reality.
- **Unfaithfulness:** the output contradicts or goes beyond the *source material you provided* (for example, a summary that adds claims the document never made).

The word is a metaphor; the model is not perceiving things that are not there, it is generating text that fits a pattern.`],
['Why does it matter?', `Fluent text is persuasive, so errors can pass unnoticed. Real-world consequences include fabricated citations in documents, incorrect customer advice, flawed code that looks right, and decisions made on invented figures. In regulated or high-stakes settings, unchecked output can create legal and safety risk.`],
['How does it work?', `A language model is trained to produce likely continuations of text, not to consult a verified fact store ([[large-language-models]]). Several things raise the chance of fabrication:

- **No relevant knowledge.** For obscure topics or events after its training data, the model still produces something plausible rather than stopping.
- **Pressure to answer.** A prompt that demands a specific answer (a name, a citation, a number) invites invention.
- **Ambiguity or false premises** in the question ("Why did company X win the 2019 award?" when it did not).
- **Weak or conflicting context** in the prompt.
- **Long chains of generation,** where an early mistake gets built upon.

Models can be well-calibrated in some settings and badly overconfident in others; stated confidence in the text is not a reliable signal of correctness.`],
['Example', `Prompt: "Give me three peer-reviewed papers on topic X with DOIs."

A model with no search access may return three references with realistic titles, authors and DOIs — some or all fabricated. The format is perfect, which is exactly why it is dangerous. The safe workflow: treat references as leads, then look every one up in a real index or publisher site before citing it.`],
['When should I use it?', `Hallucination risk should shape *how* you use AI, not whether you do:

- Low risk: brainstorming, drafting, rewording, code scaffolding you will run and test.
- Higher risk: facts, figures, citations, legal/medical/financial content, anything published or acted upon without review.

For higher-risk uses, add grounding ([[rag]]), require sources, set up checks, and keep a human in the loop. Practical techniques are in [[how-to-reduce-hallucinations]]; measurement is covered in [[ai-evaluation]].`],
['Common mistakes', `- **Believing a confident tone.**
- **Asking the model to check itself and treating that as verification.** Self-review can help, but it can repeat the same error.
- **Assuming RAG removes the problem.** The model can still misread or ignore retrieved text, and retrieval can fetch the wrong passage.
- **Assuming newer or bigger models are immune.** Rates vary by model and task; test your own use case.`]
]},

{
slug: 'how-to-reduce-hallucinations', title: 'How to Reduce AI Hallucinations', kind: C, group: 'Reliability',
question: 'How do I reduce hallucinations in AI answers?',
summary: 'You cannot remove hallucinations completely, but you can lower them by grounding answers in sources, constraining the task, allowing "I don\'t know", and verifying output.',
short: 'The most effective levers are: **give the model the source text, tell it to answer only from that text, allow "not found", ask for quotes or citations, and verify** with a second check or a human.',
aliases: ['reduce hallucinations', 'stop AI making things up', 'prevent hallucinations', 'avoid AI hallucination', 'make AI more accurate', 'AI fact checking', 'grounded answers', 'how do I reduce hallucinations'],
keywords: ['grounding', 'citations', 'verification', 'temperature', 'retrieval', 'guardrails', 'quote extraction', 'human review'],
related: ['ai-hallucinations', 'rag', 'prompt-engineering', 'ai-evaluation', 'agent-tools', 'common-prompting-mistakes'],
tool: { id: 'fact-anchor-checker', note: `As a lightweight verification step, paste the model's answer and the source passage into the **Fact Anchor Checker** to see which claims are supported by that evidence and which are not found. It only compares against the text you provide, so it is a review aid, not proof of truth.` },
sections: [
['What is it?', `This page is a practical checklist for lowering the rate of fabricated or unsupported output. It builds on the explanation in [[ai-hallucinations]]. The goal is not perfection; it is reducing errors and making the remaining ones easy to catch.`],
['Why does it matter?', `Reliability decides whether an AI feature is trusted. A system that is right 90% of the time and never signals the other 10% can be worse than one that is right 80% of the time and flags uncertainty, because users cannot tell which answers to double-check.`],
['How does it work?', `Work through these layers, from cheapest to most involved:

1. **Supply the facts.** Put the relevant source text in the prompt rather than relying on the model's memory. When the source set is large, retrieve the relevant parts first ([[rag]]).
2. **Constrain the task.** "Answer using only the text between the <source> tags." Narrow questions beat open-ended ones.
3. **Allow and define "I don't know".** For example: *if the answer is not stated in the source, reply exactly "Not found in the provided documents."*
4. **Ask for evidence.** Require a short quote or section reference for each claim, then check that the quote really appears in the source (a simple string search can automate this).
5. **Decompose.** Extract facts first, then write from the extracted facts, instead of one big generation.
6. **Use tools for what models are bad at.** Calculations, dates, database lookups and live data should come from code or APIs via [[function-calling]], not from the model's recall.
7. **Reduce randomness** where the platform offers it (for example lower temperature) for extraction and factual tasks. This helps consistency but does not guarantee truth.
8. **Verify.** Use a second pass, automated checks (schema validation, citation matching), and human review proportional to the risk.
9. **Measure.** Keep a test set of questions with known answers and track errors across prompt or model changes ([[ai-evaluation]]).`],
['Example', `Policy Q&A bot, before and after:

Before: "What is our refund window?" → model answers from general knowledge: "30 days".

After: retrieve the refund policy section; prompt:

\`\`\`
Answer the question using only the policy excerpt below.
Quote the sentence that supports your answer.
If the excerpt does not answer the question, say "Not found in the policy."

<policy>...retrieved text...</policy>
Question: What is our refund window?
\`\`\`

Now the answer is traceable. An automated check confirms the quoted sentence exists in the excerpt; if it does not, the answer is rejected.`],
['When should I use it?', `Apply the cheap layers (1–3) almost always. Add evidence checks, tools and review as stakes rise. For anything that reaches customers or informs important decisions, combine grounding, verification and a human fallback.`],
['Common mistakes', `- **Telling the model "do not hallucinate" and stopping there.** It has no switch for that; give it sources and structure instead.
- **Retrieving too much or the wrong text,** which gives the model plausible but irrelevant material to build on.
- **Relying on a single verification method.**
- **Not testing refusals.** Check that it says "not found" when it should, not only that it answers when it can.`]
]}
];
