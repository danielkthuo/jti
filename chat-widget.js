/****************************************************
 JOSHCAB AI CHAT WIDGET
 Drop this on ANY page with:
   <script src="chat-widget.js"></script>
 right before </body>. No other markup needed —
 this file injects its own CSS, HTML and JS.

 Includes a WhatsApp-style "View Services" menu
 driven by the JTI knowledge base (KB_DATA below).
****************************************************/

(function(){
"use strict";

/****************************************************
 WAIT FOR DOM
 (needed because this script may be placed in <head>,
 before document.body exists)
****************************************************/

if(document.readyState === "loading"){
document.addEventListener("DOMContentLoaded", init);
}else{
init();
}

function init(){

/****************************************************
 CONFIGURATION
****************************************************/

const WEBAPP_URL =
"https://script.google.com/macros/s/AKfycbyRtkRTEEED2-c7Hff_R96eSWE3mzgLCh3uGum_spkT6LW6eopoHCYcYrZNYtAtCM1W/exec";

/****************************************************
 KNOWLEDGE BASE (LIVE)
 Fetched from your Google Sheet via Apps Script, not
 hard-coded. Sheet stays the single source of truth.

 KB_URL: same WEBAPP_URL as your chatbot, with
 ?action=kb appended (see AppsScript_KB_Addition.gs).
 If you deploy the KB endpoint separately, change this
 to that deployment's /exec URL instead.

 Cached locally for CACHE_TTL_MS so the menu opens
 instantly after the first load, and refreshed quietly
 in the background so edits to the sheet show up soon
 after without the user noticing a delay.
****************************************************/

const KB_URL = WEBAPP_URL + "?action=kb";
const KB_CACHE_KEY = "joshcab_kb_cache_v1";
const KB_CACHE_TIME_KEY = "joshcab_kb_cache_v1_time";
const KB_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const KB_ICONS = {
"General Institute Information": "🏫",
"Course Offerings": "📚",
"ICT Certificate": "💻",
"Computer Packages": "🖥️",
"Web Design": "🌐",
"Advanced Excel": "📊",
"Kids Coding": "🧒",
"Graphic Design": "🎨",
"QuickBooks": "💰",
"Sage Accounting": "🧾",
"Video Editing": "🎬",
"Digital Marketing": "📣",
"Bookkeeping": "📒",
"Registration & Admissions": "📝",
"Payment & Fees": "💳",
"Learning Management System (LMS)": "🖱️",
"Facilities & Support": "🏢",
"General FAQ": "❓"
};

/****************************************************
 SAFE STORAGE HELPERS
 localStorage can throw in some private-browsing modes
 or when storage is disabled/full. Wrapping every call
 keeps the widget from crashing the host page in those
 cases — behavior is otherwise identical (falls back to
 "no cache"/"no history" exactly as before).
****************************************************/

function safeGetItem(key){
try{
return localStorage.getItem(key);
}catch(e){
return null;
}
}

function safeSetItem(key, value){
try{
localStorage.setItem(key, value);
return true;
}catch(e){
return false;
}
}

/****************************************************
 UUID HELPER
 crypto.randomUUID() isn't available on some older
 browsers/insecure (non-HTTPS) contexts. Fall back to a
 RFC4122-ish generator so session IDs still work there.
****************************************************/

function generateUUID(){
if(window.crypto && typeof window.crypto.randomUUID === "function"){
try{
return window.crypto.randomUUID();
}catch(e){
// fall through to manual generation
}
}
return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){
const r = Math.random() * 16 | 0;
const v = c === "x" ? r : (r & 0x3 | 0x8);
return v.toString(16);
});
}

/****************************************************
 STYLES
****************************************************/

const css = `
#jti-chatButton{
position:fixed;right:20px;bottom:20px;width:65px;height:65px;
border-radius:50%;background:#25D366;display:flex;justify-content:center;
align-items:center;font-size:30px;cursor:pointer;color:#fff;
box-shadow:0 8px 20px rgba(0,0,0,.25);transition:.3s;z-index:9999;
font-family:Arial,Helvetica,sans-serif;
}
#jti-chatButton:hover{transform:scale(1.08);}
#jti-chatButton:focus-visible{outline:3px solid #0B5ED7;outline-offset:2px;}

#jti-chatWindow{
position:fixed;bottom:95px;right:20px;width:min(380px,95vw);
height:min(650px,85vh);background:#fff;border-radius:18px;overflow:hidden;
display:none;box-shadow:0 15px 40px rgba(0,0,0,.25);flex-direction:column;
z-index:9999;font-family:Arial,Helvetica,sans-serif;position:fixed;
}

#jti-header{
background:#0B5ED7;color:white;padding:15px;display:flex;
justify-content:space-between;align-items:center;
}
#jti-title{display:flex;flex-direction:column;}
#jti-title b{font-size:18px;}
#jti-title small{opacity:.9;font-size:12px;}
#jti-close{cursor:pointer;font-size:24px;}
#jti-close:focus-visible{outline:2px solid #fff;outline-offset:2px;}

#jti-messages{flex:1;overflow-y:auto;padding:15px;background:#F8F9FA;}

.jti-message{margin:12px 0;display:flex;flex-direction:column;animation:jti-fade .2s;}
.jti-user{align-items:flex-end;}
.jti-bot{align-items:flex-start;}
.jti-bubble{max-width:85%;padding:12px 15px;border-radius:18px;line-height:1.5;word-wrap:break-word;}
.jti-user .jti-bubble{background:#DCF8C6;}
.jti-bot .jti-bubble{background:#fff;border:1px solid #ddd;}
.jti-time{font-size:11px;color:#888;margin-top:4px;}

.jti-typing{display:flex;gap:4px;padding:10px;}
.jti-typing span{width:8px;height:8px;background:#999;border-radius:50%;animation:jti-typing 1s infinite;}
.jti-typing span:nth-child(2){animation-delay:.2s;}
.jti-typing span:nth-child(3){animation-delay:.4s;}
@keyframes jti-typing{0%{opacity:.2;}50%{opacity:1;}100%{opacity:.2;}}
@keyframes jti-fade{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

/* "Select a service" prompt bubble (like WhatsApp menu trigger) */
.jti-menu-trigger{
background:#fff;border:1px solid #ddd;border-radius:18px;padding:12px 15px;
max-width:85%;cursor:pointer;
}
.jti-menu-trigger .jti-menu-label{color:#111;margin-bottom:8px;font-size:14px;}
.jti-menu-trigger .jti-menu-btn{
display:flex;align-items:center;gap:8px;color:#0B5ED7;font-weight:bold;
border-top:1px solid #eee;padding-top:8px;font-size:14px;
}
.jti-menu-trigger:hover .jti-menu-btn{text-decoration:underline;}
.jti-menu-trigger:focus-visible{outline:2px solid #0B5ED7;outline-offset:2px;}

#jti-footer{display:flex;padding:10px;background:white;border-top:1px solid #ddd;}
#jti-message{flex:1;padding:11px;border:1px solid #ccc;border-radius:8px;outline:none;font-size:14px;}
#jti-send{margin-left:8px;padding:11px 18px;background:#0B5ED7;border:none;border-radius:8px;color:white;cursor:pointer;}
#jti-send:hover{background:#084298;}
#jti-send:disabled{opacity:.6;cursor:not-allowed;}

#jti-chatWindow a{color:#0B5ED7;text-decoration:none;font-weight:bold;}

/* Slide-up service panel (matches the "View Services" screenshot) */
#jti-panel-overlay{
position:absolute;inset:0;background:rgba(0,0,0,.25);
display:none;z-index:20;
}
#jti-panel{
position:absolute;left:0;right:0;bottom:0;max-height:85%;
background:#fff;border-radius:18px 18px 0 0;
box-shadow:0 -10px 30px rgba(0,0,0,.2);
display:flex;flex-direction:column;
transform:translateY(100%);transition:transform .25s ease;
}
#jti-panel.jti-open{transform:translateY(0);}
#jti-panel-header{
display:flex;align-items:center;gap:12px;padding:16px;
border-bottom:1px solid #eee;flex-shrink:0;
}
#jti-panel-back{cursor:pointer;font-size:20px;color:#333;visibility:hidden;}
#jti-panel-back.jti-show{visibility:visible;}
#jti-panel-close{cursor:pointer;font-size:20px;color:#333;margin-left:auto;}
#jti-panel-title{font-size:16px;font-weight:bold;color:#111;}
#jti-panel-list{overflow-y:auto;padding:8px 0;}
.jti-panel-row{
display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;
}
.jti-panel-row:hover{background:#F8F9FA;}
.jti-panel-row:focus-visible{outline:2px solid #0B5ED7;outline-offset:-2px;background:#F8F9FA;}
.jti-panel-row-icon{font-size:22px;flex-shrink:0;}
.jti-panel-row-text{flex:1;}
.jti-panel-row-title{font-size:14.5px;color:#111;font-weight:600;}
.jti-panel-row-sub{font-size:12.5px;color:#777;margin-top:2px;}
.jti-panel-row-radio{
width:20px;height:20px;border-radius:50%;border:2px solid #bbb;flex-shrink:0;
}

@media(max-width:600px){
#jti-chatWindow{right:10px;left:10px;width:auto;bottom:85px;}
}
`;

const styleTag = document.createElement("style");
styleTag.innerHTML = css;
document.head.appendChild(styleTag);

/****************************************************
 MARKUP
 (aria attributes added for screen-reader support;
 no visual or structural change)
****************************************************/

const html = `
<div id="jti-chatButton" role="button" tabindex="0" aria-label="Open chat">\ud83d\udcac</div>

<div id="jti-chatWindow" role="dialog" aria-modal="false" aria-label="Joshcab AI chat">
  <div id="jti-header">
    <div id="jti-title">
      <b>Joshcab AI</b>
      <small>Online Assistant</small>
    </div>
    <div id="jti-close" role="button" tabindex="0" aria-label="Close chat">\u00d7</div>
  </div>

  <div id="jti-messages" role="log" aria-live="polite"></div>

  <div id="jti-footer">
    <input id="jti-message" type="text" placeholder="Ask me anything..." aria-label="Type your message">
    <button id="jti-send" type="button">Send</button>
  </div>

  <div id="jti-panel-overlay">
    <div id="jti-panel" role="dialog" aria-label="View services">
      <div id="jti-panel-header">
        <div id="jti-panel-back" role="button" tabindex="0" aria-label="Back to categories">\u2039</div>
        <div id="jti-panel-title">View Services</div>
        <div id="jti-panel-close" role="button" tabindex="0" aria-label="Close services panel">\u00d7</div>
      </div>
      <div id="jti-panel-list"></div>
    </div>
  </div>
</div>
`;

const container = document.createElement("div");
container.id = "jti-chat-widget-root";
container.innerHTML = html;
document.body.appendChild(container);

/****************************************************
 ELEMENTS
****************************************************/

const chatButton = document.getElementById("jti-chatButton");
const chatWindow = document.getElementById("jti-chatWindow");
const closeBtn = document.getElementById("jti-close");

const messages = document.getElementById("jti-messages");
const input = document.getElementById("jti-message");
const send = document.getElementById("jti-send");

const panelOverlay = document.getElementById("jti-panel-overlay");
const panel = document.getElementById("jti-panel");
const panelHeader = document.getElementById("jti-panel-title");
const panelList = document.getElementById("jti-panel-list");
const panelBack = document.getElementById("jti-panel-back");
const panelClose = document.getElementById("jti-panel-close");

/****************************************************
 SESSION
****************************************************/

let sessionId = safeGetItem("joshcab_session");

if(!sessionId){
sessionId = generateUUID();
safeSetItem("joshcab_session", sessionId);
}

/****************************************************
 LOAD CHAT (shared across every page via localStorage)
****************************************************/

const history = safeGetItem("joshcab_history");

if(history){
messages.innerHTML = history;
}else{
welcome();
}

/****************************************************
 EVENTS
****************************************************/

chatButton.addEventListener("click", function(){
chatWindow.style.display = "flex";
input.focus();
});

// Keyboard support for the round chat-launcher (it's a div
// with role="button", so Enter/Space need to be wired up
// manually to behave like a real button).
chatButton.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
chatButton.click();
}
});

