const STORAGE_KEY = 'project-garden:state:v1';

const DEFAULT_DECOR = {
  unlocked: ['pot-terracotta', 'shelf-wood', 'prop-watering-can'],
  active: { pot: 'pot-terracotta', shelf: 'shelf-wood', prop: 'prop-watering-can' },
};

const DECORATION_LIBRARY = [
  { id: 'pot-terracotta', slot: 'pot', name: '经典陶盆', cost: 0, description: '温暖的赤陶盆沿。' },
  { id: 'pot-cream', slot: 'pot', name: '奶油釉盆', cost: 4, description: '完整奶油釉色，保留陶盆明暗与纹理。' },
  { id: 'pot-moss', slot: 'pot', name: '苔绿釉盆', cost: 6, description: '完整苔绿釉色，植物叶片保持原色。' },
  { id: 'shelf-wood', slot: 'shelf', name: '深木花架', cost: 0, description: '温室原有的深色木架。' },
  { id: 'shelf-brass', slot: 'shelf', name: '黄铜花架', cost: 8, description: '为后层架子加上黄铜护角。' },
  { id: 'prop-watering-can', slot: 'prop', name: '浇水壶角落', cost: 0, description: '保留温室原有的浇水壶。' },
  { id: 'prop-shovel', slot: 'prop', name: '园艺小铲', cost: 5, description: '在左下方的土盆中添一把园艺小铲。' },
  { id: 'prop-seed-box', slot: 'prop', name: '种子木箱', cost: 7, description: '在右下角摆上装满种子包的木箱。' },
];

const emptyState = () => ({
  habitat: 'garden',
  language: 'zh',
  difficulty: 'gentle',
  selectedProjectId: null,
  // Automatic Codex-project binding is the default. It never carries a project
  // title across the bridge: the desktop app only receives an opaque project key.
  autoCreate: true,
  // A one-time opt-in solely for reconnecting a pre-existing manual plant.
  // New Codex projects never need this selection.
  pendingAdoptionProjectId: null,
  // Hidden plants remain alive and keep receiving the same anonymous Codex
  // progress; this is only a decluttering preference for the garden view.
  hiddenProjectIds: [],
  projects: [],
  activities: [],
  eventCodes: [],
  gardenDust: 0,
  appliedAgentEventIds: [],
  insightLedger: [],
  decor: { unlocked: [...DEFAULT_DECOR.unlocked], active: { ...DEFAULT_DECOR.active } },
});

let storageNotice = '';
let storageBlocked = false;
let nativeRevision = 0;
let lastSavedAt = null;
let state = loadState();
const isCompact = new URLSearchParams(window.location.search).get('compact') === '1';
document.documentElement.classList.toggle('floating-mode', isCompact);
let milestoneNotice = '';
let milestoneNoticeTimer;
const arrivedProjects = new Set();
let modalReturnFocus = null;

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');

function loadState() {
  try {
    let saved;
    const native = window.projectGardenDesktop?.loadState?.();
    if (native?.blocked) {
      storageBlocked = true;
      storageNotice = '存档暂时无法读取。原文件已保留，不会用空园区覆盖。';
      return emptyState();
    }
    nativeRevision = native?.revision || 0;
    lastSavedAt = native?.savedAt || null;
    if (native?.state) {
      saved = native.state;
      for(const evidence of native.stageEvidence || []) {
        const project=saved.projects?.find(p=>p.id===evidence.projectId);
        if(project && !project.speciesDormant && Number.isInteger(evidence.stage) && evidence.stage>=0 && evidence.stage<=5)GardenHistory.observe(project,evidence.stage,evidence.observedAt);
      }
      if (native.recovered) storageNotice = '已从本机备份恢复园区。';
    } else {
      const candidates = [];
      // Legacy cache is imported once, then the native save is authoritative.
      for (const key of [STORAGE_KEY, ...Object.keys(localStorage).filter(key => key.startsWith(`${STORAGE_KEY}:before-`))]) {
        try { const value = JSON.parse(localStorage.getItem(key)); if (Array.isArray(value?.projects)) candidates.push(value); } catch { /* Try an intact legacy backup. */ }
      }
      saved = candidates.find(value => value.projects.length) || candidates[0] || {};
      if (!saved.appliedAgentEventIds) saved.appliedAgentEventIds = native?.legacyEventIds || [];
    }
    const defaults = emptyState();
    return {
      ...defaults,
      ...saved,
      habitat: 'garden',
      language: saved.language === 'en' ? 'en' : 'zh',
      appliedAgentEventIds: Array.isArray(saved.appliedAgentEventIds) ? saved.appliedAgentEventIds : [],
      insightLedger: Array.isArray(saved.insightLedger) ? saved.insightLedger : [],
      autoCreate: saved.autoCreate !== false,
      pendingAdoptionProjectId: typeof saved.pendingAdoptionProjectId === 'string' ? saved.pendingAdoptionProjectId : null,
      hiddenProjectIds: [...new Set((Array.isArray(saved.hiddenProjectIds) ? saved.hiddenProjectIds : [])
        .filter((id) => typeof id === 'string' && id.length))],
      projects: Array.isArray(saved.projects) ? saved.projects.map((project) => ({
        ...project,
        codexProjectId: typeof project.codexProjectId === 'string' ? project.codexProjectId : null,
        syncProjectKey: typeof project.syncProjectKey === 'string' ? project.syncProjectKey : null,
      })) : [],
      gardenDust: Math.max(0, Number(saved.gardenDust) || 0),
      decor: {
        ...defaults.decor,
        ...(saved.decor || {}),
        unlocked: [...new Set([...DEFAULT_DECOR.unlocked, ...(Array.isArray(saved.decor?.unlocked) ? saved.decor.unlocked : [])])],
        active: { ...DEFAULT_DECOR.active, ...(saved.decor?.active || {}) },
      },
    };
  } catch {
    if (window.projectGardenDesktop?.loadState) {
      storageBlocked = true;
      storageNotice = '存档读取失败，未创建新园区或覆盖旧记录。';
    }
    return emptyState();
  }
}

