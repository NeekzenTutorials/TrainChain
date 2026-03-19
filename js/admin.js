/* ══════════════════════════════════════
   TrainChain — admin.js
   Admin-only functions
══════════════════════════════════════ */

const adminPanels = [
  document.getElementById("addTrainPanel"),
  document.getElementById("cancelTrainPanel"),
  document.getElementById("refundPanel"),
  document.getElementById("balancePanel"),
  document.getElementById("adminReservationsPanel"),
];

function showAdminPanels() {
  const adminTab = document.getElementById("tabAdmin");
  const adminNav = document.getElementById("adminNav");
  if (isOwner()) {
    adminTab.classList.remove("hidden");
    if (adminNav) adminNav.style.display = "";
    // Show the first panel by default
    adminPanels.forEach((p, i) => {
      p.classList.remove("hidden");
      p.style.display = i === 0 ? "" : "none";
    });
  } else {
    adminTab.classList.add("hidden");
    if (adminNav) adminNav.style.display = "none";
    adminPanels.forEach(p => p.classList.add("hidden"));
  }
}

async function addTrain() {
  const name = document.getElementById("trainName").value.trim();
  const seats = document.getElementById("trainSeats").value;
  const price = document.getElementById("trainPrice").value;
  const departureInput = document.getElementById("trainDeparture").value;
  const duration = document.getElementById("trainDuration").value;

  if (!name || !seats || !price || !departureInput || !duration) {
    showToast("Remplissez tous les champs.", "error");
    return;
  }

  const departureTime = Math.floor(new Date(departureInput).getTime() / 1000);
  if (departureTime <= Math.floor(Date.now() / 1000)) {
    showToast("La date de départ doit être dans le futur.", "error");
    return;
  }

  try {
    showToast("Ajout du train en cours...", "info");
    await TC.contract.methods.addTrain(name, seats, price, departureTime, duration).send({ from: TC.currentAccount });
    showToast("Train ajouté avec succès !", "success");
    document.getElementById("trainName").value = "";
    document.getElementById("trainSeats").value = "";
    document.getElementById("trainPrice").value = "";
    document.getElementById("trainDeparture").value = "";
    document.getElementById("trainDuration").value = "";
    await loadTrains();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de l'ajout du train.", "error");
  }
}

async function approveRefund(trainId, user) {
  if (!trainId || !user) { showToast("Paramètres manquants.", "error"); return; }
  try {
    showToast("Validation du remboursement...", "info");
    await TC.contract.methods.approveRefund(trainId, user).send({ from: TC.currentAccount });
    showToast("Remboursement validé !", "success");
    await loadPendingRefunds();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de la validation.", "error");
  }
}

async function rejectRefund(trainId, user) {
  if (!trainId || !user) { showToast("Paramètres manquants.", "error"); return; }
  try {
    showToast("Refus du remboursement...", "info");
    await TC.contract.methods.rejectRefund(trainId, user).send({ from: TC.currentAccount });
    showToast("Remboursement refusé.", "success");
    await loadPendingRefunds();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors du refus.", "error");
  }
}

