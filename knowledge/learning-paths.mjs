// V4 learning-path recommendations. Local-only, deterministic and no account required.
export const LEVELS = ["beginner", "intermediate", "advanced"];
export const PATHS = {
  "AI fundamentals": {
    beginner: ["what-is-ai", "generative-ai", "large-language-models", "prompt-engineering"],
    intermediate: ["transformers", "tokens", "context-windows", "embeddings"],
    advanced: ["rag", "fine-tuning", "ai-evaluation", "how-to-reduce-hallucinations"]
  },
  "Build AI agents": {
    beginner: ["large-language-models", "prompt-engineering", "ai-agents", "agent-tools"],
    intermediate: ["function-calling", "mcp", "agent-memory", "agentic-workflows"],
    advanced: ["multi-agent-systems", "rag", "ai-evaluation", "agentic-workflows"]
  },
  "Learn programming": {
    beginner: ["python", "javascript", "git", "github"],
    intermediate: ["python-for-ai", "typescript", "nodejs", "react"],
    advanced: ["calling-ai-apis-with-python", "rest-apis", "api-authentication", "model-apis"]
  }
};
export function recommendPath(topic, level, pages) {
  if (!Object.hasOwn(PATHS, topic) || !LEVELS.includes(level)) return [];
  const lookup = new Map(pages.map(p => [p.id, p]));
  return PATHS[topic][level].filter(id => lookup.has(id)).map(id => lookup.get(id));
}

export const LEVEL_DETAILS = {
  beginner: 'Start here if these concepts are new to you. No previous AI experience required.',
  intermediate: 'Build on the basics and connect the concepts to practical applications.',
  advanced: 'Explore implementation choices, trade-offs, and evaluation. Familiarity with the basics is recommended.'
};
export const TOPIC_GOALS = {
  'AI fundamentals': 'Understand how AI works, steer language models, and judge their results.',
  'Build AI agents': 'Follow the journey from model responses to tools, memory, and reliable workflows.',
  'Learn programming': 'Explore languages and developer tools, then learn how applications connect to model APIs.'
};
