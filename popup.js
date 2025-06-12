const resume = `Qiyang Huangfu
qiyanghuangfu@gmail.com | (774) 262-3747 | linkedin.com/in/qiyanghuangfu/
Education
Arizona State University 2021/09 – 2025/06
Master of Science in Computer Science, GPA 3.53/4.0 Tempe, AZ
Worcester Polytechnic Institute 2014/09 – 2016/05
Master of Science in Operation Analytics and Management, GPA 3.54/4.0 Worcester, MA
Work Experience
Homesite Insurance 2024/05 – 2024/08
Software Engineer Intern Boston, MA
• Migrated the Costco membership eligibility service from AWS API Gateway to GCP Apigee, resulting in a 13% reduction
in average response latency.
• Authored an OpenAPI 3.0 YAML file, defining 5 RESTful endpoints with Apigee-specific configurations.
• Implemented a GitLab CI pipeline to automate OpenAPI Specifications validation and Apigee proxy deployment.
• Drafted detailed integration proposal for Apigee onboarding procedures, security protocols, and environment setup.
• Enhanced exception handling in Spring Boot architecture by refining 6 exception classes and refactoring error messaging,
which reduced ambiguous 400 and 500 errors by 40% in staging.
• Accomplished unit tests with JUnit and Mockito, achieving full test coverage, and conducted integration tests using
Postman with API key and AzureAD bearer token as authentications.
Projects
E-Commerce Platform - Full-Stack Application | Java, JavaScript 2022/07 – 2022/12
• Developed an E-Commerce platform that provides online shopping capabilities, including user registration, merchandise
categorization, shopping cart management, and order processing.
• Created a front-end website using React.js to communicate with the back-end via HTTP.
• Created a back-end system using Spring Boot and exposed RESTful APIs with comprehensive request validation and
layered architecture.
• Employed MySQL to store structured data, while utilizing MyBatis to perform database operations.
• Deployed servlet on Apache Tomcat and utilized Nginx as a reverse proxy server to handle request routing and enable
load balancing and static resource optimization.
Bank System - Distributed Application | Python 2023/02 – 2023/05
• Designed a distributed system that emulates multiple customers managing a single bank account across various branches,
ensuring distributed consistency with Lamport’s Logical Clock algorithm.
• Developed the system using multiprocessing, and utilizing gRPC for inter-process communication with protobufs.
• Expanded the modules for Docker integration to implement a genuine distributed system, employing Docker Compose
to manage the container dependencies and connections.
• Introduced MongoDB as the database to store the logic clock, replacing the previous in-memory storage.
• Deployed the containers using Kubernetes, and set up a Jenkins pipeline with automated build, testing, and deployment
processes for CI/CD.
Plant Propagation Management System - AWS Application | Python 2023/06 – 2023/09
• Designed and developed a system on AWS Serverless using AWS Lambda, provided functionality for plants and cuttings
management, hosted frontend webpages in Amazon S3, and accelerated content delivery with Amazon CloudFront.
• Utilized Amazon API Gateway to establish RESTful APIs, and employed Amazon Cognito to handle user authentications.
• Stored plant and cuttings information in Amazon DynamoDB, while improving data query performance by 12% through
the implementation of GSIs (Global Secondary Indexes).
• Enabled TTL (Time to Live) for plant records to create reminders for watering or applying fertilizer via SMS or email.
Skills
Programming Languages: Java, C#, Python, JavaScript, HTML/CSS, SQL, Shell Script
Frameworks: Spring, Spring Boot, React.js, .NET, JUnit, Mockito, MySQL, MongoDB, gRPC, AWS Serverless
Systems & Tools: Linux/UNIX, Git, Docker, Kubernetes, Jenkins, Postman, MyBatis, Maven, Gradle, Tomcat, Nginx
`;

// popup.js
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
                console.log("✅ 已登录，无需重新 federatedSignIn");
                // 如果你想显示上传按钮或做其他已登录操作，可以放在这里
            })
            .catch(() => {
                // 如果没有登录，则执行 federatedSignIn
                Auth.federatedSignIn(
                'cognito-idp.us-east-1.amazonaws.com/us-east-1_Y9vo1V9OU',
                {
                    token: result.id_token,
                    expires_at: Date.now() + 3600000,
                }
                ).then(credentials => {
                    console.log('✅ 获取凭证成功', credentials);
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
            await Amplify.Storage.put(`resumes/${file.name}`, file, {
                contentType: file.type
            });
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

function generateCoverLetter(jobDesc) {
    const prompt = `Based on the following job description and my resume, please write a concise, natural, and well-structured cover letter in English. Do not include placeholders or instructions to replace content. Only output the cover letter text, with no additional suggestions.

【职位描述】
${jobDesc}

【我的简历】
${resume}`;

    chrome.storage.local.get(["geminiApiKey"], (result) => {
        const apiKey = result.geminiApiKey;

        if (!apiKey) {
            document.getElementById("output").innerText = "❗ 请先保存 Gemini API Key。";
            return;
        }

        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
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
        })
            .then(res => res.json())
            .then(data => {
                const output = data.candidates?.[0]?.content?.parts?.[0]?.text || "生成失败，请检查输出格式。";
                document.getElementById("output").innerText = output;
            })
            .catch(err => {
                console.error("Gemini API error:", err);
                document.getElementById("output").innerText = "请求失败，请打开控制台查看错误。";
            });
    });
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