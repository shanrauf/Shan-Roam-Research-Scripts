import { getCurrentPageUid } from './entry-helpers';
import { toRoamDateUid, getUids } from 'roam-client';
import { RoamQPullBlock } from './types';
function convertBlockToPage(blockUid: string): void {
  const block: RoamQPullBlock = window.roamAlphaAPI.q(
    `[:find (pull ?e [:block/string :block/children :block/order :block/uid {:block/children 2}]) :in $ ?uid :where [?e :block/uid ?uid]]`,
    blockUid
  )?.[0]?.[0];
  const blockStr = block.string;
  const newPageUid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.data.page.create({
    page: {
      title: blockStr,
      uid: newPageUid,
    },
  });

  // Loop over children and move to new page.
  block.children.forEach((c) => {
    const childUid = c.uid;
    const blockOrder = c.order;
    console.log(c);
    window.roamAlphaAPI.data.block.move({
      location: {
        'parent-uid': newPageUid,
        order: blockOrder,
      },
      block: {
        uid: childUid,
      },
    });
  });

  window.roamAlphaAPI.data.block.update({
    block: {
      uid: blockUid,
      string: `[[${blockStr}]]`,
    },
  });
}

function convertPageToBlock(pageUid: string) {
  const today = new Date();
  const todayUid = toRoamDateUid(today);

  const page: RoamQPullBlock = window.roamAlphaAPI.q(
    `[:find (pull ?e [:node/title :block/children :block/order :block/uid {:block/children 2}]) :in $ ?uid :where [?e :block/uid ?uid]]`,
    pageUid
  )?.[0]?.[0];

  const pageTitle = page.title;
  const newBlockUid = window.roamAlphaAPI.util.generateUID();
  window.roamAlphaAPI.data.block.create({
    location: {
      'parent-uid': todayUid,
      order: 0,
    },
    block: {
      uid: newBlockUid,
      string: pageTitle,
    },
  });

  page.children.forEach((c) => {
    const childUid = c.uid;
    const blockOrder = c.order;
    window.roamAlphaAPI.data.block.move({
      location: {
        'parent-uid': newBlockUid,
        order: blockOrder,
      },
      block: {
        uid: childUid,
      },
    });
  });

  window.roamAlphaAPI.data.page.delete({
    page: {
      uid: pageUid,
    },
  });
  window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: 'block',
      'block-uid': newBlockUid,
    },
  });
}

export function setupConvertBlockPage(): void {
  // Setup keyboard shortcuts for both
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyB') {
      const currentlyEditingBlock = document.querySelector(
        'textarea.rm-block-input'
      ) as HTMLTextAreaElement;
      const currentBlockUid = getUids(currentlyEditingBlock)?.blockUid;
      convertBlockToPage(currentBlockUid);
    } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyQ') {
      let pageUid = '';
      const currentBlockUid =
        window.roamAlphaAPI.ui.getFocusedBlock()?.['block-uid'];
      console.log({ currentBlockUid });
      if (currentBlockUid) {
        pageUid = window.roamAlphaAPI.q(
          `[:find ?uid :in $ ?block-uid :where [?b :block/uid ?block-uid] [?b :block/page ?p] [?p :block/uid ?uid]]`,
          currentBlockUid
        )?.[0]?.[0];
      } else {
        // Get pageUid from main view as default behavior
        const uid = getCurrentPageUid();
        pageUid =
          window.roamAlphaAPI.q(
            `[:find ?page-uid
              :in $ ?uid
              :where [?e :block/uid ?uid]
                      [?e :block/page ?p]
                      [?p :block/uid ?page-uid]]`,
            uid
          )?.[0]?.[0] || uid;
      }

      const DAILY_NOTE_UID_REGEX =
        /^(0?[1-9]|1[012])\-(0?[1-9]|[12][0-9]|3[01])\-\d{4}$/;
      if (!pageUid || pageUid.match(DAILY_NOTE_UID_REGEX)?.length) return;

      convertPageToBlock(pageUid);
    }
  });
}
