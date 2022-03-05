(ns global-filter-presets.core)

(def roam-attr-list
  ["Type" "Status" "Goals" "Current Plan" "References" "Note Strength" "Examples" "Fleeting Notes" "Content Notes"
   "Introduced By" "First Impression" "Description" "roam/aliases" "Deadline" "Speaker(s)" "URL", "Recommended By"
   "Author" "Source/Publisher" "Artist(s)" "Date(s)" "Date" "Instrument(s)" "From/Since" "To/Until" "Next Action(s)"
   "Recurrence" "Ingredients" "Tools (attr)" "Recipe" "Review After" "Conclusion" "As of" "Date Start" "Date Started"
   "Date Finished" "Date End" "Date Released" "Location" "Intentions For The Day" "Grade" "Archived Notes"
   "What's On My Mind" "Log" "Day Overview" "Music I'm Listening to"])

(defn- clear-global-filters [includes removes]
  (doseq [b includes] (. js/window.roamAlphaAPI.ui.filters removeGlobalFilter (clj->js {:title b
                                                                                        :type "includes"})))
  (doseq [b removes] (. js/window.roamAlphaAPI.ui.filters removeGlobalFilter (clj->js {:title b
                                                                                       :type "removes"}))))

(. js/document
   addEventListener
   "keydown"
   (fn [e]
     (when (= (.-key e)
              "F1")
       (. e preventDefault)
       (let [{:strs [includes removes]} (-> (. js/window.roamAlphaAPI.ui.filters getGlobalFilters)
                                            js->clj)]
         (if (or (seq includes)
                 (seq removes))
           (clear-global-filters includes removes)
           (. js/window.roamAlphaAPI.ui.filters addGlobalFilter (clj->js {:title "TODO"
                                                                          :type "includes"})))))
     (when (= (.-key e)
              "F2")
       (. e preventDefault)
       (let [{:strs [includes removes]} (-> (. js/window.roamAlphaAPI.ui.filters getGlobalFilters)
                                            js->clj)]
         (if (or (seq includes)
                 (seq removes))
           (clear-global-filters includes removes)
           (doseq [attr roam-attr-list]
             (. js/window.roamAlphaAPI.ui.filters addGlobalFilter (clj->js {:title attr
                                                                            :type "removes"}))))))))
