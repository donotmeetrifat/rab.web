import type { EntityType } from "./types";

/**
 * Curated dictionaries for deterministic entity detection. Kept as
 * (canonical name, aliases[]) tuples so we can normalise casing and
 * match common variants without shipping a full NLP model.
 *
 * Detection rule: case-insensitive word-boundary match on any alias.
 */
export interface DictEntry {
  name: string;
  aliases: string[];
}

export const LANGUAGES: DictEntry[] = [
  { name: "JavaScript", aliases: ["javascript", "js", "ecmascript"] },
  { name: "TypeScript", aliases: ["typescript", "ts"] },
  { name: "Python", aliases: ["python", "py"] },
  { name: "Go", aliases: ["golang", "go lang"] },
  { name: "Rust", aliases: ["rust", "rustlang"] },
  { name: "Java", aliases: ["java"] },
  { name: "C#", aliases: ["c#", "csharp", "c sharp", "dotnet", ".net"] },
  { name: "C++", aliases: ["c++", "cpp"] },
  { name: "C", aliases: ["c language"] },
  { name: "PHP", aliases: ["php"] },
  { name: "Ruby", aliases: ["ruby", "rails"] },
  { name: "Swift", aliases: ["swift"] },
  { name: "Kotlin", aliases: ["kotlin"] },
  { name: "Dart", aliases: ["dart"] },
  { name: "SQL", aliases: ["sql"] },
  { name: "Bash", aliases: ["bash", "shell", "sh"] },
  { name: "HTML", aliases: ["html"] },
  { name: "CSS", aliases: ["css", "scss", "sass"] },
];

export const FRAMEWORKS: DictEntry[] = [
  { name: "React", aliases: ["react", "reactjs", "react.js"] },
  { name: "Next.js", aliases: ["next.js", "nextjs", "next js"] },
  { name: "Vue", aliases: ["vue", "vuejs", "vue.js"] },
  { name: "Nuxt", aliases: ["nuxt", "nuxtjs"] },
  { name: "Angular", aliases: ["angular"] },
  { name: "Svelte", aliases: ["svelte", "sveltekit"] },
  { name: "Node.js", aliases: ["node.js", "nodejs", "node js"] },
  { name: "Deno", aliases: ["deno"] },
  { name: "Bun", aliases: ["bun"] },
  { name: "Remix", aliases: ["remix"] },
  { name: "Astro", aliases: ["astro"] },
  { name: "Solid", aliases: ["solidjs", "solid.js"] },
  { name: "TanStack", aliases: ["tanstack"] },
  { name: "Vite", aliases: ["vite"] },
  { name: "Webpack", aliases: ["webpack"] },
  { name: "Django", aliases: ["django"] },
  { name: "Flask", aliases: ["flask"] },
  { name: "Rails", aliases: ["ruby on rails"] },
  { name: "Laravel", aliases: ["laravel"] },
  { name: "Spring", aliases: ["spring boot", "springboot"] },
];

export const DATABASES: DictEntry[] = [
  { name: "Supabase", aliases: ["supabase"] },
  { name: "Firebase", aliases: ["firebase", "firestore"] },
  { name: "PostgreSQL", aliases: ["postgresql", "postgres", "psql"] },
  { name: "MongoDB", aliases: ["mongodb", "mongo"] },
  { name: "MySQL", aliases: ["mysql", "mariadb"] },
  { name: "SQLite", aliases: ["sqlite"] },
  { name: "Redis", aliases: ["redis"] },
  { name: "DynamoDB", aliases: ["dynamodb"] },
  { name: "Neon", aliases: ["neon database"] },
  { name: "PlanetScale", aliases: ["planetscale"] },
  { name: "Turso", aliases: ["turso"] },
];

export const CLOUD: DictEntry[] = [
  { name: "AWS", aliases: ["aws", "amazon web services"] },
  { name: "Azure", aliases: ["azure", "microsoft azure"] },
  { name: "GCP", aliases: ["gcp", "google cloud"] },
  { name: "Cloudflare", aliases: ["cloudflare", "workers"] },
  { name: "Vercel", aliases: ["vercel"] },
  { name: "Netlify", aliases: ["netlify"] },
  { name: "Railway", aliases: ["railway"] },
  { name: "Render", aliases: ["render.com"] },
  { name: "Fly.io", aliases: ["fly.io", "flyio"] },
  { name: "DigitalOcean", aliases: ["digitalocean", "digital ocean"] },
];

export const DEVOPS: DictEntry[] = [
  { name: "Docker", aliases: ["docker", "dockerfile"] },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { name: "GitHub", aliases: ["github"] },
  { name: "GitLab", aliases: ["gitlab"] },
  { name: "Bitbucket", aliases: ["bitbucket"] },
  { name: "Git", aliases: ["git"] },
  { name: "Terraform", aliases: ["terraform"] },
  { name: "Ansible", aliases: ["ansible"] },
  { name: "Nginx", aliases: ["nginx"] },
];