function saveState() {
  if (storageBlocked) throw new Error(storageNotice);
  state.habitat = 'garden';
  state.projects.forEach(project => GardenHistory.ensure(project, hasUnlockedPlant(project) ? stageFor(project) : -1));
  if (window.projectGardenDesktop?.saveState) {
    const result = window.projectGardenDesktop.saveState({ state, revision: nativeRevision });
    if (!result?.ok) {
      storageNotice = result?.error || '保存没有完成，请保留窗口并重试。';
      render();
      throw new Error(storageNotice);
    }
    nativeRevision = result.revision;
    lastSavedAt = result.savedAt;
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { if (!window.projectGardenDesktop?.saveState) throw error; }
  syncBridgeContext();
}

function syncBridgeContext() {
  if (storageBlocked) return;
  // Only local routing metadata crosses Electron's internal boundary. Project
  // names, activities, notes, and real project work stay in this renderer's
  // local storage. `autoCreate` is just a Boolean — never project content.
  window.projectGardenDesktop?.syncContext({
    projectId: activeProject()?.id || null,
    habitat: state.habitat || null,
    autoCreate: state.autoCreate !== false,
    language: state.language,
  });
}

function uid(prefix) {
  return `${prefix}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function dateFrom(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function daysSince(value) {
  return Math.max(0, Math.floor((Date.now() - dateFrom(value).getTime()) / 86_400_000));
}

function relativeTime(value) {
  const days = daysSince(value);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  return `${days} 天前`;
}

function lastProgressLabel(project) {
  return project.lastProgressAt ? `上次推进：${relativeTime(project.lastProgressAt)}` : '尚无真实推进';
}

function projectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function isProjectHidden(project) {
  return Boolean(project && state.hiddenProjectIds.includes(project.id));
}

function visibleProjects() {
  return state.projects.filter((project) => !isProjectHidden(project));
}

function activeProject() {
  const visible = visibleProjects();
  return visible.find((project) => project.id === state.selectedProjectId) || visible[0] || null;
}

function stageFor(project) {
  return GardenGrowth.stage(project);
}

function ui(zh, en) { return state.language === 'en' ? en : zh; }
function localizeUI() {
  document.documentElement.lang = state.language === 'en' ? 'en' : 'zh-CN';
  document.title = ui('项目园', 'Project Garden');
  GardenI18n.localize(app, state.language);
  GardenI18n.localize(modalRoot, state.language);
}

function decorationFor(id) {
  return DECORATION_LIBRARY.find((item) => item.id === id) || null;
}

function activeDecoration(slot, project = activeProject()) {
  const chosen = decorationFor(slot === 'pot' ? project?.potId : decorPreview?.[slot] || state.decor?.active?.[slot]);
  return chosen?.slot === slot && !chosen.pendingArt ? chosen.id : DEFAULT_DECOR.active[slot];
}

function migrateIndividualPots() {
  if (state.decor.potScopeVersion === 1) return;
  const legacy = decorationFor(state.decor.active.pot);
  const potId = legacy?.slot === 'pot' && !legacy.pendingArt && state.decor.unlocked.includes(legacy.id)
    ? legacy.id : DEFAULT_DECOR.active.pot;
  // The old purchase was intended for the selected plant, not the whole garden.
  // Keep ownership and explicit per-plant choices; do not charge for migration.
  const selectedId = activeProject()?.id;
  for (const project of state.projects) {
    if (!project.potId) project.potId = project.id === selectedId ? potId : DEFAULT_DECOR.active.pot;
  }
  state.decor.potScopeVersion = 1;
  state.decor.active.pot = DEFAULT_DECOR.active.pot;
}

function insightCountToday(projectId) {
  return insightCountOn(projectId, new Date().toISOString());
}

function localDay(at) {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
}

function insightCountOn(projectId, at) {
  const ledger = state.insightLedger.filter(entry => entry.projectId === projectId && entry.reward > 0 && localDay(entry.at) === localDay(at));
  const legacy = state.activities.filter(entry => entry.projectId === projectId && entry.type === 'insight' && !entry.eventId && localDay(entry.at) === localDay(at));
  return ledger.length + legacy.length;
}

// Species are assigned locally at the first verified result. Prefer unused
// species, including those belonging to hidden projects, so identity is stable.
const PLANT_LIBRARY = [
  {
    id: 'nasturtium', name: '旱金莲', englishName: 'NASTURTIUM VINE', anatomy: '攀藤 · 圆叶 · 橙花',
    stageLabels: ['刚攀上支架', '延伸藤蔓', '长出花苞', '藤上开花'],
    organStart: 6, organEvery: 3, organSize: 36, empty: '藤蔓正在向上攀爬',
    anchors: [{ id: 'mid-right', x: 62, y: 54, tilt: -8 }, { id: 'high-left', x: 43, y: 36, tilt: 7 }, { id: 'top-right', x: 64, y: 22, tilt: -6 }, { id: 'low-left', x: 35, y: 65, tilt: 9 }, { id: 'top-left', x: 39, y: 16, tilt: 5 }],
    counts: { bud: '个花苞', opening: '朵初开', bloom: '朵盛开' },
    moments: { added: (count) => `藤蔓上长出了第 ${count} 个花苞。`, opening: '一个花苞正在慢慢张开。', bloom: '一朵旱金莲开了。' },
  },
  {
    id: 'african-violet', name: '非洲堇', englishName: 'AFRICAN VIOLET', anatomy: '叶丛 · 紫花 · 中心花簇',
    stageLabels: ['叶心苏醒', '叶丛铺开', '结出花苞', '紫花成簇'],
    organStart: 8, organEvery: 2, organSize: 30, empty: '绒叶正在围成一圈',
    anchors: [{ id: 'center', x: 50, y: 42, tilt: 0 }, { id: 'left', x: 37, y: 48, tilt: -8 }, { id: 'right', x: 63, y: 45, tilt: 6 }, { id: 'high', x: 51, y: 30, tilt: 0 }, { id: 'low', x: 49, y: 58, tilt: 2 }],
    counts: { bud: '个紫花苞', opening: '朵初开', bloom: '朵紫花' },
    moments: { added: (count) => `叶心里冒出了第 ${count} 个紫花苞。`, opening: '一朵非洲堇正从叶丛间张开。', bloom: '一小簇非洲堇开了。' },
  },
  {
    id: 'monstera', name: '龟背竹', englishName: 'MONSTERA DELICIOSA', anatomy: '攀援 · 开裂叶 · 新叶卷',
    stageLabels: ['新叶卷起', '茎秆向上', '叶片开裂', '新叶舒展'],
    organStart: 8, organEvery: 3, organSize: 34, empty: '叶柄正在抬高',
    anchors: [{ id: 'mid', x: 60, y: 52, tilt: -5 }, { id: 'high', x: 44, y: 32, tilt: 7 }, { id: 'top', x: 58, y: 17, tilt: -4 }, { id: 'low', x: 35, y: 66, tilt: 8 }],
    counts: { bud: '片卷叶', opening: '片舒展新叶', bloom: '片开裂新叶' },
    moments: { added: (count) => `龟背竹顶端卷起了第 ${count} 片新叶。`, opening: '一片新叶正在舒展。', bloom: '新叶裂出了标志性的孔洞。' },
  },
  {
    id: 'haworthia', name: '十二卷', englishName: 'HAWORTHIA ZEBRA', anatomy: '莲座 · 白纹叶 · 侧芽',
    stageLabels: ['叶尖冒土', '莲座变密', '长出侧芽', '抽出花梗'],
    organStart: 8, organEvery: 3, organSize: 31, empty: '白纹叶正在聚成莲座',
    anchors: [{ id: 'left', x: 35, y: 67, tilt: -8 }, { id: 'right', x: 65, y: 67, tilt: 8 }, { id: 'high', x: 54, y: 36, tilt: 0 }, { id: 'far', x: 74, y: 75, tilt: 9 }],
    counts: { bud: '个小侧芽', opening: '株定根小苗', bloom: '根细花梗' },
    moments: { added: (count) => `莲座旁长出了第 ${count} 个小侧芽。`, opening: '一个侧芽已经稳稳扎根。', bloom: '十二卷抽出了一根细细的花梗。' },
  },
  {
    id: 'phalaenopsis-orchid', name: '蝴蝶兰', englishName: 'PHALAENOPSIS ORCHID', anatomy: '花梗 · 花苞 · 粉色蝶花',
    stageLabels: ['花梗初立', '花梗伸展', '花苞排列', '蝴蝶兰盛开'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '花梗正在安静向光生长', anchors: [],
    counts: { bud: '个花苞', opening: '朵初开', bloom: '朵兰花' },
    moments: { added: () => '兰花花梗长出一个新花苞。', opening: '一朵蝴蝶兰开始展开。', bloom: '一朵蝴蝶兰开了。' },
  },
  {
    id: 'birds-nest-fern', name: '鸟巢蕨', englishName: 'BIRD’S NEST FERN', anatomy: '卷叶 · 波浪叶缘 · 叶丛',
    stageLabels: ['卷叶探头', '叶片舒展', '叶丛加密', '蕨叶成瀑'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '卷曲的新叶正在慢慢松开', anchors: [],
    counts: { bud: '片卷叶', opening: '片新叶', bloom: '片成熟蕨叶' },
    moments: { added: () => '叶心卷起了一片新蕨叶。', opening: '一片蕨叶正在舒展。', bloom: '鸟巢蕨长成了一丛叶瀑。' },
  },
  {
    id: 'hoya-carnosa', name: '球兰', englishName: 'HOYA CARNOSA', anatomy: '攀藤 · 蜡质叶 · 星形花球',
    stageLabels: ['藤蔓挂上圆架', '厚叶攀援', '垂下花苞', '蜡花成球'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '厚叶藤蔓正在绕着圆架前进', anchors: [],
    counts: { bud: '串花苞', opening: '簇初开', bloom: '球蜡花' },
    moments: { added: () => '球兰藤蔓垂下了一串花苞。', opening: '一簇球兰正在初开。', bloom: '球兰开成了一团星星蜡花。' },
  },
  {
    id: 'calathea-orbifolia', name: '圆叶竹芋', englishName: 'CALATHEA ORBIFOLIA', anatomy: '圆叶 · 银绿条纹 · 夜间抬叶',
    stageLabels: ['两片幼叶', '叶纹显现', '大叶展开', '条纹叶丛'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '银绿色叶纹正在一圈圈铺开', anchors: [],
    counts: { bud: '片幼叶', opening: '片大叶', bloom: '片条纹叶' },
    moments: { added: () => '圆叶竹芋抽出了一片新叶。', opening: '一片条纹叶正在展开。', bloom: '圆叶竹芋长成了一丛舒展的大叶。' },
  },
  {
    id: 'peace-lily', name: '白掌', englishName: 'SPATHIPHYLLUM', anatomy: '披针叶 · 白色佛焰苞 · 肉穗花序',
    stageLabels: ['幼叶向光', '叶丛渐丰', '白苞初立', '白掌舒展'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '叶丛与白色佛焰苞随成果逐步舒展', anchors: [],
    counts: { bud: '个花苞', opening: '朵初开', bloom: '朵白掌' }, moments: {},
  },
  {
    id: 'hydrangea', name: '绣球', englishName: 'HYDRANGEA MACROPHYLLA', anatomy: '对生锯齿叶 · 分枝 · 蓝紫花簇',
    stageLabels: ['对叶初生', '枝叶成丛', '花簇结苞', '蓝紫花团'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '分枝逐渐丰满，花簇从小苞长成花团', anchors: [],
    counts: { bud: '簇花苞', opening: '簇初开', bloom: '团绣球' }, moments: {},
  },
  {
    id: 'anthurium', name: '红掌', englishName: 'ANTHURIUM ANDRAEANUM', anatomy: '心形叶 · 红色佛焰苞 · 肉穗花序',
    stageLabels: ['心叶初生', '蜡叶铺开', '红苞抽出', '红掌盛展'],
    organStart: 999, organEvery: 99, organSize: 0, empty: '蜡质心叶与红色佛焰苞随成果逐步展开', anchors: [],
    counts: { bud: '个花苞', opening: '朵初开', bloom: '朵红掌' }, moments: {},
  },
];

function stableIndex(value, length) {
  let hash = 2166136261;
  for (const character of String(value || 'project-garden')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % length;
}

function plannedSpeciesId(project) {
  const used = new Set(state.projects.filter(item => item.id !== project.id && !isProjectHidden(item)).map(item => item.plantSpecies));
  const available = PLANT_LIBRARY.filter(item => !used.has(item.id));
  return available.length ? available[stableIndex(project.speciesSeed || project.id, available.length)].id : null;
}

function unlockPlantSpecies(project) {
  project.plantSpecies = PLANT_LIBRARY.some(item=>item.id===project.plantSpecies) ? project.plantSpecies : plannedSpeciesId(project);
  project.speciesDormant=false;
  project.speciesPending = !project.plantSpecies;
  if (!project.plantSpecies) return false;
  project.speciesUnlockedAt ||= new Date().toISOString();
  return true;
}

function reconcileSpeciesAssignments() {
  // Only visible plants reserve species. Restoring a plant must never reroll
  // either existing identity, even if its species was reused while absent.
  const used = new Set();
  const waiting = [];
  const changes = [];
  for (const project of state.projects) {
    if (isProjectHidden(project)) continue;
    if (!project.plantSpecies && !project.speciesUnlocked && !project.speciesPending) continue;
    const valid = PLANT_LIBRARY.some(item => item.id === project.plantSpecies);
    if (valid) used.add(project.plantSpecies);
    else waiting.push(project);
  }
  for (const project of waiting) {
    const available = PLANT_LIBRARY.filter(item => !used.has(item.id));
    const next = available.length ? available[stableIndex(project.speciesSeed || project.id, available.length)].id : null;
    if (project.plantSpecies !== next) changes.push({ id: project.id, from: project.plantSpecies || null, to: next });
    project.plantSpecies = next;
    project.speciesPending = !next;
    if (next) used.add(next);
  }
  return changes;
}

function migrateSpeciesVariety() {
  const version = `unique-v1:${PLANT_LIBRARY.length}`;
  if (state.speciesLayoutVersion === version) return;
  // Save the complete pre-migration garden before any identity changes.
  const backupKey = `${STORAGE_KEY}:before-${version}`;
  if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, JSON.stringify(state));
  reconcileSpeciesAssignments();
  state.speciesLayoutVersion = version;
  saveState();
}

function plantDefinitionFor(project) {
  const id = project?.plantSpecies;
  return PLANT_LIBRARY.find((definition) => definition.id === id) || PLANT_LIBRARY[0];
}

function growthPartsFor(project, points = project.points || 0) {
  if (!hasUnlockedPlant(project)) return [];
  return GardenGrowth.organs(project, points, 8);
}

function growthSummaryFor(project, points = project.points || 0) {
  const parts = growthPartsFor(project, points);
  if (!parts.length) return ui('随项目进展持续生长。', 'Growing with your project.');
  const flowering = GardenGrowth.flowering.includes(project.plantSpecies);
  const newest = parts.reduce((a,b) => a.number > b.number ? a : b);
  const phaseNames = flowering ? ['花苞','含苞','初开','盛开'] : ['卷叶','长大','展开','成叶'];
  return `第 ${newest.number} ${flowering ? '朵' : '片'} · ${phaseNames[GardenGrowth.phases.indexOf(newest.phase)]}`;
}

function growthMomentFor(project, before, after) {
  return JSON.stringify(before) !== JSON.stringify(after) ? growthSummaryFor(project) : '';
}

function hasUnlockedPlant(project) {
  return state.habitat === 'garden' && !project.speciesDormant && PLANT_LIBRARY.some(item => item.id === project.plantSpecies);
}

function plantIdentity(project) {
  if (project.speciesPending && state.habitat === 'garden') return '已有成果，等待新增品种';
  return hasUnlockedPlant(project) ? `${plantDefinitionFor(project).name}型项目植物` : '未鉴定项目幼苗';
}

function ideaPoints(project) { return project.growthCalibration ? GardenGrowth.score(project) : (project.points || 0); }

function stageLabel(project) {
  if (state.habitat === 'garden' && !hasUnlockedPlant(project)) {
    if (project.speciesPending) return '成果已记录 · 品种待扩充';
    return ideaPoints(project) > 0 ? '未鉴定幼苗' : '想法种子';
  }
  const labels = GardenGrowth.flowering.includes(project.plantSpecies)
    ? ['幼株','扎根','抽枝','丰叶','初花','繁茂']
    : ['幼株','扎根','抽枝','舒叶','成丛','新叶循环'];
  return labels[stageFor(project)];
}

function wellbeingFor(project) {
  // Growth and vitality are deliberately separate. Progress grows the plant;
  // a short care action can revive its posture, but cannot fake new growth.
  const progressDays = daysSince(project.lastProgressAt || project.createdAt);
  const careDays = daysSince(project.lastCareAt || project.createdAt);
  const policy = state.difficulty === 'gentle'
    ? { softAt: 10, yellowAt: 21, restingAt: Infinity, careGrace: 8 }
    : { softAt: 4, yellowAt: 9, restingAt: 16, careGrace: 5 };
  const recentlyCaredFor = careDays <= 1;
  const vitalityDays = Math.max(0, progressDays - (recentlyCaredFor ? policy.careGrace : 0));

  if (vitalityDays < policy.softAt) return { label: '安稳', tone: 'well', visual: 'well', progressDays };
  if (vitalityDays < policy.yellowAt) return { label: '叶片微垂', tone: 'soft', visual: 'soft', progressDays };
  if (vitalityDays < policy.restingAt) return { label: '叶缘泛黄', tone: 'yellow', visual: 'yellow', progressDays };
  return { label: '需要一点照料', tone: 'resting', visual: 'resting', progressDays };
}

function icon(name) {
  const paths = {
    leaf: '<path d="M5 18c7.8-.2 12.2-4.7 14-13-8.3 1.8-12.8 6.2-14 13Zm0 0c2.5-3.5 5.8-6.1 10-8"/>',
    paw: '<path d="M8 12.5c-2.3 0-4 1.8-4 4.1 0 2.2 1.5 3.4 3.3 3.4 1.2 0 2.1-.6 2.7-1.2.6.6 1.5 1.2 2.7 1.2 1.8 0 3.3-1.2 3.3-3.4 0-2.3-1.7-4.1-4-4.1-1 0-1.9.4-2.7 1.1-.8-.7-1.7-1.1-2.7-1.1ZM6.1 8.8a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm4-1.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm4 1.9a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    spark: '<path d="m12 3 1.5 6.1L20 11l-6.5 1.9L12 19l-1.5-6.1L4 11l6.5-1.9L12 3Z"/>',
    lock: '<rect x="5.5" y="10" width="13" height="10" rx="2"/><path d="M8.5 10V7.7a3.5 3.5 0 0 1 7 0V10M12 14v2"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    copy: '<rect x="8" y="8" width="10" height="11" rx="1.5"/><path d="M6 16H5.5A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5V6"/>',
    arrow: '<path d="M6 18 18 6M9 6h9v9"/>',
    more: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    sync: '<path d="M19 8a7 7 0 0 0-12-2L4 9m0-5v5h5M5 16a7 7 0 0 0 12 2l3-3m0 5v-5h-5"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

function projectItem(project) {
  const wellbeing = wellbeingFor(project);
  const selected = project.id === activeProject()?.id;
  return `
    <button type="button" class="project-row ${selected ? 'is-selected' : ''}" data-action="select-project" data-project-id="${project.id}" aria-pressed="${selected}">
      <span class="project-row__mark ${state.habitat}" aria-hidden="true">${hasUnlockedPlant(project) ? creatureArt(project, 'mini') : `<span class="seed-sprite sidebar-seed stage-${Math.min(3, Math.ceil(ideaPoints(project) / 2))}"></span>`}</span>
      <span class="project-row__copy"><strong data-user-content>${escapeHtml(plantName(project))}</strong>${hasUnlockedPlant(project) ? `<small class="project-row__species">${plantDefinitionFor(project).name}</small>` : ''}<small>${stageLabel(project)} · ${wellbeing.label}</small></span>
      <span class="status-dot status-dot--${wellbeing.tone}" title="${wellbeing.label}"></span>
    </button>`;
}

function activityScore(project) {
  const period = 21;
  return state.activities.reduce((score, activity) => {
    if (activity.projectId !== project.id || activity.type !== 'progress') return score;
    const age = daysSince(activity.at);
    if (age > period) return score;
    return score + Math.max(1, period - age);
  }, 0);
}

function rankedProjects() {
  return [...visibleProjects()].sort((first, second) => {
    const scoreDifference = activityScore(second) - activityScore(first);
    if (scoreDifference) return scoreDifference;
    return dateFrom(second.lastProgressAt || second.createdAt).getTime() - dateFrom(first.lastProgressAt || first.createdAt).getTime();
  });
}

const FEATURED_POSITIONS = [{x:38,y:85},{x:55,y:85},{x:29,y:72},{x:44,y:72}];

function foregroundPlant(project, index) {
  const wellbeing = wellbeingFor(project);
  const selected = project.id === activeProject()?.id;
  const position = FEATURED_POSITIONS[index] || FEATURED_POSITIONS[0];
  return `
    <button type="button" class="creature front-plant ${index>1?'midground-plant':'near-plant'} ${selected ? 'is-selected' : ''}" style="--plot-x:${position.x}%; --plot-y:${position.y}%; --delay:${index * 75}ms" data-action="select-project" data-project-id="${project.id}" aria-label="${escapeHtml(plantName(project))}，${stageLabel(project)}，${lastProgressLabel(project)}" aria-pressed="${selected}">
      <span class="creature__art">${scaledPlantArt(project, 'foreground-art')}</span>
      <span class="creature__caption"><strong data-user-content>${escapeHtml(plantName(project))}</strong><small><i class="status-dot status-dot--${wellbeing.tone}"></i>${stageLabel(project)} · ${wellbeing.label}</small></span>
    </button>`;
}

function shelfPlant(project, index) {
  const selected = project.id === activeProject()?.id;
  // The source-art coordinates are the three physical shelf boards. They are
  // converted into stage pixels after render, so pots remain grounded even
  // when the desktop window changes aspect ratio.
  const rackSlots = [
    { x: 955, y: 421 }, { x: 1080, y: 421 }, { x: 1205, y: 421 },
    { x: 955, y: 505 }, { x: 1080, y: 505 }, { x: 1205, y: 505 },
    { x: 955, y: 593 }, { x: 1080, y: 593 }, { x: 1205, y: 593 },
  ];
  const position = rackSlots[index % rackSlots.length];
  const wellbeing = wellbeingFor(project);
  return `<button type="button" class="shelf-plant ${selected ? 'is-selected' : ''}" style="--shelf-x:61%; --shelf-y:41%; --source-shelf-x:${position.x}; --source-shelf-y:${position.y}; --delay:${index * 55}ms" data-action="select-project" data-project-id="${project.id}" aria-label="后层项目：${escapeHtml(plantName(project))}，${stageLabel(project)}，${lastProgressLabel(project)}" aria-pressed="${selected}">${scaledPlantArt(project, 'shelf-project-art')}<span class="shelf-plant__tooltip" aria-hidden="true"><strong data-user-content>${escapeHtml(plantName(project))}</strong><small>${stageLabel(project)} · ${lastProgressLabel(project)}</small></span></button>`;
}

function alignShelfPotsToArtwork() {
  const sourceWidth = 1680;
  const sourceHeight = 943;
  document.querySelectorAll('.pixel-stage, .mini-stage').forEach((stage) => {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const contained = rect.width / rect.height < 1.3;
    stage.classList.toggle('is-letterboxed', contained);
    const scale = (contained ? Math.min : Math.max)(rect.width / sourceWidth, rect.height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    // The full panorama uses `center 58%`; the compact window centers the art.
    const yAnchor = contained ? .5 : stage.classList.contains('pixel-stage') ? .58 : .5;
    const offsetY = (rect.height - renderedHeight) * yAnchor;
    // A normalized canvas gives each rear pot 32 source-art pixels of width,
    // leaving room for foliage between the boards and neighbouring plants.
    stage.style.setProperty('--rear-plant-size', `${100 * scale}px`);
    stage.querySelectorAll('.front-plant').forEach((plant,index)=>{
      const position=FEATURED_POSITIONS[index];
      plant.style.setProperty('--plot-x',contained ? `${offsetX+position.x/100*renderedWidth}px` : `${position.x}%`);
      plant.style.setProperty('--plot-y',contained ? `${offsetY+position.y/100*renderedHeight}px` : `${position.y}%`);
    });
    if(contained) stage.style.setProperty('--front-plant-size',`${Math.min(118,240*scale)}px`);
    else stage.style.removeProperty('--front-plant-size');
    // Shelf decorations share the same source-art transform as the pots.
    stage.style.setProperty('--rack-left', `${offsetX + 865 * scale}px`);
    stage.style.setProperty('--rack-width', `${550 * scale}px`);
    [428, 513, 602].forEach((y, index) => stage.style.setProperty(`--rack-line-${index}`, `${offsetY + y * scale}px`));
    stage.querySelectorAll('.shelf-plant').forEach((pot) => {
      const sourceX = Number.parseFloat(pot.style.getPropertyValue('--source-shelf-x'));
      const sourceY = Number.parseFloat(pot.style.getPropertyValue('--source-shelf-y'));
      if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) return;
      pot.style.setProperty('--shelf-x', `${Math.round(offsetX + sourceX * scale)}px`);
      pot.style.setProperty('--shelf-y', `${Math.round(offsetY + sourceY * scale)}px`);
    });
  });
}

// Visible pot bounds [left, right, bottom] within each atlas cell, measured
// from the pottery, not the surrounding transparent canvas or leaf canopy.
const POT_BOUNDS = {
  'nasturtium': [[.367,.666,.864],[.328,.621,.864],[.367,.672,.910],[.326,.633,.910]],
  'african-violet': [[.242,.753,.829],[.241,.748,.829],[.242,.789,.877],[.254,.732,.877]],
  'monstera': [[.437,.727,.850],[.282,.587,.860],[.448,.761,.930],[.349,.670,.939]],
  'haworthia': [[.309,.791,.847],[.209,.724,.853],[.286,.826,.898],[.198,.740,.925]],
  'phalaenopsis-orchid': [[.383,.726,.952],[.195,.542,.952],[.324,.672,.951],[.250,.604,.957]],
  'birds-nest-fern': [[.340,.721,.869],[.287,.673,.869],[.335,.721,.919],[.281,.665,.919]],
  'hoya-carnosa': [[.372,.685,.868],[.305,.618,.869],[.372,.685,.906],[.305,.618,.909]],
  'calathea-orbifolia': [[.418,.702,.817],[.308,.601,.817],[.410,.702,.877],[.308,.601,.877]],
  'peace-lily': [[.3646,.6349,.9],[.3648,.6352,.9],[.3656,.6359,.9],[.3649,.6353,.9]],
  'hydrangea': [[.3649,.6352,.9],[.365,.6353,.9],[.3654,.6357,.9],[.3656,.6359,.9]],
  'anthurium': [[.3648,.6353,.9],[.3654,.6358,.9],[.365,.6354,.9],[.3651,.6355,.9]],
  'seed': [[.195,.827,.857],[.135,.769,.857],[.195,.827,.861],[.135,.769,.861]],
};
const CANOPY_TOP = {
  'nasturtium': [.096,.082,.015,-.066], 'african-violet': [.273,.094,.064,.061],
  'monstera': [.306,.059,-.035,-.088], 'haworthia': [.233,.093,.026,-.124],
  'phalaenopsis-orchid': [.222,.029,-.008,-.018], 'birds-nest-fern': [.295,.129,.013,-.059],
  'hoya-carnosa': [.118,.037,-.051,-.075], 'calathea-orbifolia': [.187,.102,-.002,-.043],
  'peace-lily': [.1891,.1812,.0469,.0078], 'hydrangea': [.3406,.1938,.1625,.1109],
  'anthurium': [.3703,.2672,.0719,.05],
};

function displayedPlantHeight(project) {
  if (!hasUnlockedPlant(project)) return .35;
  return ['nasturtium','phalaenopsis-orchid','hoya-carnosa','monstera'].includes(project.plantSpecies) ? .98 : .82;
}

function scaledPlantArt(project, modifier = '') {
  if (state.habitat === 'garden') return `<span class="plant-display ${modifier} modular-display" data-pot-width="0.3203125">${creatureArt(project)}</span>`;
  const identified = hasUnlockedPlant(project);
  const stage = identified ? stageFor(project) : Math.min(3, Math.ceil(ideaPoints(project) / 2));
  const bounds = state.habitat === 'garden' ? POT_BOUNDS[identified ? plantDefinitionFor(project).id : 'seed'][stage] : [.22,.78,.89];
  const [left, right, bottom] = bounds;
  // A squat rosette needs a larger presentation footprint than a tall leafy
  // plant. Scale uniformly, anchoring its pot bottom at the same ground point.
  const presentation = modifier === 'foreground-art' && identified && project.plantSpecies === 'haworthia' ? 1.65 : 1;
  const scale = .32 / (right - left) * presentation;
  return `<span class="plant-display ${modifier}" data-pot-width="${right - left}" style="--art-scale:${scale};--art-left:${(0.5 - (left + right) / 2 * scale) * 100}%;--art-bottom:${-(1 - bottom) * scale * 100}%">${creatureArt(project)}</span>`;
}

function creatureArt(project, modifier = '') {
  const stage = stageFor(project);
  const wellbeing = wellbeingFor(project);
  if (state.habitat !== 'garden') {
    const extra = stage > 1 ? '<rect x="15" y="40" width="5" height="5" fill="#f6d883"/><rect x="43" y="40" width="5" height="5" fill="#f6d883"/>' : '';
    return `<svg class="animal-art pixel-animal ${modifier} stage-${stage}" viewBox="0 0 64 64" role="img" aria-label="像素小动物" shape-rendering="crispEdges"><rect x="15" y="22" width="8" height="10" fill="#9f633c"/><rect x="41" y="22" width="8" height="10" fill="#9f633c"/><rect x="14" y="30" width="36" height="22" fill="#c9824d"/><rect x="20" y="25" width="24" height="21" fill="#e3a764"/><rect x="26" y="34" width="4" height="4" fill="#21374a"/><rect x="36" y="34" width="4" height="4" fill="#21374a"/>${extra}<rect x="30" y="40" width="4" height="3" fill="#754530"/><rect x="18" y="52" width="8" height="5" fill="#9f633c"/><rect x="39" y="52" width="8" height="5" fill="#9f633c"/></svg>`;
  }

  if (!hasUnlockedPlant(project)) {
    const ideaStage = Math.min(3, Math.ceil(ideaPoints(project) / 2));
    const pot = activeDecoration('pot', project).replace('pot-', '');
    return `<span class="modular-plant idea-seed ${modifier}" role="img" aria-label="${plantIdentity(project)}，${stageLabel(project)}，${wellbeing.label}"><img class="modular-pot" src="assets/modular-v2/pot-${pot}.png" width="512" height="512" alt=""/><span class="modular-canopy vitality-${wellbeing.visual}"><img class="modular-body" src="assets/modular-v2/seed-${ideaStage}.png" width="512" height="512" alt=""/></span></span>`;
  }

  const definition = plantDefinitionFor(project);
  const parts = growthPartsFor(project);
  const growthSummary = growthSummaryFor(project);
  const pot = activeDecoration('pot', project).replace('pot-', '');
  return `<span class="modular-plant species-${definition.id} ${modifier}" data-growth-stage="${stage}" role="img" aria-label="${definition.name}型项目植物，${stageLabel(project)}，${wellbeing.label}，${growthSummary}"><img class="modular-pot" src="assets/modular-v2/pot-${pot}.png" width="512" height="512" alt=""/><span class="modular-canopy vitality-${wellbeing.visual}"><img class="modular-body" src="assets/modular-v2/${definition.id}-body-${stage}.png" width="512" height="512" alt=""/>${renderGrowthParts(definition, parts)}</span></span>`;
}

function renderPlantBody(definition, stage) {
  const bodyClass = definition.id === 'nasturtium' ? 'vine-body' : `species-body species-body-${definition.id}`;
  return `<span class="plant-sprite ${bodyClass} stage-${stage}"></span>`;
}

function renderGrowthParts(definition, parts) {
  const layouts = {
    'nasturtium': [[57,39],[45,52],[57,23],[39,67],[62,60],[44,30],[55,70],[48,19]],
    'phalaenopsis-orchid': [[52,27],[61,28],[67,32],[72,36],[75,41],[47,35],[53,44],[62,45]],
    'hoya-carnosa': [[40,45],[46,45],[43,50],[37,50],[49,50],[40,55],[46,55],[43,60]],
    'hydrangea': [[48,41],[54,41],[51,36],[45,36],[57,36],[42,41],[48,46],[54,46]],
    'peace-lily': [[53,35],[41,44],[65,46],[48,51],[58,56],[36,54],[68,59],[51,61]],
    'anthurium': [[53,41],[41,49],[65,54],[48,55],[57,60],[37,58],[65,62],[49,66]],
    'haworthia': [[40,71],[60,72],[44,74],[56,73],[38,74],[64,73],[48,74],[53,74]],
    'birds-nest-fern': [[49,66],[46,69],[53,68],[43,71],[57,70],[47,71],[54,72],[51,70]],
    'calathea-orbifolia': [[49,60],[45,64],[54,64],[43,66],[57,67],[49,66],[52,67],[50,65]],
  };
  const anchors=layouts[definition.id] || [[50,53],[40,57],[61,57],[47,43],[58,46],[35,62],[65,62],[53,63]];
  const size=['hoya-carnosa','hydrangea','haworthia'].includes(definition.id) ? 13 : definition.id==='nasturtium' ? 23 : 25;
  const stems=['peace-lily','anthurium'].includes(definition.id);
  return parts.map(part => {
    const [x,y]=anchors[part.slot];
    const stem=stems ? `<svg class="modular-stem" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 72 Q ${x} 60 ${x} ${y}" fill="none" stroke="#477235" stroke-width=".65"/></svg>` : '';
    return `${stem}<img class="modular-organ" data-organ-number="${part.number}" data-phase="${part.phase}" src="assets/modular-v2/${definition.id}-${part.phase}.png" alt="" width="192" height="192" style="left:${x}%;top:${y}%;width:${size}%;height:${size}%"/>`;
  }).join('');
}

