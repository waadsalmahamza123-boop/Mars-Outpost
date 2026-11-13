const BADGES = ["radiationShield", "visionGuardian", "fitnessCaptain", "waterExpert"];

function getEarnedBadges() {
    try {
        return JSON.parse(localStorage.getItem("marsBadges")) || [];
    } catch (e) {
        return [];
    }
}
function renderBadges() {
    const earned = getEarnedBadges();
    document.querySelectorAll(".badge-card").forEach(function (card) {
        const name = card.dataset.badge;
        const status = card.querySelector(".badge-status");

        if (earned.includes(name)) {
            card.classList.remove("locked");
            card.classList.add("unlocked");
            status.textContent = "✔ EARNED";
        } else {
            card.classList.remove("unlocked");
            card.classList.add("locked");
            status.textContent = "🔒 LOCKED";
        }
    });
    const count = earned.filter(function (b) { return BADGES.includes(b); }).length;
    const total = BADGES.length;
    document.getElementById("badgesCount").textContent = count;
    document.getElementById("badgesProgress").style.width = (count / total) * 100 + "%";
}

function unlockBadge(name) {
    const earned = getEarnedBadges();
    if (!earned.includes(name)) {
        earned.push(name);
        localStorage.setItem("marsBadges", JSON.stringify(earned));
    }
    renderBadges();
}


renderBadges();
window.unlockBadge = unlockBadge;
