const pre = document.getElementById("a");
const msg = document.getElementById("m");
const startOverlay = document.getElementById("startOverlay");
const playButton = document.getElementById("playButton");
const music = document.getElementById("music");
const ramp = " .:-=+*#%@";

const BASE_FONT = 10;

music.volume = 0.5;
music.loop = true;
music.preload = "auto";

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

  const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  pre.style.transform = `rotate(0deg) scale(${scale})`;
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
    let hasStarted = false;
    let lastFrameIndex = -1;

    function drawFrame(frameIndex) {
      const safeFrame = ((frameIndex % VIDEO_FRAME_COUNT) + VIDEO_FRAME_COUNT) % VIDEO_FRAME_COUNT;
      const baseIndex = safeFrame * VIDEO_WIDTH * VIDEO_HEIGHT;
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
      lastFrameIndex = safeFrame;
    }

    function tick() {
      if (playing && !music.paused && Number.isFinite(music.currentTime)) {

        const frameIndex = Math.floor(music.currentTime * VIDEO_FPS) % VIDEO_FRAME_COUNT;
        if (frameIndex !== lastFrameIndex) {
          drawFrame(frameIndex);
        }
      }

      requestAnimationFrame(tick);
    }

    function showAudioError(error) {
      console.error("BadArchiste audio error:", error, music.error);
      playButton.disabled = false;
      playButton.textContent = "Retry Play";
      msg.textContent = "Audio blocked or unavailable. Click Play again, or allow autoplay for this site.";
      msg.style.display = "block";
    }

    async function startPlayback() {
      if (hasStarted) return;

      playButton.disabled = true;
      playButton.textContent = "Loading…";

      try {
 
        music.currentTime = 0;
        await music.play();

        hasStarted = true;
        playing = true;
        startOverlay.classList.add("hidden");
        playButton.textContent = "Playing";
        msg.style.display = "none";
        drawFrame(Math.floor(music.currentTime * VIDEO_FPS));
      } catch (error) {
        showAudioError(error);
      } finally {
        if (!hasStarted) {
          playButton.disabled = false;
        }
      }
    }

    async function togglePlayback() {
      if (!hasStarted) {
        await startPlayback();
        return;
      }

      if (music.paused) {
        try {
          await music.play();
          playing = true;
        } catch (error) {
          showAudioError(error);
        }
      } else {
        music.pause();
        playing = false;
        drawFrame(Math.floor(music.currentTime * VIDEO_FPS));
      }
    }

    music.addEventListener("error", () => showAudioError(new Error("Audio element error")));
    music.addEventListener("ended", () => {
    
      if (hasStarted) {
        playing = true;
        drawFrame(0);
      }
    });

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
        togglePlayback();
      }
    });

    drawFrame(0);
    fit();
    requestAnimationFrame(tick);
  })
  .catch((error) => {
    console.error("ASCII data error:", error);
    msg.textContent = "Ce navigateur ne peut pas lire la vidéo ASCII.";
  });
