/* ══════════════════════════════════════
   TrainChain — reservation.js
   Reserve, cancel, refund, check tickets
══════════════════════════════════════ */

async function reserveTrain(trainId, priceInWei) {
  if (!TC.contract || !TC.currentAccount) {
    showToast("Connectez MetaMask d'abord.", "error");
    return;
  }
  try {
    showToast("Transaction de réservation en cours...", "info");
    await TC.contract.methods.reserve(trainId).send({ from: TC.currentAccount, value: priceInWei });
    showToast("Réservation effectuée avec succès !", "success");
    await loadTrains();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de la réservation.", "error");
  }
}

async function cancelTrainReservation(trainId) {
  if (!TC.contract || !TC.currentAccount) {
    showToast("Connectez MetaMask d'abord.", "error");
    return;
  }
  try {
    showToast("Annulation en cours...", "info");
    await TC.contract.methods.cancelReservation(trainId).send({ from: TC.currentAccount });
    showToast("Réservation annulée. Vous pouvez demander un remboursement.", "success");
    await loadTrains();
    showRefundProposal(trainId);
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de l'annulation.", "error");
  }
}

function showRefundProposal(trainId) {
  const modal = document.getElementById("refundProposalModal");
  if (!modal) return;
  document.getElementById("refundProposalTrainId").textContent = "#" + trainId;
  modal.dataset.trainId = trainId;
  modal.classList.add("open");
}

function closeRefundProposal() {
  const modal = document.getElementById("refundProposalModal");
  if (modal) modal.classList.remove("open");
}

async function confirmRefundFromProposal() {
  const modal = document.getElementById("refundProposalModal");
  const trainId = modal ? modal.dataset.trainId : null;
  if (!trainId) return;
  closeRefundProposal();
  await requestTrainRefund(parseInt(trainId));
}

async function requestTrainRefund(trainId) {
  if (!TC.contract || !TC.currentAccount) {
    showToast("Connectez MetaMask d'abord.", "error");
    return;
  }
  try {
    showToast("Demande de remboursement en cours...", "info");
    await TC.contract.methods.requestRefund(trainId).send({ from: TC.currentAccount });
    showToast("Demande de remboursement envoyée.", "success");
    await loadTrains();
    checkMyReservation();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de la demande de remboursement.", "error");
  }
}

/* ── Search all reservations for a given train ── */
async function checkMyReservation() {
  const trainId = document.getElementById("reservationTrainId").value;
  const container = document.getElementById("reservationInfo");
  if (!trainId) { showToast("Entrez un ID de train.", "error"); return; }
  if (!TC.contract || !TC.currentAccount) { showToast("Connectez MetaMask d'abord.", "error"); return; }

  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const train = await TC.contract.methods.getTrain(trainId).call();

    // Vérifie si l'utilisateur connecté a une réservation pour ce train
    let userRes = null;
    try {
      const r = await TC.contract.methods.getReservation(trainId, TC.currentAccount).call();
      userRes = {
        trainId: Number(r.trainId),
        trainName: train.name,
        seatNumber: Number(r.seatNumber),
        amountPaid: r.amountPaid.toString(),
        amountEth: TC.web3.utils.fromWei(r.amountPaid.toString(), "ether"),
        active: r.active,
        refundRequested: r.refundRequested,
        refunded: r.refunded,
        user: r.user,
        departureTime: Number(train.departureTime || 0),
        duration: Number(train.duration || 0),
      };
    } catch (_) {
      // Aucune réservation trouvée pour cet utilisateur
    }

    if (!userRes) {
      const safeName = escapeHtml(train.name);
      const parts = safeName.split("-");
      const dep = parts[0] ? parts[0].trim() : safeName;
      const arr = parts.length >= 2 ? parts.slice(1).join("-").trim() : "";
      container.innerHTML = `
        <div class="search-result-header">
          <div class="search-result-train">
            <div class="search-result-icon">🚄</div>
            <div class="search-result-route">
              <span class="search-result-name">${dep}${arr ? ' → ' + arr : ''}</span>
              <span class="search-result-meta">Train ID #${escapeHtml(trainId)}</span>
            </div>
          </div>
        </div>
        <div class="empty-state" style="padding:24px;">
          <div class="empty-icon">🎫</div>
          <p>Vous n'avez pas de réservation pour ce train.</p>
        </div>`;
      return;
    }

    const safeName = escapeHtml(train.name);
    const parts = safeName.split("-");
    const departure = parts[0] ? parts[0].trim() : safeName;
    const arrival = parts.length >= 2 ? parts.slice(1).join("-").trim() : "";

    let html = '';
    html += '<div class="search-result-header">';
    html += '  <div class="search-result-train">';
    html += '    <div class="search-result-icon">🚄</div>';
    html += '    <div class="search-result-route">';
    html += '      <span class="search-result-name">' + departure + (arrival ? ' → ' + arrival : '') + '</span>';
    html += '      <span class="search-result-meta">Train ID #' + escapeHtml(trainId) + ' · Votre billet</span>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    html += '<div class="tickets-grid">';
    html += buildTicketCard(userRes);
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="empty-state" style="padding:20px;"><div class="empty-icon">⚠️</div><p>Erreur lors du chargement. Vérifiez que le train existe.</p></div>';
  }
}

