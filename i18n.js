/* Local UI translation only. Project names, notes and protocol keys are never translated. */
(function(root) {
  const en = {
    '在右下角摆上装满种子包的木箱。':'Place a wooden crate of seed packets in the lower-right corner.',
    '在左下方的土盆中添一把园艺小铲。':'Add a garden trowel to the soil bed in the lower-left corner.',
    '检查更新':'Check for updates',
    '提示词会请求成长阶段和有依据的达成日期；未知日期保留为空。只导入阶段与日期，不导入项目内容。':'The prompt asks for a growth stage and evidence-backed achievement dates, leaving unknown dates empty. Only stages and dates are imported, not project content.',
    '主景：近 21 天最常推进的 4 个':'Featured: 4 most active projects in 21 days',
    '生长记录':'Growth journal',
    '自动同步':'Automatic sync',
    '连接 Project Garden Sync 后，Codex 中记录的项目成果通常会自动更新到这株植物。同一项目下的对话共用这份生长记录。':'With Project Garden Sync connected, progress recorded in Codex usually updates this plant automatically. Conversations in the same project share this growth journal.',
    '已解锁的生长阶段':'Growth discovered so far',
    '有些已有成果还没显示？':'Missing some earlier progress?',
    '如果之前的成果没有同步记录，可以复制提示词到对应项目，让 Agent 确认后补充同步。':'If earlier results have no sync record, copy a prompt into the corresponding project so your agent can confirm and sync them.',
    '补充同步已有成果':'Sync earlier progress',
    '返回生长记录':'Back to growth journal',
    '一个 Codex 项目对应一株植物，项目下的对话会汇入同一份记录。':'Each Codex project has one plant. Its conversations contribute to the same record.',
    '项目进展与生长':'Project progress and growth',
    '启用 Project Garden Sync 后，Agent 会把已确认的成果记录为进展。植物根据这些记录逐步生长，通常会自动同步到园区。':'With Project Garden Sync enabled, your agent records confirmed results as progress. These records gradually grow your plant and usually sync automatically.',
    '灵感与装饰':'Inspiration and decorations',
    'Agent 记录的新想法会获得 1 点灵感，明确的决定会获得 2 点。灵感可以兑换花盆和园区装饰，每个项目每天最多获得 3 次奖励。':'New ideas recorded by your agent earn 1 inspiration; clear decisions earn 2. Inspiration unlocks pots and garden decorations, with up to 3 rewards per project each day.',
    '本地保存与更新':'Local storage and updates',
    '园区和同步记录保存在这台电脑。植物园关闭期间收到的记录会暂存在本机，下次打开时继续更新。':'Your garden and sync records are saved on this computer. Records received while the garden is closed are stored locally and applied the next time it opens.',
    '上次推进：':'Last progress: ', '前景摆件':'Garden objects', '明白了':'Got it', '需要一点照料':'Needs some care',
    '名称、照料纪录与进展说明不经过网络。':'Names, care records and progress notes never leave this computer.',
    'Codex 只发送匿名标签':'Codex sends anonymous labels only',
    '本地工具只会传进展等级，或「想法 / 决定」两个类别、一次性编号和项目工作区的单向哈希；不会传项目标题、文件、代码、token 数或对话。':'The local tool sends a progress level or an idea/decision category, a one-time ID and a one-way workspace hash. It sends no titles, files, code, token counts or conversations.',
    '按项目而非 task 生长':'One plant per project, not per task',
    '工作区哈希只用于把同一 Codex 项目的所有 task 送回同一株植物；Codex 不能读取或改动你已有项目。':'The workspace hash routes every task in a Codex project to the same plant. The bridge cannot read or edit your project content.',
    '让项目进展自己回到花园。':'Let your progress find its way to the garden.',
    '已导入的 Codex 项目会自动对应同一株植物；无需在每个 task 里重复选择。':'Imported Codex projects automatically map to their plants. There is no need to choose again in each task.',
    '真的完成，才会生长':'Completed work grows your plant',
    '小步、阶段、里程碑由 Codex 根据完成度判断；不会按 token、消息数或聊天长度升级。':'Codex records completed actions, coherent work and milestones. Tokens, message counts and conversation length do not level up a plant.',
    '想法只换装饰':'Ideas earn decorations',
    '新方向给 1 点灵感，解决真实取舍的决定给 2 点；它们不会冒充项目进展。':'A new direction earns 1 inspiration; a decision resolving a real choice earns 2. Neither counts as completed work.',
    '离线也会回来':'Offline updates are queued',
    '桌面程序关闭时，匿名事件先留在本机队列；下次打开项目园才逐条应用。':'When the app is closed, anonymous events wait in a local queue and are applied when you next open the garden.',
    '已导入或已绑定的项目会继续接收来自同一 Codex 项目的进展；本机队列不会上传项目名、对话、文件或代码。':'Imported or linked plants keep receiving progress from the same Codex project. The local queue uploads no names, conversations, files or code.',
    '接入当前旧项目':'Link this existing plant','已等待接入':'Waiting to link',
    '格式不对。请只粘贴由项目园提示词生成的 JSON。':'Invalid format. Paste only JSON produced using the garden prompt.',
    '这个进展码不存在或已经失效。请重新生成一个。':'This code is missing or expired. Generate a new prompt.',
    '格式不对。请只粘贴由本次提示词生成的 JSON。':'Invalid format. Paste only JSON produced using this prompt.',
    '没有找到对应项目。':'The corresponding project was not found.','无法导入这次进展。':'This update could not be imported.',
    '植物有了新变化':'Your plant has grown','已有成果已同步':'Existing progress synced','无需调整':'No change needed',
    '已确认的阶段没有比当前植物更高。':'The confirmed level is not higher than your plant’s current progress.',
    '项目园':'Project Garden','植物园':'Garden','植物册':'Plants','我的植物园':'My garden','欢迎来到项目园':'Welcome to your garden',
    '回到植物园':'Back to garden','回到温室':'Back to garden','桌面植物':'Desktop plant','轻松':'Gentle','普通':'Standard','状态难度':'Care mode',
    '灵感':'Inspiration','自动保存':'Autosaved','网页预览':'Web preview','每次变化自动保存':'Every change is saved automatically',
    '正在照料的项目':'Projects in your garden','手动新增项目（可选）':'Add a local project (optional)','前排近期项目':'Recently active projects','后层项目架':'Project shelves','植物园全景':'Garden panorama',
    '前排：近 21 天最常推进的 3 个':'Front row: 3 most active projects in 21 days','暂时没有展示中的植物':'No plants on display',
    '项目有进展，植物就生长。':'Real progress grows your plants.','隐私说明':'Privacy','记录保存在本机，重启后自动恢复。':'Saved on this computer. Restored when you return.',
    '这是独立网页预览，不读取桌面存档。请从桌面「Project Garden」打开正式园区。':'This web preview has separate storage. Open the desktop Project Garden for your saved plants.',
    '项目暂时都移出花园了。':'All projects are currently hidden.','它们仍会继续接收 Codex 进展。':'They still receive Codex progress.',
    '还没有项目。':'No projects yet.','第一次真实推进会自动种下种子。':'Your first verified progress plants a seed.',
    '所有项目暂时都被移出花园了。':'All projects are currently hidden.','它们的记录还在，也会继续同步进展。':'Their records are safe and still sync.',
    '查看已移出的项目':'View hidden projects','等待第一条项目记录':'Waiting for your first project update',
    '在 Codex 里继续项目。收到成果记录后，这里会出现对应的植物。':'Continue a project in Codex. Its plant appears here after a confirmed progress update.',
    '当前项目操作':'Selected project actions','成果已保留':'Progress preserved','等待第一份成果':'Waiting for a first result',
    '现有品种均已使用；扩充素材后自动揭晓，进度继续累计':'All species are assigned. Progress is saved while this plant awaits a new species.',
    '首个可验证成果，让真实品种揭晓':'A first verified result reveals the species','同步已有成果':'Sync existing progress','手动记录':'Log progress','浇一点水':'Water',
    '正在连接本机同步':'Connecting to local sync','成果更新植物 · 想法与决定获得灵感':'Progress grows plants · Ideas and decisions earn inspiration',
    '收取记录':'Check for updates','同步说明':'Sync guide','从你正在做的项目开始':'Start with a project you are working on',
    '连接 Project Garden Sync 后，Codex 确认的成果会自动更新植物。':'Connect Project Garden Sync to grow plants from results confirmed in Codex.',
    '查看同步说明':'How syncing works','添加本地项目':'Add local project','桌面漂浮植物':'Floating desktop plant','植物菜单':'Plant menu',
    '还没有展示中的项目':'No visible projects','右键展开项目园':'Right-click to open the garden','拖动移动 · 右键菜单':'Drag to move · Right-click for menu',
    '今天':'Today','昨天':'Yesterday','刚刚':'Just now','尚无真实推进':'No progress yet','安稳':'Settled','精神饱满':'Thriving','叶片微垂':'Slightly drooping','叶缘泛黄':'Yellowing edges','暂时休眠':'Resting',
    '未鉴定幼苗':'Unidentified seedling','想法种子':'Idea seed','成果已记录 · 品种待扩充':'Progress saved · Awaiting a new species',
    '花盆只更换当前植物；已解锁的盆可重复使用。花架与前景摆件全园通用。':'Pots apply only to the selected plant. Unlocked styles are reusable; shelves and props apply to the whole garden.',
    '已有成果，等待新增品种':'Progress saved; awaiting a new species','未鉴定项目幼苗':'Unidentified project seedling',
    '旱金莲':'Nasturtium','非洲堇':'African violet','龟背竹':'Monstera','十二卷':'Zebra haworthia','蝴蝶兰':'Moth orchid','鸟巢蕨':'Bird’s nest fern','球兰':'Hoya','圆叶竹芋':'Calathea orbifolia','白掌':'Peace lily','绣球':'Hydrangea','红掌':'Anthurium',
    '后层项目':'Shelf project','型项目植物':' project plant','已移出但仍同步':'Hidden, still syncing',
    '还没有记录。完成一点再回来，它会记得。':'No updates yet. Your next completed step will appear here.',
    '园区存档需要恢复':'Your garden needs recovery','请保留本机的 garden-state.json 和备份文件。':'Keep garden-state.json and its backup on this computer.',
    '重新读取':'Retry loading','知道了':'Got it','已从本机备份恢复园区。':'Garden restored from the local backup.',
    '存档暂时无法读取。原文件已保留，不会用空园区覆盖。':'The save cannot be read. Your original files are preserved and will not be replaced by an empty garden.',
    '存档读取失败，未创建新园区或覆盖旧记录。':'Loading failed. No new garden was created and no records were overwritten.',
    '保存没有完成，请保留窗口并重试。':'Saving did not finish. Keep this window open and try again.',
    '网页预览 · 请在桌面版接收记录':'Web preview · Receive updates in the desktop app','本机同步已连接':'Local sync connected','等待本机同步连接':'Waiting for local sync',
    '同步暂未连接 · 记录仍保存在本机':'Sync disconnected · Records remain saved locally','请在桌面版收取同步记录。':'Use the desktop app to receive updates.',
    '还有记录等待处理':'Some updates are still pending','记录已收取':'Updates received','未能处理的记录仍保留在本机队列。':'Pending updates remain in the local queue.',
    '园区与灵感已更新到本机已收到的最新记录。':'Your garden and inspiration reflect all updates received on this computer.','暂时无法收取':'Could not receive updates',
    '实质里程碑已记录':'Milestone recorded','温室换了新装饰':'Decoration updated','已保存到装饰小铺。':'Saved to your inspiration balance.',
    '项目园对话框':'Project Garden dialog','关闭':'Close','取消':'Cancel','返回':'Back','稍后再说':'Not now','确认移出':'Hide project','从花园移出':'Hide from garden',
    '不会影响原 Codex 项目':'Your Codex project is unaffected','它会从植物册与温室消失，但不会删除你的 Codex 项目或本机进展记录。':'This hides the plant from the garden, without deleting the Codex project or any progress.',
    '之后它仍会收到来自同一 Codex 项目的真实进展；你也可以从「已移出」列表让它回到花园。':'It will still receive progress. Restore it any time from Hidden projects.',
    '已移出的项目':'Hidden projects','移出只整理花园；这些项目仍会接收来自同一 Codex 项目的真实进展。':'Hiding only tidies your garden. These projects still receive their Codex updates.',
    '带回花园':'Restore','现在没有已移出的项目。':'No hidden projects.',
    '手动给一个项目安个家':'Add a local project','正常情况下不用填：Codex 的第一次真实推进会自动种下项目。这是离线或自用项目的备用入口。':'Usually you do not need this: confirmed Codex progress creates a plant automatically. Use this for offline or personal projects.',
    '项目名称':'Project name','例如：做第一版小游戏':'e.g. Build my first game','它今天最像什么？':'What kind of project is it?',
    '小小开始':'A small start','慢慢长大':'Grow at your own pace','一段探索':'An exploration','边做边发现':'Learn by making','一个作品':'Something to make','做出看得见的东西':'Build something tangible',
    '先不建了':'Cancel','带它回家':'Plant project','这次推进了什么？':'What moved forward?','记录一个真实、具体的动作就好。':'Record one concrete, completed step.',
    '给这次进展起个短名字':'A short title for this update','例如：画完主界面草图':'e.g. Finished the home-screen sketch','它大概有多大？':'How significant was this step?',
    '小步':'Small step','完成一个明确行动':'One clear action completed','一段':'A chunk of work','完成一个小阶段':'A coherent piece completed','重要一步':'Milestone','完成一个里程碑':'A meaningful result delivered',
    '这次有了可展示的第一版吗？':'Is this your first verifiable result?','揭晓这颗种子的真实植物':'Reveal this plant’s species',
    '真实品种在本地种下项目时已经决定；只在做出可运行的第一版、可点击 prototype 或首次验证结果时揭晓。普通整理和小修改不用勾选。':'Reveal the species only for a first runnable version, clickable prototype, or validated result—not routine edits or planning.',
    '这里的文字只保存在你的电脑，不会发给任何 Agent 或服务器。':'This text stays on your computer. It is not sent to an agent or server.','让它生长':'Save progress',
    '匿名进展码已生成':'Anonymous progress code ready','复制给你正在使用的 Agent':'Copy this into your agent',
    '这段文字不含你的项目标题或内容。Agent 返回时也只能给出进展大小。':'No project title or content is included. The agent returns only a progress level.',
    '复制提示词':'Copy prompt','复制校准提示词':'Copy calibration prompt','已复制':'Copied','导入匿名进展':'Import anonymous progress',
    '原始 JSON 只在这次导入时读取，不会被保存。':'The raw JSON is read for this import only, not stored.','从 Agent 回复中粘贴 JSON':'Paste the agent’s JSON reply',
    '有效的进展码会自动找到对应项目；你仍需要亲自确认导入。':'A valid code identifies the project. Confirm below to import.','确认并生长':'Confirm import',
    '把提示词贴到这个项目下新建的 Agent；它只会回传一个成长阶段，项目内容不会进入项目园。':'Paste the prompt into a new agent within this project. It returns only a verified level—not project content.',
    '第一步：复制提示词':'1. Copy the prompt','第二步：粘贴 Agent 返回的 JSON':'2. Paste the agent’s JSON reply',
    '阶段只会把植物推进到已确认的高度；它不会把项目名称、对话、文件或成果内容保存到项目园。':'Calibration only raises confirmed progress. It does not import names, conversations, files, or result content.',
    '校准植物阶段':'Calibrate progress','装饰小铺':'Garden shop','挑一件喜欢的，换个园区心情。':'A small change for your growing space.',
    '点灵感':'inspiration','新想法 +1 · 明确决定 +2。由 Agent 确认，每项目每天最多 3 次；普通进展和聊天次数不计分。':'New idea +1 · Decision +2, confirmed by your agent. Up to 3 rewarded events per project per day. Progress and message counts earn no inspiration.',
    '灵感收取记录':'Inspiration history','经典陶盆':'Terracotta pot','奶油釉盆':'Cream-glazed pot','苔绿釉盆':'Moss-glazed pot',
    '温暖的赤陶盆沿。':'Warm terracotta pottery.','完整奶油釉色，保留陶盆明暗与纹理。':'Cream glaze with the original pottery texture and shading.',
    '完整苔绿釉色，植物叶片保持原色。':'Moss-green glaze; the plant keeps its natural colors.',
    '深木花架':'Dark-wood shelves','温室原有的深色木架。':'The greenhouse’s original wooden shelves.','黄铜花架':'Brass-trimmed shelves','为后层架子加上黄铜护角。':'Add brass trim to the rear shelves.',
    '浇水壶角落':'Watering-can corner','保留温室原有的浇水壶。':'Keep the greenhouse’s original watering can.','园艺小铲':'Garden trowel','在前景土壤旁放一把小铲。':'Place a small trowel by the soil.',
    '种子木箱':'Seed crate','在前景添一箱待种的种子包。':'Add a wooden crate of seed packets.','花盆':'Pots','花架':'Shelves','角落小物':'Garden objects','正在使用':'In use','换上它':'Use this',
    '新想法':'New idea','明确决定':'Decision','当日额度已满':'Daily cap reached','项目':'Project',
    '暂无已收取的想法或决定。Agent 需要使用 Project Garden 的灵感记录工具确认；仅聊天或完成代码不会自动加分。':'No confirmed ideas or decisions yet. Your agent must send an inspiration event through Project Garden. Chatting or finishing code alone does not award points.',
    '先保护，后连接。':'Local by default. Private by design.','项目资料本地保存':'Project data stays local','名称、笔记、进展都留在你的电脑。':'Names, notes and progress stay on your computer.',
    '生长阶段':'Growth stages','查看生长':'View growth','幼株':'Young plant','扎根':'Taking root','抽枝':'New growth','丰叶':'Filling out','初花':'First blooms','繁茂':'Flourishing',
    '种子':'Seed','发芽':'Sprouting','幼苗':'Seedling','舒叶':'Unfurling','成丛':'Full canopy','新叶循环':'New-leaf cycle',
    '花苞':'Bud','含苞':'Swelling bud','初开':'Opening','盛开':'Full bloom','卷叶':'Curled leaf','长大':'Developing','展开':'Unfurling','成叶':'Mature leaf',
    '成长不会封顶；成株后继续逐朵开花或展开新叶。':'Growth keeps going: established plants continue to open flowers or unfurl leaves.',
    '六阶段成长，进展不会清零。':'Six growth stages. Your progress is never reset.',
    '一次只推进当前这一朵，不会一口气开满。':'Each flower develops individually, rather than all blooming at once.',
    '植物本体、花与花盆分别绘制。':'Plant, flowers and pot are separate layers.',
  };
  function translate(text) {
    if (typeof text !== 'string' || !/[\u3400-\u9fff]/.test(text)) return text;
    const trim = text.trim();
    if (en[trim]) return text.replace(trim, en[trim]);
    const patterns = [
      [/^(\d+) 天前$/, (_, n) => `${n} days ago`], [/^(\d+) 个正在照料$/, (_, n) => `${n} plants`],
      [/^已移出 (\d+) 个$/, (_, n) => `Hidden (${n})`], [/^(\d+) 个项目 · 进展持续同步$/, (_, n) => `${n} projects · Progress syncing`],
      [/^(\d+) 条记录待收取$/, (_, n) => `${n} pending updates`], [/^用 (\d+) 灵感解锁$/, (_, n) => `Unlock · ${n}`],
      [/^灵感 \+(\d+)$/, (_, n) => `Inspiration +${n}`], [/^移出「(.*)」？$/, (_, name) => `Hide “${name}”?`],
      [/^(.+) 的选项$/, (_, name) => `Options for ${name}`], [/^上次推进：(.*)$/, (_, when) => `Last progress: ${translate(when)}`],
      [/^最近保存：(.*)$/, (_, when) => `Last saved: ${when}`],
      [/^旧项目不会被偷偷猜测匹配。如果「(.*)」是旧项目，可主动让它接收一个新的 Codex 项目的第一次真实推进。$/, (_, name) => `Existing projects are never matched by guessing. If “${name}” is an old plant, you can explicitly link it to the first progress event from a new Codex project.`],
      [/^植物已校准到第 (\d+) 阶段。$/, (_, n) => `Progress calibrated to level ${n}.`],
      [/^阶段 (\d+) \/ 6$/, (_, n) => `Stage ${n} / 6`], [/^还需 (\d+) 成长点$/, (_, n) => `${n} growth points to go`],
      [/^第 (\d+) 轮$/, (_, n) => `Cycle ${n}`], [/^累计 (\d+) 朵$/, (_, n) => `${n} flowers grown`],
      [/^累计 (\d+) 片新叶$/, (_, n) => `${n} leaves grown`],
      [/^第 (\d+) (朵|片) · (.+)$/, (_, n, unit, phase) => `${unit === '朵' ? 'Flower' : 'Leaf'} ${n} · ${translate(phase)}`],
    ];
    for (const [re, fn] of patterns) if (re.test(trim)) return text.replace(trim, trim.replace(re, fn));
    // Composed labels contain only our own vocabulary. Protect user content
    // at the element boundary rather than translating saved data in-place.
    let result = text;
    for (const key of Object.keys(en).sort((a,b)=>b.length-a.length)) {
      if (key.length >= 2) result = result.split(key).join(en[key]);
    }
    return result;
  }
  const sourceText = new WeakMap(), sourceAttributes = new WeakMap();
  function localize(container, language) {
    const isEnglish = language === 'en';
    const protectedNode = el => el?.closest('[data-user-content], script, style, textarea, input, code');
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node=walker.nextNode())) {
      if (protectedNode(node.parentElement)) continue;
      const prior=sourceText.get(node);
      const original=prior && node.nodeValue===prior.rendered ? prior.original : node.nodeValue;
      const rendered=isEnglish ? translate(original) : original;
      sourceText.set(node,{original,rendered});
      if (node.nodeValue!==rendered) node.nodeValue=rendered;
    }
    for (const el of container.querySelectorAll('[aria-label], [title], [placeholder]')) {
      if (el.closest('[data-user-content]')) continue;
      const prior=sourceAttributes.get(el)||{};
      for (const key of ['aria-label','title','placeholder']) {
        if (!el.hasAttribute(key)) continue;
        const value=el.getAttribute(key), saved=prior[key];
        const original=saved && value===saved.rendered ? saved.original : value;
        const rendered=isEnglish ? translate(original) : original;
        prior[key]={original,rendered};
        if(value!==rendered) el.setAttribute(key,rendered);
      }
      sourceAttributes.set(el,prior);
    }
  }
  root.GardenI18n={ en, translate, localize };
})(window);
