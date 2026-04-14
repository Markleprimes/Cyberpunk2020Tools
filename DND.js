/* ══════════════ STATE ══════════════ */
let sheetStats  = {};
let sheetSkills = [];
let repValue    = 0;
let walletValue = 0;
let upgradePoints = 0;
let bodyLevelVal = 0, weightVal = 0, stunVal = 0;
let inventory = {};
let rollModifiers = [];
let currentRoll = { sides: null, qty: 1, rolls: [], result: 0 };
let aimStackPoints = 0;
let _rollTimer = null;
let bannerImageData = '';
let inventoryEditState = null;
let aimHitWeapons = [];
let aimHitSelectedWeapon = null;
let dossierHoverAudio = null;
let dossierHoveredButton = null;
let rollCinemaFrame = null;
let rollCinemaNumberTimer = null;
let rollCinemaCountTimer = null;
let rollCinemaRevealTimer = null;
const LIMBS = ['Head','Torso','R.Arm','L.Arm','R.Leg','L.Leg'];
let limbSP  = {Head:0,Torso:0,'R.Arm':0,'L.Arm':0,'R.Leg':0,'L.Leg':0};
let limbDMG = {Head:0,Torso:0,'R.Arm':0,'L.Arm':0,'R.Leg':0,'L.Leg':0};

const STAT_COLORS={REF:'var(--stat-core)',INT:'var(--stat-core)',COOL:'var(--stat-core)',ATTR:'var(--stat-core)',TECH:'var(--stat-core)',LUCK:'var(--stat-core)',EMPT:'var(--stat-core)',MA:'var(--stat-core)',BODY:'var(--stat-core)',EMP:'var(--stat-core)'};
const CHARACTER_KEYS=new Set(['name','stats','career','careerskill','reputation','wallet','physicalbody','body','stunpoint','armor','damage']);
const INVENTORY_ORDER=['weapon','cyberware','miscellaneous','buff'];
const DEFAULT_STATS=['REF','INT','COOL','ATTR','TECH','LUCK','EMPT'];
const BOOT_RAW_KEY='cp2020_boot_raw_character';
const BOOT_DATA_KEY='cp2020_boot_character_data';

/* ══════════════ FORMAT TOGGLE ══════════════ */

/* ══════════════ UPLOAD ══════════════ */
/* FILE INPUTS */
document.getElementById('file-input2').addEventListener('change',e=>{if(e.target.files[0])readFile(e.target.files[0]);});
document.getElementById('item-file-input').addEventListener('change',e=>{if(e.target.files[0])readItemFile(e.target.files[0]);});
document.getElementById('banner-image-input').addEventListener('change',e=>{if(e.target.files[0])readBannerImage(e.target.files[0]);});
document.getElementById('inventory-editor-modal').addEventListener('click',e=>{if(e.target===document.getElementById('inventory-editor-modal'))closeInventoryEditor();});
document.getElementById('aim-hit-modal').addEventListener('click',e=>{if(e.target===document.getElementById('aim-hit-modal'))closeAimHitModal();});
document.getElementById('aim-bonus-modal').addEventListener('click',e=>{if(e.target===document.getElementById('aim-bonus-modal'))closeAimBonusModal();});
document.getElementById('new-char-modal').addEventListener('click',e=>{if(e.target===document.getElementById('new-char-modal'))closeNewCharacterModal();});
document.getElementById('roll-cinema-modal').addEventListener('click',e=>{if(e.target===document.getElementById('roll-cinema-modal'))closeRollCinemaModal();});
document.getElementById('inventory-item-name').addEventListener('keydown',e=>{if(e.key==='Enter')saveInventoryItem();});

