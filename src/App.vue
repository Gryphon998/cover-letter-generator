<template>
  <div class="container">
    <h2>{{ t('title') }}</h2>
    
    <div class="language-switcher">
    <button @click="toggleLanguage">
      {{ currentLanguage === 'en' ? '中文' : 'English' }}
    </button>
    </div>

    <!-- Status display -->
    <div id="status" :class="statusClass">{{ isLoggedIn ? t('loginMessage') : t('not_logged_in') }}</div>

    <!-- Operation feedback area (only displayed when outputMessage exists) -->
    <div v-if="globalMessage" class="global-message">
      {{ globalMessage }}
    </div>


    <!-- Login/Logout button -->
    <div class="button-group">
      <button v-if="!isLoggedIn" @click="login">{{ t('login') }}</button>
      <button v-if="isLoggedIn" @click="logout">{{ t('logout') }}</button>
    </div>
    
 
    
    <div v-if="isLoggedIn">

      <!-- Upload resume -->
      <div class="button-group">
        <input type="file" ref="fileInput" @change="handleResumeFileChange" style="display: none;" accept=".pdf" />
        <button @click="triggerResumeUpload">{{ t('upload_resume') }}</button>
      </div>

      <!-- Generate a cover letter -->
      <button id="generate" @click="generate">{{ t('generate_cover_letter') }}</button>
    
      <!-- Output area -->
      <div id="output">{{ outputMessage }}</div>
    
      <hr />

      <!-- API Key Setup -->
      <h3>Gemini API Key</h3>
      <div class="api-key-section">
        <template v-if="!apiKeySaved">
          <input type="text" v-model="apiKeyInput" :placeholder="t('api_key_placeholder')" />
          <div class="button-group">
            <button @click="saveApiKey">{{ t('save_api_key') }}</button>
            <button @click="testApiKey">{{ t('test_api_key') }}</button>
          </div>
        </template>
        <template v-else>
          <div class="saved-api-key">{{ t('api_key_saved') }}</div>
          <button @click="clearApiKey">{{ t('change_api_key') }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';

// --- Vue Reactive State Definition ---
// `ref` is used to create reactive variables
const { t, locale } = useI18n();
const isLoggedIn = ref(false);
const statusMessage = computed(() => t('statusChecking'));
const currentOutputKey = ref('cover_letter_outputMessage');
const outputMessage = computed(() => {
  return currentOutputKey.value ? t(currentOutputKey.value) : '';
});
const currentGlobalKey = ref('');
const globalMessage = computed(() => {
  return currentGlobalKey.value ? t(currentGlobalKey.value) : '';
});
const apiKeyInput = ref('');
const fileInput = ref(null);
const currentLanguage = ref(locale.value);

const toggleLanguage = () => {
  const newLang = currentLanguage.value === 'en' ? 'zh' : 'en';
  currentLanguage.value = newLang;
  locale.value = newLang
  localStorage.setItem('locale', newLang)
}

// Dynamically compute the CSS class for the status message
// const statusClass = computed(() => {
//   if (statusMessage.value == t('loginMessage')) return 'success';
//   else return 'error';
//   return '';
// });

// --- Constant Definitions ---
const EXTENSION_ID = 'apddimmlhndedehnanpdodilgidglmbm'; 
const redirectUri = encodeURIComponent(`chrome-extension://${chrome.runtime.id}/callback.html`);

const COGNITO_LOGIN_URL = `https://us-east-1y9vo1v9ou.auth.us-east-1.amazoncognito.com/login?client_id=156rthlibtmbhtm7sk9atq6ous&response_type=code&scope=email+openid+profile&redirect_uri=chrome-extension://${chrome.runtime.id}/callback.html`;
const COGNITO_LOGOUT_URL = `https://us-east-1y9vo1v9ou.auth.us-east-1.amazoncognito.com/logout?client_id=156rthlibtmbhtm7sk9atq6ous&logout_uri=chrome-extension://${EXTENSION_ID}/popup.html`;
const apiKeySaved = ref(false);
// const apiKeyInput = ref('');

// --- Lifecycle Hooks ---
onMounted(() => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.js");

// Check initial login status
  checkLoginStatus();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.id_token) {
      checkLoginStatus();
    }
  });

// Load saved API Key
  chrome.storage.local.get(["geminiApiKey"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });
});


