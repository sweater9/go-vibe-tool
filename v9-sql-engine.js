/* V9 SQL beautifier & minifier. Pure JavaScript, no network, no execution, no schema knowledge.
   It re-lays-out text: string literals, quoted identifiers, comments, placeholders and dialect syntax are tokenised first and
   copied through byte-for-byte. Only whitespace and the case of a short list of reserved keywords can change. It does NOT
   validate SQL. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.GVTV9=Object.assign(root.GVTV9||{},api);})(typeof self!=="undefined"?self:globalThis,function(){"use strict";

const MAX_INPUT=2000000;
const DIALECTS={
  standard:{label:"Standard SQL"},
  postgresql:{label:"PostgreSQL",dollarQuote:true,nestedComments:true,backslashE:true},
  mysql:{label:"MySQL / MariaDB",hashComment:true,backslashStrings:true},
  sqlite:{label:"SQLite"},
  sqlserver:{label:"SQL Server (T-SQL)",bracketIdent:true}
};

/* Only words that are reserved in the mainstream dialects are ever re-cased, so a column called `first` or `key` is untouched. */
const KEYWORDS=new Set(("SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET FETCH UNION ALL INTERSECT EXCEPT MINUS INSERT INTO VALUES UPDATE SET DELETE WITH AS ON "+
 "JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL USING AND OR NOT IN IS NULL LIKE ILIKE BETWEEN EXISTS CASE WHEN THEN ELSE END DISTINCT ASC DESC OVER PARTITION "+
 "CREATE ALTER DROP TABLE RETURNING WINDOW QUALIFY REPLACE ANY SOME TOP CONFLICT DUPLICATE DO NOTHING UNIQUE PRIMARY FOREIGN REFERENCES CONSTRAINT DEFAULT TRUE FALSE").split(" "));
const JOIN_MODS=new Set(["NATURAL","CROSS","INNER","LEFT","RIGHT","FULL","OUTER"]);
const CLAUSES=[ /* longest first */
 ["ON","DUPLICATE","KEY","UPDATE"],["ON","CONFLICT"],["INSERT","INTO"],["REPLACE","INTO"],["DELETE","FROM"],["GROUP","BY"],["ORDER","BY"],
 ["UNION","ALL"],["UNION"],["INTERSECT"],["EXCEPT"],["MINUS"],["SELECT"],["FROM"],["WHERE"],["HAVING"],["LIMIT"],["OFFSET"],["FETCH"],
 ["VALUES"],["SET"],["RETURNING"],["WINDOW"],["QUALIFY"],["WITH"],["INSERT"],["UPDATE"],["DELETE"],["REPLACE"]
];
const STATEMENT_START=new Set(["INSERT","UPDATE","DELETE","REPLACE"]);
const LIST_CLAUSES=new Set(["SELECT","GROUP BY","ORDER BY","SET","RETURNING","FROM","WINDOW"]);
const COND_CLAUSES=new Set(["WHERE","HAVING","QUALIFY"]);

/* ---------- Tokenizer ---------- */
/* Token types: ws, lc (line comment), bc (block comment), str, qid, word, num, param, op, punct. Concatenating every
   token's `v` reproduces the input exactly. */
