function switchAuthTab(tab) {
    document.getElementById("login-form-wrap").style.display =
        tab === "login" ? "" : "none";

    document.getElementById("register-form-wrap").style.display =
        tab === "register" ? "" : "none";
}

const NAV_ITEMS = [
    { id: "transactions", label: "Transactions" },
    { id: "delivery", label: "Delivery" },
    { id: "maintenance", label: "Equipment Maintenance" },
    { id: "inventory", label: "Inventory" },
    { id: "receiving", label: "Inventory Receiving" },
    { id: "alerts", label: "Alerts" },
    { id: "sales", label: "Sales & Profit" },
    { id: "bills", label: "Bills & Tax" },
    { id: "employees", label: "Employees" },
    { id: "suppliers", label: "Suppliers" },
    { id: "reports", label: "Reports" },
    { id: "users", label: "User Accounts" }
];

function buildNav() {
    const nav = document.getElementById("sidebar-nav");

    nav.innerHTML = NAV_ITEMS.map(item => `
        <li>
            <button onclick="showSection('${item.id}')">
                ${item.label}
            </button>
        </li>
    `).join("");
}

function showSection(id) {
    NAV_ITEMS.forEach(item => {
        const sec = document.getElementById("sec-" + item.id);
        if (sec) {
            sec.style.display = item.id === id ? "" : "none";
        }
    });

    const item = NAV_ITEMS.find(x => x.id === id);

    document.getElementById("section-title").textContent =
        item ? item.label : "";
}

function handleLogin(e) {
    e.preventDefault();

    document.getElementById("login-form-wrap").style.display = "none";
    document.getElementById("register-form-wrap").style.display = "none";

    document.getElementById("user-info").style.display = "";
    document.getElementById("sidebar-nav").style.display = "";

    document.getElementById("user-name").textContent = "Demo User";
    document.getElementById("user-role-badge").textContent = "Admin";

    buildNav();
    showSection("transactions");

    return false;
}

function handleRegister(e) {
    e.preventDefault();

    alert("Account created successfully!");
    switchAuthTab("login");

    return false;
}

function handleLogout() {
    document.getElementById("user-info").style.display = "none";
    document.getElementById("sidebar-nav").style.display = "none";

    NAV_ITEMS.forEach(item => {
        const sec = document.getElementById("sec-" + item.id);
        if (sec) sec.style.display = "none";
    });

    document.getElementById("section-title").textContent = "";

    document.getElementById("login-form-wrap").style.display = "";
}