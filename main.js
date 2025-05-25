"use strict";

document.addEventListener("DOMContentLoaded", function() {
  /* -- VARIABILI GLOBALI -- */
  let quizData = [];
  let currentQuestionIndex = 0;
  const officialCourses = ["Primo", "Secondo", "Formaggio", "Dolce", "Frutta"];
  let collectedCourses = [];
  
  // Definizione dei 12 settori della ruota (la disposizione è fissa):
  // Disposizione: Primo, Secondo, Formaggio, Frutta, Dolce, Jolly, Primo, Secondo, Formaggio, Frutta, Dolce, Dieta
  const wheelSectors = [
    { course: "Primo", emoji: "🍝" },
    { course: "Secondo", emoji: "🍖" },
    { course: "Formaggio", emoji: "🧀" },
    { course: "Frutta", emoji: "🍎" },
    { course: "Dolce", emoji: "🍰" },
    { course: "Jolly", emoji: "⭐" },
    { course: "Primo", emoji: "🍝" },
    { course: "Secondo", emoji: "🍖" },
    { course: "Formaggio", emoji: "🧀" },
    { course: "Frutta", emoji: "🍎" },
    { course: "Dolce", emoji: "🍰" },
    { course: "Dieta", emoji: "🚫" }
  ];
  
  let timerInterval;
  const questionTime = 30; // 30 secondi per ogni domanda

  /* -- ELEMENTI DOM -- */
  const welcomeScreen    = document.getElementById("welcomeScreen");
  const quizScreen       = document.getElementById("quizScreen");
  const resultScreen     = document.getElementById("resultScreen");
  const startButton      = document.getElementById("startButton");
  const restartButton    = document.getElementById("restartButton");
  const questionText     = document.getElementById("questionText");
  const optionsContainer = document.getElementById("optionsContainer");
  const timerDiv         = document.getElementById("timer");
  const btnAudience      = document.getElementById("btnAudience");
  const btnFifty         = document.getElementById("btnFifty");
  const instructionsModal = document.getElementById("instructionsModal");
  const instructionsButton = document.getElementById("instructionsButton");
  const closeInstructions  = document.getElementById("closeInstructions");
  const toggleThemeButton  = document.getElementById("toggleTheme");
  const scoreBoard         = document.getElementById("highScore");
  const wheelBack          = document.getElementById("wheel-back");

  /* -- ELEMENTI AUDIO -- */
  const audioCorrect = document.getElementById("audioCorrect");
  const audioWrong   = document.getElementById("audioWrong");
  const audioWheel   = document.getElementById("audioWheel");

  /* -- FUNZIONE PER RANDOMIZZARE (Fisher–Yates) -- */
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /* -- CARICA LE DOMANDE DAL FILE quiz.json -- */
  function loadQuiz() {
    fetch("quiz.json")
      .then(response => response.json())
      .then(data => {
        quizData = shuffleArray(data.questions);
        console.log("Quiz caricato e randomizzato:", quizData);
        // Abilita il bottone di start una volta caricate le domande.
        startButton.disabled = false;
      })
      .catch(error => {
        console.error("Errore nel caricamento del quiz:", error);
        alert("Errore nel caricamento delle domande!");
      });
  }

  /* -- CREA I SETTORI DELLA RUOTA (ruota posteriore) -- */
  function createWheelSectors() {
    wheelBack.innerHTML = "";
    const wheelRadius = 125;               // Raggio del contenitore (250/2)
    const sectorDiameter = 60;             // Dimensione fissa dei settori (uguale al foro)
    const sectorRadius = sectorDiameter / 2; // 30px
    const offset = wheelRadius - sectorRadius; // 125 - 30 = 95px
    const sectorAngle = 360 / wheelSectors.length; // 360/12 = 30°
    
    for (let i = 0; i < wheelSectors.length; i++) {
      let sector = document.createElement("div");
      sector.classList.add("sector");
      sector.style.width = sectorDiameter + "px";
      sector.style.height = sectorDiameter + "px";
      
      let angle = i * sectorAngle;
      // Applica la formula per posizionare correttamente ogni settore:
      // 1. Centro: translate(-50%, -50%)
      // 2. Ruota di 'angle' gradi
      // 3. Trasla verticalmente di 'offset' pixel (verso l'esterno del centro)
      // 4. Ruota indietro di 'angle' gradi per ripristinare l’orientamento, eventualmente con una correzione
      let currentRotation = angle % 360;
      let correction = (currentRotation > 90 && currentRotation < 270) ? 180 : 0;
      sector.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translate(0, -${offset}px) rotate(${-angle + correction}deg)`;
      sector.innerText = wheelSectors[i].emoji;
      wheelBack.appendChild(sector);
    }
    // Imposta l'offset iniziale della ruota per far partire il gioco con il Jolly (all'indice 5) visibile nel foro:
    // Jolly all'indice 5: 5 * 30 = 150° → per centrare al "0° visivo" è necessario: 360 – 150 = 210°
    wheelBack.style.transform = "rotate(210deg)";
  }

  /* -- AGGIORNA L'INTERFACCIA DELLE PORTATE RACCOLTE -- */
  function updateCollectedCoursesUI() {
    const courseDiv = document.getElementById("courseProgress");
    if (collectedCourses.length === 0) {
      courseDiv.innerHTML = "Portate: Nessuna";
    } else {
      const uniqueCourses = [...new Set(collectedCourses.map(c => c.course))];
      courseDiv.innerHTML = "Portate: " + collectedCourses
        .map(c => `${c.emoji} ${c.course}`)
        .filter((val, index, self) => self.indexOf(val) === index)
        .join(" | ");
    }
  }

  /* -- TIMER PER LA DOMANDA (30 secondi) -- */
  function startTimer(seconds) {
    let timeLeft = seconds;
    timerDiv.innerText = `Tempo rimasto: ${timeLeft}s`;
    timerInterval = setInterval(() => {
      timeLeft--;
      timerDiv.innerText = `Tempo rimasto: ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleTimeOut();
      }
    }, 1000);
  }

  /* -- GESTIONE DEL TIMEOUT -- */
  function handleTimeOut() {
    lockOptions();
    markAllOptions(false);
    playAudio(audioWrong);
    alert("Tempo scaduto!");
    spinWheel(false);
  }

  /* -- VISUALIZZA DOMANDA -- */
  function displayQuestion() {
    if (currentQuestionIndex >= quizData.length) {
      endGame();
      return;
    }
    const currentQuestion = quizData[currentQuestionIndex];
    questionText.innerText = currentQuestion.question;
    optionsContainer.innerHTML = "";
    currentQuestion.options.forEach(option => {
      const div = document.createElement("div");
      div.classList.add("option");
      div.innerText = option;
      div.setAttribute("role", "button");
      div.setAttribute("tabindex", "0");
      div.addEventListener("click", () => checkAnswer(option, div));
      optionsContainer.appendChild(div);
    });
    clearInterval(timerInterval);
    startTimer(questionTime);
  }

  /* -- BLOCCA LE OPZIONI -- */
  function lockOptions() {
    document.querySelectorAll(".option").forEach(option => {
      option.style.pointerEvents = "none";
    });
  }

  /* -- EVIDENZIA LE OPZIONI -- */
  function markAllOptions(isCorrect) {
    document.querySelectorAll(".option").forEach(opt => {
      if (isCorrect && opt.innerText === quizData[currentQuestionIndex].answer) {
        opt.classList.add("correct");
      } else if (!isCorrect) {
        if (opt.innerText === quizData[currentQuestionIndex].answer) {
          opt.classList.add("correct");
        } else {
          opt.classList.add("wrong");
        }
      }
    });
  }

  /* -- VERIFICA RISPOSTA -- */
  function checkAnswer(selectedOption, element) {
    clearInterval(timerInterval);
    lockOptions();
    const currentQuestion = quizData[currentQuestionIndex];
    let isCorrect = false;
    if (selectedOption === currentQuestion.answer) {
      element.classList.add("correct");
      playAudio(audioCorrect);
      isCorrect = true;
      alert("Risposta corretta!");
    } else {
      element.classList.add("wrong");
      playAudio(audioWrong);
      alert("Risposta errata!");
    }
    spinWheel(isCorrect);
  }

  /* -- GESTIONE DEL GIRO DELLA RUOTA -- */
  function spinWheel(isCorrect) {
    playAudio(audioWheel);
    const minSpins = 5;
    const randomAngle = Math.floor(Math.random() * 360);
    const finalAngle = (minSpins * 360) + randomAngle;
    // L'offset iniziale 210° per far partire il disco con il Jolly nel foro
    let totalRotation = finalAngle + 210;
    wheelBack.style.transform = `rotate(${totalRotation}deg)`;
    
    setTimeout(() => {
      // Calcola l'angolo effettivo dopo la rotazione
      let effectiveAngle = totalRotation % 360;
      const sectorSize = 360 / wheelSectors.length; // ad esempio: 30°
      // Abbiamo aggiunto un epsilon per evitare ambiguità ai bordi
      const epsilon = 0.5;
      let angleFromTop = (360 - effectiveAngle + epsilon) % 360;
      let sectorIndex = Math.round(angleFromTop / sectorSize) % wheelSectors.length;
      let outcome = wheelSectors[sectorIndex];
      
      if (!isCorrect) {
        alert("Risposta errata, nessuna portata vinta.");
      } else {
        if (outcome.course === "Jolly") {
          const missing = officialCourses.filter(course =>
            !collectedCourses.some(c => c.course === course)
          );
          if (missing.length === 0) {
            alert("Menu già completato, nessuna scelta disponibile!");
          } else {
            let scelta = prompt(`Hai ottenuto il Jolly! Scegli una portata tra: ${missing.join(", ")}`);
            if (scelta) {
              let sceltaNormalized = scelta.trim().toLowerCase();
              let validChoice = missing.find(course => course.toLowerCase() === sceltaNormalized);
              if (validChoice) {
                collectedCourses.push({ course: validChoice, emoji: outcome.emoji });
                alert("Hai scelto: " + outcome.emoji + " " + validChoice);
              } else {
                alert("Scelta non valida, nessuna portata assegnata.");
              }
            }
          }
        } else if (outcome.course === "Dieta") {
          if (collectedCourses.length > 0) {
            let index = Math.floor(Math.random() * collectedCourses.length);
            let removed = collectedCourses.splice(index, 1)[0];
            alert("Portata rimossa per effetto Dieta: " + removed.emoji + " " + removed.course);
          } else {
            alert("Effetto Dieta attivato, ma non hai portate da perdere.");
          }
        } else {
          if (!collectedCourses.some(c => c.course === outcome.course)) {
            collectedCourses.push(outcome);
            alert("Hai guadagnato: " + outcome.emoji + " " + outcome.course);
          } else {
            alert("Portata già raccolta: " + outcome.emoji + " " + outcome.course);
          }
        }
      }
      
      updateCollectedCoursesUI();
      
      const uniqueCount = new Set(collectedCourses.map(c => c.course)).size;
      if (uniqueCount >= officialCourses.length) {
        alert("Complimenti! Hai completato il menu!");
        endGame();
      } else {
        // Passa automaticamente alla prossima domanda dopo 2 secondi
        setTimeout(nextQuestion, 2000);
      }
    }, 3200); // Durata dell'animazione della ruota in millisecondi
  }

  /* -- PROSSIMA DOMANDA -- */
  function nextQuestion() {
    currentQuestionIndex++;
    displayQuestion();
  }

  /* -- AGGIORNA E MEMORIZZA IL MIGLIOR PUNTEGGIO -- */
  function updateHighScore() {
    let storedScore = localStorage.getItem("highScore") || 0;
    const uniqueCount = new Set(collectedCourses.map(c => c.course)).size;
    if (uniqueCount > storedScore) {
      localStorage.setItem("highScore", uniqueCount);
      scoreBoard.innerText = uniqueCount;
    }
  }

  /* -- TERMINA IL GIOCO -- */
  function endGame() {
    clearInterval(timerInterval);
    quizScreen.classList.remove("visible");
    resultScreen.style.display = "block";
    updateHighScore();
    const uniqueCount = new Set(collectedCourses.map(c => c.course)).size;
    if (uniqueCount >= officialCourses.length) {
      document.getElementById("finalMessage").innerHTML = "Complimenti! Hai completato il menu e vinto il gioco! 🍽️🎉";
    } else {
      document.getElementById("finalMessage").innerHTML = `Hai raccolto ${uniqueCount} su ${officialCourses.length} portate.`;
    }
  }

  /* -- RIPRODUCE AUDIO -- */
  function playAudio(audioElement) {
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play().catch(e => console.log("Audio non disponibile:", e));
    }
  }

  /* -- TOGGLE TEMA SCURO/CHIARO -- */
  function toggleTheme() {
    document.body.classList.toggle("dark-mode");
  }

  /* -- EVENT LISTENERS -- */
  startButton.addEventListener("click", () => {
    if (quizData.length === 0) {
      alert("Attendere il caricamento delle domande.");
      return;
    }
    collectedCourses = [];
    currentQuestionIndex = 0;
    displayQuestion();
    quizScreen.classList.add("visible");
    welcomeScreen.classList.remove("visible");
  });

  restartButton.addEventListener("click", () => {
    collectedCourses = [];
    currentQuestionIndex = 0;
    displayQuestion();
    resultScreen.style.display = "none";
    quizScreen.classList.add("visible");
  });

  btnAudience.addEventListener("click", () => {
    const currentQuestion = quizData[currentQuestionIndex];
    alert("Il pubblico suggerisce: " + currentQuestion.answer);
    btnAudience.disabled = true;
  });

  btnFifty.addEventListener("click", () => {
    const currentQuestion = quizData[currentQuestionIndex];
    let eliminated = 0;
    document.querySelectorAll(".option").forEach(opt => {
      if (opt.innerText !== currentQuestion.answer && eliminated < 2) {
        opt.style.display = "none";
        eliminated++;
      }
    });
    btnFifty.disabled = true;
  });

  instructionsButton.addEventListener("click", () => {
    instructionsModal.style.display = "flex";
  });

  closeInstructions.addEventListener("click", () => {
    instructionsModal.style.display = "none";
  });

  toggleThemeButton.addEventListener("click", toggleTheme);

  /* -- INIZIALIZZAZIONE -- */
  createWheelSectors();
  loadQuiz();
});
