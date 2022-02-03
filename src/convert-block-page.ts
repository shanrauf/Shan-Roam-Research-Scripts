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

async function convertBlockToPage(blockUid: string): Promise<void> {
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
    `[:find ?uid :where [?e :node/title "${blockStr}"] [?e :block/uid ?uid]]`
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

async function convertPageToBlock(pageUid: string): Promise<void> {
  const today = new Date();
  const todayUid = toRoamDateUid(today);

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
  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: 'block',
      'block-uid': newBlockUid,
    },
  });
}

export async function setupConvertBlockPage(): Promise<void> {
  // Setup keyboard shortcuts for both
  document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyW') {
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
          `[:find ?uid :where [?e :node/title "${pageTitle}"] [?e :block/uid ?uid]]`
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
    }
  });
}
