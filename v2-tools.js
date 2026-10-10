/* IntelliTools v2 workspaces — all processing is local to the browser. */
const v2Tools=[
  ["pii-secret-redactor","Privacy & Safety","PII & Secret Redactor","Detect and redact common sensitive data from prompts, logs and text before sharing."],
  ["curl-code-sanitizer","Developer","cURL → Code & Token Stripper","Strip common credentials from cURL requests and create a safer JavaScript fetch example."],
  ["fact-anchor-checker","Writing & Text","Fact Anchor Checker","Compare claims against supplied evidence and flag what is supported, partial or not found."],
  ["invoice-studio","Business","Invoice & Receipt Studio","Create professional invoices or receipts with tax, logo, currency, live preview and export."],
  ["image-studio","Images & Design","Image Studio","Convert, resize and compress images or generate a complete favicon pack."],
  ["color-studio","Images & Design","Gradient & Color Studio","Build CSS gradients and generate accessible palettes from a color or image."],
  ["converter-studio","Money & Calculators","Everyday Converter","Convert units, cooking measures and currencies with a clearly dated offline rate snapshot."],
  ["habit-journal","Productivity","Habit & Journal","Track daily habits, streaks, mood and private notes stored only on this device."],
  ["focus-timer","Productivity","Focus Timer","Run custom Pomodoro sessions and review private daily and weekly focus stats."],
  ["writing-studio","Writing & Text","Markdown & Text Studio","Write and preview Markdown, clean text, change case, count words and compare drafts."],
  ["password-studio","Privacy & Safety","Password & Passphrase Studio","Generate customizable passwords or memorable passphrases and check strength locally."],
  ["pdf-studio","Files & PDF","Private PDF Tools","Merge, split, rotate or optimize PDFs without uploading sensitive documents."],
  ["signature-studio","Business","Email Signature Builder","Design a polished signature with live preview and copy production-ready HTML."],
  ["qr-studio","Links & Web","QR Studio","Generate QR codes for URLs, text, Wi-Fi and contacts, or read one from an image or camera."],
  ["budget-studio","Money & Calculators","Envelope Budget","Plan a zero-based monthly budget, monitor categories and export your data."]
];
tools.push(...v2Tools);
const v2Ids=new Set(v2Tools.map(t=>t[0]));
const legacyOpenTool=openTool;
const DISCOVERY_RECENT_KEY="it.discovery.recent",DISCOVERY_FAV_KEY="it.discovery.favorites";
function discoveryLoad(key){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value.filter(x=>typeof x==="string"):[]}catch{return []}}
function discoverySave(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
function discoveryStorageAvailable(){const key="it.discovery.storage-test";try{localStorage.setItem(key,"1");localStorage.removeItem(key);return true}catch{return false}}
function rememberTool(id){const next=[id,...discoveryLoad(DISCOVERY_RECENT_KEY).filter(x=>x!==id)].slice(0,6);discoverySave(DISCOVERY_RECENT_KEY,next);renderDiscoveryShelf()}
function toggleFavorite(id,event){if(event){event.stopPropagation();event.preventDefault()}const fav=discoveryLoad(DISCOVERY_FAV_KEY),next=fav.includes(id)?fav.filter(x=>x!==id):[id,...fav].slice(0,12);discoverySave(DISCOVERY_FAV_KEY,next);renderCatalog();renderDiscoveryShelf()}
function discoveryCard(t){const fav=discoveryLoad(DISCOVERY_FAV_KEY).includes(t[0]);return '<button class="discovery-card" type="button" onclick="openTool(\''+t[0]+'\')"><span class="tag">'+esc(t[1])+'</span><strong>'+esc(t[2])+'</strong><small>'+esc(t[3])+'</small><span class="discovery-arrow">Open →</span></button>'}
function renderDiscoveryShelf(){const box=$("#discoveryShelf");if(!box)return;const fav=discoveryLoad(DISCOVERY_FAV_KEY).map(id=>tools.find(t=>t[0]===id)).filter(Boolean),recent=discoveryLoad(DISCOVERY_RECENT_KEY).map(id=>tools.find(t=>t[0]===id)).filter(Boolean);if(!fav.length&&!recent.length){box.innerHTML='<div class="discovery-empty"><strong>Your shortcuts will appear here.</strong><span>Open tools or tap ☆ on a tool card to build a private, on-device shortlist.</span></div>';return}box.innerHTML=(fav.length?'<div class="discovery-group"><div class="shelf-label">★ Favourites</div><div class="discovery-row">'+fav.map(discoveryCard).join("")+'</div></div>':'')+(recent.length?'<div class="discovery-group"><div class="shelf-label">Recently used</div><div class="discovery-row">'+recent.map(discoveryCard).join("")+'</div></div>':'')}
const categoryAliases={"Writing & Text":["Writing & Text","Text"],"Money & Calculators":["Money & Calculators"],"Files & PDF":["Files & PDF"],"Images & Design":["Images & Design"],"Business":["Business"]};
const growthPages={
"ai-prompt-builder":"ai-prompt-builder","pii-secret-redactor":"pii-secret-redactor","curl-code-sanitizer":"curl-token-stripper","fact-anchor-checker":"fact-anchor-checker",
"invoice-studio":"invoice-generator","image-studio":"image-compressor","pdf-studio":"private-pdf-tools","qr-studio":"qr-code-studio","password-studio":"password-generator","writing-studio":"markdown-text-studio"
};
const relatedTools={
"ai-prompt-builder":["pii-secret-redactor","fact-anchor-checker"],"pii-secret-redactor":["curl-code-sanitizer","ai-prompt-builder"],"curl-code-sanitizer":["pii-secret-redactor","json-formatter"],
"fact-anchor-checker":["ai-prompt-builder","writing-studio"],"invoice-studio":["budget-studio","percentage-change"],"image-studio":["qr-studio","color-studio"],
"pdf-studio":["pii-secret-redactor","invoice-studio"],"qr-studio":["url-cleaner","image-studio"],"password-studio":["metadata","pii-secret-redactor"],"writing-studio":["fact-anchor-checker","ai-prompt-builder"]
};
function relatedToolMarkup(id){const items=(relatedTools[id]||[]).map(x=>tools.find(t=>t[0]===x)).filter(Boolean);if(!items.length)return "";return '<aside class="related-tools no-print" aria-label="Related tools"><span class="eyebrow">NEXT STEP</span><h3>Continue your workflow</h3><div class="actions">'+items.map(t=>'<button class="btn alt" type="button" onclick="openTool(\''+t[0]+'\')">'+esc(t[2])+' →</button>').join("")+'</div></aside>'}
function shareToolMarkup(id){const slug=growthPages[id];if(!slug)return "";const url='https://intellitools.online/tools/'+slug+'.html';return '<a class="tool-share-link no-print" href="'+url+'" title="Open the shareable page for this tool">Shareable tool page ↗</a>'}


renderCatalog=function(){
  const box=$("#toolCatalog");if(!box)return;
  const q=($("#toolSearch")?.value||"").toLowerCase().trim(),selected=$("#categoryFilter")?.value||"All categories";
  const allowed=categoryAliases[selected]||[selected];
  const visible=tools.filter(t=>t[1]!=="Compliance & AML"&&(selected==="All categories"||allowed.includes(t[1]))&&(!q||t.join(" ").toLowerCase().includes(q)));
  box.innerHTML=visible.length?visible.map(t=>{const fav=discoveryLoad(DISCOVERY_FAV_KEY).includes(t[0]);return '<article class="toolcard '+(v2Ids.has(t[0])?'featured':'')+'"><button class="favorite-btn" type="button" aria-pressed="'+(fav?'true':'false')+'" aria-label="'+(fav?'Remove from favourites':'Add to favourites')+'" title="'+(fav?'Remove from favourites':'Add to favourites')+'" onclick="toggleFavorite(\''+t[0]+'\',event)">'+(fav?'★':'☆')+'</button><div><span class="tag">'+esc(t[1])+'</span>'+(v2Ids.has(t[0])?'<span class="tag new-tag">v2</span>':'')+'</div><h3>'+esc(t[2])+'</h3><p>'+esc(t[3])+'</p><button class="btn alt" type="button" onclick="openTool(\''+t[0]+'\')">Open tool →</button></article>'}).join(""):'<div class="empty"><strong>No matching tools.</strong><br>Try a broader task or another category.</div>';
  const count=$("#visibleCount");if(count)count.textContent=visible.length;
  const active=$("#activeCount");if(active)active.textContent=tools.filter(t=>t[1]!=="Compliance & AML").length;
};

function v2Shell(t,body){
  return '<div class="workspace-head"><div><span class="tag">'+esc(t[1])+'</span><span class="tag new-tag">v2</span><h2>'+esc(t[2])+'</h2><p class="desc">'+esc(t[3])+'</p>'+shareToolMarkup(t[0])+'</div><button class="btn alt no-print" type="button" onclick="closeTool()">Close</button></div>'+body+'<div id="out" aria-live="polite"></div>'+relatedToolMarkup(t[0]);
}
openTool=function(id){
  if(!v2Ids.has(id)){rememberTool(id);return legacyOpenTool(id)}
  rememberTool(id);const t=v2Tools.find(x=>x[0]===id),w=$("#workspace");
  stopCamera();w.innerHTML=v2Shell(t,v2Template(id));w.classList.add("active");w.focus({preventScroll:true});w.scrollIntoView({behavior:"smooth",block:"start"});
  if(id==="pii-secret-redactor")initRedactor();
  if(id==="curl-code-sanitizer")initCurlSanitizer();
  if(id==="fact-anchor-checker")initFactAnchor();
  if(id==="invoice-studio")initInvoice();
  if(id==="image-studio")initImageStudio();
  if(id==="color-studio")updateGradient();
  if(id==="converter-studio")initConverter();
  if(id==="habit-journal")renderHabit();
  if(id==="focus-timer")initTimer();
  if(id==="writing-studio")updateMarkdown();
  if(id==="password-studio")generatePasswordV2();
  if(id==="signature-studio")updateSignature();
  if(id==="qr-studio")initQR();
  if(id==="budget-studio")renderBudget();
  if(id==="ai-prompt-builder")initPromptBuilder();
};

function v2Template(id){
  if(id==="pii-secret-redactor")return redactorTemplate();
  if(id==="curl-code-sanitizer")return curlSanitizerTemplate();
  if(id==="fact-anchor-checker")return factAnchorTemplate();
  if(id==="invoice-studio")return invoiceTemplate();
  if(id==="image-studio")return imageTemplate();
  if(id==="color-studio")return colorTemplate();
  if(id==="converter-studio")return converterTemplate();
  if(id==="habit-journal")return habitTemplate();
  if(id==="focus-timer")return timerTemplate();
  if(id==="writing-studio")return writingTemplate();
  if(id==="password-studio")return passwordTemplate();
  if(id==="pdf-studio")return pdfTemplate();
  if(id==="signature-studio")return signatureTemplate();
  if(id==="qr-studio")return qrTemplate();
  if(id==="ai-prompt-builder")return promptBuilderTemplate();
  return budgetTemplate();
}
const input=(id,label,value="",type="text",extra="")=>'<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></div>';
const select=(id,label,options)=>'<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+options.map(o=>'<option value="'+esc(Array.isArray(o)?o[0]:o)+'">'+esc(Array.isArray(o)?o[1]:o)+'</option>').join("")+'</select></div>';
const todayISO=()=>new Date().toISOString().slice(0,10);
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function saveJSON(key,value){localStorage.setItem("it.v2."+key,JSON.stringify(value))}
function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem("it.v2."+key))??fallback}catch{return fallback}}