const RE={
  ws:/\s+/y,
  word:/[A-Za-z_\u0080-￿][A-Za-z0-9_$\u0080-￿]*/y,
  num:/(?:0[xX][0-9A-Fa-f]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y,
  op:/(?:->>|->|#>>|#>|<=>|<>|<=|>=|!=|\|\||::|:=|<<|>>|&&|@>|<@|!~\*|!~|~\*|=>|\*\*|[-+*\/%=<>!~^&|@#])/y,
  pct:/%(?:\([A-Za-z0-9_]+\))?[sdif]\b/y,
  named:/(?::[A-Za-z_][A-Za-z0-9_]*|@@?[A-Za-z_#][A-Za-z0-9_#$]*|\$\d+|\?\d*|\{\{[^{}]*\}\}|\$\{[^{}]*\}|#\{[^{}]*\})/y,
  dollar:/\$([A-Za-z_][A-Za-z0-9_]*)?\$/y
};
function sticky(re,s,i){re.lastIndex=i;const m=re.exec(s);return m?m[0]:null;}
function tokenize(sql,dialect){
  const d=DIALECTS[dialect]||DIALECTS.standard,s=String(sql),n=s.length,out=[],issues=[];
  let i=0;
  const push=(t,v)=>{out.push({t,v});i+=v.length;};
  const readQuoted=(start,q,backslash)=>{ /* returns end index (exclusive) or -1 when unterminated */
    let j=start+1;
    while(j<n){
      const c=s[j];
      if(backslash&&c==="\\"){j+=2;continue;}
      if(c===q){if(s[j+1]===q){j+=2;continue;}return j+1;}
      j++;
    }
    return-1;
  };
  while(i<n){
    const c=s[i];
    let m;
    if((m=sticky(RE.ws,s,i))){push("ws",m);continue;}
    if(c==="-"&&s[i+1]==="-"&&(!d.hashComment||/[\s]|^$/.test(s[i+2]||" "))){const e=s.indexOf("\n",i);const v=e<0?s.slice(i):s.slice(i,e);push("lc",v);continue;}
    if(c==="#"&&d.hashComment){const e=s.indexOf("\n",i);push("lc",e<0?s.slice(i):s.slice(i,e));continue;}
    if(c==="/"&&s[i+1]==="*"){
      let depth=1,j=i+2;
      while(j<n&&depth>0){
        if(d.nestedComments&&s[j]==="/"&&s[j+1]==="*"){depth++;j+=2;}
        else if(s[j]==="*"&&s[j+1]==="/"){depth--;j+=2;}
        else j++;
      }
      if(depth>0){issues.push("Unterminated /* comment");j=n;}
      push("bc",s.slice(i,j));continue;
    }
    if(c==="'"){
      const e=readQuoted(i,"'",d.backslashStrings);
      if(e<0){issues.push("Unterminated string literal");push("str",s.slice(i));}else push("str",s.slice(i,e));
      continue;
    }
    if(c==='"'){
      const e=readQuoted(i,'"',d.backslashStrings);
      if(e<0){issues.push("Unterminated quoted identifier");push("qid",s.slice(i));}else push("qid",s.slice(i,e));
      continue;
    }
    if(c==="`"){
      const e=readQuoted(i,"`",false);
      if(e<0){issues.push("Unterminated quoted identifier");push("qid",s.slice(i));}else push("qid",s.slice(i,e));
      continue;
    }
    if(c==="["&&d.bracketIdent){
      let j=i+1;
      for(;j<n;j++){if(s[j]==="]"){if(s[j+1]==="]"){j++;continue;}break;}}
      if(j>=n){issues.push("Unterminated [identifier]");push("qid",s.slice(i));}else push("qid",s.slice(i,j+1));
      continue;
    }
    if(c==="$"&&d.dollarQuote&&(m=sticky(RE.dollar,s,i))){
      const close=s.indexOf(m,i+m.length);
      if(close<0){issues.push("Unterminated dollar-quoted string");push("str",s.slice(i));}else push("str",s.slice(i,close+m.length));
      continue;
    }
    /* one-letter string prefixes: E'..' N'..' X'..' B'..' */
    if(/[EeNnXxBb]/.test(c)&&s[i+1]==="'"&&!/[A-Za-z0-9_$]/.test(s[i-1]||" ")){
      const bs=(c==="E"||c==="e")&&d.backslashE||d.backslashStrings;
      const e=readQuoted(i+1,"'",bs);
      if(e<0){issues.push("Unterminated string literal");push("str",s.slice(i));}else push("str",s.slice(i,e));
      continue;
    }
    if((m=sticky(RE.pct,s,i))){push("param",m);continue;}
    if(c===":"&&s[i+1]===":"){push("op","::");continue;}
    if(c===":"&&s[i+1]==="="){push("op",":=");continue;}
    if((c===":"||c==="@"||c==="$"||c==="?"||c==="{"||c==="#")&&(m=sticky(RE.named,s,i))){
      if(!(c==="@"&&s[i+1]===">")&&!(c==="#"&&/[>]/.test(s[i+1]||""))){push("param",m);continue;}
    }
    if((m=sticky(RE.word,s,i))){push("word",m);continue;}
    if((m=sticky(RE.num,s,i))){push("num",m);continue;}
    if(c==="("||c===")"||c===","||c===";"||c==="."||c==="["||c==="]"){push("punct",c);continue;}
    if((m=sticky(RE.op,s,i))){push("op",m);continue;}
    push("op",c);   /* unknown character: keep it, never drop it */
  }
  return{tokens:out,issues};
}

/* ---------- Minifier ---------- */
const isHint=v=>/^\/\*[+!]/.test(v);
function wordish(t){return t==="word"||t==="num"||t==="param"||t==="str"||t==="qid";}
function minify(sql,opts){
  opts=opts||{};
  if(String(sql).length>MAX_INPUT)throw Error("Input is larger than 2,000,000 characters.");
  const{tokens,issues}=tokenize(sql,opts.dialect);
  const keepComments=!!opts.keepComments;
  let out="",prev=null,pendingBreak=false;
  for(const tk of tokens){
    if(tk.t==="ws")continue;
    if((tk.t==="lc"||tk.t==="bc")&&!keepComments&&!isHint(tk.v))continue;
    if(pendingBreak){out+="\n";prev=null;pendingBreak=false;}
    if(prev){
      const space=(wordish(prev.t)&&wordish(tk.t))||(prev.t==="op"&&tk.t==="op")||(prev.t==="num"&&tk.v===".")||
        (prev.t==="op"&&tk.t==="lc")||(prev.t==="lc")||tk.t==="lc"||(prev.t==="bc"&&wordish(tk.t))||(tk.t==="bc"&&wordish(prev.t))||
        (prev.v==="/"&&tk.v==="*")||(prev.v==="-"&&tk.v==="-")||
        (prev.t==="op"&&tk.t==="punct"&&tk.v==="."&&false);
      if(space)out+=" ";
    }
    out+=tk.v;
    prev=tk;
    if(tk.t==="lc")pendingBreak=true;
  }
  return{output:out,warnings:issues,stats:{before:String(sql).length,after:out.length}};
}

/* ---------- Parser: tokens -> tree of words/tokens/comments/groups ---------- */
function toTree(tokens,issues){
  const root={children:[]},stack=[root];
  let nl=false;
  for(const tk of tokens){
    if(tk.t==="ws"){if(tk.v.indexOf("\n")>=0)nl=true;continue;}
    const top=stack[stack.length-1];
    let node;
    if(tk.t==="lc"||tk.t==="bc")node={k:"c",v:tk.v,line:tk.t==="lc",nl};
    else if(tk.t==="word")node={k:"w",v:tk.v,up:tk.v.toUpperCase()};
    else node={k:"t",t:tk.t,v:tk.v};
    if(tk.t==="punct"&&(tk.v==="("||tk.v==="[")){
      const g={k:"g",open:tk.v,close:tk.v==="("?")":"]",children:[],closed:false,nl};
      top.children.push(g);stack.push(g);nl=false;continue;
    }
    if(tk.t==="punct"&&(tk.v===")"||tk.v==="]")){
      if(stack.length>1&&top.close===tk.v){top.closed=true;stack.pop();nl=false;continue;}
      issues.push("Unmatched "+tk.v);
    }
    node.nl=nl;nl=false;
    top.children.push(node);
  }
  if(stack.length>1)issues.push("Unbalanced parentheses: "+(stack.length-1)+" group(s) not closed");
  return root.children;
}

/* ---------- Formatter ---------- */
function makeCtx(opts){
  const dialect=DIALECTS[opts.dialect]?opts.dialect:"standard";
  const indent=opts.indent==="tab"?"\t":" ".repeat(Math.min(8,Math.max(1,parseInt(opts.indent,10)||2)));
  return{
    dialect,IND:indent,
    keywordCase:["upper","lower","preserve"].indexOf(opts.keywordCase)>=0?opts.keywordCase:"upper",
    leading:opts.commaStyle==="leading",
    maxLine:Math.min(240,Math.max(30,parseInt(opts.maxLine,10)||80)),
    blank:opts.blankLines!==false,
    ddl:false,spaceParen:false
  };
}
const kw=(ctx,w)=>{
  const up=w.toUpperCase();
  if(!KEYWORDS.has(up))return w;
  return ctx.keywordCase==="upper"?up:ctx.keywordCase==="lower"?w.toLowerCase():w;
};
const isW=(n,up)=>n&&n.k==="w"&&(up===undefined||n.up===up);
const isComma=n=>n&&n.k==="t"&&n.t==="punct"&&n.v===",";
const isSemi=n=>n&&n.k==="t"&&n.t==="punct"&&n.v===";";
const isDot=n=>n&&n.k==="t"&&n.t==="punct"&&n.v===".";

function splitTop(nodes,pred){ /* split a flat node list on top-level separators; comments right after a comma on the same source line trail the previous item */
  const items=[[]],seps=[];
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];
    if(pred(n)){
      seps.push(n);
      const next=nodes[i+1];
      if(next&&next.k==="c"&&next.line&&!next.nl){items[items.length-1].trail=next;i++;}
      items.push([]);
    }else items[items.length-1].push(n);
  }
  /* a line comment that ends an item would swallow the comma appended after it: it trails the item instead */
  for(const it of items){
    const last=it[it.length-1];
    if(it.length>1&&last&&last.k==="c"&&last.line&&!it.trail){it.pop();it.trail=last;}
  }
  return items;
}
const leadWS=s=>(/^[ \t]*/.exec(s)||[""])[0];
const isSubquery=g=>{
  if(g.open!=="(")return false;
  const f=g.children.find(n=>n.k!=="c");
  if(!f)return false;
  if(f.k==="w")return f.up==="SELECT"||f.up==="WITH"||f.up==="VALUES";
  return f.k==="g"&&isSubquery(f);
};
const isOperandEnd=n=>!!n&&(n.k==="g"||n.k==="case"||(n.k==="w"&&(!KEYWORDS.has(n.up)||n.up==="NULL"||n.up==="TRUE"||n.up==="FALSE"||n.up==="END"))||(n.k==="t"&&(n.t==="num"||n.t==="str"||n.t==="qid"||n.t==="param")));

/* Render a run of expression nodes into lines. First line continues the caller's current line; later lines are indented
   relative to the caller's current line. */
function renderExpr(nodes,ctx){
  const lines=[""];
  let prev=null,tight=false,forceBreak=false;
  const cur=()=>lines[lines.length-1];
  const setCur=s=>{lines[lines.length-1]=s;};
  const append=(text,spaceBefore)=>{
    if(forceBreak){lines.push("");forceBreak=false;prev=null;}
    const c=cur();
    /* never let two adjacent tokens fuse into a comment opener: "- -x" must not become "--x", "/ *" must not become "/*" */
    const fuse=(c.slice(-1)==="-"&&text[0]==="-")||(c.slice(-1)==="/"&&text[0]==="*");
    setCur(c+(((spaceBefore&&!tight)||fuse)&&c.length&&!/[ \t]$/.test(c)?" ":"")+text);
    tight=false;
  };
  const embed=(sub,spaceBefore)=>{ /* sub: string[] ; sub[0] continues the current line */
    append(sub[0],spaceBefore);
    const pad=leadWS(cur());
    for(let k=1;k<sub.length;k++)lines.push(pad+sub[k]);
  };
  const prevText=()=>prev;
  const spaceBeforeGroup=(g)=>{
    if(!prev)return false;
    if(g.open==="[")return !(prev.k==="w"||prev.k==="g"||(prev.k==="t"&&prev.t==="qid"));
    if(prev.k==="w")return KEYWORDS.has(prev.up)||ctx.spaceParen||g===ctx.ddlTop;
    if(prev.k==="t"&&prev.t==="qid")return ctx.spaceParen||g===ctx.ddlTop;
    if(isDot(prev))return false;
    return true;
  };
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];
    if(n.k==="c"){
      if(n.line){
        if(n.nl&&cur().trim().length){lines.push("");}
        append(n.v,!!cur().trim().length&&!n.nl);
        forceBreak=true;prev=n;
      }else{
        if(n.nl&&cur().trim().length){lines.push("");}
        append(n.v,true);prev=n;
      }
      continue;
    }
    if(n.k==="g"){
      const sub=renderGroup(n,ctx,cur().length);
      embed(sub,spaceBeforeGroup(n));
      prev=n;continue;
    }
    if(isW(n,"CASE")){
      let depth=0,end=-1;
      for(let j=i;j<nodes.length;j++){
        if(isW(nodes[j],"CASE"))depth++;
        else if(isW(nodes[j],"END")){depth--;if(depth===0){end=j;break;}}
      }
      if(end>0&&!nodes.slice(i+1,end).some(x=>x.k==="c"&&x.line)){
        const sub=renderCase(nodes.slice(i+1,end),ctx,kw);
        embed(sub,true);
        prev={k:"case"};i=end;continue;
      }
    }
    if(n.k==="w"){
      const keyOfKey=n.up==="KEY"&&prev&&(isW(prev,"PRIMARY")||isW(prev,"FOREIGN"));
      const text=keyOfKey?(ctx.keywordCase==="upper"?"KEY":ctx.keywordCase==="lower"?"key":n.v):kw(ctx,n.v);
      append(text,needSpace(prev,n));
      prev=n;continue;
    }
    /* plain tokens */
    if(n.t==="punct"){
      if(n.v===","){append(",",false);prev=n;continue;}
      if(n.v==="."){append(".",false);tight=true;prev=n;continue;}
      if(n.v===";"){append(";",false);prev=n;continue;}
      append(n.v,needSpace(prev,n));prev=n;continue;
    }
    if(n.t==="op"){
      const o=n.v;
      if(o==="::"){append(o,false);tight=true;prev=n;continue;}
      const operandBefore=isOperandEnd(prev);
      const unaryCapable=o==="-"||o==="+"||o==="~"||o==="!"||o==="@"||o==="#";
      if(o==="*"&&!operandBefore){append(o,!!prev&&!isDot(prev)&&!(prev.k==="t"&&prev.v==="(")&&!isCommaPrev(prev));prev=n;continue;}
      if(unaryCapable&&!operandBefore){append(o,!!prev&&!isCommaPrev(prev));tight=true;prev=n;continue;}
      append(o,!!prev);prev=n;continue;
    }
    append(n.v,needSpace(prev,n));prev=n;
  }
  return lines;
}
function isCommaPrev(p){return p&&p.k==="t"&&p.t==="punct"&&p.v===",";}
function needSpace(prev,n){
  if(!prev)return false;
  if(isDot(prev))return false;
  if(prev.k==="t"&&prev.t==="op"&&prev.v==="::")return false;
  return true;
}
function renderGroup(g,ctx,col){
  const open=g.open,close=g.closed?g.close:"";
  if(isSubquery(g)){
    const inner=formatStatement(g.children,ctx);
    return[open].concat(inner.map(l=>ctx.IND+l),[close]);
  }
  const hasComment=g.children.some(c=>c.k==="c");
  const items=splitTop(g.children,isComma);
  const rendered=items.map(it=>renderExpr(it,ctx));
  const allOne=rendered.every(r=>r.length===1)&&!items.some(it=>it.trail)&&!hasComment;
  const inlineText=open+rendered.map(r=>r[0]).join(", ")+close;
  if(allOne&&(col+inlineText.length<=ctx.maxLine)&&!(ctx.ddl&&open==="("&&items.length>1&&ctx.ddlTop===g))return[inlineText];
  if(open==="["&&allOne)return[inlineText];
  if(items.length===1){ /* a single long item: break on top-level AND / OR if there are any */
    const parts=splitCond(g.children);
    if(parts.length>1){
      const out=[open];
      parts.forEach((p,idx)=>{
        const r=renderExpr(p.nodes,ctx);
        r[0]=(idx?p.op+" ":"")+r[0];
        r.forEach(l=>out.push(ctx.IND+l));
      });
      out.push(close);
      return out;
    }
    if(allOne)return[inlineText];
  }
  return listLayout(open,rendered,items,close,ctx);
}
function listLayout(open,rendered,items,close,ctx){
  const out=[open];
  rendered.forEach((r,idx)=>{
    const last=idx===rendered.length-1,trail=items[idx].trail;
    const ls=r.slice();
    if(ctx.leading){ls[0]=(idx?", ":"  ")+ls[0];}
    else if(!last)ls[ls.length-1]+=",";
    if(trail)ls[ls.length-1]+=" "+trail.v;
    ls.forEach((l,k)=>out.push(ctx.IND+(ctx.leading&&k>0?"  ":"")+l));
  });
  out.push(close);
  return out;
}
function splitCond(nodes){ /* top-level AND / OR split; BETWEEN a AND b keeps its AND */
  const parts=[{op:"",nodes:[]}];
  let between=0;
  for(const n of nodes){
    if(isW(n,"BETWEEN"))between++;
    if(n.k==="w"&&(n.up==="AND"||n.up==="OR")){
      if(n.up==="AND"&&between>0){between--;parts[parts.length-1].nodes.push(n);continue;}
      parts.push({op:n.v,nodes:[]});continue;
    }
    parts[parts.length-1].nodes.push(n);
  }
  return parts;
}
function renderCase(inner,ctx){
  const pieces=[],operand=[];
  let depth=0,curPiece=null;
  for(const n of inner){
    if(isW(n,"CASE"))depth++;
    if(isW(n,"END"))depth--;
    if(depth===0&&n.k==="w"&&(n.up==="WHEN"||n.up==="ELSE")){curPiece={kind:n.up,when:[],then:[],inThen:false};pieces.push(curPiece);continue;}
    if(depth===0&&isW(n,"THEN")&&curPiece){curPiece.inThen=true;continue;}
    if(!curPiece)operand.push(n);
    else (curPiece.inThen||curPiece.kind==="ELSE"?curPiece.then:curPiece.when).push(n);
  }
  const K=w=>kw(ctx,w);
  const head=K("CASE")+(operand.length?" "+renderExpr(operand,ctx).join(" "):"");
  const sub=pieces.map(p=>{
    const w=renderExpr(p.when,ctx),t=renderExpr(p.then,ctx);
    if(p.kind==="ELSE")return{lines:[K("ELSE")+" "+t[0]].concat(t.slice(1).map(l=>ctx.IND+l))};
    const l=[K("WHEN")+" "+w[0]].concat(w.slice(1).map(x=>ctx.IND+x));
    l[l.length-1]+=" "+K("THEN")+" "+t[0];
    return{lines:l.concat(t.slice(1).map(x=>ctx.IND+x))};
  });
  const oneLine=head+" "+sub.map(s=>s.lines[0]).join(" ")+" "+K("END");
  if(sub.every(s=>s.lines.length===1)&&oneLine.length<=60&&!/--/.test(oneLine))return[oneLine];
  const out=[head];
  sub.forEach(s=>s.lines.forEach(l=>out.push(ctx.IND+l)));
  out.push(K("END"));
  return out;
}