function readFile(file){
  if(!file.name.endsWith('.txt')){showError('ERROR: Only .txt files are supported.');return;}
  const r=new FileReader();r.onload=e=>parseCharacter(e.target.result);r.readAsText(file);
}
function readItemFile(file){
  if(document.getElementById('sheet').style.display!=='block'){showError('LOAD A CHARACTER FILE BEFORE ADDING INVENTORY ITEMS.');return;}
  if(!file.name.endsWith('.txt')){showError('ERROR: Only .txt files are supported.');return;}
  const r=new FileReader();r.onload=e=>parseItemFile(e.target.result);r.readAsText(file);
}
function readBannerImage(file){
  if(!file.type.startsWith('image/')){showError('UPLOAD AN IMAGE FILE FOR THE DOSSIER BACKGROUND.');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    bannerImageData=e.target.result;
    renderBannerImage();
    showActionLog('UPDATED DOSSIER IMAGE');
  };
  reader.readAsDataURL(file);
}
function showError(msg){const b=document.getElementById('status-bar');b.textContent=msg;b.style.display='block';}
let _toastTimer=null;
function showActionLog(msg){
  const toast=document.getElementById('action-toast');
  toast.textContent=msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(()=>toast.classList.remove('show'),2000);
}
function clearRollCinemaTimers(){
  cancelAnimationFrame(rollCinemaFrame);
  clearInterval(rollCinemaNumberTimer);
  clearInterval(rollCinemaCountTimer);
  clearTimeout(rollCinemaRevealTimer);
  rollCinemaFrame=null;
  rollCinemaNumberTimer=null;
  rollCinemaCountTimer=null;
  rollCinemaRevealTimer=null;
}
function closeRollCinemaModal(){
  clearRollCinemaTimers();
  document.getElementById('roll-cinema-modal').classList.remove('show');
}
function setRollCinemaCards(rawVisible=false,modVisible=false,finalVisible=false){
  document.getElementById('roll-cinema-raw-card').classList.toggle('show',rawVisible);
  document.getElementById('roll-cinema-mod-card').classList.toggle('show',modVisible);
  document.getElementById('roll-cinema-final-card').classList.toggle('show',finalVisible);
}
function animateRollCinemaCount(start,end){
  clearInterval(rollCinemaCountTimer);
  const target=document.getElementById('roll-cinema-final');
  const duration=650;
  const startTime=performance.now();
  target.textContent=start;
  const tick=(now)=>{
    const pct=Math.min(1,(now-startTime)/duration);
    const value=Math.round(start+((end-start)*pct));
    target.textContent=value;
    if(pct<1){
      rollCinemaFrame=requestAnimationFrame(tick);
    }else{
      rollCinemaFrame=null;
    }
  };
  rollCinemaFrame=requestAnimationFrame(tick);
}
function renderRollCinemaModifiers(modTotal){
  const list=document.getElementById('roll-cinema-mod-list');
  if(!rollModifiers.length){
    list.innerHTML='<div class="inventory-empty">NO MODIFIERS LOCKED IN</div>';
  }else{
    list.innerHTML=rollModifiers.map(mod=>`
      <div class="roll-cinema-mod-line">
        <span>${escapeHtml(mod.label)}</span>
        <span>${mod.value>=0?'+':''}${mod.value}</span>
      </div>`).join('');
  }
  document.getElementById('roll-cinema-mod-total').textContent=`${modTotal>=0?'+':''}${modTotal}`;
}
function playDossierHoverSound(){
  if(!dossierHoverAudio){
    dossierHoverAudio=new Audio('audio/menu-hover.mp3');
    dossierHoverAudio.preload='auto';
  }
  dossierHoverAudio.currentTime=0;
  dossierHoverAudio.play().catch(()=>{});
}
document.addEventListener('mouseover',(event)=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button===dossierHoveredButton)return;
  if(button.contains(event.relatedTarget))return;
  dossierHoveredButton=button;
  playDossierHoverSound();
});
document.addEventListener('mouseout',(event)=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button===dossierHoveredButton && !button.contains(event.relatedTarget)){
    dossierHoveredButton=null;
  }
});
function buildBlankSheetData(name='--',aliases=[],career='UNKNOWN'){
  const stats={};
  DEFAULT_STATS.forEach(stat=>{stats[stat]=0;});
  return {
    name:[name,...aliases.filter(Boolean)],
    stats,
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
function openNewCharacterModal(){
  document.getElementById('new-name').value='';
  document.getElementById('new-street').value='';
  document.getElementById('new-career').value='';
  document.getElementById('new-char-modal').classList.add('show');
  document.getElementById('new-name').focus();
}
function closeNewCharacterModal(){
  document.getElementById('new-char-modal').classList.remove('show');
}
function submitNewCharacter(){
  const name=document.getElementById('new-name').value.trim();
  const street=document.getElementById('new-street').value.trim();
  const career=document.getElementById('new-career').value.trim();
  if(!name||!career){
    showError('NEW DOSSIER REQUIRES A NAME AND CAREER.');
    return;
  }
  document.getElementById('status-bar').style.display='none';
  renderSheet(buildBlankSheetData(name,street?[street]:[],career));
  closeNewCharacterModal();
  showActionLog(`NEW DOSSIER OPENED: ${name.toUpperCase()}`);
}
function renderBannerImage(){
  const banner=document.querySelector('.name-banner');
  if(!banner)return;
  if(bannerImageData){
    banner.style.backgroundImage=`url('${bannerImageData}')`;
    banner.classList.add('has-image');
  }else{
    banner.style.backgroundImage='none';
    banner.classList.remove('has-image');
  }
}
function sanitizeInventoryCategory(value){
  return String(value||'miscellaneous').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^\w.-]/g,'')||'miscellaneous';
}
function buildInventoryId(category){
  return `${category}${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`;
}
function parseEditorFields(text){
  const fields={};
  text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).forEach(line=>{
    const idx=line.indexOf('=');
    if(idx===-1)return;
    const key=line.slice(0,idx).trim();
    const value=line.slice(idx+1).trim();
    if(key)fields[key]=value;
  });
  return fields;
}
function serializeEditorFields(fields){
  return Object.entries(fields||{}).map(([key,value])=>`${key}=${value}`).join('\n');
}
function toggleInventoryCustomType(){
  const select=document.getElementById('inventory-item-type');
  const wrap=document.getElementById('inventory-custom-type-wrap');
  wrap.style.display=select.value==='custom'?'block':'none';
}
function openInventoryEditor(category='',idx=-1){
  inventoryEditState={category,idx};
  const isEditing=category!==''&&idx>-1&&inventory[category]?.[idx];
  const item=isEditing?inventory[category][idx]:{name:'',fields:{},info:[]};
  document.getElementById('inventory-editor-title').textContent=isEditing?'EDIT ITEM':'ADD ITEM';
  document.getElementById('inventory-item-name').value=item.name||'';
  const knownTypes=['weapon','cyberware','miscellaneous','buff'];
  const itemType=isEditing?category:'weapon';
  document.getElementById('inventory-item-type').value=knownTypes.includes(itemType)?itemType:'custom';
  document.getElementById('inventory-custom-type').value=knownTypes.includes(itemType)?'':itemType;
  document.getElementById('inventory-item-stats').value=serializeEditorFields(item.fields);
  document.getElementById('inventory-item-info').value=(item.info||[]).join('\n');
  toggleInventoryCustomType();
  document.getElementById('inventory-editor-modal').classList.add('show');
  document.getElementById('inventory-item-name').focus();
}
function closeInventoryEditor(){
  document.getElementById('inventory-editor-modal').classList.remove('show');
  inventoryEditState=null;
}
function saveInventoryItem(){
  const name=document.getElementById('inventory-item-name').value.trim();
  if(!name){showError('ITEM NAME IS REQUIRED.');return;}
  const selectValue=document.getElementById('inventory-item-type').value;
  const rawCategory=selectValue==='custom'?document.getElementById('inventory-custom-type').value:selectValue;
  const category=sanitizeInventoryCategory(rawCategory);
  if(!category){showError('SELECT OR ENTER AN ITEM TYPE.');return;}
  const fields=parseEditorFields(document.getElementById('inventory-item-stats').value);
  const info=document.getElementById('inventory-item-info').value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const existing=inventoryEditState&&inventoryEditState.idx>-1&&inventory[inventoryEditState.category]?.[inventoryEditState.idx];
  const item={id:existing?.id||buildInventoryId(category),name,fields,info};
  if(existing){
    inventory[inventoryEditState.category].splice(inventoryEditState.idx,1);
    if(!inventory[inventoryEditState.category].length)delete inventory[inventoryEditState.category];
  }
  if(!inventory[category])inventory[category]=[];
  inventory[category].push(item);
  closeInventoryEditor();
  renderInventory();
  showActionLog(`${existing?'UPDATED':'ADDED'} ${name.toUpperCase()} IN INVENTORY`);
}

