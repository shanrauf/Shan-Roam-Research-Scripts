import { RoamQPullBlock } from './../types';

// export const parseRoamDate = (s: string) =>
//   parse(s, "MMMM do, yyyy", new Date());

function parseQuery(block: RoamQPullBlock, branchType: 'OR' | 'AND'): string {
  const blockString = block.string.trim();

  let childClauses = [];
  for (const child of block?.children) {
    childClauses.push(parseQuery(child, 'AND'));
  }
  switch (blockString.toUpperCase()) {
    case 'OR':
      return `(or ${childClauses.join(' ')})`;
    case 'AND':
      if (branchType === 'OR') {
        return `(and ${childClauses.join(' ')})`;
      }
      return childClauses.join(' ');
    case 'NOT':
      return `(not ${childClauses.join(' ')})`;
  }

  // Roam native query
  if (blockString.startsWith('{{') && blockString.endsWith('}}')) {
    // parse by looking for {} capture group regex, getting if its and/or/etc, then slicing from after the ":" like from and:, and then repeating
    // {and: [page1] {not: [page2]}}
    const queryContent = blockString.slice(blockString.indexOf(':')).trim();
  }
  // Check if queryViaAttr
  const queryViaAttr = blockString.split('::');
  const attribute = queryViaAttr?.[0]?.trim();
  if (attribute) {
    const operator = queryViaAttr?.[1]?.trim()[0];
    const value = queryViaAttr?.[1]?.trim().slice(1);
    // Check if date ref
    const DAILY_NOTE_PAGE_REGEX =
      /(January|February|March|April|May|June|July|August|September|October|November|December) [0-3]?[0-9](st|nd|rd|th), [0-9][0-9][0-9][0-9]/;
    const DAILY_NOTE_PAGE_TITLE_REGEX = new RegExp(
      `^[[${DAILY_NOTE_PAGE_REGEX.source}]]$`
    );

    const dnpRef = blockString.match(DAILY_NOTE_PAGE_TITLE_REGEX)?.[0];
    if (dnpRef) {
      const value = {
        type: 'date-ref',
        text: dnpRef,
        value: '',
      };
    }

    // Check if normal ref

    // Check if number

    // otherwise treat as raw text
    return `[?attribute :node/title "${attribute}"]
            (attribute-query ?blocks ?attribute "${value}")`;
  }

  // Check if raw ref
  // TODO not allowing raw blocks anymore. so just extract refs from a block..?
  // mm but so u need to check for query via attr first  cuz thsoe values could be refs.
  const page_ref_only_regex = '^[[(.*?)]]$';
  const block_ref_only_regex = '^(((.*?)))$';
  // const regexp = /\([()]*(\([^()]*\)[^()]*)*\)/g;
  // let blockRefs = blockString.match(regexp)
  const blockRefMatch = blockString.match(block_ref_only_regex);
  if (blockRefMatch) {
    const ref = blockRefMatch[0];
    return `[?blocks :block/uid "${ref}"]`;
  }
  const pageRefMatch = blockString.match(page_ref_only_regex);
  if (pageRefMatch) {
    const title = pageRefMatch[0];
    return `[?blocks :node/title "${title}"]`;
  }

  return '';
}

function parseRoamNativeQuery(query: string) {}

function generateDatalogClauses() {}