/* Statement = nodes without top-level semicolons. */
function formatStatement(nodes,ctx){
  /* segment into clauses */
  const clauses=[],pre=[];
  let curC=null;
  const matchAt=(i,words)=>{for(let k=0;k<words.length;k++)if(!isW(nodes[i+k],words[k]))return false;return true;};
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i];
    let hit=null;
    if(n.k==="w"){
      /* JOIN family */
      let j=i;while(j<nodes.length&&nodes[j].k==="w"&&JOIN_MODS.has(nodes[j].up))j++;
      if(isW(nodes[j],"JOIN")){hit={words:nodes.slice(i,j+1).map(x=>x.v),len:j-i+1,join:true};}
      else if((n.up==="CROSS"||n.up==="OUTER")&&isW(nodes[i+1],"APPLY"))hit={words:[n.v,nodes[i+1].v],len:2,join:true};
      else{
        for(const words of CLAUSES){
          if(!matchAt(i,words))continue;
          const first=words[0];
          if(STATEMENT_START.has(first)){
            const atStart=!clauses.length||(clauses.length===1&&clauses[0].name==="WITH"&&nodes[i-1]&&nodes[i-1].k==="g");
            if(!atStart)continue;
          }
          if(first==="WITH"&&clauses.length)continue;
          if(first==="FROM"&&nodes[i-1]&&isW(nodes[i-1],"DISTINCT"))continue;
          if(first==="SET"&&!clauses.length&&false)continue;
          hit={words:nodes.slice(i,i+words.length).map(x=>x.v),len:words.length,name:words.join(" ")};break;
        }
      }
    }
    if(hit){
      curC={name:hit.name||"JOIN",words:hit.words,join:!!hit.join,body:[]};
      clauses.push(curC);i+=hit.len-1;continue;
    }
    (curC?curC.body:pre).push(n);
  }
  const lines=[];
  const emit=(ls)=>{for(const l of ls)lines.push(l);};
  if(pre.length)emit(renderExpr(pre,ctx));
  for(const c of clauses){
    const K=c.words.map(w=>kw(ctx,w)).join(" ");
    emit(renderClause(c,K,ctx));
  }
  if(!lines.length)return[""];
  return lines;
}
function renderClause(c,K,ctx){
  const IND=ctx.IND;
  let body=c.body,head=K;
  /* attach DISTINCT / ALL / TOP n / DISTINCT ON (...) to the SELECT keyword line */
  if(c.name==="SELECT"){
    let i=0;
    while(i<body.length){
      const b=body[i];
      if(isW(b,"DISTINCT")||isW(b,"ALL")){head+=" "+kw(ctx,b.v);i++;if(isW(b,"DISTINCT")&&isW(body[i],"ON")&&body[i+1]&&body[i+1].k==="g"){head+=" "+body[i].v+" "+renderExpr([body[i+1]],ctx).join(" ");i+=2;}continue;}
      if(isW(b,"TOP")&&body[i+1]){head+=" "+kw(ctx,b.v)+" "+renderExpr([body[i+1]],ctx).join(" ");i+=2;if(isW(body[i],"PERCENT")){head+=" "+body[i].v;i++;}continue;}
      break;
    }
    body=body.slice(i);
  }
  if(!body.length)return[head];
  const savedParen=ctx.spaceParen,savedTop=ctx.ddlTop;
  if(c.name==="INSERT INTO"||c.name==="REPLACE INTO")ctx.spaceParen=true;
  try{
    if(c.join)return renderJoin(head,body,ctx);
    if(c.name==="WITH"){
      const items=splitTop(body,isComma);
      const out=[];
      items.forEach((it,idx)=>{
        const r=renderExpr(it,ctx);
        if(idx===0)r[0]=head+" "+r[0];
        const last=idx===items.length-1;
        if(!last)r[r.length-1]+=",";
        if(it.trail)r[r.length-1]+=" "+it.trail.v;
        out.push(...r);
      });
      return out;
    }
    if(COND_CLAUSES.has(c.name)){
      const parts=splitCond(body);
      const out=[];
      parts.forEach((p,idx)=>{
        const r=renderExpr(p.nodes,ctx);
        if(!idx){r[0]=head+" "+r[0];out.push(r[0]);r.slice(1).forEach(l=>out.push(IND+l));}
        else{r[0]=kwCase(ctx,p.op)+" "+r[0];r.forEach(l=>out.push(IND+l));}
      });
      return out;
    }
    if(LIST_CLAUSES.has(c.name)||c.name==="VALUES"){
      const items=splitTop(body,isComma);
      const rendered=items.map(it=>{const r=renderExpr(it,ctx);return r;});
      const anyTrail=items.some(it=>it.trail);
      if(items.length===1&&rendered[0].length===1&&!anyTrail&&(head+" "+rendered[0][0]).length<=ctx.maxLine)return[head+" "+rendered[0][0]];
      const out=[head];
      rendered.forEach((r,idx)=>{
        const last=idx===rendered.length-1,ls=r.slice();
        if(ctx.leading){ls[0]=(idx?", ":"  ")+ls[0];}
        else if(!last)ls[ls.length-1]+=",";
        if(items[idx].trail)ls[ls.length-1]+=" "+items[idx].trail.v;
        ls.forEach((l,k)=>out.push(IND+(ctx.leading&&k>0?"  ":"")+l));
      });
      return out;
    }
    const r=renderExpr(body,ctx);
    r[0]=head+" "+r[0];
    return r.map((l,k)=>k?IND+l:l);
  }finally{ctx.spaceParen=savedParen;ctx.ddlTop=savedTop;}
}
const kwCase=(ctx,w)=>kw(ctx,w);
function renderJoin(head,body,ctx){
  const IND=ctx.IND;
  let onAt=-1;
  for(let i=0;i<body.length;i++){if(isW(body[i],"ON")||isW(body[i],"USING")){onAt=i;break;}}
  const tbl=renderExpr(onAt<0?body:body.slice(0,onAt),ctx);
  const out=[head+" "+tbl[0]].concat(tbl.slice(1).map(l=>IND+l));
  if(onAt<0)return out;
  const cond=body.slice(onAt+1),keyword=kw(ctx,body[onAt].v);
  if(isW(body[onAt],"USING")){
    const r=renderExpr(cond,ctx);out[out.length-1]+=" "+keyword+" "+r[0];r.slice(1).forEach(l=>out.push(IND+l));return out;
  }
  const parts=splitCond(cond),firstR=renderExpr(parts[0].nodes,ctx);
  if(parts.length===1&&firstR.length===1&&(out[out.length-1]+" "+keyword+" "+firstR[0]).length<=ctx.maxLine){out[out.length-1]+=" "+keyword+" "+firstR[0];return out;}
  parts.forEach((p,idx)=>{
    const r=renderExpr(p.nodes,ctx);
    r[0]=(idx?kw(ctx,p.op)+" ":keyword+" ")+r[0];
    r.forEach((l,k)=>out.push(IND+(k?IND:"")+l));
  });
  return out;
}

