/* ══════════════════════════════════════
   TrainChain — trains.js
   Load, filter, search & display trains
══════════════════════════════════════ */

const trainListDiv = document.getElementById("trainList");

/* ── Fetch all trains from contract ── */
async function fetchAllTrains() {
  if (!TC.contract) return [];
  const count = Number(await TC.contract.methods.getTrainCount().call());
  const trains = [];

  // Pre-fetch user's reserved train IDs for efficient lookup
  let userTrainIds = new Set();
  if (TC.currentAccount) {
    try {
      const ids = await TC.contract.methods.getUserReservedTrains(TC.currentAccount).call();
      userTrainIds = new Set(ids.map(Number));
    } catch (_) {}
  }

  for (let i = 1; i <= count; i++) {
    try {
      const train = await TC.contract.methods.getTrain(i).call();
      let hasReserved = false;
      let reservation = null;
      if (TC.currentAccount && userTrainIds.has(i)) {
        try {
          const r = await TC.contract.methods.getReservation(i, TC.currentAccount).call();
          hasReserved = true;
          reservation = r;
        } catch (_) { /* reservation data unavailable */ }
      }

      trains.push({
        id: Number(train.id),
        name: train.name,
        totalSeats: Number(train.totalSeats),
        reservedSeats: Number(train.reservedSeats),
        availableSeats: Number(train.availableSeats),
        priceInWei: train.priceInWei.toString(),
        priceEth: parseFloat(TC.web3.utils.fromWei(train.priceInWei.toString(), "ether")),
        hasReserved: hasReserved,
        reservation: reservation,
        cancelled: train.cancelled || false,
        departureTime: Number(train.departureTime || 0),
        duration: Number(train.duration || 0),
      });
    } catch (e) {
      console.error("Erreur lecture train", i, e);
    }
  }
  return trains;
}

/* ── Filter logic ── */
function applyFilters() {
  const searchText = (document.getElementById("searchName") || {}).value || "";
  const minPrice = parseFloat((document.getElementById("filterMinPrice") || {}).value) || 0;
  const maxPrice = parseFloat((document.getElementById("filterMaxPrice") || {}).value) || Infinity;
  const minSeats = parseInt((document.getElementById("filterMinSeats") || {}).value) || 0;
  const onlyAvailable = (document.getElementById("filterAvailable") || {}).checked || false;
  const hideCancelled = (document.getElementById("filterHideCancelled") || {}).checked;
  const hidePast = (document.getElementById("filterHidePast") || {}).checked;

  const query = searchText.toLowerCase().trim();
  const nowSec = Math.floor(Date.now() / 1000);
  const oneDaySec = 86400;

  TC.filteredTrains = TC.allTrains.filter(t => {
    if (hideCancelled && t.cancelled) return false;
    if (hidePast && t.departureTime > 0 && (t.departureTime + t.duration * 60) < (nowSec - oneDaySec)) return false;
    if (query && !t.name.toLowerCase().includes(query)) return false;
    if (t.priceEth < minPrice) return false;
    if (t.priceEth > maxPrice) return false;
    if (t.availableSeats < minSeats) return false;
    if (onlyAvailable && t.availableSeats === 0) return false;
    return true;
  });

  TC.showAllTrains = false;
  renderTrains();
}

