/* ══════════════════════════════════════
   TrainChain — trainViz.js
   Train ASCII/CSS visualization
══════════════════════════════════════ */

function buildLocoHTML(trainId) {
  return `<div class="train-loco">
    <div class="loco-nose"><div class="loco-headlight"></div></div>
    <div class="loco-body">
      <div class="loco-windshield"></div>
      <div class="loco-wins"><div class="loco-w"></div><div class="loco-w"></div><div class="loco-w"></div><div class="loco-w"></div></div>
      <div class="loco-stripe"></div>
      <div class="loco-lbl">N°${trainId}</div>
      <div class="loco-wheels"><div class="tw"></div><div class="tw"></div><div class="tw"></div></div>
    </div>
  </div>`;
}

function buildWagonHTML(wagonNum, seatsInWagon, reservedInWagon) {
  const fillPct = seatsInWagon > 0 ? (reservedInWagon / seatsInWagon) * 100 : 0;
  let occClass = "occ-low";
  if (fillPct > 75) occClass = "occ-high";
  else if (fillPct > 40) occClass = "occ-med";

  let seatsHtml = "";
  for (let s = 0; s < seatsInWagon; s++) {
    seatsHtml += `<div class="ms ${s < reservedInWagon ? "rs" : "av"}"></div>`;
  }
  const numWins = Math.min(5, Math.max(2, Math.ceil(seatsInWagon / 2)));
  let winsHtml = "";
  for (let w = 0; w < numWins; w++) winsHtml += '<div class="w-win"></div>';

  return `<div class="coupling-j"></div><div class="train-wagon">
    <div class="wagon-body ${occClass}">
      <div class="wagon-wins">${winsHtml}</div>
      <div class="wagon-seats">${seatsHtml}</div>
      <div class="wagon-num">${wagonNum}</div>
      <div class="wagon-occ"><div class="wagon-occ-f" style="width:${fillPct}%"></div></div>
      <div class="wagon-wheels"><div class="tw"></div><div class="tw"></div></div>
    </div>
  </div>`;
}

function buildTailHTML() {
  return `<div class="coupling-j"></div><div class="train-tail">
    <div class="tail-body">
      <div class="tail-wins"><div class="t-win"></div><div class="t-win"></div><div class="t-win"></div></div>
      <div class="tail-lbl">FIN</div>
      <div class="tail-wheels"><div class="tw"></div><div class="tw"></div></div>
    </div>
    <div class="tail-end"><div class="tail-light"></div></div>
  </div>`;
}

function buildTrainViz(trainId, totalSeats, reservedSeats) {
  const numWagons = Math.max(1, Math.ceil(totalSeats / TC.SEATS_PER_WAGON));
  let seatsLeft = totalSeats;
  let resLeft = reservedSeats;
  const wagonData = [];
  for (let w = 0; w < numWagons; w++) {
    const seats = Math.min(TC.SEATS_PER_WAGON, seatsLeft);
    const res = Math.min(seats, resLeft);
    wagonData.push({ seats, reserved: res });
    seatsLeft -= seats;
    resLeft -= res;
  }

  let carsHtml = buildLocoHTML(trainId);
  for (let w = 0; w < numWagons; w++) {
    carsHtml += buildWagonHTML(w + 1, wagonData[w].seats, wagonData[w].reserved);
  }
  carsHtml += buildTailHTML();

  const totalParts = 1 + numWagons + 1;
  const maxOffset = Math.max(0, totalParts - 3);
  TC.trainScrollState[trainId] = { offset: 0, maxOffset };

  let dotsHtml = "";
  for (let d = 0; d <= maxOffset; d++) {
    dotsHtml += `<div class="sncf-dot ${d === 0 ? "active" : ""}" data-idx="${d}"></div>`;
  }

  return `
    <div class="sncf-scroll-wrap">
      <button class="sncf-arr" id="arr-l-${trainId}" onclick="scrollTrain(${trainId}, -1)" disabled>&#9664;</button>
      <div class="sncf-viewport">
        <div class="sncf-track">
          <div class="sncf-cars" id="cars-${trainId}">${carsHtml}</div>
          <div class="sncf-rail"></div>
        </div>
        <div class="sncf-dots" id="dots-${trainId}">${dotsHtml}</div>
      </div>
      <button class="sncf-arr" id="arr-r-${trainId}" onclick="scrollTrain(${trainId}, 1)" ${maxOffset === 0 ? "disabled" : ""}>&#9654;</button>
    </div>`;
}

function scrollTrain(trainId, dir) {
  const state = TC.trainScrollState[trainId];
  if (!state) return;
  state.offset = Math.max(0, Math.min(state.offset + dir, state.maxOffset));
  const cars = document.getElementById("cars-" + trainId);
  const leftBtn = document.getElementById("arr-l-" + trainId);
  const rightBtn = document.getElementById("arr-r-" + trainId);
  const dotsEl = document.getElementById("dots-" + trainId);
  cars.style.transform = "translateX(-" + (state.offset * TC.CAR_WIDTH_PX) + "px)";
  leftBtn.disabled = state.offset === 0;
  rightBtn.disabled = state.offset >= state.maxOffset;
  const dots = dotsEl.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle("active", i === state.offset);
  }
}

window.scrollTrain = scrollTrain;
