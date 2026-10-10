// Learning paths and the (small) set of existing IntelliTools tools that genuinely relate to Knowledge topics.
export const tools = {
  'ai-prompt-builder': { name: 'AI Prompt Builder', privacy: 'Runs in your browser; your draft is not sent to a server.' },
  'fact-anchor-checker': { name: 'Fact Anchor Checker', privacy: 'Runs in your browser; the text you paste is not sent to a server.' },
  'pii-secret-redactor': { name: 'PII & Secret Redactor', privacy: 'Runs in your browser; the text you paste is not sent to a server.' }
};
export const paths = [
  { title: 'From LLMs to AI agents', blurb: 'The full build-up: how language models work, how to steer them, how they use tools, and how agents are assembled.',
    steps: ['large-language-models', 'tokens', 'context-windows', 'prompt-engineering', 'agent-tools', 'function-calling', 'mcp', 'agent-memory', 'rag', 'ai-agents', 'multi-agent-systems', 'agentic-workflows'] },
  { title: 'Retrieval and grounding (RAG)', blurb: 'How to make a model answer from your own information, and how to tell whether it worked.',
    steps: ['rag', 'embeddings', 'vector-databases', 'chunking', 'context-windows', 'ai-hallucinations', 'ai-evaluation'] },
  { title: 'Using AI safely', blurb: 'Reliability, privacy and security for anyone putting AI into real work.',
    steps: ['ai-hallucinations', 'how-to-reduce-hallucinations', 'ai-privacy-and-security', 'prompt-injection', 'local-ai', 'ai-evaluation'] },
  { title: 'Build with Python', blurb: 'Call models, handle data and assemble a small RAG pipeline in Python.',
    steps: ['python-for-ai', 'calling-ai-apis-with-python', 'python-data-for-ai', 'rag-with-python', 'python-ai-libraries'] },
  { title: 'Web AI with JavaScript', blurb: 'Keep secrets on a Node server, type the client contract, and stream into a React chat UI.',
    steps: ['javascript-for-ai', 'nodejs-for-ai', 'typescript-api-client-types', 'react-chatbot-state', 'streaming-ai-with-nodejs'] },
  { title: 'Reasoning models and test-time compute', blurb: 'How models spend extra effort at answer time, how that is trained and verified, and what to show users.',
    steps: ['large-language-models', 'chain-of-thought', 'reasoning-models', 'test-time-compute', 'self-consistency', 'best-of-n-sampling', 'process-reward-model', 'outcome-reward-model', 'reinforcement-learning-for-reasoning', 'thinking-budgets', 'reasoning-transparency'] },
  { title: 'Alignment: from RLHF to DPO', blurb: 'How assistants are tuned from human and AI preferences, and where reinforcement learning does and does not apply.',
    steps: ['instruction-tuning', 'reinforcement-learning', 'proximal-policy-optimization', 'rlhf', 'preference-optimization', 'dpo', 'reward-hacking', 'sycophancy', 'ai-alignment', 'red-teaming'] },
  { title: 'Evaluating AI systems', blurb: 'From benchmarks and their pitfalls to task evals, judges, RAG and agent testing.',
    steps: ['ai-evaluation', 'benchmarks-and-leaderboards', 'benchmark-contamination', 'llm-benchmarks-vs-task-evals', 'llm-as-a-judge', 'rag-evaluation', 'agent-evaluation'] },
  { title: 'Structured output and constrained decoding', blurb: 'Getting dependable machine-readable output from models.',
    steps: ['sampling-and-decoding', 'structured-outputs', 'json-schema', 'constrained-decoding', 'grammar-guided-generation', 'structured-output-methods-compared'] },
  { title: 'Running and serving models', blurb: 'Quantisation, runtimes, serving and the hardware beneath them.',
    steps: ['quantization', 'local-ai', 'llama-cpp', 'vllm', 'kv-cache', 'model-serving-and-inference', 'gpus-and-ai-accelerators', 'llm-cost-optimization'] },
  { title: 'Machine learning foundations', blurb: 'Learning paradigms, networks and architectures behind modern AI.',
    steps: ['supervised-learning', 'neural-networks', 'backpropagation-and-gradient-descent', 'overfitting-and-regularization', 'transfer-learning', 'convolutional-neural-networks', 'vision-transformers', 'diffusion-models', 'state-space-models'] },
  { title: 'Governing AI', blurb: 'Frameworks, standards and law for responsible AI use.',
    steps: ['ai-governance', 'nist-ai-rmf', 'iso-iec-42001', 'eu-ai-act', 'model-cards', 'ai-bias-and-fairness', 'owasp-llm-top-10'] },
];