function emptyHabitat() {
  if (state.projects.length && !visibleProjects().length) {
    return `
      <div class="empty-habitat scene-empty">
        <span class="scene-empty__seed" aria-hidden="true"></span>
        <p>所有项目暂时都被移出花园了。</p>
        <button class="button button--accent" type="button" data-action="show-removed-projects">查看已移出项目</button>
      </div>`;
  }
  return `
    <div class="garden-welcome-note">
      ${icon('sync')}<span><strong>等待第一条项目记录</strong><small>在 Codex 里继续项目。收到成果记录后，<br>这里会出现对应的植物。</small></span>
    </div>`;
}

function greenhouseBackdrop() {
  return `<div class="scene-atmosphere" aria-hidden="true"></div><div class="rack-trim" aria-hidden="true"><i></i><i></i><i></i></div><span class="scene-prop scene-prop--${activeDecoration('prop')}" aria-hidden="true"></span>`;
}

function featuredProjects() {
  const recent=rankedProjects().slice(0,4);
  const saved=[...new Set(Array.isArray(state.featuredOrder)?state.featuredOrder:[])].slice(0,4);
  const slots=Array.from({length:4},(_,i)=>recent.find(p=>p.id===saved[i]) || null);
  const incoming=recent.filter(p=>!slots.includes(p));
  return slots.map(p=>p || incoming.shift()).filter(Boolean);
}

function swapFeaturedPlants(first, second) {
  const ids=featuredProjects().map(p=>p.id), a=ids.indexOf(first), b=ids.indexOf(second);
  if(a<0 || b<0 || a===b) return false;
  [ids[a],ids[b]]=[ids[b],ids[a]];
  state.featuredOrder=ids;
  saveState();render();
  return true;
}

function sceneProjects() {
  const projects = rankedProjects();
  const foreground = featuredProjects();
  // Keep the same nine recent projects; taller silhouettes get the upper
  // board's headroom. This is layout only and does not alter growth or ranking.
  const background = projects.slice(4, 13).sort((a, b) => displayedPlantHeight(b) - displayedPlantHeight(a));
  return `<div class="front-garden" aria-label="前排近期项目">${foreground.map(foregroundPlant).join('')}</div><div class="back-shelf-projects" aria-label="后层项目架">${background.map(shelfPlant).join('')}</div>`;
}

function dashboard() {
  const project = activeProject();
  const visibleCount = visibleProjects().length;
  const hiddenCount = state.projects.length - visibleCount;
  const garden = state.habitat === 'garden';
  const title = garden ? '植物园' : '动物园';
  return `
    <header class="topbar">
      <button type="button" class="brand" data-action="garden-home" aria-label="回到植物园">
        <img class="brand__image" src="assets/garden-app-icon-v1.png" alt="" />
        <span><strong>项目园</strong><small>PROJECT GARDEN</small></span>
      </button>
      <div class="topbar__right">
        <button type="button" class="language-switch" data-action="toggle-language" aria-label="${ui('切换到英文','Switch to Chinese')}">${ui('EN','中文')}</button>
        <button type="button" class="decor-corner-button" data-action="show-decor" aria-label="装饰小铺，${state.gardenDust} 点灵感">${icon('spark')} <span>灵感 <b>${state.gardenDust}</b></span></button>
        <button type="button" class="desktop-corner-button" data-action="toggle-compact">${icon('leaf')} 桌面植物</button>
        <div class="mode-switch" role="group" aria-label="状态难度">
          <button type="button" class="${state.difficulty === 'gentle' ? 'is-active' : ''}" data-action="set-difficulty" data-difficulty="gentle">轻松</button>
          <button type="button" class="${state.difficulty === 'regular' ? 'is-active' : ''}" data-action="set-difficulty" data-difficulty="regular">普通</button>
        </div>
        <span class="privacy-chip" title="${lastSavedAt ? `最近保存：${new Date(lastSavedAt).toLocaleString('zh-CN')}` : '每次变化自动保存'}">${icon('lock')} ${window.projectGardenDesktop ? '自动保存' : '网页预览'}</span>
      </div>
    </header>
    <div class="workspace greenhouse-layout">
      <aside class="project-shelf" aria-label="正在照料的项目">
        <div class="shelf-heading"><span><p class="eyebrow">PLANT LEDGER</p><h2>植物册</h2></span><button type="button" class="round-button" data-action="new-project" aria-label="手动新增项目（可选）">${icon('plus')}</button></div>
        <div class="project-list">${visibleCount ? rankedProjects().map(projectItem).join('') : state.projects.length ? '<p class="shelf-empty">项目暂时都移出花园了。<br>它们仍会继续接收 Codex 进展。</p>' : '<p class="shelf-empty">还没有项目。<br>第一次真实推进会自动种下种子。</p>'}</div>
        <div class="shelf-footer"><span>${visibleCount} 个正在照料</span><button type="button" class="shelf-hidden-button" data-action="show-removed-projects" ${hiddenCount ? '' : 'disabled'}>已移出 ${hiddenCount} 个</button><span>主景：近 21 天最常推进的 4 个</span></div>
      </aside>
      <section class="habitat panorama" aria-label="${title}全景">
        <div class="panorama__heading"><div><p class="eyebrow">MY GREENHOUSE</p><h1>${visibleCount ? '我的植物园' : state.projects.length ? '暂时没有展示中的植物' : '欢迎来到项目园'}</h1></div><div class="garden-heading-meta"><span class="garden-heading-note">${visibleCount ? `${visibleCount} 个项目 · 进展持续同步` : '项目有进展，植物就生长。'}</span><button type="button" class="garden-sync-help" data-action="show-sync-info">同步说明</button></div></div>
        <div class="pixel-stage decor-shelf-${activeDecoration('shelf')} decor-prop-${activeDecoration('prop')}">
          ${greenhouseBackdrop()}
          <div class="creature-grid plot-field">${visibleCount ? sceneProjects() : emptyHabitat()}</div>
        </div>
        ${project ? gardenConsole(project) : emptyConsole()}
      </section>
    </div>
    <footer class="privacy-footer"><span>${icon('lock')} ${window.projectGardenDesktop ? '记录保存在本机，重启后自动恢复。' : '这是独立网页预览，不读取桌面存档。请从桌面「Project Garden」打开正式园区。'}</span><div class="privacy-footer__actions">${startupControlMarkup()}<button type="button" data-action="show-privacy">隐私说明</button></div></footer>`;
}

