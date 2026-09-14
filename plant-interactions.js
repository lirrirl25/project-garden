/* Window dragging stays in app.js. These gestures only exchange garden slots. */
(() => {
  let drag=null, suppressClickUntil=0;
  const plants=()=>[...app.querySelectorAll('.front-plant')];
  document.addEventListener('pointermove',e=>{
    const hit=!isCompact && !app.inert && !drag?PlantHitTest.pick(app,e.clientX,e.clientY):null;
    plants().forEach(el=>el.classList.toggle('is-plant-hovered',el===hit));
  });
  document.addEventListener('pointerout',e=>{if(!e.relatedTarget)plants().forEach(el=>el.classList.remove('is-plant-hovered'));});
  function clearDrag() {
    if(drag?.moved) suppressClickUntil=Date.now()+300;
    plants().forEach(el=>{el.classList.remove('is-slot-dragging','is-slot-target');el.style.removeProperty('translate');});
    drag=null;
  }
  app.addEventListener('dragstart',e=>{if(e.target.closest('.front-plant'))e.preventDefault();});
  app.addEventListener('pointerdown',e=>{
    const el=PlantHitTest.pick(app,e.clientX,e.clientY);
    if(isCompact || !el || e.button!==0)return;
    drag={el,id:el.dataset.projectId,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false,target:null};
    el.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove',e=>{
    if(!drag || e.pointerId!==drag.pointer)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.moved && Math.hypot(dx,dy)<6)return;
    drag.moved=true;drag.el.classList.add('is-slot-dragging');
    drag.el.style.translate=`${dx}px ${dy}px`;
    drag.target=null;
    plants().forEach(el=>{
      const hit=el!==drag.el && PlantHitTest.contains(el,e.clientX,e.clientY);
      el.classList.toggle('is-slot-target',hit);if(hit)drag.target=el.dataset.projectId;
    });
  });
  document.addEventListener('pointerup',e=>{
    if(!drag || e.pointerId!==drag.pointer)return;
    const {id,target,moved}=drag;clearDrag();
    if(moved && target)swapFeaturedPlants(id,target);
  });
  document.addEventListener('pointercancel',clearDrag);
  document.addEventListener('lostpointercapture',()=>{if(drag)clearDrag();},true);
  window.addEventListener('blur',clearDrag);
  app.addEventListener('click',e=>{
    if(!e.target.closest('.front-plant') || e.detail===0)return;
    if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return;}
    const hit=PlantHitTest.pick(app,e.clientX,e.clientY);
    e.preventDefault();e.stopImmediatePropagation();
    if(hit){state.selectedProjectId=hit.dataset.projectId;saveState();render();}
  },true);
  app.addEventListener('keydown',e=>{
    const el=e.target.closest('.front-plant');if(!el)return;
    if(e.key==='Escape'){clearDrag();return;}
    if(e.altKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const ids=featuredProjects().map(p=>p.id),i=ids.indexOf(el.dataset.projectId);
      const next=(i+(['ArrowLeft','ArrowUp'].includes(e.key)?ids.length-1:1))%ids.length;
      swapFeaturedPlants(ids[i],ids[next]);plants().find(p=>p.dataset.projectId===ids[i])?.focus();
    }
  });
  // A click-based equivalent is available without dragging or hotkeys.
  app.addEventListener('contextmenu',e=>{
    const el=PlantHitTest.pick(app,e.clientX,e.clientY);if(!el)return;e.preventDefault();
    const id=el.dataset.projectId;
    openModal(`<div class="modal__heading"><h2>${ui('交换植物位置','Swap plant positions')}</h2><button class="icon-button" data-action="close-modal" aria-label="${ui('关闭','Close')}">${icon('close')}</button></div><p>${ui('选择要交换位置的植物；也可以直接拖动，或按 Alt + 方向键换位。','Choose another plant, drag directly, or use Alt + arrow keys.')}</p><div class="slot-swap-options">${featuredProjects().filter(p=>p.id!==id).map(p=>`<button class="button button--dark" data-swap-from="${escapeHtml(id)}" data-swap-to="${escapeHtml(p.id)}"><span data-user-content>${escapeHtml(p.name)}</span></button>`).join('')}</div>`);
  });
  modalRoot.addEventListener('click',e=>{const b=e.target.closest('[data-swap-to]');if(b){closeModal();swapFeaturedPlants(b.dataset.swapFrom,b.dataset.swapTo);}});
  app.addEventListener('pointerover',e=>{
    const el=e.target.closest('.floating-pet__plant');
    if(!el || el.contains(e.relatedTarget) || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    el.classList.add('is-breezy');
  });
  app.addEventListener('animationend',e=>{if(e.animationName==='plant-breeze')e.target.closest('.floating-pet__plant')?.classList.remove('is-breezy');});
})();
