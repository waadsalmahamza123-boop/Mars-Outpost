
const loginForm = document.getElementById("login");
const registerForm = document.getElementById("register");
const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");

document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        const showLogin = tab.dataset.form === "login";
        loginForm.classList.toggle("hidden", !showLogin);
        registerForm.classList.toggle("hidden", showLogin);
        loginMsg.textContent = "";
        registerMsg.textContent = "";
    });
});

function showMsg(el, text, type) {
    el.textContent = text;
    el.className = "message " + type;
}

registerForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = registerForm.elements.name.value.trim();
    const email = registerForm.elements.email.value.trim().toLowerCase();
    const password = registerForm.elements.password.value;
    const users = JSON.parse(localStorage.getItem("marsUsers")) || [];
    if (users.some(function (u) { return u.email === email; })) {
        showMsg(registerMsg, "This email is already registered.", "error");
        return;
    }
    users.push({ name: name, email: email, password: password });
    localStorage.setItem("marsUsers", JSON.stringify(users));
    localStorage.setItem("marsUser", JSON.stringify({ name: name, email: email }));
    showMsg(registerMsg, "Welcome, Commander " + name + "! Launching...", "ok");
    setTimeout(function () { window.location.href="/html/index.html"; }, 1200);
});

loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const email = loginForm.elements.email.value.trim().toLowerCase();
    const password = loginForm.elements.password.value;
    const users = JSON.parse(localStorage.getItem("marsUsers")) || [];
    const user = users.find(function (u) {
        return u.email === email && u.password === password;
    });

    if (!user) {
        showMsg(loginMsg, "Wrong email or password. Try again.", "error");
        return;
    }
    localStorage.setItem("marsUser", JSON.stringify({ name: user.name, email: user.email }));
    showMsg(loginMsg, "Welcome back, Commander " + user.name + "!", "ok");
    setTimeout(function () { window.location.href = "../index.html"; }, 1200);
});
