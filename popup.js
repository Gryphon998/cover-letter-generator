// popup.js
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.js");
const COGNITO_LOGIN_URL = `https://us-east-1y9vo1v9ou.auth.us-east-1.amazoncognito.com/login?client_id=156rthlibtmbhtm7sk9atq6ous&response_type=code&scope=email+openid+phone&redirect_uri=chrome-extension://kfiapkgkkfmacpmjmbnpnpchjbbnoegd/callback.html`;

document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("status");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const uploadBtn = document.getElementById("upload-resume-btn");
    const fileInput = document.getElementById("resume-file");

    chrome.storage.local.get(["id_token"], (result) => {
        if (result.id_token) {
            statusEl.textContent = "✅ 已登录";
            loginBtn.style.display = "none";
            logoutBtn.style.display = "inline-block";
            uploadBtn.style.display = "inline-block"; // 👈 显示上传按钮

            Auth.currentCredentials()
                .then(session => {
                    if (!session.identityId) {
                    console.log("⚠️ 没有有效身份，执行 federatedSignIn");
                    throw new Error("Missing identityId");
                    }
                    console.log("✅ 已登录，无需重新 federatedSignIn");
                })
                .catch(() => {
                    console.log("⚠️ 尝试 federatedSignIn...");
                    Auth.federatedSignIn(
                    'cognito-idp.us-east-1.amazonaws.com/us-east-1_Y9vo1V9OU',
                    {
                        token: result.id_token,
                        expires_at: Date.now() + 3600000,
                    }
                    ).then(credentials => {
                    console.log('✅ federatedSignIn 成功，凭证：', credentials);
                    }).catch(err => {
                    console.error('❌ federatedSignIn 失败', err);
                    });
                });
        } else {
            statusEl.textContent = "未登录";
            loginBtn.style.display = "inline-block";
            logoutBtn.style.display = "none";
            uploadBtn.style.display = "none";
        }
    });

    loginBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: COGNITO_LOGIN_URL });
    });

    logoutBtn.addEventListener("click", () => {
        chrome.storage.local.remove(["id_token"], () => {
            const logoutUrl = "https://us-east-1y9vo1v9ou.auth.us-east-1.amazoncognito.com/logout" +
                "?client_id=156rthlibtmbhtm7sk9atq6ous" +
                "&logout_uri=chrome-extension://kfiapkgkkfmacpmjmbnpnpchjbbnoegd/popup.html\n";
            chrome.tabs.create({ url: logoutUrl });
            statusEl.textContent = "已登出";
            loginBtn.style.display = "inline-block";
            logoutBtn.style.display = "none";
            uploadBtn.style.display = "none";
        });
    });

    // pdf转txt
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
          throw err; // 确保错误冒泡出去
        }
      }      

    // 👇 上传按钮逻辑
    uploadBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", async () => {
        const fileInput = document.getElementById("resume-file");
        const file = fileInput.files[0];

        if (!file) {
            document.getElementById("output").textContent = "❌ 请先选择一个文件。";
            return;
        }

        try {
            const credentials = await Auth.currentCredentials();
            const userId = credentials.identityId;

            const resumeKey = `resumes/${userId}.pdf`;
            const textKey = `resumes/${userId}.txt`;

            // 1. 上传 PDF
            await Amplify.Storage.put(resumeKey, file, {
                contentType: file.type,
            });

            console.log("1");

            // 2. 提取并上传 TXT
            const extractedText = await extractPdfText(file);
            const textBlob = new Blob([extractedText], { type: "text/plain" });
            console.log("提取的文本长度：", extractedText.length);
            console.log("部分内容预览：", extractedText.slice(0, 200));

            await Amplify.Storage.put(textKey, textBlob, {
                contentType: "text/plain",
            });
            console.log("2");
            document.getElementById("output").textContent = "✅ 简历上传成功！";
        } catch (err) {
            console.error("上传失败：", err);
            document.getElementById("output").textContent = "❌ 上传失败，请检查控制台。";
        }
    });
});

function extractJobDescription() {
    const selectors = [
        // "div[id*='jobDescriptionText']",
        // // "div[id*='job-details']",
        // // "div[class*='job-description']",
        // // "section.job-description",
        // // "article",
        // "div[class*='job-description']",
        // "section.job-description"
        "div[class*='jobs-box__html-content']",
        "div[id='job-details']",
        "div[class*='jobs-description-content__text']",
        "div[data-hook='right-content']"
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el.innerText.trim();
    }
    return "职位描述未找到。";
}

async function generateCoverLetter(jobDesc) {
    try {
        // 从 S3 获取简历文件（txt）
        const resumeFile = await Amplify.Storage.get("resumes/yourname.txt", { download: true });
        const text = await resumeFile.Body.text();

        const prompt = `Based on the following job description and my resume, please write a concise, natural, and well-structured cover letter in English. Do not include placeholders or instructions to replace content. Only output the cover letter text, with no additional suggestions.

                        【职位描述】
                        ${jobDesc}

                        【我的简历】
                        ${text}`;

        // 取出存储的 Gemini API Key
        chrome.storage.local.get(["geminiApiKey"], async (result) => {
            const apiKey = result.geminiApiKey;

            if (!apiKey) {
                document.getElementById("output").innerText = "❗ 请先保存 Gemini API Key。";
                return;
            }

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: prompt }
                                ]
                            }
                        ]
                    })
                });

                const data = await response.json();
                const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "生成失败，请检查输出格式。";
                document.getElementById("output").innerText = output;
            } catch (err) {
                console.error("Gemini API error:", err);
                document.getElementById("output").innerText = "请求失败，请打开控制台查看错误。";
            }
        });
    } catch (err) {
        console.error("加载简历失败:", err);
        document.getElementById("output").innerText = "❌ 加载简历失败，请检查控制台。";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("generate").addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: extractJobDescription,
            }, (results) => {
                const jobDesc = results?.[0]?.result;
                if (!jobDesc || jobDesc === "职位描述未找到。") {
                    document.getElementById("output").innerText = "❗未能提取到职位描述，请确认是否在职位页面上。";
                    return;
                }
                generateCoverLetter(jobDesc);
            });
        });
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const saveKeyBtn = document.getElementById("save-key-btn");
    const testKeyBtn = document.getElementById("test-key-btn");
    const statusDiv = document.getElementById("status");

    if (saveKeyBtn) {
        saveKeyBtn.addEventListener("click", () => {
            const apiKey = document.getElementById("api-key-input").value.trim();

            if (!apiKey) {
                statusDiv.textContent = "❌ 请输入一个 API Key。";
                return;
            }

            chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
                statusDiv.textContent = "✅ API Key 已保存！";
            });
        });
    }

    if (testKeyBtn) {
        testKeyBtn.addEventListener("click", async () => {
            chrome.storage.local.get(["geminiApiKey"], async (result) => {
                const apiKey = result.geminiApiKey;

                if (!apiKey) {
                    statusDiv.textContent = "❌ 尚未保存 Gemini API Key。";
                    return;
                }

                try {
                    const response = await fetch("https://generativelanguage.googleapis.com/v1/models", {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": apiKey
                        }
                    });

                    if (response.ok) {
                        statusDiv.textContent = "✅ Gemini API Key 有效！";
                    } else {
                        statusDiv.textContent = `❌ API Key 无效（状态码 ${response.status}）`;
                    }
                } catch (error) {
                    statusDiv.textContent = "❌ 验证 Key 时出错。";
                    console.error("验证 Gemini API Key 失败:", error);
                }
            });
        });
    }
});