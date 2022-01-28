# shan-personal-scripts

## Commands

- Archive block: `Ctrl + Shift + Delete`
- Refactor block: `Ctrl + Shift + X`
- Convert a block to a page: `Ctrl + Shift + W`
- Convert a page to a block: `Ctrl + Shift + Q`

## Installation Guide

1. Go to [[roam/js]] and paste the following code in a `/javascript` code block:

```
var existing = document.getElementById("roam/js/shan-personal-scripts");
if (!existing) {
  var extension = document.createElement("script");
  extension.src = "https://raw.githubusercontent.com/shanrauf/shan-personal-scripts/master/build/main.js";
  extension.id = "roam/js/shan-personal-scripts";
  extension.async = true;
  extension.type = "text/javascript";
  document.getElementsByTagName("head")[0].appendChild(extension);
}
```
