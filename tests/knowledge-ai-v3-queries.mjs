// V3 AI knowledge query suite. No network, no model. Uses the committed index + lexicon and the unmodified search core.
// Labels are computed, not hand-assigned:
//   pass  = an accepted page is the solid answer (top) and no unexpected tool is shown
//   weak  = an accepted page appears in the top 5 results / learn-more, but is not the solid answer
//   miss  = no accepted page in the top 5
// Negative queries (ids: []) must NOT produce a solid answer or a tool. A solid answer there is a FALSE POSITIVE.
// For positive queries, a solid answer that is not an accepted page is also a FALSE POSITIVE (confident wrong page).
import { readFileSync, writeFileSync } from "node:fs";
import { searchKnowledge } from "../knowledge/search-core.mjs";

const index = JSON.parse(readFileSync(new URL("../knowledge/search-index.json", import.meta.url), "utf8"));
const lexicon = JSON.parse(readFileSync(new URL("../knowledge/search-lexicon.json", import.meta.url), "utf8"));
const ids = new Set(index.pages.map((p) => p.id));

const Q = (cat, q, accept, tool = null) => ({ cat, q, accept: [].concat(accept), tool });
const cases = [
  // ---- definitions ----
  Q("definition", "What is test-time compute?", "test-time-compute"),
  Q("definition", "What is a reasoning model?", "reasoning-models"),
  Q("definition", "What is chain-of-thought prompting?", "chain-of-thought"),
  Q("definition", "What is self-consistency in LLMs?", "self-consistency"),
  Q("definition", "What is best-of-N sampling?", "best-of-n-sampling"),
  Q("definition", "What is Tree of Thoughts?", "search-over-reasoning"),
  Q("definition", "What is a process reward model?", "process-reward-model"),
  Q("definition", "What is an outcome reward model?", "outcome-reward-model"),
  Q("definition", "What is a thinking budget?", "thinking-budgets"),
  Q("definition", "What is constrained decoding?", "constrained-decoding"),
  Q("definition", "What is structured output from an LLM?", "structured-outputs"),
  Q("definition", "What is grammar-guided generation?", "grammar-guided-generation"),
  Q("definition", "What is GBNF?", "gbnf-grammars"),
  Q("definition", "What is JSON Schema?", "json-schema"),
  Q("definition", "What is temperature in an LLM?", "sampling-and-decoding"),
  Q("definition", "What is top-p sampling?", "sampling-and-decoding"),
  Q("definition", "What is a vision-language-action model?", "vision-language-action-models"),
  Q("definition", "What is a world model in AI?", "world-models"),
  Q("definition", "What is embodied AI?", "embodied-ai"),
  Q("definition", "What is imitation learning?", "imitation-learning"),
  Q("definition", "What is sim-to-real transfer?", "sim-to-real-transfer"),
  Q("definition", "What are AI benchmarks?", "benchmarks-and-leaderboards"),
  Q("definition", "What is benchmark contamination?", "benchmark-contamination"),
  Q("definition", "What is LLM-as-a-judge?", "llm-as-a-judge"),
  Q("definition", "What is MMLU?", "mmlu"),
  Q("definition", "What is HumanEval?", "humaneval"),
  Q("definition", "What is SWE-bench?", "swe-bench"),
  Q("definition", "What is GSM8K?", "gsm8k-and-math-benchmarks"),
  Q("definition", "What is the A2A protocol?", "a2a-protocol"),
  Q("definition", "What is an agent card?", "a2a-protocol"),
  Q("definition", "What is LangGraph?", "langgraph"),
  Q("definition", "What is DSPy?", "dspy"),
  Q("definition", "What is CrewAI?", "crewai"),
  Q("definition", "What is Semantic Kernel?", "semantic-kernel"),
  Q("definition", "What is vLLM?", "vllm"),
  Q("definition", "What is llama.cpp?", "llama-cpp"),
  Q("definition", "What is Ollama?", "ollama"),
  Q("definition", "What is ONNX Runtime?", "onnx-runtime"),
  Q("definition", "What is PyTorch?", "pytorch"),
  Q("definition", "What is AlphaFold?", "alphafold"),
  Q("definition", "What is a physics-informed neural network?", "physics-informed-neural-networks"),
  Q("definition", "What is AI for science?", "ai-for-science"),
  Q("definition", "What is supervised learning?", "supervised-learning"),
  Q("definition", "What is unsupervised learning?", "unsupervised-learning"),
  Q("definition", "What is self-supervised learning?", "self-supervised-learning"),
  Q("definition", "What is a neural network?", "neural-networks"),
  Q("definition", "What is deep learning?", "deep-learning"),
  Q("definition", "What is backpropagation?", "backpropagation-and-gradient-descent"),
  Q("definition", "What is overfitting?", "overfitting-and-regularization"),
  Q("definition", "What is transfer learning?", "transfer-learning"),
  Q("definition", "What is reinforcement learning?", "reinforcement-learning"),
  Q("definition", "What is a Markov decision process?", "markov-decision-processes"),
  Q("definition", "What is a convolutional neural network?", "convolutional-neural-networks"),
  Q("definition", "What is an LSTM?", "recurrent-neural-networks"),
  Q("definition", "What is a Vision Transformer?", "vision-transformers"),
  Q("definition", "What is a mixture of experts model?", "mixture-of-experts"),
  Q("definition", "What is a state space model?", "state-space-models"),
  Q("definition", "What is a diffusion model?", "diffusion-models"),
  Q("definition", "What is a GAN?", "generative-adversarial-networks"),
  Q("definition", "What is a variational autoencoder?", "variational-autoencoders"),
  Q("definition", "What is a graph neural network?", "graph-neural-networks"),
  Q("definition", "What is a KV cache?", "kv-cache"),
  Q("definition", "What is FlashAttention?", "flash-attention"),
  Q("definition", "What is positional encoding?", "positional-encoding"),
  Q("definition", "What are scaling laws in AI?", "scaling-laws"),
  Q("definition", "What is instruction tuning?", "instruction-tuning"),
  Q("definition", "What is LoRA?", "lora-and-peft"),
  Q("definition", "What is model quantization?", "quantization"),
  Q("definition", "What is knowledge distillation?", "knowledge-distillation"),
  Q("definition", "What is speculative decoding?", "speculative-decoding"),
  Q("definition", "What is a small language model?", "small-language-models"),
  Q("definition", "What does open weights mean?", "open-weights-models"),
  Q("definition", "What is a vision-language model?", "vision-language-models"),
  Q("definition", "What is CLIP?", "contrastive-learning-clip"),
  Q("definition", "What is speech recognition AI?", "speech-ai"),
  Q("definition", "What is document AI?", "document-understanding-ai"),
  Q("definition", "What is AI alignment?", "ai-alignment"),
  Q("definition", "What is preference optimization?", "preference-optimization"),
  Q("definition", "What is DPO?", "dpo"),
  Q("definition", "What is RLHF?", "rlhf"),
  Q("definition", "What is Constitutional AI?", "constitutional-ai-and-rlaif"),
  Q("definition", "What is reward hacking?", "reward-hacking"),
  Q("definition", "What is sycophancy in AI?", "sycophancy"),
  Q("definition", "What is AI red teaming?", "red-teaming"),
  Q("definition", "What are AI guardrails?", "ai-guardrails"),
  Q("definition", "What is mechanistic interpretability?", "mechanistic-interpretability"),
  Q("definition", "What is AI governance?", "ai-governance"),
  Q("definition", "What is the EU AI Act?", "eu-ai-act"),
  Q("definition", "What is the NIST AI RMF?", "nist-ai-rmf"),
  Q("definition", "What is ISO 42001?", "iso-iec-42001"),
  Q("definition", "What is a model card?", "model-cards"),
  Q("definition", "What is C2PA?", "c2pa-content-provenance"),
  Q("definition", "What is the OWASP Top 10 for LLM applications?", "owasp-llm-top-10"),
  Q("definition", "What is MLOps?", "mlops"),
  Q("definition", "What is prompt caching?", "prompt-caching"),
  Q("definition", "What is context engineering?", "context-engineering"),
  Q("definition", "What is MLflow?", "mlflow"),
  Q("definition", "What is pgvector?", "pgvector"),
  Q("definition", "What is GraphRAG?", "graph-rag"),
  Q("definition", "What is agentic RAG?", "agentic-rag"),
  Q("definition", "What is hybrid search?", "hybrid-search-and-reranking"),
  Q("definition", "What is the ReAct pattern?", "react-agent-pattern"),
  Q("definition", "What are computer-use agents?", "computer-use-agents"),

  // ---- acronyms ----
  Q("acronym", "PRM meaning AI", "process-reward-model"),
  Q("acronym", "ORM reward model", "outcome-reward-model"),
  Q("acronym", "VLA robotics", "vision-language-action-models"),
  Q("acronym", "MoE LLM", "mixture-of-experts"),
  Q("acronym", "SSM Mamba", "state-space-models"),
  Q("acronym", "ViT vision", "vision-transformers"),
  Q("acronym", "CNN deep learning", "convolutional-neural-networks"),
  Q("acronym", "GNN machine learning", "graph-neural-networks"),
  Q("acronym", "VAE latent space", "variational-autoencoders"),
  Q("acronym", "PPO reinforcement learning", "proximal-policy-optimization"),
  Q("acronym", "DQN Q-learning", "deep-q-networks"),
  Q("acronym", "GRPO", "reinforcement-learning-for-reasoning"),
  Q("acronym", "RLVR", "reinforcement-learning-for-reasoning"),
  Q("acronym", "KTO IPO ORPO SimPO", "preference-optimization"),
  Q("acronym", "RLAIF", "constitutional-ai-and-rlaif"),
  Q("acronym", "LoRA QLoRA PEFT", "lora-and-peft"),
  Q("acronym", "GGUF", ["quantization", "llama-cpp"]),
  Q("acronym", "GPTQ AWQ", "quantization"),
  Q("acronym", "RoPE rotary embeddings", "positional-encoding"),
  Q("acronym", "GQA grouped query attention", "kv-cache"),
  Q("acronym", "SLM", "small-language-models"),
  Q("acronym", "VLM", "vision-language-models"),
  Q("acronym", "ASR TTS", "speech-ai"),
  Q("acronym", "OCR document extraction", "document-understanding-ai"),
  Q("acronym", "PINN", "physics-informed-neural-networks"),
  Q("acronym", "SciML", "ai-for-science"),
  Q("acronym", "GPAI obligations", "eu-ai-act"),
  Q("acronym", "AIMS management system", "iso-iec-42001"),
  Q("acronym", "TTFT", "model-serving-and-inference"),
  Q("acronym", "FSDP ZeRO", "distributed-training"),
  Q("acronym", "HBM VRAM", "gpus-and-ai-accelerators"),
  Q("acronym", "CoT", "chain-of-thought"),
  Q("acronym", "ToT MCTS LLM", "search-over-reasoning"),
  Q("acronym", "BoN", "best-of-n-sampling"),
  Q("acronym", "RRF BM25", "hybrid-search-and-reranking"),
  Q("acronym", "WER", "speech-ai"),
  Q("acronym", "pass@k", "humaneval"),
  Q("acronym", "LLM01", "owasp-llm-top-10"),
  Q("acronym", "SFT", "instruction-tuning"),
  Q("acronym", "MDP POMDP", "markov-decision-processes"),
  Q("acronym", "GBNF", "gbnf-grammars"),

  // ---- comparisons ----
  Q("comparison", "PRM vs ORM", "prm-vs-orm"),
  Q("comparison", "DPO vs RLHF", "dpo-vs-rlhf"),
  Q("comparison", "DPO vs PPO", "dpo-vs-rlhf"),
  Q("comparison", "Is DPO reinforcement learning?", ["dpo", "preference-optimization", "dpo-vs-rlhf"]),
  Q("comparison", "A2A vs MCP", "a2a-vs-mcp"),
  Q("comparison", "Ollama vs vLLM vs llama.cpp", "local-runtimes-compared"),
  Q("comparison", "LangGraph vs CrewAI vs AutoGen", "agent-frameworks-compared"),
  Q("comparison", "CNN vs Vision Transformer", "cnn-vs-vision-transformer"),
  Q("comparison", "Mamba vs transformer", "transformers-vs-state-space-models"),
  Q("comparison", "LoRA vs full fine-tuning", "lora-vs-full-fine-tuning"),
  Q("comparison", "Reasoning model vs regular LLM", "reasoning-vs-standard-models"),
  Q("comparison", "JSON mode vs structured outputs", "structured-output-methods-compared"),
  Q("comparison", "BERT vs GPT", "encoder-decoder-vs-decoder-only"),
  Q("comparison", "GAN vs diffusion model", ["generative-adversarial-networks", "diffusion-models"]),
  Q("comparison", "benchmarks vs custom evals", "llm-benchmarks-vs-task-evals"),
  Q("comparison", "supervised vs unsupervised learning", ["supervised-learning", "unsupervised-learning"]),
  Q("comparison", "process supervision vs outcome supervision", "prm-vs-orm"),
  Q("comparison", "pgvector vs vector database", ["pgvector", "vector-databases", "vector-database-vs-traditional-database"]),
  Q("comparison", "open source vs closed LLMs", "open-weights-models"),
  Q("comparison", "quantization vs distillation", ["quantization", "knowledge-distillation"]),
  Q("comparison", "PPO vs DQN", ["proximal-policy-optimization", "deep-q-networks"]),
  Q("comparison", "NIST AI RMF vs ISO 42001", ["nist-ai-rmf", "iso-iec-42001"]),
  Q("comparison", "LangChain vs LlamaIndex", ["langchain", "llamaindex", "agent-frameworks-compared"]),
  Q("comparison", "MCP vs A2A vs function calling", ["a2a-vs-mcp", "agent-protocol-landscape"]),

  // ---- troubleshooting ----
  Q("troubleshooting", "Why does my reasoning model answer get cut off?", ["thinking-budgets", "reasoning-models"]),
  Q("troubleshooting", "Why is my LLM returning invalid JSON?", ["structured-outputs", "constrained-decoding"], "json-formatter"),
  Q("troubleshooting", "Why does my DPO training make outputs longer?", "dpo"),
  Q("troubleshooting", "Why is my loss NaN?", "backpropagation-and-gradient-descent"),
  Q("troubleshooting", "Why does my model overfit?", "overfitting-and-regularization"),
  Q("troubleshooting", "Why did my model get worse over time?", "model-drift-and-monitoring"),
  Q("troubleshooting", "CUDA out of memory when serving an LLM", ["model-serving-and-inference", "vllm", "kv-cache", "gpus-and-ai-accelerators"]),
  Q("troubleshooting", "Why is my prompt cache not hitting?", "prompt-caching"),
  Q("troubleshooting", "Why does my LLM repeat itself?", "sampling-and-decoding"),
  Q("troubleshooting", "Why does ChatGPT agree with everything I say?", "sycophancy"),
  Q("troubleshooting", "My robot policy works in simulation but fails on the real robot", "sim-to-real-transfer"),
  Q("troubleshooting", "Agent keeps looping forever", ["react-agent-pattern", "ai-agents"]),
  Q("troubleshooting", "Why do reasoning models cost more?", ["reasoning-models", "test-time-compute", "thinking-budgets"]),
  Q("troubleshooting", "Why is my RAG retrieval returning wrong passages?", ["rag-evaluation", "hybrid-search-and-reranking", "chunking", "rag"]),
  Q("troubleshooting", "Why do VLMs hallucinate objects in images?", "vision-language-models"),
  Q("troubleshooting", "Quality dropped after quantizing my model", "quantization"),
  Q("troubleshooting", "LangChain code broke after upgrading", ["langchain", "agent-frameworks-compared"]),
  Q("troubleshooting", "Why do my LLM evaluation scores not reproduce?", ["benchmarks-and-leaderboards", "llm-as-a-judge", "ai-evaluation"]),
  Q("troubleshooting", "LoRA adapter barely changes the model behaviour", "lora-and-peft"),
  Q("troubleshooting", "Model scores high on benchmarks but fails in my product", ["llm-benchmarks-vs-task-evals", "benchmark-contamination", "benchmarks-and-leaderboards"]),
  Q("troubleshooting", "MCP server asked for too many permissions", "mcp-security"),
  Q("troubleshooting", "Training on multiple GPUs scales poorly", "distributed-training"),
  Q("troubleshooting", "LLM judge prefers longer answers", "llm-as-a-judge"),
  Q("troubleshooting", "Ollama connection refused", "ollama"),

  // ---- architecture / how it works ----
  Q("architecture", "How do transformers handle token order?", "positional-encoding"),
  Q("architecture", "How does Stable Diffusion work?", "diffusion-models"),
  Q("architecture", "How do reasoning models use extra compute at inference?", ["test-time-compute", "reasoning-models"]),
  Q("architecture", "How does constrained decoding guarantee valid JSON?", "constrained-decoding"),
  Q("architecture", "How does AlphaFold predict protein structures?", "alphafold"),
  Q("architecture", "How does GraphCast forecast weather?", "ai-weather-forecasting"),
  Q("architecture", "How does speculative decoding speed up LLMs?", "speculative-decoding"),
  Q("architecture", "How does PagedAttention work?", ["kv-cache", "vllm"]),
  Q("architecture", "How does continuous batching work?", ["vllm", "model-serving-and-inference"]),
  Q("architecture", "How does a multi-agent system use A2A and MCP together?", ["a2a-vs-mcp", "a2a-protocol"]),
  Q("architecture", "How do VLA models turn images and text into robot actions?", "vision-language-action-models"),
  Q("architecture", "How does DPO work mathematically?", "dpo"),
  Q("architecture", "How does RLHF use a reward model?", "rlhf"),
  Q("architecture", "How do mixture-of-experts models route tokens?", "mixture-of-experts"),
  Q("architecture", "How does LoRA reduce memory for fine-tuning?", "lora-and-peft"),
  Q("architecture", "How do CLIP embeddings align images and text?", "contrastive-learning-clip"),
  Q("architecture", "How does self-attention differ from recurrence?", ["transformers", "recurrent-neural-networks"]),
  Q("architecture", "How is a RAG system evaluated end to end?", "rag-evaluation"),
  Q("architecture", "How do AI agents plan multi-step tasks?", "agent-planning"),
  Q("architecture", "How does GraphRAG build a knowledge graph?", "graph-rag"),
  Q("architecture", "How does a code interpreter sandbox run model-generated code safely?", "code-execution-sandboxing"),
  Q("architecture", "How does C2PA content credentials signing work?", "c2pa-content-provenance"),
  Q("architecture", "How does world model planning work in Dreamer?", "world-models"),
  Q("architecture", "How does FSDP shard a model across GPUs?", "distributed-training"),

  // ---- what should I use ----
  Q("what-should-i-use", "Which agent framework should I use?", ["agent-frameworks-compared", "choosing-an-agent-framework"]),
  Q("what-should-i-use", "What should I use to run an LLM locally on a Mac?", ["local-runtimes-compared", "ollama", "llama-cpp", "local-ai"]),
  Q("what-should-i-use", "Which runtime should I use to serve an open model to many users?", ["local-runtimes-compared", "vllm"]),
  Q("what-should-i-use", "Which vision backbone should I use for small datasets?", ["cnn-vs-vision-transformer", "convolutional-neural-networks", "transfer-learning"]),
  Q("what-should-i-use", "What is the best way to get structured JSON from a model?", ["structured-output-methods-compared", "structured-outputs"]),
  Q("what-should-i-use", "Should I use a reasoning model for my task?", "reasoning-vs-standard-models"),
  Q("what-should-i-use", "Which alignment method should I use, DPO or PPO?", "dpo-vs-rlhf"),
  Q("what-should-i-use", "What GPU do I need to run a 7B model?", ["gpus-and-ai-accelerators", "quantization", "local-ai"]),
  Q("what-should-i-use", "Which metric should I use for classification?", "evaluation-metrics-for-ai"),
  Q("what-should-i-use", "How do I choose an LLM for my use case?", ["llm-benchmarks-vs-task-evals", "benchmarks-and-leaderboards"]),
  Q("what-should-i-use", "Do I need an agent framework?", ["agent-frameworks-compared", "framework-vs-direct-api", "choosing-an-agent-framework"]),
  Q("what-should-i-use", "Should I fine-tune with LoRA or do full fine-tuning?", "lora-vs-full-fine-tuning"),
  Q("what-should-i-use", "Which fairness metric should I use?", "ai-bias-and-fairness"),
  Q("what-should-i-use", "Which framework should I use for deep learning?", "pytorch"),
  Q("what-should-i-use", "How do I decide between GraphRAG and plain RAG?", ["graph-rag", "rag"]),
  Q("what-should-i-use", "Do I need pgvector or a dedicated vector database?", ["pgvector", "vector-databases", "vector-database-vs-traditional-database"]),
  Q("what-should-i-use", "Which standard should I follow for AI risk management?", ["nist-ai-rmf", "iso-iec-42001", "ai-governance"]),
  Q("what-should-i-use", "Should I use MCP or A2A?", "a2a-vs-mcp"),

  // ---- how-to ----
  Q("how-to", "How do I reduce LLM API costs?", "llm-cost-optimization"),
  Q("how-to", "How do I evaluate a RAG system?", ["rag-evaluation", "ai-evaluation"]),
  Q("how-to", "How do I evaluate an AI agent?", "agent-evaluation"),
  Q("how-to", "How do I force an LLM to output valid JSON?", ["constrained-decoding", "structured-outputs"]),
  Q("how-to", "How do I run an LLM on CPU only?", ["llama-cpp", "local-ai", "quantization"]),
  Q("how-to", "How do I fine-tune a model on one GPU?", "lora-and-peft"),
  Q("how-to", "How do I secure an MCP server?", "mcp-security"),
  Q("how-to", "How do I monitor an LLM application in production?", ["llm-observability", "model-drift-and-monitoring"]),
  Q("how-to", "How do I improve RAG retrieval accuracy?", ["hybrid-search-and-reranking", "chunking", "rag-evaluation"]),
  Q("how-to", "How do I make a robot learn from demonstrations?", "imitation-learning"),
  Q("how-to", "How do I build a knowledge graph for retrieval?", "graph-rag"),
  Q("how-to", "How do I serve an LLM in production?", ["model-serving-and-inference", "vllm"]),
  Q("how-to", "How do I test an AI system for bias?", "ai-bias-and-fairness"),
  Q("how-to", "How do I red-team an LLM app?", "red-teaming"),
  Q("how-to", "How do I extract data from PDFs with AI?", "document-understanding-ai"),
  Q("how-to", "How do I track ML experiments?", ["mlflow", "mlops"]),
  Q("how-to", "How do I comply with the EU AI Act?", "eu-ai-act"),
  Q("how-to", "How do I label AI-generated images?", "c2pa-content-provenance"),
  Q("how-to", "How do I run model-generated code safely?", "code-execution-sandboxing"),
  Q("how-to", "How do I create a company AI policy?", "ai-governance"),
  Q("how-to", "How do I pick a learning rate?", "backpropagation-and-gradient-descent"),
  Q("how-to", "How do I use grammars in llama.cpp?", "gbnf-grammars"),
  Q("how-to", "How do I redact secrets before pasting logs into a chatbot?", ["ai-privacy-and-security", "llm-observability"], "pii-secret-redactor"),
  Q("how-to", "How do I share a trace without leaking customer data?", ["llm-observability", "ai-privacy-and-security"]),

  // ---- negatives / out-of-scope: must NOT yield a solid answer or a tool ----
  Q("negative", "best pizza in Rome", []),
  Q("negative", "how to bake sourdough bread", []),
  Q("negative", "what time is it in Tokyo", []),
  Q("negative", "who won the world cup", []),
  Q("negative", "bitcoin price today", []),
  Q("negative", "how to fix a leaking tap", []),
  Q("negative", "cheap flights to Lisbon", []),
  Q("negative", "NVIDIA stock price", []),
  Q("negative", "which AI model is best today", []),
  Q("negative", "latest ChatGPT release date", []),
  Q("negative", "how many parameters does GPT-6 have", []),
  Q("negative", "is my GPU overheating", []),
  Q("negative", "how to cure a headache", []),
  Q("negative", "write me a poem about autumn", []),
  Q("negative", "weather tomorrow in Berlin", []),
  Q("negative", "movie recommendations", []),
  Q("negative", "how to lose weight", []),
  Q("negative", "what is the capital of Australia", []),
  Q("negative", "learn Spanish quickly", []),
  Q("negative", "tax deadline for freelancers", []),
  Q("negative", "does DPO stand for data protection officer", []),
  Q("negative", "the PRM job role in project management", []),
  Q("negative", "Mamba snake venom", []),
  Q("negative", "transformer toy robots for kids", []),
  Q("negative", "diffusion of innovation theory in marketing", []),
  Q("negative", "ollama llama animal facts", []),
  Q("negative", "kubernetes ingress controller setup", []),
  Q("negative", "how to write a cover letter", []),
  Q("negative", "best running shoes for flat feet", []),
  Q("negative", "how to train for a marathon", [])
];