export const AI: DictEntry[] = [
  { name: "OpenAI", aliases: ["openai", "chatgpt", "gpt-4", "gpt-5", "gpt4", "gpt5"] },
  { name: "Claude", aliases: ["claude", "anthropic"] },
  { name: "Gemini", aliases: ["gemini", "google ai"] },
  { name: "DeepSeek", aliases: ["deepseek"] },
  { name: "Perplexity", aliases: ["perplexity"] },
  { name: "Copilot", aliases: ["copilot", "github copilot", "microsoft copilot"] },
  { name: "Llama", aliases: ["llama", "meta ai"] },
  { name: "Mistral", aliases: ["mistral"] },
  { name: "Hugging Face", aliases: ["hugging face", "huggingface"] },
];

export const LIBRARIES: DictEntry[] = [
  { name: "Tailwind", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { name: "shadcn/ui", aliases: ["shadcn", "shadcn/ui", "shadcn ui"] },
  { name: "Prisma", aliases: ["prisma"] },
  { name: "Drizzle", aliases: ["drizzle", "drizzle orm"] },
  { name: "Express", aliases: ["express", "expressjs"] },
  { name: "FastAPI", aliases: ["fastapi"] },
  { name: "TensorFlow", aliases: ["tensorflow"] },
  { name: "PyTorch", aliases: ["pytorch"] },
  { name: "NumPy", aliases: ["numpy"] },
  { name: "Pandas", aliases: ["pandas"] },
  { name: "Zustand", aliases: ["zustand"] },
  { name: "Redux", aliases: ["redux"] },
  { name: "TanStack Query", aliases: ["tanstack query", "react query"] },
  { name: "Dexie", aliases: ["dexie", "dexie.js"] },
  { name: "Zod", aliases: ["zod"] },
  { name: "Vitest", aliases: ["vitest"] },
  { name: "Jest", aliases: ["jest"] },
  { name: "Playwright", aliases: ["playwright"] },
  { name: "Cypress", aliases: ["cypress"] },
];

/** Broad conversation topics — matched against the whole conversation
 *  text to give the UI a high-level classification chip. */
export const TOPICS: DictEntry[] = [
  { name: "Authentication", aliases: ["auth", "login", "oauth", "jwt", "session"] },
  { name: "Deployment", aliases: ["deploy", "deployment", "ci/cd", "pipeline"] },
  { name: "Performance", aliases: ["performance", "optimize", "optimization", "latency"] },
  { name: "Security", aliases: ["security", "vulnerability", "xss", "csrf", "sql injection"] },
  { name: "Testing", aliases: ["unit test", "integration test", "e2e", "testing"] },
  { name: "Database", aliases: ["database", "schema", "migration", "query"] },
  { name: "UI/UX", aliases: ["ui", "ux", "user interface", "design system"] },
  { name: "API Design", aliases: ["rest api", "graphql", "endpoint", "webhook"] },
  { name: "Machine Learning", aliases: ["machine learning", "ml", "neural network", "training"] },
  { name: "Data Analysis", aliases: ["data analysis", "analytics", "visualization"] },
  { name: "Debugging", aliases: ["debug", "debugging", "stack trace", "error"] },
  { name: "Refactoring", aliases: ["refactor", "refactoring", "clean code"] },
];

export const ALL_DICTS: { type: EntityType; entries: DictEntry[] }[] = [
  { type: "language", entries: LANGUAGES },
  { type: "framework", entries: FRAMEWORKS },
  { type: "database", entries: DATABASES },
  { type: "cloud", entries: CLOUD },
  { type: "devops", entries: DEVOPS },
  { type: "ai", entries: AI },
  { type: "library", entries: LIBRARIES },
  { type: "topic", entries: TOPICS },
];

/** English stopwords — trimmed for chat context (no "code", "data"). */
export const STOPWORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", "at",
  "by", "for", "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "from", "up", "down",
  "in", "out", "on", "off", "over", "under", "again", "further", "once",
  "here", "there", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "can", "will", "just", "don", "should", "now",
  "is", "was", "were", "be", "been", "being", "am", "are", "have", "has",
  "had", "do", "does", "did", "doing", "of", "as", "this", "that", "these",
  "those", "it", "its", "they", "them", "their", "his", "her", "she", "he",
  "we", "our", "you", "your", "i", "me", "my", "us", "him", "who", "what",
  "which", "whom", "whose", "why", "how", "also", "would", "could", "may",
  "might", "must", "shall", "let", "get", "got", "gets", "make", "made",
  "makes", "use", "used", "uses", "using", "like", "want", "need", "know",
  "think", "say", "said", "see", "look", "way", "one", "two", "thing",
  "things", "example", "instead", "yes", "no", "ok", "okay", "please",
  "thanks", "thank", "hi", "hello", "sure",
]);
