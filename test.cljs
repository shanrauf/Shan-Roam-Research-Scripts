(ns block-page-conversion.core
  (:require [roam.block :as block]
            [core.async :refer [go]]
            [core.async.interop :refer-macros [<p!]]))

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