/* ══════════════ PARSER ══════════════ */
function extractTopLevelBlocks(text){
  const blocks=[];
  let i=0;
  while(i<text.length){
    while(i<text.length&&(/[,\s]/.test(text[i])))i++;
    if(i>=text.length)break;
    const keyStart=i;
    while(i<text.length&&text[i]!==':')i++;
    if(i>=text.length)break;
    const key=text.slice(keyStart,i).trim().replace(/^"|"$/g,'');
    i++;
    while(i<text.length&&/\s/.test(text[i]))i++;
    if(text[i]!=='{'){
      while(i<text.length&&text[i]!==','&&text[i]!=='\n')i++;
      continue;
    }
    let depth=0,inQuote=false,bodyStart=i+1,end=i;
    for(;end<text.length;end++){
      const ch=text[end];
      if(ch==='"'&&text[end-1]!=='\\')inQuote=!inQuote;
      if(inQuote)continue;
      if(ch==='{')depth++;
      else if(ch==='}'){
        depth--;
        if(depth===0)break;
      }
    }
    blocks.push({key,body:text.slice(bodyStart,end).trim()});
    i=end+1;
  }
  return blocks;
}
function splitTopLevelTokens(text){
  const tokens=[];
  let cur='',depth=0,inQuote=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'&&text[i-1]!=='\\'){inQuote=!inQuote;cur+=ch;continue;}
    if(!inQuote){
      if(ch==='{')depth++;
      else if(ch==='}')depth--;
      if((ch===','||ch==='\n'||ch==='\r')&&depth===0){
        if(cur.trim())tokens.push(cur.trim());
        cur='';
        continue;
      }
    }
    cur+=ch;
  }
  if(cur.trim())tokens.push(cur.trim());
  return tokens;
}
function cleanValue(val){
  return val.trim().replace(/^"(.*)"$/,'$1');
}
function parseCharacter(raw){
  try{
    const data={name:[],stats:{},career:[],careerSkill:{},reputation:{},wallet:{},physicalBody:{},body:{},stunpoint:{},armor:{},damage:{},inventory:{}};
    const text=raw.split('\n').filter(l=>!l.trim().startsWith('#')).join('\n');
    extractTopLevelBlocks(text).forEach(({key,body})=>{
      key=key.trim().toLowerCase();
      if(key==='name')         data.name=parseNameBlock(body);
      else if(key==='stats')   data.stats=parseKVBlock(body);
      else if(key==='career')  data.career=parseNameBlock(body);
      else if(key==='careerskill') data.careerSkill=parseKVBlock(body);
      else if(key==='reputation')  data.reputation=parseKVBlock(body);
      else if(key==='wallet')      data.wallet=parseKVBlock(body);
      else if(key==='physicalbody') data.physicalBody=parseKVBlock(body);
      else if(key==='body')        data.body=parseKVBlock(body);
      else if(key==='stunpoint')   data.stunpoint=parseKVBlock(body);
      else if(key==='armor')       data.armor=parseKVBlock(body);
      else if(key==='damage')      data.damage=parseKVBlock(body);
      else data.inventory[key]=parseInventoryCategory(body,key);
    });
    renderSheet(data);
    showActionLog(`LOADED CHARACTER FILE: ${fileSafeNameFromData(data)}`);
  }catch(err){showError('PARSE ERROR: '+err.message);}
}
function parseItemFile(raw){
  try{
    const text=raw.split('\n').filter(l=>!l.trim().startsWith('#')).join('\n');
    const newInventory={};
    extractTopLevelBlocks(text).forEach(({key,body})=>{
      const category=key.trim().toLowerCase();
      if(CHARACTER_KEYS.has(category))return;
      newInventory[category]=parseInventoryCategory(body,category);
    });
    mergeInventory(newInventory);
    renderInventory();
    showError('ITEM FILE MERGED INTO INVENTORY.');
    showActionLog('ITEM FILE MERGED INTO INVENTORY');
  }catch(err){showError('ITEM PARSE ERROR: '+err.message);}
}
function parseNameBlock(body){
  const q=[...body.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
  return q.length?q:body.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
}
function parseKVBlock(body){
  const res={};
  body.split(/[,\n]+/).forEach(e=>{
    e=e.trim();if(!e)return;
    const m=e.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if(m)res[m[1].trim()]=m[2].trim().replace(/"/g,'');
  });
  return res;
}
function parseInventoryCategory(body,category){
  const blocks=extractTopLevelBlocks(body);
  if(blocks.length)return blocks.map((block,idx)=>parseInventoryItemBlock(block,category,idx));
  const names=parseNameBlock(body);
  return names.map((name,idx)=>({id:`${category}${idx+1}`,name,fields:{},info:[]}));
}
function parseInventoryItemBlock(block,category,idx){
  const fields={};
  let name=block.key,info=[];
  splitTopLevelTokens(block.body).forEach(token=>{
    const infoMatch=token.match(/^info\s*:\s*\{([\s\S]*)\}$/i);
    if(infoMatch){info=parseNameBlock(infoMatch[1]);return;}
    const m=token.match(/^"?([^"=]+)"?\s*=\s*(.+)$/);
    if(!m)return;
    const fieldKey=m[1].trim();
    const value=cleanValue(m[2]);
    if(fieldKey.toLowerCase()==='name')name=value||name;
    else fields[fieldKey]=value;
  });
  return {id:block.key||`${category}${idx+1}`,name:name||`${category} ${idx+1}`,fields,info};
}
function mergeInventory(newInventory){
  Object.entries(newInventory).forEach(([category,items])=>{
    if(!Array.isArray(items)||!items.length)return;
    if(!inventory[category])inventory[category]=[];
    inventory[category].push(...items);
  });
}
function orderedInventoryCategories(){
  const keys=Object.keys(inventory).filter(k=>Array.isArray(inventory[k])&&inventory[k].length);
  return [...INVENTORY_ORDER.filter(k=>keys.includes(k)),...keys.filter(k=>!INVENTORY_ORDER.includes(k)).sort()];
}
function humanizeLabel(value){
  return value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._]/g,' ').trim();
}
function escapeHtml(value){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function escapeJsString(value){
  return String(value).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
}
function normalizeLookup(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function fileSafeNameFromData(data){
  return (data?.name?.[0]||'UNKNOWN').toString().toUpperCase();
}
function parseRollableValue(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  const str=String(value).trim();
  if(/^[-+]?\d+$/.test(str))return parseInt(str,10);
  return null;
}

/* ══════════════ RENDER ══════════════ */
function renderSheet(data){
document.getElementById('status-bar').style.display='none';
  document.getElementById('char-name').textContent=data.name[0]||'Unknown';
  document.getElementById('char-aliases').innerHTML=data.name.slice(1).map(a=>`<span class="alias-tag">${a}</span>`).join('');
  document.getElementById('char-career').textContent=data.career[0]||'???';
  renderBannerImage();

  sheetStats={};
  for(const[k,v]of Object.entries(data.stats))sheetStats[k]=parseInt(v)||0;
  renderStats();

  sheetSkills=[];
  for(const[k,v]of Object.entries(data.careerSkill)){
    if(k.toLowerCase()==='point')continue;
    sheetSkills.push({name:k,value:parseInt(v)||0});
  }
  upgradePoints=parseInt(data.careerSkill.point)||0;
  renderSkills();

  repValue=parseInt(data.reputation.rep)||0;renderRep();
  walletValue=parseInt(data.wallet.eddies)||0;renderWallet();

  bodyLevelVal=Math.max(0,Math.min(4,parseInt(data.physicalBody.bodylevel) || 0));
  weightVal=parseInt(data.physicalBody.weight);
  if(Number.isNaN(weightVal))weightVal=parseInt(data.body.weight)||0;
  stunVal=parseInt(data.physicalBody.stunpoint);
  if(Number.isNaN(stunVal))stunVal=parseInt(data.stunpoint.stun)||0;
  renderPhysicalBody();

  inventory={};
  mergeInventory(data.inventory||{});
  renderInventory();
  rollModifiers=[];
  aimStackPoints=0;
  currentRoll={sides:null,qty:getRollQuantity(),rolls:[],result:0};
  renderRollLab();

  LIMBS.forEach(l=>{limbSP[l]=parseInt(data.armor[l])||0;limbDMG[l]=parseInt(data.damage[l])||0;});
  renderLimbs();

  document.getElementById('sheet').style.display='block';
}

/* ══════════════ STATS ══════════════ */
function renderStats(){
  const grid=document.getElementById('stats-grid');grid.innerHTML='';
  const debuffs=computeStatDebuffs();
  for(const[k,v]of Object.entries(sheetStats)){
    const col=STAT_COLORS[k]||'var(--accent)';
    const dbf=debuffs[k]||null;
    const effective=dbf?Math.max(0,Math.floor(v*dbf.mult)-dbf.flat):v;
    const card=document.createElement('div');
    card.className='stat-item'+(dbf?' debuffed':'');
    card.innerHTML=`
      <div class="stat-label">${k}</div>
      <div class="stat-value pickable" id="sv-${k}" style="color:${col};text-shadow:var(--stat-core-glow)" title="Add ${k} to roll" onclick="addRollModifier('STAT','${k}',${effective})">${effective}${dbf&&effective!==v?`<span style="font-size:.55em;opacity:.6"> (${v})</span>`:''}  </div>
      <div class="stat-debuff-tag" id="sdt-${k}">${dbf?dbf.label:''}</div>
      <div class="stat-controls">
        <button class="ctrl-btn" onclick="changeStat('${k}',1)">+</button>
        <button class="ctrl-btn minus" onclick="changeStat('${k}',-1)">−</button>
      </div>`;
    grid.appendChild(card);
  }
}
function changeStat(key,delta){
  sheetStats[key]=Math.max(0,(sheetStats[key]||0)+delta);
  const el=document.getElementById('sv-'+key);
  if(el){el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');}
  renderStats();
  showActionLog(`${key} ${delta>0?'INCREASED':'DECREASED'} TO ${sheetStats[key]}`);
}

/* ══════════════ WOUND DEBUFFS ══════════════ */
function getWoundLevel(dmg){
  if(dmg<=0)return null;
  if(dmg<=4)return'light';
  if(dmg<=6)return'serious';
  if(dmg<=8)return'critical';
  return'mortal';
}
function computeStatDebuffs(){
  // Find worst wound across all limbs
  let worst=null;
  const order=['light','serious','critical','mortal'];
  LIMBS.forEach(l=>{
    const lvl=getWoundLevel(limbDMG[l]);
    if(lvl&&(!worst||order.indexOf(lvl)>order.indexOf(worst)))worst=lvl;
  });
  const debuffs={};
  if(worst==='serious'){
    debuffs['REF']={flat:2,mult:1,label:'−2 (SERIOUS)'};
  }else if(worst==='critical'){
    ['REF','COOL','INT'].forEach(s=>{debuffs[s]={flat:0,mult:0.5,label:'÷2 (CRITICAL)'}; });
  }else if(worst==='mortal'){
    ['REF','COOL','INT'].forEach(s=>{debuffs[s]={flat:0,mult:1/3,label:'÷3 (MORTAL)'}; });
  }
  return debuffs;
}
function getEffectiveStatValue(key){
  const base=sheetStats[key]||0;
  const debuff=computeStatDebuffs()[key];
  return debuff ? Math.max(0,Math.floor(base*debuff.mult)-debuff.flat) : base;
}
function getSkillValueByNames(...names){
  const targets=names.map(normalizeLookup).filter(Boolean);
  let best=0;
  sheetSkills.forEach(skill=>{
    const lookup=normalizeLookup(skill.name);
    if(targets.some(target=>lookup===target||lookup.includes(target)||target.includes(lookup))){
      best=Math.max(best,skill.value||0);
    }
  });
  return best;
}
function getItemNumericField(item,...fieldNames){
  const targets=fieldNames.map(normalizeLookup).filter(Boolean);
  for(const [key,value] of Object.entries(item.fields||{})){
    const lookup=normalizeLookup(key);
    if(targets.some(target=>lookup===target||lookup.includes(target)||target.includes(lookup))){
      const parsed=parseRollableValue(value);
      if(parsed!==null)return parsed;
    }
  }
  return null;
}
function getAimHitAccuracy(item){
  return getItemNumericField(item,'Accuracy','Weapon Accuracy','WA');
}
function setPresetRoll(label,modifiers,sides=10){
  const rollQty=document.getElementById('roll-qty');
  if(rollQty)rollQty.value=1;
  rollModifiers=modifiers.filter(mod=>parseRollableValue(mod.value)!==null).map(mod=>({source:mod.source||'PRESET',label:mod.label,value:parseRollableValue(mod.value)}));
  renderRollLab();
  showActionLog(`${label} PRESET LOCKED`);
  rollDie(sides);
}

/* ══════════════ SKILLS ══════════════ */
function renderAimAction(){
  const pips=document.getElementById('aim-stack-pips');
  const followup=document.getElementById('aim-followup-row');
  const keepBtn=document.getElementById('aim-keep-btn');
  if(!pips||!followup||!keepBtn)return;
  pips.innerHTML=Array.from({length:3},(_,idx)=>`<span class="aim-stack-pip${idx<aimStackPoints?' active':''}"></span>`).join('');
  keepBtn.textContent=aimStackPoints>0?'Keep Aim':'Aim';
  keepBtn.classList.toggle('disabled',aimStackPoints>=3);
}

function resetAimAction(){
  aimStackPoints=0;
  renderAimAction();
}

function startAimAction(){
  if(aimStackPoints>=3)return;
  aimStackPoints=1;
  renderAimAction();
  showActionLog('AIM ACTION STARTED: +1 AIM');
}

function keepAimAction(){
  if(aimStackPoints<=0){
    startAimAction();
    return;
  }
  if(aimStackPoints>=3)return;
  aimStackPoints+=1;
  renderAimAction();
  showActionLog(`AIM STACK INCREASED TO +${aimStackPoints}`);
}

function attackAimAction(){
  if(aimStackPoints<=0)return;
  openAimHitModal();
}

function renderSkills(){
  const el=document.getElementById('sp-display');
  el.textContent=upgradePoints;
  el.className='sp-value'+(upgradePoints<0?' negative':'');
  const list=document.getElementById('skill-list');list.innerHTML='';
  const maxVal=Math.max(...sheetSkills.map(s=>s.value),10);
  sheetSkills.forEach((skill,idx)=>{
    const pct=Math.min(100,(skill.value/maxVal)*100);
    const row=document.createElement('div');row.className='skill-row';
    row.innerHTML=`
      <div class="skill-main" title="Add ${skill.name} to roll" onclick="addRollModifier('SKILL','${skill.name.replace(/'/g,"\\'")}',${skill.value})">
        <span class="skill-name">${skill.name}</span>
        <div class="skill-bar-wrap"><div class="skill-bar" style="width:${pct}%"></div></div>
        <span class="skill-val pickable">${skill.value}</span>
      </div>
      <div class="skill-ctrl-wrap">
        <button class="skill-ctrl-btn" onclick="event.stopPropagation();changeSkill(${idx},1)">+</button>
        <button class="skill-ctrl-btn minus" onclick="event.stopPropagation();changeSkill(${idx},-1)">-</button>
      </div>`;
    list.appendChild(row);
  });
  if(!sheetSkills.length)list.innerHTML='';
}
function changeUpgradePoints(delta){
  upgradePoints+=delta;
  renderSkills();
  showActionLog(`SKILL POINTS ${delta>0?'INCREASED':'DECREASED'} TO ${upgradePoints}`);
}
function changeSkill(idx,delta){
  const skill=sheetSkills[idx];
  const newVal=skill.value+delta;
  if(newVal<0)return;
  if(newVal===0&&delta<0){
    showModal(
      'DELETE SKILL?',
      `Remove "${skill.name}" from your skill list?`,
      ()=>{sheetSkills.splice(idx,1);upgradePoints-=delta;renderSkills();closeModal();}
    );
    return;
  }
  upgradePoints-=delta;
  skill.value=newVal;
  renderSkills();
  showActionLog(`${skill.name.toUpperCase()} ${delta>0?'INCREASED':'DECREASED'} TO ${skill.value}`);
}
function addCustomSkill(){
  const input=document.getElementById('new-skill-name');
  const name=input.value.trim();if(!name)return;
  sheetSkills.push({name,value:1});
  upgradePoints-=1;
  input.value='';
  renderSkills();
  showActionLog(`ADDED CUSTOM SKILL ${name.toUpperCase()}`);
}

/* ══════════════ REPUTATION ══════════════ */
function renderRep(){
  document.getElementById('rep-number').textContent=repValue;
  document.getElementById('rep-pips').innerHTML=Array.from({length:Math.min(repValue,40)},()=>'<div class="rep-pip"></div>').join('');
}
function changeRep(delta){repValue=Math.max(0,repValue+delta);renderRep();showActionLog(`REPUTATION ${delta>0?'INCREASED':'DECREASED'} TO ${repValue}`);}
function renderWallet(){
  document.getElementById('wallet-val').value=walletValue;
}
function changeWallet(delta){
  walletValue=Math.max(0,walletValue+delta);
  renderWallet();
  showActionLog(`WALLET ${delta>0?'INCREASED':'DECREASED'} TO ${walletValue} EB`);
}
function setWallet(value){
  walletValue=Math.max(0,parseInt(value)||0);
  renderWallet();
  showActionLog(`WALLET SET TO ${walletValue} EB`);
}

/* ══════════════ PHYSICAL BODY ══════════════ */
function renderPhysicalBody(){
  document.getElementById('body-level-val').textContent=bodyLevelVal;
  document.getElementById('body-val').textContent=weightVal;
  document.getElementById('stun-val').textContent=stunVal;
}
function changeBS(which,delta){
  if(which==='bodylevel')bodyLevelVal=Math.max(0,Math.min(4,bodyLevelVal+delta));
  else if(which==='weight')weightVal=Math.max(0,weightVal+delta);
  else stunVal=Math.max(0,stunVal+delta);
  renderPhysicalBody();
  const label=which==='bodylevel'?'BODY LEVEL':which==='weight'?'WEIGHT':'STUN';
  const value=which==='bodylevel'?bodyLevelVal:which==='weight'?weightVal:stunVal;
  showActionLog(`${label} ${delta>0?'INCREASED':'DECREASED'} TO ${value}`);
}

function renderInventory(){
  const div=document.getElementById('inventory-list');
  const categories=orderedInventoryCategories();
  if(!categories.length){div.innerHTML='<div class="inventory-empty">[ NO INVENTORY LOADED ]</div>';return;}
  div.innerHTML=categories.map(category=>{
    const items=inventory[category]||[];
    return `
      <div class="inventory-category">
        <div class="inventory-category-title">
          <span>${escapeHtml(humanizeLabel(category))}</span>
          <span class="inventory-category-count">${items.length} ITEM${items.length===1?'':'S'}</span>
        </div>
        ${items.map((item,idx)=>{
          const itemRollName=escapeJsString(item.name||category);
          const categoryKey=escapeJsString(category);
          const statHtml=Object.entries(item.fields||{}).map(([label,value])=>{
            const rollValue=parseRollableValue(value);
            return `
            <div class="inventory-stat${rollValue!==null?' pickable':''}"${rollValue!==null?` title="Add ${escapeHtml(label)} to roll" onclick="addRollModifier('ITEM','${itemRollName}: ${escapeJsString(label)}',${rollValue})"`:''}>
              <span class="inventory-stat-label">${escapeHtml(humanizeLabel(label))}</span>
              <span class="inventory-stat-value">${escapeHtml(value)}</span>
            </div>`;
          }).join('');
          const infoHtml=(item.info||[]).map(line=>`<div class="inventory-info-line">${escapeHtml(line)}</div>`).join('');
          return `
            <details class="inventory-item">
              <summary class="inventory-summary">
                <span class="inventory-badge"></span>
                <span class="inventory-name">${escapeHtml(item.name||humanizeLabel(item.id||category))}</span>
                <span class="inventory-tag">${escapeHtml(humanizeLabel(category))}</span>
                <button class="inventory-edit" type="button" onclick="event.preventDefault();event.stopPropagation();openInventoryEditor('${categoryKey}',${idx})">EDIT</button>
                <button class="inventory-delete" type="button" onclick="event.preventDefault();event.stopPropagation();removeInventoryItem('${categoryKey}',${idx})">DEL</button>
              </summary>
              <div class="inventory-detail">
                ${statHtml?`<div class="inventory-stats">${statHtml}</div>`:''}
                ${infoHtml?`<div class="inventory-info"><div class="inventory-info-title">Description</div>${infoHtml}</div>`:''}
              </div>
            </details>`;
        }).join('')}
      </div>`;
  }).join('');
}
function removeInventoryItem(category,idx){
  const item=inventory[category]?.[idx];
  if(!item)return;
  showModal('REMOVE ITEM?',`Delete "${item.name||humanizeLabel(category)}" from inventory?`,()=>{
    const removedName=item.name||humanizeLabel(category);
    inventory[category].splice(idx,1);
    if(!inventory[category].length)delete inventory[category];
    renderInventory();
    showActionLog(`REMOVED ${removedName.toUpperCase()} FROM INVENTORY`);
    closeModal();
  });
}

function getModifierTotal(){
  return rollModifiers.reduce((sum,mod)=>sum+mod.value,0);
}
function getRollQuantity(){
  const input=document.getElementById('roll-qty');
  if(!input)return 1;
  return Math.max(1,Math.min(20,parseInt(input.value,10)||1));
}
function normalizeRollQty(){
  const input=document.getElementById('roll-qty');
  if(!input)return;
  input.value=getRollQuantity();
}
function changeRollQty(delta){
  const input=document.getElementById('roll-qty');
  if(!input)return;
  input.value=Math.max(1,Math.min(20,getRollQuantity()+delta));
  showActionLog(`DICE COUNT SET TO ${input.value}`);
}
function renderRollLab(){
  const modList=document.getElementById('modifier-list');
  const modTotal=getModifierTotal();
  const qty=currentRoll.qty||getRollQuantity();
  const hasRoll=!!currentRoll.sides;
  document.getElementById('modifier-total').textContent=modTotal;
  document.getElementById('last-die-label').textContent=hasRoll?`${qty}D${currentRoll.sides}`:'NONE';
  const total=(currentRoll.result||0)+modTotal;
  const equation=hasRoll
    ? `${qty}D${currentRoll.sides} locked ${currentRoll.result}. Final total ${total}.`
    : `No die rolled yet. Current modifiers total ${modTotal>=0?'+':''}${modTotal}.`;
  const breakdown=hasRoll
    ? `Dice pool: [${currentRoll.rolls.join(', ')}]`
    : `Set the dice count, then click any die button to open the roll cinema.`;
  document.getElementById('roll-last-summary').textContent=equation;
  document.getElementById('roll-last-breakdown').textContent=breakdown;
  document.getElementById('roll-last-total').textContent=total;
  renderAimAction();
  if(!rollModifiers.length){
    modList.innerHTML='<div class="inventory-empty">NO MODIFIERS LOCKED IN</div>';
    return;
  }
  modList.innerHTML=rollModifiers.map((mod,idx)=>`
    <div class="modifier-item">
      <span class="modifier-source">${escapeHtml(mod.source)}</span>
      <span class="modifier-name">${escapeHtml(mod.label)}</span>
      <span class="modifier-value">${mod.value>=0?'+':''}${mod.value}</span>
      <button class="modifier-delete" type="button" onclick="removeRollModifier(${idx})">DELETE</button>
    </div>`).join('');
}
function addRollModifier(source,label,value){
  const parsed=parseRollableValue(value);
  if(parsed===null)return;
  rollModifiers.push({source,label,value:parsed});
  renderRollLab();
  showActionLog(`ADDED ${label.toUpperCase()} TO ROLL`);
}
function removeRollModifier(idx){
  const mod=rollModifiers[idx];
  if(!mod)return;
  rollModifiers.splice(idx,1);
  renderRollLab();
  showActionLog(`REMOVED ${mod.label.toUpperCase()} FROM ROLL`);
}
function clearRollModifiers(){
  rollModifiers=[];
  renderRollLab();
  showActionLog('CLEARED ROLL MODIFIERS');
}
function addCustomRollModifier(){
  const labelInput=document.getElementById('custom-mod-label');
  const valueInput=document.getElementById('custom-mod-value');
  const label=labelInput.value.trim()||'Custom';
  const value=parseRollableValue(valueInput.value);
  if(value===null){showError('ENTER A NUMBER FOR THE CUSTOM MODIFIER.');return;}
  rollModifiers.push({source:'CUSTOM',label,value});
  labelInput.value='';
  valueInput.value='';
  renderRollLab();
  showActionLog(`ADDED CUSTOM MODIFIER ${label.toUpperCase()}`);
}
function openRollCinemaAnimation(sides,qty,rolls){
  clearRollCinemaTimers();
  const rawTotal=rolls.reduce((sum,val)=>sum+val,0);
  const modTotal=getModifierTotal();
  const finalTotal=rawTotal+modTotal;
  const modal=document.getElementById('roll-cinema-modal');
  const stage=document.getElementById('roll-cinema-stage');
  const die=document.getElementById('roll-cinema-die');
  const dieValue=document.getElementById('roll-cinema-die-value');
  const impact=document.getElementById('roll-cinema-impact');
  document.getElementById('roll-cinema-kicker').textContent=`${qty}D${sides} EXECUTION`;
  document.getElementById('roll-cinema-pool').textContent=`Dice pool: [${rolls.join(', ')}]`;
  document.getElementById('roll-cinema-raw').textContent='0';
  document.getElementById('roll-cinema-final').textContent='0';
  renderRollCinemaModifiers(modTotal);
  setRollCinemaCards(false,false,false);
  document.getElementById('roll-cinema-raw-card').classList.remove('emphasis');
  document.getElementById('roll-cinema-final-card').classList.remove('emphasis');
  die.classList.remove('locked');
  modal.classList.add('show');

  const stageRect=stage.getBoundingClientRect();
  const dieSize=76;
  const bounds={w:Math.max(120,stageRect.width-dieSize),h:Math.max(120,stageRect.height-dieSize)};
  let x=12;
  let y=12;
  let vx=Math.max(7,Math.min(11,bounds.w/34));
  let vy=2.4;
  let rotation=-18;
  let vr=7.5;
  let bouncedFloor=false;
  const gravity=.46;
  const startTime=performance.now();

  rollCinemaNumberTimer=setInterval(()=>{
    dieValue.textContent=Math.max(1,Math.ceil(Math.random()*Math.max(rawTotal,sides)));
  },58);

  const impactAt=(ix,iy)=>{
    impact.classList.remove('show');
    impact.style.left=`${ix-16}px`;
    impact.style.top=`${iy-16}px`;
    void impact.offsetWidth;
    impact.classList.add('show');
  };

  const step=(now)=>{
    vy+=gravity;
    x+=vx;
    y+=vy;
    rotation+=vr;

    if(x<=0||x>=bounds.w){
      x=Math.max(0,Math.min(bounds.w,x));
      vx*=-0.92;
      vr*=-0.88;
      impactAt(x+dieSize/2,y+dieSize/2);
    }
    if(y<=0){
      y=0;
      vy*=-0.82;
      impactAt(x+dieSize/2,y+dieSize/2);
    }
    if(y>=bounds.h){
      y=bounds.h;
      if(Math.abs(vy)>1.2)impactAt(x+dieSize/2,y+dieSize/2);
      vy*=-0.76;
      vx*=0.96;
      vr*=0.9;
      bouncedFloor=true;
    }

    die.style.transform=`translate(${x}px,${y}px) rotate(${rotation}deg)`;

    const elapsed=now-startTime;
    const speed=Math.abs(vx)+Math.abs(vy)+Math.abs(vr*.14);
    if(elapsed>1150&&bouncedFloor&&speed<2.4){
      clearInterval(rollCinemaNumberTimer);
      rollCinemaNumberTimer=null;
      die.classList.add('locked');
      die.style.transform=`translate(${x}px,${bounds.h}px) rotate(0deg)`;
      dieValue.textContent=rawTotal;
      document.getElementById('roll-cinema-raw').textContent=rawTotal;
      setRollCinemaCards(true,false,false);
      document.getElementById('roll-cinema-raw-card').classList.add('emphasis');
      rollCinemaRevealTimer=setTimeout(()=>{
        document.getElementById('roll-cinema-raw-card').classList.remove('emphasis');
        setRollCinemaCards(true,true,true);
        document.getElementById('roll-cinema-final-card').classList.add('emphasis');
        animateRollCinemaCount(rawTotal,finalTotal);
      },420);
      return;
    }

    rollCinemaFrame=requestAnimationFrame(step);
  };
  rollCinemaFrame=requestAnimationFrame(step);
}
function rollFacedown(){
  setPresetRoll('FACEDOWN',[
    {source:'PRESET',label:'COOL',value:getEffectiveStatValue('COOL')},
    {source:'PRESET',label:'Reputation',value:repValue}
  ],10);
}
function rollInitiationCheck(){
  setPresetRoll('INITAITION CHECK',[
    {source:'PRESET',label:'REF',value:getEffectiveStatValue('REF')}
  ],10);
}
function rollAmbush(){
  setPresetRoll('AMBUSH',[
    {source:'PRESET',label:'Stealth',value:getSkillValueByNames('Stealth')},
    {source:'PRESET',label:'INT',value:getEffectiveStatValue('INT')}
  ],10);
}
function rollAmbushCounter(){
  setPresetRoll('AMBUSH COUNTER',[
    {source:'PRESET',label:'Awareness',value:getSkillValueByNames('Awareness','AwarenessNotice')}
  ],10);
}
function rollSuppressiveFireSave(){
  setPresetRoll('SUPRESSIVE FIRE SAVE',[
    {source:'PRESET',label:'Athletics',value:getSkillValueByNames('Athletics','Athletic')},
    {source:'PRESET',label:'REF',value:getEffectiveStatValue('REF')}
  ],10);
}
function openAimHitModal(){
  const weapons=(inventory.weapon||[]).slice();
  aimHitWeapons=weapons;
  aimHitSelectedWeapon=null;
  const select=document.getElementById('aim-weapon-select');
  const note=document.getElementById('aim-weapon-note');
  if(!weapons.length){
    select.innerHTML='';
    if(note)note.textContent='No weapons in inventory yet.';
  }else{
    select.innerHTML=weapons.map((weapon,idx)=>`<option value="${idx}">${escapeHtml(weapon.name||`Weapon ${idx+1}`)}</option>`).join('');
    if(note)note.textContent='Weapon list preview only for now.';
  }
  document.getElementById('aim-hit-modal').classList.add('show');
  if(weapons.length)select.focus();
}
function closeAimHitModal(){
  document.getElementById('aim-hit-modal').classList.remove('show');
}
function closeAimBonusModal(){
  document.getElementById('aim-bonus-modal').classList.remove('show');
  aimHitSelectedWeapon=null;
}
function confirmAimHitWeapon(){
  const weapon=aimHitWeapons[parseInt(document.getElementById('aim-weapon-select').value,10)];
  if(!weapon){showError('SELECT A WEAPON FIRST.');return;}
  const accuracy=getAimHitAccuracy(weapon);
  if(accuracy===null){
    showError('SELECTED WEAPON HAS NO ACCURACY, WEAPON ACCURACY, OR WA VALUE.');
    return;
  }
  const aimUsed=aimStackPoints;
  closeAimHitModal();
  rollModifiers.push({source:'PRESET',label:`${weapon.name||'Weapon'} Accuracy`,value:accuracy});
  if(aimUsed>0){
    rollModifiers.push({source:'PRESET',label:'Aim',value:aimUsed});
  }
  renderRollLab();
  resetAimAction();
  rollDie(10);
  showActionLog(`AIM ATTACK ROLLED ${weapon.name?.toUpperCase()||'WEAPON'} ACC ${accuracy>=0?'+':''}${accuracy}${aimUsed>0?` AIM +${aimUsed}`:''}`);
}
function submitAimHitBonus(aim){
  const weapon=aimHitSelectedWeapon;
  if(!weapon){showError('SELECT A WEAPON FIRST.');return;}
  const accuracy=getAimHitAccuracy(weapon);
  closeAimBonusModal();
  setPresetRoll('AIM HIT',[
    {source:'PRESET',label:`${weapon.name||'Weapon'} Accuracy`,value:accuracy},
    {source:'PRESET',label:'Aim',value:aim}
  ],10);
}
function rollDie(sides){
  normalizeRollQty();
  const qty=getRollQuantity();
  const rolls=Array.from({length:qty},()=>Math.floor(Math.random()*sides)+1);
  currentRoll={sides,qty,rolls,result:rolls.reduce((sum,val)=>sum+val,0)};
  renderRollLab();
  openRollCinemaAnimation(sides,qty,rolls);
  showActionLog(`ROLLED ${qty}D${sides} FOR ${currentRoll.result}`);
}

/* ══════════════ CYBERWARE ══════════════ */
function renderCyberware(){
  renderInventory();return;
  if(!cyberware.length){div.innerHTML='<div class="cyber-empty">[ NO CYBERWARE INSTALLED ]</div>';return;}
  div.innerHTML=cyberware.map((c,i)=>`
    <div class="cyber-item">
      ${c}
      <button class="cyber-item-del" title="Remove" onclick="removeCyber(${i})">✕</button>
    </div>`).join('');
}
function addCyberware(){
  showError('USE AN ITEM .TXT FILE TO ADD INVENTORY.');return;
  const name=input.value.trim();if(!name)return;
  cyberware.push(name);input.value='';renderCyberware();
}
function removeCyber(idx){
  void idx;return;
}

/* ══════════════ LIMBS ══════════════ */
function renderLimbs(){
  const grid=document.getElementById('limb-grid');grid.innerHTML='';
  LIMBS.forEach(limb=>{
    const sp=limbSP[limb]||0,dmg=limbDMG[limb]||0;
    const lvl=getWoundLevel(dmg);
    const cls=lvl?`wounded-${lvl}`:'';
    const card=document.createElement('div');
    card.className=`limb-card ${cls}`;card.id=`limb-${limb.replace('.','_')}`;
    card.innerHTML=`
      <div class="limb-name">${limb}</div>
      <div class="limb-field-label">SP</div>
      <input class="limb-input" type="number" min="0" value="${sp}" id="sp-${limb.replace('.','_')}" onchange="setSP('${limb}',this.value)">
      <div class="limb-ctrl">
        <button class="limb-btn" onclick="changeLimb('sp','${limb}',1)">+</button>
        <button class="limb-btn minus" onclick="changeLimb('sp','${limb}',-1)">−</button>
      </div>
      <div class="limb-field-label">DMG</div>
      <input class="limb-input dmg-input" type="number" min="0" value="${dmg}" id="dmg-${limb.replace('.','_')}" onchange="setDMG('${limb}',this.value)">
      <div class="limb-ctrl">
        <button class="limb-btn" onclick="changeLimb('dmg','${limb}',1)">+</button>
        <button class="limb-btn minus" onclick="changeLimb('dmg','${limb}',-1)">−</button>
      </div>`;
    grid.appendChild(card);
  });
  renderWounds();
}
function changeLimb(type,limb,delta){
  const key=limb.replace('.','_');
  if(type==='sp'){
    limbSP[limb]=Math.max(0,(limbSP[limb]||0)+delta);
    document.getElementById('sp-'+key).value=limbSP[limb];
  }else{
    limbDMG[limb]=Math.max(0,(limbDMG[limb]||0)+delta);
    document.getElementById('dmg-'+key).value=limbDMG[limb];
  }
  refreshLimbCard(limb);renderWounds();renderStats();
}
function setSP(limb,val){limbSP[limb]=Math.max(0,parseInt(val)||0);refreshLimbCard(limb);renderWounds();renderStats();}
function setDMG(limb,val){limbDMG[limb]=Math.max(0,parseInt(val)||0);refreshLimbCard(limb);renderWounds();renderStats();}
function refreshLimbCard(limb){
  const card=document.getElementById('limb-'+limb.replace('.','_'));
  if(!card)return;
  card.className='limb-card';
  const lvl=getWoundLevel(limbDMG[limb]);
  if(lvl)card.classList.add('wounded-'+lvl);
}

function renderWounds(){
  const panel=document.getElementById('wound-panel');
  const rows=document.getElementById('wound-rows');
  rows.innerHTML='';
  let hasWounds=false;
  const woundInfo={
    light:{label:'LIGHT',debuff:'No stat debuff'},
    serious:{label:'SERIOUS',debuff:'REF −2'},
    critical:{label:'CRITICAL',debuff:'REF / COOL / INT ÷ 2'},
    mortal:{label:'MORTAL',debuff:'REF / COOL / INT ÷ 3'}
  };
  LIMBS.forEach(limb=>{
    const dmg=limbDMG[limb]||0;if(!dmg)return;
    const lvl=getWoundLevel(dmg);if(!lvl)return;
    hasWounds=true;
    const info=woundInfo[lvl];
    rows.innerHTML+=`
      <div class="wound-row ${lvl}">
        <span class="wound-limb">${limb}</span>
        <span class="wound-badge ${lvl}">${info.label}</span>
        <span class="wound-debuff">${info.debuff}</span>
      </div>`;
  });
  panel.classList.toggle('has-wounds',hasWounds);
}

/* ══════════════ DOWNLOAD ══════════════ */
function serializeInventoryBlock(){
  const categories=orderedInventoryCategories();
  if(!categories.length)return '';
  return categories.map(category=>{
    const items=(inventory[category]||[]).map((item,idx)=>{
      const key=item.id||`${category}${idx+1}`;
      const fieldLines=[`name="${(item.name||'').replace(/"/g,'\\"')}"`];
      Object.entries(item.fields||{}).forEach(([label,value])=>{
        fieldLines.push(`${label}="${String(value).replace(/"/g,'\\"')}"`);
      });
      if(item.info?.length){
        fieldLines.push(`info:{ ${item.info.map(line=>`"${String(line).replace(/"/g,'\\"')}"`).join(', ')} }`);
      }
      return `  ${key}:{ ${fieldLines.join(', ')} }`;
    }).join(',\n');
    return `${category}: {\n${items}\n}`;
  }).join('\n\n')+'\n\n';
}
function downloadTxt(){
  const names=[];
const n=document.getElementById('char-name').textContent;if(n&&n!=='--')names.push(n);
  document.querySelectorAll('.alias-tag').forEach(el=>names.push(el.textContent));
  const statLines=Object.entries(sheetStats).map(([k,v])=>`  ${k}=${v}`).join(', ');
  const career=document.getElementById('char-career').textContent;
  const skillLines=sheetSkills.map(s=>`  ${s.name}=${s.value}`).join('\n');
  const armorLines=LIMBS.map(l=>`  ${l}=${limbSP[l]||0}`).join(', ');
  const dmgLines=LIMBS.map(l=>`  ${l}=${limbDMG[l]||0}`).join(', ');
  const inventoryText=serializeInventoryBlock();
  const txt=
`name: {
  ${names.map(n=>`"${n}"`).join(', ')}
}

stats: {
  ${statLines}
}

career: {
  "${career}"
}

careerSkill: {
  point=${upgradePoints}
${skillLines}
}

reputation: {
  rep=${repValue}
}

wallet: {
  eddies=${walletValue}
}

physicalBody: {
  bodylevel=${bodyLevelVal}
  weight=${weightVal}
  stunpoint=${stunVal}
}

armor: {
${armorLines}
}

damage: {
${dmgLines}
}
${inventoryText}
`;
  const blob=new Blob([txt],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`${(document.getElementById('char-name').textContent||'character').replace(/\s+/g,'_')}.txt`;
  a.click();URL.revokeObjectURL(a.href);
}
function downloadInventoryTxt(){
  const inventoryText=serializeInventoryBlock();
  if(!inventoryText.trim()){showError('NO INVENTORY TO DOWNLOAD.');return;}
  const blob=new Blob([inventoryText],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`${(document.getElementById('char-name').textContent||'inventory').replace(/\s+/g,'_')}_items.txt`;
  a.click();URL.revokeObjectURL(a.href);
  showActionLog('DOWNLOADED ITEM FILE');
}

/* ══════════════ MODAL ══════════════ */
let _modalCb=null;
function showModal(title,msg,cb){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-msg').textContent=msg;
  _modalCb=cb;
  document.getElementById('modal').classList.add('show');
  document.getElementById('modal-confirm').onclick=()=>{if(_modalCb)_modalCb();};
}
function closeModal(){document.getElementById('modal').classList.remove('show');_modalCb=null;}
document.getElementById('modal').addEventListener('click',e=>{if(e.target===document.getElementById('modal'))closeModal();});

/* ══════════════ RESET ══════════════ */
function resetSheet(){
  showModal('CLEAR DOSSIER?','Discard current character and reset the dossier to blank values?',()=>{
    document.getElementById('file-input2').value='';
    document.getElementById('item-file-input').value='';
    document.getElementById('banner-image-input').value='';
    document.getElementById('status-bar').style.display='none';
    closeInventoryEditor();
    closeAimHitModal();
    closeAimBonusModal();
    clearInterval(_rollTimer);
    renderSheet(buildBlankSheetData());
    closeModal();
    showActionLog('CLEARED DOSSIER');
  });
}

function bootDossierFromLauncher(){
  const pendingRaw=sessionStorage.getItem(BOOT_RAW_KEY);
  if(pendingRaw){
    sessionStorage.removeItem(BOOT_RAW_KEY);
    parseCharacter(pendingRaw);
    return;
  }

  const pendingData=sessionStorage.getItem(BOOT_DATA_KEY);
  if(pendingData){
    sessionStorage.removeItem(BOOT_DATA_KEY);
    try{
      const data=JSON.parse(pendingData);
      renderSheet(data);
      showActionLog(`NEW DOSSIER OPENED: ${fileSafeNameFromData(data)}`);
      return;
    }catch(err){
      showError('LAUNCHER DATA ERROR: '+err.message);
    }
  }

  renderSheet(buildBlankSheetData());
}

bootDossierFromLauncher();
