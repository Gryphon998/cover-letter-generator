<template>
  <div class="container">
    <h2>{{ t('title') }}</h2>
    
    <div class="language-switcher">
    <button @click="toggleLanguage">
      {{ currentLanguage === 'en' ? '中文' : 'English' }}
    </button>
    </div>

    <!-- Status display -->
    <div id="status" :class="statusClass">{{ statusMessage }}</div>

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
const statusMessage = ref(t('statusChecking'));
const outputMessage = ref('点击上方按钮开始生成');
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
const statusClass = computed(() => {
  if (statusMessage.value == t('loginMessage')) return 'success';
  else return 'error';
  return '';
});

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
      statusMessage.value = t('loginMessage');

      try {
        // Attempt to get AWS temporary credentials
        const credentials = await window.Auth.currentCredentials();

        if (!credentials || !credentials.identityId) {
          // No valid credentials, perform federatedSignIn    
          console.log("⚠️ 无有效身份，执行 federatedSignIn");

          await window.Auth.federatedSignIn(
            'cognito-idp.us-east-1.amazonaws.com/us-east-1_Y9vo1V9OU',
            {
              token: result.id_token,
              expires_at: Date.now() + 3600000,
            }
          );

          console.log("✅ federatedSignIn 成功，已获取临时凭证");
        } else {
          console.log("✅ 已登录，无需重新 federatedSignIn");
        }
      } catch (err) {
        console.error("❌ 认证失败，重新登录", err);
        statusMessage.value = "❌ 登录凭证已过期，请重新登录。";
        logout();
      }
    } else {
      isLoggedIn.value = false;
      statusMessage.value = "未登录";
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
    statusMessage.value = "已登出";
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
    outputMessage.value = "❌ 请先选择一个文件。";
    return;
  }
  if (file.type !== 'application/pdf') {
    outputMessage.value = "❌ 请上传 PDF 格式的简历。";
    return;
  }

  outputMessage.value = "⏳ 正在上传和解析简历...";

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
        outputMessage.value = "❌ 无法从PDF中提取文本。";
        return;
    }
    const textBlob = new Blob([extractedText], { type: "text/plain" });

    // 3. Upload TXT
    await Amplify.Storage.put(textKey, textBlob, { contentType: "text/plain" });
    
    outputMessage.value = "✅ 简历上传成功！";
  } catch (err) {
    console.error("上传失败：", err);
    outputMessage.value = "❌ 上传失败，请检查控制台。";
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
    console.error("❌ PDF 解析失败：", err);
    throw err;
  }
}

// Entry function triggered by clicking the generate button
function generate() {
  outputMessage.value = "⏳ 正在从页面提取职位描述...";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    // Inject script to extract job description
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: injectedJobDescriptionExtractor,
    }, (results) => {
      // Handle the result after script execution
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          outputMessage.value = "❌ 无法向当前页面注入脚本。请尝试刷新页面。";
          return;
      }

      const jobDesc = results?.[0]?.result;
      if (!jobDesc || jobDesc === "职位描述未找到。") {
        outputMessage.value = "❗ 未能提取到职位描述，请确认在职位详情页面。";
        return;
      }
      
      outputMessage.value = "✅ 职位描述提取成功，正在生成求职信...";
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
    outputMessage.value = "⏳ 正在加载您的简历...";
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
      outputMessage.value = "❗ 请先保存您的 Gemini API Key。";
      return;
    }

    // 4. Call the Gemini API
    outputMessage.value = "⏳ 正在请求 Gemini API，请稍候...";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!response.ok) {
        throw new Error(`API 请求失败，状态码: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (generatedText) {
      outputMessage.value = generatedText;
    } else {
      console.error("API 响应解析失败", data);
      outputMessage.value = "生成失败，API 未返回有效内容。请检查控制台。";
    }

  } catch (err) {
    console.error("生成求职信时出错:", err);
    if (err.message.includes("The specified key does not exist")) {
        outputMessage.value = "❌ 加载简历失败。您是否已经上传了简历？";
    } else {
        outputMessage.value = `❌ 请求失败: ${err.message}。请检查控制台获取更多信息。`;
    }
  }
}

// Save the API Key
function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusMessage.value = "❌ 请输入一个 API Key。";
    return;
  }
  chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
    statusMessage.value = "✅ API Key 已保存！";
    apiKeySaved.value = true;
  });
}

function clearApiKey() {
  chrome.storage.local.remove("geminiApiKey", () => {
    apiKeyInput.value = '';
    apiKeySaved.value = false;
    statusMessage.value = '✅ API Key 已清除。';
  });
}

// Test the API Key
async function testApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusMessage.value = "❌ 尚未保存 Gemini API Key。";
    return;
  }
  statusMessage.value = "⏳ 正在验证 Key...";
  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1/models", {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
    });
    if (response.ok) {
      statusMessage.value = "✅ Gemini API Key 有效！";
    } else {
      statusMessage.value = `❌ API Key 无效（状态码 ${response.status}）`;
    }
  } catch (error) {
    console.error("验证 Gemini API Key 失败:", error);
    statusMessage.value = "❌ 验证 Key 时出错。";
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
