const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const growth=require('./growth-model.js');
// Read only this app's saved backups. Filesystem creation/modified times are
// deliberately excluded: a copied file does not date a project achievement.
function readStageEvidence(directory,current) {
  const found=new Map();
  if(!current?.projects || !fs.existsSync(directory))return [];
  let files;
  try { files=fs.readdirSync(directory,{recursive:true}).filter(name=>/(^|[\\/])(?:garden-state(?:\.backup)?|before-restart-state|before-repair-state)\.json$/.test(name)).slice(0,200); } catch { return []; }
  for(const name of files)try {
    const file=path.join(directory,name);if(fs.statSync(file).size>8*1024*1024)continue;
    const save=JSON.parse(fs.readFileSync(file,'utf8'));
    if(save.version!==1 || save.state?.growthModelVersion!==2 || !Number.isFinite(Date.parse(save.savedAt)) || Date.parse(save.savedAt)>Date.now())continue;
    if(save.checksum!==crypto.createHash('sha256').update(JSON.stringify(save.state)).digest('hex'))continue;
    for(const snapshot of save.state.projects || []) {
      const project=current.projects.find(p=>p.id===snapshot.id && p.plantSpecies===snapshot.plantSpecies);
      if(!project?.plantSpecies || project.speciesDormant || snapshot.speciesDormant)continue;
      if(JSON.stringify(project.growthCalibration || null)!==JSON.stringify(snapshot.growthCalibration || null))continue;
      const maxStage=Math.min(growth.stage(project),growth.stage(snapshot));
      for(let stage=0;stage<=maxStage;stage++) {
        const key=`${project.id}:${stage}`,previous=found.get(key);
        if(!previous || Date.parse(save.savedAt)<Date.parse(previous.observedAt)) found.set(key,{projectId:project.id,stage,observedAt:save.savedAt});
      }
    }
  }catch { /* An unreadable backup cannot block the intact main save. */ }
  return [...found.values()];
}
module.exports={readStageEvidence};
