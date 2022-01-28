import { findOrCreateCurrentDNPUid } from './util';
import { RoamQPullBlock } from './types';

const archivedNotes = 'Archived Notes';
const archivedNotesAttribute = `${archivedNotes}::`;

async function getOrCreateArchivedNotesAttribute(): Promise<string> {
  const todayUid = await findOrCreateCurrentDNPUid();

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

export async function archiveBlock(
  _: string,
  uidToArchive: string
): Promise<void> {
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
        order: 0,
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
