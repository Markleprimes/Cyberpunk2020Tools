const launcherLoadBtn=document.getElementById('launcher-load-btn');
const launcherFileInput=document.getElementById('launcher-file-input');
const launcherCreateBtn=document.getElementById('launcher-create-btn');
const launcherModal=document.getElementById('launcher-modal');
const launcherCancelBtn=document.getElementById('launcher-cancel-btn');
const launcherForm=document.getElementById('launcher-form');
const launcherStatus=document.getElementById('launcher-status');
let launcherHoverAudio=null;
let launcherHoveredButton=null;

function setLauncherStatus(message){
  launcherStatus.textContent=message;
  launcherStatus.classList.add('show');
}

function clearLauncherStatus(){
  launcherStatus.textContent='';
  launcherStatus.classList.remove('show');
}

function openLauncherModal(){
  clearLauncherStatus();
  launcherModal.classList.add('show');
  launcherModal.setAttribute('aria-hidden','false');
  document.getElementById('launcher-name').focus();
}

function closeLauncherModal(){
  launcherModal.classList.remove('show');
  launcherModal.setAttribute('aria-hidden','true');
}
function playLauncherHoverSound(){
  if(!launcherHoverAudio){
    launcherHoverAudio=new Audio('audio/menu-hover.mp3');
    launcherHoverAudio.preload='auto';
  }
  launcherHoverAudio.currentTime=0;
  launcherHoverAudio.play().catch(()=>{});
}
document.addEventListener('mouseover',(event)=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button===launcherHoveredButton)return;
  if(button.contains(event.relatedTarget))return;
  launcherHoveredButton=button;
  playLauncherHoverSound();
});
document.addEventListener('mouseout',(event)=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button===launcherHoveredButton && !button.contains(event.relatedTarget)){
    launcherHoveredButton=null;
  }
});

function buildLauncherCharacterData(name,street,career){
  const aliases=street?[street]:[];
  return {
    name:[name,...aliases],
    stats:{REF:0,INT:0,COOL:0,ATTR:0,TECH:0,LUCK:0,EMPT:0},
    career:[career],
    careerSkill:{point:0},
    reputation:{rep:0},
    wallet:{eddies:0},
    physicalBody:{bodylevel:0,weight:0,stunpoint:0},
    body:{},
    stunpoint:{},
    armor:{Head:0,Torso:0,'R.Arm':0,'L.Arm':0,'R.Leg':0,'L.Leg':0},
    damage:{Head:0,Torso:0,'R.Arm':0,'L.Arm':0,'R.Leg':0,'L.Leg':0},
    inventory:{}
  };
}

launcherLoadBtn.addEventListener('click',()=>{
  clearLauncherStatus();
  launcherFileInput.value='';
  launcherFileInput.click();
});

launcherFileInput.addEventListener('change',(event)=>{
  const file=event.target.files?.[0];
  if(!file)return;
  if(!file.name.toLowerCase().endsWith('.txt')){
    setLauncherStatus('ONLY .TXT DOSSIERS ARE SUPPORTED.');
    return;
  }
  const reader=new FileReader();
  reader.onload=(loadEvent)=>{
    window.startChippinInTransition({rawText:String(loadEvent.target?.result||'')});
  };
  reader.onerror=()=>setLauncherStatus('FAILED TO READ DOSSIER FILE.');
  reader.readAsText(file);
});

launcherCreateBtn.addEventListener('click',openLauncherModal);
launcherCancelBtn.addEventListener('click',closeLauncherModal);

launcherModal.addEventListener('click',(event)=>{
  if(event.target===launcherModal)closeLauncherModal();
});

launcherForm.addEventListener('submit',(event)=>{
  event.preventDefault();
  const name=document.getElementById('launcher-name').value.trim();
  const street=document.getElementById('launcher-street').value.trim();
  const career=document.getElementById('launcher-career').value.trim();
  if(!name||!career){
    setLauncherStatus('NAME AND CAREER ARE REQUIRED.');
    return;
  }
  closeLauncherModal();
  window.startChippinInTransition({
    characterData:buildLauncherCharacterData(name,street,career)
  });
});
