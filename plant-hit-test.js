/* Pointer feedback follows opaque artwork, not its transparent square canvas. */
(function(root) {
  const masks=new Map();
  function prepare(container) {
    for(const img of container.querySelectorAll('.front-plant .modular-plant img')) {
      if(masks.has(img.src))continue;
      masks.set(img.src,null);
      img.decode().then(()=>{
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
        masks.set(img.src,{width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data});
      }).catch(()=>{masks.delete(img.src);});
    }
  }
  function localTransform(el) {
    const style=getComputedStyle(el),origin=style.transformOrigin.split(' ').map(parseFloat);
    const length=(v,size)=>v?.endsWith('%')?parseFloat(v)*size/100:parseFloat(v)||0;
    const translate=style.translate==='none'?[]:style.translate.split(' ');
    const scales=style.scale==='none'?[1,1]:style.scale.split(' ').map(Number);
    let matrix=new DOMMatrix().translate(el.offsetLeft,el.offsetTop)
      .translate(length(translate[0],el.offsetWidth),length(translate[1],el.offsetHeight))
      .translate(origin[0]||0,origin[1]||0).rotate(parseFloat(style.rotate)||0).scale(scales[0],scales[1]??scales[0]);
    if(style.transform!=='none')matrix=matrix.multiply(new DOMMatrix(style.transform));
    return matrix.translate(-(origin[0]||0),-(origin[1]||0));
  }
  function contains(plant,x,y) {
    const art=plant.querySelector('.modular-plant');if(!art)return false;
    const rect=art.getBoundingClientRect();if(!rect.width || !rect.height)return false;
    const base=new DOMMatrix().translate(rect.left,rect.top).scale(rect.width/art.offsetWidth,rect.height/art.offsetHeight);
    for(const img of art.querySelectorAll('img')) {
      if(img.closest('.growth-previous'))continue;
      const mask=masks.get(img.src);if(!mask)continue;
      const chain=[];let node=img;
      while(node && node!==art){chain.unshift(node);node=node.offsetParent;}
      if(node!==art)continue;
      let matrix=base,opacity=1;
      for(const layer of chain){matrix=matrix.multiply(localTransform(layer));opacity*=Number(getComputedStyle(layer).opacity);}
      if(opacity<.1)continue;
      const local=new DOMPoint(x,y).matrixTransform(matrix.inverse());
      const px=Math.floor(local.x/img.offsetWidth*mask.width),py=Math.floor(local.y/img.offsetHeight*mask.height);
      if(px>=0 && py>=0 && px<mask.width && py<mask.height && mask.data[(py*mask.width+px)*4+3]>32)return true;
    }
    return false;
  }
  function pick(container,x,y,exclude=null) {
    return [...container.querySelectorAll('.front-plant')].reverse()
      .sort((a,b)=>(b.classList.contains('near-plant')?3:1)-(a.classList.contains('near-plant')?3:1))
      .find(el=>el!==exclude && contains(el,x,y)) || null;
  }
  root.PlantHitTest={prepare,contains,pick};
})(window);