closeBtn.addEventListener("click", function(){
chatWindow.style.display = "none";
});

closeBtn.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
closeBtn.click();
}
});

send.addEventListener("click", function(){
sendMessage();
});

input.addEventListener("keypress", function(e){
if(e.key === "Enter"){
sendMessage();
}
});

// Esc closes whichever layer is open (panel first, else window) —
// purely an accessibility/convenience addition, doesn't affect any
// existing click-driven flow.
document.addEventListener("keydown", function(e){
if(e.key !== "Escape"){ return; }
if(panelOverlay.style.display === "block"){
closePanel();
}else if(chatWindow.style.display === "flex"){
chatWindow.style.display = "none";
}
});

panelOverlay.addEventListener("click", function(e){
if(e.target === panelOverlay){ closePanel(); }
});
panelClose.addEventListener("click", closePanel);
panelClose.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
closePanel();
}
});
panelBack.addEventListener("click", function(){
openCategoryList();
});
panelBack.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
openCategoryList();
}
});

/****************************************************
 WELCOME
****************************************************/

function welcome(){
addMessage("bot", "\ud83d\udc4b Welcome to Joshcab Training Institute.\n\nHow may I help you today?");
addMenuTrigger();
}

/****************************************************
 TIME
****************************************************/

function now(){
return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/****************************************************
 MESSAGE
****************************************************/

function addMessage(type, text){

const wrapper = document.createElement("div");
wrapper.className = "jti-message jti-" + type;

const bubble = document.createElement("div");
bubble.className = "jti-bubble";
bubble.innerHTML = format(text);

const time = document.createElement("div");
time.className = "jti-time";
time.innerText = now();

wrapper.appendChild(bubble);
wrapper.appendChild(time);

messages.appendChild(wrapper);

scrollBottom();
saveHistory();
}

/****************************************************
 MENU TRIGGER BUBBLE
 ("Select a service from the list below to proceed")
****************************************************/

function addMenuTrigger(){

const wrapper = document.createElement("div");
wrapper.className = "jti-message jti-bot";

const bubble = document.createElement("div");
bubble.className = "jti-bubble jti-menu-trigger";
bubble.setAttribute("role", "button");
bubble.setAttribute("tabindex", "0");
bubble.setAttribute("aria-label", "View services");
bubble.innerHTML = `
<div class="jti-menu-label">Select a service from the list below to proceed:</div>
<div class="jti-menu-btn">\u2630 View Services</div>
`;
bubble.addEventListener("click", openCategoryList);
bubble.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
openCategoryList();
}
});

