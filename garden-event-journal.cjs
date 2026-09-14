const fs=require('node:fs');
const path=require('node:path');

function createEventJournal(directory) {
  const file=path.join(directory,'garden-events.jsonl');
  const events=new Map();
  try {
    for(const line of fs.readFileSync(file,'utf8').split('\n')) {
      try {const row=JSON.parse(line);if(row?.event?.eventId && Number.isFinite(Date.parse(row.occurredAt))) events.set(row.event.eventId,row);} catch { /* Preserve a torn tail for diagnosis. */ }
    }
  } catch(error) {if(error.code!=='ENOENT') throw error;}
  return {
    values:()=>[...events.values()],
    record(event, occurredAt=new Date().toISOString()) {
      if(events.has(event.eventId)) return events.get(event.eventId);
      const row={version:1,event,occurredAt};
      fs.mkdirSync(directory,{recursive:true});
      const fd=fs.openSync(file,'a',0o600);
      try {fs.writeFileSync(fd,'\n'+JSON.stringify(row)+'\n','utf8');fs.fsyncSync(fd);} finally{fs.closeSync(fd);}
      events.set(event.eventId,row);
      return row;
    },
  };
}
module.exports={createEventJournal};
