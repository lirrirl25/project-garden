/* Discovery history, independent of growth scoring and decoration currency. */
(function(root) {
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  function ensure(project, currentStage) {
    if (!Array.isArray(project.growthUnlocks)) project.growthUnlocks = [];
    for (let stage = 0; stage <= currentStage; stage++) {
      if (!project.growthUnlocks.some(entry => entry.stage === stage)) {
        // Old versions stored scores, not per-stage dates. Never manufacture
        // an unlock date from a project's last message, import or care time.
        project.growthUnlocks.push({stage, at:null, source:'legacy'});
      }
    }
    // The old profile did retain species discovery, not achievement dates.
    // Restore that exact local event only; never extrapolate other stages.
    const discovery=project.growthUnlocks.find(entry=>entry.stage===0);
    if (currentStage>=0 && discovery?.source==='legacy' && !discovery.at && validDate(project.speciesUnlockedAt) && Date.parse(project.speciesUnlockedAt)<=Date.now()) {
      discovery.at=new Date(project.speciesUnlockedAt).toISOString();
      discovery.source='discovery';
    }
    return project.growthUnlocks;
  }
  function advance(project, beforeStage, afterStage, at, source = 'progress', recordedAt = new Date().toISOString()) {
    ensure(project, beforeStage);
    for (let stage = beforeStage + 1; stage <= afterStage; stage++) {
      if (!project.growthUnlocks.some(entry => entry.stage === stage)) {
        project.growthUnlocks.push({stage, at:validDate(at) ? new Date(at).toISOString() : null, source, recordedAt});
      }
    }
  }
  // A saved snapshot proves that a stage existed by this date, not when it
  // was first reached. Keep that upper bound separate from achievement dates.
  function observe(project, currentStage, at) {
    if (!validDate(at) || Date.parse(at)>Date.now()) return;
    ensure(project,currentStage);
    for (const entry of project.growthUnlocks.filter(e=>e.stage<=currentStage)) {
      if (!entry.at && !entry.achievedAt && (!validDate(entry.observedAt) || Date.parse(at)<Date.parse(entry.observedAt))) entry.observedAt=at;
    }
  }
  function unlocked(project, currentStage) {
    // Reading the journal is non-mutating, including older imported records.
    return Array.from({length:currentStage+1}, (_,stage) => {
      const entry=project.growthUnlocks?.find(item=>item.stage===stage);
      return {...entry,stage, at:validDate(entry?.at) ? entry.at : null, achievedAt:validDate(entry?.achievedAt) ? entry.achievedAt : null, observedAt:validDate(entry?.observedAt)?entry.observedAt:null, source:entry?.source || 'legacy'};
    });
  }
  function normalizeDate(value, now) {
    if (value === null) return null;
    if (typeof value !== 'string') throw new Error('Expected a date or null');
    const day=value.slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !validDate(day) || new Date(day).toISOString().slice(0,10)!==day) throw new Error('Invalid calendar date');
    if (value.length!==10 && !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)) throw new Error('A timestamp needs a timezone');
    if (!validDate(value) || Date.parse(value)>now) throw new Error('Invalid or future date');
    return value.length===10 ? value : new Date(value).toISOString();
  }
  function prepareDates(project, values, maxStage, now=Date.now()) {
    if (values===undefined) return [];
    if (!Array.isArray(values) || values.length>6) throw new Error('Expected up to six stage dates');
    const seen=new Set();
    const dates=values.map(item=>{
      if (!item || !Number.isInteger(item.stage) || item.stage<0 || item.stage>maxStage || seen.has(item.stage)) throw new Error('Invalid or duplicate stage');
      seen.add(item.stage);
      const at=normalizeDate(item.reached_at,now);
      const previous=project.growthUnlocks?.find(entry=>entry.stage===item.stage)?.achievedAt;
      if (at && previous && at!==previous) throw new Error('Existing historical date conflicts');
      const observed=project.growthUnlocks?.find(entry=>entry.stage===item.stage)?.observedAt;
      if (at && validDate(observed) && (at.length===10 ? at>observed.slice(0,10) : Date.parse(at)>Date.parse(observed))) throw new Error('Stage already existed before this date');
      return {stage:item.stage,at};
    }).sort((a,b)=>a.stage-b.stage);
    // Include already imported dates when checking chronology, and treat a
    // date-only value as a whole day rather than inventing midnight precision.
    const combined=Array.from({length:6},(_,stage)=>{const entry=project.growthUnlocks?.find(e=>e.stage===stage);return {stage,at:dates.find(d=>d.stage===stage)?.at || entry?.achievedAt || (entry?.source==='progress'?entry.at:null)};});
    let minimum=-Infinity;
    for (const entry of combined.filter(d=>d.at)) {
      const start=Date.parse(entry.at), end=start+(entry.at.length===10?86399999:0);
      if (end<minimum) throw new Error('Stage dates are out of order');
      minimum=Math.max(minimum,start);
    }
    return dates;
  }
  function applyDates(project, dates, currentStage, evidence = {kind:'agent'}) {
    let updated=0;
    for (const date of dates) {
      const entry=project.growthUnlocks?.find(item=>item.stage===date.stage);
      if (entry && date.stage<=currentStage && date.at && !entry.achievedAt) {
        entry.achievedAt=date.at;
        entry.dateEvidence={kind:evidence.kind || 'agent',note:String(evidence.note || '').slice(0,500),recordedAt:new Date().toISOString()};
        updated++;
      }
    }
    return updated;
  }
  const api={ensure,advance,observe,unlocked,validDate,prepareDates,applyDates,normalizeDate};
  if(typeof module!=='undefined') module.exports=api; else root.GardenHistory=api;
})(typeof window!=='undefined'?window:globalThis);
