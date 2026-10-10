/* GoVibeTool AI Prompt Improver — core analysis.
 *
 * Pure, deterministic and fully on-device: no network requests, no model calls.
 * It scores the *structure* of a prompt against nine practical checks, flags
 * vague wording and sensitive data, and assembles a clearer rewrite that keeps
 * the person's own words and adds bracketed placeholders for what is missing.
 *
 * Works as a classic <script> (exposes window.GVTPromptImprover) and as a
 * CommonJS module for Node tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GVTPromptImprover = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_CHARS = 20000;

  var VERBS =
    "write|create|make|build|generate|draft|compose|explain|summari[sz]e|analy[sz]e|compare|list|give|suggest|find|review|" +
    "rewrite|translate|convert|extract|classify|categori[sz]e|plan|design|outline|describe|help|teach|fix|debug|refactor|" +
    "improve|edit|proofread|calculate|recommend|brainstorm|identify|evaluate|assess|critique|rank|prioriti[sz]e|propose|" +
    "develop|produce|prepare|show|tell|walk|simplify|expand|shorten|rephrase|paraphrase|turn|transform|organi[sz]e|solve|" +
    "check|test|optimi[sz]e|predict|estimate|decide|choose|select";
  var VERB_START = new RegExp("^(?:" + VERBS + ")\\b", "i");
  var VERB_ANY = new RegExp("\\b(?:" + VERBS + ")\\b", "i");
  var QUESTION_START = /^(?:what|how|why|which|who|when|where|can|could|should|would|is|are|do|does|did|will)\b/i;
  var POLITE_LEAD =
    /^(?:please|kindly|hey|hi|hello|ok|okay|can you|could you|would you|will you|i need you to|i want you to|i would like you to|i'd like you to|i need|i want|help me)(?:\s+to)?[\s,:-]*/i;

  var TASK_TYPES = [
    {
      id: "coding",
      label: "Coding",
      re: /\b(code|coding|function|bug|debug|script|python|javascript|typescript|java|sql|regex|api|class|refactor|compile|error|stack trace|unit test|css|html|react|node)\b/gi,
      role: "senior software engineer",
      format: "Provide the code in a single code block, then a short explanation of how it works and any assumptions you made.",
      asks: ["[Language, version and any libraries to use or avoid]", "[Example input and the output you expect]"]
    },
    {
      id: "summarize",
      label: "Summarizing",
      re: /\b(summari[sz]e|summary|tl;?dr|recap|condense|key points|digest)\b/gi,
      role: "careful analyst who summarizes accurately",
      format: "Give a 3-5 bullet summary, then a one-sentence takeaway. Do not add facts that are not in the source.",
      asks: ["[Length limit, e.g. under 120 words]", "[What to focus on, and what to ignore]"]
    },
    {
      id: "data",
      label: "Data & extraction",
      re: /\b(extract|classify|categori[sz]e|parse|convert|table|csv|json|spreadsheet|dataset|columns?|fields?)\b/gi,
      role: "meticulous data analyst",
      format: "Return a table (or JSON) with consistent columns, and flag any entry you are unsure about instead of guessing.",
      asks: ["[Exact fields or columns you want]", "[How to handle missing or unclear values]"]
    },
    {
      id: "analysis",
      label: "Analysis & comparison",
      re: /\b(analy[sz]e|analysis|compare|comparison|evaluate|assess|review|critique|pros and cons|trade-?offs?|versus|vs)\b/gi,
      role: "objective analyst",
      format: "Give a short comparison table, then a recommendation with the reasons behind it.",
      asks: ["[The criteria that matter most to you]", "[Sources or data the answer should rely on]"]
    },
    {
      id: "planning",
      label: "Planning",
      re: /\b(plan|roadmap|schedule|strategy|outline|checklist|itinerary|timeline|milestones?)\b/gi,
      role: "experienced project planner",
      format: "Give a numbered plan with milestones, owners and rough timing.",
      asks: ["[Deadline or time available]", "[Resources, budget and constraints]"]
    },
    {
      id: "learning",
      label: "Learning & explaining",
      re: /\b(explain|teach|learn|understand|eli5|study|quiz|lesson|tutorial|how does|how do)\b/gi,
      role: "patient teacher",
      format: "Explain step by step with one concrete example, then finish with a 3-question self-check.",
      asks: ["[Depth wanted: quick overview or detailed]", "[Topics to include or skip]"]
    },
    {
      id: "writing",
      label: "Writing",
      re: /\b(write|draft|email|essay|blog|post|article|story|letter|copy|caption|headline|rewrite|proofread|speech|script|newsletter|bio)\b/gi,
      role: "professional editor and writer",
      format: "Return the finished text, ready to use, with no preamble.",
      asks: ["[Length, e.g. about 200 words]", "[Points it must include, and anything to avoid]"]
    },
    {
      id: "brainstorm",
      label: "Brainstorming",
      re: /\b(ideas?|brainstorm|suggest|names?|options|alternatives|inspiration|concepts?)\b/gi,
      role: "creative strategist",
      format: "Give a numbered list of 8-10 distinct options, each with a one-line rationale.",
      asks: ["[Constraints such as budget, style or audience]", "[Ideas to avoid]"]
    }
  ];

  var GENERAL = {
    id: "general",
    label: "General",
    role: "knowledgeable assistant",
    format: "Give a short, structured answer with headings or bullets.",
    asks: ["[Length or scope of the answer]", "[Anything it must include or avoid]"]
  };

  var VAGUE_WORDS = [
    "good", "nice", "great", "better", "interesting", "cool", "awesome", "amazing", "stuff", "things", "thing",
    "something", "somehow", "etc", "whatever", "a bit", "a lot", "kind of", "sort of", "very", "really", "quite",
    "pretty", "some", "few", "many", "several", "big", "simple", "easy", "quick", "soon", "asap"
  ];
  var VAGUE_RE = new RegExp("\\b(" + VAGUE_WORDS.map(function (w) { return w.replace(/ /g, "\\s+"); }).join("|") + ")\\b", "gi");

  var RE = {
    purpose: /\b(because|so that|in order to|my goal|goal is|purpose|background|context|currently|i am|i'm|we are|we're|for a|for an|for my|for our|we need|i need)\b/i,
    audience:
      /\b(audience|readers?|beginners?|experts?|students?|customers?|clients?|executives?|managers?|developers?|engineers?|children|kids|teenagers?|non-technical|layperson|laypeople|stakeholders?|investors?|team|parents?|teachers?|tone|formal|informal|casual|friendly|professional|persuasive|humorous|serious|warm|concise|plain language|simple language|technical)\b/i,
    constraintWord: /\b(must|should|do not|don't|never|avoid|only|at most|at least|no more than|maximum|minimum|limit|within|under|exactly|between \d+|without|keep it)\b/i,
    constraintNumber: /\b\d+\s*(?:words?|sentences?|paragraphs?|bullets?|points?|items?|characters?|minutes?|seconds?|lines?|steps?|examples?|ideas?|options?|pages?|slides?)\b/i,
    formatNoun:
      /\b(table|bullet(?:ed)?|bullets|list|json|csv|markdown|numbered|steps?|headings?|sections?|outline|paragraphs?|essay|email|code block|yaml|xml|html|template|checklist|summary|one-liner|step-by-step|format)\b/i,
    formatCue: /\b(as|in|into|using|format|return|output|respond|reply|give me|provide|present|structure)\b/i,
    example: /\b(for example|e\.g\.|such as|for instance|example:|like this|sample|here is|here's|input:|output:)\b/i,
    role: /\b(you are|you're|act as|acting as|pretend|imagine you|take the role|your role is|behave as|respond as)\b|\bas an? (?:expert|senior|experienced|professional|seasoned|skilled)\b/i
  };

  var STATUS_POINTS = { pass: 1, warn: 0.5, fail: 0 };

  function wordList(text) {
    return text.match(/[A-Za-z0-9À-￿][A-Za-z0-9À-￿'’-]*/g) || [];
  }

  function normalize(text) {
    return String(text == null ? "" : text)
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function stripLead(sentence) {
    var s = sentence.trim();
    var prev;
    do {
      prev = s;
      s = s.replace(POLITE_LEAD, "");
    } while (s !== prev && s);
    return s;
  }

  function splitSentences(text) {
    var out = [];
    text.split(/\n+/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      // Keep list items whole so their "1." / "-" markers survive.
      if (/^(?:[-*•]|\d+[.)])\s/.test(line)) out.push(line);
      else line.replace(/([.!?])\s+/g, "$1\n").split("\n").forEach(function (part) {
        part = part.trim();
        if (part) out.push(part);
      });
    });
    return out;
  }

  function detectType(text) {
    var best = null;
    var bestCount = 0;
    TASK_TYPES.forEach(function (t) {
      var n = (text.match(t.re) || []).length;
      if (n > bestCount) {
        best = t;
        bestCount = n;
      }
    });
    return best || GENERAL;
  }

  function typeById(id) {
    if (id === "general") return GENERAL;
    for (var i = 0; i < TASK_TYPES.length; i++) if (TASK_TYPES[i].id === id) return TASK_TYPES[i];
    return null;
  }

  function luhn(digits) {
    var sum = 0;
    var dbl = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = digits.charCodeAt(i) - 48;
      if (dbl) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      dbl = !dbl;
    }
    return sum % 10 === 0;
  }

  function mask(value) {
    var v = String(value);
    if (v.length <= 8) return v.slice(0, 2) + "…";
    return v.slice(0, 4) + "…" + v.slice(-2);
  }

  function findSensitive(text) {
    var found = [];
    var seen = {};
    function add(type, label, value) {
      var key = type + ":" + value;
      if (seen[key]) return;
      seen[key] = 1;
      found.push({ type: type, label: label, sample: mask(value) });
    }
    var m;
    if (text.indexOf("@") !== -1) {
      // Bounded quantifiers keep this linear on long unbroken tokens.
      var email = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g;
      while ((m = email.exec(text))) add("email", "email address", m[0]);
    }
    var key = /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,})\b/g;
    while ((m = key.exec(text))) add("secret", "API key or token", m[0]);
    var jwt = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g;
    while ((m = jwt.exec(text))) add("secret", "JWT token", m[0]);
    var pwd = /\b(?:password|passwd|pwd|secret)\s*[:=]\s*(\S{4,})/gi;
    while ((m = pwd.exec(text))) add("secret", "password or secret", m[1]);
    var card = /\b(?:\d[ -]?){13,19}\b/g;
    while ((m = card.exec(text))) {
      var digits = m[0].replace(/\D/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhn(digits)) add("card", "payment card number", digits);
    }
    var phone = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]\d{3,4}(?:[\s.-]\d{2,4})?/g;
    while ((m = phone.exec(text))) {
      var pd = m[0].replace(/\D/g, "");
      if (pd.length >= 9 && pd.length <= 15 && !luhn(pd)) add("phone", "phone number", m[0].trim());
    }
    return found;
  }

  function article(word) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
  }

  function analyze(input, options) {
    options = options || {};
    var raw = String(input == null ? "" : input);
    var truncated = raw.length > MAX_CHARS;
    var text = normalize(truncated ? raw.slice(0, MAX_CHARS) : raw);
    if (!text) return { empty: true };

    var words = wordList(text);
    var wc = words.length;
    var lower = text.toLowerCase();

    var forced = options.taskType && options.taskType !== "auto" ? typeById(options.taskType) : null;
    var type = forced || detectType(text);

    var sentences = splitSentences(text);
    var first = stripLead(sentences[0] || text);
    var checks = [];

    function add(id, label, weight, status, tip) {
      checks.push({
        id: id,
        label: label,
        weight: weight,
        status: status,
        earned: Math.round(weight * STATUS_POINTS[status] * 10) / 10,
        tip: tip
      });
    }

    // 1. Clear task
    var isQuestion = QUESTION_START.test(first) || /\?\s*$/.test(text);
    var actionSentence = sentences.some(function (s) { return VERB_START.test(stripLead(s)); });
    if (actionSentence) add("task", "Clear task", 20, "pass", "The request states a clear action.");
    else if (VERB_ANY.test(text) || isQuestion)
      add("task", "Clear task", 20, "warn",
        isQuestion
          ? "Questions work best with a stated purpose. Say what you will do with the answer."
          : "Lead with the action, e.g. “Write…”, “Summarize…”, “Compare…”.");
    else add("task", "Clear task", 20, "fail", "Say what you want done. Start with a verb such as “Write”, “Explain” or “Compare”.");

    // 2. Background & purpose
    var hasPurpose = RE.purpose.test(text);
    if (wc >= 35 || (hasPurpose && wc >= 12)) add("context", "Background and purpose", 15, "pass", "There is enough context to work from.");
    else if (wc >= 15 || hasPurpose) add("context", "Background and purpose", 15, "warn", "Add one or two sentences on why you need this and what the AI should know.");
    else add("context", "Background and purpose", 15, "fail", "Add background: why you need this, and anything the AI could not guess.");

    // 3. Audience or tone
    if (RE.audience.test(text)) add("audience", "Audience or tone", 10, "pass", "The reader or tone is stated.");
    else add("audience", "Audience or tone", 10, "fail", "Say who it is for or what tone to use, e.g. “for busy managers, in a friendly tone”.");

    // 4. Constraints
    if (RE.constraintWord.test(text) || RE.constraintNumber.test(text))
      add("constraints", "Constraints and limits", 15, "pass", "Limits or rules are stated.");
    else add("constraints", "Constraints and limits", 15, "fail", "Add limits: length, must-include items, and things to avoid.");

    // 5. Output format
    var noun = RE.formatNoun.test(text);
    if (noun && RE.formatCue.test(text)) add("format", "Output format", 15, "pass", "The shape of the answer is requested.");
    else if (noun) add("format", "Output format", 15, "warn", "Spell out the format, e.g. “as a table” or “as 5 bullet points”.");
    else add("format", "Output format", 15, "fail", "Say how you want the answer: table, bullets, steps, code block, email…");

    // 6. Example
    if (RE.example.test(text)) add("examples", "Example or reference", 5, "pass", "An example is included.");
    else add("examples", "Example or reference", 5, "fail", "An example of what good looks like often helps more than extra description.");

    // 7. Role
    if (RE.role.test(text)) add("role", "Role or perspective", 5, "pass", "A role or perspective is set.");
    else add("role", "Role or perspective", 5, "fail", "Optionally tell the AI who to be, e.g. “You are a senior editor”.");

    // 8. Specific wording
    var vagueFound = [];
    var vm;
    VAGUE_RE.lastIndex = 0;
    while ((vm = VAGUE_RE.exec(lower))) {
      var w = vm[1].replace(/\s+/g, " ");
      if (vagueFound.indexOf(w) === -1) vagueFound.push(w);
    }
    var pronounStart = /^(?:it|this|that|these|those)\b/i.test(first) && wc < 25;
    var vagueScore = vagueFound.length + (pronounStart ? 1 : 0);
    if (vagueScore === 0) add("clarity", "Specific wording", 10, "pass", "No vague wording detected.");
    else if (vagueScore <= 2)
      add("clarity", "Specific wording", 10, "warn", "Replace vague words with something measurable, e.g. “good” → “clear and persuasive”.");
    else add("clarity", "Specific wording", 10, "fail", "Several vague words. Swap each for a concrete, measurable detail.");

    // 9. Focused scope
    var taskSentences = sentences.filter(function (s) {
      if (/^\s*(?:[-*•]|\d+[.)])\s/.test(s)) return false;
      return VERB_START.test(stripLead(s)) || /\?\s*$/.test(s);
    });
    if (taskSentences.length >= 4)
      add("scope", "Focused scope", 5, "warn", "This reads like several requests. Splitting it usually gives better answers.");
    else add("scope", "Focused scope", 5, "pass", "The prompt stays on one job.");

    var score = 0;
    checks.forEach(function (c) { score += c.earned; });
    score = Math.round(score);
    var flags = [];
    if (wc < 6) {
      score = Math.min(score, 25);
      flags.push({ type: "short", label: "Very short", detail: "Under six words is rarely enough for a useful answer." });
    }
    if (wc > 250 && text.indexOf("\n") === -1)
      flags.push({ type: "unstructured", label: "Long and unstructured", detail: "Break it into short labelled sections or a list." });
    if (truncated)
      flags.push({ type: "truncated", label: "Trimmed", detail: "Only the first " + MAX_CHARS.toLocaleString("en-US") + " characters were analysed." });

    var sensitive = findSensitive(text);
    if (sensitive.length)
      flags.push({
        type: "sensitive",
        label: "Possible sensitive data",
        detail: "Found: " + sensitive.map(function (s) { return s.label + " (" + s.sample + ")"; }).join(", ") + ". Remove or mask it before sending to an AI service."
      });

    var label = score >= 85 ? "Strong" : score >= 70 ? "Good" : score >= 40 ? "Getting there" : "Needs work";

    var built = buildImproved(text, type, checks, score);

    return {
      empty: false,
      taskType: type.id,
      taskLabel: type.label,
      wordCount: wc,
      score: score,
      label: label,
      checks: checks,
      vague: vagueFound,
      flags: flags,
      sensitive: sensitive,
      improved: built.text,
      added: built.added,
      placeholderCount: built.placeholders,
      alreadyStrong: built.added.length === 0
    };
  }

  function buildImproved(text, type, checks, score) {
    var by = {};
    checks.forEach(function (c) { by[c.id] = c; });
    function missing(id) { return by[id].status !== "pass"; }
    var added = [];
    var placeholders = 0;
    var parts = [];

    if (missing("role")) {
      parts.push("You are " + article(type.role) + " " + type.role + ".");
      added.push("role");
    }
    parts.push(text);

    var extra = [];
    if (missing("context")) {
      extra.push("Context: [Why do you need this, and what should the AI know that it could not guess?]");
      added.push("context");
      placeholders++;
    }
    if (missing("audience")) {
      extra.push("Audience and tone: [Who is this for, and what tone should it have?]");
      added.push("audience");
      placeholders++;
    }
    if (missing("constraints")) {
      extra.push("Requirements:\n- " + type.asks[0] + "\n- " + type.asks[1]);
      added.push("constraints");
      placeholders += 2;
    }
    if (missing("format")) {
      extra.push("Output format: " + type.format);
      added.push("format");
    }
    if (missing("examples") && (type.id === "coding" || type.id === "data" || type.id === "writing")) {
      extra.push("Example of what good looks like (optional): [Paste a short sample or describe one]");
      added.push("examples");
      placeholders++;
    }
    if (missing("context") || missing("constraints")) {
      extra.push("If anything above is unclear, ask me up to 3 clarifying questions before you answer.");
    }
    if (extra.length) parts.push(extra.join("\n\n"));
    return { text: parts.join("\n\n"), added: added, placeholders: placeholders };
  }

  return {
    version: "1.0",
    MAX_CHARS: MAX_CHARS,
    TASK_TYPES: TASK_TYPES.map(function (t) { return { id: t.id, label: t.label }; }).concat([{ id: GENERAL.id, label: GENERAL.label }]),
    EXAMPLE_PROMPT: "write a blog post about productivity and make it good",
    analyze: analyze
  };
});
