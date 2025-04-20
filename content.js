let panelIframe;
let selectedAvatar = null;
let availableVoices = [];
let lastSpokenText = "";
let currentUtterance = null;
let isMuted = false;
let isProcessingSpeech = false;
let avatarContainer = null;
let captionBox = null;

// Load available voices for speech synthesis
function loadVoices() {
  availableVoices = speechSynthesis.getVoices();
  if (!availableVoices.length) {
    speechSynthesis.onvoiceschanged = () => {
      availableVoices = speechSynthesis.getVoices();
    };
  }
}
loadVoices();

// Cancel any speaking on page unload
window.addEventListener("beforeunload", () => {
  speechSynthesis.cancel();
});

// Speak text sentence by sentence
function speakText(text) {
  if (!text || isProcessingSpeech) return;
  speechSynthesis.cancel();

  // Split the text into parts based on sentence-like endings
  const sentences = splitSentences(text);
  let index = 0;

  function speakNext() {
    if (index >= sentences.length) {
      hideCaption();
      return;
    }

    const sentence = sentences[index++].trim();
    currentUtterance = new SpeechSynthesisUtterance(sentence);
    currentUtterance.lang = "en-US";

    if (availableVoices.length) {
      const preferredVoice = availableVoices.find(v => /female/i.test(v.name + v.voiceURI)) || availableVoices[0];
      currentUtterance.voice = preferredVoice;
    }

    currentUtterance.volume = isMuted ? 0 : 1;
    currentUtterance.onstart = () => showCaption(sentence);
    currentUtterance.onend = () => speakNext();

    speechSynthesis.speak(currentUtterance);
  }

  speakNext();
}

// Smart sentence splitting (handles punctuation and incomplete sentences)
function splitSentences(text) {
  // Match complete sentences or fragments without periods or punctuation marks
  const sentenceEndings = /[.!?]+/g;
  let sentences = text.split(sentenceEndings).filter(Boolean);

  let result = [];
  let currentSentence = '';

  sentences.forEach((sentence, index) => {
    // Add the sentence part to the currentSentence and check if we should complete it
    currentSentence += sentence.trim() + (text.match(sentenceEndings)[index] || ' ');

    // If the sentence looks complete or we have reached a good stopping point, push it
    if (currentSentence.trim().endsWith('.') || currentSentence.trim().endsWith('?') || currentSentence.trim().endsWith('!')) {
      result.push(currentSentence.trim());
      currentSentence = ''; // Reset for the next part
    }
  });

  // In case there's an incomplete sentence remaining
  if (currentSentence.trim()) {
    result.push(currentSentence.trim());
  }

  return result;
}

// Show floating caption text (line-by-line like movie subtitles)
function showCaption(text) {
  if (!captionBox) {
    captionBox = document.createElement("div");
    captionBox.id = "floating-caption-box";
    captionBox.style.cssText = `
      position: fixed;
      bottom: 10%;
      left: 50%;
      transform: translateX(-50%);
      background: #ffffff;
      color: #2d3436;
      font-size: 0.95rem;
      padding: 12px 24px;
      border-radius: 12px;
      z-index: 999999;
      max-width: 70%;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border: 1px solid #e0e0e0;
      font-weight: 500;
      text-align: center;
      line-height: 1.4;
      white-space: pre-wrap;
      backdrop-filter: blur(4px);
    `;
    document.body.appendChild(captionBox);
  }

  captionBox.textContent = text;
  captionBox.style.display = "block";
}

function hideCaption() {
  if (captionBox) captionBox.style.display = "none";
}

