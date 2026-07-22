/****************************************************
 JOSHCAB AI CHAT WIDGET
 Drop this on ANY page with:
   <script src="chat-widget.js"></script>
 right before </body>. No other markup needed —
 this file injects its own CSS, HTML and JS.
****************************************************/

(function(){

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

#jti-chatWindow{
position:fixed;bottom:95px;right:20px;width:min(380px,95vw);
height:min(650px,85vh);background:#fff;border-radius:18px;overflow:hidden;
display:none;box-shadow:0 15px 40px rgba(0,0,0,.25);flex-direction:column;
z-index:9999;font-family:Arial,Helvetica,sans-serif;
}

#jti-header{
background:#0B5ED7;color:white;padding:15px;display:flex;
justify-content:space-between;align-items:center;
}
#jti-title{display:flex;flex-direction:column;}
#jti-title b{font-size:18px;}
#jti-title small{opacity:.9;font-size:12px;}
#jti-close{cursor:pointer;font-size:24px;}

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

#jti-suggestions{display:flex;flex-wrap:wrap;gap:8px;padding:10px;background:#fff;border-top:1px solid #eee;}
.jti-suggest{background:#EEF4FF;border:1px solid #D7E3FF;padding:7px 12px;border-radius:20px;cursor:pointer;font-size:13px;}
.jti-suggest:hover{background:#DCE8FF;}

#jti-footer{display:flex;padding:10px;background:white;border-top:1px solid #ddd;}
#jti-message{flex:1;padding:11px;border:1px solid #ccc;border-radius:8px;outline:none;font-size:14px;}
#jti-send{margin-left:8px;padding:11px 18px;background:#0B5ED7;border:none;border-radius:8px;color:white;cursor:pointer;}
#jti-send:hover{background:#084298;}
#jti-send:disabled{opacity:.6;cursor:not-allowed;}

#jti-chatWindow a{color:#0B5ED7;text-decoration:none;font-weight:bold;}

@media(max-width:600px){
#jti-chatWindow{right:10px;left:10px;width:auto;bottom:85px;}
}
`;

const styleTag = document.createElement("style");
styleTag.innerHTML = css;
document.head.appendChild(styleTag);

/****************************************************
 MARKUP
****************************************************/

const html = `
<div id="jti-chatButton">💬</div>

<div id="jti-chatWindow">
  <div id="jti-header">
    <div id="jti-title">
      <b>Joshcab AI</b>
      <small>Online Assistant</small>
    </div>
    <div id="jti-close">×</div>
  </div>

  <div id="jti-messages"></div>

  <div id="jti-suggestions">
    <div class="jti-suggest">Computer Packages</div>
    <div class="jti-suggest">Course Fees</div>
    <div class="jti-suggest">Website Development</div>
    <div class="jti-suggest">Accounting Services</div>
  </div>

  <div id="jti-footer">
    <input id="jti-message" type="text" placeholder="Ask me anything...">
    <button id="jti-send">Send</button>
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

const suggestions = document.querySelectorAll(".jti-suggest");

/****************************************************
 SESSION
****************************************************/

let sessionId = localStorage.getItem("joshcab_session");

if(!sessionId){
sessionId = crypto.randomUUID();
localStorage.setItem("joshcab_session", sessionId);
}

/****************************************************
 LOAD CHAT (shared across every page via localStorage)
****************************************************/

const history = localStorage.getItem("joshcab_history");

if(history){
messages.innerHTML = history;
}else{
welcome();
}

/****************************************************
 EVENTS
****************************************************/

chatButton.onclick = function(){
chatWindow.style.display = "flex";
input.focus();
};

closeBtn.onclick = function(){
chatWindow.style.display = "none";
};

send.onclick = function(){
sendMessage();
};

input.addEventListener("keypress", function(e){
if(e.key === "Enter"){
sendMessage();
}
});

suggestions.forEach(function(btn){
btn.onclick = function(){
input.value = this.innerText;
sendMessage();
};
});

/****************************************************
 WELCOME
****************************************************/

function welcome(){
addMessage("bot", "👋 Welcome to Joshcab Training Institute.\n\nHow may I help you today?");
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
addMessage("bot", "⚠ Unable to reach the server.\nPlease try again.");
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
.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
}

function escapeHtml(str){
return str
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}

/****************************************************
 STORAGE
****************************************************/

function saveHistory(){
localStorage.setItem("joshcab_history", messages.innerHTML);
}

function scrollBottom(){
messages.scrollTop = messages.scrollHeight;
}

} // end init()

})();