function format(sql,opts){
  opts=opts||{};
  const src=String(sql==null?"":sql);
  if(src.length>MAX_INPUT)throw Error("Input is larger than 2,000,000 characters.");
  const ctx=makeCtx(opts);
  const{tokens,issues}=tokenize(src,ctx.dialect);
  const tree=toTree(tokens,issues);
  /* split statements on top-level semicolons */
  const stmts=[[]];
  for(const n of tree){stmts[stmts.length-1].push(n);if(isSemi(n))stmts.push([]);}
  const outStmts=[];
  for(const st of stmts){
    if(!st.length)continue;
    const hasSemi=isSemi(st[st.length-1]);
    const nodes=hasSemi?st.slice(0,-1):st;
    if(!nodes.length&&!hasSemi)continue;
    const first=nodes.find(n=>n.k!=="c");
    ctx.ddl=!!first&&isW(first,"CREATE");
    ctx.ddlTop=null;
    if(ctx.ddl){ /* CREATE TABLE ( ... ): one column per line */
      const g=nodes.find(n=>n.k==="g"&&n.open==="(");ctx.ddlTop=g||null;
    }
    let tailComment=null;
    if(hasSemi&&nodes.length>1&&nodes[nodes.length-1].k==="c"&&nodes[nodes.length-1].line)tailComment=nodes.pop();
    const lines=formatStatement(nodes,ctx);
    if(hasSemi)lines[lines.length-1]+=";";
    if(tailComment){if(tailComment.nl)lines.push(tailComment.v);else lines[lines.length-1]+=" "+tailComment.v;}
    outStmts.push(lines.join("\n"));
  }
  let output=outStmts.join(ctx.blank?"\n\n":"\n");
  const warnings=Array.from(new Set(issues));
  /* Safety net: the formatted text must contain exactly the same significant tokens as the input. If a layout rule ever breaks
     that (for example a line comment swallowing a following token), show the original text rather than altered SQL. */
  let fallback=false;
  if(!opts.noFallback&&JSON.stringify(fingerprint(output,ctx.dialect))!==JSON.stringify(fingerprint(src,ctx.dialect))){
    output=src.trim();fallback=true;
    warnings.push("Layout could not be applied safely to this input, so the original text is shown unchanged");
  }
  return{output:output,warnings:warnings,statements:outStmts.length,fallback:fallback};
}

/* Significant-token fingerprint used by tests and the UI "content unchanged" check: comments and whitespace are ignored,
   reserved-keyword case is folded. */
function fingerprint(sql,dialect){
  const{tokens}=tokenize(sql,dialect);
  const out=[];let prevWord="";
  for(const t of tokens){
    if(t.t==="ws"||t.t==="lc"||t.t==="bc")continue;
    if(t.t==="word"){
      const up=t.v.toUpperCase();
      out.push(KEYWORDS.has(up)||(up==="KEY"&&(prevWord==="PRIMARY"||prevWord==="FOREIGN"))?up:t.v);prevWord=up;
    }else{out.push(t.v);prevWord="";}
  }
  return out;
}

return{sqlFormat:format,sqlMinify:minify,sqlTokenize:tokenize,sqlFingerprint:fingerprint,SQL_DIALECTS:DIALECTS};});
