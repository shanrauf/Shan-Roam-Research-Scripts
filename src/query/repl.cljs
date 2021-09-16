(ns tiny-repl
  (:require
   [reagent.core :as r]
   [roam.datascript :as rd]))

(defn enter? [e] (= 13 (.-charCode e)))

#_:clj-kondo/ignore
(defn main []
  (let [evaled (r/atom "")
        current (r/atom "")
        eval! (fn []
                (swap! evaled str
                       "\n=>" @current
                       "\n"
                       #_:clj-kondo/ignore
                       (eval (read-string @current)))
                (reset! current ""))]
    (fn []
      [:div
       [:pre>code @evaled]
       [:input
        {:value @current
         :onChange (fn [e]
                     (reset! current (.. e -target -value)))
         :on-key-press (fn [e]
                         (when (enter? e) (eval!)))}]])))