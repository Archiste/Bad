const pre = document.getElementById("a");
const msg = document.getElementById("m");
const startOverlay = document.getElementById("startOverlay");
const playButton = document.getElementById("playButton");
const ramp = " .:-=+*#%@";

const music = new Audio("【東方】Bad Apple!! ＰＶ【影絵】.mp3");
music.loop = true;
music.volume = 0.5;
music.preload = "auto";

function fit() {
  const sample = document.createElement("span");
  sample.style.cssText = `
    font: 100px ${getComputedStyle(pre).fontFamily};
    position: absolute;
    visibility: hidden;
    white-space: pre;
  `;
  sample.textContent = "M".repeat(20);
  document.body.appendChild(sample);

  const charWidth = sample.getBoundingClientRect().width / 20 / 100;
  sample.remove();

  const scale = Math.min(innerWidth / (W * charWidth), innerHeight / (H * 1.2));
  pre.style.fontSize = `${Math.floor(scale * 10) / 10}px`;
}

addEventListener("resize", fit);
fit();

async function loadVideoData() {
  const binary = Uint8Array.from(atob(B64), (char) => char.charCodeAt(0));
  const stream = new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

loadVideoData()
  .then((videoData) => {
    msg.remove();

    const frameBuffer = new Uint8Array((W + 1) * H);
    const decoder = new TextDecoder("latin1");
    const charMap = [...ramp].map((char) => char.charCodeAt(0));

    let playing = false;
    let startTime = performance.now();
    let offset = 0;
    let lastFrameIndex = -1;
    let hasStarted = false;

    function drawFrame(frameIndex) {
      const baseIndex = frameIndex * W * H;
      let bufferIndex = 0;

      for (let row = 0; row < H; row += 1) {
        for (let column = 0; column < W; column += 1) {
          frameBuffer[bufferIndex++] = charMap[videoData[baseIndex + row * W + column]];
        }
        frameBuffer[bufferIndex++] = 10;
      }

      pre.textContent = decoder.decode(frameBuffer);
    }

    function tick(now) {
      if (playing) {
        const frameIndex = Math.floor(((now - startTime) / 1000) * FPS + offset) % N;
        if (frameIndex !== lastFrameIndex) {
          drawFrame(frameIndex);
          lastFrameIndex = frameIndex;
        }
      }

      requestAnimationFrame(tick);
    }

    function startPlayback() {
      if (hasStarted) {
        return;
      }

      hasStarted = true;
      startOverlay.classList.add("hidden");
      startTime = performance.now();
      playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;

      music.currentTime = 0;
      music.play().catch(() => {});

      if (!playing) {
        drawFrame(0);
        lastFrameIndex = 0;
      }
    }

    function togglePlayback() {
      if (!hasStarted) {
        startPlayback();
        return;
      }

      const now = performance.now();

      if (playing) {
        offset = Math.max(lastFrameIndex, 0);
        playing = false;
        music.pause();
      } else {
        startTime = now;
        playing = true;
        music.play().catch(() => {});
      }
    }

    playButton.addEventListener("click", (event) => {
      event.stopPropagation();
      startPlayback();
    });

    document.addEventListener("click", (event) => {
      if (event.target !== playButton && hasStarted) {
        togglePlayback();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        event.preventDefault();
        if (!hasStarted) {
          startPlayback();
        } else {
          togglePlayback();
        }
      }
    });

    drawFrame(0);
    lastFrameIndex = 0;
    requestAnimationFrame(tick);
  })
  .catch(() => {
    msg.textContent = "Ce navigateur ne peut pas lire la vidéo ASCII.";
  });
