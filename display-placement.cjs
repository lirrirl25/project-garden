// Pure display selection, also exercised without opening a visible window.
function preferredDisplay(displays, primaryId) {
  return displays.find(d => d.id !== primaryId && d.workArea.height > d.workArea.width)
    || displays.find(d => d.id !== primaryId)
    || displays.find(d => d.id === primaryId) || displays[0];
}
function fitBounds(area, compact = false, previous) {
  const width = Math.min(area.width, compact ? 320 : (previous?.width || 1160));
  const height = Math.min(area.height, compact ? 340 : (previous?.height || 780));
  const x = previous?.x ?? (compact ? area.x+area.width-width-20 : area.x+Math.floor((area.width-width)/2));
  const y = previous?.y ?? (compact ? area.y+area.height-height-20 : area.y+Math.floor((area.height-height)/2));
  return { width, height, x: Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width))), y: Math.round(Math.max(area.y,Math.min(y,area.y+area.height-height))) };
}
module.exports = { preferredDisplay, fitBounds };