function invoiceTemplate(){
 return '<div class="tabs no-print"><button class="active" data-doc="invoice" onclick="setDocType(\'invoice\',this)">Invoice</button><button data-doc="receipt" onclick="setDocType(\'receipt\',this)">Receipt</button></div><div class="grid2"><div class="no-print">'+
 input("invFrom","Your business","Acme Studio")+input("invEmail","Business email","hello@example.com","email")+input("invClient","Bill to","Client name")+input("invNumber","Document number","INV-001")+
 '<div class="grid2">'+input("invDate","Issue date",todayISO(),"date")+input("invDue","Due date",new Date(Date.now()+14*864e5).toISOString().slice(0,10),"date")+'</div>'+
 '<div class="grid2">'+select("invCurrency","Currency",[["AED","AED — د.إ"],["USD","USD — $"],["EUR","EUR — €"],["GBP","GBP — £"],["INR","INR — ₹"]])+input("invTax","Tax %","5","number",'min="0" step="0.01"')+'</div>'+
 '<div class="field"><label for="invLogo">Logo (optional)</label><input id="invLogo" type="file" accept="image/*"></div><div id="invoiceItems"></div><button class="btn alt small" type="button" onclick="addInvoiceItem()">+ Add line item</button>'+
 '<div class="field"><label for="invNotes">Notes / payment terms</label><textarea id="invNotes" rows="3">Thank you for your business.</textarea></div>'+
 '<div class="actions"><button class="btn" type="button" onclick="printInvoice()">Print / Save PDF</button><button class="btn alt" type="button" onclick="exportInvoiceHTML()">Export HTML</button><button class="btn alt" type="button" onclick="saveInvoiceDraft()">Save draft</button></div></div>'+
 '<div class="preview-pane"><div id="invoicePreview" class="invoice-paper print-area"></div></div></div>';
}
function imageTemplate(){
 return '<div class="tabs"><button class="active" onclick="imageMode(\'convert\',this)">Convert & compress</button><button onclick="imageMode(\'favicon\',this)">Favicon pack</button></div>'+
 '<div class="grid2"><div><div class="dropzone" id="imageDrop"><strong>Choose or drop an image</strong><p>PNG, JPG, WebP, GIF and browser-supported HEIC/HEIF.</p><input id="imageFile" type="file" accept="image/*,.heic,.heif"></div><div id="imageControls">'+
 '<div class="grid2">'+input("imgWidth","Width (px)","","number",'min="1"')+input("imgHeight","Height (px)","","number",'min="1"')+'</div>'+
 '<label class="note"><input id="imgLock" type="checkbox" checked> Keep aspect ratio</label>'+select("imgFormat","Output format",[["image/png","PNG"],["image/jpeg","JPG"],["image/webp","WebP"]])+
 '<div class="field"><label for="imgQuality">Quality <span id="qualityLabel">82%</span></label><div class="range-row"><input id="imgQuality" type="range" min="10" max="100" value="82"><output>82</output></div></div>'+
 '<div class="actions"><button class="btn" type="button" onclick="processImage()">Process image</button><button class="btn alt" type="button" onclick="downloadProcessedImage()">Download</button></div></div>'+
 '<div id="faviconControls" class="hidden"><p class="note">Creates 16, 32, 48, 180, 192 and 512 px PNG files plus an HTML snippet. Download each size below.</p><button class="btn" type="button" onclick="generateFavicons()">Generate favicon set</button><div id="faviconDownloads" class="actions"></div></div></div>'+
 '<div><div class="canvas-wrap"><canvas id="imageCanvas"></canvas></div><div id="imageMeta" class="result">Choose an image to preview it here.</div></div></div>';
}
function colorTemplate(){
 return '<div class="tabs"><button class="active" onclick="colorMode(\'gradient\',this)">Gradient builder</button><button onclick="colorMode(\'palette\',this)">Palette generator</button></div>'+
 '<div id="gradientPanel" class="grid2"><div>'+select("gradientType","Gradient type",[["linear","Linear"],["radial","Radial"],["conic","Conic"]])+input("gradientAngle","Angle","135","number")+
 '<div class="grid2">'+input("gradientA","Start color","#5746e8","color")+input("gradientB","End color","#23c9b8","color")+'</div><button class="btn" onclick="updateGradient()">Update gradient</button><div id="gradientCode" class="result"></div></div><div id="gradientPreview" class="gradient-preview"></div></div>'+
 '<div id="palettePanel" class="hidden"><div class="grid2"><div>'+input("paletteBase","Base color","#5746e8","color")+'<div class="field"><label for="paletteImage">Or sample an image</label><input id="paletteImage" type="file" accept="image/*"></div><button class="btn" onclick="generatePalette()">Generate palette</button></div><div><div id="paletteSwatches" class="swatches"></div><p class="note">Click a swatch to copy its hex value.</p></div></div></div>';
}
function converterTemplate(){
 const units=[["length","Length"],["weight","Weight"],["volume","Volume"],["temperature","Temperature"],["cooking","Cooking"],["currency","Currency"]];
 return '<div class="grid2"><div>'+select("convertCategory","Category",units)+input("convertValue","Value","1","number",'step="any"')+select("convertFrom","From",[])+select("convertTo","To",[])+'<button class="btn" onclick="runConversion()">Convert</button></div><div><div id="conversionResult" class="result">Choose a category and enter a value.</div><p id="rateNote" class="note"></p></div></div>';
}
function habitTemplate(){
 return '<div class="grid2"><div>'+input("habitName","Habit name","Daily focus")+input("habitDate","Date",todayISO(),"date")+
 '<div class="field"><label for="habitMood">Mood <span id="moodLabel">3 / 5</span></label><input id="habitMood" type="range" min="1" max="5" value="3"></div>'+
 '<label><input id="habitDone" type="checkbox"> Completed today</label><div class="field"><label for="habitNote">Private journal note</label><textarea id="habitNote" rows="5" placeholder="What helped today?"></textarea></div>'+
 '<div class="actions"><button class="btn" onclick="saveHabitEntry()">Save day</button><button class="btn alt" onclick="exportHabits(\'csv\')">Export CSV</button><button class="btn alt" onclick="exportHabits(\'md\')">Export Markdown</button></div></div>'+
 '<div><div class="metricgrid"><div class="metric"><small>Current streak</small><strong id="habitStreak">0</strong></div><div class="metric"><small>Best streak</small><strong id="habitBest">0</strong></div><div class="metric"><small>Completed</small><strong id="habitTotal">0</strong></div><div class="metric"><small>Avg mood</small><strong id="habitMoodAvg">—</strong></div></div><h3>Last 7 days</h3><div id="habitWeek" class="habit-week"></div><div id="habitEntries"></div></div></div>';
}
function timerTemplate(){
 return '<div class="grid2"><div><div id="timerPhase" class="tag">FOCUS</div><div id="timerFace" class="timer-face">25:00</div><div class="progress"><i id="timerProgress" style="width:0"></i></div><div class="actions" style="justify-content:center"><button id="timerStart" class="btn" onclick="toggleTimer()">Start</button><button class="btn alt" onclick="resetTimer()">Reset</button><button class="btn alt" onclick="skipTimer()">Skip</button></div>'+
 '<div class="grid3">'+input("focusMinutes","Focus minutes","25","number",'min="1" max="180"')+input("breakMinutes","Break minutes","5","number",'min="1" max="60"')+input("longBreakMinutes","Long break","15","number",'min="1" max="90"')+'</div></div>'+
 '<div><h3>Focus stats</h3><div class="metricgrid"><div class="metric"><small>Today</small><strong id="focusToday">0m</strong></div><div class="metric"><small>This week</small><strong id="focusWeek">0m</strong></div><div class="metric"><small>Sessions</small><strong id="focusSessions">0</strong></div><div class="metric"><small>Cycle</small><strong id="focusCycle">1/4</strong></div></div><p class="note">Stats are stored only in this browser. Keep this tab open while a session is running.</p></div></div>';
}
function writingTemplate(){
 return '<div class="tabs"><button class="active" onclick="writingMode(\'markdown\',this)">Markdown</button><button onclick="writingMode(\'text\',this)">Text utilities</button><button onclick="writingMode(\'diff\',this)">Compare</button></div>'+
 '<div id="markdownPanel" class="grid2"><div class="field"><label for="mdInput">Markdown <span id="mdStats"></span></label><textarea id="mdInput" rows="18"># A clear document\n\nWrite **Markdown** here and preview it instantly.\n\n- Private\n- Fast\n- Exportable</textarea></div><div><div id="mdPreview" class="markdown-preview"></div><div class="actions"><button class="btn alt" onclick="downloadMarkdown()">Download .md</button><button class="btn alt" onclick="copyMarkdownHTML()">Copy HTML</button></div></div></div>'+
 '<div id="textPanel" class="hidden"><div class="field"><label for="textStudioInput">Text</label><textarea id="textStudioInput" rows="12"></textarea></div><div class="actions"><button class="btn" onclick="transformText(\'clean\')">Clean whitespace</button><button class="btn alt" onclick="transformText(\'upper\')">UPPERCASE</button><button class="btn alt" onclick="transformText(\'lower\')">lowercase</button><button class="btn alt" onclick="transformText(\'title\')">Title Case</button></div><div id="textStudioStats" class="result"></div></div>'+
 '<div id="diffPanel" class="hidden"><div class="grid2"><div class="field"><label for="diffA">Version A</label><textarea id="diffA" rows="12"></textarea></div><div class="field"><label for="diffB">Version B</label><textarea id="diffB" rows="12"></textarea></div></div><button class="btn" onclick="compareV2()">Compare drafts</button><div id="diffResult"></div></div>';
}
function passwordTemplate(){
 return '<div class="tabs"><button class="active" onclick="passwordMode(\'password\',this)">Password</button><button onclick="passwordMode(\'passphrase\',this)">Passphrase</button><button onclick="passwordMode(\'check\',this)">Strength check</button></div><div class="grid2"><div>'+
 '<div id="passwordControls">'+input("passwordLength","Length","20","number",'min="8" max="128"')+'<label><input id="pwUpper" type="checkbox" checked> Uppercase</label><br><label><input id="pwLower" type="checkbox" checked> Lowercase</label><br><label><input id="pwNumbers" type="checkbox" checked> Numbers</label><br><label><input id="pwSymbols" type="checkbox" checked> Symbols</label></div>'+
 '<div id="passphraseControls" class="hidden">'+input("phraseWords","Number of words","5","number",'min="3" max="10"')+input("phraseSeparator","Separator","-")+'<label><input id="phraseNumber" type="checkbox" checked> Add a random number</label></div>'+
 '<div id="strengthControls" class="hidden">'+input("strengthInput","Password to check","","password",'autocomplete="new-password"')+'<p class="note">The password never leaves this browser and is not stored.</p></div>'+
 '<button class="btn" onclick="generatePasswordV2()">Generate / check</button></div><div><div id="passwordOutput" class="result"></div><div class="strength"><i id="strengthBar"></i></div><p id="strengthText" class="note"></p><button class="btn alt" onclick="copyPassword()">Copy</button></div></div>';
}
function pdfTemplate(){
 return '<div class="tabs"><button class="active" onclick="pdfMode(\'merge\',this)">Merge</button><button onclick="pdfMode(\'split\',this)">Split</button><button onclick="pdfMode(\'rotate\',this)">Rotate</button><button onclick="pdfMode(\'optimize\',this)">Optimize</button></div>'+
 '<div class="dropzone"><strong>Select PDF file(s)</strong><p id="pdfHelp">Choose two or more files in the order you want to merge.</p><input id="pdfFiles" type="file" accept="application/pdf" multiple></div>'+
 '<div id="pdfOptions"><div id="splitOption" class="hidden">'+input("pdfRange","Page ranges","1-2,4")+'<p class="note">Examples: 1-3 or 1,3,5-7.</p></div><div id="rotateOption" class="hidden">'+select("pdfRotation","Rotate all pages by",["90","180","270"])+'</div></div>'+
 '<div class="actions"><button class="btn" onclick="processPDF()">Process PDF locally</button></div><div id="pdfStatus" class="result">No PDF has been read yet.</div>';
}
function signatureTemplate(){
 return '<div class="grid2"><div>'+input("sigName","Name","Naveen Kumar")+input("sigTitle","Role","Vice President")+input("sigCompany","Company","Company name")+input("sigPhone","Phone","+971 ")+input("sigEmail","Email","name@example.com","email")+input("sigWebsite","Website","https://example.com")+input("sigLinkedIn","LinkedIn URL","")+
 '<div class="grid2">'+input("sigColor","Accent color","#5746e8","color")+select("sigLayout","Layout",[["line","Vertical line"],["compact","Compact"],["card","Card"]])+'</div><div class="actions"><button class="btn" onclick="copySignature()">Copy signature</button><button class="btn alt" onclick="downloadSignature()">Download HTML</button></div></div><div><div id="signaturePreview" class="signature-preview"></div><p class="note">Copy and paste into your email client’s signature editor. Some clients may adjust fonts or spacing.</p></div></div>';
}
function qrTemplate(){
 return '<div class="tabs"><button class="active" onclick="qrMode(\'generate\',this)">Generate</button><button onclick="qrMode(\'read\',this)">Read QR</button></div>'+
 '<div id="qrGenerate" class="grid2"><div>'+select("qrType","QR type",[["url","URL"],["text","Text"],["wifi","Wi-Fi"],["contact","Contact card"]])+'<div id="qrFields"></div><div class="grid2">'+input("qrColor","Foreground","#111827","color")+input("qrBg","Background","#ffffff","color")+'</div>'+select("qrLevel","Error correction",[["L","Low"],["M","Medium"],["Q","Quartile"],["H","High"]])+'<button class="btn" onclick="generateQR()">Generate QR</button></div><div><div class="canvas-wrap"><div id="qrOutput"></div></div><div class="actions"><button class="btn alt" onclick="downloadQR()">Download PNG</button></div></div></div>'+
 '<div id="qrRead" class="hidden grid2"><div><div class="field"><label for="qrImage">Read from image</label><input id="qrImage" type="file" accept="image/*"></div><button class="btn alt" onclick="readQRImage()">Read image</button><button class="btn" onclick="startCamera()">Use camera</button><button class="btn danger" onclick="stopCamera()">Stop camera</button></div><div><video id="qrVideo" playsinline muted style="width:100%;border-radius:12px"></video><div id="qrReadResult" class="result">No QR code read yet.</div></div></div>';
}
function budgetTemplate(){
 return '<div class="grid2"><div>'+input("budgetMonth","Month",todayISO().slice(0,7),"month")+input("budgetIncome","Monthly income","10000","number",'min="0" step="0.01"')+'<div id="budgetRows"></div><button class="btn alt small" onclick="addBudgetRow()">+ Add envelope</button><div class="actions"><button class="btn" onclick="saveBudget()">Save budget</button><button class="btn alt" onclick="exportBudget()">Export CSV</button><button class="btn danger" onclick="resetBudget()">Reset month</button></div></div>'+
 '<div><div class="metricgrid"><div class="metric"><small>Income</small><strong id="budgetIncomeView">0</strong></div><div class="metric"><small>Planned</small><strong id="budgetPlanned">0</strong></div><div class="metric"><small>Spent</small><strong id="budgetSpent">0</strong></div><div class="metric"><small>Unassigned</small><strong id="budgetLeft">0</strong></div></div><div id="budgetSummary"></div><p class="note">Amounts use your preferred currency. The budget is saved only on this device.</p></div></div>';
}