// Inject the side panel iframe (remains unchanged)
function injectPanel(isMinimized = false) {
  if (document.getElementById("ai-panel")) return;

  panelIframe = document.createElement("iframe");
  panelIframe.src = chrome.runtime.getURL("panel.html");
  panelIframe.id = "ai-panel";
  panelIframe.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 350px;
    height: 100%;
    z-index: 999999999;
    border: none;
    display: ${isMinimized ? "none" : "block"};
  `;
  document.body.appendChild(panelIframe);

  if (isMinimized) showRestoreButton();

  window.addEventListener("message", (e) => {
    if (e.data === "close-ai-panel") {
      chrome.storage.sync.set({ agreedToPanel: false, panelMinimized: false });
      panelIframe.remove();
      hideRestoreButton();
      if (avatarContainer) avatarContainer.remove();
      if (captionBox) captionBox.remove();
      speechSynthesis.cancel();
    }

    if (e.data === "minimize-ai-panel") {
      chrome.storage.sync.set({ panelMinimized: true });
      panelIframe.style.display = "none";
      showRestoreButton();
    }

    if (e.data === "restore-ai-panel") {
      chrome.storage.sync.set({ panelMinimized: false });
      panelIframe.style.display = "block";
      hideRestoreButton();
    }

    if (e.data?.type === "REPLACE_VIDEO" && e.data.text) {
      lastSpokenText = e.data.text;
      speakText(e.data.text);
    }

    if (e.data?.type === "UPDATE_USER_INPUT" && e.data.transcript) {
      const userInputField = panelIframe.contentWindow.document.getElementById("userInput");
      if (userInputField) {
        userInputField.value = e.data.transcript;
      }
    }
  });

  // Text selection handler (remains unchanged)
  document.addEventListener("mouseup", () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0 && panelIframe?.contentWindow) {
      panelIframe.contentWindow.postMessage(
        { type: "SELECTED_TEXT", payload: selectedText },
        "*"
      );
    }
  });
}

// Floating restore button (remains unchanged)
function showRestoreButton() {
  if (document.getElementById("restoreBtnIframe")) return;

  const btn = document.createElement("button");
  btn.id = "restoreBtnIframe";
  btn.textContent = "⮞";
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #0984e3, #74b9ff);
    color: white;
    border-radius: 12px;
    border: none;
    font-size: 24px;
    z-index: 999999999;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(9, 132, 227, 0.3);
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  btn.onmouseenter = () => {
    btn.style.transform = "scale(1.05)";
    btn.style.boxShadow = "0 6px 16px rgba(9, 132, 227, 0.4)";
  };
  btn.onmouseleave = () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 4px 12px rgba(9, 132, 227, 0.3)";
  };
  btn.onclick = () => window.postMessage("restore-ai-panel", "*");
  document.body.appendChild(btn);
}

function hideRestoreButton() {
  const btn = document.getElementById("restoreBtnIframe");
  if (btn) btn.remove();
}

// Restore panel state on startup (remains unchanged)
chrome.storage.sync.get(["agreedToPanel", "panelMinimized"], (data) => {
  if (data.agreedToPanel) {
    injectPanel(data.panelMinimized || false);
  }
});

// Listen for extension messages (remains unchanged)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SHOW_PANEL") {
    selectedAvatar = msg.avatar;
    chrome.storage.sync.get("panelMinimized", (data) => {
      injectPanel(data.panelMinimized || false);
    });

    const imgSrc = chrome.runtime.getURL(msg.avatar);
    if (!document.getElementById("floating-avatar-container")) {
      avatarContainer = document.createElement("div");
      avatarContainer.id = "floating-avatar-container";
      avatarContainer.style.cssText = `
         position: fixed;
         top: 80px;
         left: 80px;
         z-index: 999999;
         cursor: move;
         border-radius: 16px;
         padding: 16px;
      `;

      const img = document.createElement("img");
      img.src = imgSrc;
      img.id = "floating-avatar-img";
      img.style.cssText = `width: 270px; display: block;`;
      avatarContainer.appendChild(img);

      // Controls (remains unchanged)
      const controls = document.createElement("div");
      controls.style.cssText = `margin-top: 8px; justify-content: center; display: flex; gap: 10px;`;

      const buttonStyle = `
        background: linear-gradient(135deg, #0984e3, #74b9ff);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 6px rgba(9, 132, 227, 0.2);
      `;

      const micBtn = document.createElement("button");
      micBtn.textContent = "🎙️ Speak";
      micBtn.style.cssText = buttonStyle;

      const muteBtn = document.createElement("button");
      muteBtn.textContent = "🔊 Mute";
      muteBtn.style.cssText = buttonStyle;

      let isRecording = false;
      let recognition = null;

      if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript.trim();
          console.log("🎧 Heard:", transcript);

          panelIframe?.contentWindow?.postMessage({
            type: "UPDATE_USER_INPUT",
            transcript: transcript,
          }, "*");

          lastSpokenText = transcript;

          isProcessingSpeech = true;
          speakText(transcript);
          isProcessingSpeech = false;
        };

        recognition.onerror = (e) => console.error("🎤 Recognition error:", e);
      }

      micBtn.onclick = () => {
        if (currentUtterance && speechSynthesis.speaking) {
          speechSynthesis.cancel();
          micBtn.textContent = "🎙️ Speak";
          isRecording = false;
        }

        if (!recognition) return alert("Speech recognition not supported in this browser.");

        if (!isRecording) {
          recognition.start();
          micBtn.textContent = "🛑 Stop";
          isRecording = true;
        } else {
          recognition.stop();
          micBtn.textContent = "🎙️ Speak";
          isRecording = false;
        }
      };

      muteBtn.onclick = () => {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? "🔇 Unmute" : "🔊 Mute";
      };

      controls.appendChild(micBtn);
      controls.appendChild(muteBtn);
      avatarContainer.appendChild(controls);
      document.body.appendChild(avatarContainer);

      // Make the avatar container draggable (remains unchanged)
      makeDraggable(avatarContainer);

      // Speak greeting on load (remains unchanged)
      lastSpokenText = "Hello, how can I help you?";
      speakText(lastSpokenText);

      // Keyboard shortcut for mic (remains unchanged)
      document.addEventListener("keydown", (event) => {
        if (event.key.toLowerCase() === "m") {
          micBtn.click();
        }
      });
    }
  }
});

// Make the element draggable (remains unchanged)
function makeDraggable(element) {
  let offsetX, offsetY, isDragging = false;

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    element.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      element.style.left = e.clientX - offsetX + "px";
      element.style.top = e.clientY - offsetY + "px";
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    element.style.cursor = "grab";
  });
}
