const knowledgeEntries=[
{id:"python-json-csv",type:"Learn",title:"JSON to CSV in Python",summary:"Convert structured JSON into CSV with Python, with a browser tool for quick inspection.",href:"learn/index.html#python",keywords:["python","json","csv","convert json to csv","pandas","data"],tool:"table-formatter"},
{id:"python-deduplicate",type:"Learn",title:"Remove duplicates in Python",summary:"Understand set-based and key-based deduplication, then inspect structured data locally.",href:"learn/index.html#python",keywords:["python","remove duplicates","deduplicate","list","data"],tool:"sql-mock-builder"},
{id:"react-json",type:"Learn",title:"Work with JSON in React",summary:"Parse, validate and render JSON safely in a React workflow.",href:"learn/index.html#react",keywords:["react","json","parse json","component","frontend"],tool:"fact-anchor-checker"},
{id:"node-csv",type:"Learn",title:"Read CSV in Node.js",summary:"Learn the common Node.js CSV workflow and prepare tabular data locally.",href:"learn/index.html#node",keywords:["node","node.js","csv","read csv","javascript"],tool:"table-formatter"},
{id:"sql-duplicates",type:"Learn",title:"Find duplicates with SQL",summary:"Use GROUP BY and HAVING patterns to identify repeated values.",href:"learn/index.html#sql",keywords:["sql","duplicates","find duplicates","group by","having"],tool:"sql-mock-builder"},
{id:"regex-test",type:"Learn",title:"Test and reason about regular expressions",summary:"Break a regex problem into pattern, examples and edge cases before using it.",href:"learn/index.html#regex",keywords:["regex","regular expression","test regex","pattern","validation"],tool:"cron-humanizer"},
{id:"git-workflow",type:"Learn",title:"Git & GitHub workflow basics",summary:"A practical path from local change to branch, commit and pull request.",href:"learn/index.html#git",keywords:["git","github","branch","commit","pull request","pr"],tool:"env-diff"},
{id:"api-jwt",type:"Learn",title:"Understand JWT claims in API workflows",summary:"Decode JWT structure locally and learn what claims do—and do not—prove.",href:"learn/index.html#api",keywords:["api","jwt","oauth","token","claims","decode token"],tool:"oauth-jwt-decoder"},
{id:"private-logs",type:"Lab",title:"Prepare sensitive logs for sharing",summary:"Remove or pseudonymize PII and secrets before logs leave your device.",href:"?tool=pii-secret-redactor",keywords:["hide customer data","sensitive logs","anonymize","pii","secret","redact","privacy"],tool:"pii-secret-redactor"},
{id:"large-data",type:"Lab",title:"Work with structured data locally",summary:"Use current local data utilities now; the larger Local Data Studio is on the Labs roadmap.",href:"?tool=table-formatter",keywords:["large csv","query csv","parquet","local data","structured data","spreadsheet"],tool:"table-formatter"},
{id:"visual-workflow-lab",type:"Lab",title:"Visual Workflow Lab",summary:"Design, validate and simulate automated decision workflows visually in your browser.",href:"labs/workflow/",keywords:["workflow","visual workflow","automate","automation","node workflow","simulate workflow","logic graph","no code"],tool:"agentic-workflow-generator"},
{id:"api-playground-lab",type:"Lab",title:"API & JSON Playground",summary:"Test HTTP requests, headers and mock REST endpoints offline with real-time JSON validation.",href:"labs/api-playground/",keywords:["api","rest api","json","http request","mock api","api playground","endpoint","postman"],tool:"json-formatter"},
{id:"daily-knowledge-challenge",type:"Play",title:"Daily Knowledge Challenge",summary:"Five curated questions daily in science, tech, geography and logic with streak tracking.",href:"play/daily/",keywords:["quiz","trivia","daily challenge","daily quiz","daily trivia","game","streak"],tool:"fact-anchor-checker"},
{id:"word-logic-crypt",type:"Play",title:"Logic Crypt: Word & Deduction",summary:"Decipher secret code words using constraint clues, positional logic and letter elimination.",href:"play/word-logic/",keywords:["puzzle","word puzzle","logic puzzle","deduction","cipher","crypt","brain teaser"],tool:"cron-humanizer"},
{id:"agent-workflow",type:"Tool",title:"Design an agentic workflow",summary:"Turn a goal, tools and guardrails into a structured multi-agent workflow.",href:"?tool=agentic-workflow-generator",keywords:["agent","agentic","multi agent","workflow","orchestrator","ai workflow"],tool:"agentic-workflow-generator"},
{id:"image-smaller",type:"Tool",title:"Make an image smaller",summary:"Resize, convert and compress an image in your browser.",href:"?tool=image-studio",keywords:["compress image","make image smaller","resize image","image size","convert image"],tool:"image-studio"},
{id:"ai-prompt",type:"Tool",title:"Build a better AI prompt",summary:"Structure role, context, instructions, constraints and output requirements.",href:"?tool=ai-prompt-builder",keywords:["ai prompt","prompt","chatgpt prompt","build prompt","prompt builder"],tool:"ai-prompt-builder"},
{id:"invoice",type:"Tool",title:"Create an invoice",summary:"Build and export a professional invoice without an account.",href:"?tool=invoice-studio",keywords:["invoice","make invoice","create invoice","bill client"],tool:"invoice-studio"}
];
const normalise=s=>String(s||"").toLowerCase().replace(/[^a-z0-9+#.]+/g," ").trim();
function scoreIntent(query,item){
 const q=normalise(query);if(!q)return 0;const tokens=q.split(/\s+/).filter(Boolean);
 const hay=normalise([item.title,item.summary,...(item.keywords||[])].join(" "));
 let score=0;if(hay.includes(q))score+=20;
 for(const k of item.keywords||[]){const nk=normalise(k);if(q===nk)score+=18;else if(q.includes(nk)||nk.includes(q))score+=8}
 for(const token of tokens)if(token.length>1&&hay.includes(token))score+=2;
 return score;
}
function intentResults(query){
 const curated=knowledgeEntries.map(x=>({...x,score:scoreIntent(query,x)})).filter(x=>x.score>0);
 const toolMatches=(typeof tools!=="undefined"?tools:[]).filter(t=>t[1]!=="Compliance & AML").map(t=>({id:t[0],type:"Tool",title:t[2],summary:t[3],href:"?tool="+encodeURIComponent(t[0]),tool:t[0],keywords:[t[1]],score:scoreIntent(query,{title:t[2],summary:t[3],keywords:[t[1]]})})).filter(x=>x.score>0);
 return [...curated,...toolMatches].sort((a,b)=>b.score-a.score).filter((x,i,a)=>a.findIndex(y=>y.title===x.title)===i).slice(0,6);
}
function renderIntentResults(query){
 const host=document.querySelector("#intentResults");if(!host)return;
 const results=intentResults(query);
 if(!query.trim()){host.className="privacy-note";host.textContent="Describe the outcome you want — IntelliTools will match Tools, Learn and Labs.";return}
 if(!results.length){host.className="intent-results";host.innerHTML='<div class="intent-empty"><strong>No exact match yet.</strong><span>Try describing the result instead, such as “convert JSON to CSV” or “hide sensitive data”.</span></div>';return}
 host.className="intent-results";host.innerHTML=results.map(r=>'<a class="intent-hit" href="'+r.href+'"><span class="intent-type">'+r.type+'</span><strong>'+escapeIntent(r.title)+'</strong><small>'+escapeIntent(r.summary)+'</small><b>Open →</b></a>').join("");
}
function escapeIntent(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function routeIntent(){const q=document.querySelector("#intent")?.value||"";renderIntentResults(q)}
document.addEventListener("DOMContentLoaded",()=>{const input=document.querySelector("#intent");if(!input)return;input.addEventListener("input",()=>renderIntentResults(input.value));input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();routeIntent()}})});
