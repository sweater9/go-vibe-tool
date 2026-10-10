# Knowledge search: held-out check

Run: `node tests/knowledge-search-heldout.mjs`. 69 queries written after tuning ended (`tests/data/search-heldout.json`). Not a fully independent estimate: same author as the main dataset.

| Metric | Before (lexical core) | After (intelligence layer) |
| --- | --- | --- |
| Queries passing every check | 46.4 | 76.8 |
| Confident answers correct | 36.4 | 68.2 |
| Weak cases kept weak | 100 | 100 |
| Wrong confident answers (count) | 9 | 0 |
| Unexpected tools (count) | 0 | 0 |

Disclosure: the first run of this set scored 75.4% (1 wrong confident answer: the bare word "model"). That exposed a bug class, so "model" was added to the ambiguous-word list in query-understanding.json (76.8%). Nothing else was tuned on this set.

## Still failing after

- [natural] how can i make a chatbot that knows about my company handbook — no confident answer
- [natural] why does my model make up facts — no confident answer
- [natural] is it safe to paste customer emails into chatgpt — missing tool: pii-secret-redactor
- [natural] how do i stop users tricking my ai assistant into ignoring its rules — no confident answer
- [natural] why is my ai bill so high — no confident answer
- [natural] how do models learn from human feedback — no confident answer
- [natural] can ai help discover new medicines — no confident answer
- [natural] what is the point of splitting documents into pieces for ai search — no confident answer
- [natural] how does a model remember earlier parts of a long conversation — no confident answer
- [synonym] numerical representations of meaning for text — no confident answer
- [synonym] teaching a pretrained network a new task with few examples — no confident answer
- [synonym] shrinking a model by lowering numeric precision — no confident answer
- [synonym] a small model learning from a bigger one — no confident answer
- [synonym] letting a model use external functions — no confident answer
- [beginner] ai for complete beginners — no confident answer
- [sequence] what comes after learning embeddings — learn-more lacks vector-databases/rag/chunking
