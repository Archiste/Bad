const pre = document.getElementById("a");
const msg = document.getElementById("m");
const startOverlay = document.getElementById("startOverlay");
const playButton = document.getElementById("playButton");
const ramp = " .:-=+*#%@";

// Option : sur téléphone en portrait, tourne la vidéo de 90° (plus grande, mais couchée). Désactivé par défaut.
const ROTATE_ON_PORTRAIT = false;
const BASE_FONT = 10; // taille fixe : on agrandit/rétrécit avec transform, pas avec font-size

const music = new Audio(new URL("bad-apple.mp3", document.baseURI).href);
music.loop = true;
music.volume = 0.5;
music.preload = "auto";
music.load();

function measureCharWidth() {
  const sample = document.createElement("span");
  sample.style.cssText = `
    font: 100px ${getComputedStyle(pre).fontFamily};
    position: absolute;
    visibility: hidden;
    white-space: pre;
  `;
  sample.textContent = "M".repeat(20);
  document.body.appendChild(sample);
  const width = sample.getBoundingClientRect().width / 20 / 100;
  sample.remove();
  return width;
}

function fit() {
  const naturalWidth = VIDEO_WIDTH * measureCharWidth() * BASE_FONT;
  const naturalHeight = VIDEO_HEIGHT * 1.2 * BASE_FONT;

  const style = getComputedStyle(document.body);
  const margin = 8;
  const availableWidth = Math.max(
    document.body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - margin * 2,
    1
  );
  const availableHeight = Math.max(
    document.body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - margin * 2,
    1
  );

  const straight = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  const turned = Math.min(availableWidth / naturalHeight, availableHeight / naturalWidth);
  const isPhonePortrait = Math.min(innerWidth, innerHeight) <= 600 && innerHeight > innerWidth;
  const rotate = ROTATE_ON_PORTRAIT && isPhonePortrait && turned > straight * 1.15;

  pre.style.transform = `${rotate ? "rotate(90deg) " : ""}scale(${rotate ? turned : straight})`;
}

addEventListener("resize", fit);
addEventListener("orientationchange", fit);
fit();

async function loadVideoData() {
  const binary = Uint8Array.from(atob(B64), (char) => char.charCodeAt(0));
  const stream = new Blob([binary]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

loadVideoData()
  .then((videoData) => {
    msg.remove();

    const frameBuffer = new Uint8Array((VIDEO_WIDTH + 1) * VIDEO_HEIGHT - 1);
    const decoder = new TextDecoder("latin1");
    const charMap = [...ramp].map((char) => char.charCodeAt(0));

    let playing = false;
    let startTime = performance.now();
    let offset = 0;
    let lastFrameIndex = -1;
    let hasStarted = false;

    function drawFrame(frameIndex) {
      const baseIndex = frameIndex * VIDEO_WIDTH * VIDEO_HEIGHT;
      let bufferIndex = 0;

      for (let row = 0; row < VIDEO_HEIGHT; row += 1) {
        for (let column = 0; column < VIDEO_WIDTH; column += 1) {
          frameBuffer[bufferIndex++] = charMap[videoData[baseIndex + row * VIDEO_WIDTH + column]];
        }
        if (row < VIDEO_HEIGHT - 1) {
          frameBuffer[bufferIndex++] = 10;
        }
      }

      pre.textContent = decoder.decode(frameBuffer);
    }

    function tick(now) {
      if (playing) {
        const frameIndex = Math.floor(((now - startTime) / 1000) * VIDEO_FPS + offset) % VIDEO_FRAME_COUNT;
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
      playing = true;

      music.currentTime = 0;
      music.play().catch(() => {
        console.warn("Impossible de lire bad-apple.mp3 :", music.error);
      });

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
        music.play().catch(() => {
        console.warn("Impossible de lire bad-apple.mp3 :", music.error);
      });
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
    fit();
    requestAnimationFrame(tick);
  })
  .catch(() => {
    msg.textContent = "Ce navigateur ne peut pas lire la vidéo ASCII.";
  });
