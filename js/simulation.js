/* =========================================================
   MEMORY ALLOCATION SIMULATOR
   First-Fit | Best-Fit | Worst-Fit
   Automatic visual simulation
   ========================================================= */

(() => {
  "use strict";

  const root = document.getElementById("memorySimulator");

  if (!root) return;

  const $ = (selector) => root.querySelector(selector);

  const memoryInput = $("#memoryInput");
  const processInput = $("#processInput");
  const memoryContainer = $("#memoryBlocks");
  const stepsContainer = $("#simulationSteps");
  const stepsHeadingEl = $("#stepsHeading");
  const queueEl = $("#processQueue");

  const allocateBtn = $("#allocateBtn");
  const resetBtn = $("#resetBtn");

  const currentProcessEl = $("#currentProcess");
  const processStatusEl = $("#processStatus");
  const simulationStatusEl = $("#simulationStatus");

  const totalMemoryEl = $("#totalMemory");
  const usedMemoryEl = $("#usedMemory");
  const freeMemoryEl = $("#freeMemory");
  const fragmentationEl = $("#internalFragmentation");

  const DEFAULT_MEMORY = "100 500 200 300 600";
  const DEFAULT_PROCESSES = "212 417 112 426";

  let algorithm = "first";
  let blocks = [];
  let processes = [];

  let running = false;
  let runId = 0;

  let currentBlockId = null;
  let currentBlockState = "";
  let currentBlockLabel = "";
  let activeProcessId = null; // process currently being allocated
  let stepCount = 0;

  const delay = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  function algorithmName() {
    return {
      first: "First-Fit",
      best: "Best-Fit",
      worst: "Worst-Fit"
    }[algorithm];
  }

  function makeEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function parseSizes(value) {
    if (!value.trim()) return null;

    const parts = value.trim().split(/[\s,]+/);

    const values = parts.map(Number);

    if (
      values.some(value =>
        !Number.isSafeInteger(value) || value <= 0
      )
    ) {
      return null;
    }

    return values;
  }

  function readInputs() {
    const memorySizes = parseSizes(memoryInput.value);
    const processSizes = parseSizes(processInput.value);

    if (!memorySizes || !processSizes) {
      alert(
        "Enter positive whole numbers for all memory blocks and processes."
      );
      return false;
    }

    if (memorySizes.length > 20 || processSizes.length > 30) {
      alert(
        "For a clear visualization, use at most 20 memory blocks and 30 processes."
      );
      return false;
    }

    blocks = memorySizes.map((size, index) => ({
      id: index + 1,
      size,
      process: null,
      processSize: 0
    }));

    processes = processSizes.map((size, index) => ({
      id: index + 1,
      size,
      result: "pending",
      blockId: null
    }));

    return true;
  }

  /* -------------------------------------------------------
     BLOCK HIGHLIGHT HELPERS
     ------------------------------------------------------- */

  function setHighlight(blockId, state, label) {
    currentBlockId = blockId;
    currentBlockState = state;
    currentBlockLabel = label;
  }

  function clearBlockHighlight() {
    currentBlockId = null;
    currentBlockState = "";
    currentBlockLabel = "";
  }

  /* -------------------------------------------------------
     MEMORY VISUALIZATION
     ------------------------------------------------------- */

  function renderMemory() {
    memoryContainer.innerHTML = "";

    blocks.forEach(block => {
      const element = document.createElement("div");

      element.className = "memory-block";
      element.dataset.blockId = block.id;
      element.title =
        `Block ${block.id}: initial partition size ${block.size} KB`;

      // Larger memory blocks appear wider.
      element.style.flexGrow = block.size;
      element.style.flexShrink = "1";
      element.style.flexBasis = "0";

      const isAllocated = block.process !== null;

      // Allocated to the process that is being handled right now?
      const isNew =
        isAllocated && block.process === `P${activeProcessId}`;

      element.classList.add(isAllocated ? "allocated" : "free");

      if (isNew) {
        element.classList.add("just-allocated");
      }

      const isCurrent = block.id === currentBlockId;

      if (isCurrent) {
        element.classList.add("checking");

        if (currentBlockState === "failed") {
          element.classList.add("failed");
        }

        if (currentBlockState === "success") {
          element.classList.add("success");
        }
      }

      /* ---- Header: block number + INITIAL size ---- */
      const header = makeEl("div", "memory-block-header");
      header.append(
        makeEl("div", "block-title", `Block ${block.id}`),
        makeEl("div", "block-size", `${block.size} KB`),
        makeEl("div", "block-caption", "initial size")
      );

      /* ---- Status tag ---- */
      const tag = makeEl(
        "div",
        "block-tag",
        isCurrent ? currentBlockLabel : ""
      );

      /* ---- Body ---- */
      const body = makeEl("div", "memory-block-body");

      if (isAllocated) {
        const fragment = block.size - block.processSize;

        const used = makeEl("div", "block-used");
        used.style.flexGrow = block.processSize;
        used.append(
          makeEl("strong", "", block.process),
          makeEl("span", "", `uses ${block.processSize} KB`)
        );

        const frag = makeEl(
          "div",
          fragment > 0 ? "block-frag" : "block-frag none"
        );
        frag.style.flexGrow = fragment;
        frag.append(
          makeEl("div", "block-frag-label", "Internal fragmentation"),
          makeEl("div", "block-frag-value", `${fragment} KB`)
        );

        body.append(used, frag);
      } else {
        const free = makeEl("div", "block-free");
        free.append(
          makeEl("strong", "", "FREE"),
          makeEl("span", "", `${block.size} KB available`)
        );

        const frag = makeEl("div", "block-frag none");
        frag.style.flexGrow = 0;
        frag.style.flexBasis = "auto";
        frag.style.minHeight = "44px";
        frag.append(
          makeEl("div", "block-frag-label", "Internal fragmentation"),
          makeEl("div", "block-frag-value", "0 KB")
        );

        body.append(free, frag);
      }

      element.append(header, tag, body);
      memoryContainer.appendChild(element);
    });
  }

  /* -------------------------------------------------------
     PROCESS QUEUE (waiting / current / done)
     ------------------------------------------------------- */

  function renderQueue() {
    queueEl.innerHTML = "";

    if (!processes.length) {
      queueEl.appendChild(
        makeEl(
          "span",
          "queue-empty",
          "Click Allocate to see the process queue."
        )
      );
      return;
    }

    processes.forEach(process => {
      let state;
      let status;

      if (process.result === "allocated") {
        state = "allocated";
        status = `✓ Block ${process.blockId}`;
      } else if (process.result === "failed") {
        state = "failed";
        status = "✗ Not allocated";
      } else if (process.id === activeProcessId) {
        state = "current";
        status = "▶ Allocating...";
      } else {
        state = "waiting";
        status = "⏳ Waiting";
      }

      const chip = makeEl("div", `queue-chip ${state}`);
      chip.append(
        makeEl("strong", "", `P${process.id}`),
        makeEl("span", "", `${process.size} KB`),
        makeEl("span", "", status)
      );

      queueEl.appendChild(chip);
    });
  }

  /* -------------------------------------------------------
     STATISTICS
     ------------------------------------------------------- */

  function updateStatistics() {
    const total = blocks.reduce(
      (sum, block) => sum + block.size, 0
    );

    let used = 0;
    let free = 0;
    let fragmentation = 0;

    blocks.forEach(block => {
      if (block.process !== null) {
        // The entire fixed partition is occupied.
        used += block.size;
        fragmentation += block.size - block.processSize;
      } else {
        free += block.size;
      }
    });

    totalMemoryEl.textContent = `${total} KB`;
    usedMemoryEl.textContent = `${used} KB`;
    freeMemoryEl.textContent = `${free} KB`;
    fragmentationEl.textContent = `${fragmentation} KB`;
  }

  /* -------------------------------------------------------
     PROCESS INFORMATION
     ------------------------------------------------------- */

  function updateProcess(process, message) {
    currentProcessEl.textContent = process
      ? `P${process.id} (${process.size} KB)`
      : "All processes checked";

    processStatusEl.textContent = message;
  }

  function updateStatus(message) {
    simulationStatusEl.textContent = message;
  }

  /* -------------------------------------------------------
     STEP TIMELINE (shows only the current process)
     ------------------------------------------------------- */

  function clearSteps() {
    stepsContainer.innerHTML = "";
    stepCount = 0;
  }

  function addStep(message, state = "normal") {
    const item = document.createElement("li");

    item.textContent = message;
    item.dataset.step = ++stepCount;

    if (state === "failed") {
      item.classList.add("step-failed");
    }

    stepsContainer
      .querySelectorAll(".step-current")
      .forEach(step => step.classList.remove("step-current"));

    stepsContainer.appendChild(item);
    item.classList.add("step-current");

    // Scroll only inside the steps box (does not move the page).
    stepsContainer.scrollTop = stepsContainer.scrollHeight;
  }

  function showFinalSummary() {
    clearSteps();
    stepsHeadingEl.textContent = "Final Summary";

    processes.forEach(process => {
      if (process.result === "allocated") {
        addStep(
          `P${process.id} (${process.size} KB) → Block ${process.blockId}`
        );
      } else {
        addStep(
          `P${process.id} (${process.size} KB) → not allocated`,
          "failed"
        );
      }
    });

    stepsContainer
      .querySelectorAll(".step-current")
      .forEach(step => step.classList.remove("step-current"));
  }

  /* -------------------------------------------------------
     CHECK A BLOCK
     ------------------------------------------------------- */

  async function checkBlock(block, process, token) {
    if (token !== runId) return false;

    setHighlight(block.id, "", "CHECKING...");

    renderMemory();

    updateStatus(
      `${algorithmName()} is checking Block ${block.id}...`
    );

    updateProcess(
      process,
      `Checking Block ${block.id}: ${block.size} KB available.`
    );

    addStep(
      `Checking Block ${block.id}: ${block.size} KB for P${process.id} (${process.size} KB).`
    );

    await delay(650);

    if (token !== runId) return false;

    if (block.size >= process.size) {
      setHighlight(block.id, "success", "FITS ✓");

      updateProcess(
        process,
        `Block ${block.id} can hold this process.`
      );

      updateStatus(`Block ${block.id} is suitable ✓`);

      addStep(`Block ${block.id}: ${block.size} KB is suitable.`);
    } else {
      setHighlight(block.id, "failed", "TOO SMALL ✗");

      updateProcess(
        process,
        `Block ${block.id} is too small. Try another block.`
      );

      updateStatus(
        `Block ${block.id} is too small for P${process.id}.`
      );

      addStep(
        `Block ${block.id}: too small (${block.size} KB).`,
        "failed"
      );
    }

    renderMemory();

    await delay(400);

    return token === runId;
  }

  /* -------------------------------------------------------
     ALLOCATION
     ------------------------------------------------------- */

  async function allocateProcess(process, block, token) {
    if (token !== runId) return false;

    if (!block) {
      process.result = "failed";

      clearBlockHighlight();
      renderMemory();
      renderQueue();
      updateStatistics();

      updateProcess(
        process,
        "No suitable free memory block was found."
      );

      updateStatus(`P${process.id} could not be allocated.`);

      addStep(
        `P${process.id} (${process.size} KB) could not be allocated.`,
        "failed"
      );

      await delay(750);

      return token === runId;
    }

    block.process = `P${process.id}`;
    block.processSize = process.size;

    process.result = "allocated";
    process.blockId = block.id;

    setHighlight(block.id, "success", "ALLOCATED ✓");

    renderMemory();
    renderQueue();
    updateStatistics();

    const fragment = block.size - process.size;

    updateProcess(
      process,
      `Successfully allocated to Block ${block.id}.`
    );

    updateStatus(
      `P${process.id} allocated to Block ${block.id} ✓`
    );

    addStep(
      `P${process.id} (${process.size} KB) allocated to Block ${block.id} (${block.size} KB). Internal fragmentation = ${block.size} − ${process.size} = ${fragment} KB.`
    );

    await delay(800);

    return token === runId;
  }

  /* -------------------------------------------------------
     First-Fit
     Select the first free block large enough.
     ------------------------------------------------------- */

  async function runFirstFit(process, token) {
    for (const block of blocks) {
      if (block.process !== null) continue;

      const completed = await checkBlock(block, process, token);

      if (!completed) return false;

      if (block.size >= process.size) {
        return allocateProcess(process, block, token);
      }
    }

    return allocateProcess(process, null, token);
  }

  /* -------------------------------------------------------
     Best-Fit
     Select the smallest suitable free block.
     ------------------------------------------------------- */

  async function runBestFit(process, token) {
    let bestBlock = null;

    for (const block of blocks) {
      if (block.process !== null) continue;

      const completed = await checkBlock(block, process, token);

      if (!completed) return false;

      if (
        block.size >= process.size &&
        (bestBlock === null || block.size < bestBlock.size)
      ) {
        bestBlock = block;
      }
    }

    if (bestBlock) {
      setHighlight(bestBlock.id, "success", "BEST FIT ✓");

      renderMemory();

      updateProcess(
        process,
        `Best-Fit selected the smallest suitable block: Block ${bestBlock.id}.`
      );

      updateStatus(`Best-Fit selected Block ${bestBlock.id}.`);

      addStep(
        `Best-Fit selects Block ${bestBlock.id} (${bestBlock.size} KB).`
      );

      await delay(500);

      if (token !== runId) return false;
    }

    return allocateProcess(process, bestBlock, token);
  }

  /* -------------------------------------------------------
     Worst-Fit
     Select the largest suitable free block.
     ------------------------------------------------------- */

  async function runWorstFit(process, token) {
    let worstBlock = null;

    for (const block of blocks) {
      if (block.process !== null) continue;

      const completed = await checkBlock(block, process, token);

      if (!completed) return false;

      if (
        block.size >= process.size &&
        (worstBlock === null || block.size > worstBlock.size)
      ) {
        worstBlock = block;
      }
    }

    if (worstBlock) {
      setHighlight(worstBlock.id, "success", "WORST FIT ✓");

      renderMemory();

      updateProcess(
        process,
        `Worst-Fit selected the largest suitable block: Block ${worstBlock.id}.`
      );

      updateStatus(`Worst-Fit selected Block ${worstBlock.id}.`);

      addStep(
        `Worst-Fit selects Block ${worstBlock.id} (${worstBlock.size} KB).`
      );

      await delay(500);

      if (token !== runId) return false;
    }

    return allocateProcess(process, worstBlock, token);
  }

  /* -------------------------------------------------------
     START SIMULATION
     ------------------------------------------------------- */

  async function startSimulation() {
    if (running) return;

    if (!readInputs()) return;

    const token = ++runId;

    running = true;

    allocateBtn.disabled = true;
    memoryInput.disabled = true;
    processInput.disabled = true;

    root.querySelectorAll(".algorithm-btn").forEach(button => {
      button.disabled = true;
    });

    clearSteps();
    clearBlockHighlight();
    activeProcessId = null;

    renderMemory();
    renderQueue();
    updateStatistics();

    updateProcess(null, "Starting allocation...");
    updateStatus(`Running ${algorithmName()}...`);

    try {
      for (const process of processes) {
        if (token !== runId) return;

        // New process: hide the earlier steps, show only this one.
        activeProcessId = process.id;
        clearBlockHighlight();
        clearSteps();

        stepsHeadingEl.textContent =
          `Steps for P${process.id} (${process.size} KB)`;

        renderMemory();
        renderQueue();

        updateProcess(
          process,
          `Searching for a suitable block using ${algorithmName()}...`
        );

        addStep(
          `${algorithmName()}: finding a block for P${process.id} (${process.size} KB).`
        );

        await delay(500);

        if (token !== runId) return;

        let completed;

        if (algorithm === "first") {
          completed = await runFirstFit(process, token);
        } else if (algorithm === "best") {
          completed = await runBestFit(process, token);
        } else {
          completed = await runWorstFit(process, token);
        }

        if (!completed || token !== runId) return;
      }

      clearBlockHighlight();
      activeProcessId = null;

      renderMemory();
      renderQueue();
      updateStatistics();

      const allocated = processes.filter(
        process => process.result === "allocated"
      ).length;

      const failed = processes.length - allocated;

      updateProcess(
        null,
        `${allocated} of ${processes.length} processes allocated.`
      );

      updateStatus(
        failed === 0
          ? `${algorithmName()} simulation complete! All processes allocated.`
          : `${algorithmName()} complete. ${failed} process(es) could not be allocated.`
      );

      showFinalSummary();
    } finally {
      if (token === runId) {
        running = false;

        allocateBtn.disabled = false;
        memoryInput.disabled = false;
        processInput.disabled = false;

        root.querySelectorAll(".algorithm-btn").forEach(button => {
          button.disabled = false;
        });
      }
    }
  }

  /* -------------------------------------------------------
     RESET
     ------------------------------------------------------- */

  function resetSimulation(restoreDefaults = true) {
    // Invalidates any animation currently in progress.
    runId++;
    running = false;

    if (restoreDefaults) {
      memoryInput.value = DEFAULT_MEMORY;
      processInput.value = DEFAULT_PROCESSES;
    }

    allocateBtn.disabled = false;
    memoryInput.disabled = false;
    processInput.disabled = false;

    root.querySelectorAll(".algorithm-btn").forEach(button => {
      button.disabled = false;
      button.classList.toggle(
        "active",
        button.dataset.algorithm === algorithm
      );
    });

    const memorySizes = parseSizes(memoryInput.value);

    blocks = (memorySizes || []).map((size, index) => ({
      id: index + 1,
      size,
      process: null,
      processSize: 0
    }));

    processes = [];
    activeProcessId = null;
    clearBlockHighlight();
    clearSteps();

    stepsHeadingEl.textContent = "Simulation Steps";

    const item = document.createElement("li");
    item.className = "empty-step";
    item.textContent = "Click Allocate to begin the simulation.";
    stepsContainer.appendChild(item);

    renderMemory();
    renderQueue();
    updateStatistics();

    currentProcessEl.textContent = "Ready to start";
    processStatusEl.textContent = "Waiting for simulation";
    updateStatus("Ready to simulate");
  }

  /* -------------------------------------------------------
     EVENT LISTENERS
     ------------------------------------------------------- */

  root.querySelectorAll(".algorithm-btn").forEach(button => {
    button.addEventListener("click", () => {
      if (running) return;

      algorithm = button.dataset.algorithm;
      resetSimulation(false);
    });
  });

  allocateBtn.addEventListener("click", startSimulation);

  resetBtn.addEventListener("click", () => {
    resetSimulation(true);
  });

  // Initial display
  resetSimulation(false);
})();