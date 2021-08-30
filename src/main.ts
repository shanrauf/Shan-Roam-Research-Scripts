import { runExtension } from './entry-helpers';

const extensionId = 'roam-personal-scripts';

const archivedNotes = 'Archived Notes';
const archivedNotesAttribute = `${archivedNotes}::`;
const referencesAttribute = 'References::';

function archiveBlock(pageUid: string, uidToArchive: string): void {
  // const uidToArchive = window.roamAlphaAPI.ui.getFocusedBlock()['block-uid'];
  // if (!uidToArchive) return;

  // Get or create Archived Notes attribute on the page
  let archivedNotesAttributeUid = window.roamAlphaAPI.q(
    `[:find ?attr-uid :in $ ?page-uid
          :where[?p :block/uid ?page-uid]
                [?p :block/children ?c]
                [?a :node/title "${archivedNotes}"]
                [?c :block/refs ?a]
                [?c :block/uid ?attr-uid]]`,
    pageUid
  )?.[0]?.[0];

  if (!archivedNotesAttributeUid) {
    archivedNotesAttributeUid = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.data.block.create({
      location: {
        'parent-uid': pageUid,
        order: 0,
      },
      block: {
        string: archivedNotesAttribute,
        uid: archivedNotesAttributeUid,
      },
    });
  }

  // Send the block to attribute
  window.roamAlphaAPI.data.block.move({
    location: {
      'parent-uid': archivedNotesAttributeUid,
      order: 0,
    },
    block: {
      uid: uidToArchive,
    },
  });
}

function refactorBlock(pageUid: string, oldBlockUid: string): void {
  // Create a new block right above the old one
  const newBlockUid = window.roamAlphaAPI.util.generateUID();
  const [parentBlockUid, oldBlockOrder] = window.roamAlphaAPI.q(
    `[:find ?parent-uid ?old-order :in $ ?child-uid :where [?b :block/uid ?child-uid] [?b :block/parents ?p] [?p :block/children ?b] [?p :block/uid ?parent-uid] [?b :block/order ?old-order]]`,
    oldBlockUid
  )[0];

  window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': parentBlockUid,
      order: oldBlockOrder,
    },
    block: {
      string: 'refactor',
      uid: newBlockUid,
    },
  });

  // Add a References attribute to the new block with a ref to the old block
  const referencesAttributeUid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': newBlockUid,
      order: 0,
    },
    block: {
      string: referencesAttribute,
      uid: referencesAttributeUid,
    },
  });
  window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': referencesAttributeUid,
      order: 0,
    },
    block: {
      string: `((${oldBlockUid}))`,
      uid: window.roamAlphaAPI.util.generateUID(),
    },
  });

  // Archive the old block
  archiveBlock(pageUid, oldBlockUid);

  // Open new block in sidebar
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: 'block',
      'block-uid': newBlockUid,
    },
  });
}

function resolveCompletedObject(
  pageUid: string,
  resolvedObjectUid: string
): void {
  // Archive the resolved object
  archiveBlock(pageUid, resolvedObjectUid);

  // Loop over every object that depends on this object and add object to Context attribute (just parent if task; qna if question)
  let ancestorrule = `[ 
    [ (ancestor ?b ?a) 
         [?a :block/children ?b] ] 
    [ (ancestor ?b ?a) 
         [?parent :block/children ?b ] 
         (ancestor ?parent ?a) ] ] ]`;
  const dependeeObjectUids = window.roamAlphaAPI.q(
    `[:find ?uids :in $ ?resolved-uid
      :where [?resolved :block/uid ?resolved-uid]
             [?refs :block/refs ?resolved]
             [?refs :block/parents ?parents]
             [?parents :block/children ?refs]
             [?parents :block/string "Depends On::"]
             [?parents :block/parents ?blocks]
             [?blocks :block/children ?parents]
             [?blocks :block/uid ?uids]]`,
    resolvedObjectUid
  )[0];

  dependeeObjectUids.forEach((dependeeUid) => {
    // Remove the resolved object from Depends On
    const dependsOnRefBlockUid = window.roamAlphaAPI.q(
      `[:find ?uid :in $ ?dependee-uid ?resolved-uid
        :where [?d :block/uid ?dependee-uid]
               [?resolved :block/uid ?resolved-uid]
               [?d :block/children ?c]
               [?c :block/string "Depends On::"]
               [?c :block/children ?deps]
               [?deps :block/refs ?resolved]
               [?deps :block/uid ?uid]]`,
      dependeeUid,
      resolvedObjectUid
    )[0][0];
    window.roamAlphaAPI.data.block.delete({
      block: {
        uid: dependsOnRefBlockUid,
      },
    });

    // assuming it exists
    const contextAttributeUid = window.roamAlphaAPI.q(
      `[:find ?uid :in $ ?dependee-uid
        :where [?d :block/uid ?dependee-uid]
               [?d :block/children ?c]
               [?c :block/string "Context::"]
               [?c :block/uid ?uid]]`,
      dependeeUid
    )[0][0];

    const resolvedBlockRefBlockUid = window.roamAlphaAPI.util.generateUID();

    window.roamAlphaAPI.data.block.create({
      location: {
        'parent-uid': contextAttributeUid,
        order: 0,
      },
      block: {
        uid: resolvedBlockRefBlockUid,
        string: `((${resolvedObjectUid}))`,
      },
    });
  });
}

runExtension(extensionId, () => {
  window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: 'Archive Block',
    callback: (e) => {
      const blockUid = e['block-uid'];
      const pageUid = e['page-uid'];
      archiveBlock(pageUid, blockUid);
    },
  });
  window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: 'Refactor Block',
    callback: (e) => {
      const blockUid = e['block-uid'];
      const pageUid = e['page-uid'];
      refactorBlock(pageUid, blockUid);
    },
  });
  window.roamAlphaAPI.ui.blockContextMenu.addCommand({
    label: 'Resolve Block',
    callback: (e) => {
      const blockUid = e['block-uid'];
      const pageUid = e['page-uid'];
      resolveCompletedObject(pageUid, blockUid);
    },
  });
  console.log(extensionId);
});
