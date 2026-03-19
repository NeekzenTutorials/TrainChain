/* ══════════════════════════════════════
   TrainChain — modal.js
   User profile modal
══════════════════════════════════════ */

(function () {
  const modalBackdrop = document.getElementById("userModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const userAvatarBtn = document.getElementById("userAvatarBtn");

  function openUserModal() {
    if (!TC.currentAccount) { showToast("Connectez MetaMask d'abord.", "error"); return; }

    document.getElementById("modalAccount").textContent = TC.currentAccount;
    document.getElementById("modalOwner").textContent = TC.contractOwner || "-";

    const roleBadge = document.getElementById("modalRole");
    roleBadge.textContent = isOwner() ? "Admin" : "Utilisateur";
    roleBadge.className = "profile-badge " + (isOwner() ? "owner" : "user");

    TC.web3.eth.getBalance(TC.currentAccount).then(bal => {
      document.getElementById("modalBalance").textContent =
        parseFloat(TC.web3.utils.fromWei(bal, "ether")).toFixed(4) + " ETH";
    });

    modalBackdrop.classList.add("open");
  }

  function closeUserModal() {
    modalBackdrop.classList.remove("open");
  }

  userAvatarBtn.addEventListener("click", openUserModal);
  modalCloseBtn.addEventListener("click", closeUserModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeUserModal();
  });
})();
