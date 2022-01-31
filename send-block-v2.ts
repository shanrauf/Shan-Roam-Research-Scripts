import { getUids } from './convert-block-page';
import { roam42KeyboardLib } from './keyboard';

// Global state
let blockPath: BlockPath = [];
let currentBlockUid: string = '';

type BlockPathItem = {
  type: 'page-title' | 'block-string' | 'uid';
  value: string;
};

type BlockPath = BlockPathItem[];

function addToBlockPath(item: BlockPathItem, path: BlockPath): void {
  path.push(item);
}

function resolveParentUid(
  parentBlockItem: BlockPathItem,
  items: BlockPath
): string {
  let uid = '';
  if (parentBlockItem?.type === 'uid') {
    uid = parentBlockItem.value;
  } else if (!items.length) {
    const title = parentBlockItem.value;
    uid = window.roamAlphaAPI.q(
      `[:find ?uid :in $ ?title :where [:?e :node/title ?title] [?e :block/uid ?uid]]`,
      title
    )?.[0]?.[0];
  } else {
    const parent = items[items.length - 1];
    uid = resolveParentUid(parent, items.slice(0, items.length - 1));
  }
  return uid;
}

function getUidFromBlockString(text: string, path: BlockPath): string {
  if (!path.length) {
    const uid = window.roamAlphaAPI.q(
      `[:find ?uid :in $ ?title :where [?e :node/title ?title] [?e :block/uid ?uid]]`,
      text
    )?.[0]?.[0];
    return uid;
  }
  const parentBlockItem = path[path.length - 1];
  const parentUid = resolveParentUid(parentBlockItem, path);
  const uid = window.roamAlphaAPI.q(
    `[:find ?uid :in $ ?str ?parent-uid :where [?e :block/uid ?parent-uid] [?e :block/children ?c] [?c :block/string ?str] [?c :block/uid ?uid]]`,
    text,
    parentUid
  )?.[0]?.[0];
  return uid;
}

function addElToBlockPath(selectedEl: Element, path: BlockPath): void {
  if (selectedEl.classList.contains('bp3-menu-item')) {
    const isCreatingNewItem = !!selectedEl.querySelector('.rm-new-item');
    const nestedSelectedBlock = selectedEl.querySelector('.bp3-overflow-list');
    const isNestedSelectedBlock =
      nestedSelectedBlock?.querySelector('.rm-zoom-item');
    if (isCreatingNewItem) {
      const el = selectedEl.querySelector('div');
      const itemText = el.childNodes.item(el.childNodes.length - 1).textContent;
      const isNewBlock = path.length;
      const blockType = isNewBlock ? 'block-string' : 'page-title';
      addToBlockPath({ type: blockType, value: itemText }, path);
    } else if (isNestedSelectedBlock) {
      const el = selectedEl.querySelector('div');
      const itemText = el.childNodes.item(el.childNodes.length - 1).textContent;
      nestedSelectedBlock
        .querySelectorAll('.rm-zoom-item')
        .forEach((el) => addElToBlockPath(el, path));
      const uid = getUidFromBlockString(itemText, path);
      addToBlockPath({ type: 'uid', value: uid }, path);
    } else {
      let uid: string = '';
      const itemText = selectedEl.childNodes.item(
        selectedEl.childNodes.length - 1
      ).textContent;
      const isPage = !path.length;
      if (isPage) {
        uid = window.roamAlphaAPI.q(
          `[:find ?uid :in $ ?str :where [?e :node/title ?str] [?e :block/uid ?uid]]`,
          itemText
        )?.[0]?.[0];
      } else {
        uid = getUidFromBlockString(itemText, path);
      }
      addToBlockPath({ type: 'uid', value: uid }, path);
    }
  } else if (selectedEl.classList.contains('rm-zoom-item')) {
    const itemText = selectedEl.querySelector('.rm-zoom-mask').textContent;
    const uid = getUidFromBlockString(itemText, path);
    addToBlockPath({ type: 'uid', value: uid }, path);
  } else if (selectedEl.classList.contains('rm-zoom-item-content')) {
    const blockPathItemEls = Array.from(
      selectedEl.parentElement.parentElement.children
    );
    const orderNumber = blockPathItemEls.indexOf(selectedEl.parentElement);
    path = path.slice(0, orderNumber + 1);
  }
}

type SendType = 'raw' | 'ref';

function onSendBlock(sendType: SendType): void {
  const sendToUid = blockPath[blockPath.length - 1].value;

  if (sendType === 'raw') {
    window.roamAlphaAPI.data.block.move({
      location: {
        'parent-uid': sendToUid,
        order: -1,
      },
      block: {
        uid: currentBlockUid,
      },
    });
  } else if (sendType === 'ref') {
    window.roamAlphaAPI.data.block.create({
      location: {
        'parent-uid': sendToUid,
        order: -1,
      },
      block: {
        uid: window.roamAlphaAPI.util.generateUID(),
        string: `((${currentBlockUid}))`,
      },
    });
  }
  roam42KeyboardLib.pressEsc(0);
}

export function setupSendBlock(): void {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey e.code === 'Enter') {
      // bring back check for if the UI is still open
      return;
    } else if (e.altKey && e.code === 'Enter') {
      return;
    }
  });
}