// Held-out set: written BEFORE lexicon part D was authored and not used while tuning it.
const holdout = [
  Q("holdout", "explain how reasoning LLMs think before answering", ["reasoning-models", "test-time-compute"]),
  Q("holdout", "can I see the hidden thoughts of a reasoning model", ["reasoning-transparency"]),
  Q("holdout", "difference between scaling model size and scaling inference compute", ["test-time-compute", "scaling-laws"]),
  Q("holdout", "grade each step of a model's maths solution", ["process-reward-model"]),
  Q("holdout", "sample several answers and pick the majority", ["self-consistency"]),
  Q("holdout", "pick the best of several generated answers with a verifier", ["best-of-n-sampling"]),
  Q("holdout", "make my model output only valid enum values", ["constrained-decoding", "structured-outputs"]),
  Q("holdout", "regex constrained generation for local models", ["grammar-guided-generation", "constrained-decoding"]),
  Q("holdout", "temperature versus top-k and top-p explained", ["sampling-and-decoding"]),
  Q("holdout", "how do language models turn probabilities into words", ["sampling-and-decoding", "large-language-models"]),
  Q("holdout", "robots that follow natural language instructions", ["vision-language-action-models", "embodied-ai"]),
  Q("holdout", "learned simulators for planning", ["world-models"]),
  Q("holdout", "teach a robot arm by showing it examples", ["imitation-learning"]),
  Q("holdout", "domain randomisation for robot training", ["sim-to-real-transfer"]),
  Q("holdout", "are leaderboard scores trustworthy", ["benchmarks-and-leaderboards"]),
  Q("holdout", "did the model train on the test questions", ["benchmark-contamination"]),
  Q("holdout", "using GPT to grade other model outputs", ["llm-as-a-judge"]),
  Q("holdout", "how are Elo ratings for chatbots computed", ["human-preference-evaluation"]),
  Q("holdout", "what does F1 score tell me", ["evaluation-metrics-for-ai"]),
  Q("holdout", "measuring whether an agent completes tasks reliably", ["agent-evaluation"]),
  Q("holdout", "how do agents from different companies talk to each other", ["a2a-protocol", "agent-protocol-landscape"]),
  Q("holdout", "security risks of third party MCP servers", ["mcp-security"]),
  Q("holdout", "overview of agent communication standards", ["agent-protocol-landscape"]),
  Q("holdout", "state machine style orchestration for LLM agents", ["langgraph"]),
  Q("holdout", "automatically optimise my prompts with a metric", ["dspy"]),
  Q("holdout", "self-hosted inference server with high throughput", ["vllm", "model-serving-and-inference"]),
  Q("holdout", "run quantized models on a laptop without a GPU", ["llama-cpp", "ollama", "quantization", "local-ai"]),
  Q("holdout", "export a PyTorch model for mobile and browser", ["onnx-runtime"]),
  Q("holdout", "how do I download Hugging Face models safely", ["hugging-face"]),
  Q("holdout", "predicting protein structure from sequence", ["alphafold"]),
  Q("holdout", "neural networks that obey differential equations", ["physics-informed-neural-networks"]),
  Q("holdout", "machine learning weather forecasting versus numerical models", ["ai-weather-forecasting"]),
  Q("holdout", "how is AI used to find new materials", ["ai-materials-discovery"]),
  Q("holdout", "does AI speed up drug discovery", ["ai-drug-discovery"]),
  Q("holdout", "difference between classification and regression", ["supervised-learning"]),
  Q("holdout", "how do neural networks learn weights", ["backpropagation-and-gradient-descent", "neural-networks"]),
  Q("holdout", "training accuracy high but test accuracy low", ["overfitting-and-regularization"]),
  Q("holdout", "reuse a pretrained model for my small dataset", ["transfer-learning"]),
  Q("holdout", "how do agents learn from rewards", ["reinforcement-learning"]),
  Q("holdout", "why do image models use patches", ["vision-transformers"]),
  Q("holdout", "models with many experts but few active parameters", ["mixture-of-experts"]),
  Q("holdout", "linear time alternative to attention", ["state-space-models"]),
  Q("holdout", "how do text-to-image generators work", ["diffusion-models"]),
  Q("holdout", "why does generation memory grow with context length", ["kv-cache"]),
  Q("holdout", "how to make LLM inference faster without changing outputs", ["speculative-decoding", "flash-attention", "kv-cache"]),
  Q("holdout", "how many tokens should a model be trained on", ["scaling-laws"]),
  Q("holdout", "what is the difference between a base model and a chat model", ["instruction-tuning"]),
  Q("holdout", "train adapters instead of all weights", ["lora-and-peft"]),
  Q("holdout", "shrink a model to 4-bit", ["quantization"]),
  Q("holdout", "models small enough to run on a phone", ["small-language-models", "local-ai"]),
  Q("holdout", "search images using text descriptions", ["contrastive-learning-clip"]),
  Q("holdout", "transcribe meetings automatically", ["speech-ai"]),
  Q("holdout", "pull structured fields out of invoices", ["document-understanding-ai"]),
  Q("holdout", "how do chatbots learn from human ratings", ["rlhf", "preference-optimization"]),
  Q("holdout", "training on chosen and rejected answer pairs", ["dpo", "preference-optimization"]),
  Q("holdout", "model exploits the scoring function instead of doing the task", ["reward-hacking"]),
  Q("holdout", "AI that tells me what I want to hear", ["sycophancy"]),
  Q("holdout", "adversarial testing of chatbots before launch", ["red-teaming"]),
  Q("holdout", "who is accountable for AI decisions in a company", ["ai-governance"]),
  Q("holdout", "which AI systems are banned in Europe", ["eu-ai-act"]),
  Q("holdout", "documentation that describes a model's limits", ["model-cards"]),
  Q("holdout", "tamper-evident labels for AI generated media", ["c2pa-content-provenance"]),
  Q("holdout", "tracking prompts and token spend in production", ["llm-observability", "llm-cost-optimization"]),
  Q("holdout", "keeping the same long system prompt cheap across requests", ["prompt-caching"]),
  Q("holdout", "deciding what information goes into the model context for an agent", ["context-engineering"]),
  Q("holdout", "keyword plus semantic retrieval with rerankers", ["hybrid-search-and-reranking"]),
  Q("holdout", "let an AI operate my browser", ["computer-use-agents"]),
  Q("holdout", "stop a model from reading private files when running code", ["code-execution-sandboxing"]),
  Q("holdout", "how to detect when a model degrades after launch", ["model-drift-and-monitoring"]),
  Q("holdout", "why is a GPU needed for neural networks", ["gpus-and-ai-accelerators"])
];
cases.push(...holdout);

