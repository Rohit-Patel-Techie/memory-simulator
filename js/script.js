document.addEventListener("DOMContentLoaded", function () {
  const header = document.querySelector(".header");

  // This event listener checks if the user has scrolled more than 10px
  // If yes, it adds the 'scrolled' class to the header (for styling changes like shrinking)
  // If not, it removes the 'scrolled' class
  window.addEventListener("scroll", function () {
    if (window.scrollY > 10) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  // sticky nav 
  const navWrapper = document.getElementById("navWrapper");
  const trigger = document.querySelector(".sticky-trigger");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          navWrapper.classList.add("sticky-nav-wrapper");
        } else {
          navWrapper.classList.remove("sticky-nav-wrapper");
        }
      });
    },
    {
      rootMargin: "-60px 0px 0px 0px", // triggers earlier, avoids flicker
      threshold: 0
    }
  );

  observer.observe(trigger);

  // back to top logic
  const backToTopBtn = document.getElementById("backToTop");

  window.onscroll = function () {
    if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
      backToTopBtn.style.display = "block";
    } else {
      backToTopBtn.style.display = "none";
    }
  };

  backToTopBtn.onclick = function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  document.getElementById("start-quiz-btn").addEventListener("click", () => {
    document.getElementById("quiz-instructions").style.display = "none";
    document.getElementById("quiz-content").style.display = "block";
  });
});

// Object to store references to different topic sections by their IDs
let topicElements = {
  aim: document.getElementById("aim"),
  theory: document.getElementById("theory"),
  procedure: document.getElementById("procedure"),
  practice: document.getElementById("practice"),
  code: document.getElementById("code"),
  result: document.getElementById("result"),
  quiz: document.getElementById("quiz"),
  references: document.getElementById("references"),
  tnt: document.getElementById("tnt"),
};

let currentTopic = "aim"; // Track the currently displayed topic
function switchContent(topic) {
  if (topic === currentTopic) {
    return; // Prevent unnecessary updates if the same topic is clicked again
  }

  topicElements[currentTopic].style.display = 'none'; // Hide the previous topic
  topicElements[topic].style.display = 'block'; // Show the selected topic
  currentTopic = topic; // Update the current topic
}

// Generalized function to toggle language-based code blocks
function toggleCode(language) {
  const allCodeBlocks = document.querySelectorAll(".code-block");
  allCodeBlocks.forEach((block) => block.classList.remove("active"));

  const selectedCodeBlock = document.getElementById(language + "Code");
  selectedCodeBlock.classList.add("active");
}

// Clipboard copy function
function copyCode(elementId) {
  const codeBlock = document.getElementById(elementId);
  const code = codeBlock.querySelector("code").innerText;

  // Copy the selected code text to clipboard
  navigator.clipboard
    .writeText(code)
    .then(() => {
      const copyButton = codeBlock.querySelector(".copy-button");
      copyButton.textContent = "Copied!"; // Temporarily change button text
      setTimeout(() => {
        copyButton.textContent = "Copy"; // Reset text after 2 seconds
      }, 2000);
    })
    .catch((err) => {
      console.error("Could not copy text: ", err);
    });
}

// Event listeners for radio buttons
document
  .getElementById("cppRadio")
  .addEventListener("change", () => toggleCode("cpp"));
document
  .getElementById("pythonRadio")
  .addEventListener("change", () => toggleCode("python"));

// Event listener for copy buttons
document.querySelectorAll(".copy-button").forEach((button) => {
  button.addEventListener("click", function () {
    const language = button.closest(".code-block").id.replace("Code", "");
    copyCode(language + "Code");
  });
});

// Quiz Logic

const questions = [
  {
    question: "Q1) Which strategy allocates the smallest sufficient block to a process?",
    choices: ["First-Fit", "Best-Fit", "Worst-Fit", "None"],
    correctAnswers: [1]
  },
  {
    question: "Q2) What is external fragmentation?",
    choices: [
      "Wasted space within an allocated block",
      "Free memory divided into small non-contiguous holes",
      "A CPU scheduling issue",
      "A page replacement issue"
    ],
    correctAnswers: [1]
  },
  {
    question: "Q3) Which allocation strategy generally searches from the beginning and selects the first suitable block?",
    choices: ["Best-Fit", "Worst-Fit", "First-Fit", "None"],
    correctAnswers: [2]
  },
  {
    question: "Q4) What technique combines scattered free memory holes into one large block?",
    choices: ["Paging", "Compaction", "Swapping", "Segmentation"],
    correctAnswers: [1]
  },
  {
    question: "Q5) Which strategy selects the largest available block that can accommodate a process?",
    choices: ["First-Fit", "Best-Fit", "Worst-Fit", "Round Robin"],
    correctAnswers: [2]
  },
  {
    question: "Q6) What is internal fragmentation?",
    choices: [
      "Free memory between allocated blocks",
      "Unused space inside an allocated memory partition",
      "Memory used by the operating system",
      "A process waiting for the CPU"
    ],
    correctAnswers: [1]
  },
  {
    question: "Q7) In fixed partitioning, how many processes can occupy one partition at a time?",
    choices: ["One process", "Two processes", "Any number of processes", "No process"],
    correctAnswers: [0]
  },
  {
    question: "Q8) A process requires 180 KB. Which partition is the smallest suitable choice for Best-Fit?",
    choices: ["150 KB", "200 KB", "300 KB", "100 KB"],
    correctAnswers: [1]
  },
  {
    question: "Q9) A 250 KB process is allocated to a 400 KB partition. What is the internal fragmentation?",
    choices: ["250 KB", "400 KB", "150 KB", "650 KB"],
    correctAnswers: [2]
  },
  {
    question: "Q10) Which statement about First-Fit is correct?",
    choices: [
      "It always selects the largest block",
      "It selects the smallest suitable block",
      "It selects the first free block large enough for the process",
      "It never causes internal fragmentation"
    ],
    correctAnswers: [2]
  }
];

