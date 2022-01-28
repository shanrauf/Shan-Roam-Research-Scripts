export async function refactorBlock(
  _: string,
  oldBlockUid: string
): Promise<void> {
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
