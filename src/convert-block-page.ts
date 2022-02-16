import { toRoamDateUid, findOrCreateCurrentDNPUid } from './util';
import { RoamQPullBlock } from './types';

function getUidsFromId(id: string) {
  const blockUid = id.substring(id.length - 9, id.length);
  const restOfHTMLId = id.substring(0, id.length - 9);
  const potentialDateUid = restOfHTMLId.substring(
    restOfHTMLId.length - 11,
    restOfHTMLId.length - 1
  );
  const parentUid = isNaN(new Date(potentialDateUid).valueOf())
    ? potentialDateUid.substring(1)
    : potentialDateUid;
  return {
    blockUid,
    parentUid,
  };
}

export function getUids(block: HTMLDivElement | HTMLTextAreaElement) {
  return block ? getUidsFromId(block.id) : { blockUid: '', parentUid: '' };
}

export async function convertBlockToPage(blockUid: string): Promise<void> {
  // Quickly minimize the block to hide the conversion
  window.roamAlphaAPI.data.block.update({
    block: {
      uid: blockUid,
      open: false,
    },
  });

  const block: RoamQPullBlock = await window.roamAlphaAPI.q(
    `[:find (pull ?e [:block/string :block/order :block/uid {:block/_refs 2} {:block/children 2}]) :in $ ?uid :where [?e :block/uid ?uid]]`,
    blockUid
  )?.[0]?.[0];
  const blockStr = block.string;

  // Create the page and update the block like this so it looks instant
  await window.roamAlphaAPI.data.block.update({
    block: {
      uid: blockUid,
      string: `[[${blockStr}]]`,
    },
  });

  // Now find that page's UID
  const newPageUid = await window.roamAlphaAPI.q(
    `[:find ?uid :in $ ?block-string :where [?e :node/title ?block-string] [?e :block/uid ?uid]]`,
    blockStr
  )[0][0];

  if (block?.children) {
    // Loop over children and move to new page.
    for (const c of block?.children) {
      const childUid = c.uid;
      const blockOrder = c.order;
      await window.roamAlphaAPI.data.block.move({
        location: {
          'parent-uid': newPageUid,
          order: blockOrder,
        },
        block: {
          uid: childUid,
        },
      });
    }
  }

  // @ts-ignore
  const backlinks: RoamQPullBlock[] = block['_refs'];
  if (backlinks?.length) {
    for (const link of backlinks) {
      const newStr = link.string.replaceAll(
        `((${block.uid}))`,
        `[[${block.string}]]`
      );
      await window.roamAlphaAPI.data.block.update({
        block: {
          uid: link.uid,
          string: newStr,
        },
      });
    }
  }
}

export async function convertPageToBlock(pageUid: string): Promise<void> {
  const today = new Date();
  const todayUid = toRoamDateUid(today);
  const focusedWindow = window.roamAlphaAPI.ui.getFocusedBlock();
  const onMainView = !window.roamAlphaAPI.ui.rightSidebar
    .getWindows()
    .find((w) => w['window-id'] === focusedWindow['window-id']);

  const page: RoamQPullBlock = await window.roamAlphaAPI.q(
    `[:find (pull ?e [:node/title :block/string :block/order :block/uid {:block/_refs 2} {:block/children 2}]) :in $ ?uid :where [?e :block/uid ?uid]]`,
    pageUid
  )?.[0]?.[0];

  const pageTitle = page.title;
  const newBlockUid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': todayUid,
      order: -1,
    },
    block: {
      uid: newBlockUid,
      string: pageTitle,
    },
  });

  if (page?.children) {
    for (const c of page.children) {
      const childUid = c.uid;
      const blockOrder = c.order;
      await window.roamAlphaAPI.data.block.move({
        location: {
          'parent-uid': newBlockUid,
          order: blockOrder,
        },
        block: {
          uid: childUid,
        },
      });
    }
  }

  // @ts-ignore
  const backlinks: RoamQPullBlock[] = page['_refs'];
  if (backlinks?.length) {
    for (const link of backlinks) {
      const newStr = link.string.replaceAll(
        `[[${page.title}]]`,
        `((${newBlockUid}))`
      );

      await window.roamAlphaAPI.data.block.update({
        block: {
          uid: link.uid,
          string: newStr,
        },
      });
    }
  }

  await window.roamAlphaAPI.data.page.delete({
    page: {
      uid: pageUid,
    },
  });

  if (onMainView) {
    window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: newBlockUid,
      },
    });
  } else {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        type: 'block',
        'block-uid': newBlockUid,
      },
    });
  }
}