let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
const questionElement = document.getElementById("question");
const choicesContainer = document.getElementById("choices");
const nextButton = document.getElementById("next-btn");
const retakeButton = document.getElementById("retake-btn");
const seeAnswersButton = document.getElementById("see-answers-btn");
const quizReport = document.getElementById("quiz-report");

seeAnswersButton.addEventListener("click", displayCorrectAnswers);

function showQuestion() {
  let currentQuestion = questions[currentQuestionIndex];
  questionElement.textContent = currentQuestion.question;
  choicesContainer.innerHTML = "";
  userAnswers[currentQuestionIndex] = [];

 const shuffledChoices = [...currentQuestion.choices]
  .sort(() => Math.random() - 0.5);

shuffledChoices.forEach((choice, index) => {
  const button = document.createElement("button");
  button.textContent = choice;
  button.classList.add("choice");
  button.addEventListener("click", () => toggleSelection(index));
  choicesContainer.appendChild(button);
});

  nextButton.disabled = true; // Disable Next until an answer is selected
  nextButton.style.display = "block";
  retakeButton.style.display = "none";
  seeAnswersButton.style.display = "none";
}

function toggleSelection(selectedIndex) {
  userAnswers[currentQuestionIndex] = [
    questions[currentQuestionIndex].choices.indexOf(
      document.querySelectorAll("#choices .choice")[selectedIndex].textContent
    )
  ];

  document.querySelectorAll("#choices .choice").forEach((btn, index) => {
    const selected = index === selectedIndex;

    btn.style.backgroundColor = selected ? "#4285F4" : "#f1f1f1";
    btn.style.color = selected ? "white" : "black";
    btn.setAttribute("aria-pressed", String(selected));
  });

  nextButton.disabled = false;
}

function checkAnswer() {
  const correctAnswers = questions[currentQuestionIndex].correctAnswers;
  const userAnswer = userAnswers[currentQuestionIndex];

  if (arraysEqual(correctAnswers, userAnswer)) {
    score++;
  }

  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  } else {
    showResults();
  }
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((val) => b.includes(val));
}

function showResults() {
  questionElement.textContent = `Quiz Completed! \r\n Your Score: ${score} / ${questions.length}`;
  choicesContainer.innerHTML = "";
  nextButton.style.display = "none";
  retakeButton.style.display = "block";
  seeAnswersButton.style.display = "block";
  displayQuizReport();
}

function displayQuizReport() {
  quizReport.style.display = "block";
  quizReport.innerHTML = "<h3>Quiz Report</h3>";

  questions.forEach((q, index) => {
    const userAnswer = userAnswers[index] || [];
    const questionDiv = document.createElement("div");
    questionDiv.classList.add("quiz-report-question");

    const questionText = document.createElement("p");
    questionText.textContent = q.question;
    questionDiv.appendChild(questionText);

    const choicesList = document.createElement("ul");
    q.choices.forEach((choice, i) => {
      const choiceItem = document.createElement("li");
      const isSelected = userAnswer.includes(i);
      const isCorrect = q.correctAnswers.includes(i);

      if (isSelected) {
        choiceItem.style.backgroundColor = isCorrect ? "green" : "red";
        choiceItem.style.color = "white";
      }
      choiceItem.textContent = choice;
      choicesList.appendChild(choiceItem);
    });

    questionDiv.appendChild(choicesList);
    quizReport.appendChild(questionDiv);
  });
}

function displayCorrectAnswers() {
  quizReport.innerHTML = "<h3>Correct Answers</h3>";

  questions.forEach((q) => {
    const questionDiv = document.createElement("div");
    questionDiv.classList.add("quiz-correct-answers");

    const questionText = document.createElement("p");
    questionText.textContent = q.question;
    questionDiv.appendChild(questionText);

    const correctList = document.createElement("ul");
    q.correctAnswers.forEach((i) => {
      const li = document.createElement("li");
      li.textContent = q.choices[i];
      li.style.color = "green";
      correctList.appendChild(li);
    });

    questionDiv.appendChild(correctList);
    quizReport.appendChild(questionDiv);
  });

  seeAnswersButton.style.display = "none";
}

retakeButton.addEventListener("click", () => {
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];
  quizReport.style.display = "none";
  showQuestion();
});

nextButton.addEventListener("click", checkAnswer);

showQuestion();