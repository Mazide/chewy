import React, { useEffect, useState } from 'react';
import { addons, types, useStorybookApi, useStorybookState } from 'storybook/internal/manager-api';
import { IconButton, WithTooltip } from 'storybook/internal/components';
import { styled } from 'storybook/internal/theming';
import { readBrowserReviewArchive, useReviewArchive } from '../src/core/use-review-archive.js';

const ADDON_ID = 'chewy/review-archive';
const initiallyRemoved = new Set(readBrowserReviewArchive().stories.map(entry => entry.id));
addons.setConfig({ bottomPanelHeight: 0, rightPanelWidth: 0, sidebar: { filters: { [ADDON_ID]: entry => !initiallyRemoved.has(entry.id) } } });

const Menu = styled.div(({ theme }) => ({
  width: 320, maxWidth: 'calc(100vw - 32px)', padding: 16,
  color: theme.color.defaultText, fontFamily: theme.typography.fonts.base, fontSize: 12,
  '& h2': { fontSize: 14, margin: '0 0 10px' },
  '& p': { margin: '8px 0', lineHeight: 1.5, overflowWrap: 'anywhere' },
  '& button': { cursor: 'pointer', font: 'inherit', color: 'inherit', background: theme.background.app,
    border: `1px solid ${theme.appBorderColor}`, borderRadius: 5, minHeight: 36, padding: '6px 10px' },
  '& button:disabled': { opacity: .5, cursor: 'not-allowed' },
  '& button:focus-visible, & summary:focus-visible': { outline: `2px solid ${theme.color.secondary}`, outlineOffset: 2 },
  '& details': { marginTop: 14 },
  '& summary': { cursor: 'pointer', padding: '8px 0' },
  '& ul': { listStyle: 'none', padding: 0, margin: '8px 0 0', maxHeight: 280, overflowY: 'auto' },
  '& li': { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  '& li span': { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  '& small': { display: 'block', marginTop: 12, lineHeight: 1.5 },
}));

function ReviewArchiveTool() {
  const api = useStorybookApi();
  const { index = {}, storyId } = useStorybookState();
  const { archive, error, change } = useReviewArchive();
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const current = index[storyId];
  const archivedStories = archive.stories.filter(entry => index[entry.id]?.type === 'story');
  const removed = new Set(archivedStories.map(entry => entry.id));
  const canRemove = current?.type === 'story' && !removed.has(storyId);

  useEffect(() => {
    if (storyId === 'core-sandbox--all-screens') api.togglePanel(false);
  }, [api, storyId]);

  useEffect(() => {
    const ids = new Set(archive.stories.map(entry => entry.id));
    api.experimental_setFilter(ADDON_ID, entry => !ids.has(entry.id));
  }, [api, archive.stories]);

  const remove = () => {
    const label = `${current.title ?? current.parent ?? ''} / ${current.name}`;
    if (!change('stories', { id: storyId, label }, true)) return;
    setNotice(`«${current.name}» удалена из списка.`);
    const pages = Object.values(index).filter(entry => entry.type === 'story' && !entry.refId);
    const position = pages.findIndex(entry => entry.id === storyId);
    const next = [...pages.slice(position + 1), ...pages.slice(0, position)]
      .find(entry => !removed.has(entry.id));
    if (next) api.selectStory(next.id);
  };

  return <WithTooltip placement="bottom-end" trigger="click" interactive closeOnOutsideClick onVisibleChange={setOpen}
    tooltip={<Menu aria-label="Управление страницами Storybook">
      <h2>Страницы Storybook</h2>
      {current?.type === 'story' && <p>{current.name}</p>}
      <button type="button" disabled={!canRemove} onClick={remove}>Удалить эту страницу</button>
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>Удалённые страницы · {archivedStories.length}</summary>
        {!archivedStories.length ? <p>Удалённых страниц пока нет.</p> : <ul>{archivedStories.map(entry => <li key={entry.id}>
          <span>{index[entry.id].title + " / " + index[entry.id].name}</span>
          <button type="button" aria-label={`Восстановить страницу «${entry.label}»`} onClick={() => {
            if (!change('stories', entry, false)) return;
            setNotice(`«${entry.label}» восстановлена.`);
            if (index[entry.id]) api.selectStory(entry.id);
          }}>Вернуть</button>
        </li>)}</ul>}
      </details>
      {error && <p role="alert">{error}</p>}
      <small>Список сохраняется в этом браузере. Макеты и переходы приложения остаются доступны.</small>
    </Menu>}>
    <IconButton title="Управление страницами Storybook" active={open} aria-expanded={open}>Экраны</IconButton>
  </WithTooltip>;
}

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, { title: 'Экраны', type: types.TOOL, render: () => <ReviewArchiveTool /> });
});