const time = document.createElement("div");
time.className = "jti-time";
time.innerText = now();

wrapper.appendChild(bubble);
wrapper.appendChild(time);

messages.appendChild(wrapper);
scrollBottom();
saveHistory();
}

/****************************************************
 KNOWLEDGE BASE LOADING (live, with local cache)
****************************************************/

let kbMemoryCache = null; // in-memory for this page view once fetched

function getCachedKB(){
try{
const raw = safeGetItem(KB_CACHE_KEY);
const time = parseInt(safeGetItem(KB_CACHE_TIME_KEY) || "0", 10);
if(!raw){ return null; }
return { data: JSON.parse(raw), stale: Date.now() - time > KB_CACHE_TTL_MS };
}catch(e){
return null;
}
}

function setCachedKB(data){
safeSetItem(KB_CACHE_KEY, JSON.stringify(data));
safeSetItem(KB_CACHE_TIME_KEY, String(Date.now()));
}

async function fetchKB(){
const response = await fetch(KB_URL);
const data = await response.json();
if(data && data.error){ throw new Error(data.error); }
kbMemoryCache = data;
setCachedKB(data);
return data;
}

// Kick off a background fetch as soon as the widget loads, so the
// menu is instant on first tap. Sheet edits show up within KB_CACHE_TTL_MS.
fetchKB().catch(function(){ /* silent - menu will retry when opened */ });

