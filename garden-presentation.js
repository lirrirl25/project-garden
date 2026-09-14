/* Short-lived visual feedback is separate from the durable growth ledger. */
(function(root) {
  const key='project-garden:visual-feedback:v1', duration=3200;
  const alphaBounds=new Map();
  let expiryTimer;
  function pending() {
    try { return JSON.parse(localStorage.getItem(key) || '[]').filter(e=>e && typeof e.id==='string' && Number.isFinite(e.at) && Date.now()>=e.at && Date.now()-e.at<duration); }
    catch { return []; }
  }
  function queue(id,beforeArt,changed) {
    try { localStorage.setItem(key,JSON.stringify([...pending().filter(e=>e.id!==id),{id,beforeArt,changed,at:Date.now()}].slice(-8))); } catch { /* Saving progress does not depend on effects. */ }
  }
  function apply(container,compactId,onExpiry) {
    clearTimeout(expiryTimer);
    const entries=pending();
    for(const entry of entries) {
      const targets=[...container.querySelectorAll('.front-plant, .shelf-plant')].filter(el=>el.dataset.projectId===entry.id);
      if(compactId===entry.id) targets.push(...container.querySelectorAll('.floating-pet__plant'));
      // Animate the actual plant once, not every duplicate sidebar portrait.
      for(const target of targets.slice(0,1)) {
        const plant=target.querySelector('.modular-plant');if(!plant)continue;
        plant.classList.add(entry.changed?'is-growing':'is-progressing');
        plant.style.setProperty('--growth-delay',`${-(Date.now()-entry.at)}ms`);
        if(entry.changed && typeof entry.beforeArt==='string') {
          const template=document.createElement('template');template.innerHTML=entry.beforeArt;
          const previous=template.content.querySelector('.modular-canopy');
          if(previous){previous.className='growth-previous';previous.setAttribute('aria-hidden','true');plant.append(previous);}
        }
        const sparks=document.createElement('span');sparks.className='growth-sparkles';sparks.setAttribute('aria-hidden','true');
        sparks.innerHTML='<i></i><i></i><i></i><i></i><i></i>';plant.append(sparks);
      }
    }
    if(entries.length) expiryTimer=setTimeout(onExpiry,Math.max(...entries.map(e=>e.at+duration-Date.now()))+30);
  }
  async function imageBounds(img) {
    const src=img.currentSrc || img.src;
    if(!alphaBounds.has(src)) alphaBounds.set(src,(async()=>{
      await img.decode();
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,128,128);
      const data=ctx.getImageData(0,0,128,128).data;let top=128,bottom=-1;
      for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*4+3]>24){top=Math.min(top,y);bottom=Math.max(bottom,y);}
      return bottom<0?null:{top:top/128,bottom:(bottom+1)/128};
    })());
    return alphaBounds.get(src);
  }
  async function centerJournal(container) {
    await Promise.all([...container.querySelectorAll('.growth-timeline__art .modular-plant')].map(async plant=>{
      try {
        const images=[...plant.querySelectorAll('img')];
        const bounds=await Promise.all(images.map(imageBounds));if(!plant.isConnected)return;
        plant.style.translate='none';
        let top=Infinity,bottom=-Infinity;
        images.forEach((img,i)=>{if(!bounds[i])return;const rect=img.getBoundingClientRect();top=Math.min(top,rect.top+rect.height*bounds[i].top);bottom=Math.max(bottom,rect.top+rect.height*bounds[i].bottom);});
        const frame=plant.closest('.growth-timeline__art').getBoundingClientRect();
        if(Number.isFinite(top))plant.style.translate=`0px ${frame.top+frame.height/2-(top+bottom)/2}px`;
      } catch { /* A missing image cannot prevent opening the journal. */ }
    }));
  }
  root.GardenPresentation={pending,queue,apply,centerJournal};
})(window);
