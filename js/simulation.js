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
     MEMORY VISUALIZATION
     ------------------------------------------------------- */

  function renderMemory() {
    memoryContainer.innerHTML = "";

    blocks.forEach(block => {
      const element = document.createElement("div");

      element.className = "memory-block";
      element.dataset.blockId = block.id;

      // Larger memory blocks appear wider.
      element.style.flexGrow = block.size;
      element.style.flexShrink = "1";
      element.style.flexBasis = "0";

      if (block.process !== null) {
        element.classList.add("allocated");
      } else {
        element.classList.add("free");
      }

      if (block.id === currentBlockId) {
        element.classList.add("checking");

        if (currentBlockState === "failed") {
          element.classList.add("failed");
        }

        if (currentBlockState === "success") {
          element.classList.add("success");
        }
      }

      const header = document.createElement("div");
      header.className = "memory-block-header";
      header.textContent = `Block ${block.id}`;

      const content = document.createElement("div");
      content.className = "memory-block-content";

      const mainText = document.createElement("strong");
      const sizeText = document.createElement("span");

      if (block.process !== null) {
        mainText.textContent = block.process;
        sizeText.textContent = `${block.processSize} KB`;

        const fragment = block.size - block.processSize;
        const fragmentText = document.createElement("span");

        fragmentText.className = "fragmentation-label";

        if (fragment > 0) {
          fragmentText.textContent =
            `${fragment} KB internal fragmentation`;
        } else {
          fragmentText.textContent = "Fully used";
        }

        content.append(mainText, sizeText, fragmentText);
      } else {
        mainText.textContent = "FREE";
        sizeText.textContent = `${block.size} KB`;

        content.append(mainText, sizeText);
      }

      element.append(header, content);
      memoryContainer.appendChild(element);
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
     STEP TIMELINE
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

    if (state === "current") {
      item.classList.add("step-current");
    }

    stepsContainer
      .querySelectorAll(".step-current")
      .forEach(step => step.classList.remove("step-current"));

    stepsContainer.appendChild(item);
    item.classList.add("step-current");

    // Keep the newest explanation visible.
    item.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }

  function clearBlockHighlight() {
    currentBlockId = null;
    currentBlockState = "";
  }

  /* -------------------------------------------------------
     CHECK A BLOCK
     ------------------------------------------------------- */

  async function checkBlock(block, process, token) {
    if (token !== runId) return false;

    currentBlockId = block.id;
    currentBlockState = "";

    renderMemory();

    updateStatus(
      `${algorithmName()} is checking Block ${block.id}...`
    );

    updateProcess(
      process,
      `Checking Block ${block.id}: ${block.size} KB available.`
    );

    addStep(
      `Checking Block ${block.id}: ${block.size} KB for P${process.id} (${process.size} KB).`,
      "current"
    );

    await delay(650);

    if (token !== runId) return false;

    if (block.size >= process.size) {
      currentBlockState = "success";

      updateProcess(
        process,
        `Block ${block.id} can hold this process.`
      );

      updateStatus(`Block ${block.id} is suitable ✓`);

      addStep(
        `Block ${block.id}: ${block.size} KB is suitable.`,
        "current"
      );
    } else {
      currentBlockState = "failed";

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

    currentBlockId = block.id;
    currentBlockState = "success";

    renderMemory();
    updateStatistics();

    updateProcess(
      process,
      `Successfully allocated to Block ${block.id}.`
    );

    updateStatus(
      `P${process.id} allocated to Block ${block.id} ✓`
    );

    addStep(
      `P${process.id} (${process.size} KB) allocated to Block ${block.id}.`,
      "current"
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
      currentBlockId = bestBlock.id;
      currentBlockState = "success";

      renderMemory();

      updateProcess(
        process,
        `Best-Fit selected the smallest suitable block: Block ${bestBlock.id}.`
      );

      updateStatus(`Best-Fit selected Block ${bestBlock.id}.`);

      addStep(
        `Best-Fit selects Block ${bestBlock.id} (${bestBlock.size} KB).`,
        "current"
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
      currentBlockId = worstBlock.id;
      currentBlockState = "success";

      renderMemory();

      updateProcess(
        process,
        `Worst-Fit selected the largest suitable block: Block ${worstBlock.id}.`
      );

      updateStatus(`Worst-Fit selected Block ${worstBlock.id}.`);

      addStep(
        `Worst-Fit selects Block ${worstBlock.id} (${worstBlock.size} KB).`,
        "current"
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

    renderMemory();
    updateStatistics();

    updateProcess(null, "Starting allocation...");
    updateStatus(`Running ${algorithmName()}...`);

    addStep(`${algorithmName()} simulation started.`);

    try {
      for (const process of processes) {
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
      renderMemory();
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

      addStep(
        `Simulation complete: ${allocated} allocated, ${failed} not allocated.`,
        failed ? "failed" : "normal"
      );
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
    clearBlockHighlight();
    clearSteps();

    stepsContainer.innerHTML = "";

    const item = document.createElement("li");
    item.className = "empty-step";
    item.textContent = "Click Allocate to begin the simulation.";
    stepsContainer.appendChild(item);

    renderMemory();
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