function gardenConsole(project) {
  const wellbeing = wellbeingFor(project);
  const definition = plantDefinitionFor(project);
  const awaitingSpecies = state.habitat === 'garden' && project.speciesPending;
  return `<section class="garden-console" aria-label="当前项目操作">
    <div class="console-project"><span class="console-project__sprite">${creatureArt(project, 'mini')}</span><span class="console-project__copy"><p class="eyebrow">${hasUnlockedPlant(project) ? definition.name : awaitingSpecies ? '成果已保留' : '等待第一份成果'}</p><div class="plant-name-line"><h2 title="${escapeHtml(plantName(project))}" data-user-content>${escapeHtml(plantName(project))}</h2>${pencilButton('rename-plant',`data-project-id="${escapeHtml(project.id)}"`)}</div><p class="console-status"><i class="status-dot status-dot--${wellbeing.tone}"></i>${stageLabel(project)} · ${wellbeing.label}</p><p class="console-detail">${hasUnlockedPlant(project) ? growthSummaryFor(project) : awaitingSpecies ? '现有品种均已使用；扩充素材后自动揭晓，进度继续累计' : '首个可验证成果，让真实品种揭晓'}</p></span></div>
    <div class="console-actions"><button type="button" class="pixel-button pixel-button--primary" data-action="show-progress-journal">${icon('leaf')} 生长记录</button><button type="button" class="pixel-button" data-action="care">${state.habitat === 'garden' ? icon('leaf') : icon('paw')} ${state.habitat === 'garden' ? '浇一点水' : '陪一会儿'}</button></div>
    <div class="console-agent"><span>${icon('sync')} <span data-sync-status>正在连接本机同步</span></span><div><small>成果更新植物 · 想法与决定获得灵感</small><button type="button" data-action="refresh-sync">检查更新</button></div></div>
    <div class="console-activity"><button type="button" class="activity-history-link" data-action="show-activity-history" data-project-id="${escapeHtml(project.id)}" aria-label="${ui('查看全部进展记录','View all activity')}" title="${ui('查看全部记录与时间','View all records and times')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></button>${recentActivities(project.id)}</div>
  </section>`;
}

function emptyConsole() {
  return `<section class="garden-console garden-console--empty"><span><p class="eyebrow">GETTING STARTED</p><h2>从你正在做的项目开始</h2><p>连接 Project Garden Sync 后，Codex 确认的成果会自动更新植物。</p></span><button class="pixel-button pixel-button--primary" type="button" data-action="show-sync-info">${icon('sync')} 查看同步说明</button><button class="pixel-button" type="button" data-action="new-project">${icon('plus')} 添加本地项目</button></section>`;
}

function compactDashboard() {
  const project = compactProject();
  const name = project ? escapeHtml(plantName(project)) : '还没有展示中的项目';
  return `<section class="floating-pet" aria-label="桌面漂浮植物">
    <button type="button" class="floating-pet__plant" aria-label="${name}；拖动移动，右键打开菜单，双击展开项目园" aria-describedby="pet-tip">
      ${project ? scaledPlantArt(project) : '<span class="floating-pet__empty">'+icon('leaf')+'</span>'}
    </button>
    <div class="floating-pet__tip" id="pet-tip" role="tooltip"><strong data-user-content>${name}</strong><small>${project ? `${stageLabel(project)} · ${lastProgressLabel(project)}` : '右键展开项目园'}<br>拖动移动 · 右键菜单</small></div>
    <button type="button" class="floating-pet__menu" data-action="pet-menu" aria-label="植物菜单" aria-haspopup="menu">${icon('more')}</button>
  </section>`;
}

function compactProject() {
  const growing=GardenPresentation.pending().filter(e=>e.changed).reverse().map(e=>projectById(e.id)).find(p=>p && !isProjectHidden(p));
  return growing || activeProject();
}

function showPetMenu() {
  window.projectGardenDesktop?.showPetMenu({
    language: state.language,
    selectedId: activeProject()?.id || null,
    projects: rankedProjects().map(project => ({ id:project.id, name:plantName(project) })),
  });
}

function emptyRitual() {
  return `<div class="ritual-empty"><p class="eyebrow">YOUR FIRST CORNER</p><h2>从一个小小的项目开始。</h2><p>不需要把所有想法都搬进来。选一个你想今天多靠近一点的事。</p><button class="button button--accent" type="button" data-action="new-project">${icon('plus')} 新建项目</button></div>`;
}

function ritualPanel(project) {
  const wellbeing = wellbeingFor(project);
  const stage = stageFor(project);
  const progress = Math.min(100, ((project.points || 0) % 3) * 33.34);
  const nextStage = state.habitat === 'garden' ? ['破土', '新叶', '花苞', '盛开'][Math.min(stage + 1, 3)] : ['熟悉', '学会小技能', '更有精神', '闪闪发光'][Math.min(stage + 1, 3)];
  return `
    <div class="ritual-panel__project">
      <p class="eyebrow">ACTIVE PROJECT</p>
      <h2 data-user-content>${escapeHtml(plantName(project))}</h2>
      <div class="stage-line"><span>${stageLabel(project)}</span><span class="status-label status-label--${wellbeing.tone}">${wellbeing.label}</span></div>
      <div class="growth-meter" aria-label="离下个阶段的进度"><span style="width:${progress}%"></span></div>
      <p class="next-stage">再有一点真实推进，就会接近「${nextStage}」。</p>
    </div>
    <div class="ritual-actions">
      <button type="button" class="action-card action-card--primary" data-action="record-progress">${icon('spark')}<span><strong>记录一个进展</strong><small>让它向前生长一点</small></span></button>
      <button type="button" class="action-card" data-action="care">${state.habitat === 'garden' ? icon('leaf') : icon('paw')}<span><strong>${state.habitat === 'garden' ? '浇一点水' : '陪它一会儿'}</strong><small>不算产出，只是照料</small></span></button>
    </div>
    <div class="agent-card">
      <div><span class="agent-card__seal">${icon('lock')}</span><span><strong>Codex 自动同步</strong><small>第一次真实推进自动种下项目；无需复制、导入或选择。</small></span></div>
      <div class="agent-card__actions"><button type="button" data-action="show-sync-info">同步说明</button></div>
    </div>
    <div class="activity-log"><div class="activity-log__heading"><p class="eyebrow">RECENTLY</p><span>本地</span></div>${recentActivities(project.id)}</div>`;
}

function recentActivities(projectId) {
  const items = state.activities.filter((activity) => activity.projectId === projectId).slice(0, 4);
  if (!items.length) return '<p class="activity-empty">还没有记录。完成一点再回来，它会记得。</p>';
  return items.map((activity) => `<div class="activity-row"><span class="activity-row__mark activity-row__mark--${activity.type}" aria-hidden="true"></span><span data-user-content>${escapeHtml(activityDisplayTitle(activity))}</span><time datetime="${escapeHtml(activity.at)}">${relativeTime(activity.at)}</time></div>`).join('');
}

function activityDisplayTitle(activity) {
  if (state.language !== 'en') return activity.title;
  if (activity.type === 'decor' && activity.title.startsWith('换上了')) return `Using ${GardenI18n.translate(activity.title.slice(3))}`;
  const careTitles = { '得到一点水和阳光':'Watered and cared for', '暂时移出花园视图':'Hidden from the garden', '回到温室视图':'Restored to the garden' };
  if (activity.type === 'care' && careTitles[activity.title]) return careTitles[activity.title];
  if (activity.type === 'insight' && activity.eventId) return `${activity.title.startsWith('确认') ? 'Decision recorded' : 'New idea recorded'} · ${activity.reward ? `Inspiration +${activity.reward}` : 'Daily cap reached'}`;
  return activity.title;
}

function render() {
  if (storageBlocked) {
    app.innerHTML = `<section class="recovery-screen"><img src="assets/garden-app-icon-v1.png" alt=""/><h1>园区存档需要恢复</h1><p>${escapeHtml(storageNotice)}</p><p>请保留本机的 garden-state.json 和备份文件。</p><button class="pixel-button" data-action="reload-garden">重新读取</button></section>`;
    return;
  }
  const ledgerScroll = app.querySelector('.project-list')?.scrollTop || 0;
  const focused = document.activeElement;
  const focusAction = app.contains(focused) ? focused.dataset?.action : null;
  const focusProject = focused?.dataset?.projectId;
  state.habitat = 'garden';
  app.className = `app-shell app-shell--dashboard${isCompact ? ' app-shell--compact' : ''}`;
  app.innerHTML = isCompact ? compactDashboard() : dashboard();
  if (!isCompact) void refreshStartupControl();
  if (!isCompact && decorPreview) app.querySelector('.pixel-stage')?.insertAdjacentHTML('beforeend', decorationPreviewBanner());
  if (storageNotice) app.insertAdjacentHTML('beforeend', `<div class="storage-notice" role="status">${escapeHtml(storageNotice)} <button data-action="dismiss-storage-notice">知道了</button></div>`);
  if (milestoneNotice && state.habitat) {
    app.insertAdjacentHTML('beforeend', `<div class="milestone-toast" role="status">${icon('spark')}<span><strong>${milestoneNotice.title}</strong><small>${milestoneNotice.detail}</small></span></div>`);
  }
  alignShelfPotsToArtwork();
  app.querySelectorAll('.front-plant, .shelf-plant').forEach((element) => {
    if (!arrivedProjects.has(element.dataset.projectId)) element.classList.add('is-arriving');
    arrivedProjects.add(element.dataset.projectId);
  });
  const ledger = app.querySelector('.project-list');
  if (ledger) ledger.scrollTop = ledgerScroll;
  if (focusAction) {
    [...app.querySelectorAll('[data-action]')].find((element) => element.dataset.action === focusAction && element.dataset.projectId === focusProject)?.focus({ preventScroll: true });
  }
  syncBridgeContext();
  const journal = modalRoot.querySelector('[data-growth-journal]');
  if (journal) {
    const project = projectById(journal.dataset.growthJournal);
    if (project && !journal.querySelector('#journal-date-form')) journal.innerHTML = growthTimelineMarkup(project);
  }
  const activityHistory=modalRoot.querySelector('[data-activity-history]');
  if(activityHistory) activityHistory.innerHTML=activityHistoryMarkup(activityHistory.dataset.activityHistory);
  void refreshSyncStatus();
  localizeUI();
  GardenPresentation.apply(app,isCompact?compactProject()?.id:null,render);
  PlantHitTest.prepare(app);
  void GardenPresentation.centerJournal(modalRoot);
}

async function refreshSyncStatus() {
  if (storageBlocked) return;
  let text = '网页预览 · 请在桌面版接收记录';
  try {
    const status = await window.projectGardenDesktop?.getBridgeStatus();
    if (status) text = status.ready ? status.queuedEvents ? `${status.queuedEvents} 条记录待收取` : '本机同步已连接' : '等待本机同步连接';
  } catch { text = '同步暂未连接 · 记录仍保存在本机'; }
  document.querySelectorAll('[data-sync-status]').forEach(element => { element.textContent = state.language === 'en' ? GardenI18n.translate(text) : text; });
}

async function refreshSync() {
  const buttons = [...document.querySelectorAll('[data-action="refresh-sync"]')];
  buttons.forEach(button => { button.disabled = true; });
  try {
    if (!window.projectGardenDesktop?.refreshSync) throw new Error('请在桌面版收取同步记录。');
    const result = await window.projectGardenDesktop.refreshSync();
    showGrowthNotice(result?.queuedEvents ? '还有记录等待处理' : '记录已收取', result?.queuedEvents ? '未能处理的记录仍保留在本机队列。' : '园区与灵感已更新到本机已收到的最新记录。');
  } catch(error) { showGrowthNotice('暂时无法收取', error.message); }
  finally { buttons.forEach(button => { button.disabled = false; }); void refreshSyncStatus(); }
}

function showMilestoneNotice(project = activeProject()) {
  const definition = plantDefinitionFor(project);
  showGrowthNotice('实质里程碑已记录', `这颗想法种子揭晓为${definition.name}型项目植物。`);
}

function showGrowthNotice(title, detail) {
  milestoneNotice = { title, detail };
  window.clearTimeout(milestoneNoticeTimer);
  render();
  milestoneNoticeTimer = window.setTimeout(() => {
    milestoneNotice = '';
    render();
  }, 3600);
}

function chooseHabitat(habitat) {
  if (habitat !== 'garden') return;
  closeModal();
  state.habitat = habitat;
  saveState();
  render();
  if (!app.contains(document.activeElement)) app.querySelector('[data-action="garden-home"]')?.focus({ preventScroll: true });
}

function habitatPickerModal() {
  closeModal();
  render();
}

