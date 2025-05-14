
try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
} catch (error) {
    console.error("Firebase initialization error:", error);
    
    window.db = {
        ref: () => ({
            push: (data) => {
                const scores = JSON.parse(localStorage.getItem('typingScores') || []);
                scores.push(data);
                localStorage.setItem('typingScores', JSON.stringify(scores));
            },
            orderByChild: () => ({
                limitToLast: () => ({
                    once: (type, callback) => {
                        const scores = JSON.parse(localStorage.getItem('typingScores') || []);
                        callback({ forEach: (fn) => scores.reverse().forEach(fn) });
                    }
                })
            })
        })
    };
}


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

// Load words for selected language with multiple path fallbacks
async function loadWords(language) {
    try {
        // Try multiple possible paths
        const pathsToTry = [
            `./data/${language}_words.txt`,
            `/${language}_words.txt`,
            `./${language}_words.txt`,
            `https://raw.githubusercontent.com/yourusername/yourrepo/main/data/${language}_words.txt`
        ];

        let error;
        for (const path of pathsToTry) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    const data = await response.text();
                    const words = data.split(/\s+/).filter(word => word.length > 0);
                    const shuffled = words.sort(() => 0.5 - Math.random());
                    return shuffled.slice(0, 25).join(" ");
                }
            } catch (e) {
                error = e;
                continue;
            }
        }

        throw error || new Error("Failed to load words from all paths");
    } catch (error) {
        console.error("Error loading words:", error);
        // Fallback text with more words
        return "The quick brown fox jumps over the lazy dog ".repeat(5).trim();
    }
}

// Start the typing test with loading states
async function startGame() {
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";

    try {
        playerName = usernameInput.value.trim() || playerName;
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
            if ('virtualKeyboard' in navigator) {
                navigator.virtualKeyboard.show();
            }
        }, 100);

    } catch (error) {
        console.error("Error starting game:", error);
        alert("Failed to start game. Please try again.");
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Start";
    }
}

// Render the text to be typed with character spans
function renderText() {
    textDisplay.innerHTML = text.split("").map((c, i) =>
        `<span id="char-${i}">${c}</span>`
    ).join("");
}

// Handle user input with real-time accuracy calculation
userInput.addEventListener("input", (e) => {
    const val = userInput.value;
    let correctChars = 0;
    let totalTypedChars = val.length;

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

    // Update real-time accuracy
    const currentAccuracy = totalTypedChars > 0
        ? Math.round((correctChars / totalTypedChars) * 100)
        : 0;
    accuracyDisplay.textContent = currentAccuracy;

    // Check if text is completed
    if (val === text) {
        finishGame(correctChars, text.length);
    }
});

// Finish the game and show results
function finishGame(correctChars, totalChars) {
    clearInterval(timer);
    userInput.disabled = true;

    // Calculate WPM and accuracy
    const wordCount = text.split(" ").length;
    const minutes = time / 60;
    const wpm = Math.round((wordCount / minutes) * 100) / 100;
    const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 0;

    // Update displays
    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = accuracy;
    result.textContent = `Finished! WPM: ${wpm}, Accuracy: ${accuracy}%`;
    result.style.display = "block";

    // Save score
    const entry = {
        name: playerName.substring(0, 20),
        wpm: Math.round(wpm),
        accuracy: Math.round(accuracy),
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    };

    // Update chart and leaderboard
    updateChart(wpm);
    db.ref("scores").push(entry);
    updateLeaderboard();
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

// Update leaderboard from Firebase
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

// Initialize the application
function init() {
    startBtn.addEventListener("click", startGame);
    usernameInput.value = playerName;
    initChart();
    updateLeaderboard();

    // Update leaderboard every 5 seconds
    leaderboardInterval = setInterval(updateLeaderboard, 5000);

    // Mobile keyboard support
    if ('virtualKeyboard' in navigator) {
        userInput.addEventListener('focus', () => {
            navigator.virtualKeyboard.show();
        });
    }
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
