import { RoamQPullBlock } from './types';
import { setupSendBlock } from './send-block';
import { setupConvertBlockPage, toRoamDateUid } from './convert-block-page';
import { test } from 'roam-research-js';
import { setupGraph } from './test-graph';

const extensionId = 'roam-personal-scripts';

const archivedNotes = 'Archived Notes';
const archivedNotesAttribute = `${archivedNotes}::`;

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
  }
  return archivedNotesAttributeUid;
}

async function archiveBlock(_: string, uidToArchive: string): Promise<void> {
  const archivedNotesAttributeUid = await getOrCreateArchivedNotesAttribute();

  // If this block is already ref'd in Archived Notes (because you've archived its children before), replace that ref with the ORIGINAL block
  const blockAlreadyInArchivedNotes: RoamQPullBlock =
    await window.roamAlphaAPI.q(
      `[:find (pull ?c [:block/uid :block/string :block/children :block/order {:block/children 2}])
      :in $ ?uidToArchive ?archive-attr
      :where [?a :block/uid ?archive-attr]
             [?u :block/uid ?uidToArchive]
             [?a :block/children ?c]
             [?c :block/refs ?u]
             [?c :block/string ?v]
             [(= ?v "((${uidToArchive}))")]]`,
      uidToArchive,
      archivedNotesAttributeUid
    )?.[0]?.[0];
  if (blockAlreadyInArchivedNotes) {
    const { uid, children, order } = blockAlreadyInArchivedNotes;
    await window.roamAlphaAPI.data.block.move({
      location: {
        'parent-uid': archivedNotesAttributeUid,
        order,
      },
      block: {
        uid: uidToArchive,
      },
    });
    if (children?.length) {
      for (const c of children) {
        const childUid = c.uid;
        await window.roamAlphaAPI.data.block.move({
          location: {
            'parent-uid': uidToArchive,
            order: c.order,
          },
          block: {
            uid: childUid,
          },
        });
      }
    }
    await window.roamAlphaAPI.data.block.delete({
      block: {
        uid,
      },
    });
  } else {
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

  // Duplicating code from archive block
  const archivedNotesAttributeUid = await getOrCreateArchivedNotesAttribute();
  let parentBlockInArchivedNotesUid: string = await window.roamAlphaAPI.q(
    `[:find ?uid :in $ ?archived-attr-uid ?ref-uid :where [?a :block/uid ?archived-attr-uid] [?a :block/children ?c] [?r :block/uid ?ref-uid] [?c :block/refs ?r] [?c :block/uid ?uid]]`,
    archivedNotesAttributeUid,
    newBlockUid
  )?.[0]?.[0];
  if (!parentBlockInArchivedNotesUid) {
    const parentBlockRef = `((${newBlockUid}))`;
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
      uid: oldBlockUid,
    },
  });

  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: 'block',
      'block-uid': parentBlockInArchivedNotesUid,
    },
  });

  // TODO doesn't work for some reason; asked on Slack DMs
  // window.location.assign(
  //   `https://roamresearch.com/#/app/${graphName}/page/${newBlockUid}`
  // );
}

async function resolveCompletedObject(
  pageUid: string,
  resolvedObjectUid: string
): Promise<void> {
  // Archive the resolved object
  archiveBlock(pageUid, resolvedObjectUid);

  // Loop over every object that depends on this object and add object to Context attribute (just parent if task; qna if question)
  const dependeeObjectUids = await window.roamAlphaAPI.q(
    `[:find ?uids :in $ ?resolved-uid
      :where [?resolved :block/uid ?resolved-uid]
             [?refs :block/refs ?resolved]
             [?refs :block/parents ?parents]
             [?parents :block/children ?refs]
             [?parents :block/string "Todos::"]
             [?parents :block/parents ?blocks]
             [?blocks :block/children ?parents]
             [?blocks :block/uid ?uids]]`,
    resolvedObjectUid
  )[0];

  if (!dependeeObjectUids) {
    alert(
      'Nothing depends on this object; contact developer if this is a mistake'
    );
    return;
  }

  if (dependeeObjectUids?.length) {
    for (const dependeeUid of dependeeObjectUids) {
      // Remove the resolved object from Depends On
      const dependsOnRefBlockUid = await window.roamAlphaAPI.q(
        `[:find ?uid :in $ ?dependee-uid ?resolved-uid
          :where [?d :block/uid ?dependee-uid]
                 [?resolved :block/uid ?resolved-uid]
                 [?d :block/children ?c]
                 [?c :block/string "Todos::"]
                 [?c :block/children ?deps]
                 [?deps :block/refs ?resolved]
                 [?deps :block/uid ?uid]]`,
        dependeeUid,
        resolvedObjectUid
      )[0][0];
      await window.roamAlphaAPI.data.block.delete({
        block: {
          uid: dependsOnRefBlockUid,
        },
      });

      // assuming it exists
      const contextAttributeUid = await window.roamAlphaAPI.q(
        `[:find ?uid :in $ ?dependee-uid
          :where [?d :block/uid ?dependee-uid]
                 [?d :block/children ?c]
                 [?c :block/string "Context::"]
                 [?c :block/uid ?uid]]`,
        dependeeUid
      )[0][0];

      const resolvedBlockRefBlockUid =
        await window.roamAlphaAPI.util.generateUID();

      await window.roamAlphaAPI.data.block.create({
        location: {
          'parent-uid': contextAttributeUid,
          order: 0,
        },
        block: {
          uid: resolvedBlockRefBlockUid,
          string: `((${resolvedObjectUid}))`,
        },
      });
    }
  }
}
async function onShortcut(
  callback: (pageUid: string, blockUid: string) => void
): Promise<void> {
  const blockUid = window.roamAlphaAPI.ui.getFocusedBlock()?.['block-uid'];
  if (!blockUid) return;

  const pageUid = await window.roamAlphaAPI.q(
    `[:find ?page-uid :in $ ?block-uid :where [?b :block/uid ?block-uid] [?b :block/page ?p] [?p :block/uid ?page-uid]]`,
    blockUid
  )[0][0];

  callback(pageUid, blockUid);
}

function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'Backspace') {
      onShortcut(archiveBlock);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyX') {
      onShortcut(refactorBlock);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
      onShortcut(resolveCompletedObject);
    }
  });
}

console.log('Initializing keyboard shortcuts');
setupKeyboardShortcuts();
setupSendBlock();
setupConvertBlockPage();
setupGraph();
console.log(`Initialized ${extensionId}`);
