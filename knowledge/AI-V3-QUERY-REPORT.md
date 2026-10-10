# AI Knowledge V3 — query test report

Run: `node tests/knowledge-ai-v3-queries.mjs`. Uses the unmodified search core and the committed index/lexicon. The solid-match threshold (`minSolidScore`) was not changed.

Labels are computed from the rules in the test file header, not assigned by hand. Accepted pages per query were fixed before the final run.

Positive queries: 328 · pass 320 · weak 8 · miss 0
  - tuning set (lexicon part D was authored after seeing its baseline failures): 258 · pass 252 · weak 6 · miss 0
  - held-out set (written before part D, not used while tuning; same author, so not a fully independent estimate): 70 · pass 68 · weak 2 · miss 0
Negative (out-of-scope / ambiguous-acronym) queries: 30 · pass 29 · false positives 1
Positive queries with a false positive (confident wrong page or unexpected tool): 7

| Category | Queries | Pass | Weak | Miss | False positives |
| --- | --- | --- | --- | --- | --- |
| definition | 103 | 103 | 0 | 0 | 0 |
| acronym | 41 | 39 | 2 | 0 | 2 |
| comparison | 24 | 21 | 3 | 0 | 3 |
| troubleshooting | 24 | 24 | 0 | 0 | 0 |
| architecture | 24 | 24 | 0 | 0 | 0 |
| what-should-i-use | 18 | 17 | 1 | 0 | 1 |
| how-to | 24 | 24 | 0 | 0 | 0 |
| negative | 30 | 29 | 0 | 0 | 1 |
| holdout | 70 | 68 | 2 | 0 | 1 |

## Misses

## Weak
- [acronym] CNN deep learning — expected convolutional-neural-networks; solid: deep-learning; top5: deep-learning, convolutional-neural-networks, deep-q-networks, reinforcement-learning, supervised-learning — FP: confident wrong page: deep-learning
- [acronym] PPO reinforcement learning — expected proximal-policy-optimization; solid: reinforcement-learning; top5: reinforcement-learning, proximal-policy-optimization, reinforcement-learning-for-reasoning, deep-learning, rlhf — FP: confident wrong page: reinforcement-learning
- [comparison] Is DPO reinforcement learning? — expected dpo | preference-optimization | dpo-vs-rlhf; solid: reinforcement-learning; top5: reinforcement-learning, dpo, dpo-vs-rlhf, preference-optimization, reinforcement-learning-for-reasoning — FP: confident wrong page: reinforcement-learning
- [comparison] Ollama vs vLLM vs llama.cpp — expected local-runtimes-compared; solid: llama-cpp; top5: llama-cpp, local-runtimes-compared, ollama, vllm, local-llm-runtimes — FP: confident wrong page: llama-cpp
- [comparison] LangGraph vs CrewAI vs AutoGen — expected agent-frameworks-compared; solid: crewai; top5: crewai, agent-frameworks-compared, langgraph, autogen, migrate-to-microsoft-agent-framework — FP: confident wrong page: crewai
- [what-should-i-use] Which framework should I use for deep learning? — expected pytorch; solid: deep-learning; top5: deep-learning, pytorch, deep-q-networks, choosing-an-agent-framework, reinforcement-learning — FP: confident wrong page: deep-learning
- [holdout] predicting protein structure from sequence — expected alphafold; solid: no; top5: alphafold, recurrent-neural-networks, unsupervised-learning, ai-drug-discovery, state-space-models
- [holdout] why is a GPU needed for neural networks — expected gpus-and-ai-accelerators; solid: neural-networks; top5: neural-networks, gpus-and-ai-accelerators, physics-informed-neural-networks, graph-neural-networks, convolutional-neural-networks — FP: confident wrong page: neural-networks

## False positives
- [acronym] CNN deep learning — confident wrong page: deep-learning
- [acronym] PPO reinforcement learning — confident wrong page: reinforcement-learning
- [comparison] Is DPO reinforcement learning? — confident wrong page: reinforcement-learning
- [comparison] Ollama vs vLLM vs llama.cpp — confident wrong page: llama-cpp
- [comparison] LangGraph vs CrewAI vs AutoGen — confident wrong page: crewai
- [what-should-i-use] Which framework should I use for deep learning? — confident wrong page: deep-learning
- [negative] ollama llama animal facts — solid answer: ollama
- [holdout] why is a GPU needed for neural networks — confident wrong page: neural-networks

## Search-gap notes (existing lexicon rules, not changed)
- does DPO stand for data protection officer → gap rule `v3-not-ai-context` fired (solid: no)
- the PRM job role in project management → gap rule `v3-not-ai-context` fired (solid: no)
- Mamba snake venom → gap rule `v3-not-ai-context` fired (solid: no)
- transformer toy robots for kids → gap rule `v3-not-ai-context` fired (solid: no)
- ollama llama animal facts → gap rule `v3-not-ai-context` fired (solid: ollama)

