

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// DOM Elements
const textDisplay = document.getElementById("textDisplay");
const userInput = document.getElementById("userInput");
const startBtn = document.getElementById("startBtn");
const languageSelect = document.getElementById("languageSelect");
const timeDisplay = document.getElementById("time");
const wpmDisplay = document.getElementById("wpm");
const accuracyDisplay = document.getElementById("accuracy");
const result = document.getElementById("result");
const leaderboard = document.getElementById("leaderboard");
const usernameInput = document.getElementById("usernameInput");
const ctx = document.getElementById("performanceChart").getContext("2d");

// Game Variables
let timer;
let time = 0;
let text = "";
let playerName = "player#" + Math.floor(Math.random() * 10000);
let chart = null;
let leaderboardInterval;
let playerScores = [];

// Initialize Chart
function initChart() {
    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Your WPM History',
                data: [],
                borderColor: 'rgb(100, 255, 218)',
                backgroundColor: 'rgba(100, 255, 218, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Words Per Minute'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Attempts'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `WPM: ${context.parsed.y}`;
                        }
                    }
                }
            }
        }
    });
}

// Update Chart with new WPM score
function updateChart(wpm) {
    const label = `Test ${chart.data.labels.length + 1}`;

    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(wpm);

    // Limit to 10 most recent attempts
    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }

    chart.update();
}

// Load words for selected language
async function loadWords(language) {
    try {
        const response = await fetch(`./data/${language}_words.txt`);
        const data = await response.text();
        const words = data.split(/\s+/).filter(word => word.length > 0);
        const shuffled = words.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 25).join(" ");
    } catch (error) {
        console.error("Error loading words:", error);
        return "The quick brown fox jumps over the lazy dog"; // Fallback text
    }
}

// Start the typing test
async function startGame() {
    playerName = usernameInput.value.trim() || playerName;

    try {
        text = await loadWords(languageSelect.value);
        renderText();

        // Reset game state
        userInput.value = "";
        userInput.disabled = false;
        time = 0;
        timeDisplay.textContent = time;
        result.style.display = "none";

        // Clear any existing timer
        clearInterval(timer);

        // Start new timer
        timer = setInterval(() => {
            time++;
            timeDisplay.textContent = time;
        }, 1000);

        // Focus input after a small delay
        setTimeout(() => {
            userInput.focus();
        }, 100);

    } catch (error) {
        console.error("Error starting game:", error);
        alert("Failed to start game. Please try again.");
    }
}

// Render the text to be typed
function renderText() {
    textDisplay.innerHTML = text.split("").map((c, i) =>
        `<span id="char-${i}">${c}</span>`
    ).join("");
}

// Handle user input
userInput.addEventListener("input", (e) => {
    const val = userInput.value;
    let correctChars = 0;

    // Update character highlighting
    for (let i = 0; i < text.length; i++) {
        const span = document.getElementById(`char-${i}`);
        if (!span) continue;

        span.classList.remove("correct", "incorrect", "current");

        if (i < val.length) {
            if (val[i] === text[i]) {
                span.classList.add("correct");
                correctChars++;
            } else {
                span.classList.add("incorrect");
            }
        }

        if (i === val.length) {
            span.classList.add("current");
        }
    }

    // Check if text is completed
    if (val === text) {
        finishGame(correctChars, text.length);
    }
});

// Finish the game and show results
// ... (keep all your existing Firebase and variable declarations)

// Modified finishGame function with proper accuracy calculation
function finishGame(correctChars, totalChars) {
    clearInterval(timer);
    userInput.disabled = true;

    // Calculate WPM and accuracy
    const wordCount = text.split(" ").length;
    const minutes = time / 60;
    const wpm = Math.round((wordCount / minutes) * 100) / 100; // Keep 2 decimal places
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 0;

    // Update displays
    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = accuracy;
    result.textContent = `Finished! WPM: ${wpm}, Accuracy: ${accuracy}%`;
    result.style.display = "block";

    // Save score with proper accuracy
    const entry = {
        name: playerName,
        wpm,
        accuracy,  // Now using the properly calculated value
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    };

    // Update chart and leaderboard
    updateChart(wpm);
    db.ref("scores").push(entry);
    updateLeaderboard();
}


userInput.addEventListener("input", (e) => {
    const val = userInput.value;
    let correctChars = 0;
    let totalTypedChars = val.length;

    for (let i = 0; i < text.length; i++) {
        const span = document.getElementById(`char-${i}`);
        if (!span) continue;

        span.classList.remove("correct", "incorrect", "current");

        if (i < val.length) {
            if (val[i] === text[i]) {
                span.classList.add("correct");
                correctChars++;
            } else {
                span.classList.add("incorrect");
            }
        }

        if (i === val.length) {
            span.classList.add("current");
        }
    }

   
    const currentAccuracy = totalTypedChars > 0
        ? Math.round((correctChars / totalTypedChars) * 100)
        : 0;
    accuracyDisplay.textContent = currentAccuracy;

 
    if (val === text) {
        finishGame(correctChars, text.length);
    }
});


function calculateWPM() {
    const wordCount = text.split(" ").length;
    const minutes = time / 60;
    return Math.round(wordCount / minutes);
}


function saveScore(wpm, accuracy) {
    // Add client-side validation
    if (typeof wpm !== 'number' || wpm > 300 || wpm < 0) return;
    if (typeof accuracy !== 'number' || accuracy > 100 || accuracy < 0) return;

    const entry = {
        name: playerName.substring(0, 20), 
        wpm: Math.round(wpm),
        accuracy: Math.round(accuracy),
        timestamp: Date.now(),
        date: new Date().toLocaleString(),
        verified: false 
    };

    db.ref("scores").push(entry)
        .catch(error => console.error("Save failed:", error));
}

    
    playerScores.push({
        wpm,
        date: new Date().toLocaleTimeString()
    });

  
    db.ref("scores").push(entry);
}


function updateLeaderboard() {
    db.ref("scores")
        .orderByChild("wpm")
        .limitToLast(10)
        .once("value", (snapshot) => {
            const entries = [];

            snapshot.forEach((child) => {
                const val = child.val();
                entries.push({
                    key: child.key,
                    name: val.name,
                    wpm: val.wpm,
                    accuracy: val.accuracy,
                    date: val.date || new Date(val.timestamp).toLocaleString()
                });
            });

            entries.sort((a, b) => b.wpm - a.wpm);

            renderLeaderboard(entries);
        });
}

// Render leaderboard HTML
function renderLeaderboard(entries) {
    leaderboard.innerHTML = `
        <div class="leaderboard-header">
            <span>Rank</span>
            <span>Player</span>
            <span>WPM</span>
            <span>Accuracy</span>
        </div>
        ${entries.map((entry, index) => `
            <div class="leaderboard-entry ${index < 3 ? 'podium-' + (index + 1) : ''}">
                <span class="rank">${index + 1}</span>
                <span class="name">${entry.name}</span>
                <span class="wpm">${entry.wpm}</span>
                <span class="accuracy">${entry.accuracy}%</span>
            </div>
        `).join('')}
    `;
}


function init() {
    startBtn.addEventListener("click", startGame);
    usernameInput.value = playerName;
    initChart();
    updateLeaderboard();

    leaderboardInterval = setInterval(updateLeaderboard, 5000);
}

document.addEventListener("DOMContentLoaded", init);
