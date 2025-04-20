let selectedAvatar = '';

const manAvatar = document.getElementById('manAvatar');

manAvatar.addEventListener('click', function () {
  manAvatar.classList.add('selected');
  selectedAvatar = 'man.png';
  document.getElementById('submitBtn').style.display = 'block';
});

document.getElementById('submitBtn').addEventListener('click', () => {
  if (selectedAvatar) {
    chrome.storage.sync.set({ selectedAvatar }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        chrome.tabs.sendMessage(tabId, {
          type: "SHOW_PANEL",
          avatar: selectedAvatar
        });

        window.close();
      });
    });
  }
});