## All results
| Label | Cat | Query | Top | Score | Solid | Tool |
| --- | --- | --- | --- | --- | --- | --- |
| pass | definition | What is test-time compute? | test-time-compute | 124 | yes | — |
| pass | definition | What is a reasoning model? | reasoning-models | 90 | yes | — |
| pass | definition | What is chain-of-thought prompting? | chain-of-thought | 119 | yes | — |
| pass | definition | What is self-consistency in LLMs? | self-consistency | 102 | yes | — |
| pass | definition | What is best-of-N sampling? | best-of-n-sampling | 136 | yes | — |
| pass | definition | What is Tree of Thoughts? | search-over-reasoning | 93 | yes | — |
| pass | definition | What is a process reward model? | process-reward-model | 114 | yes | — |
| pass | definition | What is an outcome reward model? | outcome-reward-model | 112 | yes | — |
| pass | definition | What is a thinking budget? | thinking-budgets | 93 | yes | — |
| pass | definition | What is constrained decoding? | constrained-decoding | 106 | yes | — |
| pass | definition | What is structured output from an LLM? | structured-outputs | 80 | yes | — |
| pass | definition | What is grammar-guided generation? | grammar-guided-generation | 90 | yes | — |
| pass | definition | What is GBNF? | gbnf-grammars | 85 | yes | — |
| pass | definition | What is JSON Schema? | json-schema | 114 | yes | — |
| pass | definition | What is temperature in an LLM? | sampling-and-decoding | 74 | yes | — |
| pass | definition | What is top-p sampling? | sampling-and-decoding | 66 | yes | — |
| pass | definition | What is a vision-language-action model? | vision-language-action-models | 122 | yes | — |
| pass | definition | What is a world model in AI? | world-models | 99 | yes | — |
| pass | definition | What is embodied AI? | embodied-ai | 114 | yes | — |
| pass | definition | What is imitation learning? | imitation-learning | 84 | yes | — |
| pass | definition | What is sim-to-real transfer? | sim-to-real-transfer | 131 | yes | — |
| pass | definition | What are AI benchmarks? | benchmarks-and-leaderboards | 71 | yes | — |
| pass | definition | What is benchmark contamination? | benchmark-contamination | 88 | yes | — |
| pass | definition | What is LLM-as-a-judge? | llm-as-a-judge | 124 | yes | — |
| pass | definition | What is MMLU? | mmlu | 87 | yes | — |
| pass | definition | What is HumanEval? | humaneval | 79 | yes | — |
| pass | definition | What is SWE-bench? | swe-bench | 102 | yes | — |
| pass | definition | What is GSM8K? | gsm8k-and-math-benchmarks | 79 | yes | — |
| pass | definition | What is the A2A protocol? | a2a-protocol | 99 | yes | — |
| pass | definition | What is an agent card? | a2a-protocol | 68 | yes | — |
| pass | definition | What is LangGraph? | langgraph | 96 | yes | — |
| pass | definition | What is DSPy? | dspy | 92 | yes | — |
| pass | definition | What is CrewAI? | crewai | 96 | yes | — |
| pass | definition | What is Semantic Kernel? | semantic-kernel | 134 | yes | — |
| pass | definition | What is vLLM? | vllm | 100 | yes | — |
| pass | definition | What is llama.cpp? | llama-cpp | 128 | yes | — |
| pass | definition | What is Ollama? | ollama | 102 | yes | — |
| pass | definition | What is ONNX Runtime? | onnx-runtime | 119 | yes | — |
| pass | definition | What is PyTorch? | pytorch | 88 | yes | — |
| pass | definition | What is AlphaFold? | alphafold | 85 | yes | — |
| pass | definition | What is a physics-informed neural network? | physics-informed-neural-networks | 120 | yes | — |
| pass | definition | What is AI for science? | ai-for-science | 92 | yes | — |
| pass | definition | What is supervised learning? | supervised-learning | 100 | yes | — |
| pass | definition | What is unsupervised learning? | unsupervised-learning | 94 | yes | — |
| pass | definition | What is self-supervised learning? | self-supervised-learning | 124 | yes | — |
| pass | definition | What is a neural network? | neural-networks | 69 | yes | — |
| pass | definition | What is deep learning? | deep-learning | 112 | yes | — |
| pass | definition | What is backpropagation? | backpropagation-and-gradient-descent | 68 | yes | — |
| pass | definition | What is overfitting? | overfitting-and-regularization | 79 | yes | — |
| pass | definition | What is transfer learning? | transfer-learning | 88 | yes | — |
| pass | definition | What is reinforcement learning? | reinforcement-learning | 102 | yes | — |
| pass | definition | What is a Markov decision process? | markov-decision-processes | 85 | yes | — |
| pass | definition | What is a convolutional neural network? | convolutional-neural-networks | 86 | yes | — |
| pass | definition | What is an LSTM? | recurrent-neural-networks | 55 | yes | — |
| pass | definition | What is a Vision Transformer? | vision-transformers | 85 | yes | — |
| pass | definition | What is a mixture of experts model? | mixture-of-experts | 90 | yes | — |
| pass | definition | What is a state space model? | state-space-models | 90 | yes | — |
| pass | definition | What is a diffusion model? | diffusion-models | 88 | yes | — |
| pass | definition | What is a GAN? | generative-adversarial-networks | 71 | yes | — |
| pass | definition | What is a variational autoencoder? | variational-autoencoders | 87 | yes | — |
| pass | definition | What is a graph neural network? | graph-neural-networks | 96 | yes | — |
| pass | definition | What is a KV cache? | kv-cache | 90 | yes | — |
| pass | definition | What is FlashAttention? | flash-attention | 87 | yes | — |
| pass | definition | What is positional encoding? | positional-encoding | 65 | yes | — |
| pass | definition | What are scaling laws in AI? | scaling-laws | 116 | yes | — |
| pass | definition | What is instruction tuning? | instruction-tuning | 100 | yes | — |
| pass | definition | What is LoRA? | lora-and-peft | 81 | yes | — |
| pass | definition | What is model quantization? | quantization | 73 | yes | — |
| pass | definition | What is knowledge distillation? | knowledge-distillation | 101 | yes | — |
| pass | definition | What is speculative decoding? | speculative-decoding | 114 | yes | — |
| pass | definition | What is a small language model? | small-language-models | 102 | yes | — |
| pass | definition | What does open weights mean? | open-weights-models | 104 | yes | — |
| pass | definition | What is a vision-language model? | vision-language-models | 103 | yes | — |
| pass | definition | What is CLIP? | contrastive-learning-clip | 45 | yes | — |
| pass | definition | What is speech recognition AI? | speech-ai | 107 | yes | — |
| pass | definition | What is document AI? | document-understanding-ai | 83 | yes | — |
| pass | definition | What is AI alignment? | ai-alignment | 111 | yes | — |
| pass | definition | What is preference optimization? | preference-optimization | 105 | yes | — |
| pass | definition | What is DPO? | dpo | 91 | yes | — |
| pass | definition | What is RLHF? | rlhf | 79 | yes | — |
| pass | definition | What is Constitutional AI? | constitutional-ai-and-rlaif | 106 | yes | — |
| pass | definition | What is reward hacking? | reward-hacking | 108 | yes | — |
| pass | definition | What is sycophancy in AI? | sycophancy | 97 | yes | — |
| pass | definition | What is AI red teaming? | red-teaming | 114 | yes | — |
| pass | definition | What are AI guardrails? | ai-guardrails | 113 | yes | — |
| pass | definition | What is mechanistic interpretability? | mechanistic-interpretability | 115 | yes | — |
| pass | definition | What is AI governance? | ai-governance | 126 | yes | — |
| pass | definition | What is the EU AI Act? | eu-ai-act | 119 | yes | — |
| pass | definition | What is the NIST AI RMF? | nist-ai-rmf | 121 | yes | — |
| pass | definition | What is ISO 42001? | iso-iec-42001 | 102 | yes | — |
| pass | definition | What is a model card? | model-cards | 98 | yes | — |
| pass | definition | What is C2PA? | c2pa-content-provenance | 91 | yes | — |
| pass | definition | What is the OWASP Top 10 for LLM applications? | owasp-llm-top-10 | 125 | yes | — |
| pass | definition | What is MLOps? | mlops | 79 | yes | — |
| pass | definition | What is prompt caching? | prompt-caching | 118 | yes | — |
| pass | definition | What is context engineering? | context-engineering | 124 | yes | — |
| pass | definition | What is MLflow? | mlflow | 92 | yes | — |
| pass | definition | What is pgvector? | pgvector | 85 | yes | — |
| pass | definition | What is GraphRAG? | graph-rag | 86 | yes | — |
| pass | definition | What is agentic RAG? | agentic-rag | 98 | yes | — |
| pass | definition | What is hybrid search? | hybrid-search-and-reranking | 100 | yes | — |
| pass | definition | What is the ReAct pattern? | react-agent-pattern | 88 | yes | — |
| pass | definition | What are computer-use agents? | computer-use-agents | 102 | yes | — |
| pass | acronym | PRM meaning AI | process-reward-model | 23 | yes | — |
| pass | acronym | ORM reward model | outcome-reward-model | 59 | yes | — |
| pass | acronym | VLA robotics | vision-language-action-models | 60 | yes | — |
| pass | acronym | MoE LLM | mixture-of-experts | 61 | yes | — |
| pass | acronym | SSM Mamba | state-space-models | 71 | yes | — |
| pass | acronym | ViT vision | vision-transformers | 73 | yes | — |
| weak | acronym | CNN deep learning | deep-learning | 100 | yes | — |
| pass | acronym | GNN machine learning | graph-neural-networks | 51 | yes | — |
| pass | acronym | VAE latent space | variational-autoencoders | 62 | yes | — |
| weak | acronym | PPO reinforcement learning | reinforcement-learning | 90 | yes | — |
| pass | acronym | DQN Q-learning | deep-q-networks | 69 | yes | — |
| pass | acronym | GRPO | reinforcement-learning-for-reasoning | 62 | yes | — |
| pass | acronym | RLVR | reinforcement-learning-for-reasoning | 63 | yes | — |
| pass | acronym | KTO IPO ORPO SimPO | preference-optimization | 51 | yes | — |
| pass | acronym | RLAIF | constitutional-ai-and-rlaif | 69 | yes | — |
| pass | acronym | LoRA QLoRA PEFT | lora-and-peft | 85 | yes | — |
| pass | acronym | GGUF | llama-cpp | 66 | yes | — |
| pass | acronym | GPTQ AWQ | quantization | 55 | yes | — |
| pass | acronym | RoPE rotary embeddings | positional-encoding | 70 | yes | — |
| pass | acronym | GQA grouped query attention | kv-cache | 62 | yes | — |
| pass | acronym | SLM | small-language-models | 51 | yes | — |
| pass | acronym | VLM | vision-language-models | 51 | yes | — |
| pass | acronym | ASR TTS | speech-ai | 59 | yes | — |
| pass | acronym | OCR document extraction | document-understanding-ai | 80 | yes | — |
| pass | acronym | PINN | physics-informed-neural-networks | 53 | yes | — |
| pass | acronym | SciML | ai-for-science | 51 | yes | — |
| pass | acronym | GPAI obligations | eu-ai-act | 41 | yes | — |
| pass | acronym | AIMS management system | iso-iec-42001 | 43 | yes | — |
| pass | acronym | TTFT | model-serving-and-inference | 51 | yes | — |
| pass | acronym | FSDP ZeRO | distributed-training | 57 | yes | — |
| pass | acronym | HBM VRAM | gpus-and-ai-accelerators | 55 | yes | — |
| pass | acronym | CoT | chain-of-thought | 47 | yes | — |
| pass | acronym | ToT MCTS LLM | search-over-reasoning | 57 | yes | — |
| pass | acronym | BoN | best-of-n-sampling | 59 | yes | — |
| pass | acronym | RRF BM25 | hybrid-search-and-reranking | 57 | yes | — |
| pass | acronym | WER | speech-ai | 51 | yes | — |
| pass | acronym | pass@k | humaneval | 57 | yes | — |
| pass | acronym | LLM01 | owasp-llm-top-10 | 40 | yes | — |
| pass | acronym | SFT | instruction-tuning | 55 | yes | — |
| pass | acronym | MDP POMDP | markov-decision-processes | 55 | yes | — |
| pass | acronym | GBNF | gbnf-grammars | 73 | yes | — |
| pass | comparison | PRM vs ORM | prm-vs-orm | 95 | yes | — |
| pass | comparison | DPO vs RLHF | dpo-vs-rlhf | 150 | yes | — |
| pass | comparison | DPO vs PPO | dpo-vs-rlhf | 83 | yes | — |
| weak | comparison | Is DPO reinforcement learning? | reinforcement-learning | 90 | yes | — |
| pass | comparison | A2A vs MCP | a2a-vs-mcp | 160 | yes | — |
| weak | comparison | Ollama vs vLLM vs llama.cpp | llama-cpp | 116 | yes | — |
| weak | comparison | LangGraph vs CrewAI vs AutoGen | crewai | 93 | yes | — |
| pass | comparison | CNN vs Vision Transformer | cnn-vs-vision-transformer | 144 | yes | — |
| pass | comparison | Mamba vs transformer | transformers-vs-state-space-models | 81 | yes | — |
| pass | comparison | LoRA vs full fine-tuning | lora-vs-full-fine-tuning | 186 | yes | — |
| pass | comparison | Reasoning model vs regular LLM | reasoning-vs-standard-models | 112 | yes | — |
| pass | comparison | JSON mode vs structured outputs | structured-output-methods-compared | 114 | yes | — |
| pass | comparison | BERT vs GPT | encoder-decoder-vs-decoder-only | 75 | yes | — |
| pass | comparison | GAN vs diffusion model | diffusion-models | 98 | yes | — |
| pass | comparison | benchmarks vs custom evals | llm-benchmarks-vs-task-evals | 101 | yes | — |
| pass | comparison | supervised vs unsupervised learning | unsupervised-learning | 108 | yes | — |
| pass | comparison | process supervision vs outcome supervision | prm-vs-orm | 85 | yes | — |
| pass | comparison | pgvector vs vector database | pgvector | 100 | yes | — |
| pass | comparison | open source vs closed LLMs | open-weights-models | 104 | yes | — |
| pass | comparison | quantization vs distillation | knowledge-distillation | 78 | yes | — |
| pass | comparison | PPO vs DQN | proximal-policy-optimization | 84 | yes | — |
| pass | comparison | NIST AI RMF vs ISO 42001 | nist-ai-rmf | 129 | yes | — |
| pass | comparison | LangChain vs LlamaIndex | llamaindex | 98 | yes | — |
| pass | comparison | MCP vs A2A vs function calling | a2a-vs-mcp | 105 | yes | — |
| pass | troubleshooting | Why does my reasoning model answer get cut off? | reasoning-models | 98 | yes | — |
| pass | troubleshooting | Why is my LLM returning invalid JSON? | structured-outputs | 75 | yes | json-formatter |
| pass | troubleshooting | Why does my DPO training make outputs longer? | dpo | 80 | yes | — |
| pass | troubleshooting | Why is my loss NaN? | backpropagation-and-gradient-descent | 51 | yes | — |
| pass | troubleshooting | Why does my model overfit? | overfitting-and-regularization | 61 | yes | — |
| pass | troubleshooting | Why did my model get worse over time? | model-drift-and-monitoring | 89 | yes | — |
| pass | troubleshooting | CUDA out of memory when serving an LLM | gpus-and-ai-accelerators | 86 | yes | — |
| pass | troubleshooting | Why is my prompt cache not hitting? | prompt-caching | 105 | yes | — |
| pass | troubleshooting | Why does my LLM repeat itself? | sampling-and-decoding | 52 | yes | — |
| pass | troubleshooting | Why does ChatGPT agree with everything I say? | sycophancy | 80 | yes | — |
| pass | troubleshooting | My robot policy works in simulation but fails on the real robot | sim-to-real-transfer | 82 | yes | — |
| pass | troubleshooting | Agent keeps looping forever | react-agent-pattern | 58 | yes | — |
| pass | troubleshooting | Why do reasoning models cost more? | reasoning-models | 161 | yes | — |
| pass | troubleshooting | Why is my RAG retrieval returning wrong passages? | rag-evaluation | 72 | yes | — |
| pass | troubleshooting | Why do VLMs hallucinate objects in images? | vision-language-models | 80 | yes | — |
| pass | troubleshooting | Quality dropped after quantizing my model | quantization | 57 | yes | — |
| pass | troubleshooting | LangChain code broke after upgrading | langchain | 93 | yes | — |
| pass | troubleshooting | Why do my LLM evaluation scores not reproduce? | ai-evaluation | 42 | yes | — |
| pass | troubleshooting | LoRA adapter barely changes the model behaviour | lora-and-peft | 90 | yes | — |
| pass | troubleshooting | Model scores high on benchmarks but fails in my product | benchmarks-and-leaderboards | 86 | yes | — |
| pass | troubleshooting | MCP server asked for too many permissions | mcp-security | 97 | yes | — |
| pass | troubleshooting | Training on multiple GPUs scales poorly | distributed-training | 65 | yes | — |
| pass | troubleshooting | LLM judge prefers longer answers | llm-as-a-judge | 110 | yes | — |
| pass | troubleshooting | Ollama connection refused | ollama | 110 | yes | — |
| pass | architecture | How do transformers handle token order? | positional-encoding | 63 | yes | — |
| pass | architecture | How does Stable Diffusion work? | diffusion-models | 76 | yes | — |
| pass | architecture | How do reasoning models use extra compute at inference? | reasoning-models | 120 | yes | — |
| pass | architecture | How does constrained decoding guarantee valid JSON? | constrained-decoding | 115 | yes | — |
| pass | architecture | How does AlphaFold predict protein structures? | alphafold | 85 | yes | — |
| pass | architecture | How does GraphCast forecast weather? | ai-weather-forecasting | 81 | yes | — |
| pass | architecture | How does speculative decoding speed up LLMs? | speculative-decoding | 112 | yes | — |
| pass | architecture | How does PagedAttention work? | vllm | 58 | yes | — |
| pass | architecture | How does continuous batching work? | vllm | 60 | yes | — |
| pass | architecture | How does a multi-agent system use A2A and MCP together? | a2a-vs-mcp | 120 | yes | — |
| pass | architecture | How do VLA models turn images and text into robot actions? | vision-language-action-models | 86 | yes | — |
| pass | architecture | How does DPO work mathematically? | dpo | 39 | yes | — |
| pass | architecture | How does RLHF use a reward model? | rlhf | 77 | yes | — |
| pass | architecture | How do mixture-of-experts models route tokens? | mixture-of-experts | 108 | yes | — |
| pass | architecture | How does LoRA reduce memory for fine-tuning? | lora-and-peft | 105 | yes | — |
| pass | architecture | How do CLIP embeddings align images and text? | contrastive-learning-clip | 100 | yes | — |
| pass | architecture | How does self-attention differ from recurrence? | transformers | 50 | yes | — |
| pass | architecture | How is a RAG system evaluated end to end? | rag-evaluation | 87 | yes | — |
| pass | architecture | How do AI agents plan multi-step tasks? | agent-planning | 100 | yes | — |
| pass | architecture | How does GraphRAG build a knowledge graph? | graph-rag | 115 | yes | — |
| pass | architecture | How does a code interpreter sandbox run model-generated code safely? | code-execution-sandboxing | 115 | yes | — |
| pass | architecture | How does C2PA content credentials signing work? | c2pa-content-provenance | 105 | yes | — |
| pass | architecture | How does world model planning work in Dreamer? | world-models | 88 | yes | — |
| pass | architecture | How does FSDP shard a model across GPUs? | distributed-training | 63 | yes | — |
| pass | what-should-i-use | Which agent framework should I use? | agent-frameworks-compared | 99 | yes | — |
| pass | what-should-i-use | What should I use to run an LLM locally on a Mac? | local-ai | 80 | yes | — |
| pass | what-should-i-use | Which runtime should I use to serve an open model to many users? | local-runtimes-compared | 74 | yes | — |
| pass | what-should-i-use | Which vision backbone should I use for small datasets? | cnn-vs-vision-transformer | 72 | yes | — |
| pass | what-should-i-use | What is the best way to get structured JSON from a model? | structured-output-methods-compared | 112 | yes | — |
| pass | what-should-i-use | Should I use a reasoning model for my task? | reasoning-vs-standard-models | 111 | yes | — |
| pass | what-should-i-use | Which alignment method should I use, DPO or PPO? | dpo-vs-rlhf | 100 | yes | — |
| pass | what-should-i-use | What GPU do I need to run a 7B model? | gpus-and-ai-accelerators | 79 | yes | — |
| pass | what-should-i-use | Which metric should I use for classification? | evaluation-metrics-for-ai | 49 | yes | — |
| pass | what-should-i-use | How do I choose an LLM for my use case? | llm-benchmarks-vs-task-evals | 79 | yes | — |
| pass | what-should-i-use | Do I need an agent framework? | agent-frameworks-compared | 105 | yes | — |
| pass | what-should-i-use | Should I fine-tune with LoRA or do full fine-tuning? | lora-vs-full-fine-tuning | 146 | yes | — |
| pass | what-should-i-use | Which fairness metric should I use? | ai-bias-and-fairness | 78 | yes | — |
| weak | what-should-i-use | Which framework should I use for deep learning? | deep-learning | 100 | yes | — |
| pass | what-should-i-use | How do I decide between GraphRAG and plain RAG? | graph-rag | 79 | yes | — |
| pass | what-should-i-use | Do I need pgvector or a dedicated vector database? | pgvector | 100 | yes | — |
| pass | what-should-i-use | Which standard should I follow for AI risk management? | ai-governance | 103 | yes | — |
| pass | what-should-i-use | Should I use MCP or A2A? | a2a-vs-mcp | 123 | yes | — |
| pass | how-to | How do I reduce LLM API costs? | llm-cost-optimization | 57 | yes | — |
| pass | how-to | How do I evaluate a RAG system? | rag-evaluation | 102 | yes | — |
| pass | how-to | How do I evaluate an AI agent? | agent-evaluation | 89 | yes | — |
| pass | how-to | How do I force an LLM to output valid JSON? | structured-outputs | 109 | yes | — |
| pass | how-to | How do I run an LLM on CPU only? | llama-cpp | 56 | yes | — |
| pass | how-to | How do I fine-tune a model on one GPU? | lora-and-peft | 77 | yes | — |
| pass | how-to | How do I secure an MCP server? | mcp-security | 115 | yes | — |
| pass | how-to | How do I monitor an LLM application in production? | llm-observability | 111 | yes | — |
| pass | how-to | How do I improve RAG retrieval accuracy? | hybrid-search-and-reranking | 70 | yes | — |
| pass | how-to | How do I make a robot learn from demonstrations? | imitation-learning | 66 | yes | — |
| pass | how-to | How do I build a knowledge graph for retrieval? | graph-rag | 127 | yes | — |
| pass | how-to | How do I serve an LLM in production? | model-serving-and-inference | 72 | yes | — |
| pass | how-to | How do I test an AI system for bias? | ai-bias-and-fairness | 97 | yes | — |
| pass | how-to | How do I red-team an LLM app? | red-teaming | 98 | yes | — |
| pass | how-to | How do I extract data from PDFs with AI? | document-understanding-ai | 105 | yes | — |
| pass | how-to | How do I track ML experiments? | mlflow | 62 | yes | — |
| pass | how-to | How do I comply with the EU AI Act? | eu-ai-act | 107 | yes | — |
| pass | how-to | How do I label AI-generated images? | c2pa-content-provenance | 86 | yes | — |
| pass | how-to | How do I run model-generated code safely? | code-execution-sandboxing | 101 | yes | — |
| pass | how-to | How do I create a company AI policy? | ai-governance | 76 | yes | — |
| pass | how-to | How do I pick a learning rate? | backpropagation-and-gradient-descent | 74 | yes | — |
| pass | how-to | How do I use grammars in llama.cpp? | gbnf-grammars | 127 | yes | — |
| pass | how-to | How do I redact secrets before pasting logs into a chatbot? | ai-privacy-and-security | 48 | yes | pii-secret-redactor |
| pass | how-to | How do I share a trace without leaking customer data? | ai-privacy-and-security | 55 | yes | — |
| pass | negative | best pizza in Rome | best-of-n-sampling | 28 | no | — |
| pass | negative | how to bake sourdough bread | cnn-vs-vision-transformer | 1 | no | — |
| pass | negative | what time is it in Tokyo | test-time-compute | 26 | no | — |
| pass | negative | who won the world cup | world-models | 26 | no | — |
| pass | negative | bitcoin price today | — | 0 | no | — |
| pass | negative | how to fix a leaking tap | common-prompting-mistakes | 8 | no | — |
| pass | negative | cheap flights to Lisbon | — | 0 | no | — |
| pass | negative | NVIDIA stock price | nvidia-cosmos | 24 | no | — |
| pass | negative | which AI model is best today | ai-governance | 54 | no | — |
| pass | negative | latest ChatGPT release date | large-language-models | 57 | no | — |
| pass | negative | how many parameters does GPT-6 have | large-language-models | 69 | no | — |
| pass | negative | is my GPU overheating | gpus-and-ai-accelerators | 12 | no | — |
| pass | negative | how to cure a headache | — | 0 | no | — |
| pass | negative | write me a poem about autumn | prompt-engineering | 14 | no | — |
| pass | negative | weather tomorrow in Berlin | ai-weather-forecasting | 28 | no | — |
| pass | negative | movie recommendations | — | 0 | no | — |
| pass | negative | how to lose weight | overfitting-and-regularization | 6 | no | — |
| pass | negative | what is the capital of Australia | — | 0 | no | — |
| pass | negative | learn Spanish quickly | evaluation-metrics-for-ai | 4 | no | — |
| pass | negative | tax deadline for freelancers | — | 0 | no | — |
| pass | negative | does DPO stand for data protection officer | dpo | 39 | no | — |
| pass | negative | the PRM job role in project management | process-reward-model | 23 | no | — |
| pass | negative | Mamba snake venom | state-space-models | 31 | no | — |
| pass | negative | transformer toy robots for kids | transformers | 50 | no | — |
| pass | negative | diffusion of innovation theory in marketing | diffusion-models | 34 | no | — |
| fail | negative | ollama llama animal facts | ollama | 94 | yes | — |
| pass | negative | kubernetes ingress controller setup | mcp-servers-and-clients | 6 | no | — |
| pass | negative | how to write a cover letter | prompt-engineering | 14 | no | — |
| pass | negative | best running shoes for flat feet | best-of-n-sampling | 28 | no | — |
| pass | negative | how to train for a marathon | distributed-training | 6 | no | — |
| pass | holdout | explain how reasoning LLMs think before answering | reasoning-models | 74 | yes | — |
| pass | holdout | can I see the hidden thoughts of a reasoning model | reasoning-transparency | 81 | yes | — |
| pass | holdout | difference between scaling model size and scaling inference compute | test-time-compute | 123 | yes | — |
| pass | holdout | grade each step of a model's maths solution | process-reward-model | 68 | yes | — |
| pass | holdout | sample several answers and pick the majority | self-consistency | 63 | yes | — |
| pass | holdout | pick the best of several generated answers with a verifier | best-of-n-sampling | 71 | yes | — |
| pass | holdout | make my model output only valid enum values | constrained-decoding | 67 | yes | — |
| pass | holdout | regex constrained generation for local models | constrained-decoding | 86 | yes | — |
| pass | holdout | temperature versus top-k and top-p explained | sampling-and-decoding | 65 | yes | — |
| pass | holdout | how do language models turn probabilities into words | sampling-and-decoding | 46 | yes | — |
| pass | holdout | robots that follow natural language instructions | vision-language-action-models | 65 | yes | — |
| pass | holdout | learned simulators for planning | world-models | 42 | yes | — |
| pass | holdout | teach a robot arm by showing it examples | imitation-learning | 49 | yes | — |
| pass | holdout | domain randomisation for robot training | sim-to-real-transfer | 65 | yes | — |
| pass | holdout | are leaderboard scores trustworthy | benchmarks-and-leaderboards | 42 | yes | — |
| pass | holdout | did the model train on the test questions | benchmark-contamination | 45 | yes | — |
| pass | holdout | using GPT to grade other model outputs | llm-as-a-judge | 83 | yes | — |
| pass | holdout | how are Elo ratings for chatbots computed | human-preference-evaluation | 52 | yes | — |
| pass | holdout | what does F1 score tell me | evaluation-metrics-for-ai | 82 | yes | — |
| pass | holdout | measuring whether an agent completes tasks reliably | agent-evaluation | 74 | yes | — |
| pass | holdout | how do agents from different companies talk to each other | agent-protocol-landscape | 87 | yes | — |
| pass | holdout | security risks of third party MCP servers | mcp-security | 132 | yes | — |
| pass | holdout | overview of agent communication standards | agent-protocol-landscape | 76 | yes | — |
| pass | holdout | state machine style orchestration for LLM agents | langgraph | 69 | yes | — |
| pass | holdout | automatically optimise my prompts with a metric | dspy | 64 | yes | — |
| pass | holdout | self-hosted inference server with high throughput | model-serving-and-inference | 97 | yes | — |
| pass | holdout | run quantized models on a laptop without a GPU | llama-cpp | 44 | yes | — |
| pass | holdout | export a PyTorch model for mobile and browser | onnx-runtime | 76 | yes | — |
| pass | holdout | how do I download Hugging Face models safely | hugging-face | 100 | yes | — |
| weak | holdout | predicting protein structure from sequence | alphafold | 29 | no | — |
| pass | holdout | neural networks that obey differential equations | physics-informed-neural-networks | 98 | yes | — |
| pass | holdout | machine learning weather forecasting versus numerical models | ai-weather-forecasting | 114 | yes | — |
| pass | holdout | how is AI used to find new materials | ai-materials-discovery | 87 | yes | — |
| pass | holdout | does AI speed up drug discovery | ai-drug-discovery | 100 | yes | — |
| pass | holdout | difference between classification and regression | supervised-learning | 57 | yes | — |
| pass | holdout | how do neural networks learn weights | neural-networks | 107 | yes | — |
| pass | holdout | training accuracy high but test accuracy low | overfitting-and-regularization | 51 | yes | — |
| pass | holdout | reuse a pretrained model for my small dataset | transfer-learning | 43 | yes | — |
| pass | holdout | how do agents learn from rewards | reinforcement-learning | 57 | yes | — |
| pass | holdout | why do image models use patches | vision-transformers | 64 | yes | — |
| pass | holdout | models with many experts but few active parameters | mixture-of-experts | 91 | yes | — |
| pass | holdout | linear time alternative to attention | state-space-models | 82 | yes | — |
| pass | holdout | how do text-to-image generators work | diffusion-models | 50 | yes | — |
| pass | holdout | why does generation memory grow with context length | kv-cache | 73 | yes | — |
| pass | holdout | how to make LLM inference faster without changing outputs | speculative-decoding | 58 | yes | — |
| pass | holdout | how many tokens should a model be trained on | scaling-laws | 83 | yes | — |
| pass | holdout | what is the difference between a base model and a chat model | instruction-tuning | 89 | yes | — |
| pass | holdout | train adapters instead of all weights | lora-and-peft | 22 | yes | — |
| pass | holdout | shrink a model to 4-bit | quantization | 47 | yes | — |
| pass | holdout | models small enough to run on a phone | small-language-models | 123 | yes | — |
| pass | holdout | search images using text descriptions | contrastive-learning-clip | 59 | yes | — |
| pass | holdout | transcribe meetings automatically | speech-ai | 52 | yes | — |
| pass | holdout | pull structured fields out of invoices | document-understanding-ai | 53 | yes | — |
| pass | holdout | how do chatbots learn from human ratings | rlhf | 71 | yes | — |
| pass | holdout | training on chosen and rejected answer pairs | preference-optimization | 46 | yes | — |
| pass | holdout | model exploits the scoring function instead of doing the task | reward-hacking | 50 | yes | — |
| pass | holdout | AI that tells me what I want to hear | sycophancy | 56 | yes | — |
| pass | holdout | adversarial testing of chatbots before launch | red-teaming | 85 | yes | — |
| pass | holdout | who is accountable for AI decisions in a company | ai-governance | 108 | yes | — |
| pass | holdout | which AI systems are banned in Europe | eu-ai-act | 89 | yes | — |
| pass | holdout | documentation that describes a model's limits | model-cards | 98 | yes | — |
| pass | holdout | tamper-evident labels for AI generated media | c2pa-content-provenance | 77 | yes | — |
| pass | holdout | tracking prompts and token spend in production | llm-cost-optimization | 61 | yes | — |
| pass | holdout | keeping the same long system prompt cheap across requests | prompt-caching | 71 | yes | — |
| pass | holdout | deciding what information goes into the model context for an agent | context-engineering | 100 | yes | — |
| pass | holdout | keyword plus semantic retrieval with rerankers | hybrid-search-and-reranking | 89 | yes | — |
| pass | holdout | let an AI operate my browser | computer-use-agents | 57 | yes | — |
| pass | holdout | stop a model from reading private files when running code | code-execution-sandboxing | 87 | yes | — |
| pass | holdout | how to detect when a model degrades after launch | model-drift-and-monitoring | 64 | yes | — |
| weak | holdout | why is a GPU needed for neural networks | neural-networks | 71 | yes | — |