async function loadPendingRefunds() {
  const container = document.getElementById("pendingRefundsList");
  if (!container || !TC.contract) return;

  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const trainCount = Number(await TC.contract.methods.getTrainCount().call());
    const pendingRefunds = [];

    for (let t = 1; t <= trainCount; t++) {
      const resCount = Number(await TC.contract.methods.getReservationsCount(t).call());
      const train = await TC.contract.methods.getTrain(t).call();
      for (let i = 0; i < resCount; i++) {
        const r = await TC.contract.methods.getReservationByIndex(t, i).call();
        if (r.refundRequested && !r.refunded) {
          const amountEth = TC.web3.utils.fromWei(r.amountPaid.toString(), "ether");
          pendingRefunds.push({
            trainId: t,
            trainName: train.name,
            user: r.user,
            seatNumber: Number(r.seatNumber),
            amountEth,
          });
        }
      }
    }

    if (pendingRefunds.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Aucune demande de remboursement en attente.</p></div>';
      return;
    }

    let html = '<div class="reservations-list">';
    for (const req of pendingRefunds) {
      const safeName = escapeHtml(req.trainName);
      const safeUser = escapeHtml(req.user);
      html += `
        <div class="res-item refund-request-item">
          <div class="res-info">
            <span class="res-addr">${safeUser}</span>
            <span style="color:var(--text-muted);">Train #${req.trainId} — ${safeName} · Siège #${req.seatNumber} · ${req.amountEth} ETH</span>
          </div>
          <div class="res-flags">
            <span class="flag flag-refund-req">Remb. demandé</span>
          </div>
          <div class="refund-actions">
            <button class="btn btn-success btn-sm" onclick="approveRefund(${req.trainId}, '${req.user}')">✅ Valider</button>
            <button class="btn btn-danger btn-sm" onclick="rejectRefund(${req.trainId}, '${req.user}')">❌ Refuser</button>
          </div>
        </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p style="color:#f87171;">Erreur lors du chargement des demandes.</p>';
  }
}

async function loadContractBalance() {
  try {
    const balance = await TC.contract.methods.getContractBalance().call({ from: TC.currentAccount });
    document.getElementById("contractBalance").textContent =
      TC.web3.utils.fromWei(balance.toString(), "ether") + " ETH";
  } catch (error) {
    console.error(error);
    document.getElementById("contractBalance").textContent = "Erreur";
  }
}

async function loadAdminReservations() {
  const trainId = document.getElementById("adminResTrainId").value;
  const container = document.getElementById("adminReservationsList");
  if (!trainId) { showToast("Entrez un ID de train.", "error"); return; }

  try {
    const count = Number(await TC.contract.methods.getReservationsCount(trainId).call());
    if (count === 0) {
      container.innerHTML = '<p style="color:#64748b;font-size:14px;margin-top:8px;">Aucune réservation pour ce train.</p>';
      return;
    }

    let html = '<div class="reservations-list">';
    for (let i = 0; i < count; i++) {
      const r = await TC.contract.methods.getReservationByIndex(trainId, i).call();
      const amountEth = TC.web3.utils.fromWei(r.amountPaid.toString(), "ether");

      let flags = "";
      if (r.active) flags += '<span class="flag flag-active">Active</span>';
      else flags += '<span class="flag flag-cancelled">Annulée</span>';
      if (r.refundRequested) flags += '<span class="flag flag-refund-req">Remb. demandé</span>';
      if (r.refunded) flags += '<span class="flag flag-refunded">Remboursé</span>';

      html += `
        <div class="res-item">
          <div class="res-info">
            <span class="res-addr">${escapeHtml(r.user)}</span>
            <span style="color:#94a3b8;">Siège #${r.seatNumber} · ${amountEth} ETH</span>
          </div>
          <div class="res-flags">${flags}</div>
        </div>`;
    }
    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p style="color:#f87171;">Erreur lors du chargement.</p>';
  }
}

/* ── Expose ── */
window.addTrain = addTrain;
window.approveRefund = approveRefund;
window.rejectRefund = rejectRefund;
window.loadContractBalance = loadContractBalance;
window.loadAdminReservations = loadAdminReservations;
window.showAdminPanels = showAdminPanels;
window.loadPendingRefunds = loadPendingRefunds;

async function cancelTrainAdmin(trainId) {
  if (!TC.contract || !TC.currentAccount) {
    showToast("Connectez MetaMask d'abord.", "error");
    return;
  }
  if (!confirm("Êtes-vous sûr de vouloir annuler le train #" + trainId + " ? Tous les passagers seront remboursés automatiquement.")) {
    return;
  }
  try {
    showToast("Annulation du train en cours...", "info");
    await TC.contract.methods.cancelTrain(trainId).send({ from: TC.currentAccount });
    showToast("Train #" + trainId + " annulé. Tous les passagers ont été remboursés.", "success");
    await loadTrains();
    await loadCancellableTrains();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de l'annulation du train.", "error");
  }
}
window.cancelTrainAdmin = cancelTrainAdmin;

async function loadCancellableTrains() {
  const container = document.getElementById("cancellableTrainsList");
  if (!container || !TC.contract) return;

  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  try {
    const trainCount = Number(await TC.contract.methods.getTrainCount().call());
    const activeTrains = [];
    const cancelledTrains = [];

    for (let t = 1; t <= trainCount; t++) {
      const train = await TC.contract.methods.getTrain(t).call();
      const entry = {
        id: t,
        name: train.name,
        totalSeats: Number(train.totalSeats),
        reservedSeats: Number(train.reservedSeats),
        priceEth: TC.web3.utils.fromWei(train.priceInWei.toString(), "ether"),
        cancelled: train.cancelled || false,
        departureTime: Number(train.departureTime || 0),
        duration: Number(train.duration || 0),
      };
      if (entry.cancelled) cancelledTrains.push(entry);
      else activeTrains.push(entry);
    }

    if (activeTrains.length === 0 && cancelledTrains.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🚫</div><p>Aucun train disponible.</p></div>';
      return;
    }

    let html = '';

    if (activeTrains.length > 0) {
      html += '<div class="reservations-list">';
      for (const t of activeTrains) {
        const safeName = escapeHtml(t.name);
        let dateStr = "";
        if (t.departureTime > 0) {
          const d = new Date(t.departureTime * 1000);
          dateStr = " · " + d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        }
        html += `
          <div class="res-item">
            <div class="res-info">
              <span style="font-weight:600;color:var(--text-main);">Train #${t.id} — ${safeName}</span>
              <span style="color:var(--text-muted);">${t.totalSeats} places · ${t.reservedSeats} réservées · ${t.priceEth} ETH${dateStr}</span>
            </div>
            <div class="res-flags">
              <span class="flag flag-active">Actif</span>
            </div>
            <div class="refund-actions">
              <button class="btn btn-danger btn-sm" onclick="cancelTrainAdmin(${t.id})">🚫 Annuler</button>
            </div>
          </div>`;
      }
      html += '</div>';
    }

    if (cancelledTrains.length > 0) {
      html += '<h4 style="margin-top:20px;margin-bottom:10px;color:var(--text-muted);font-size:13px;">Trains annulés</h4>';
      html += '<div class="reservations-list">';
      for (const t of cancelledTrains) {
        const safeName = escapeHtml(t.name);
        html += `
          <div class="res-item" style="opacity:0.5;">
            <div class="res-info">
              <span style="font-weight:600;color:var(--text-main);">Train #${t.id} — ${safeName}</span>
              <span style="color:var(--text-muted);">${t.totalSeats} places · ${t.priceEth} ETH</span>
            </div>
            <div class="res-flags">
              <span class="flag flag-cancelled">Annulé</span>
            </div>
          </div>`;
      }
      html += '</div>';
    }

    container.innerHTML = html;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p style="color:#f87171;">Erreur lors du chargement des trains.</p>';
  }
}
window.loadCancellableTrains = loadCancellableTrains;