/* Invoice / receipt studio */
let invoiceLogo="",documentType="invoice";
function initInvoice(){
  const draft=loadJSON("invoice-draft",null);
  $("#invoiceItems").innerHTML="";
  (draft?.items||[{description:"Professional services",qty:1,price:500}]).forEach(addInvoiceItem);
  if(draft){["invFrom","invEmail","invClient","invNumber","invDate","invDue","invCurrency","invTax","invNotes"].forEach(id=>{if(draft[id]!=null&&$("#"+id))$("#"+id).value=draft[id]});invoiceLogo=draft.logo||"";documentType=draft.type||"invoice"}
  $("#workspace").addEventListener("input",e=>{if(e.target.closest("#workspace"))updateInvoice()});
  $("#invLogo").addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;invoiceLogo=await fileToDataURL(f);updateInvoice()});
  updateInvoice();
}
function addInvoiceItem(item={description:"",qty:1,price:0}){
  const row=document.createElement("div");row.className="item-row";row.innerHTML='<div class="field"><label>Description</label><input class="item-desc" value="'+esc(item.description||"")+'"></div><div class="field"><label>Qty</label><input class="item-qty" type="number" min="0" step="any" value="'+(+item.qty||0)+'"></div><div class="field"><label>Price</label><input class="item-price" type="number" min="0" step="0.01" value="'+(+item.price||0)+'"></div><button class="btn danger small" type="button" aria-label="Remove item" onclick="this.parentElement.remove();updateInvoice()">×</button>';
  $("#invoiceItems").appendChild(row);updateInvoice();
}
function setDocType(type,button){documentType=type;button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));updateInvoice()}
function currencySymbol(c){return({AED:"AED ",USD:"$",EUR:"€",GBP:"£",INR:"₹"})[c]||c+" "}
function invoiceData(){
 const items=[...document.querySelectorAll(".item-row")].map(r=>({description:r.querySelector(".item-desc").value,qty:+r.querySelector(".item-qty").value||0,price:+r.querySelector(".item-price").value||0}));
 const data={items,logo:invoiceLogo,type:documentType};["invFrom","invEmail","invClient","invNumber","invDate","invDue","invCurrency","invTax","invNotes"].forEach(id=>data[id]=$("#"+id)?.value||"");return data;
}
function updateInvoice(){
 if(!$("#invoicePreview"))return;const d=invoiceData(),sym=currencySymbol(d.invCurrency),sub=d.items.reduce((n,x)=>n+x.qty*x.price,0),tax=sub*(+d.invTax||0)/100,total=sub+tax;
 $("#invoicePreview").innerHTML='<div class="invoice-top"><div>'+(d.logo?'<img class="invoice-logo" src="'+d.logo+'" alt="Business logo">':'<h2>'+esc(d.invFrom||"Your business")+'</h2>')+'<p>'+esc(d.invEmail)+'</p></div><div style="text-align:right"><h1 style="text-transform:uppercase">'+esc(d.type)+'</h1><b>'+esc(d.invNumber)+'</b><br><small>Issued '+esc(d.invDate)+(d.type==="invoice"?" · Due "+esc(d.invDue):"")+'</small></div></div><div style="margin-top:34px"><small>'+(d.type==="invoice"?"BILL TO":"RECEIVED FROM")+'</small><h3 style="margin:3px 0">'+esc(d.invClient||"Client")+'</h3></div><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>'+d.items.map(x=>'<tr><td>'+esc(x.description||"Item")+'</td><td>'+x.qty+'</td><td>'+sym+x.price.toFixed(2)+'</td><td>'+sym+(x.qty*x.price).toFixed(2)+'</td></tr>').join("")+'</tbody></table><div class="invoice-total"><div><span>Subtotal</span><b>'+sym+sub.toFixed(2)+'</b></div><div><span>Tax ('+(+d.invTax||0)+'%)</span><b>'+sym+tax.toFixed(2)+'</b></div><div class="grand"><span>Total</span><span>'+sym+total.toFixed(2)+'</span></div></div><p style="margin-top:45px;white-space:pre-wrap">'+esc(d.invNotes)+'</p>';
}
function saveInvoiceDraft(){saveJSON("invoice-draft",invoiceData());result("Draft saved only in this browser.")}
function printInvoice(){updateInvoice();window.print()}
function exportInvoiceHTML(){updateInvoice();const html='<!doctype html><meta charset="utf-8"><title>'+esc($("#invNumber").value)+'</title><style>body{font:14px Arial;color:#17182d;margin:40px}.invoice-paper{max-width:760px;margin:auto}.invoice-top{display:flex;justify-content:space-between}.invoice-logo{max-width:150px;max-height:70px}table{width:100%;border-collapse:collapse;margin:28px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th:last-child,td:last-child{text-align:right}.invoice-total{margin-left:auto;width:300px}.invoice-total div{display:flex;justify-content:space-between;padding:5px}.grand{font-size:20px;font-weight:bold;border-top:2px solid}</style><div class="invoice-paper">'+$("#invoicePreview").innerHTML+'</div>';downloadBlob(new Blob([html],{type:"text/html"}),($("#invNumber").value||"invoice")+".html")}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