const rows = [];
let bad = 0;
for (const item of cases) {
  for (const id of item.accept) if (!ids.has(id)) { console.error("UNKNOWN accepted id in test:", id, "->", item.q); bad++; }
}
if (bad) process.exit(2);

for (const item of cases) {
  const r = searchKnowledge(index, lexicon, item.q);
  const topId = r.answer?.page.id || null;
  const ranked = r.ranked.map((x) => x.page.id);
  const top5 = ranked.slice(0, 5);
  const learn = r.learnMore.map((x) => x.page.id);
  const tool = r.tools[0]?.id || null;
  let label, fp = "";
  if (item.cat === "negative") {
    if (r.solid) { label = "fail"; fp = "solid answer: " + topId; }
    else if (tool) { label = "fail"; fp = "tool shown: " + tool; }
    else label = "pass";
  } else {
    const hitTop = r.solid && item.accept.includes(topId);
    const hitNear = top5.some((id) => item.accept.includes(id)) || learn.some((id) => item.accept.includes(id));
    if (hitTop) label = "pass"; else if (hitNear) label = "weak"; else label = "miss";
    if (r.solid && !item.accept.includes(topId)) fp = "confident wrong page: " + topId;
    if (tool && tool !== item.tool) fp = (fp ? fp + "; " : "") + "unexpected tool: " + tool;
    if (item.tool && tool !== item.tool && label === "pass") label = "weak";
  }
  rows.push({ ...item, label, topId, topScore: r.answer?.score ?? r.ranked[0]?.score ?? 0, top5, tool, fp, solid: r.solid, gap: r.gap?.id || "" });
}