/****************************************************
 SERVICE PANEL (category list -> question list -> answer)
****************************************************/

function openPanel(){
panelOverlay.style.display = "block";
requestAnimationFrame(function(){
panel.classList.add("jti-open");
});
}

function closePanel(){
panel.classList.remove("jti-open");
setTimeout(function(){
panelOverlay.style.display = "none";
}, 250);
}

function renderPanelMessage(text){
panelList.innerHTML = `<div style="padding:24px 18px;color:#888;font-size:14px;text-align:center;">${escapeHtml(text)}</div>`;
}

async function openCategoryList(){
panelHeader.innerText = "View Services";
panelBack.classList.remove("jti-show");
openPanel();

// Prefer fresh in-memory data, then cache (even if stale, show it
// immediately while refreshing quietly), then fetch from scratch.
let kb = kbMemoryCache;

if(!kb){
const cached = getCachedKB();
if(cached){
kb = cached.data;
if(cached.stale){
fetchKB().then(function(fresh){
// only re-render if the user is still looking at the category list
if(panelBack.classList.contains("jti-show") === false){
renderCategoryRows(fresh);
}
}).catch(function(){});
}
}
}

if(!kb){
renderPanelMessage("Loading services...");
try{
kb = await fetchKB();
}catch(e){
renderPanelMessage("Unable to load services right now. Please check your connection and try again.");
return;
}
}

renderCategoryRows(kb);
}