/* Image studio */
let imageSource=null,imageOutputBlob=null,imageModeName="convert";
function initImageStudio(){
 const file=$("#imageFile"),drop=$("#imageDrop"),quality=$("#imgQuality");
 file.addEventListener("change",()=>loadImageFile(file.files[0]));
 ["dragenter","dragover"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add("drag")}));
 ["dragleave","drop"].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove("drag")}));
 drop.addEventListener("drop",e=>loadImageFile(e.dataTransfer.files[0]));
 quality.addEventListener("input",()=>{quality.nextElementSibling.value=quality.value;$("#qualityLabel").textContent=quality.value+"%"});
 $("#imgWidth").addEventListener("input",()=>syncImageDimension("w"));$("#imgHeight").addEventListener("input",()=>syncImageDimension("h"));
}
function imageMode(mode,button){imageModeName=mode;button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));$("#imageControls").classList.toggle("hidden",mode!=="convert");$("#faviconControls").classList.toggle("hidden",mode!=="favicon")}
async function loadImageFile(file){
 if(!file)return;try{let bitmap=await createImageBitmap(file);imageSource={bitmap,file,width:bitmap.width,height:bitmap.height,ratio:bitmap.width/bitmap.height};$("#imgWidth").value=bitmap.width;$("#imgHeight").value=bitmap.height;drawImagePreview(bitmap,bitmap.width,bitmap.height);$("#imageMeta").textContent=file.name+" · "+bitmap.width+" × "+bitmap.height+" · "+formatBytes(file.size);imageOutputBlob=null}catch(e){$("#imageMeta").textContent="This browser could not decode that image. HEIC/HEIF support varies; try JPEG, PNG or WebP."}
}
function syncImageDimension(changed){if(!imageSource||!$("#imgLock").checked)return;if(changed==="w")$("#imgHeight").value=Math.max(1,Math.round(+$("#imgWidth").value/imageSource.ratio));else $("#imgWidth").value=Math.max(1,Math.round(+$("#imgHeight").value*imageSource.ratio))}
function drawImagePreview(bitmap,w,h){const c=$("#imageCanvas"),max=1200,scale=Math.min(1,max/Math.max(w,h));c.width=Math.max(1,Math.round(w*scale));c.height=Math.max(1,Math.round(h*scale));c.getContext("2d").drawImage(bitmap,0,0,c.width,c.height)}
async function canvasBlob(canvas,type,quality){return new Promise(resolve=>canvas.toBlob(resolve,type,quality))}
async function processImage(){
 if(!imageSource)return result("Choose an image first.");const w=Math.max(1,+$("#imgWidth").value||imageSource.width),h=Math.max(1,+$("#imgHeight").value||imageSource.height),type=$("#imgFormat").value,q=+$("#imgQuality").value/100,c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(imageSource.bitmap,0,0,w,h);imageOutputBlob=await canvasBlob(c,type,q);drawImagePreview(c,w,h);$("#imageMeta").textContent=w+" × "+h+" · "+type.replace("image/","").toUpperCase()+" · "+formatBytes(imageOutputBlob.size)+" ("+Math.round((1-imageOutputBlob.size/imageSource.file.size)*100)+"% size change)";
}
function downloadProcessedImage(){if(!imageOutputBlob)return result("Process the image before downloading.");const ext=imageOutputBlob.type.split("/")[1].replace("jpeg","jpg");downloadBlob(imageOutputBlob,"intellitools-image."+ext)}
async function generateFavicons(){
 if(!imageSource)return result("Choose a square source image first.");const sizes=[16,32,48,180,192,512],box=$("#faviconDownloads");box.innerHTML="";for(const size of sizes){const c=document.createElement("canvas");c.width=c.height=size;c.getContext("2d").drawImage(imageSource.bitmap,0,0,size,size);const blob=await canvasBlob(c,"image/png");const b=document.createElement("button");b.className="btn alt small";b.textContent=size+"×"+size;b.onclick=()=>downloadBlob(blob,"favicon-"+size+".png");box.appendChild(b)}const snippet='<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">\n<link rel="manifest" href="/site.webmanifest">';const pre=document.createElement("div");pre.className="result";pre.textContent=snippet;box.after(pre);
}
function formatBytes(n){if(n<1024)return n+" B";if(n<1048576)return(n/1024).toFixed(1)+" KB";return(n/1048576).toFixed(2)+" MB"}

/* Gradient and palette studio */
function colorMode(mode,button){button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));$("#gradientPanel").classList.toggle("hidden",mode!=="gradient");$("#palettePanel").classList.toggle("hidden",mode!=="palette")}
function updateGradient(){if(!$("#gradientPreview"))return;const type=$("#gradientType").value,a=$("#gradientA").value,b=$("#gradientB").value,angle=+$("#gradientAngle").value||0;const css=type==="linear"?'linear-gradient('+angle+'deg, '+a+', '+b+')':type==="radial"?'radial-gradient(circle, '+a+', '+b+')':'conic-gradient(from '+angle+'deg, '+a+', '+b+', '+a+')';$("#gradientPreview").style.background=css;$("#gradientCode").textContent="background: "+css+";";$("#gradientCode").onclick=()=>navigator.clipboard?.writeText("background: "+css+";")}
function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function rgbHex(r,g,b){return"#"+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("")}
function mixColor(hex,target,amount){const a=hexRgb(hex),b=hexRgb(target);return rgbHex(...a.map((x,i)=>x+(b[i]-x)*amount))}
async function generatePalette(){
 let base=$("#paletteBase").value,file=$("#paletteImage").files[0];if(file){try{const bmp=await createImageBitmap(file),c=document.createElement("canvas");c.width=c.height=40;const x=c.getContext("2d");x.drawImage(bmp,0,0,40,40);const d=x.getImageData(0,0,40,40).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=16){if(d[i+3]>100){r+=d[i];g+=d[i+1];b+=d[i+2];n++}}base=rgbHex(r/n,g/n,b/n);$("#paletteBase").value=base}catch{}}
 const colors=[mixColor(base,"#ffffff",.75),mixColor(base,"#ffffff",.4),base,mixColor(base,"#000000",.28),mixColor(base,"#000000",.55)];$("#paletteSwatches").innerHTML=colors.map(c=>'<button class="swatch" onclick="navigator.clipboard?.writeText(\''+c+'\')"><i style="background:'+c+'"></i><small>'+c+'</small></button>').join("");
}

/* Unit, cooking and offline currency converter */
const converterUnits={
 length:{m:1,km:1000,cm:.01,mm:.001,mi:1609.344,yd:.9144,ft:.3048,inch:.0254},
 weight:{kg:1,g:.001,mg:.000001,lb:.45359237,oz:.0283495231},
 volume:{L:1,mL:.001,"US cup":.236588,"US tbsp":.0147868,"US tsp":.00492892,"US fl oz":.0295735,"UK pint":.568261},
 cooking:{mL:1,"metric cup":250,"US cup":236.588,tbsp:15,tsp:5,"fl oz":29.5735},
 currency:{AED:.272294,USD:1,EUR:1.149,GBP:1.33947,INR:.010436,SAR:.266667,QAR:.274725,OMR:2.60078}
};
let conversionCategory="length";
function initConverter(){$("#convertCategory").addEventListener("change",()=>{conversionCategory=$("#convertCategory").value;populateConverterUnits()});populateConverterUnits()}
function populateConverterUnits(){const c=$("#convertCategory").value,keys=c==="temperature"?["Celsius","Fahrenheit","Kelvin"]:Object.keys(converterUnits[c]);$("#convertFrom").innerHTML=keys.map(x=>'<option>'+x+'</option>').join("");$("#convertTo").innerHTML=keys.map(x=>'<option>'+x+'</option>').join("");if(keys[1])$("#convertTo").selectedIndex=1;$("#rateNote").innerHTML=c==="currency"?'Offline reference snapshot dated 21 September 2026. EUR, GBP and INR cross-rates use the <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html" target="_blank" rel="noopener noreferrer">ECB reference rates</a>; GCC values use their USD pegs. Informational only—not a live bank/card quote.':""}
function runConversion(){const c=$("#convertCategory").value,v=+$("#convertValue").value,from=$("#convertFrom").value,to=$("#convertTo").value;if(!Number.isFinite(v))return $("#conversionResult").textContent="Enter a valid number.";let out;if(c==="temperature"){const cel=from==="Celsius"?v:from==="Fahrenheit"?(v-32)*5/9:v-273.15;out=to==="Celsius"?cel:to==="Fahrenheit"?cel*9/5+32:cel+273.15}else{const map=converterUnits[c];out=v*map[from]/map[to]}$("#conversionResult").innerHTML='<strong>'+v.toLocaleString()+' '+esc(from)+'</strong><br>= <strong style="font-size:28px">'+Number(out.toPrecision(12)).toLocaleString(undefined,{maximumFractionDigits:8})+' '+esc(to)+'</strong>'}

