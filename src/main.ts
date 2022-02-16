import * as roamAPI from 'roam-research-js';
import { findOrCreateCurrentDNPUid } from './util';
import { convertBlockToPage, convertPageToBlock } from './convert-block-page';
import { archiveBlock } from './archive-block';
import { refactorBlock } from './refactor-block';
import { setupAliasTabKeybind } from './alias-tab';

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

async function focusOnWindow(w: RoamWindow) {
  // Apparently Roam doesn't focus on the first child for you for pages
  const uid = w?.['page-uid'];
  if (uid) {
    const firstChildUid = await window.roamAlphaAPI.q(
      `
    [:find ?uid :in $ ?block-uid :where [?e :block/uid ?block-uid] [?e :block/children ?c] [?c :block/order 0] [?c :block/uid ?uid]]
    `,
      uid
    )?.[0]?.[0];
    if (!firstChildUid) return;

    await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        'block-uid': firstChildUid,
        'window-id': w['window-id'],
      },
    });
  } else {
    await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        'block-uid': w['block-uid'],
        'window-id': w['window-id'],
      },
    });
  }
}

async function createDNPBlockAndFocus(ctrlSelected: boolean) {
  // Create a block at the bottom of DNP and focus on it (like a quick capture command)
  const todayUid = await findOrCreateCurrentDNPUid();
  const blockUid = await window.roamAlphaAPI.util.generateUID();
  const order = window.roamAlphaAPI.q(
    `
 [:find [?c ...] :in ?today-uid :where [?e :block/uid ?today-uid] [?e :block/children ?c]]`,
    todayUid
  ).length;

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
        order: 0,
      },
    });
    const windowId = await window.roamAlphaAPI.ui.rightSidebar
      .getWindows()
      .filter((w: any) => w['block-uid'] === blockUid)[0]['window-id'];
    await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: {
        'block-uid': blockUid,
        'window-id': windowId,
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

function getSortedSidebarWindows() {
  return window.roamAlphaAPI.ui.rightSidebar
    .getWindows()
    .sort((a, b) => a.order - b.order);
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', async (e) => {
    const key = parseInt(e.key);
    if (e.ctrlKey && e.shiftKey && e.code === 'Backspace') {
      onShortcut(archiveBlock);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
      onShortcut(refactorBlock);
    } else if (e.altKey && e.code === 'KeyB') {
      await createDNPBlockAndFocus(e.ctrlKey);
    } else if (e.ctrlKey && e.altKey && e.code === 'KeyW') {
      e.preventDefault();
      const currentBlockUid = await window.roamAlphaAPI.ui.getFocusedBlock()?.[
        'block-uid'
      ];
      convertBlockToPage(currentBlockUid);
    } else if (e.ctrlKey && e.altKey && e.code === 'KeyQ') {
      let pageUid = '';
      const editingPageTitleEl = document.getElementsByClassName(
        'rm-title-editing-display'
      )?.[0];

      const currentBlockUid = await window.roamAlphaAPI.ui.getFocusedBlock()?.[
        'block-uid'
      ];
      if (editingPageTitleEl) {
        const pageTitle = editingPageTitleEl.firstElementChild.innerHTML;
        if (!pageTitle) return;

        pageUid = await window.roamAlphaAPI.q(
          `[:find ?uid :in $ ?page-title :where [?e :node/title ?page-title] [?e :block/uid ?uid]]`,
          pageTitle
        )?.[0]?.[0];
      } else if (currentBlockUid) {
        pageUid = await window.roamAlphaAPI.q(
          `[:find ?uid :in $ ?block-uid :where [?b :block/uid ?block-uid] [?b :block/page ?p] [?p :block/uid ?uid]]`,
          currentBlockUid
        )?.[0]?.[0];
      } else {
        // Get pageUid from main view as default behavior
        // const uid = window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
        pageUid =
          await window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
      }
      const DAILY_NOTE_UID_REGEX =
        /^(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])\-\d{4}$/;
      if (!pageUid || pageUid.match(DAILY_NOTE_UID_REGEX)?.length) return;

      convertPageToBlock(pageUid);
    } else if (e.altKey && (e.key === '-' || (key >= 0 && key <= 9))) {
      // Select specific Roam window tab
      if (key === 1) {
        await window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
        return;
      }
      // Now referring to sidebar order (which starts at 0); main view was handled above
      // I reverse the order because with my CSS, new sidebar windows open at the end
      const windows = getSortedSidebarWindows().reverse();
      if (!windows?.length) return;

      let windowOrder = 0;
      if (e.key === '-') {
        windowOrder = windows.length - 1;
      } else if (e.key === '0') {
        windowOrder = 8;
      } else {
        windowOrder = key - 2;
      }
      const roamWindow = windows[windowOrder];
      if (!roamWindow) return;

      if (roamWindow.type === 'graph' || roamWindow.type == 'mentions') return;
      await focusOnWindow(roamWindow);
    } else if (e.altKey && (e.key === 'z' || e.key === 'x')) {
      // Cycle Roam windows
      const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();

      if (!focusedBlock) {
        await window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
        return;
      }

      const backwardsSelected = e.key === 'z';
      const windows = getSortedSidebarWindows().reverse();

      if (!windows.length) return;

      const focusedWindow = windows.find(
        (w) => w['window-id'] === focusedBlock['window-id']
      );

      let windowToFocusOn;
      if (!focusedWindow) {
        // Focused on main view
        windowToFocusOn = backwardsSelected ? windows.at(-1) : windows[0];
      } else {
        const focusedWindowOrder = windows.indexOf(focusedWindow);
        if (backwardsSelected) {
          if (focusedWindowOrder == 0) {
            await window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
            return;
          } else {
            windowToFocusOn = windows[focusedWindowOrder - 1];
          }
        } else {
          if (focusedWindowOrder == windows.length - 1) {
            await window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
            return;
          } else {
            windowToFocusOn = windows[focusedWindowOrder + 1];
          }
        }
      }
      await focusOnWindow(windowToFocusOn);
    } else if (e.altKey && e.key === 'w') {
      // Close Roam window tab
      const windows = getSortedSidebarWindows().reverse();

      if (!windows.length) {
        // only main view is open
        await window.roamAlphaAPI.ui.mainWindow.openDailyNotes();
        window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
        return;
      }

      const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();

      const focusedWindow = windows.find(
        (w) => w['window-id'] === focusedBlock?.['window-id']
      );
      if (!focusedBlock || !focusedWindow) {
        // the focused window is the main window OR no window is focused (so pretend main window)
        const firstSidebarWindow = windows[0];
        let uid = firstSidebarWindow?.['page-uid'];
        if (uid) {
          await window.roamAlphaAPI.ui.mainWindow.openPage({
            page: {
              uid,
            },
          });
        } else {
          uid = firstSidebarWindow['block-uid'];
          await window.roamAlphaAPI.ui.mainWindow.openBlock({
            block: {
              uid,
            },
          });
        }

        await window.roamAlphaAPI.ui.rightSidebar.removeWindow({
          window: {
            'block-uid': uid,
            type: firstSidebarWindow.type,
          },
        });
        return;
      } else {
        let nextWindow;
        let nextWindowIdx = windows.indexOf(focusedWindow) + 1;
        // TODO there may only be one sidebar window, meaning closing it is just focusing on main view
        if (nextWindowIdx === windows.length) {
          // That means we're closing the last window, so focus on window to the left
          if (windows.length === 1) {
            // The remaining window is the main view, so focus on that
            window.roamAlphaAPI.ui.rightSidebar.removeWindow({
              window: {
                'block-uid':
                  focusedWindow?.['page-uid'] || focusedWindow['block-uid'],
                type: focusedWindow.type,
              },
            });

            window.roamAlphaAPI.ui.mainWindow.focusFirstBlock();
            return;
          } else {
            nextWindow = windows.at(-2);
          }
        } else {
          nextWindow = windows.at(nextWindowIdx);
        }
        window.roamAlphaAPI.ui.rightSidebar.removeWindow({
          window: {
            'block-uid':
              focusedWindow?.['page-uid'] || focusedWindow['block-uid'],
            type: focusedWindow.type,
          },
        });

        await focusOnWindow(nextWindow);
      }
    }
  });
}

console.log('Initializing keyboard shortcuts');
setupKeyboardShortcuts();
setupAliasTabKeybind();
console.log(`Initialized ${extensionId}`);