/* ── Build premium SNCF-style ticket card ── */
function buildTicketCard(res) {
  let statusClass, statusLabel, statusIcon, statusRing;
  if (res.refunded) {
    statusClass = "ticket-refunded";
    statusLabel = "Remboursé";
    statusIcon = "💰";
    statusRing = "ring-refunded";
  } else if (res.refundRequested) {
    statusClass = "ticket-pending";
    statusLabel = "En attente";
    statusIcon = "⏳";
    statusRing = "ring-pending";
  } else if (res.active) {
    statusClass = "ticket-active";
    statusLabel = "Active";
    statusIcon = "✅";
    statusRing = "ring-active";
  } else {
    statusClass = "ticket-cancelled";
    statusLabel = "Annulée";
    statusIcon = "❌";
    statusRing = "ring-cancelled";
  }

  const safeName = escapeHtml(res.trainName);
  const parts = safeName.split("-");
  const departure = parts[0] ? parts[0].trim() : safeName;
  const arrival = parts.length >= 2 ? parts.slice(1).join("-").trim() : "—";

  let actionsHtml = '';
  const isCancelledNotRefunded = !res.active && !res.refundRequested && !res.refunded;
  const isOwnTicket = res.user.toLowerCase() === TC.currentAccount.toLowerCase();

  if (res.active && isOwnTicket) {
    actionsHtml = `
      <div class="ticket-action-zone">
        <button class="ticket-cancel-btn" onclick="cancelTrainReservation(${res.trainId})">
          <span class="ticket-cancel-btn-icon">✖</span>
          <span>Annuler ce billet</span>
        </button>
      </div>`;
  } else if (isCancelledNotRefunded && isOwnTicket) {
    actionsHtml = `
      <div class="ticket-action-zone">
        <button class="ticket-refund-btn" onclick="requestTrainRefund(${res.trainId})">
          <span class="ticket-refund-btn-icon">💸</span>
          <span>Demander le remboursement</span>
        </button>
      </div>`;
  } else if (res.refundRequested && !res.refunded) {
    actionsHtml = `
      <div class="ticket-action-zone ticket-action-pending">
        <span class="ticket-action-badge">⏳ Remboursement en attente de validation</span>
      </div>`;
  } else if (res.refunded) {
    actionsHtml = `
      <div class="ticket-action-zone ticket-action-done">
        <span class="ticket-action-badge">✅ Remboursement effectué</span>
      </div>`;
  }

  const userAddr = shortAddr(res.user);
  const isMe = isOwnTicket ? ' <span class="ticket-you-badge">Vous</span>' : '';

  // Date display
  let dateInfoHtml = '';
  if (res.departureTime && res.departureTime > 0) {
    const depDate = new Date(res.departureTime * 1000);
    const arrDate = new Date((res.departureTime + res.duration * 60) * 1000);
    const fmtDate = d => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    const fmtTime = d => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const h = Math.floor(res.duration / 60);
    const m = res.duration % 60;
    const durationStr = h > 0 ? h + "h" + (m > 0 ? m.toString().padStart(2, "0") : "") : m + "min";
    const isPastTicket = (res.departureTime + res.duration * 60) < Math.floor(Date.now() / 1000);
    dateInfoHtml = `
            <div class="ticket-info-item">
              <span class="ticket-info-label">Date</span>
              <span class="ticket-info-value">${fmtDate(depDate)}</span>
            </div>
            <div class="ticket-info-item">
              <span class="ticket-info-label">Horaires</span>
              <span class="ticket-info-value">${fmtTime(depDate)} → ${fmtTime(arrDate)}</span>
            </div>
            <div class="ticket-info-item">
              <span class="ticket-info-label">Durée</span>
              <span class="ticket-info-value">${durationStr}</span>
            </div>`;
  }

  return `
    <div class="ticket-card ${statusClass}">
      <div class="ticket-left">
        <div class="ticket-left-stripe"></div>
        <div class="ticket-left-content">
          <div class="ticket-brand">
            <span class="ticket-brand-logo">🚄</span>
            <span class="ticket-brand-name">TrainChain</span>
          </div>
          <div class="ticket-status-ring ${statusRing}">
            <span class="ticket-status-icon">${statusIcon}</span>
          </div>
          <span class="ticket-status-label">${statusLabel}</span>
        </div>
      </div>
      <div class="ticket-cut">
        <div class="ticket-cut-hole ticket-cut-hole-top"></div>
        <div class="ticket-cut-dashes"></div>
        <div class="ticket-cut-hole ticket-cut-hole-bottom"></div>
      </div>
      <div class="ticket-right">
        <div class="ticket-right-top">
          <div class="ticket-route-block">
            <div class="ticket-city">
              <span class="ticket-city-label">Départ</span>
              <span class="ticket-city-name">${departure}</span>
            </div>
            <div class="ticket-route-arrow-wrap">
              <div class="ticket-route-track">
                <span class="ticket-route-dot-s"></span>
                <span class="ticket-route-dash"></span>
                <span class="ticket-route-train-icon">🚄</span>
                <span class="ticket-route-dash"></span>
                <span class="ticket-route-dot-s"></span>
              </div>
            </div>
            <div class="ticket-city ticket-city-end">
              <span class="ticket-city-label">Arrivée</span>
              <span class="ticket-city-name">${arrival}</span>
            </div>
          </div>
        </div>
        <div class="ticket-separator"></div>
        <div class="ticket-right-bottom">
          <div class="ticket-info-grid">
            <div class="ticket-info-item">
              <span class="ticket-info-label">Train</span>
              <span class="ticket-info-value">#${res.trainId}</span>
            </div>
            <div class="ticket-info-item">
              <span class="ticket-info-label">Siège</span>
              <span class="ticket-info-value">#${res.seatNumber}</span>
            </div>
            <div class="ticket-info-item">
              <span class="ticket-info-label">Prix</span>
              <span class="ticket-info-value ticket-price-tag">${res.amountEth} ETH</span>
            </div>
            <div class="ticket-info-item">
              <span class="ticket-info-label">Passager</span>
              <span class="ticket-info-value ticket-user-addr">${userAddr}${isMe}</span>
            </div>
            ${dateInfoHtml}
          </div>
          <div class="ticket-barcode-zone">
            <div class="ticket-barcode-stripe"></div>
            <span class="ticket-barcode-id">TRAIN-${res.trainId}-SEAT-${res.seatNumber}</span>
          </div>
        </div>
        ${actionsHtml}
      </div>
    </div>`;
}

