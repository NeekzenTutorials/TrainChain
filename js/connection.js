/* ══════════════════════════════════════
   TrainChain — connection.js
   MetaMask connection
══════════════════════════════════════ */

const connectBtn = document.getElementById("connectBtn");
const userAvatarBtn = document.getElementById("userAvatarBtn");

async function connectMetaMask() {
  if (!window.ethereum) {
    showToast("MetaMask n'est pas installé !", "error");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    TC.web3 = new Web3(window.ethereum);
    const accounts = await TC.web3.eth.getAccounts();
    TC.currentAccount = accounts[0];

    TC.contract = new TC.web3.eth.Contract(abi, TC.contractAddress);
    TC.contractOwner = await TC.contract.methods.owner().call();

    connectBtn.textContent = "✅ " + shortAddr(TC.currentAccount);
    connectBtn.classList.add("connected");
    userAvatarBtn.classList.add("visible");

    showAdminPanels();

    showToast("Connecté avec succès !", "success");
    await loadTrains();
    if (isOwner()) await loadContractBalance();
  } catch (error) {
    console.error(error);
    showToast("Erreur lors de la connexion.", "error");
  }
}

/* ── Event listeners ── */
connectBtn.addEventListener("click", connectMetaMask);

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());

  // Auto-reconnect if MetaMask was already authorized
  window.ethereum.request({ method: "eth_accounts" }).then(accounts => {
    if (accounts && accounts.length > 0) {
      connectMetaMask();
    }
  });
}