function openModal(content) {
  if (!modalRoot.children.length) modalReturnFocus = document.activeElement;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="项目园对话框">${content}</section></div>`;
  app.inert = true;
  localizeUI();
  const firstInput = modalRoot.querySelector('input, textarea, button');
  firstInput?.focus();
  void GardenPresentation.centerJournal(modalRoot);
}

function closeModal() {
  modalRoot.innerHTML = '';
  app.inert = false;
  const returnTarget = modalReturnFocus?.isConnected ? modalReturnFocus :
    [...app.querySelectorAll('[data-action]')].find(element => element.dataset.action === modalReturnFocus?.dataset?.action && element.dataset.projectId === modalReturnFocus?.dataset?.projectId);
  returnTarget?.focus({ preventScroll: true });
  modalReturnFocus = null;
}

function openProjectContextMenu(projectId, clientX, clientY) {
  const project = projectById(projectId);
  if (!project || isProjectHidden(project)) return;
  modalReturnFocus = document.activeElement;
  app.inert = true;
  const menuWidth = 214;
  const x = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, Math.round(clientX)));
  const y = Math.max(10, Math.min(window.innerHeight - 160, Math.round(clientY)));
  modalRoot.innerHTML = `
    <div class="context-menu-backdrop" data-action="close-modal">
      <section class="project-context-menu" role="menu" aria-label="${escapeHtml(plantName(project))} 的选项" style="--menu-x:${x}px; --menu-y:${y}px">
        <p data-user-content>${escapeHtml(plantName(project))}</p>
        <button type="button" role="menuitem" data-action="rename-plant" data-project-id="${project.id}">${ui('编辑植物名称','Edit plant name')}</button>
        <button type="button" role="menuitem" data-action="request-remove-project" data-project-id="${project.id}">从花园移出<span>不会影响原 Codex 项目</span></button>
      </section>
    </div>`;
  modalRoot.querySelector('[data-action="request-remove-project"]')?.focus();
}

function requestRemoveProject(projectId) {
  const project = projectById(projectId);
  if (!project || isProjectHidden(project)) return;
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">REMOVE FROM GARDEN</p><h2>移出「${escapeHtml(plantName(project))}」？</h2><p>它会从植物册与温室消失，但不会删除你的 Codex 项目或本机进展记录。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="decor-rule">之后它仍会收到来自同一 Codex 项目的真实进展；你也可以从「已移出」列表让它回到花园。</div>
    <div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">取消</button><button type="button" class="button button--dark" data-action="hide-project" data-project-id="${project.id}">确认移出</button></div>`);
}

function hideProject(projectId) {
  const project = projectById(projectId);
  if (!project || isProjectHidden(project)) return;
  state.hiddenProjectIds = [...state.hiddenProjectIds, project.id];
  if (state.selectedProjectId === project.id) state.selectedProjectId = visibleProjects()[0]?.id || null;
  recordActivity(project.id, '暂时移出花园视图', 'care');
  saveState();
  closeModal();
  render();
}

function restoreProject(projectId) {
  const project = projectById(projectId);
  if (!project || !isProjectHidden(project)) return;
  state.hiddenProjectIds = state.hiddenProjectIds.filter((id) => id !== project.id);
  state.selectedProjectId = project.id;
  recordActivity(project.id, '回到温室视图', 'care');
  saveState();
  closeModal();
  render();
}

function removedProjectsModal() {
  const projects = state.projects.filter(isProjectHidden);
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">GARDEN STORAGE</p><h2>已移出的项目</h2><p>移出只整理花园；这些项目仍会接收来自同一 Codex 项目的真实进展。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="hidden-project-list">${projects.length ? projects.map((project) => `<article><span class="hidden-project-list__art ${state.habitat}">${creatureArt(project, 'mini')}</span><span><strong data-user-content>${escapeHtml(plantName(project))}</strong><small>${stageLabel(project)} · 已移出但仍同步</small></span><button type="button" class="button button--dark" data-action="restore-project" data-project-id="${project.id}">带回花园</button></article>`).join('') : '<p class="form-note">现在没有已移出的项目。</p>'}</div>
    <div class="modal__footer"><span></span><button type="button" class="button button--dark" data-action="close-modal">回到温室</button></div>`);
}

function newProjectModal() {
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">OPTIONAL MANUAL PROJECT</p><h2>手动给一个项目安个家</h2><p>正常情况下不用填：Codex 的第一次真实推进会自动种下项目。这是离线或自用项目的备用入口。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <form id="new-project-form" class="form-stack">
      <label>项目名称<input name="name" maxlength="48" placeholder="例如：做第一版小游戏" required autocomplete="off" /></label>
      <fieldset><legend>它今天最像什么？</legend><div class="choice-grid"><label class="mini-choice"><input type="radio" name="kind" value="sprout" checked /><span>小小开始</span><small>慢慢长大</small></label><label class="mini-choice"><input type="radio" name="kind" value="quest" /><span>一段探索</span><small>边做边发现</small></label><label class="mini-choice"><input type="radio" name="kind" value="craft" /><span>一个作品</span><small>做出看得见的东西</small></label></div></fieldset>
      <div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">先不建了</button><button type="submit" class="button button--accent">${icon('plus')} 带它回家</button></div>
    </form>`);
}

function progressModal() {
  const project = activeProject();
  if (!project) return;
  const canUnlockPlant = state.habitat === 'garden' && !hasUnlockedPlant(project);
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">REAL PROGRESS</p><h2>这次推进了什么？</h2><p>记录一个真实、具体的动作就好。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <form id="progress-form" class="form-stack">
      <input type="hidden" name="projectId" value="${project.id}" />
      <label>给这次进展起个短名字<input name="title" maxlength="48" placeholder="例如：画完主界面草图" required autocomplete="off" /></label>
      <fieldset><legend>它大概有多大？</legend><div class="choice-grid choice-grid--two"><label class="mini-choice"><input type="radio" name="size" value="small" checked /><span>小步</span><small>完成一个明确行动</small></label><label class="mini-choice"><input type="radio" name="size" value="medium" /><span>一段</span><small>完成一个小阶段</small></label><label class="mini-choice"><input type="radio" name="size" value="large" /><span>重要一步</span><small>完成一个里程碑</small></label></div></fieldset>
      ${canUnlockPlant ? `<fieldset class="species-unlock"><legend>这次有了可展示的第一版吗？</legend><label class="species-unlock__choice"><input type="checkbox" name="unlockSpecies" /><span><strong>揭晓这颗种子的真实植物</strong><small>真实品种在本地种下项目时已经决定；只在做出可运行的第一版、可点击 prototype 或首次验证结果时揭晓。普通整理和小修改不用勾选。</small></span></label></fieldset>` : ''}
      <p class="form-note">这里的文字只保存在你的电脑，不会发给任何 Agent 或服务器。</p>
      <div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">返回</button><button type="submit" class="button button--accent">${icon('spark')} 让它生长</button></div>
    </form>`);
}

function promptModal() {
  const project = activeProject();
  if (!project) return;
  const code = uid('care').replace('_', '-').slice(0, 13).toUpperCase();
  state.eventCodes = state.eventCodes.filter((item) => dateFrom(item.expiresAt).getTime() > Date.now());
  state.eventCodes.push({ code, projectId: project.id, expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  saveState();
  const prompt = `你正在协助一个现实项目。若且唯若本轮产生了具体、可识别的项目进展，请在回复最后单独输出以下 JSON。不要包含项目名称、文件名、链接、客户、人名、代码、原文或任何项目内容；不确定时不要输出。\n\n{\n  "event_code": "${code}",\n  "event_type": "progress",\n  "size": "small"\n}\n\nsize 只能是 small、medium 或 large。`;
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">PRIVATE PROGRESS CODE</p><h2>匿名进展码已生成</h2><p>它在 24 小时后失效，只能对应「${escapeHtml(plantName(project))}」。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="code-display"><span>EVENT CODE</span><strong>${code}</strong></div>
    <label class="prompt-label">复制给你正在使用的 Agent<textarea readonly id="agent-prompt">${escapeHtml(prompt)}</textarea></label>
    <p class="form-note">这段文字不含你的项目标题或内容。Agent 返回时也只能给出进展大小。</p>
    <div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">稍后再说</button><button type="button" class="button button--dark" data-action="copy-prompt">${icon('copy')} 复制提示词</button></div>`);
}

function importModal() {
  const project = activeProject();
  if (!project) return;
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">LOCAL IMPORT</p><h2>导入匿名进展</h2><p>原始 JSON 只在这次导入时读取，不会被保存。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <form id="import-form" class="form-stack">
      <label>从 Agent 回复中粘贴 JSON<textarea name="payload" rows="7" placeholder='{"event_code":"CARE-...","event_type":"progress","size":"small"}' required></textarea></label>
      <p class="form-note">有效的进展码会自动找到对应项目；你仍需要亲自确认导入。</p>
      <div id="import-error" class="form-error" aria-live="polite"></div>
      <div class="modal__footer"><button type="button" class="text-button" data-action="close-modal">取消</button><button type="submit" class="button button--accent">${icon('spark')} 确认并生长</button></div>
    </form>`);
}

function journalDate(at) {
  if (typeof at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(at)) return at;
  if (!GardenHistory.validDate(at)) return ui('未记录','Not recorded');
  return new Intl.DateTimeFormat(state.language === 'en' ? 'en-CA' : 'zh-CN', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
}

function journalStageArt(project, entry) {
  if (entry.source==='seed' || entry.source==='seedling') return `<span class="seed-sprite stage-${entry.source==='seed'?0:2}"></span>`;
  // Render only a discovered stage at its threshold, without borrowing later
  // blossoms or the current plant's temporary stress coloration.
  const preview={...project,growthCalibration:null,points:GardenGrowth.thresholds[entry.stage],growthV2Offset:0,lastCareAt:new Date().toISOString(),lastProgressAt:new Date().toISOString()};
  return creatureArt(preview,'journal-plant');
}

function growthTimelineMarkup(project) {
  const currentStage = hasUnlockedPlant(project) ? stageFor(project) : -1;
  const labels = hasUnlockedPlant(project) ? plantDefinitionFor(project).stageLabels : [];
  const seedling = currentStage < 0 && ideaPoints(project) > 0 ? [{label:ui('未鉴定幼苗','Unidentified seedling'),at:project.seedlingUnlockedAt,source:'seedling'}] : [];
  const rows = [{label:ui('想法种子','Idea seed'),at:project.projectCreatedAt || (!project.codexProjectId && !project.syncProjectKey ? project.createdAt : null),source:'seed'}, ...seedling, ...GardenHistory.unlocked(project,currentStage).map(entry=>({...entry,label:state.language==='en'?GardenI18n.translate(labels[entry.stage]):labels[entry.stage]}))];
  const latestProgress=state.activities.filter(entry=>entry.projectId===project.id && entry.type==='progress' && GardenHistory.validDate(entry.at)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  const note=`<p class="journal-date-note">${ui('新阶段会自动记录生长日期。历史存档日期已标注来源，准确的达成日期可点铅笔修改。','New stages are dated automatically. Historical save dates show their source; use the pencil to enter the actual achievement date.')}</p>`;
  const latest=latestProgress?`<p class="journal-latest-progress">${ui('最近记录的项目推进','Latest recorded project progress')}<time datetime="${escapeHtml(latestProgress.at)}">${journalDate(latestProgress.at)}</time></p>`:'';
  return `${latest}${note}<ol class="growth-timeline">${rows.reverse().map((entry,index)=>{const key=entry.stage ?? entry.source;const edited=project.journalDates?.[key]?.date;const date=edited || entry.achievedAt || entry.at || entry.observedAt;return `<li class="growth-timeline__entry ${index===0?'is-current':''}" data-history-stage="${key}"><span class="growth-timeline__dot" aria-hidden="true"></span><span class="growth-timeline__art" aria-hidden="true">${journalStageArt(project,entry)}</span><div><strong>${entry.label}</strong>${index===0?`<small class="growth-timeline__current">${ui('当前','Current')}</small>`:''}<div class="journal-date-line"><time ${GardenHistory.validDate(date)?`datetime="${escapeHtml(date)}"`:''}>${journalDate(date)}</time>${pencilButton('edit-journal-date',`data-project-id="${escapeHtml(project.id)}" data-stage="${key}"`,ui(`编辑${entry.label}日期`,`Edit ${entry.label} date`))}</div>${edited?`<small>${ui('来源：手动修改 · 原记录已保留','Source: manual edit · original retained')}</small>`:journalDateSource(entry)}</div></li>`;}).join('')}</ol>`;
}

function journalDateSource(entry) {
  let label='';
  if(entry.achievedAt) label=entry.dateEvidence?.kind==='file'?ui('来源：已核对的项目文件','Source: verified project files'):entry.dateEvidence?.kind==='manual'?ui('来源：手动补充','Source: manually added'):ui('来源：Agent 补充记录','Source: agent-supplied record');
  else if(entry.source==='progress')label=ui('来源：项目进展 · 自动记录','Source: project progress · automatic');
  else if(entry.source==='discovery')label=ui('来源：品种解锁记录','Source: species discovery record');
  else if(entry.source==='calibration')label=ui('来源：已有成果补充同步','Source: earlier results synced later');
  else if(entry.observedAt)label=ui('来源：本机历史存档 · 实际生长日期待确认','Source: local historical save · growth date unconfirmed');
  else if(entry.source==='seed' && entry.at)label=ui('来源：项目创建记录','Source: project creation record');
  return label?`<small${entry.observedAt && !entry.at && !entry.achievedAt?` title="${ui('来自旧存档，不一定是最初长成的日期。','From an old save; may differ from the first growth date.')}"`:''}>${label}</small>`:'';
}


function progressJournalModal() {
  const project=activeProject(); if (!project) return;
  openModal(`<div class="modal__heading"><div><p class="eyebrow">PLANT JOURNAL</p><h2>生长记录</h2><p data-user-content>${escapeHtml(plantName(project))}</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <section class="journal-sync-note"><h3>${ui('自动同步','Automatic sync')}</h3><p>${ui('连接 Project Garden Sync 后，Codex 中记录的项目成果通常会自动更新到这株植物。同一项目下的对话共用这份生长记录。','Once Project Garden Sync is connected, project results recorded in Codex will usually update this plant automatically. Conversations in the same project share this growth journal.')}</p><span class="journal-sync-status">${icon('sync')} <span data-sync-status>正在连接本机同步</span></span></section>
    <h3 class="journal-section-title">已解锁的生长阶段</h3><div data-growth-journal="${escapeHtml(project.id)}">${growthTimelineMarkup(project)}</div>
    <details class="journal-fallback"><summary>有些已有成果还没显示？</summary><p>如果之前的成果没有同步记录，可以复制提示词到对应项目，让 Agent 确认后补充同步。</p><button type="button" class="text-button" data-action="sync-existing-progress">补充同步已有成果</button></details>
    <div class="modal__footer"><button type="button" class="text-button" data-action="refresh-sync">${icon('sync')} 检查更新</button><button type="button" class="button button--dark" data-action="close-modal">回到温室</button></div>`);
  void refreshSyncStatus();
}

function stageDateInstructions(project) {
  const labels=hasUnlockedPlant(project) ? plantDefinitionFor(project).stageLabels : ['幼株','扎根','抽枝','丰叶','初花','繁茂'];
  return ui(`\n\n还请补充 stage_dates 数组。只依据当前项目中你实际能访问的、有日期的成果记录；不可访问的历史不要假装读取。每项严格为 {"stage":0,"reached_at":null}。stage 是植物主体阶段的索引：${labels.map((label,i)=>`${i}=${label}`).join('，')}。0 对应首个可验证成果揭晓品种；1 对应首个结果稳定可用；2 完整原型；3 可用第一版；4 交付或实际使用验证；5 交付后多轮改进。仅返回不超过 growth_stage 的阶段；growth_stage=0 且没有可验证成果时返回空数组。只填有证据的最早达成日期，未知写 null，不按聊天长度或其他阶段推算。可以只写 YYYY-MM-DD；只有明确知道时分秒和时区才写 ISO 8601 时间（例如 YYYY-MM-DDTHH:mm:ss-04:00）。不要把本次同步时间当作历史时间，不要填未来日期。日期应按阶段先后排列，可同一天。禁止把对话内容、证据原文、项目名称、路径、链接或额外解释写进 JSON。\n示例字段："stage_dates": [{"stage":0,"reached_at":null},{"stage":1,"reached_at":null}]。`,
    `\n\nAlso return a stage_dates array using only dated result records you can actually access in this project. Do not pretend to read unavailable history. Each item must be {"stage":0,"reached_at":null}. Body-stage indices: 0 = first verifiable result/species discovery; 1 = a stable first result; 2 = complete prototype; 3 = usable first version; 4 = validated delivery or practical use; 5 = repeated improvements after delivery. Return stages no higher than growth_stage; if growth_stage=0 with no verifiable result, return an empty array. Use the earliest evidence-backed achievement date, or null if unknown. Never infer dates from conversation length or other stages. Use YYYY-MM-DD if only the day is known; use ISO 8601 with seconds and an explicit timezone only when known. Do not use the current sync time as a historical date; no future dates. Dates must follow stage order; the same day is allowed. Return no project content, evidence quotes, names, paths, links, or extra explanations. Example field: "stage_dates": [{"stage":0,"reached_at":null},{"stage":1,"reached_at":null}].`);
}

function syncExistingProgressModal() {
  const project = activeProject();
  if (!project) return;
  const code = uid('care').replace('_', '-').slice(0, 13).toUpperCase();
  state.eventCodes = state.eventCodes.filter((item) => dateFrom(item.expiresAt).getTime() > Date.now());
  state.eventCodes.push({ code, projectId: project.id, purpose: 'calibration', expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
  saveState();
  const schema=JSON.stringify({event_code:code,event_type:'calibration',growth_model:2,growth_stage:0,unlock_plant:false,project_created_at:null,stage_dates:[]},null,2);
  const creationInstructions=ui('\n\nproject_created_at 是 Codex 项目实际建立的日期，不是导入植物园、文件夹创建、首次成果或本次聊天的时间。只依据可访问的项目创建元数据；不能确认就返回 null，可用 YYYY-MM-DD 或带时区的 ISO 时间。阶段编号直接对应植物主体 0–5：0 幼株、1 扎根、2 抽枝、3 舒叶/丰叶、4 成丛/初花、5 新叶循环/繁茂。没有可验证成果时 growth_stage=0 且 unlock_plant=false 表示尚未揭晓品种的种子。阶段 0 和 1 的达成日期允许相同。', '\n\nproject_created_at is the actual Codex project creation date, not the garden import, directory creation, first result, or current conversation date. Use accessible creation metadata only; return null if unknown. Use YYYY-MM-DD or a timezone-qualified ISO timestamp. Body indices are exactly 0 seedling, 1 rooting, 2 branching, 3 leafing, 4 filling out/first flowers, 5 continued growth. With no verified result, growth_stage=0 and unlock_plant=false means an undiscovered seed. Stages 0 and 1 may share an achievement date.');
  const prompt=ui(`为当前 Codex 项目校准项目园。只根据可以可靠确认的已完成成果，选择最低足够的等级。不猜测，不引用、总结或泄露项目内容。只输出以下 JSON，保持字段名不变：\n\n${schema}\n\ngrowth_stage 为 0–5：\n0 只有想法，或没有可确认成果；\n1 第一个可运行、可点击或可验证结果；\n2 一段已经验证的完整原型；\n3 第一版可用结果；\n4 已实际交付或使用，并得到验证；\n5 在交付后又完成多轮经验证的改进。\n不要因一次完成或长对话直接给 5。只有 growth_stage > 0 时 unlock_plant 才为 true。不要包含项目名、文件名、链接、人名、代码、原文或总结。`,
    `Calibrate Project Garden for this Codex project using only reliably confirmed completed results. Choose the lowest sufficient level. Do not guess, quote, summarize, or reveal project content. Output only this JSON with unchanged keys:\n\n${schema}\n\ngrowth_stage must be 0–5:\n0: Idea only, or no verifiable result.\n1: First runnable, clickable, or validated result.\n2: A complete, verified prototype.\n3: A usable first version.\n4: Delivered or used in practice, with validation.\n5: Multiple verified improvement rounds after delivery.\nA single completion or a long conversation does not justify 5. unlock_plant is true only when growth_stage > 0. Include no project names, filenames, links, people, code, quotes, or summaries.`);
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">EXISTING PROGRESS · LOCAL ONLY</p><h2>同步已有成果</h2><p>提示词会请求成长阶段和有依据的达成日期；未知日期保留为空。只导入阶段与日期，不导入项目内容。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <p class="form-note">${ui('本次校准会对齐评估阶段，也可能修正之前偏高的显示。原始记录保留，之后的新进展从校准结果继续生长。','This assessment sets the current stage, including correcting an overgrown display. Original records are retained; later progress grows from this baseline.')}</p>
    <label class="prompt-label">第一步：复制提示词<textarea readonly id="agent-prompt">${escapeHtml(prompt + stageDateInstructions(project) + creationInstructions)}</textarea></label>
    <button type="button" class="button button--dark" data-action="copy-prompt">${icon('copy')} 复制校准提示词</button>
    <form id="import-form" class="form-stack sync-import-form">
      <label>第二步：粘贴 Agent 返回的 JSON<textarea name="payload" rows="5" placeholder='{"event_code":"CARE-...","event_type":"calibration","growth_stage":2,"unlock_plant":true}' required></textarea></label>
      <p class="form-note">阶段只会把植物推进到已确认的高度；它不会把项目名称、对话、文件或成果内容保存到项目园。</p>
      <div id="import-error" class="form-error" aria-live="polite"></div>
      <div class="modal__footer"><button type="button" class="text-button" data-action="show-progress-journal">返回生长记录</button><button type="submit" class="button button--accent">${icon('spark')} 校准植物阶段</button></div>
    </form>`);
}