/* ── Expose ── */
window.reserveTrain = reserveTrain;
window.cancelTrainReservation = cancelTrainReservation;
window.requestTrainRefund = requestTrainRefund;
window.checkMyReservation = checkMyReservation;
window.showRefundProposal = showRefundProposal;
window.closeRefundProposal = closeRefundProposal;
window.confirmRefundFromProposal = confirmRefundFromProposal;

/* ── Load user's reserved train list as quick-access chips ── */
async function loadMyTrainsList() {
  const section = document.getElementById("myTrainsSection");
  if (!section) return;

  if (!TC.contract || !TC.currentAccount) {
    section.innerHTML = '';
    return;
  }

  try {
    const ids = await TC.contract.methods.getUserReservedTrains(TC.currentAccount).call();
    if (!ids || ids.length === 0) {
      section.innerHTML = '';
      return;
    }

    // For each train ID, fetch the reservation state
    const items = [];
    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysSec = 7 * 86400;

    for (const rawId of ids) {
      const id = Number(rawId);
      try {
        const r = await TC.contract.methods.getReservation(id, TC.currentAccount).call();
        const train = await TC.contract.methods.getTrain(id).call();
        const depTime = Number(train.departureTime || 0);
        const dur = Number(train.duration || 0);
        const arrivalTs = depTime + dur * 60;
        // Hide tickets for trains that arrived more than 7 days ago
        if (depTime > 0 && arrivalTs < (nowSec - sevenDaysSec)) continue;
        items.push({
          id,
          active: r.active,
          refundRequested: r.refundRequested,
          refunded: r.refunded,
          departureTime: depTime,
          duration: dur,
        });
      } catch (_) {}
    }

    if (items.length === 0) { section.innerHTML = ''; return; }

    let html = '<div class="my-trains-bar"><span class="my-trains-label">🎫 Mes réservations :</span><div class="my-trains-chips">';
    for (const item of items) {
      let chipClass, chipIcon;
      if (item.refunded)            { chipClass = 'chip-refunded';  chipIcon = '💰'; }
      else if (item.refundRequested){ chipClass = 'chip-pending';   chipIcon = '⏳'; }
      else if (item.active)         { chipClass = 'chip-active';    chipIcon = '✅'; }
      else                          { chipClass = 'chip-cancelled'; chipIcon = '❌'; }
      let dateLabel = '';
      if (item.departureTime > 0) {
        const d = new Date(item.departureTime * 1000);
        dateLabel = ' · ' + d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      }
      html += `<button class="my-train-chip ${chipClass}" onclick="selectMyTrain(${item.id})">${chipIcon} Train #${item.id}${dateLabel}</button>`;
    }
    html += '</div></div>';
    section.innerHTML = html;
  } catch (e) {
    section.innerHTML = '';
  }
}

/* ── Auto-fill the search input and trigger search ── */
function selectMyTrain(trainId) {
  const input = document.getElementById("reservationTrainId");
  if (input) {
    input.value = trainId;
    checkMyReservation();
  }
}

window.loadMyTrainsList = loadMyTrainsList;
window.selectMyTrain = selectMyTrain;
