function getCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("code");
}

async function exchangeCodeForToken(code) {
    const clientId = "156rthlibtmbhtm7sk9atq6ous";
    const redirectUri = `chrome-extension://${chrome.runtime.id}/callback.html`;
    const tokenEndpoint = "https://us-east-1y9vo1v9ou.auth.us-east-1.amazoncognito.com/oauth2/token";

    const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
        code,
        redirect_uri: redirectUri
        });

        const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body.toString()
        });

        if (!response.ok) {
        throw new Error("Token exchange failed: " + (await response.text()));
        }

        return response.json(); // 包括 access_token / id_token / refresh_token
    }

(async () => {
    console.log("开始执行 callback.js");
    const code = getCodeFromUrl();

    if (!code) {
        document.body.innerText = "❌ 未检测到授权码（code）";
        return;
    }

    try {
        const tokenResponse = await exchangeCodeForToken(code);
        console.log("✅ 获取 token 成功", tokenResponse);

        chrome.storage.local.set({ id_token: tokenResponse.id_token }, () => {
            console.log("✅ Token 存储成功");
          window.close(); // 关闭当前窗口
          document.body.innerText = "✅ 登录成功，正在关闭窗口...";
        });
    } catch (err) {
        console.error("❌ 登录失败", err);
        document.body.innerText = "❌ 登录失败，请重试。";
    }
})();