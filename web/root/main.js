function main() {
  let cvs = document.querySelector("#viewport-canvas");
  let glWindow = new GLWindow(cvs);

  if (!glWindow.ok()) return;

  let place = new Place(glWindow);
  place.initConnection();

  let gui = GUI(cvs, glWindow, place);
}

const GUI = (cvs, glWindow, place) => {
  let color = new Uint8Array([247, 147, 26]);
  let dragdown = false;
  let touchID = 0;
  let touchScaling = false;
  let lastMovePos = { x: 0, y: 0 };
  let lastScalingDist = 0;
  let touchstartTime;

  const colorField = document.querySelector("#colorPickerInput");
  const colorSwatch = document.querySelector("#colorWatch");
  const pixelAmount = document.querySelector("#pixelAmount");
  const mobileWarning = document.querySelector("#mobileWarning");
  const connectWallet = document.querySelector("#connectWallet");
  const checkedWallet = document.querySelector("#checkedWallet");

  const twitterLink = document.querySelector("#twitterLink");
  const checkedTwitter = document.querySelector("#checkedTwitter");

  // new circle and its not a color colorPicke

  // ***************************************************
  // ***************************************************
  // Event Listeners
  //
  // console.log("✌️ctxBoard --->", ctxBoard);
  // let ctxBoard = glWindow.getGLContext();
  // console.log("✌️ctxBoard --->", ctxBoard);
  // console.log("glWindow --->");

  // cvs.addEventListener("mousemove", function (e) {
  //   let rect = cvs.getBoundingClientRect();
  //   console.log("✌️rect --->", rect);
  //   let x = e.clientX - rect.left;
  //   let y = e.clientY - rect.top;

  //   // Clear previous highlighting
  //   ctxBoard.clearRect(0, 0, cvs.width, cvs.height);

  //   // Draw a rectangle or a dot to highlight the pixel
  //   ctxBoard.fillStyle = "red"; // or any highlight color
  //   ctxBoard.fillRect(x, y, 1, 1); // 1x1 pixel at the mouse position
  // });

  document.addEventListener("keydown", (ev) => {
    switch (ev.keyCode) {
      case 189:
      case 173:
        ev.preventDefault();
        zoomOut(1.2);
        break;
      case 187:
      case 61:
        ev.preventDefault();
        zoomIn(1.2);
        break;
    }
  });

  window.addEventListener("wheel", (ev) => {
    let zoom = glWindow.getZoom();
    if (ev.deltaY > 0) {
      zoom /= 1.05;
    } else {
      zoom *= 1.05;
    }
    glWindow.setZoom(zoom);
    glWindow.draw();
  });

  document.querySelector("#zoom-in").addEventListener("click", () => {
    zoomIn(1.2);
  });

  document.querySelector("#zoom-out").addEventListener("click", () => {
    zoomOut(1.2);
  });

  window.addEventListener("resize", (ev) => {
    glWindow.updateViewScale();
    glWindow.draw();
  });

  cvs.addEventListener("mousedown", (ev) => {
    switch (ev.button) {
      case 0:
        dragdown = true;
        lastMovePos = { x: ev.clientX, y: ev.clientY };
        break;
      case 1:
        pickColor({ x: ev.clientX, y: ev.clientY });
        break;
      case 2:
        if (ev.ctrlKey) {
          pickColor({ x: ev.clientX, y: ev.clientY });
        } else {
          console.log("✌️{ x: ev.clientX, y: ev.clientY } --->", {
            x: ev.clientX,
            y: ev.clientY,
          });
          drawPixel({ x: ev.clientX, y: ev.clientY }, color);
        }
    }
  });

  document.addEventListener("mouseup", (ev) => {
    dragdown = false;
    document.body.style.cursor = "auto";
  });

  document.addEventListener("mousemove", (ev) => {
    const movePos = { x: ev.clientX, y: ev.clientY };
    if (dragdown) {
      glWindow.move(movePos.x - lastMovePos.x, movePos.y - lastMovePos.y);
      glWindow.draw();
      document.body.style.cursor = "grab";
    }
    lastMovePos = movePos;
  });

  cvs.addEventListener("touchstart", (ev) => {
    let thisTouch = touchID;
    touchstartTime = new Date().getTime();
    lastMovePos = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
    if (ev.touches.length === 2) {
      touchScaling = true;
      lastScalingDist = null;
    }

    setTimeout(() => {
      if (thisTouch == touchID) {
        pickColor(lastMovePos);
        navigator.vibrate(200);
      }
    }, 350);
  });

  document.addEventListener("touchend", (ev) => {
    touchID++;
    let elapsed = new Date().getTime() - touchstartTime;
    if (elapsed < 100) {
      if (drawPixel(lastMovePos, color)) {
        navigator.vibrate(10);
      }
    }
    if (ev.touches.length === 0) {
      touchScaling = false;
    }
  });

  document.addEventListener("touchmove", (ev) => {
    touchID++;
    if (touchScaling) {
      let dist = Math.hypot(
        ev.touches[0].pageX - ev.touches[1].pageX,
        ev.touches[0].pageY - ev.touches[1].pageY
      );
      if (lastScalingDist != null) {
        let delta = lastScalingDist - dist;
        if (delta < 0) {
          zoomIn(1 + Math.abs(delta) * 0.003);
        } else {
          zoomOut(1 + Math.abs(delta) * 0.003);
        }
      }
      lastScalingDist = dist;
    } else {
      let movePos = { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      glWindow.move(movePos.x - lastMovePos.x, movePos.y - lastMovePos.y);
      glWindow.draw();
      lastMovePos = movePos;
    }
  });

  cvs.addEventListener("contextmenu", () => {
    return false;
  });

  colorField.addEventListener("change", (ev) => {
    let hex = colorField.value.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
    hex = hex.substring(0, 6);
    while (hex.length < 6) {
      hex += "0";
    }
    color[0] = parseInt(hex.substring(0, 2), 16);
    color[1] = parseInt(hex.substring(2, 4), 16);
    color[2] = parseInt(hex.substring(4, 6), 16);
    hex = "#" + hex;
    colorField.value = hex;
    colorSwatch.style.backgroundColor = hex;
  });

  // colorField.addEventListener("focus", (ev) => {
  //   colorPickerPopup.style.display = "block";
  // });

  // colorField.addEventListener("blur", (ev) => {
  // });

  // ***************************************************
  // ***************************************************
  // Helper Functions
  //

  const pickColor = (pos) => {
    color = glWindow.getColor(glWindow.click(pos));
    let hex = "#";
    for (let i = 0; i < color.length; i++) {
      let d = color[i].toString(16);
      if (d.length == 1) d = "0" + d;
      hex += d;
    }
    colorField.value = hex.toUpperCase();
    colorSwatch.style.backgroundColor = hex;
  };

  const drawPixel = (pos, color) => {
    pos = glWindow.click(pos);
    if (pixelAmount.value === "0 points") {
      return false;
    }
    pixelAmount.value = `${
      Number(pixelAmount.value.split(" points")[0]) - 1
    } points`;

    localStorage.setItem("pixelAmount", pixelAmount.value);

    if (pos) {
      const oldColor = glWindow.getColor(pos);
      for (let i = 0; i < oldColor.length; i++) {
        if (oldColor[i] != color[i]) {
          const key = localStorage.getItem("signature");
          if (key) {
            place.setPixel(pos.x, pos.y, color, key);
            return true;
          } else {
            return false;
          }
        }
      }
    }
    return false;
  };

  const zoomIn = (factor) => {
    let zoom = glWindow.getZoom();
    glWindow.setZoom(zoom * factor);
    glWindow.draw();
  };

  const zoomOut = (factor) => {
    let zoom = glWindow.getZoom();
    glWindow.setZoom(zoom / factor);
    glWindow.draw();
  };

  const canvas = document.getElementById("colorCanvas");
  const ctx = canvas.getContext("2d");

  // const selectedColorInput = document.getElementById("selectedColor");

  // Create color gradients
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  // Add color stops
  gradient.addColorStop(0, "rgb(255, 0, 0)");
  gradient.addColorStop(0.15, "rgb(255, 0, 255)");
  gradient.addColorStop(0.33, "rgb(0, 0, 255)");
  gradient.addColorStop(0.49, "rgb(0, 255, 255)");
  gradient.addColorStop(0.67, "rgb(0, 255, 0)");
  gradient.addColorStop(0.84, "rgb(255, 255, 0)");
  gradient.addColorStop(1, "rgb(255, 0, 0)");

  // Apply the gradient across the canvas
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add black-white gradient
  const bwGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bwGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  bwGradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  bwGradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  bwGradient.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.fillStyle = bwGradient;
  ctx.fillStyle = bwGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  colorSwatch.addEventListener("click", function () {
    if (colorPickerPopup.style.display === "block") {
      colorPickerPopup.style.display = "none";
      return;
    }
    colorPickerPopup.style.display = "block";
    const rect = colorPickerInput.getBoundingClientRect();
    colorPickerPopup.style.top = `${rect.top + rect.height}px`;
    colorPickerPopup.style.left = `${rect.left}px`;
  });
  colorPickerInput.addEventListener("focus", function () {
    colorPickerPopup.style.display = "block";
    const rect = colorPickerInput.getBoundingClientRect();
    colorPickerPopup.style.top = `${rect.top + rect.height}px`;
    colorPickerPopup.style.left = `${rect.left}px`;
  });

  canvas.addEventListener("click", function (event) {
    const x = event.offsetX;
    const y = event.offsetY;
    const pixel = ctx.getImageData(x, y, 1, 1);
    const data = pixel.data;

    const hex =
      "#" +
      ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2])
        .toString(16)
        .slice(1)
        .toUpperCase();

    color[0] = parseInt(hex.split("#")[1].substring(0, 2), 16);
    color[1] = parseInt(hex.split("#")[1].substring(2, 4), 16);
    color[2] = parseInt(hex.split("#")[1].substring(4, 6), 16);

    colorPickerInput.value = hex.toUpperCase();

    const colorSwatch = document.querySelector("#colorWatch");
    colorSwatch.style.backgroundColor = hex;

    colorPickerPopup.style.display = "none"; // Use "none" to hide it, not "hidden"

    // colorPickerPopup.style.display = 'none';
  });

  document.addEventListener("click", function (event) {
    if (
      !colorPickerInput.contains(event.target) &&
      !colorPickerPopup.contains(event.target)
    ) {
      // colorPickerPopup.style.display = 'none';
    }
  });

  async function checkUnisat(handleAccountsChanged, handleNetworkChanged) {
    let unisat = window.unisat;

    for (let i = 1; i < 10 && !unisat; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100 * i));
      unisat = window.unisat;
    }

    if (unisat) {
      // Implement or call any necessary logic upon successful detection of unisat
      console.log("Unisat is installed.");
    } else {
      // pixelAmount.style.visibility = "hidden";
      // Handle the case where unisat is not found
      console.log("Unisat is not installed.");

      return;
    }

    unisat.getAccounts().then((accounts) => {
      handleAccountsChanged(accounts);
    });

    unisat.on("accountsChanged", handleAccountsChanged);
    unisat.on("networkChanged", handleNetworkChanged);

    // For cleanup, you might want to remove event listeners when they are no longer needed
    // This is more complex in vanilla JS and might depend on how your application is structured
    // Consider where and how you can safely remove these listeners
  }

  checkUnisat(
    (accounts) => {
      const sig = localStorage.getItem("signature");
      const address = localStorage.getItem("address");
      console.log("✌️address --->", address);

      if (address !== accounts[0]) {
        localStorage.removeItem("signature");
        localStorage.removeItem("address");

        localStorage.setItem("address", accounts[0]);
        // clean cookies
        document.cookie =
          "signature=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

        connectWallet.innerText = "Connect Wallet";
        document.querySelector("#pixelAmount").style.display = "none";
      }

      if (sig) {
        getPoints();

        connectWallet.innerText =
          accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4);

        checkedWallet.style.display = "inline-block";
      }
    },
    () => {}
  );

  connectWallet.addEventListener("click", async () => {
    const unisat = window.unisat;
    if (unisat) {
      if (localStorage.getItem("signature")) {
        return;
      }
      const accounts = await unisat.getAccounts();
      const res = await unisat.requestAccounts();
      const message = "Sign this message to connect";

      try {
        const signature = await unisat.signMessage(message, "ecdsa");
        const address = res[0];
        if (address) {
          document.getElementById("checkedWallet").style.display =
            "inline-block";
        }
        localStorage.setItem("signature", signature);
        localStorage.setItem("address", address);

        document.querySelector("#pixelAmount").style.display = "flex";

        fetch(
          `./verifykey?address=${address}&key=${encodeURIComponent(
            signature.trim()
          )}`
        )
          .then(async (resp) => {
            if (resp.ok) {
              document.getElementById("checkedInscription").style.display =
                "inline-block";
            }
            getPoints();
            window.location.reload();
          })
          .catch((error) => {
            console.error("[verifykey] Error:", error);
          });
      } catch (error) {
        console.error("User denied message signature.");
        connectWallet.innerText = "Sign to connect";
        return;
      }

      if (accounts.length !== 0) {
        connectWallet.innerText =
          accounts[0].slice(0, 6) + "..." + accounts[0].slice(-4);
      }
      if (accounts.length === 0) {
        connectWallet.innerText = res[0].slice(0, 6) + "..." + res[0].slice(-4);
      }
    }
  });

  async function getPoints() {
    const key = localStorage.getItem("signature");

    fetch("./points?key=" + encodeURIComponent(key)).then(async (resp) => {
      const amount = await resp.text();

      if (resp.status !== 200 && resp.status !== 203) {
        document.querySelector("#pixelAmount").value = `${0} points`;
        document.querySelector("#pixelAmount").style.display = "none";
        return;
      }

      document.getElementById("checkedInscription").style.display =
        "inline-block";
      document.querySelector("#pixelAmount").style.display = "flex";

      document.querySelector("#pixelAmount").value = `${amount} points`;
    });
  }

  async function handleMobile() {
    if (window?.innerWidth < 800) {
      mobileWarning.style.display = "flex";
    } else {
      mobileWarning.style.display = "none";
    }
  }
  handleMobile();

  twitterLink.addEventListener("click", async () => {
    checkedTwitter.style.display = "inline-block";
  });
};
