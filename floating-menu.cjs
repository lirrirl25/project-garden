// This menu is local UI only; names never enter the anonymous progress bridge.
function floatingMenuTemplate(projects, selectedId, actions, language = 'zh') {
  const t = (zh, en) => language === 'en' ? en : zh;
  const choices = (Array.isArray(projects) ? projects : []).filter((project) =>
    typeof project?.id === 'string' && typeof project?.name === 'string').slice(0, 200);
  return [
    { label: t('展开项目园', 'Open garden'), click: actions.expand },
    { label: t('切换植物', 'Switch plant'), enabled: choices.length > 0, submenu: choices.length ? choices.map((project) => ({
      label: project.name.slice(0, 100).replace(/&/g, '&&'), type: 'radio', checked: project.id === selectedId,
      click: () => actions.select(project.id),
    })) : [{ label: t('暂无可展示项目', 'No visible projects'), enabled: false }] },
    { type: 'separator' },
    { label: t('移到副屏右下角', 'Move to secondary display'), click: actions.resetPosition },
    { label: t('退出项目园', 'Quit Project Garden'), click: actions.quit },
  ];
}
module.exports = { floatingMenuTemplate };
