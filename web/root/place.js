class Place {
  #loaded;
  #socket;
  #loadingp;
  #uiwrapper;
  #glWindow;
  #allowDraw;

  constructor(glWindow) {
    this.#loaded = false;
    this.#socket = null;
    this.#loadingp = document.querySelector("#loading-p");
    this.#uiwrapper = document.querySelector("#ui-wrapper");
    this.#glWindow = glWindow;
    this.#allowDraw = null;
  }

  initConnection() {
    this.#loadingp.innerHTML = "connecting";

    let host = window.location.hostname;
    let port = window.location.port;
    if (port != "") {
      host += ":" + port;
    }

    let wsProt;
    if (window.location.protocol == "https:") {
      wsProt = "wss:";
    } else {
      wsProt = "ws:";
    }

    this.#connect(wsProt + "//" + host + "/ws");
    this.#loadingp.innerHTML = "Loading Grafitti Magic";

    fetch(window.location.protocol + "//" + host + "/place.png").then(
      async (resp) => {
        if (!resp.ok) {
          console.error("Error downloading canvas.");
          return null;
        }

        let buf = await this.#downloadProgress(resp);
        await this.#setImage(buf);

        this.#loaded = true;
        this.#loadingp.innerHTML = "";
        this.#uiwrapper.setAttribute("hide", true);
      }
    );
  }

  async #downloadProgress(resp) {
    let len = resp.headers.get("Content-Length");
    let a = new Uint8Array(len);
    let pos = 0;
    let reader = resp.body.getReader();
    while (true) {
      let { done, value } = await reader.read();
      if (value) {
        a.set(value, pos);
        pos += value.length;
        this.#loadingp.innerHTML =
          "Loading Grafitti Magic " + Math.round((pos / len) * 100) + "%";
      }
      if (done) break;
    }
    return a;
  }

  #connect(path) {
    console.log("Connecting to " + path);
    this.#socket = new WebSocket(path);

    const socketMessage = async (event) => {
      let b = await event.data.arrayBuffer();
      if (this.#allowDraw == null) {
        let view = new DataView(b);

        this.#allowDraw = view.getUint8(0) === 1;
        if (!this.#allowDraw) {
          console.log("Not allowed to draw.");
          this.#keyPrompt();
        }
      } else {
        this.#handleSocketSetPixel(b);
      }
    };

    const socketClose = (event) => {
      this.#socket = null;
    };

    const socketError = (event) => {
      console.error("Error making WebSocket connection.");
      alert("Failed to connect.");
      this.#socket.close();
    };

    this.#socket.addEventListener("message", socketMessage);
    this.#socket.addEventListener("close", socketClose);
    this.#socket.addEventListener("error", socketError);
  }

  setPixel(x, y, color) {
    if (!this.#allowDraw) {
      console.log("Not allowed to draw.");
      this.#keyPrompt();
      return;
    }

    if (this.#socket != null && this.#socket.readyState == 1) {
      let b = new Uint8Array(11);
      this.#putUint32(b.buffer, 0, x);
      this.#putUint32(b.buffer, 4, y);
      for (let i = 0; i < 3; i++) {
        b[8 + i] = color[i];
      }
      this.#socket.send(b);
      this.#glWindow.setPixelColor(x, y, color);
      this.#glWindow.draw(true);
    } else {
      alert("Disconnected.");
      console.error("Disconnected.");
    }
  }

  #handleSocketSetPixel(b) {
    if (this.#loaded) {
      let x = this.#getUint32(b, 0);
      let y = this.#getUint32(b, 4);
      let color = new Uint8Array(b.slice(8));
      this.#glWindow.setPixelColor(x, y, color);
      this.#glWindow.draw();
    }
  }

  async #setImage(data) {
    let img = new Image();
    let blob = new Blob([data], { type: "image/png" });
    let blobUrl = URL.createObjectURL(blob);
    img.src = blobUrl;
    let promise = new Promise((resolve, reject) => {
      img.onload = () => {
        this.#glWindow.setTexture(img);
        this.#glWindow.draw();
        resolve();
      };
      img.onerror = reject;
    });
    await promise;
  }

  #putUint32(b, offset, n) {
    let view = new DataView(b);
    view.setUint32(offset, n, false);
  }

  #getUint32(b, offset) {
    let view = new DataView(b);
    return view.getUint32(offset, false);
  }

  #keyPrompt(signature) {
    const key = localStorage.getItem("signature");
    const address = localStorage.getItem("address");
    if (!address || !key) {
      return;
    }

    fetch(
      `./verifykey?address=${address}&key=${encodeURIComponent(key.trim())}`
    ).then(async (resp) => {
      if (resp.ok) {
        this.#allowDraw = true;
        document.getElementById("checkedInscription").style.display =
          "inline-block";

        window.location.reload();
      } else {
        document.getElementById("notCheckedInscription").style.display =
          "inline-block";
        document.getElementById("checkedInscription").style.display = "none";
      }
    });
  }
}