function privacyModal() {
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">PRIVACY BY DEFAULT</p><h2>先保护，后连接。</h2></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="privacy-list"><div>${icon('lock')}<span><strong>项目资料本地保存</strong><small>名称、照料纪录与进展说明不经过网络。</small></span></div><div>${icon('spark')}<span><strong>Codex 只发送匿名标签</strong><small>本地工具只会传进展等级，或「想法 / 决定」两个类别、一次性编号和项目工作区的单向哈希；不会传项目标题、文件、代码、token 数或对话。</small></span></div><div>${icon('paw')}<span><strong>按项目而非 task 生长</strong><small>工作区哈希只用于把同一 Codex 项目的所有 task 送回同一株植物；Codex 不能读取或改动你已有项目。</small></span></div></div>
    <div class="modal__footer"><span></span><button type="button" class="button button--dark" data-action="close-modal">明白了</button></div>`);
}

function adoptActiveProject() {
  const project = activeProject();
  if (!project || project.syncProjectKey) return;
  state.pendingAdoptionProjectId = project.id;
  saveState();
  closeModal();
  showGrowthNotice('准备接入旧项目', '下一次来自一个新 Codex 项目的真实推进，会绑定到这株植物；不会读取它的名称或历史。');
}

function syncInfoModal() {
  const project = activeProject();
  const canAdopt = Boolean(project && !project.syncProjectKey);
  const waitingToAdopt = state.pendingAdoptionProjectId === project?.id;
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">CODEX · LOCAL SYNC</p><h2>同步说明</h2><p>一个 Codex 项目对应一株植物，项目下的对话会汇入同一份记录。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="sync-guide"><article>${icon('spark')}<div><strong>项目进展与生长</strong><p>启用 Project Garden Sync 后，Agent 会把已确认的成果记录为进展。植物根据这些记录逐步生长，通常会自动同步到园区。</p></div></article><article>${icon('leaf')}<div><strong>灵感与装饰</strong><p>Agent 记录的新想法会获得 1 点灵感，明确的决定会获得 2 点。灵感可以兑换花盆和园区装饰，每个项目每天最多获得 3 次奖励。</p></div></article><article>${icon('lock')}<div><strong>本地保存与更新</strong><p>园区和同步记录保存在这台电脑。植物园关闭期间收到的记录会暂存在本机，下次打开时继续更新。</p></div></article></div>
    <p class="sync-adoption-note">${canAdopt ? ui('手动添加的植物可以接入一个尚未绑定的 Codex 项目，接入后沿用现有的生长记录。','A manually added plant can be linked to an unbound Codex project while keeping its existing growth records.') : ui('同步传递的是匿名进展和灵感记录，项目对话、文件和代码不会随这些记录传入植物园。','Sync sends anonymous progress and inspiration events. Project conversations, files and code are not included.')}</p>
    <div class="modal__footer">${canAdopt ? `<button type="button" class="text-button" data-action="adopt-active-project" ${waitingToAdopt ? 'disabled' : ''}>${waitingToAdopt ? '已等待接入' : '接入当前旧项目'}</button>` : '<span></span>'}<button type="button" class="button button--dark" data-action="close-modal">明白了</button></div>`);
}

function decorationModal() {
  const slotNames = { pot: '花盆', shelf: '花架', prop: '前景摆件' };
  const groups = ['pot', 'shelf', 'prop'].map((slot) => {
    const cards = DECORATION_LIBRARY.filter((item) => item.slot === slot).map((item) => {
      const unlocked = state.decor.unlocked.includes(item.id);
      const active = (slot === 'pot' ? activeProject()?.potId : state.decor.active[slot]) === item.id;
      const canBuy = !item.pendingArt && (slot !== 'pot' || Boolean(activeProject())) && (unlocked || state.gardenDust >= item.cost);
      const label = item.pendingArt ? (unlocked ? '已解锁 · 待完善' : '素材待完善') : active ? '正在使用' : unlocked ? '换上它' : `用 ${item.cost} 灵感解锁`;
      const spriteIndex = DECORATION_LIBRARY.indexOf(item);
      return `<article class="decor-card ${active ? 'is-active' : ''}"><span class="decor-card__preview decor-card__preview--${item.id}" style="--item-x:${spriteIndex % 4 * 100 / 3}%;--item-y:${spriteIndex < 4 ? 0 : 100}%" aria-hidden="true"></span><span class="decor-card__copy"><strong>${item.name}</strong><small>${item.description}</small></span><span class="decor-card__actions">${['shelf','prop'].includes(slot)?`<button type="button" class="text-button" data-action="preview-decoration" data-decoration-id="${item.id}">${ui('预览','Preview')}</button>`:''}<button type="button" class="${active ? 'text-button' : 'button button--dark'}" data-action="activate-decoration" data-decoration-id="${item.id}" ${active || !canBuy ? 'disabled' : ''}>${label}</button></span></article>`;
    }).join('');
    return `<section class="decor-group"><p class="eyebrow">${slotNames[slot]}</p>${cards}</section>`;
  }).join('');
  openModal(`
    <div class="modal__heading"><div><p class="eyebrow">GARDEN SHOP</p><h2>装饰小铺</h2><p>挑一件喜欢的，换个园区心情。</p></div><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>
    <div class="insight-wallet"><span>${icon('spark')} <strong class="insight-balance-value">${state.gardenDust}</strong> 点灵感</span><button type="button" class="text-button" data-action="refresh-sync">${icon('sync')} 检查更新</button></div>
    <p class="decor-rule">新想法 +1 · 明确决定 +2。由 Agent 确认，每项目每天最多 3 次；普通进展和聊天次数不计分。</p>
    <p class="decor-scope">花盆只更换当前植物；已解锁的盆可重复使用。花架与前景摆件全园通用。</p>
    <p class="decor-target">${ui('当前植物','Current plant')}：<strong data-user-content>${escapeHtml(plantName(activeProject()) || ui('请先选择一株植物','Select a plant first'))}</strong></p>
    <div class="decor-grid">${groups}</div>
    <details class="insight-history"><summary>灵感收取记录</summary><div class="insight-ledger-list">${insightHistoryMarkup()}</div></details>
    <div class="modal__footer"><span></span><button type="button" class="button button--dark" data-action="close-modal">回到温室</button></div>`);
}

function recordActivity(projectId, title, type, at = new Date().toISOString(), extra = {}) {
  state.activities.unshift({ id: uid('activity'), projectId, title, type, at, ...extra });
  state.activities.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function insightHistoryMarkup() {
  const records = [...state.insightLedger].sort((a,b) => Date.parse(b.at)-Date.parse(a.at)).slice(0,12);
  return records.length ? records.map(entry => `<div class="insight-entry"><span><strong data-user-content>${escapeHtml(plantName(projectById(entry.projectId)) || '项目')}</strong><small>${entry.kind === 'decision' ? '明确决定' : '新想法'} · ${relativeTime(entry.at)}${entry.reward ? '' : ' · 当日额度已满'}</small></span><b>+${entry.reward}</b></div>`).join('') : '<p class="form-note">暂无已收取的想法或决定。Agent 需要使用 Project Garden 的灵感记录工具确认；仅聊天或完成代码不会自动加分。</p>';
}

function addInsight(projectId, kind, options = {}) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || !['idea', 'decision'].includes(kind)) return { accepted: false, error: 'The selected project is no longer available.' };
  const at = options.occurredAt && Number.isFinite(Date.parse(options.occurredAt)) ? options.occurredAt : new Date().toISOString();
  const eventId = options.eventId || uid('insight');
  if (state.insightLedger.some(entry => entry.eventId === eventId)) return { accepted: true, reward: 0, deduplicated: true, balance: state.gardenDust };
  const reward = insightCountOn(project.id, at) >= 3 ? 0 : kind === 'decision' ? 2 : 1;
  state.gardenDust += reward;
  state.insightLedger.push({ eventId, projectId, kind, reward, at });
  recordActivity(project.id, `${kind === 'decision' ? '确认一个决定' : '记录一个新想法'}${reward ? ` · 灵感 +${reward}` : ' · 今日额度已满'}`, 'insight', at, { eventId, reward });
  saveState();
  return { accepted: true, reward, balance: state.gardenDust };
}

