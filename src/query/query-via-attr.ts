import { RoamBlock } from 'roam-research-js/lib/roam-alpha-api/block';
import { toRoamDateUid } from '../convert-block-page';
import { RoamQPullBlock } from './../types';
type AttributeValue = {
  type: 'text' | 'number' | 'ref' | 'date-ref';

  /* Raw value or ref UID */
  value: 'string';
};

const allRefsRegex = /\(\(([^()]+)\)\)|\[\[([^\[\]]+)\]\]/gm;
const whitespaceOnlyRegex = /\A\s*\z/;

const getBlockAttributesRule = `
[(block-attributes ?block ?attrs)
 [?block :attrs/lookup ?l]
 [?block :attrs/lookup ?attrs]
 [?attrs :node/title ?attr-title]
 [?l :block/string ?str]
 [(str ?attr-title "::") ?roam-attr]
 [(clojure.string/starts-with? ?str ?roam-attr)]]
`;
const attributeValuesRule = `
[(attribute-values ?blocks ?attrs ?v)
  ;; Defining variables
  [?blocks :attrs/lookup ?l]
  (block-attributes ?blocks ?attrs)
  [?attrs :node/title ?attr-str] ; TODO still have ?attr here and elsewhere...
  [(str ?attr-str "::") ?roam-attr]

  ;; Variables for parsing one-liner attributes w/o clojure.string
  [(count ?attr-str) ?attr-title-len]
  [(+ ?attr-title-len 2) ?roam-attr-len]

  ;; Extract value
  (or-join
   [?l ?attrs ?v ?roam-attr ?roam-attr-len]
   ;; attr children values
   ;; i.e. blocks where immediate parent is attr
   (and [?l :block/parents ?parent]
        [?parent :block/refs ?attrs]
        [?parent :block/children ?l]
        [?l :block/string ?v]
        ; Filter out the attribute block
        [(!= ?v ?roam-attr)])
    ;; One-liner i.e. Attr:: value
    ;;; assuming no [[Attribute]] or nested attr
   (and [?l :block/refs ?attrs]
        [?l :block/string ?v]
        ; Hacky parsing: "Attr:: val" -> " val"
        [(subs ?v ?roam-attr-len) ?v]
        (and [(clojure.string/starts-with? ?v " ")]
             [(subs ?v 1) ?v])))]
`;

const queryRules = `
[${attributeValuesRule}
 ${getBlockAttributesRule}]
`;

function attributeValueRefs(blockStr: string): boolean {
  console.log(blockStr);
  let remainingStr = blockStr.replaceAll(allRefsRegex, '');
  // TODO?, you need to filter out the attr ref if it's a one-liner; do in datalog w an extra data clause
  return !!remainingStr.match(whitespaceOnlyRegex)?.length;
}

function attributeValuesRuleJS() {
  return `
  ;; Defining variables
  [?blocks :attrs/lookup ?l]
  (block-attributes ?blocks ?attrs)
  [?attrs :node/title ?attr-str] ; TODO still have ?attr here and elsewhere...
  [(str ?attr-str "::") ?roam-attr]

  ;; Variables for parsing one-liner attributes w/o clojure.string
  [(count ?attr-str) ?attr-title-len]
  [(+ ?attr-title-len 2) ?roam-attr-len]

  ;; Extract value
  (or-join
   [?l ?attrs ?v ?roam-attr ?roam-attr-len]
   ;; attr children values
   ;; i.e. blocks where immediate parent is attr
   (and [?l :block/parents ?parent]
        [?parent :block/refs ?attrs]
        [?parent :block/children ?l]
        [?l :block/string ?v]
        ; Filter out the attribute block
        [(!= ?v ?roam-attr)])
    ;; One-liner i.e. Attr:: value
    ;;; assuming no [[Attribute]] or nested attr
   (and [?l :block/refs ?attrs]
        [?l :block/string ?v]
        ; Hacky parsing: "Attr:: val" -> " val"
        [(subs ?v ?roam-attr-len) ?v]
        (and [(clojure.string/starts-with? ?v " ")]
             [(subs ?v 1) ?v])))
  `;
}

export function blockAndItsAttributes() {
  return window.roamAlphaAPI.q(
    `
  [:find ?block ?attributes
   :where [?block :block/uid "Po9tImibY"]
          [(rd/q [:find ?attrs
                    :where [?block :attrs/lookup ?l]
                    [?block :attrs/lookup ?attrs]
                    [?attrs :node/title ?attr-title]
                    [?l :block/string ?str]
                    [(str ?attr-title "::") ?roam-attr]
                    [(clojure.string/starts-with? ?str ?roam-attr) ?attributes]]
  `
  );
}

export function attributeValues(blockUid: string): any[] {
  return window.roamAlphaAPI.q(
    `
    [:find ?blocks ?attrs ?v
      :in $ ?is-ref-values %
      :where [?blocks :block/uid "Po9tImibY"]
             ${attributeValuesRuleJS()}]
  `,
    attributeValueRefs,
    queryRules
  );
}

// (and [(?is-ref-values ?v)]
//[?l :block/refs ?v]
//; Filter out attribute ref
//(not [?v :block/refs ?attrs]))
