import { RoamQPullBlock } from './types';
// import { setupSendBlock } from './send-block';
import { setupConvertBlockPage, toRoamDateUid } from './convert-block-page';
// import { test } from 'roam-research-js';
import format from 'date-fns/format';

const extensionId = 'shan-personal-scripts';

const archivedNotes = 'Archived Notes';
const archivedNotesAttribute = `${archivedNotes}::`;

const toRoamDate = (d: Date) =>
  isNaN(d.valueOf()) ? '' : format(d, 'MMMM do, yyyy');

async function getOrCreateArchivedNotesAttribute(): Promise<string> {
  const todayDate = new Date();
  const todayUid = toRoamDateUid(todayDate);

  // Get or create Archived Notes attribute on the page
  let archivedNotesAttributeUid = await window.roamAlphaAPI.q(
    `[:find ?attr-uid :in $ ?page-uid
      :where [?p :block/uid ?page-uid]
             [?p :block/children ?c]
             [?a :node/title "${archivedNotes}"]
             [?c :block/refs ?a]
             [?c :block/uid ?attr-uid]]`,
    todayUid
  )?.[0]?.[0];

  if (!archivedNotesAttributeUid) {
    // Find or create the DNP page
    const dnpPageExists = await window.roamAlphaAPI.q(`
    [:find ?e :where [?e :block/uid "10-10-21"]]
    `)?.[0]?.[0];

    if (!dnpPageExists) {
      const todayDateTitle = toRoamDate(todayDate);
      await window.roamAlphaAPI.data.page.create({
        page: {
          uid: todayUid,
          title: todayDateTitle,
        },
      });
    }

    // Adding the Archived Notes attribute
    archivedNotesAttributeUid = window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.data.block.create({
      location: {
        'parent-uid': todayUid,
        order: 0,
      },
      block: {
        string: archivedNotesAttribute,
        uid: archivedNotesAttributeUid,
        open: false,
      },
    });
    await window.roamAlphaAPI.data.block.update({
      block: {
        uid: archivedNotesAttributeUid,
        open: false,
      },
    });
  }
  return archivedNotesAttributeUid;
}

async function archiveBlock(_: string, uidToArchive: string): Promise<void> {
  const archivedNotesAttributeUid = await getOrCreateArchivedNotesAttribute();

  const parentBlock: RoamQPullBlock = await window.roamAlphaAPI.q(
    `[:find (pull ?e [:block/uid :node/title]) :in $ ?child-uid :where [?c :block/uid ?child-uid] [?c :block/parents ?e] [?e :block/children ?c]]`,
    uidToArchive
  )?.[0]?.[0];
  const parentBlockRef = parentBlock?.title
    ? `[[${parentBlock.title}]]`
    : `((${parentBlock.uid}))`;
  let parentBlockInArchivedNotesUid: string = await window.roamAlphaAPI.q(
    `[:find ?uid :in $ ?archived-attr-uid ?ref-uid :where [?a :block/uid ?archived-attr-uid] [?a :block/children ?c] [?r :block/uid ?ref-uid] [?c :block/refs ?r] [?c :block/uid ?uid]]`,
    archivedNotesAttributeUid,
    parentBlock.uid
  )?.[0]?.[0];

  // If you haven't already archived notes under this parent block today, then create that block; otherwise, reuse the same block
  if (!parentBlockInArchivedNotesUid) {
    parentBlockInArchivedNotesUid = window.roamAlphaAPI.util.generateUID();
    await window.roamAlphaAPI.data.block.create({
      location: {
        'parent-uid': archivedNotesAttributeUid,
        order: -1,
      },
      block: {
        uid: parentBlockInArchivedNotesUid,
        string: parentBlockRef,
      },
    });
  }

  // Send the block to attribute
  await window.roamAlphaAPI.data.block.move({
    location: {
      'parent-uid': parentBlockInArchivedNotesUid,
      order: -1,
    },
    block: {
      uid: uidToArchive,
    },
  });
}

async function refactorBlock(_: string, oldBlockUid: string): Promise<void> {
  // Create a new block right above the old one
  const newBlockUid = window.roamAlphaAPI.util.generateUID();
  const [parentBlockUid, oldBlockOrder] = await window.roamAlphaAPI.q(
    `[:find ?parent-uid ?old-order :in $ ?child-uid :where [?b :block/uid ?child-uid] [?b :block/parents ?p] [?p :block/children ?b] [?p :block/uid ?parent-uid] [?b :block/order ?old-order]]`,
    oldBlockUid
  )[0];

  await window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': parentBlockUid,
      order: oldBlockOrder,
    },
    block: {
      string: `Refactor: ((${oldBlockUid}))`,
      uid: newBlockUid,
    },
  });

  // Create an empty block to write in
  await window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': newBlockUid,
      order: 0,
    },
    block: {
      string: ``,
      uid: window.roamAlphaAPI.util.generateUID(),
    },
  });

  // Nest old writing under this "Notes" block
  const notesBlock = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': newBlockUid,
      order: 1,
    },
    block: {
      string: `Notes`,
      uid: notesBlock,
      open: false,
    },
  });

  await window.roamAlphaAPI.data.block.move({
    location: {
      'parent-uid': notesBlock,
      order: 0,
    },
    block: {
      uid: oldBlockUid,
    },
  });

  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: 'block',
      'block-uid': notesBlock,
    },
  });
}

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

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Backspace') {
      onShortcut(archiveBlock);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
      onShortcut(refactorBlock);
    }
  });
}

console.log('Initializing keyboard shortcuts');
setupKeyboardShortcuts();
// setupSendBlock();
setupConvertBlockPage();
console.log(`Initialized ${extensionId}`);
