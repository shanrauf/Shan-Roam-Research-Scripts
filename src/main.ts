import * as roamAPI from 'roam-research-js';
import { findOrCreateCurrentDNPUid } from './util';
import { setupConvertBlockPage } from './convert-block-page';
import { archiveBlock } from './archive-block';
import { refactorBlock } from './refactor-block';

const extensionId = 'shan-personal-scripts';

function getAllSiblings(el: Element): Element[] {
  // modified from https://stackoverflow.com/questions/4378784/how-to-find-all-siblings-of-the-currently-selected-dom-object
  const siblings: Element[] = [];
  el = el.parentNode.firstElementChild;
  while (el) {
    if (el.nodeType === 3) continue; // text node
    siblings.push(el);
    el = el.nextElementSibling;
  }
  return siblings;
}

function getUidFromEl(el: Element): string {
  // block-input-FCtT0Pln1IPQwShwIyILPG0743H2-body-outline-lFJK3buch-owv9l4kpC
  const id = el.querySelectorAll("div[id^='block-input-']")[0].id;
  return id.substring(id.length - 9, id.length);
}

function getTopLevelSelectedBlockUids(): string[] {
  const oneOfTheTopMostSelectedBlocks = document.getElementsByClassName(
    'block-highlight-blue'
  )?.[0];
  if (!oneOfTheTopMostSelectedBlocks) {
    return [];
  }

  const allSelectedSiblings = getAllSiblings(
    oneOfTheTopMostSelectedBlocks
  ).filter(
    (s) =>
      s.classList.contains('rm-block') &&
      s.classList.contains('block-highlight-blue')
  );
  return allSelectedSiblings.map((s) => getUidFromEl(s));
}

async function onShortcut(
  callback: (pageUid: string, blockUid: string) => void
): Promise<void> {
  let blockUids: string[] = getTopLevelSelectedBlockUids();
  if (!blockUids.length) {
    const focusedBlock =
      window.roamAlphaAPI.ui.getFocusedBlock()?.['block-uid'];
    if (!focusedBlock) return;
    blockUids = [focusedBlock];
  }

  for (const blockUid of blockUids) {
    const pageUid = await window.roamAlphaAPI.q(
      `[:find ?page-uid :in $ ?block-uid :where [?b :block/uid ?block-uid] [?b :block/page ?p] [?p :block/uid ?page-uid]]`,
      blockUid
    )[0][0];

    await callback(pageUid, blockUid);
  }
}

async function createDNPBlockAndFocus(ctrlSelected: boolean) {
  // Create a block at the bottom of DNP and focus on it (like a quick capture command)
  const todayUid = await findOrCreateCurrentDNPUid();
  const blockUid = await window.roamAlphaAPI.util.generateUID();
  const order = window.roamAlphaAPI.q(`
 [:find [?c ...] :where [?e :block/uid "${todayUid}"] [??e :block/children ?c]]`).length;

  await window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': todayUid,
      order: order,
    },
    block: {
      string: '',
      uid: blockUid,
    },
  });

  if (ctrlSelected) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        type: 'block',
        'block-uid': blockUid,
        order: window.roamAlphaAPI.ui.rightSidebar.getWindows().length,
      },
    });
    const windowId = await window.roamAlphaAPI.ui.rightSidebar
      .getWindows()
      .filter((w: any) => w['block-uid'] === blockUid)[0]['window-id'];
    await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        'window-id': windowId,
        'block-uid': blockUid,
      },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: blockUid,
      },
    });
    await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        'block-uid': blockUid,
        'window-id': 'main-window',
      },
    });
  }
}

function setupKeyboardShortcuts(): void {
  setupConvertBlockPage();
  document.addEventListener('keydown', async (e) => {
    const key = parseInt(e.key);
    console.log(key);
    if (e.ctrlKey && e.shiftKey && e.code === 'Backspace') {
      onShortcut(archiveBlock);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
      onShortcut(refactorBlock);
    } else if (e.altKey && e.code === 'KeyB') {
      await createDNPBlockAndFocus(e.ctrlKey);
    } else if (e.altKey && key >= 0 && key <= 9) {
      if (key === 1) {
        await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
          location: {
            'block-uid':
              window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid(),
            'window-id': 'main-window',
          },
        });
        return;
      }
      // TODO replace .length mess with -1 when you can
      // Note: from here on, we're referring to the SIDEBAR order (which starts at 0); main view was handled above
      const windowOrder =
        e.key === '0'
          ? window.roamAlphaAPI.ui.rightSidebar.getWindows().length - 1
          : key - 1;
      console.log(windowOrder);
      const roamWindow =
        window.roamAlphaAPI.ui.rightSidebar.getWindows()?.[windowOrder];
      console.log(roamWindow);
      if (roamWindow.type === 'graph' || roamWindow.type == 'mentions') return;

      const roamWindowId = roamWindow['window-id'];
      console.log('ASDF');
      const roamWindowUid =
        roamWindow?.['page-uid'] || roamWindow?.['block-uid'];
      window.roamAlphaAPI.ui.setBlockFocusAndSelection({
        location: {
          'block-uid': roamWindowUid,
          'window-id': roamWindowId,
        },
      });
    }
  });
}

console.log('Initializing keyboard shortcuts');
setupKeyboardShortcuts();
console.log(`Initialized ${extensionId}`);