function renderCategoryRows(kb){
panelList.innerHTML = "";

if(!kb || kb.length === 0){
renderPanelMessage("No services available right now.");
return;
}

kb.forEach(function(cat){
const icon = KB_ICONS[cat.category] || "📌";
const subtitle = cat.items.length + (cat.items.length === 1 ? " topic" : " topics");

const row = document.createElement("div");
row.className = "jti-panel-row";
row.setAttribute("role", "button");
row.setAttribute("tabindex", "0");
row.innerHTML = `
<div class="jti-panel-row-icon">${icon}</div>
<div class="jti-panel-row-text">
<div class="jti-panel-row-title">${escapeHtml(cat.category)}</div>
<div class="jti-panel-row-sub">${escapeHtml(subtitle)}</div>
</div>
<div class="jti-panel-row-radio"></div>
`;
row.addEventListener("click", function(){
openQuestionList(cat);
});
row.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
openQuestionList(cat);
}
});
panelList.appendChild(row);
});
}

function openQuestionList(cat){
panelHeader.innerText = cat.category;
panelBack.classList.add("jti-show");
panelList.innerHTML = "";

cat.items.forEach(function(item){
const row = document.createElement("div");
row.className = "jti-panel-row";
row.setAttribute("role", "button");
row.setAttribute("tabindex", "0");
row.innerHTML = `
<div class="jti-panel-row-icon">\ud83d\udcac</div>
<div class="jti-panel-row-text">
<div class="jti-panel-row-title">${escapeHtml(item.title)}</div>
</div>
<div class="jti-panel-row-radio"></div>
`;
row.addEventListener("click", function(){
selectQuestion(item);
});
row.addEventListener("keydown", function(e){
if(e.key === "Enter" || e.key === " "){
e.preventDefault();
selectQuestion(item);
}
});
panelList.appendChild(row);
});
}

function selectQuestion(item){
closePanel();
addMessage("user", item.title);
showTyping();
setTimeout(function(){
removeTyping();
addMessage("bot", item.content);
addMenuTrigger();
}, 400);
}

/****************************************************
 TYPING
****************************************************/

function showTyping(){
const wrap = document.createElement("div");
wrap.className = "jti-message jti-bot";
wrap.id = "jti-typing";
wrap.innerHTML = `
<div class="jti-bubble">
<div class="jti-typing">
<span></span><span></span><span></span>
</div>
</div>
`;
messages.appendChild(wrap);
scrollBottom();
}

function removeTyping(){
const t = document.getElementById("jti-typing");
if(t){ t.remove(); }
}

/****************************************************
 SEND
****************************************************/

let sending = false;

async function sendMessage(){

const text = input.value.trim();

if(text === "" || sending){ return; }

sending = true;
send.disabled = true;
input.disabled = true;

addMessage("user", text);
input.value = "";

showTyping();

try{

const response = await fetch(
WEBAPP_URL +
"?session=" + encodeURIComponent(sessionId) +
"&message=" + encodeURIComponent(text)
);

const data = await response.json();

removeTyping();
addMessage("bot", data.reply);

}catch(err){
removeTyping();
addMessage("bot", "\u26a0 Unable to reach the server.\nPlease try again.");
}

send.disabled = false;
input.disabled = false;
input.focus();
sending = false;
}

/****************************************************
 FORMAT
****************************************************/

function format(text){
return escapeHtml(text)
.replace(/\n/g, "<br>")
.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

function escapeHtml(str){
return String(str)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/\'/g, "&#039;");
}

/****************************************************
 STORAGE
****************************************************/

function saveHistory(){
safeSetItem("joshcab_history", messages.innerHTML);
}

function scrollBottom(){
messages.scrollTop = messages.scrollHeight;
}

} // end init()

})();
