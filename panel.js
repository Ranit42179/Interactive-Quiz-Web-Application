const chatBox = document.getElementById("chatBox");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const typingEl = document.getElementById("typing");
const minimizeBtn = document.getElementById("minimizeBtn");
const closeBtn = document.getElementById("closeBtn");

const attachmentTextEl = document.getElementById("attachmentText");
const attachmentIndicator = document.getElementById("attachmentIndicator");
const removeAttachmentBtn = document.getElementById("removeAttachment");

let chatHistory = [];
let selectedAvatar = "";
let attachedText = "";

// Event listener when DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
  const greeting = "Hello, how can I help you?";
  appendMessage("bot", greeting);
  chatHistory.push({ role: "assistant", content: greeting });

  // Fetch avatar from Chrome storage
  chrome.storage.sync.get("selectedAvatar", (data) => {
    selectedAvatar = data.selectedAvatar || "man.png"; // Fallback avatar if none found
  });
});

// Function to send message
sendBtn.onclick = async () => {
  const userText = userInput.value.trim();
  if (!userText) return; // Ignore empty messages

  // Append user message to chat
  appendMessage("user", userText);
  userInput.value = ""; // Clear input field
  typingEl.textContent = "AI is typing..."; // Show typing indicator

  let fullPrompt = userText;

  // Include attached content if any
  if (attachedText) {
    fullPrompt += `\n\n---\nSelected Content:\n${attachedText}`;
  }

  // Add user input to chat history
  chatHistory.push({ role: "user", content: fullPrompt });

  try {
    const response = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory,
        avatarImage: selectedAvatar
      })
    });

    // Handle server response
    const data = await response.json();
    const aiReply = data.text || "No response from AI";

    appendMessage("bot", aiReply); // Append bot response
    chatHistory.push({ role: "assistant", content: aiReply });

    // Send AI reply to content script to display below avatar
    window.parent.postMessage({
      type: "REPLACE_VIDEO",
      text: aiReply
    }, "*");

  } catch (err) {
    console.error("❌ Error:", err);
    appendMessage("bot", "⚠️ Failed to reach AI server. Please try again.");
  } finally {
    typingEl.textContent = ""; // Hide typing indicator
  }
};

// Function to append messages to chat
function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to the bottom
}

// Listen for selected text from content script
window.addEventListener("message", (e) => {
  if (e.data?.type === "SELECTED_TEXT") {
    attachedText = e.data.payload;

    // Update attachment UI if text is selected
    if (attachedText && attachedText.trim() !== "") {
      attachmentTextEl.textContent = "📎 " + attachedText;
      attachmentIndicator.style.display = "flex";
    }
  }

  // Listen for speech-to-text input and update the userInput field
  if (e.data?.type === "UPDATE_USER_INPUT" && e.data.transcript) {
    // Update the user input field with speech-to-text result
    userInput.value = e.data.transcript;
  }
});

// Handle attachment removal
removeAttachmentBtn.onclick = () => {
  attachedText = "";
  attachmentIndicator.style.display = "none"; // Hide attachment indicator
};

// Minimize and close panel interactions
minimizeBtn.onclick = () => {
  window.parent.postMessage("minimize-ai-panel", "*"); // Notify to minimize panel
};

closeBtn.onclick = () => {
  window.parent.postMessage("close-ai-panel", "*"); // Notify to close panel
};

// Track the current focus stage
let focusStage = 0;  // 0 - Chat Panel, 1 - User Input, 2 - Send Button

// Listen for keydown events
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {  // Spacebar is pressed
    event.preventDefault();  // Prevent default space behavior (scrolling)

    
  
    if (focusStage === 0) {
      // Trigger the send button click
      document.getElementById("sendBtn").click();
      focusStage = 0;  // Reset focus cycle to chat panel
    }
  }
});

