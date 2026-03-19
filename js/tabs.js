/* ══════════════════════════════════════
   TrainChain — tabs.js
   Tab navigation
══════════════════════════════════════ */

(function () {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    tabPanels.forEach(p => p.classList.toggle("active", p.id === "panel-" + tabId));
    const hero = document.getElementById("heroBanner");
    if (hero) hero.classList.toggle("active", tabId === "trains");
    if (tabId === "reservation" && typeof loadMyTrainsList === "function") {
      loadMyTrainsList();
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  window.switchTab = switchTab;
})();