/* Habit and journal */
function habitRecords(){return loadJSON("habit-records",[])}
function saveHabitEntry(){
 const name=$("#habitName").value.trim()||"Habit",date=$("#habitDate").value;if(!date)return result("Choose a date.");
 const records=habitRecords(),entry={name,date,done:$("#habitDone").checked,mood:+$("#habitMood").value,note:$("#habitNote").value.trim(),updatedAt:new Date().toISOString()},i=records.findIndex(x=>x.name===name&&x.date===date);
 if(i>=0)records[i]=entry;else records.push(entry);saveJSON("habit-records",records);renderHabit();result("Day saved locally.");
}
function dayNumber(s){return Math.floor(new Date(s+"T00:00:00").getTime()/864e5)}
function streakStats(doneDates){
 const nums=[...new Set(doneDates.map(dayNumber))].sort((a,b)=>a-b);let best=0,run=0,last=null;for(const n of nums){run=last!=null&&n===last+1?run+1:1;best=Math.max(best,run);last=n}
 const today=dayNumber(todayISO()),set=new Set(nums),start=set.has(today)?today:today-1;let current=0;while(set.has(start-current))current++;return{current,best};
}
function renderHabit(){
 if(!$("#habitWeek"))return;const records=habitRecords(),name=$("#habitName")?.value.trim()||"Daily focus",filtered=records.filter(x=>x.name===name),done=filtered.filter(x=>x.done),streak=streakStats(done.map(x=>x.date));$("#habitStreak").textContent=streak.current;$("#habitBest").textContent=streak.best;$("#habitTotal").textContent=done.length;$("#habitMoodAvg").textContent=filtered.length?(filtered.reduce((n,x)=>n+(x.mood||0),0)/filtered.length).toFixed(1):"—";
 const days=[];for(let i=6;i>=0;i--){const date=new Date(Date.now()-i*864e5).toISOString().slice(0,10),entry=filtered.find(x=>x.date===date);days.push('<div class="daybox '+(entry?.done?"done":"")+'"><small>'+new Date(date+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"})+'</small><br><b>'+(entry?.done?"✓":"—")+'</b></div>')}$("#habitWeek").innerHTML=days.join("");
 $("#habitEntries").innerHTML=filtered.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(x=>'<div class="result"><strong>'+esc(x.date)+' · '+(x.done?"Completed":"Not completed")+' · Mood '+x.mood+'/5</strong>'+(x.note?"\n"+esc(x.note):"")+'</div>').join("");
 $("#habitMood")?.addEventListener("input",()=>$("#moodLabel").textContent=$("#habitMood").value+" / 5");
 $("#habitName")?.addEventListener("change",renderHabit);
}
function exportHabits(type){const r=habitRecords();if(!r.length)return result("Save at least one day first.");if(type==="csv"){const csv="Habit,Date,Completed,Mood,Note\n"+r.map(x=>[x.name,x.date,x.done,x.mood,x.note].map(csvCell).join(",")).join("\n");downloadBlob(new Blob([csv],{type:"text/csv"}),"intellitools-habits.csv")}else{const md="# Habit journal\n\n"+r.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>"## "+x.date+" — "+x.name+"\n\n- Completed: "+(x.done?"Yes":"No")+"\n- Mood: "+x.mood+"/5\n\n"+(x.note||"")).join("\n\n");downloadBlob(new Blob([md],{type:"text/markdown"}),"intellitools-habits.md")}}
function csvCell(v){const s=String(v??"");return'"'+s.replaceAll('"','""')+'"'}

/* Focus timer */
let timerState={phase:"focus",remaining:1500,total:1500,running:false,endsAt:0,cycle:1},timerTick=null;
function initTimer(){timerState={phase:"focus",remaining:(+$("#focusMinutes").value||25)*60,total:(+$("#focusMinutes").value||25)*60,running:false,endsAt:0,cycle:1};["focusMinutes","breakMinutes","longBreakMinutes"].forEach(id=>$("#"+id).addEventListener("change",resetTimer));renderTimer();renderFocusStats()}
function toggleTimer(){if(timerState.running){timerState.remaining=Math.max(0,Math.round((timerState.endsAt-Date.now())/1000));timerState.running=false;clearInterval(timerTick)}else{timerState.running=true;timerState.endsAt=Date.now()+timerState.remaining*1000;timerTick=setInterval(tickTimer,250)}renderTimer()}
function tickTimer(){timerState.remaining=Math.max(0,Math.ceil((timerState.endsAt-Date.now())/1000));if(timerState.remaining<=0){clearInterval(timerTick);timerState.running=false;completeTimerPhase()}renderTimer()}
function completeTimerPhase(){
 if(timerState.phase==="focus"){const stats=loadJSON("focus-stats",[]),minutes=+$("#focusMinutes").value||25;stats.push({date:todayISO(),minutes,at:new Date().toISOString()});saveJSON("focus-stats",stats);timerState.phase=timerState.cycle%4===0?"long break":"break";timerState.total=timerState.remaining=(timerState.phase==="long break"?+$("#longBreakMinutes").value:+$("#breakMinutes").value)*60}else{timerState.phase="focus";timerState.cycle=timerState.cycle%4+1;timerState.total=timerState.remaining=(+$("#focusMinutes").value||25)*60}renderFocusStats();try{new Notification("IntelliTools timer",{body:timerState.phase==="focus"?"Ready for the next focus session.":"Focus session complete. Time for a break."})}catch{}
}
function resetTimer(){clearInterval(timerTick);timerState.running=false;timerState.phase="focus";timerState.total=timerState.remaining=(+$("#focusMinutes").value||25)*60;renderTimer()}
function skipTimer(){clearInterval(timerTick);timerState.running=false;if(timerState.phase==="focus"){timerState.phase="break";timerState.total=timerState.remaining=(+$("#breakMinutes").value||5)*60}else{timerState.phase="focus";timerState.total=timerState.remaining=(+$("#focusMinutes").value||25)*60}renderTimer()}
function renderTimer(){if(!$("#timerFace"))return;const m=Math.floor(timerState.remaining/60),s=timerState.remaining%60;$("#timerFace").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");$("#timerPhase").textContent=timerState.phase.toUpperCase();$("#timerStart").textContent=timerState.running?"Pause":"Start";$("#timerProgress").style.width=(100*(1-timerState.remaining/timerState.total))+"%";$("#focusCycle").textContent=timerState.cycle+"/4"}
function renderFocusStats(){if(!$("#focusToday"))return;const stats=loadJSON("focus-stats",[]),today=todayISO(),weekAgo=Date.now()-7*864e5,tm=stats.filter(x=>x.date===today).reduce((n,x)=>n+x.minutes,0),wm=stats.filter(x=>new Date(x.at).getTime()>=weekAgo).reduce((n,x)=>n+x.minutes,0);$("#focusToday").textContent=tm+"m";$("#focusWeek").textContent=wm+"m";$("#focusSessions").textContent=stats.length}

/* Markdown and text */
function writingMode(mode,button){button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));["markdown","text","diff"].forEach(x=>$("#"+x+"Panel").classList.toggle("hidden",x!==mode));if(mode==="text")textStudioStats()}
function markdownToSafeHTML(md){
 let s=esc(md);s=s.replace(/^###### (.*)$/gm,"<h6>$1</h6>").replace(/^##### (.*)$/gm,"<h5>$1</h5>").replace(/^#### (.*)$/gm,"<h4>$1</h4>").replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/\`([^\`]+)\`/g,"<code>$1</code>").replace(/^&gt; (.*)$/gm,"<blockquote>$1</blockquote>").replace(/^[-*] (.*)$/gm,"<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g,m=>"<ul>"+m+"</ul>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');return s.split(/\n{2,}/).map(b=>/^<(h\d|ul|blockquote)/.test(b)?b:"<p>"+b.replace(/\n/g,"<br>")+"</p>").join("");
}
function updateMarkdown(){if(!$("#mdInput"))return;const v=$("#mdInput").value;$("#mdPreview").innerHTML=markdownToSafeHTML(v);const words=v.trim()?v.trim().split(/\s+/).length:0;$("#mdStats").textContent=words+" words · "+v.length+" chars · ~"+Math.max(1,Math.ceil(words/200))+" min";$("#mdInput").oninput=updateMarkdown}
function downloadMarkdown(){downloadBlob(new Blob([$("#mdInput").value],{type:"text/markdown"}),"document.md")}
function copyMarkdownHTML(){navigator.clipboard?.writeText($("#mdPreview").innerHTML);result("Rendered HTML copied.")}
function transformText(mode){let v=$("#textStudioInput").value;if(mode==="clean")v=v.split("\n").map(x=>x.replace(/[ \t]+/g," ").trim()).join("\n").replace(/\n{3,}/g,"\n\n").trim();if(mode==="upper")v=v.toUpperCase();if(mode==="lower")v=v.toLowerCase();if(mode==="title")v=v.toLowerCase().replace(/\b\p{L}/gu,x=>x.toUpperCase());$("#textStudioInput").value=v;textStudioStats()}
function textStudioStats(){if(!$("#textStudioInput"))return;const v=$("#textStudioInput").value,w=v.trim()?v.trim().split(/\s+/).length:0;$("#textStudioStats").textContent=w+" words · "+v.length+" characters · "+v.split("\n").length+" lines · ~"+Math.max(1,Math.ceil(w/200))+" minute read";$("#textStudioInput").oninput=textStudioStats}
function compareV2(){const a=$("#diffA").value.split("\n"),b=$("#diffB").value.split("\n"),d=lcsDiff(a,b);$("#diffResult").innerHTML='<div class="result">'+esc(d.map(x=>x[0]+" "+x[1]).join("\n"))+'</div>'}

/* Password and passphrase */
const passWords=["amber","anchor","apple","arrow","atlas","bamboo","beacon","berry","breeze","bridge","cactus","candle","cedar","cobalt","comet","coral","crystal","delta","ember","falcon","fern","forest","galaxy","garden","harbor","hazel","island","jasmine","lagoon","lantern","lemon","lotus","maple","marble","meadow","meteor","mint","moon","mosaic","nebula","oasis","ocean","olive","orchid","pebble","pepper","pine","planet","plum","quartz","raven","river","robin","saffron","sage","shadow","silver","solar","sparrow","spruce","stone","sunset","tiger","timber","topaz","valley","violet","willow","winter","zenith"];
let passwordModeName="password";
function passwordMode(mode,button){passwordModeName=mode;button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));$("#passwordControls").classList.toggle("hidden",mode!=="password");$("#passphraseControls").classList.toggle("hidden",mode!=="passphrase");$("#strengthControls").classList.toggle("hidden",mode!=="check");generatePasswordV2()}
function randomIndex(n){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n}
function generatePasswordV2(){
 let value="";if(passwordModeName==="check")value=$("#strengthInput")?.value||"";else if(passwordModeName==="passphrase"){const count=Math.max(3,Math.min(10,+$("#phraseWords").value||5)),sep=$("#phraseSeparator").value;value=Array.from({length:count},()=>passWords[randomIndex(passWords.length)]).join(sep);if($("#phraseNumber").checked)value+=sep+String(randomIndex(900)+100)}else{let chars="";if($("#pwUpper")?.checked)chars+="ABCDEFGHJKLMNPQRSTUVWXYZ";if($("#pwLower")?.checked)chars+="abcdefghijkmnopqrstuvwxyz";if($("#pwNumbers")?.checked)chars+="23456789";if($("#pwSymbols")?.checked)chars+="!@#$%^&*_-+=";if(!chars)return result("Select at least one character set.");const len=Math.max(8,Math.min(128,+$("#passwordLength").value||20));value=Array.from({length:len},()=>chars[randomIndex(chars.length)]).join("")}
 const score=passwordStrength(value);$("#passwordOutput").textContent=value||"Enter a password to check.";$("#strengthBar").style.width=score.percent+"%";$("#strengthBar").style.background=score.color;$("#strengthText").textContent=score.label+" · "+score.detail;
}
function passwordStrength(v){let pool=0;if(/[a-z]/.test(v))pool+=26;if(/[A-Z]/.test(v))pool+=26;if(/\d/.test(v))pool+=10;if(/[^\w]/.test(v))pool+=28;const entropy=v.length&&pool?Math.log2(pool)*v.length:0;let label="Very weak",color="#bd2b45";if(entropy>=80){label="Strong";color="#0f8a5f"}else if(entropy>=60){label="Good";color="#3d9b62"}else if(entropy>=40){label="Fair";color="#d58a00"}return{percent:Math.min(100,entropy),label,color,detail:Math.round(entropy)+" estimated bits. Avoid reused or personal patterns."}}
function copyPassword(){const v=$("#passwordOutput").textContent;if(v)navigator.clipboard?.writeText(v)}

