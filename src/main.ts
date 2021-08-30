import { TreeNode } from 'roam-client';
import { runExtension, replaceText, replaceTagText } from './entry-helpers';

const extensionId = 'roam-personal-scripts';

const archivedNotes = 'Archived Notes';
const archivedNotesAttribute = `${archivedNotes}::`;

function archiveBlock() {
  const uidToArchive = window.roamAlphaAPI.ui.getFocusedBlock()['block-uid'];
  if (!uidToArchive) return;

  // Get or create Archived Notes attribute on the page
  let [archivedNotesAttributeUid, pageUid] = window.roamAlphaAPI
    .q(`[:find ?attr-uid ?page-uid :in $ ?block-uid
                                                         :where [?b :block/uid ?block-uid]
                                                                [?b :block/page ?p]
                                                                [?p :block/uid ?page-uid]
                                                                [?p :block/children ?c]
                                                                [?a :node/title "Archived Notes"]
                                                                [?c :block/refs ?a]
                                                                [?c :block/uid ?attr-uid]]`)[0][0];
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
      'parent-uid': pageUid,
      order: 0,
    },
    block: {
      uid: uidToArchive,
    },
  });
}

function refactorBlock() {}

function resolveCompletedObject() {}

type Shortcut = {
  text: string;
  callback: () => void;
  uid: string;
};

const shortcuts: { [key: string]: Shortcut } = {
  'archive-block': {
    uid: 'archive-block',
    callback: archiveBlock,
    text: 'CTRL+SHIFT+A',
  },
  refactor: {
    uid: 'refactor',
    callback: refactorBlock,
    text: 'CTRL+SHIFT+W',
  },
  'resolve-completed-object': {
    uid: 'resolve-completed-object',
    callback: resolveCompletedObject,
    text: 'CTRL+SHIFT+O',
  },
};

const config: { [blockUid: string]: (e: KeyboardEvent) => void } = {};
const blockUidsByKeystroke: { [keystroke: string]: Set<string> } = {};
const root = document.getElementsByClassName('roam-app')[0] || document;

const cleanConfig = (blockUid: string) => {
  if (config[blockUid]) {
    root.removeEventListener('keydown', config[blockUid]);
    delete config[blockUid];
    const uids = Object.values(blockUidsByKeystroke).find((v) =>
      v.has(blockUid)
    );
    if (uids) {
      uids.delete(blockUid);
    }
  }
};

// Taken and modified from David Vargas tag-cycle code
const configureShortcut = (shortcut: Shortcut) => {
  const parts = shortcut.text.split('+').map((s) => s.toUpperCase().trim());
  const modifier = parts[0];
  const isShift = parts[1] === 'SHIFT';
  const keyParts = parts[parts.length - 1].split(' ') || [''];
  const key = keyParts[0];
  const isTriggered = (e: KeyboardEvent) => {
    if (modifier === 'ALT' && !e.altKey) {
      return false;
    }
    if (modifier === 'OPT' && !e.altKey) {
      return false;
    }
    if (modifier === 'CMD' && !e.metaKey) {
      return false;
    }
    if (modifier === 'WIN' && !e.metaKey) {
      return false;
    }
    if (modifier === 'CTRL' && !e.ctrlKey) {
      return false;
    }
    if (isShift && !e.shiftKey) {
      return false;
    }
    if (key === 'SPACE' && e.key === ' ') {
      return true;
    }
    if (key === e.key.toUpperCase()) {
      return true;
    }
    return false;
  };
  cleanConfig(shortcut.uid);
  const keyStroke = [...parts.slice(0, parts.length - 1), key].join('+');
  if (blockUidsByKeystroke[keyStroke]) {
    blockUidsByKeystroke[keyStroke].add(shortcut.uid);
  } else {
    blockUidsByKeystroke[keyStroke] = new Set([shortcut.uid]);
  }
  config[shortcut.uid] = async (e: KeyboardEvent) => {
    shortcut.callback();
    e.preventDefault();
    e.stopPropagation();
  };
  root.addEventListener('keydown', config[shortcut.uid]);
};

runExtension(extensionId, () => {
  Object.values(shortcuts).forEach((shortcut) => {
    configureShortcut(shortcut);
  });
  console.log(extensionId);
});