function activateDecoration(id) {
  const item = decorationFor(id);
  if (!item || item.pendingArt) return;
  const project = activeProject();
  if (item.slot === 'pot' && !project) return;
  if ((item.slot === 'pot' ? project.potId : state.decor.active[item.slot]) === item.id) return;
  const unlocked = state.decor.unlocked.includes(item.id);
  if (!unlocked && state.gardenDust < item.cost) return;
  if (!unlocked) {
    state.gardenDust -= item.cost;
    state.decor.unlocked.push(item.id);
  }
  if (item.slot === 'pot') project.potId = item.id;
  else state.decor.active[item.slot] = item.id;
  decorPreview = null;
  if (project) recordActivity(project.id, `换上了${item.name}`, 'decor');
  saveState();
  closeModal();
  render();
  showGrowthNotice('温室换了新装饰', item.name);
}

function addProgress(projectId, title, size, unlockSpecies = false, occurredAt = new Date().toISOString()) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return false;
  const beforeArt=creatureArt(project);
  const receivedAt=new Date().toISOString();
  const scoreBefore=GardenGrowth.score(project);
  const values = { small: 1, medium: 2, large: 3 };
  const wasSeed = !hasUnlockedPlant(project) && !(ideaPoints(project) > 0);
  const growthBefore = growthPartsFor(project);
  const previousStage = hasUnlockedPlant(project) ? stageFor(project) : -1;
  GardenHistory.ensure(project, previousStage);
  project.points = (project.points || 0) + (values[size] || 1);
  // Delayed receipts preceding calibration are already represented by it.
  if (project.growthCalibration && Date.parse(occurredAt)<=Date.parse(project.growthCalibration.at)) project.growthCalibration.points += values[size] || 1;
  if (!project.lastProgressAt || Date.parse(occurredAt) > Date.parse(project.lastProgressAt)) project.lastProgressAt = occurredAt;
  const unlockedNow = Boolean((unlockSpecies || project.speciesPending) && state.habitat === 'garden' && !hasUnlockedPlant(project) && unlockPlantSpecies(project));
  if (wasSeed && !hasUnlockedPlant(project)) project.seedlingUnlockedAt ||= occurredAt;
  const nextStage=hasUnlockedPlant(project) ? stageFor(project) : -1;
  const stageChanged=nextStage>previousStage;
  const partsAfter=growthPartsFor(project);
  const organsChanged=JSON.stringify(growthBefore.map(p=>[p.number,p.phase]))!==JSON.stringify(partsAfter.map(p=>[p.number,p.phase]));
  const visualChanged=stageChanged || organsChanged || beforeArt!==creatureArt(project);
  const growthMoment = stageChanged ? ui(`长到了「${stageLabel(project)}」阶段。`,`Reached ${GardenI18n.translate(stageLabel(project))}.`) : organsChanged ? growthSummaryFor(project) : '';
  GardenHistory.advance(project, previousStage, nextStage, occurredAt, 'progress',receivedAt);
  recordActivity(project.id, unlockedNow ? `${title} · 揭晓了${plantDefinitionFor(project).name}` : title, 'progress', occurredAt,
    {recordedAt:receivedAt,growth:{model:2,beforeStage:previousStage,afterStage:nextStage,beforeScore:scoreBefore,afterScore:GardenGrowth.score(project)}});
  saveState();
  if(GardenGrowth.score(project)>scoreBefore || unlockedNow) GardenPresentation.queue(project.id,beforeArt,visualChanged);
  return { unlockedNow, growthMoment, stageChanged };
}

function calibrateExistingProgress(projectId, growthStage, options = {}) {
  const project = projectById(projectId);
  if (!project || !Number.isInteger(growthStage) || growthStage < 0 || growthStage > (options.growthModel === 2 ? 5 : 3)) return false;
  const targetScore = options.growthModel === 2 ? GardenGrowth.thresholds[growthStage] : [0, 6, 16, 32][growthStage];
  const targetPoints = Math.max(0, targetScore - (project.growthV2Offset || 0));
  const pointsBefore = Number(project.points) || 0;
  const growthBefore = growthPartsFor(project);
  const evidenceTime = typeof options.lastProgressAt === 'string' ? Date.parse(options.lastProgressAt) : NaN;
  if (options.lastProgressAt !== undefined && (!Number.isFinite(evidenceTime) || evidenceTime > Date.now())) return false;
  let stageDates;
  let projectCreatedAt;
  try {
    if (options.stageDates !== undefined && options.growthModel !== 2) throw new Error('Stage dates require growth model 2');
    stageDates=GardenHistory.prepareDates(project,options.stageDates,growthStage>0?growthStage:-1);
    projectCreatedAt=options.projectCreatedAt===undefined ? null : GardenHistory.normalizeDate(options.projectCreatedAt,Date.now());
  } catch {
    throw new Error(ui('阶段日期格式有误、晚于今天、顺序不符或与已有日期冲突。请让 Agent 核对日期；无法确认的时间填写 null。','Stage dates are invalid, in the future, out of order, or conflict with saved dates. Ask your agent to verify them and use null for unknown dates.'));
  }
  const progressAt = Number.isFinite(evidenceTime) ? new Date(evidenceTime).toISOString() : new Date().toISOString();
  const previousStage = hasUnlockedPlant(project) ? stageFor(project) : -1;
  GardenHistory.ensure(project, previousStage);
  const unlockedNow = Boolean(growthStage > 0 && state.habitat === 'garden' && !hasUnlockedPlant(project) && unlockPlantSpecies(project));
  const scoreBefore=GardenGrowth.score(project);
  if (options.growthModel===2) {
    const at=new Date().toISOString();
    project.growthCalibrations ||= [];
    project.growthCalibrations.push({at,stage:growthStage,previousScore:scoreBefore,previousCalibration:project.growthCalibration || null,previousUnlocks:structuredClone(project.growthUnlocks)});
    project.growthCalibration={at,stage:growthStage,score:targetScore,points:pointsBefore};
    project.speciesDormant=growthStage===0;
    if(project.speciesDormant)project.speciesPending=false;
    project.growthUnlocks=project.growthUnlocks.filter(entry=>entry.stage<=(growthStage>0?growthStage:-1));
  } else if (targetPoints > pointsBefore) {
    project.points = targetPoints;
  }
  if(projectCreatedAt) { project.gardenAddedAt ||= project.createdAt; project.projectCreatedAt=projectCreatedAt; project.projectCreatedAtSource='agent'; }
  const newerEvidence = growthStage > 0 && Number.isFinite(evidenceTime) && evidenceTime > (Date.parse(project.lastProgressAt) || 0);
  if (growthStage > 0 && (targetPoints > pointsBefore || newerEvidence)) {
    if (!project.lastProgressAt || Date.parse(progressAt) > Date.parse(project.lastProgressAt)) project.lastProgressAt = progressAt;
  }
  project.calibratedAt = new Date().toISOString();
  const calibratedStage=hasUnlockedPlant(project) ? stageFor(project) : -1;
  GardenHistory.advance(project, Math.min(previousStage,calibratedStage), calibratedStage, project.calibratedAt, 'calibration');
  const historyUpdated = GardenHistory.applyDates(project,stageDates,hasUnlockedPlant(project)?stageFor(project):-1);
  const growthMoment = growthMomentFor(project, growthBefore, growthPartsFor(project));
  const changed = GardenGrowth.score(project)!==scoreBefore || unlockedNow;
  if (changed || newerEvidence) recordActivity(project.id, `已根据已确认成果校准到第 ${growthStage} 阶段`, 'calibration', project.calibratedAt);
  saveState();
  return { changed, unlockedNow, growthMoment, growthStage, historyUpdated };
}

function submitNewProject(form) {
  const name = form.elements.name.value.trim();
  if (!name) return;
  const project = { id: uid('project'), speciesSeed: uid('species'), codexProjectId: null, syncProjectKey: null, name, kind: form.elements.kind.value, plantSpecies: null, points: 0, createdAt: new Date().toISOString(), lastCareAt: new Date().toISOString(), lastProgressAt: null };
  state.projects.push(project);
  state.selectedProjectId = project.id;
  recordActivity(project.id, '来到项目园', 'care');
  saveState();
  closeModal();
  render();
}

function submitProgress(form) {
  const projectId = form.elements.projectId.value;
  const project = state.projects.find((item) => item.id === projectId);
  const title = form.elements.title.value.trim();
  const size = form.elements.size.value;
  const outcome = title && addProgress(projectId, title, size, form.elements.unlockSpecies?.checked);
  if (!outcome) return;
  closeModal();
  render();
  if (outcome.unlockedNow) showMilestoneNotice(project);
  else if (outcome.growthMoment) showGrowthNotice('植物有了新变化', outcome.growthMoment);
}

function submitImport(form) {
  const error = form.querySelector('#import-error');
  try {
    const payload = JSON.parse(form.elements.payload.value);
    if (!payload || typeof payload.event_code !== 'string') throw new Error('格式不对。请只粘贴由项目园提示词生成的 JSON。');
    const event = state.eventCodes.find((item) => item.code === payload.event_code && dateFrom(item.expiresAt).getTime() > Date.now());
    if (!event) throw new Error('这个进展码不存在或已经失效。请重新生成一个。');
    let outcome;
    if (payload.event_type === 'progress' && ['small', 'medium', 'large'].includes(payload.size)) {
      outcome = addProgress(event.projectId, '从 Agent 导入了一次匿名进展', payload.size, payload.unlock_plant === true);
    } else if (payload.event_type === 'calibration' && event.purpose === 'calibration' && Number.isInteger(payload.growth_stage) && payload.growth_stage >= 0 && payload.growth_stage <= (payload.growth_model === 2 ? 5 : 3) && payload.unlock_plant === (payload.growth_stage > 0)) {
      outcome = calibrateExistingProgress(event.projectId, payload.growth_stage, { growthModel: payload.growth_model, stageDates: payload.stage_dates, projectCreatedAt:payload.project_created_at });
    } else {
      throw new Error('格式不对。请只粘贴由本次提示词生成的 JSON。');
    }
    if (!outcome) throw new Error('没有找到对应项目。');
    state.eventCodes = state.eventCodes.filter((item) => item.code !== event.code);
    saveState();
    closeModal();
    render();
    if (outcome.unlockedNow) showMilestoneNotice(projectById(event.projectId));
    else if (outcome.growthMoment) showGrowthNotice('植物有了新变化', outcome.growthMoment);
    else if (payload.event_type === 'calibration' && outcome.changed) showGrowthNotice('已有成果已同步', `植物已校准到第 ${outcome.growthStage} 阶段。`);
    else if (payload.event_type === 'calibration' && outcome.historyUpdated) showGrowthNotice(ui('阶段日期已补充','Stage dates added'),ui('已有生长进度保持不变。','Your existing growth is unchanged.'));
    else if (payload.event_type === 'calibration') showGrowthNotice(ui('同步完成','Sync complete'), ui('植物已与本次评估对齐。','The plant matches this assessment.'));
  } catch (problem) {
    error.textContent = problem.message || '无法导入这次进展。';
  }
}

async function refreshProjectCreationDates() {
  if(!window.projectGardenDesktop?.projectCreationDates)return;
  const dates=await window.projectGardenDesktop.projectCreationDates(state.projects.map(p=>p.codexProjectId).filter(Boolean));
  let changed=false;
  for(const entry of dates || []) {
    const p=state.projects.find(p=>p.codexProjectId===entry.codexProjectId);
    if(p && GardenHistory.validDate(entry.projectCreatedAt) && (!p.projectCreatedAt || p.projectCreatedAtSource==='codex-metadata')) {
      if(p.projectCreatedAt===entry.projectCreatedAt)continue;
      p.gardenAddedAt ||= p.createdAt;p.projectCreatedAt=entry.projectCreatedAt;p.projectCreatedAtSource='codex-metadata';changed=true;
    }
  }
  if(changed){saveState();render();}
}

function importCodexProjects(pending) {
  const entries = Array.isArray(pending?.projects) ? pending.projects : [];
  let added = 0;
  let updated = 0;
  for (const item of entries) {
    const codexProjectId = typeof item?.codexProjectId === 'string' ? item.codexProjectId.slice(0, 128) : '';
    const name = typeof item?.name === 'string' ? item.name.trim().slice(0, 48) : '';
    const syncProjectKey = typeof item?.syncProjectKey === 'string' ? item.syncProjectKey.slice(0, 128) : null;
    const projectKind = item?.projectKind === 'chatgpt' ? 'chatgpt' : 'local';
    let projectCreatedAt=null;
    try { if(item.projectCreatedAt) projectCreatedAt=GardenHistory.normalizeDate(item.projectCreatedAt,Date.now()); } catch { /* Unknown metadata stays unknown. */ }
    if (!codexProjectId || !name) continue;
    const existing = state.projects.find((project) => project.codexProjectId === codexProjectId || (syncProjectKey && project.syncProjectKey === syncProjectKey));
    if (existing) {
      existing.codexProjectId = codexProjectId;
      existing.name = name;
      existing.projectKind = projectKind;
      if (syncProjectKey) existing.syncProjectKey = syncProjectKey;
      if(projectCreatedAt && !existing.projectCreatedAt) { existing.projectCreatedAt=projectCreatedAt; existing.gardenAddedAt ||= existing.createdAt; }
      updated += 1;
      continue;
    }
    const project = {
      id: uid('project'),
      speciesSeed: uid('species'),
      codexProjectId,
      syncProjectKey,
      projectKind,
      name,
      kind: 'codex-project',
      plantSpecies: null,
      points: 0,
      projectCreatedAt,
      gardenAddedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      lastCareAt: new Date().toISOString(),
      lastProgressAt: null,
    };
    state.projects.push(project);
    recordActivity(project.id, '从 Codex 项目列表来到温室', 'care');
    added += 1;
  }
  if (added || updated) {
    if (!state.selectedProjectId) state.selectedProjectId = state.projects[0]?.id || null;
    saveState();
    render();
    void refreshProjectCreationDates().catch(()=>{});
  }
  return { added, updated };
}

async function consumePendingCodexProjectImport() {
  const pending = await window.projectGardenDesktop?.getPendingProjectImport?.();
  if (!pending?.importId || !Array.isArray(pending.projects)) return;
  const result = importCodexProjects(pending);
  window.projectGardenDesktop?.confirmProjectImport?.({ importId: pending.importId, ...result });
  if (result.added) showGrowthNotice('Codex 项目已来到温室', `已导入 ${result.added} 个项目；之后同一项目里的 task 会养同一株植物。`);
}