// --- Method Definitions ---

// Check login status
function checkLoginStatus() {
  chrome.storage.local.get(["id_token"], async (result) => {
    if (result.id_token) {
      isLoggedIn.value = true;

      try {
        // Attempt to get AWS temporary credentials
        const credentials = await window.Auth.currentCredentials();

        if (!credentials || !credentials.identityId) {
          // No valid credentials, perform federatedSignIn    
          console.log("No valid identity, executing federatedSignIn");

          await window.Auth.federatedSignIn(
            'cognito-idp.us-east-1.amazonaws.com/us-east-1_Y9vo1V9OU',
            {
              token: result.id_token,
              expires_at: Date.now() + 3600000,
            }
          );

          console.log("federatedSignIn succeeded, temporary credentials obtained");
        } else {
          console.log("Already signed in, no need to re-run federatedSignIn");
        }
      } catch (err) {
        console.error("Authentication failed, please log in again", err);
        currentGlobalKey.value = "authentication_failed";
        logout();
      }
    } else {
      isLoggedIn.value = false;
      // statusMessage.value = "未登录";
    }
  });
}

// Login
function login() {
  
  chrome.tabs.create({ url: COGNITO_LOGIN_URL });
}

// Logout
function logout() {
  chrome.storage.local.remove(["id_token"], () => {
    chrome.tabs.create({ url: COGNITO_LOGOUT_URL });
    isLoggedIn.value = false;
    currentGlobalKey.value = "logout_message";
  });
}

// Trigger the file selection dialog
function triggerResumeUpload() {
  fileInput.value.click();
}

// Handle resume file upload
async function handleResumeFileChange(event) {
  const file = event.target.files[0];
  if (!file) {
    currentGlobalKey.value = "choose_file";
    return;
  }
  if (file.type !== 'application/pdf') {
    currentGlobalKey.value = "wrong_file_type";
    return;
  }

  currentGlobalKey.value = "processing_resume_upload";

  try {
    const credentials = await Auth.currentCredentials();
    const userId = credentials.identityId;

    const resumeKey = `resumes/${userId}.pdf`;
    const textKey = `resumes/${userId}.txt`;

    // 1. Upload PDF
    await Amplify.Storage.put(resumeKey, file, { contentType: file.type });

    // 2. Extract text
    const extractedText = await extractPdfText(file);
    if (!extractedText) {
        currentGlobalKey.value = "extract_text_error";
        return;
    }
    const textBlob = new Blob([extractedText], { type: "text/plain" });

    // 3. Upload TXT
    await Amplify.Storage.put(textKey, textBlob, { contentType: "text/plain" });
    
    currentGlobalKey.value = "resume_upload_success";
  } catch (err) {
    console.error("Upload failed:", err);
    currentGlobalKey.value = "resume_upload_failed";
  }
}

// Extract text from PDF file
async function extractPdfText(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      text += pageText + "\n";
    }
    return text.trim();
  } catch (err) {
    console.error("PDF parsing failed:", err);
    throw err;
  }
}

// Entry function triggered by clicking the generate button
function generate() {
  currentGlobalKey.value = "extracting_job_message";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Inject script to extract job description
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: injectedJobDescriptionExtractor,
    }, (results) => {
      // Handle the result after script execution
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          currentGlobalKey.value = "inject_script_error";
          return;
      }

      const jobDesc = results?.[0]?.result;
      if (!jobDesc || jobDesc === "职位描述未找到。") {
        currentGlobalKey.value = "not_found_job_description";
        return;
      }
      
      currentGlobalKey.value = "extracting_job_success";
      generateCoverLetter(jobDesc);
    });
  });
}

// [Content Script] Function executed on the target page
function injectedJobDescriptionExtractor() {
  const selectors = [
      "div[class*='jobs-box__html-content']",
      "div[id='job-details']",
      "div[class*='jobs-description-content__text']",
      "div[data-hook='right-content']",
      "div[id*='jobDescriptionText']",
      "div[class*='job-description']",
      "section.job-description",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el.innerText.trim();
  }
  return "职位描述未找到。";
}