/* Client-side PDF workbench */
let pdfAction="merge";
function pdfMode(mode,button){pdfAction=mode;button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));$("#splitOption").classList.toggle("hidden",mode!=="split");$("#rotateOption").classList.toggle("hidden",mode!=="rotate");$("#pdfFiles").multiple=mode==="merge";$("#pdfHelp").textContent=mode==="merge"?"Choose two or more files in the order you want to merge.":mode==="split"?"Choose one PDF and select the pages to extract.":mode==="rotate"?"Choose one PDF; every page will be rotated.":"Choose one PDF to rebuild with object-stream compression."}
function parsePageRanges(value,max){
 const pages=new Set();for(const part of value.split(",")){const p=part.trim();if(!p)continue;if(p.includes("-")){let[a,b]=p.split("-").map(Number);if(!Number.isInteger(a)||!Number.isInteger(b)||a<1||b<a||b>max)throw Error("Invalid page range: "+p);for(let i=a;i<=b;i++)pages.add(i-1)}else{const n=Number(p);if(!Number.isInteger(n)||n<1||n>max)throw Error("Invalid page: "+p);pages.add(n-1)}}if(!pages.size)throw Error("Choose at least one page.");return[...pages]
}
async function processPDF(){
 const files=[...$("#pdfFiles").files],status=$("#pdfStatus");if(!files.length)return status.textContent="Choose at least one PDF.";if(!window.PDFLib)return status.textContent="The local PDF component did not load. Refresh and try again.";
 status.textContent="Processing locally…";try{const{PDFDocument,degrees}=PDFLib;let out,name;
  if(pdfAction==="merge"){if(files.length<2)throw Error("Choose at least two PDFs to merge.");out=await PDFDocument.create();for(const file of files){const source=await PDFDocument.load(await file.arrayBuffer());const pages=await out.copyPages(source,source.getPageIndices());pages.forEach(p=>out.addPage(p))}name="merged.pdf"}
  else{const source=await PDFDocument.load(await files[0].arrayBuffer());if(pdfAction==="split"){out=await PDFDocument.create();const indices=parsePageRanges($("#pdfRange").value,source.getPageCount()),pages=await out.copyPages(source,indices);pages.forEach(p=>out.addPage(p));name="extracted-pages.pdf"}else if(pdfAction==="rotate"){source.getPages().forEach(p=>p.setRotation(degrees((p.getRotation().angle+(+$("#pdfRotation").value||90))%360)));out=source;name="rotated.pdf"}else{out=source;name="optimized.pdf"}}
  const bytes=await out.save({useObjectStreams:true,addDefaultPage:false});downloadBlob(new Blob([bytes],{type:"application/pdf"}),name);const original=files.reduce((n,f)=>n+f.size,0);status.textContent="Done · "+out.getPageCount()+" page(s) · "+formatBytes(bytes.length)+(pdfAction==="optimize"?" · "+Math.round((1-bytes.length/original)*100)+"% size change. Optimization rebuilds PDF objects; image-heavy files may not become smaller.":"");
 }catch(e){status.textContent="Could not process this PDF: "+(e.message||"The file may be encrypted or damaged.")}
}

/* Email signature builder */
function safeHref(value,type="url"){const v=String(value||"").trim();if(type==="email")return"mailto:"+v;if(type==="phone")return"tel:"+v.replace(/[^+\d]/g,"");try{const u=new URL(v);return/^https?:$/.test(u.protocol)?u.href:"#"}catch{return"#"}}
function signatureHTML(){
 const name=esc($("#sigName").value),title=esc($("#sigTitle").value),company=esc($("#sigCompany").value),phone=esc($("#sigPhone").value),email=esc($("#sigEmail").value),site=esc($("#sigWebsite").value),li=esc($("#sigLinkedIn").value),color=$("#sigColor").value,layout=$("#sigLayout").value;
 const contact='<a style="color:#4b5563;text-decoration:none" href="'+safeHref($("#sigPhone").value,"phone")+'">'+phone+'</a> · <a style="color:'+color+';text-decoration:none" href="'+safeHref($("#sigEmail").value,"email")+'">'+email+'</a><br><a style="color:'+color+';text-decoration:none" href="'+safeHref($("#sigWebsite").value)+'">'+site+'</a>'+(li?' · <a style="color:'+color+';text-decoration:none" href="'+safeHref($("#sigLinkedIn").value)+'">LinkedIn</a>':"");
 if(layout==="compact")return'<table cellpadding="0" cellspacing="0" style="font:13px Arial,sans-serif;color:#1f2937"><tr><td><strong style="font-size:16px;color:'+color+'">'+name+'</strong> · '+title+', '+company+'<br>'+contact+'</td></tr></table>';
 const border=layout==="card"?'border:1px solid #e5e7eb;border-radius:10px;padding:16px':'border-left:3px solid '+color+';padding-left:14px';
 return'<table cellpadding="0" cellspacing="0" style="font:13px Arial,sans-serif;color:#1f2937"><tr><td style="'+border+'"><strong style="font-size:18px;color:'+color+'">'+name+'</strong><br><span style="font-weight:bold">'+title+'</span><br>'+company+'<div style="height:8px"></div>'+contact+'</td></tr></table>';
}
function updateSignature(){if(!$("#signaturePreview"))return;$("#signaturePreview").innerHTML=signatureHTML();$("#workspace").addEventListener("input",e=>{if(e.target.id?.startsWith("sig"))$("#signaturePreview").innerHTML=signatureHTML()})}
async function copySignature(){const html=signatureHTML();try{if(window.ClipboardItem)await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([$("#signaturePreview").innerText],{type:"text/plain"})})]);else await navigator.clipboard.writeText(html);result("Signature copied. Paste it into your email signature editor.")}catch{result("Copy was blocked by the browser. Use Download HTML instead.")}}
function downloadSignature(){downloadBlob(new Blob(['<!doctype html><meta charset="utf-8">'+signatureHTML()],{type:"text/html"}),"email-signature.html")}