function projectForAgentEvent(event, createIfMissing = false) {
  const projectKey = typeof event?.projectKey === 'string' && event.projectKey.length ? event.projectKey : null;
  if (!projectKey) {
    // Older already-open Codex tasks can still have the pre-project-key MCP
    // tool loaded. That tool supplies only this Electron-local opaque plant
    // ID, never a title or project content. Keep it as a one-way compatibility
    // path so a live task is not silently dropped during the upgrade. Fresh
    // tasks always use the projectKey branch below.
    const legacyProjectId = typeof event?.projectId === 'string' ? event.projectId : null;
    return { project: projectById(legacyProjectId), autoCreated: false, legacy: true };
  }

  const existing = state.projects.find((project) => project.syncProjectKey === projectKey);
  if (existing) return { project: existing, autoCreated: false };

  // Legacy/manual projects predate anonymous project keys. They can only be
  // connected by an explicit one-time user choice; we never guess from titles
  // or scan Codex history to make that match.
  const adoption = state.projects.find((project) => project.id === state.pendingAdoptionProjectId && !project.syncProjectKey);
  if (adoption) {
    adoption.syncProjectKey = projectKey;
    state.pendingAdoptionProjectId = null;
    state.selectedProjectId = adoption.id;
    recordActivity(adoption.id, '已接入一个新的 Codex 项目', 'care');
    return { project: adoption, autoCreated: false, adopted: true };
  }
  if (state.pendingAdoptionProjectId) state.pendingAdoptionProjectId = null;
  if (!createIfMissing || state.autoCreate === false) return { project: null, autoCreated: false };

  const ordinal = state.projects.filter((project) => project.syncProjectKey).length + 1;
  const project = {
    id: uid('project'),
    speciesSeed: uid('species'),
    codexProjectId: null,
    syncProjectKey: projectKey,
    name: `未命名 Codex 项目 ${String(ordinal).padStart(2, '0')}`,
    kind: 'codex-project',
    plantSpecies: null,
    points: 0,
    createdAt: new Date().toISOString(),
    lastCareAt: new Date().toISOString(),
    lastProgressAt: null,
  };
  state.projects.push(project);
  state.selectedProjectId = project.id;
  recordActivity(project.id, '一个未导入的 Codex 项目第一次推进，自动种下了一颗种子', 'care');
  return { project, autoCreated: true, adopted: false };
}

function applyAgentProgress(progress) {
  if (state.appliedAgentEventIds.includes(progress?.eventId)) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: progress.eventId, accepted: true });
    return { deduplicated: true };
  }
  if (progress?.type === 'reflection') return applyAgentInsight(progress);
  const resolved = projectForAgentEvent(progress, true);
  const project = resolved.project;
  const size = progress?.level === 'milestone' ? 'large' : progress?.level;
  if (!project || !['small', 'medium', 'large'].includes(size)) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: progress?.eventId, accepted: false, error: 'This Codex project has no local Project Garden plant yet.' });
    return;
  }

  const title = size === 'large' ? 'Codex 记录了一次匿名里程碑' : 'Codex 记录了一次匿名进展';
  state.appliedAgentEventIds.push(progress.eventId);
  const outcome = addProgress(project.id, title, size, Boolean(progress.unlockPlant), progress.occurredAt || new Date().toISOString());
  if (!outcome) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: progress.eventId, accepted: false, error: 'The selected project is no longer available.' });
    return;
  }

  render();
  if (outcome.unlockedNow) showMilestoneNotice(project);
  else if (resolved.adopted) showGrowthNotice('旧项目已接入 Codex', '这次真实推进和之后来自这个项目的进展都会回到这株植物。');
  else if (resolved.autoCreated) showGrowthNotice('新的 Codex 项目来到温室', '这个未导入项目第一次推进已经种下种子；之后会回到同一株植物。');
  else if (resolved.legacy) showGrowthNotice('Codex 记录了一步进展', '这个已经打开的旧对话通过本机兼容通道回到了当前植物。');
  else if (outcome.growthMoment) showGrowthNotice('Codex 记录了一步进展', outcome.growthMoment);
  else showGrowthNotice('Codex 记录了一步进展', '它已经被安静地记在这株植物身上。');
  window.projectGardenDesktop?.confirmAgentProgress({ eventId: progress.eventId, accepted: true, autoCreated: resolved.autoCreated, adopted: Boolean(resolved.adopted) });
}

function applyAgentInsight(insight) {
  if (state.appliedAgentEventIds.includes(insight?.eventId)) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: insight.eventId, accepted: true });
    return { deduplicated: true };
  }
  const project = projectForAgentEvent(insight, false).project;
  if (!project) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: insight?.eventId, accepted: false, error: 'Record one real progress event for this Codex project before awarding an insight.' });
    return;
  }
  const outcome = addInsight(project.id, insight.reflectionKind, insight);
  if (!outcome.accepted) {
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: insight.eventId, accepted: false, error: outcome.error });
    return;
  }
  state.appliedAgentEventIds.push(insight.eventId);
  saveState();
  render();
  if (outcome.reward) showGrowthNotice(`灵感 +${outcome.reward}`, '已保存到装饰小铺。');
  const balance = modalRoot.querySelector('.insight-balance-value');
  if (balance) balance.textContent = state.gardenDust;
  const history = modalRoot.querySelector('.insight-ledger-list');
  if (history) history.innerHTML = insightHistoryMarkup();
  window.projectGardenDesktop?.confirmAgentProgress({ eventId: insight.eventId, accepted: true });
}

async function copyPrompt() {
  const text = modalRoot.querySelector('#agent-prompt')?.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = modalRoot.querySelector('#agent-prompt');
    area.select();
    document.execCommand('copy');
  }
  const button = modalRoot.querySelector('[data-action="copy-prompt"]');
  if (button) {
    button.innerHTML = '已复制';
    setTimeout(() => { button.innerHTML = `${icon('copy')} 复制提示词`; }, 1600);
  }
}

app.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-action]');
  if (!control) return;
  const { action } = control.dataset;
  if (action === 'reload-garden') location.reload();
  if (action === 'toggle-language') { state.language = state.language === 'en' ? 'zh' : 'en'; saveState(); render(); }
  if (action === 'toggle-startup') void toggleStartupPreference();
  if (action === 'show-startup-help') startupHelpModal();
  if (action === 'dismiss-storage-notice') { storageNotice = ''; render(); }
  if (action === 'garden-home') { closeModal(); render(); }
  if (action === 'refresh-sync') await refreshSync();
  if (action === 'choose-habitat') chooseHabitat(control.dataset.habitat);
  if (action === 'new-project') newProjectModal();
  if (action === 'select-project') { state.selectedProjectId = control.dataset.projectId; saveState(); render(); }
  if (action === 'set-difficulty') { state.difficulty = control.dataset.difficulty; saveState(); render(); }
  if (action === 'record-progress') progressModal();
  if (action === 'sync-existing-progress') syncExistingProgressModal();
  if (action === 'show-progress-journal') progressJournalModal();
  if (action === 'care') {
    const project = activeProject();
    if (!project) return;
    project.lastCareAt = new Date().toISOString();
    recordActivity(project.id, state.habitat === 'garden' ? '得到一点水和阳光' : '被陪伴了一会儿', 'care');
    saveState();
    render();
    showCareFeedback(project.id);
  }
  if (action === 'create-code') promptModal();
  if (action === 'import-event') importModal();
  if (action === 'show-privacy') privacyModal();
  if (action === 'show-sync-info') syncInfoModal();
  if (action === 'show-removed-projects') removedProjectsModal();
  if (action === 'adopt-active-project') adoptActiveProject();
  if (action === 'show-decor') decorationModal();
  if (action === 'show-activity-history') activityHistoryModal(control.dataset.projectId);
  if (action === 'rename-plant') renamePlantModal(control.dataset.projectId);
  if (action === 'end-decor-preview') { decorPreview=null; render(); }
  if (action === 'toggle-compact') await window.projectGardenDesktop?.toggleCompact();
  if (action === 'pet-menu') showPetMenu();
  if (action === 'show-habitat-picker') habitatPickerModal();
  if (action === 'copy-prompt') await copyPrompt();
});

app.addEventListener('contextmenu', (event) => {
  if (isCompact) { event.preventDefault(); showPetMenu(); return; }
  const projectRow = event.target.closest('.project-row[data-project-id]');
  if (!projectRow) return;
  event.preventDefault();
  openProjectContextMenu(projectRow.dataset.projectId, event.clientX, event.clientY);
});

modalRoot.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-startup"]')) { closeModal(); void refreshStartupControl(true); return; }
  const control = event.target.closest('[data-action]');
  if (control?.dataset.action === 'show-progress-journal') progressJournalModal();
  if (control?.dataset.action === 'edit-journal-date') stageDateEditor(control);
  if (control?.dataset.action === 'cancel-date-edit') { const key=control.closest('form').dataset.stage; control.closest('form').remove(); render(); focusJournalDate(key); }
  if (control?.dataset.action === 'rename-plant') renamePlantModal(control.dataset.projectId);
  if (control?.dataset.action === 'preview-decoration') previewDecoration(control.dataset.decorationId);
  if (control?.dataset.action === 'sync-existing-progress') syncExistingProgressModal();
  if (control?.dataset.action === 'open-manual-progress') progressModal();
  if (control?.dataset.action === 'copy-prompt') void copyPrompt();
  const isBackdropClick = control?.classList.contains('modal-backdrop') && event.target === control;
  if (control?.dataset.action === 'close-modal' && (isBackdropClick || !control.classList.contains('modal-backdrop'))) closeModal();
  if (control?.dataset.action === 'activate-decoration') activateDecoration(control.dataset.decorationId);
  if (control?.dataset.action === 'choose-habitat') chooseHabitat(control.dataset.habitat);
  if (control?.dataset.action === 'adopt-active-project') adoptActiveProject();
  if (control?.dataset.action === 'request-remove-project') requestRemoveProject(control.dataset.projectId);
  if (control?.dataset.action === 'hide-project') hideProject(control.dataset.projectId);
  if (control?.dataset.action === 'restore-project') restoreProject(control.dataset.projectId);
  if (control?.dataset.action === 'refresh-sync') void refreshSync();
});

modalRoot.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target.id === 'new-project-form') submitNewProject(event.target);
  if (event.target.id === 'progress-form') submitProgress(event.target);
  if (event.target.id === 'import-form') submitImport(event.target);
  if (event.target.id === 'journal-date-form') submitJournalDate(event.target);
  if (event.target.id === 'rename-plant-form') submitPlantName(event.target);
});

window.projectGardenDesktop?.onAgentProgress((event) => {
  try { applyAgentProgress(event); }
  catch(error) {
    state = loadState();
    render();
    window.projectGardenDesktop?.confirmAgentProgress({ eventId: event?.eventId, accepted: false, error: error.message || '保存未完成，事件将保留等待重试。' });
  }
});
window.projectGardenDesktop?.onPetProjectSelected?.((id) => {
  const project = projectById(id);
  if (!project || isProjectHidden(project)) return;
  state.selectedProjectId = id;
  saveState();
  render();
});

let petPointer = null;
let petIgnoresMouse = false;
app.addEventListener('pointerdown', (event) => {
  const plant = event.target.closest('.floating-pet__plant');
  if (!isCompact || !plant || event.button !== 0) return;
  petPointer = event.pointerId;
  plant.setPointerCapture(event.pointerId);
  window.projectGardenDesktop?.dragPet({ phase: 'start', x: event.screenX, y: event.screenY });
});
document.addEventListener('pointermove', (event) => {
  if (!isCompact) return;
  if (petPointer !== null) window.projectGardenDesktop?.dragPet({ phase: 'move', x: event.screenX, y: event.screenY });
});
// Electron's Windows click-through forwarding explicitly forwards mousemove.
document.addEventListener('mousemove', (event) => {
  if (!isCompact) return;
  const ignore = petPointer === null && !event.target.closest('.floating-pet__plant, .floating-pet__menu');
  if (ignore !== petIgnoresMouse) {
    petIgnoresMouse = ignore;
    window.projectGardenDesktop?.ignorePetMouse(ignore);
  }
});
function endPetDrag() {
  if (petPointer === null) return;
  petPointer = null;
  window.projectGardenDesktop?.dragPet({ phase: 'end' });
}
document.addEventListener('pointerup', endPetDrag);
document.addEventListener('pointercancel', endPetDrag);
document.addEventListener('lostpointercapture', endPetDrag, true);
window.addEventListener('blur', endPetDrag);
app.addEventListener('dblclick', (event) => {
  if (isCompact && event.target.closest('.floating-pet__plant')) void window.projectGardenDesktop?.toggleCompact();
});
app.addEventListener('keydown', (event) => {
  if (!isCompact) return;
  if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') || (event.key === 'Enter' && event.target.closest('.floating-pet__plant'))) { event.preventDefault(); showPetMenu(); }
  const directions = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
  if (directions[event.key] && event.target.closest('.floating-pet__plant')) {
    event.preventDefault();
    const [x, y] = directions[event.key];
    window.projectGardenDesktop?.nudgePet({ x, y });
  }
});

window.addEventListener('resize', () => {
  window.requestAnimationFrame(alignShelfPotsToArtwork);
});

// A user-authorized Codex project list is staged by the local Electron bridge.
// It is consumed once, deduplicated by Codex project ID, then cleared.

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot.children.length) { event.preventDefault(); closeModal(); }
  if (event.key === 'Tab' && modalRoot.children.length) {
    const controls = [...modalRoot.querySelectorAll('button:not(:disabled), input, textarea, [tabindex="0"]')].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

function showCareFeedback(projectId) {
  const plant = [...app.querySelectorAll('.front-plant, .shelf-plant')].find((element) => element.dataset.projectId === projectId);
  const target = plant?.querySelector('.creature__art, .shelf-project-pot') || app.querySelector('.desk-widget__art, .console-project__sprite');
  if (target) {
    const particles = document.createElement('span');
    particles.className = 'care-particles';
    particles.setAttribute('aria-hidden', 'true');
    particles.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    target.append(particles);
    particles.addEventListener('animationend', () => particles.remove(), { once: true });
  }
  const button = app.querySelector('[data-action="care"]');
  if (button) {
    button.classList.add('is-cared');
    button.innerHTML = `${icon('leaf')} ${state.habitat === 'garden' ? '已浇水' : '陪伴了一会儿'}`;
    button.setAttribute('aria-live', 'polite');
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.classList.remove('is-cared');
      button.innerHTML = `${state.habitat === 'garden' ? icon('leaf') : icon('paw')} ${state.habitat === 'garden' ? '浇一点水' : '陪一会儿'}`;
    }, 2000);
  }
}

if (!storageBlocked) {
  PLANT_LIBRARY.forEach(definition => { definition.stageLabels = GardenGrowth.flowering.includes(definition.id) ? ['幼株','扎根','抽枝','丰叶','初花','繁茂'] : ['幼株','扎根','抽枝','舒叶','成丛','新叶循环']; });
  if (state.growthModelVersion !== 2) { GardenGrowth.migrate(state.projects); state.growthModelVersion = 2; }
  migrateSpeciesVariety();
  migrateIndividualPots();
  saveState();
  void consumePendingCodexProjectImport().catch(() => { storageNotice = '项目导入等待重试，已保存的植物不受影响。'; render(); });
  void refreshProjectCreationDates().catch(()=>{});
  setInterval(() => { void refreshSyncStatus(); }, 5000);
}
render();
// Translate newly arriving UI messages as well as the initial render. Stored
// project names and activity text are excluded via data-user-content.
let translationQueued = false;
new MutationObserver(() => {
  if (translationQueued) return;
  translationQueued = true;
  queueMicrotask(() => { translationQueued = false; localizeUI(); });
}).observe(document.body, { childList: true, subtree: true, characterData: true });