/* ── Build action buttons based on reservation state ── */
function buildActionButtons(train) {
  const t = train;
  let html = "";

  if (t.cancelled) {
    html += `<span class="sncf-res-badge" style="background:var(--red-soft);color:#fca5a5;">🚫 Train annulé</span>`;
    return html;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const isPastTrain = t.departureTime > 0 && (t.departureTime + t.duration * 60) < nowSec;

  if (isPastTrain && !t.hasReserved) {
    html += `<span class="sncf-res-badge" style="background:var(--yellow-soft);color:#b45309;">🟠 Trajet terminé</span>`;
    return html;
  }

  if (!t.hasReserved) {
    // Not reserved → can only book
    const disabled = t.availableSeats === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : "";
    html += `<button class="btn btn-primary btn-sm" onclick="reserveTrain(${t.id}, '${t.priceInWei}')" ${disabled}>🎫 Réserver</button>`;
  } else {
    // Has reservation → check state
    const r = t.reservation;
    const isActive = r && r.active;
    const refundRequested = r && r.refundRequested;
    const isRefunded = r && r.refunded;

    if (isRefunded) {
      // Already refunded → can book again
      html += `<span class="sncf-res-badge" style="background:var(--accent-soft);color:#c7d2fe;">💰 Remboursé</span>`;
      const disabled = t.availableSeats === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : "";
      html += `<button class="btn btn-primary btn-sm" onclick="reserveTrain(${t.id}, '${t.priceInWei}')" ${disabled}>🎫 Réserver à nouveau</button>`;
    } else if (refundRequested) {
      // Refund pending → no actions
      html += `<span class="sncf-res-badge" style="background:var(--yellow-soft);color:#fcd34d;">⏳ Remboursement en attente</span>`;
    } else if (isActive) {
      // Active reservation → can cancel (which triggers refund proposal)
      html += `<button class="btn btn-warning btn-sm" onclick="cancelTrainReservation(${t.id})">✖ Annuler</button>`;
    } else {
      // Cancelled (not active, not refunded) → badge only, refund via reservation tab
      html += `<span class="sncf-res-badge" style="background:var(--red-soft);color:#fca5a5;">❌ Annulée</span>`;
    }
  }
  return html;
}

/* ── Render train cards ── */
function renderTrains() {
  const trains = TC.filteredTrains;

  if (trains.length === 0) {
    trainListDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>Aucun train ne correspond à vos critères.</p></div>';
    updateTrainCount(0);
    return;
  }

  const limit = TC.showAllTrains ? trains.length : Math.min(TC.TRAINS_PREVIEW, trains.length);
  const hasMore = trains.length > limit;

  let html = '<div class="sncf-list">';
  for (let idx = 0; idx < limit; idx++) {
    const t = trains[idx];
    const safeName = escapeHtml(t.name);
    const parts = safeName.split("-");
    let routeHtml;
    if (parts.length >= 2) {
      routeHtml = `<span class="sncf-station">${parts[0].trim()}</span>
        <div class="sncf-route-line"></div>
        <span class="sncf-station">${parts.slice(1).join("-").trim()}</span>`;
    } else {
      routeHtml = `<span class="sncf-station">${safeName}</span>`;
    }

    const trainViz = buildTrainViz(t.id, t.totalSeats, t.reservedSeats);

    // Date/time display
    const nowSec = Math.floor(Date.now() / 1000);
    const arrivalTs = t.departureTime + t.duration * 60;
    const isPast = t.departureTime > 0 && arrivalTs < nowSec;
    let dateHtml = "";
    if (t.departureTime > 0) {
      const depDate = new Date(t.departureTime * 1000);
      const arrDate = new Date(arrivalTs * 1000);
      const fmtDate = d => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
      const fmtTime = d => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      const h = Math.floor(t.duration / 60);
      const m = t.duration % 60;
      const durationStr = h > 0 ? h + "h" + (m > 0 ? m.toString().padStart(2, "0") : "") : m + "min";
      dateHtml = `<div class="sncf-date-row">
        <span class="sncf-date-item">📅 ${fmtDate(depDate)}</span>
        <span class="sncf-date-item">🕒 ${fmtTime(depDate)} → ${fmtTime(arrDate)}</span>
        <span class="sncf-date-item">⏱ ${durationStr}</span>
        ${isPast ? '<span class="sncf-date-item sncf-past-badge">🟠 Trajet passé</span>' : ''}
      </div>`;
    }

    // Reservation badge
    let resBadge = "";
    if (t.hasReserved && t.reservation) {
      const r = t.reservation;
      if (r.refunded) resBadge = `<div class="sncf-res-badge" style="background:var(--accent-soft);color:#c7d2fe;">💰 Remboursé</div>`;
      else if (r.refundRequested) resBadge = `<div class="sncf-res-badge" style="background:var(--yellow-soft);color:#fcd34d;">⏳ Remb. en attente</div>`;
      else if (r.active) resBadge = `<div class="sncf-res-badge active">✅ Réservé (siège #${r.seatNumber})</div>`;
      else resBadge = `<div class="sncf-res-badge" style="background:var(--red-soft);color:#fca5a5;">❌ Annulée</div>`;
    } else {
      resBadge = `<div class="sncf-res-badge none">— Pas de réservation</div>`;
    }

    // Availability tag
    let availTag = "";
    if (t.availableSeats === 0) availTag = `<span class="avail-tag full">Complet</span>`;
    else if (t.availableSeats <= 5) availTag = `<span class="avail-tag low">Plus que ${t.availableSeats} place${t.availableSeats > 1 ? "s" : ""}</span>`;

    html += `
      <div class="sncf-card${t.cancelled ? ' sncf-card-cancelled' : ''}${isPast ? ' sncf-card-past' : ''}">
        <div class="sncf-header">
          <div class="sncf-route">${routeHtml}</div>
          <div class="sncf-header-right">
            ${t.cancelled ? '<span class="avail-tag full">🚫 Annulé</span>' : availTag}
            <span class="sncf-price">${t.priceEth} ETH</span>
            <span class="sncf-train-id">Train ID : ${t.id}</span>
          </div>
        </div>
        ${dateHtml}
        <div class="sncf-viz">${trainViz}</div>
        <div class="sncf-info">
          <div class="sncf-stat">💺 <span class="sncf-stat-val blue">${t.totalSeats}</span> places</div>
          <div class="sncf-stat">🎫 <span class="sncf-stat-val yellow">${t.reservedSeats}</span> réservées</div>
          <div class="sncf-stat">✅ <span class="sncf-stat-val green">${t.availableSeats}</span> disponibles</div>
          <div class="sncf-legend">
            <div class="sncf-leg"><div class="sncf-ldot" style="background:#059669"></div> Libre</div>
            <div class="sncf-leg"><div class="sncf-ldot" style="background:#6366f1"></div> Réservé</div>
          </div>
        </div>
        <div class="sncf-actions">
          ${resBadge}
          <div style="flex:1;"></div>
          ${buildActionButtons(t)}
        </div>
      </div>`;
  }

  if (hasMore) {
    html += `<div class="show-more-wrap">
      <button class="btn btn-ghost" id="showMoreBtn" onclick="toggleShowAll()">
        📋 Voir les ${trains.length - limit} autres trains
      </button>
    </div>`;
  } else if (TC.showAllTrains && trains.length > TC.TRAINS_PREVIEW) {
    html += `<div class="show-more-wrap">
      <button class="btn btn-ghost" id="showLessBtn" onclick="toggleShowAll()">
        ▲ Afficher moins
      </button>
    </div>`;
  }

  html += "</div>";
  trainListDiv.innerHTML = html;
  updateTrainCount(trains.length);
}

function updateTrainCount(count) {
  const el = document.getElementById("trainCountBadge");
  if (el) el.textContent = count + " train" + (count > 1 ? "s" : "");
}

function toggleShowAll() {
  TC.showAllTrains = !TC.showAllTrains;
  renderTrains();
}

/* ── Main load ── */
async function loadTrains() {
  if (!TC.contract) return;
  trainListDiv.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  TC.allTrains = await fetchAllTrains();
  TC.filteredTrains = [...TC.allTrains];
  TC.showAllTrains = false;

  // Reset filters UI
  const searchEl = document.getElementById("searchName");
  if (searchEl) searchEl.value = "";
  const mp = document.getElementById("filterMinPrice");
  if (mp) mp.value = "";
  const xp = document.getElementById("filterMaxPrice");
  if (xp) xp.value = "";
  const ms = document.getElementById("filterMinSeats");
  if (ms) ms.value = "";
  const fa = document.getElementById("filterAvailable");
  if (fa) fa.checked = false;
  const hc = document.getElementById("filterHideCancelled");
  if (hc) hc.checked = true;
  const hp = document.getElementById("filterHidePast");
  if (hp) hp.checked = true;

  if (TC.allTrains.length === 0) {
    trainListDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">🚫</div><p>Aucun train disponible pour le moment.</p></div>';
    updateTrainCount(0);
    return;
  }

  applyFilters();
}

/* ── Expose ── */
window.loadTrains = loadTrains;
window.applyFilters = applyFilters;
window.toggleShowAll = toggleShowAll;
window.renderTrains = renderTrains;
