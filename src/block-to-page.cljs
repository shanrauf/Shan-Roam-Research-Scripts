(ns block-page-conversion.core
  (:require [clojure.string :as str]
            [roam.block :as block]
            [roam.datascript :as rd]
            [core.async :refer [go]]
            [core.async.interop :refer-macros [<p!]]))

;; (defn convert-block-to-page [uid]
;;   ; Minimize block
;;   (block/update {:block {:uid uid
;;                          :open false}})

;;   (let [block-to-convert (-> (rd/q '[:find (pull ?e [:block/string
;;                                                      :block/order
;;                                                      :block/uid
;;                                                      {:block/_refs 2}
;;                                                      {:block/children 2}])
;;                                      :in $ ?uid
;;                                      :where [?e :block/uid ?uid]]
;;                                    uid)
;;                              ffirst)
;;         block-str (:block/string block-to-convert)
;;         children (:block/children block-to-convert)]

;;     ; Create page from :block/string
;;     (block/update {:block {:uid uid
;;                            :string (str "[[" block-str "]]")}})

;;     (let [new-page-uid (-> (rd/q '[:find ?uid
;;                                    :in $ ?str
;;                                    :where [?e :node/title ?str] [?e :block/uid ?uid]]
;;                                  block-str)
;;                            ffirst)]
;;       ; Move block children to newly created page
;;       (doseq [c children]
;;         (block/move {:location {:parent-uid new-page-uid
;;                                 :order (:block/order c)}
;;                      :block {:uid (:block/uid c)}}))

;;       ; Convert backlinks to [[page refs]]
;;       (doseq [b (:block/_refs block-to-convert)]
;;         (block/update {:block {:uid (:block/uid b)
;;                                :string (str/replace (:block/string b)
;;                                                     (str "((" uid "))")
;;                                                     (str "[[" block-str "]]"))}})))))

(defn convert-block-to-page [uid]
  (go
    ; Minimize block
    (<p! (block/update {:block {:uid uid
                                :open false}}))))

; Ctrl Alt P when focused on a block
; Todo needs to be async??? idk
(. js/document
   addEventListener
   "keydown"
   (fn [e]
     (when (and (.-ctrlKey e)
                (.-altKey e)
                (= (.-code e)
                   "KeyP"))
       (convert-block-to-page (-> (. js/window.roamAlphaAPI.ui getFocusedBlock)
                                  (js->clj :keywordize-keys true)
                                  ((fn [x]
                                     (println (:block-uid x))
                                     x))
                                  :block-uid)))))

