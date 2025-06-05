// 解析 URL 中的 code 参数
function getCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("code");
}

async function exchangeCodeForToken(code) {
    const clientId = "156rthlibtmbhtm7sk9atq6ous";
    const redirectUri = `chrome-extension://kfiapkgkkfmacpmjmbnpnpchjbbnoegd/callback.html`;
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
        body
    });

    const data = await response.json();
    return data;
}

(async () => {
    const code = getCodeFromUrl();
    if (!code) {
        document.body.innerText = "No code found in URL.";
        return;
    }

    try {
        const tokens = await exchangeCodeForToken(code);
        console.log("Token response:", tokens);

        // 存储 id_token 到插件的 chrome.storage.local
        chrome.storage.local.set({ id_token: tokens.id_token }, () => {
            console.log("Token stored.");
            // 可以跳转回 popup 或自动关闭页面
            window.close(); // 或者 redirect 到插件页面
        });
    } catch (err) {
        console.error("Token exchange failed", err);
        document.body.innerText = "Login failed.";
    }
})();
