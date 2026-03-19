/* ══════════════════════════════════════
   TrainChain — init.js
   Event listeners & initialization
══════════════════════════════════════ */

(function () {
  /* ── Theme toggle ── */
  const savedTheme = localStorage.getItem("tc-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  const themeBtn = document.getElementById("themeToggle");
  function updateThemeIcon() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    themeBtn.textContent = isDark ? "🌙" : "☀️";
  }
  updateThemeIcon();
  themeBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("tc-theme", next);
    updateThemeIcon();
  });

  /* ── Button event listeners ── */
  document.getElementById("refreshBtn").addEventListener("click", loadTrains);
  document.getElementById("addTrainBtn").addEventListener("click", addTrain);
  document.getElementById("refreshRefundsBtn").addEventListener("click", loadPendingRefunds);
  document.getElementById("refreshCancelTrainsBtn").addEventListener("click", loadCancellableTrains);
  document.getElementById("checkReservationBtn").addEventListener("click", checkMyReservation);
  document.getElementById("refreshBalanceBtn").addEventListener("click", loadContractBalance);
  document.getElementById("loadAdminResBtn").addEventListener("click", loadAdminReservations);

  /* ── Search/Filter listeners ── */
  const searchName = document.getElementById("searchName");
  if (searchName) {
    searchName.addEventListener("input", applyFilters);
  }

  const filterInputs = ["filterMinPrice", "filterMaxPrice", "filterMinSeats"];
  filterInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", applyFilters);
  });

  const filterAvailable = document.getElementById("filterAvailable");
  if (filterAvailable) {
    filterAvailable.addEventListener("change", applyFilters);
  }

  const filterHideCancelled = document.getElementById("filterHideCancelled");
  if (filterHideCancelled) {
    filterHideCancelled.addEventListener("change", applyFilters);
  }

  const filterHidePast = document.getElementById("filterHidePast");
  if (filterHidePast) {
    filterHidePast.addEventListener("change", applyFilters);
  }

  const clearFiltersBtn = document.getElementById("clearFiltersBtn");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchName) searchName.value = "";
      filterInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      if (filterAvailable) filterAvailable.checked = false;
      if (filterHideCancelled) filterHideCancelled.checked = true;
      if (filterHidePast) filterHidePast.checked = true;
      applyFilters();
    });
  }

  /* ── Admin sub-navigation ── */
  const adminNav = document.getElementById("adminNav");
  if (adminNav) {
    const adminNavBtns = adminNav.querySelectorAll(".admin-nav-btn");
    const adminSections = document.querySelectorAll("#panel-admin .admin-section");

    function switchAdminPanel(panelId) {
      adminNavBtns.forEach(b => b.classList.toggle("active", b.dataset.panel === panelId));
      adminSections.forEach(s => {
        if (s.id === panelId) {
          s.classList.remove("hidden");
          s.style.display = "";
        } else {
          s.style.display = "none";
        }
      });
      if (panelId === "refundPanel" && typeof loadPendingRefunds === "function") {
        loadPendingRefunds();
      }
      if (panelId === "cancelTrainPanel" && typeof loadCancellableTrains === "function") {
        loadCancellableTrains();
      }
    }

    adminNavBtns.forEach(btn => {
      btn.addEventListener("click", () => switchAdminPanel(btn.dataset.panel));
    });

    // Show first panel by default when admin tab opens
    const tabAdminBtn = document.querySelector('[data-tab="admin"]');
    if (tabAdminBtn) {
      tabAdminBtn.addEventListener("click", () => {
        const activeBtn = adminNav.querySelector(".admin-nav-btn.active");
        if (activeBtn) switchAdminPanel(activeBtn.dataset.panel);
      });
    }
  }
})();