// Core logic for generating the cover letter
async function generateCoverLetter(jobDesc) {
  try {
    // 1. Get the resume text
    currentGlobalKey.value = "loading_resume";
    const credentials = await Auth.currentCredentials();
    const textKey = `resumes/${credentials.identityId}.txt`;
    const resumeFile = await Amplify.Storage.get(textKey, { download: true });
    const resumeText = await resumeFile.Body.text();

    // 2. Prepare the prompt
    const prompt = `Based on the following job description and my resume, please write a concise, natural, and well-structured cover letter in English. Do not include placeholders or instructions to replace content. Only output the cover letter text, with no additional suggestions.

                    【职位描述】
                    ${jobDesc}

                    【我的简历】
                    ${resumeText}`;

    // 3. Retrieve the API Key
    const apiKey = apiKeyInput.value;
    if (!apiKey) {
      currentGlobalKey.value = "lacking_api_key";
      return;
    }

    // 4. Call the Gemini API
    currentOutputKey.value = "requesting_api";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
        throw new Error(`API request failed with status code: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (generatedText) {
      currentOutputKey.value = generatedText;
    } else {
      console.error("Failed to parse API response", data);
      currentOutputKey.value = "generation_failed";
    }

  } catch (err) {
    console.error("Error generating cover letter:", err);
    if (err.message.includes("The specified key does not exist")) {
        currentOutputKey.value = "loading_resume_error";
    } else {
        currentOutputKey.value = "error_generating_cover_letter";
    }
  }
}

// Save the API Key
function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    currentGlobalKey.value = "api_key_required";
    return;
  }
  chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
    // currentGlobalKey.value = "api_key_saved";
    apiKeySaved.value = true;
  });
}

function clearApiKey() {
  chrome.storage.local.remove("geminiApiKey", () => {
    apiKeyInput.value = '';
    apiKeySaved.value = false;
    currentGlobalKey.value = "api_key_cleared";
  });
}

// Test the API Key
async function testApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    currentGlobalKey.value = "api_key_not_saved";
    return;
  }
  currentGlobalKey.value = "api_key_verifying";
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1/models", {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
    });
    if (response.ok) {
      currentGlobalKey.value = "api_key_valid";
    } else {
      currentGlobalKey.value = "api_key_invalid";
    }
  } catch (error) {
    console.error("Failed to validate Gemini API Key:", error);
    currentGlobalKey.value = "api_key_validation_error";
  }
}
</script>

<style scoped>
.container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  padding: 16px;
  width: 320px;
  background-color: #f9f9f9;
  color: #333;
}

.language-switcher {
  position: fixed;
  top: 10px;
  right: 10px;
  z-index: 1000;
}

.language-switcher button {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #007aff;
  border: 1px solid #ccc;
  cursor: pointer;
}

.status-bar {
  font-weight: bold;
  color: #007bff;
  margin-bottom: 10px;
}

.output-message {
  margin-top: 10px;
  color: #333;
}

h2, h3 {
  text-align: center;
  color: #444;
  margin-top: 0;
  margin-bottom: 12px;
}

h3 {
  font-size: 1em;
  border-top: 1px solid #ddd;
  padding-top: 12px;
  margin-top: 16px;
}

#status {
  text-align: center;
  margin-bottom: 12px;
  padding: 8px;
  border-radius: 6px;
  font-weight: 500;
  background-color: #eee;
}

#status.success {
  background-color: #e0f2e9;
  color: #1d7b47;
}

#status.error {
  background-color: #fbe0e0;
  color: #c92a2a;
}

#output {
  white-space: pre-wrap; /* Preserve line breaks and spaces */
  margin-top: 12px;
  font-size: 14px;
  max-height: 250px;
  overflow-y: auto;
  background-color: #fff;
  border: 1px solid #ddd;
  padding: 10px;
  border-radius: 6px;
  line-height: 1.5;
  color: #555;
  min-height: 80px;
}

button {
  width: 100%;
  padding: 10px 15px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background-color: #007aff;
  color: white;
  transition: background-color 0.2s ease;
  margin-top: 8px;
}

button:hover {
  background-color: #0056b3;
}

button#generate {
  background-color: #34c759;
}
button#generate:hover {
  background-color: #2ca349;
}

.button-group {
  display: flex;
  gap: 8px; /* Spacing between buttons */
  margin-top: 8px;
}

.api-key-section input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box; /* Ensure padding does not increase width */
}
</style>
