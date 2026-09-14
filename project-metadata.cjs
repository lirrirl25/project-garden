const fs=require('node:fs');
// Only explicit Codex project metadata, never directory times or chat content.
function creationDates(file,ids,now=Date.now()) {
  try {
    const local=JSON.parse(fs.readFileSync(file,'utf8'))['local-projects'] || {};
    return (Array.isArray(ids)?ids:[]).slice(0,80).flatMap(id=>{
      if(typeof id!=='string' || !Object.hasOwn(local,id))return [];
      const value=local[id]?.createdAt;
      if(typeof value!=='number' || !Number.isFinite(value) || value<=0 || value>now)return [];
      return [{codexProjectId:id,projectCreatedAt:new Date(value).toISOString()}];
    });
  } catch { return []; }
}
module.exports={creationDates};
