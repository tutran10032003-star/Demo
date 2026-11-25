/* ai-brain.js · reusable "shared access OR your own key" AI helper.
   Usage:  <div id="brain-settings"></div>
           <script src="ai-brain.js"></script>
           Brain.mount("brain-settings");
           const a = await Brain.ask(systemPrompt, userMessage);   // a.text, a.i, a.o, a.mode, a.model
           Brain.usageLine(a)  // "Shared access · model · tokens in X / out Y · cost" */
(function(){
"use strict";
const RELAY="https://misty-dream-be18.tutran10032003.workers.dev";   // your Cloudflare Worker (holds the Gemini key)
const DEF={gemini:"gemini-flash-latest",openai:"gpt-4o-mini",anthropic:"claude-haiku-5-5",groq:"openai/gpt-oss-120b"};
const K="brain_key",C="brain_cfg";
const rd=k=>{try{return localStorage.getItem(k)||""}catch(e){return""}};
const wr=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const rm=k=>{try{localStorage.removeItem(k)}catch(e){}};
const cfg=()=>{try{return JSON.parse(rd(C)||"{}")}catch(e){return{}}};
const $=id=>document.getElementById(id);
function key(){return rd(K).trim()}
function mode(){return key()?"Your key ("+(cfg().prov||"gemini")+")":"Shared access"}
function friendly(st,body){
  if(st===503||st===429)return"The AI service is busy right now. Please try again in a minute.";
  if(st===401||st===403)return"The AI service rejected the request. If you pasted your own key, check it or press Forget key.";
  return"The AI service returned an error ("+st+"). "+String(body).slice(0,200);
}
async function ask(system,user){
  const c=cfg(),k=key(),relay=!k;
  const prov=relay?"gemini":(c.prov||"gemini"),model=(c.model||DEF[prov]||"").trim()||DEF[prov];
  let url,h={"Content-Type":"application/json"},b;
  if(prov==="openai"||prov==="groq"){
    url=prov==="openai"?"https://api.openai.com/v1/chat/completions":"https://api.groq.com/openai/v1/chat/completions";
    h.Authorization="Bearer "+k;b={model,messages:[{role:"system",content:system},{role:"user",content:user}]};
  }else if(prov==="anthropic"){
    url="https://api.anthropic.com/v1/messages";h["x-api-key"]=k;h["anthropic-version"]="2023-06-01";h["anthropic-dangerous-direct-browser-access"]="true";
    b={model,max_tokens:1500,system,messages:[{role:"user",content:user}]};
  }else{
    if(relay)url=RELAY;else{url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent";h["x-goog-api-key"]=k}
    b={systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:user}]}]};
  }
  let r,t;
  try{r=await fetch(url,{method:"POST",headers:h,body:JSON.stringify(b)});t=await r.text()}
  catch(e){throw new Error("Cannot reach the AI service. Check your connection and try again.")}
  if(!r.ok)throw new Error(friendly(r.status,t));
  let j;try{j=JSON.parse(t)}catch(e){throw new Error("The AI service sent an unreadable reply.")}
  const m=mode();
  if(prov==="anthropic")return{text:(j.content||[]).map(x=>x.text||"").join(""),i:j.usage?.input_tokens||0,o:j.usage?.output_tokens||0,mode:m,model:j.model||model};
  if(prov==="gemini")return{text:(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("")||"(empty reply)",i:j.usageMetadata?.promptTokenCount||0,o:j.usageMetadata?.candidatesTokenCount||0,mode:m,model:j.modelVersion||model};
  return{text:j.choices?.[0]?.message?.content||"(empty reply)",i:j.usage?.prompt_tokens||0,o:j.usage?.completion_tokens||0,mode:m,model:j.model||model};
}
function usageLine(a){
  const c=cfg(),pi=parseFloat(c.pin),po=parseFloat(c.pout);
  let s=a.mode+" · "+a.model+" · tokens in "+a.i+" / out "+a.o;
  if(pi>=0&&po>=0)s+=" · ≈ "+((a.i*pi+a.o*po)/1e6*100).toFixed(4)+" US cent";
  return s;
}
function mount(id){
  const el=$(id);if(!el)return;
  el.innerHTML='<details class="brain-box"><summary>⚙️ AI settings <span id="brain-badge"></span></summary>'+
  '<div class="brain-grid"><label>Provider<select id="brain-prov"><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="groq">Groq</option></select></label>'+
  '<label>Model<input id="brain-model" autocomplete="off"></label>'+
  '<label>Your API key<input id="brain-key" type="password" autocomplete="off"></label>'+
  '<label>Input price / 1M tokens (USD)<input id="brain-pin" inputmode="decimal"></label>'+
  '<label>Output price / 1M tokens (USD)<input id="brain-pout" inputmode="decimal"></label>'+
  '<div class="brain-btns"><button type="button" id="brain-save">Save</button><button type="button" id="brain-forget">Forget key</button></div></div>'+
  '<p id="brain-msg"></p><p class="brain-help">By default the page uses Shared access: a protected server holds the key, so nobody has to paste anything. If you paste your own key it is stored only in this browser (localStorage) and sent straight to your provider.</p></details>';
  const load=()=>{const c=cfg();$("brain-prov").value=c.prov||"gemini";$("brain-model").value=c.model||DEF[$("brain-prov").value];$("brain-pin").value=c.pin||"";$("brain-pout").value=c.pout||"";$("brain-key").value="";$("brain-key").placeholder=key()?"Key saved in this browser (hidden)":"Paste your key";$("brain-badge").textContent="· "+mode();$("brain-msg").textContent=key()?"Using your own key. Press Forget key to go back to Shared access.":"Using Shared access."};
  $("brain-prov").onchange=()=>{$("brain-model").value=DEF[$("brain-prov").value]};
  $("brain-save").onclick=()=>{const k=$("brain-key").value.trim();if(k)wr(K,k);wr(C,JSON.stringify({prov:$("brain-prov").value,model:$("brain-model").value.trim(),pin:$("brain-pin").value,pout:$("brain-pout").value}));load();$("brain-msg").textContent="✓ Saved. "+$("brain-msg").textContent};
  $("brain-forget").onclick=()=>{rm(K);load()};
  load();
}
window.Brain={ask,usageLine,mount,mode};
})();
