// @ts-nocheck
export function setupAliasTabKeybind() {
  setTimeout(() => {
    [...document.querySelectorAll('div#app, div.roam-app')].forEach((elem) => {
      elem.addEventListener('keydown', (e) => {
        if (e.code === 'Tab' && !e.shiftKey) {
          const txtArea = document.activeElement;
          txtArea.selectionEnd += 2;
          const sele = window.getSelection().toString();
          let match = '';

          if ((match = sele.match(/^\]\(/))) {
            e.preventDefault();
            e.stopImmediatePropagation();
            let alias = txtArea.value
              .substring(0, txtArea.selectionStart)
              .match(/[^\[]*$/);

            txtArea.selectionStart += match[0].length;
            txtArea.selectionEnd -= sele.length - match[0].length;

            if (alias[0].length > 1 && e.ctrlKey) {
              alias = '[[' + alias[0] + ']]';
              txtArea.setRangeText(
                alias,
                txtArea.selectionStart,
                txtArea.selectionStart,
                'end'
              );
              txtArea.selectionEnd -= 2;
              txtArea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else if (
            (match = sele.match(/^\)(?!\))/)) ||
            (match = sele.match(/^\](?!\])/)) ||
            (match = sele.match(/^\}(?!\{)/)) ||
            (match = sele.match(/^\}\{/)) ||
            (match = sele.match(/^\$\$/))
          ) {
            e.preventDefault();
            e.stopImmediatePropagation();

            txtArea.selectionStart += match[0].length;
            txtArea.selectionEnd -= sele.length - match[0].length;
          } else txtArea.selectionEnd -= sele.length;
        }
      });
    });
  }, 1);
}