const pos = rows.filter((r) => r.cat !== "negative");
const tuned = pos.filter((r) => r.cat !== "holdout");
const held = pos.filter((r) => r.cat === "holdout");
const neg = rows.filter((r) => r.cat === "negative");
const count = (arr, l) => arr.filter((r) => r.label === l).length;
const cats = [...new Set(rows.map((r) => r.cat))];
const lines = [];
lines.push("# AI Knowledge V3 — query test report", "");
lines.push("Run: `node tests/knowledge-ai-v3-queries.mjs`. Uses the unmodified search core and the committed index/lexicon. The solid-match threshold (`minSolidScore`) was not changed.", "");
lines.push("Labels are computed from the rules in the test file header, not assigned by hand. Accepted pages per query were fixed before the final run.", "");
lines.push(`Positive queries: ${pos.length} · pass ${count(pos, "pass")} · weak ${count(pos, "weak")} · miss ${count(pos, "miss")}`);
lines.push(`  - tuning set (lexicon part D was authored after seeing its baseline failures): ${tuned.length} · pass ${count(tuned, "pass")} · weak ${count(tuned, "weak")} · miss ${count(tuned, "miss")}`);
lines.push(`  - held-out set (written before part D, not used while tuning; same author, so not a fully independent estimate): ${held.length} · pass ${count(held, "pass")} · weak ${count(held, "weak")} · miss ${count(held, "miss")}`);
lines.push(`Negative (out-of-scope / ambiguous-acronym) queries: ${neg.length} · pass ${count(neg, "pass")} · false positives ${count(neg, "fail")}`);
lines.push(`Positive queries with a false positive (confident wrong page or unexpected tool): ${pos.filter((r) => r.fp).length}`, "");
lines.push("| Category | Queries | Pass | Weak | Miss | False positives |", "| --- | --- | --- | --- | --- | --- |");
for (const c of cats) {
  const s = rows.filter((r) => r.cat === c);
  lines.push(`| ${c} | ${s.length} | ${count(s, "pass")} | ${count(s, "weak")} | ${count(s, "miss")} | ${s.filter((r) => r.fp).length} |`);
}
lines.push("", "## Misses");
for (const r of pos.filter((x) => x.label === "miss")) lines.push(`- [${r.cat}] ${r.q} — expected ${r.accept.join(" | ")}; top5: ${r.top5.join(", ") || "(none)"}${r.fp ? " — FP: " + r.fp : ""}`);
lines.push("", "## Weak");
for (const r of pos.filter((x) => x.label === "weak")) lines.push(`- [${r.cat}] ${r.q} — expected ${r.accept.join(" | ")}; solid: ${r.solid ? r.topId : "no"}; top5: ${r.top5.join(", ")}${r.fp ? " — FP: " + r.fp : ""}`);
lines.push("", "## False positives");
for (const r of rows.filter((x) => x.fp)) lines.push(`- [${r.cat}] ${r.q} — ${r.fp}`);
lines.push("", "## Search-gap notes (existing lexicon rules, not changed)");
for (const r of rows.filter((x) => x.gap)) lines.push(`- ${r.q} → gap rule \`${r.gap}\` fired (solid: ${r.solid ? r.topId : "no"})`);
lines.push("", "## All results", "| Label | Cat | Query | Top | Score | Solid | Tool |", "| --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) lines.push(`| ${r.label} | ${r.cat} | ${r.q.replaceAll("|", "/")} | ${r.topId || r.top5[0] || "—"} | ${r.topScore} | ${r.solid ? "yes" : "no"} | ${r.tool || "—"} |`);
const report = lines.join("\n") + "\n";
writeFileSync(new URL("../knowledge/AI-V3-QUERY-REPORT.md", import.meta.url), report);
console.log(lines.slice(0, 18).join("\n"));
console.log(`total queries: ${rows.length}`);