/* QR generator and reader */
let qrType="url",qrCanvas=null,cameraStream=null,cameraFrame=null;
function initQR(){$("#qrType").addEventListener("change",()=>{qrType=$("#qrType").value;renderQRFields()});renderQRFields()}
function renderQRFields(){const box=$("#qrFields");if(!box)return;if(qrType==="url")box.innerHTML=input("qrUrl","URL","https://intellitools.online");else if(qrType==="text")box.innerHTML='<div class="field"><label for="qrText">Text</label><textarea id="qrText" rows="5"></textarea></div>';else if(qrType==="wifi")box.innerHTML=input("qrSSID","Network name","")+input("qrWifiPass","Password","","password")+select("qrWifiType","Security",["WPA","WEP","nopass"]);else box.innerHTML=input("qrName","Full name","")+input("qrOrg","Organization","")+input("qrPhone","Phone","")+input("qrContactEmail","Email","","email")}
function qrMode(mode,button){button.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b===button));$("#qrGenerate").classList.toggle("hidden",mode!=="generate");$("#qrRead").classList.toggle("hidden",mode!=="read");if(mode!=="read")stopCamera()}
function qrEscape(v){return String(v||"").replace(/([\\;,:"])/g,"\\$1")}
function qrPayload(){if(qrType==="url")return $("#qrUrl").value.trim();if(qrType==="text")return $("#qrText").value;if(qrType==="wifi")return"WIFI:T:"+$("#qrWifiType").value+";S:"+qrEscape($("#qrSSID").value)+";P:"+qrEscape($("#qrWifiPass").value)+";;";return"BEGIN:VCARD\nVERSION:3.0\nFN:"+qrEscape($("#qrName").value)+"\nORG:"+qrEscape($("#qrOrg").value)+"\nTEL:"+qrEscape($("#qrPhone").value)+"\nEMAIL:"+qrEscape($("#qrContactEmail").value)+"\nEND:VCARD"}
function generateQR(){if(!window.qrcode)return result("The local QR component did not load. Refresh and try again.");const payload=qrPayload();if(!payload)return result("Enter content for the QR code.");try{const qr=qrcode(0,$("#qrLevel").value);qr.addData(payload);qr.make();const count=qr.getModuleCount(),scale=Math.max(4,Math.floor(360/(count+8))),margin=4,c=document.createElement("canvas");c.width=c.height=(count+margin*2)*scale;const x=c.getContext("2d");x.fillStyle=$("#qrBg").value;x.fillRect(0,0,c.width,c.height);x.fillStyle=$("#qrColor").value;for(let r=0;r<count;r++)for(let col=0;col<count;col++)if(qr.isDark(r,col))x.fillRect((col+margin)*scale,(r+margin)*scale,scale,scale);qrCanvas=c;const box=$("#qrOutput");box.innerHTML="";box.appendChild(c)}catch(e){result("Unable to create QR code. Shorten the content or lower error correction.")}}
function downloadQR(){if(!qrCanvas)return result("Generate a QR code first.");qrCanvas.toBlob(b=>downloadBlob(b,"intellitools-qr.png"),"image/png")}
async function readQRImage(){const f=$("#qrImage").files[0];if(!f)return $("#qrReadResult").textContent="Choose an image first.";try{const bmp=await createImageBitmap(f),c=document.createElement("canvas");c.width=bmp.width;c.height=bmp.height;const x=c.getContext("2d");x.drawImage(bmp,0,0);const code=jsQR(x.getImageData(0,0,c.width,c.height).data,c.width,c.height);$("#qrReadResult").textContent=code?code.data:"No readable QR code found in this image."}catch{$("#qrReadResult").textContent="This image could not be read."}}
async function startCamera(){stopCamera();try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});const v=$("#qrVideo");v.srcObject=cameraStream;await v.play();scanCamera()}catch{$("#qrReadResult").textContent="Camera access was unavailable or declined."}}
function scanCamera(){const v=$("#qrVideo");if(!cameraStream||!v)return;const c=document.createElement("canvas");if(v.readyState>=2){c.width=v.videoWidth;c.height=v.videoHeight;const x=c.getContext("2d");x.drawImage(v,0,0);const code=jsQR(x.getImageData(0,0,c.width,c.height).data,c.width,c.height);if(code){$("#qrReadResult").textContent=code.data;return stopCamera()}}cameraFrame=requestAnimationFrame(scanCamera)}
function stopCamera(){if(cameraFrame)cancelAnimationFrame(cameraFrame);cameraFrame=null;if(cameraStream)cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;const v=$("#qrVideo");if(v)v.srcObject=null}

/* Envelope budget */
function budgetKey(){return"budget-"+($("#budgetMonth")?.value||todayISO().slice(0,7))}
function defaultBudget(){return{income:10000,rows:[{name:"Housing",planned:3500,spent:0},{name:"Groceries",planned:1200,spent:0},{name:"Transport",planned:800,spent:0},{name:"Savings",planned:2000,spent:0}]}}
function renderBudget(){
 if(!$("#budgetRows"))return;const saved=loadJSON(budgetKey(),defaultBudget());$("#budgetIncome").value=saved.income;$("#budgetRows").innerHTML="";saved.rows.forEach(addBudgetRow);$("#budgetMonth").onchange=renderBudget;$("#budgetIncome").oninput=updateBudgetSummary;updateBudgetSummary();
}
function addBudgetRow(row={name:"",planned:0,spent:0}){const el=document.createElement("div");el.className="budget-row";el.innerHTML='<div class="field"><label>Envelope</label><input class="budget-name" value="'+esc(row.name)+'"></div><div class="field"><label>Planned</label><input class="budget-plan" type="number" min="0" step="0.01" value="'+(+row.planned||0)+'"></div><div class="field"><label>Spent</label><input class="budget-spent" type="number" min="0" step="0.01" value="'+(+row.spent||0)+'"></div><button class="btn danger small" onclick="this.parentElement.remove();updateBudgetSummary()">×</button>';el.addEventListener("input",updateBudgetSummary);$("#budgetRows").appendChild(el);updateBudgetSummary()}
function budgetData(){return{income:+$("#budgetIncome").value||0,rows:[...document.querySelectorAll(".budget-row")].map(r=>({name:r.querySelector(".budget-name").value.trim()||"Envelope",planned:+r.querySelector(".budget-plan").value||0,spent:+r.querySelector(".budget-spent").value||0}))}}
function updateBudgetSummary(){if(!$("#budgetSummary"))return;const d=budgetData(),planned=d.rows.reduce((n,x)=>n+x.planned,0),spent=d.rows.reduce((n,x)=>n+x.spent,0);$("#budgetIncomeView").textContent=d.income.toLocaleString();$("#budgetPlanned").textContent=planned.toLocaleString();$("#budgetSpent").textContent=spent.toLocaleString();$("#budgetLeft").textContent=(d.income-planned).toLocaleString();$("#budgetLeft").style.color=d.income-planned<0?"var(--danger)":"inherit";$("#budgetSummary").innerHTML=d.rows.map(x=>{const pct=x.planned?Math.min(100,x.spent/x.planned*100):0;return'<div class="result"><strong>'+esc(x.name)+'</strong><span style="float:right">'+x.spent.toLocaleString()+' / '+x.planned.toLocaleString()+'</span><div class="budget-track"><i style="width:'+pct+'%;background:'+(x.spent>x.planned?"var(--danger)":"var(--brand)")+'"></i></div></div>'}).join("")}
function saveBudget(){saveJSON(budgetKey(),budgetData());result("Budget saved for "+$("#budgetMonth").value+" on this device.")}
function exportBudget(){const d=budgetData(),csv="Envelope,Planned,Spent,Remaining\n"+d.rows.map(x=>[x.name,x.planned,x.spent,x.planned-x.spent].map(csvCell).join(",")).join("\n");downloadBlob(new Blob([csv],{type:"text/csv"}),"budget-"+$("#budgetMonth").value+".csv")}
function resetBudget(){if(!confirm("Clear the saved budget for this month?"))return;localStorage.removeItem("it.v2."+budgetKey());renderBudget()}

/* v2 navigation and lifecycle */
const legacyCloseTool=closeTool;
closeTool=function(){stopCamera();clearInterval(timerTick);if(timerState)timerState.running=false;legacyCloseTool()};
const legacyRouteIntent=routeIntent;
routeIntent=function(){const q=$("#intent").value.toLowerCase().trim(),rules=[["invoice-studio",/invoice|receipt|bill a client/],["image-studio",/image|photo|resize|compress|convert.*(png|jpg|webp)|favicon/],["color-studio",/gradient|palette|color/],["converter-studio",/convert|cooking|currency|temperature|length|weight/],["habit-journal",/habit|streak|journal|mood/],["focus-timer",/pomodoro|focus|timer/],["writing-studio",/markdown|word count|clean text|compare draft/],["password-studio",/password|passphrase|strength/],["pdf-studio",/pdf|merge|split|rotate/],["signature-studio",/email signature|signature/],["qr-studio",/qr|wifi code/],["budget-studio",/budget|envelope|spending/]];const hit=rules.find(x=>x[1].test(q));if(hit){$("#intentResult").textContent="Opening the best matching tool…";openTool(hit[0])}else legacyRouteIntent()};
document.querySelectorAll(".category-chips button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".category-chips button").forEach(x=>x.classList.toggle("active",x===b));$("#categoryFilter").value=b.dataset.category;renderCatalog()}));
$("#categoryFilter")?.addEventListener("change",()=>document.querySelectorAll(".category-chips button").forEach(b=>b.classList.toggle("active",b.dataset.category===$("#categoryFilter").value)));
document.addEventListener("keydown",e=>{if(e.key==="/"&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();location.hash="tools";$("#toolSearch")?.focus()}});
renderCatalog();
// Recalculate after every tool bundle has loaded; V2.1 appends its tools later in the document.
document.addEventListener("DOMContentLoaded",()=>{renderCatalog();renderDiscoveryShelf()});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));

