/* ══════════════════════════════════════
   TrainChain — utils.js
   Toast notifications & helpers
══════════════════════════════════════ */

let _toastTimeout;

function showToast(message, type) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = type + " show";
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => { toast.classList.remove("show"); }, 4000);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function isOwner() {
  return TC.currentAccount && TC.contractOwner &&
    TC.currentAccount.toLowerCase() === TC.contractOwner.toLowerCase();
}
