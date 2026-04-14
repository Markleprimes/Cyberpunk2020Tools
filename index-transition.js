const LAUNCHER_BOOT_RAW_KEY='cp2020_boot_raw_character';
const LAUNCHER_BOOT_DATA_KEY='cp2020_boot_character_data';
const LAUNCHER_TARGET_URL='DND.html?v=20260414b';

const TRANSITION_TOKENS=[
  'CMD.Breach::init::ICE///',
  'CMD.Trace::token.lumin::relay.shadow;',
  'SYS.exec::latch.exe::vault.edge;',
  'priM.stack::ztech::tool.mz;',
  'content.file::ghost2.4.9///decrypt',
  'ICE.scan::auth.delta::quiet;',
  'CMD.Buffer::cipher.lace::inject///',
  'CMD.Route::A-01::uplink.gamma;',
  'CMD.Mask::shroud::fork///',
  'CMD.Spoof::signal::override///',
  'RAM.heap::mirror.heap::staged;',
  'NODE.lock::grid.fuse::bypass;'
];

let transitionInterval=null;
let transitionTimeout=null;
let transitionActive=false;

function launcherRandomLine(){
  const head=TRANSITION_TOKENS[Math.floor(Math.random()*TRANSITION_TOKENS.length)];
  const tail=Math.random().toString(16).slice(2,10).toUpperCase();
  return `${head}${tail}`;
}

function fillTransitionGrid(){
  const grid=document.getElementById('transition-grid');
  if(!grid)return;
  grid.innerHTML='';
  for(let i=0;i<14;i+=1){
    const column=document.createElement('div');
    column.className='transition-column';
    column.textContent=Array.from({length:18},launcherRandomLine).join('\n');
    grid.appendChild(column);
  }
}

function tickTransitionGrid(){
  document.querySelectorAll('.transition-column').forEach((column)=>{
    const lines=column.textContent.split('\n');
    lines.shift();
    lines.push(launcherRandomLine());
    column.textContent=lines.join('\n');
  });
}

function clearLauncherPayload(){
  sessionStorage.removeItem(LAUNCHER_BOOT_RAW_KEY);
  sessionStorage.removeItem(LAUNCHER_BOOT_DATA_KEY);
}

function setLauncherPayload(payload){
  clearLauncherPayload();
  if(payload.rawText){
    sessionStorage.setItem(LAUNCHER_BOOT_RAW_KEY,payload.rawText);
  }else if(payload.characterData){
    sessionStorage.setItem(LAUNCHER_BOOT_DATA_KEY,JSON.stringify(payload.characterData));
  }
}

function startChippinInTransition(payload){
  if(transitionActive)return;
  transitionActive=true;
  setLauncherPayload(payload);

  const overlay=document.getElementById('transition-overlay');
  const title=document.getElementById('transition-title');
  const text=document.getElementById('transition-text');
  if(title)title.textContent=payload.rawText?'UPLINKING DOSSIER':'BUILDING CHARACTER SHELL';
  if(text)text.textContent=payload.rawText?'Parsing upload and routing into dossier...':'Writing blank dossier shell and syncing identity...';

  fillTransitionGrid();
  clearInterval(transitionInterval);
  clearTimeout(transitionTimeout);
  transitionInterval=setInterval(tickTransitionGrid,110);
  if(overlay)overlay.classList.add('show');

  transitionTimeout=setTimeout(()=>{
    clearInterval(transitionInterval);
    window.location.href=LAUNCHER_TARGET_URL;
  },1800);
}

window.startChippinInTransition=startChippinInTransition;