function promptBuilderTemplate(){
 const sections=[
  ["C","Capacity & Role","What expertise or role should the AI take?","You are an experienced product strategist..."],
  ["R","Request","What exactly do you want the AI to do?","Create a launch plan for..."],
  ["I","Insight & Context","What background information will help?","The audience is... The constraints are..."],
  ["S","Steps & Process","How should the AI approach the task?","First analyze..., then compare..., finally..."],
  ["P","Personality","What tone and style should the response use?","Clear, concise, practical and professional."],
  ["E","Experiment & Output","What should the final output look like?","Return a table followed by three recommendations..."]
 ];
 return '<div class="grid2"><div><div class="result"><strong>Build with CRISPE</strong><br><span class="note">Complete the six guided sections. Everything stays in this browser.</span></div>'+
 sections.map(s=>'<div class="field"><label for="prompt'+s[0]+'"><strong>'+s[0]+'</strong> — '+s[1]+'</label><textarea id="prompt'+s[0]+'" rows="3" placeholder="'+s[3]+'" oninput="updatePromptBuilder()"></textarea><small class="note">'+s[2]+'</small></div>').join("")+
 '<div class="actions"><button class="btn" type="button" onclick="copyBuiltPrompt()">Copy prompt</button><button class="btn alt" type="button" onclick="downloadBuiltPrompt()">Download .txt</button><button class="btn alt" type="button" onclick="clearPromptBuilder()">Clear</button></div></div>'+
 '<div><div class="metricgrid"><div class="metric"><small>Sections complete</small><strong id="promptComplete">0/6</strong></div><div class="metric"><small>Prompt quality</small><strong id="promptQuality">Start</strong></div></div><h3>Live prompt preview</h3><div id="promptPreview" class="result" style="white-space:pre-wrap;min-height:320px"></div><div id="promptHints" class="note"></div></div></div>';
}
function promptBuilderData(){
 const out={};["C","R","I","S","P","E"].forEach(k=>out[k]=document.getElementById("prompt"+k)?.value||"");return out;
}
function assembledPrompt(d){
 const labels={C:"CAPACITY & ROLE",R:"REQUEST",I:"INSIGHT & CONTEXT",S:"STEPS & PROCESS",P:"PERSONALITY",E:"EXPERIMENT & OUTPUT"};
 return ["C","R","I","S","P","E"].filter(k=>d[k].trim()).map(k=>labels[k]+"\n"+d[k].trim()).join("\n\n");
}
function updatePromptBuilder(){
 const d=promptBuilderData();saveJSON("ai-prompt-builder",d);
 const filled=Object.values(d).filter(v=>v.trim()).length,total=Object.values(d).join(" ").trim().length;
 const preview=document.getElementById("promptPreview");if(preview)preview.textContent=assembledPrompt(d)||"Your structured prompt will appear here as you type.";
 const complete=document.getElementById("promptComplete");if(complete)complete.textContent=filled+"/6";
 const quality=document.getElementById("promptQuality");if(quality)quality.textContent=filled===6&&total>240?"Strong":filled>=4?"Good":filled>=2?"Building":"Start";
 const hints=[];if(!d.R.trim())hints.push("Add a specific request.");if(!d.I.trim())hints.push("Add useful context or constraints.");if(!d.E.trim())hints.push("Specify the desired output format.");
 const h=document.getElementById("promptHints");if(h)h.textContent=hints.length?"Quality check: "+hints.join(" "):"Quality check: all six CRISPE components are present.";
}
function initPromptBuilder(){
 const d=loadJSON("ai-prompt-builder",{});["C","R","I","S","P","E"].forEach(k=>{const el=document.getElementById("prompt"+k);if(el)el.value=d[k]||""});updatePromptBuilder();
}
async function copyBuiltPrompt(){const t=assembledPrompt(promptBuilderData());if(!t)return;await navigator.clipboard.writeText(t);const h=document.getElementById("promptHints");if(h)h.textContent="Prompt copied to clipboard."}
function downloadBuiltPrompt(){const t=assembledPrompt(promptBuilderData());if(t)downloadBlob(new Blob([t],{type:"text/plain"}),"intellitools-ai-prompt.txt")}
function clearPromptBuilder(){if(!confirm("Clear all six prompt sections?"))return;localStorage.removeItem("it.v2.ai-prompt-builder");["C","R","I","S","P","E"].forEach(k=>{const el=document.getElementById("prompt"+k);if(el)el.value=""});updatePromptBuilder()}


/* V2 safety and evidence tools */
function redactorTemplate(){return '<div class="grid2"><div><div class="field"><label for="redactInput">Text, prompt or log</label><textarea id="redactInput" rows="14" placeholder="Paste text here. Processing stays in this browser."></textarea></div><div class="field"><label for="redactMode">Redaction mode</label><select id="redactMode"><option value="replace">Replace with labels</option><option value="mask">Mask values</option><option value="remove">Remove values</option></select></div><div class="actions"><button class="btn" type="button" onclick="runRedactor()">Redact</button><button class="btn alt" type="button" onclick="copyRedacted()">Copy result</button></div></div><div><p class="note">Detects common patterns such as emails, bearer/JWT tokens, API-key assignments, IPv4 addresses, phone-like numbers and database connection strings. Pattern detection can miss or over-match unusual formats.</p><div id="redactSummary" class="result">No text analyzed yet.</div><div id="redactOutput" class="result"></div></div></div>'}
function initRedactor(){}
function redactSensitiveText(text,mode="replace"){const patterns=[["JWT",/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g],["Bearer token",/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi],["API key",/\b(api[_-]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9_\-.]{8,}["']?/gi],["Email",/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],["IPv4",/\b(?:\d{1,3}\.){3}\d{1,3}\b/g],["Phone",/(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)/g],["Connection string",/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi]];const findings=[];let output=String(text||"");patterns.forEach(([label,re])=>{output=output.replace(re,m=>{findings.push(label);if(mode==="remove")return "";if(mode==="mask")return "•".repeat(Math.min(Math.max(m.length,4),24));return "["+label.toUpperCase().replace(/ /g,"_")+"_REDACTED]"})});return {output,findings}}
function runRedactor(){const r=redactSensitiveText(document.getElementById("redactInput").value,document.getElementById("redactMode").value);document.getElementById("redactOutput").textContent=r.output;const counts={};r.findings.forEach(x=>counts[x]=(counts[x]||0)+1);document.getElementById("redactSummary").textContent=r.findings.length?Object.entries(counts).map(([k,v])=>k+": "+v).join(" · "):"No supported sensitive-data patterns detected."}
async function copyRedacted(){const t=document.getElementById("redactOutput").textContent;if(t)await navigator.clipboard.writeText(t)}

function curlSanitizerTemplate(){return '<div class="grid2"><div><div class="field"><label for="curlInput">cURL command</label><textarea id="curlInput" rows="14" placeholder="curl https://api.example.com -H &quot;Authorization: Bearer ...&quot;"></textarea></div><div class="actions"><button class="btn" type="button" onclick="runCurlSanitizer()">Sanitize & convert</button></div><p class="note">This is a local sharing-safety helper, not a shell parser. Review the sanitized request before publishing it.</p></div><div><h3>Sanitized cURL</h3><div id="curlSafe" class="result"></div><h3>JavaScript fetch</h3><div id="curlFetch" class="result"></div><div id="curlRemoved" class="note"></div></div></div>'}
function initCurlSanitizer(){}
function sanitizeCurlText(input){let text=String(input||""),removed=[];const rules=[["authorization header",/(-H|--header)\s+(["'])Authorization:\s*[^"']+\2/gi],["cookie header",/(-H|--header)\s+(["'])Cookie:\s*[^"']+\2/gi],["API-key header",/(-H|--header)\s+(["'])(?:X-API-Key|API-Key):\s*[^"']+\2/gi],["bearer token",/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi],["sensitive query parameter",/([?&](?:api[_-]?key|token|access_token|secret|password)=)[^&\s"']+/gi]];rules.forEach(([label,re])=>{text=text.replace(re,m=>{removed.push(label);if(label.includes("header")){const flag=m.match(/^(-H|--header)/i)?.[0]||"-H";const name=label==="authorization header"?"Authorization":label==="cookie header"?"Cookie":"X-API-Key";return flag+' "'+name+': [REDACTED]"'}if(label==="bearer token")return "Bearer [REDACTED]";return m.replace(/=.*/,"=[REDACTED]")})});return {text,removed}}
function curlToFetch(input){const safe=sanitizeCurlText(input).text;const url=(safe.match(/https?:\/\/[^\s"'\\]+/)||[])[0]||"";const method=(safe.match(/(?:-X|--request)\s+([A-Z]+)/i)||[])[1]||"GET";const headers={};for(const m of safe.matchAll(/(?:-H|--header)\s+(["'])([^:"']+):\s*([^"']*)\1/gi))headers[m[2]]=m[3];const body=(safe.match(/(?:-d|--data(?:-raw)?)\s+(["'])([\s\S]*?)\1/i)||[])[2];const opts={method:method.toUpperCase()};if(Object.keys(headers).length)opts.headers=headers;if(body!==undefined)opts.body=body;return 'fetch('+JSON.stringify(url)+', '+JSON.stringify(opts,null,2)+')\n  .then(r => r.json())\n  .then(console.log);'}
function runCurlSanitizer(){const raw=document.getElementById("curlInput").value,r=sanitizeCurlText(raw);document.getElementById("curlSafe").textContent=r.text;document.getElementById("curlFetch").textContent=curlToFetch(raw);document.getElementById("curlRemoved").textContent=r.removed.length?"Removed/redacted: "+[...new Set(r.removed)].join(", "):"No supported credential patterns found."}

function factAnchorTemplate(){return '<div class="grid2"><div><div class="field"><label for="anchorAnswer">Claims / AI-generated answer</label><textarea id="anchorAnswer" rows="12"></textarea></div><div class="field"><label for="anchorEvidence">Supplied evidence</label><textarea id="anchorEvidence" rows="12"></textarea></div><button class="btn" type="button" onclick="runFactAnchor()">Check anchors</button></div><div><p class="note">This tool checks textual overlap and numbers. It does not independently verify truth and should not be presented as a definitive hallucination detector.</p><div id="anchorResults" class="result">Add claims and evidence to begin.</div></div></div>'}
function initFactAnchor(){}
function factAnchorCheck(answer,evidence){const ev=String(evidence||"").toLowerCase(),words=s=>new Set((s.toLowerCase().match(/[a-z0-9]{3,}/g)||[]).filter(w=>!["the","and","that","with","from","this","have","were","will"].includes(w)));const claims=String(answer||"").split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);return claims.map(claim=>{const cw=[...words(claim)],hits=cw.filter(w=>ev.includes(w)).length,ratio=cw.length?hits/cw.length:0,nums=claim.match(/\b\d+(?:\.\d+)?%?\b/g)||[],numbersMatch=nums.every(n=>ev.includes(n.toLowerCase()));let status="Not found in supplied evidence";if(ratio>=.72&&numbersMatch)status="Supported";else if(ratio>=.38&&numbersMatch)status="Partially supported";return {claim,status}})}
function runFactAnchor(){const rows=factAnchorCheck(document.getElementById("anchorAnswer").value,document.getElementById("anchorEvidence").value);document.getElementById("anchorResults").innerHTML=rows.length?rows.map(r=>'<p><strong>'+esc(r.status)+'</strong><br>'+esc(r.claim)+'</p>').join(""):"No claims found."}

// Discovery keyboard access and local shortcut shelf.
document.addEventListener("DOMContentLoaded",()=>{renderDiscoveryShelf();window.addEventListener("storage",e=>{if(e.key===DISCOVERY_FAV_KEY||e.key===DISCOVERY_RECENT_KEY){renderCatalog();renderDiscoveryShelf()}});document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const q=$("#toolSearch");if(q){location.hash="tools";q.focus();q.select()}}});});
