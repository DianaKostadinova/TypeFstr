// Firebase fallback setup (if initialization fails)
try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.database();
} catch (error) {
    console.error("Firebase initialization error:", error);
    window.db = {
        ref: (path = "leaderboard/mk") => ({
            push: (data) => {
                const scores = JSON.parse(localStorage.getItem('typingScores') || '[]');
                scores.push(data);
                localStorage.setItem('typingScores', JSON.stringify(scores));
            },
            orderByChild: () => ({
                limitToLast: () => ({
                    once: (type, callback) => {
                        const scores = JSON.parse(localStorage.getItem('typingScores') || '[]');
                        callback({ forEach: (fn) => scores.reverse().forEach((val) => fn({ val: () => val })) });
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

let timer;
let time = 0;
let text = "";
let chart = null;
let playerName = "player#" + Math.floor(Math.random() * 10000);

function initChart() {
    if (chart) chart.destroy();
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
                y: { beginAtZero: true, title: { display: true, text: 'Words Per Minute' } },
                x: { title: { display: true, text: 'Attempts' } }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `WPM: ${ctx.parsed.y}`
                    }
                }
            }
        }
    });
}

async function loadWords(language) {
    const paths = [
        `./data/${language}_words.txt`,
        `/${language}_words.txt`,
        `./${language}_words.txt`,
        `https://raw.githubusercontent.com/yourusername/yourrepo/main/data/${language}_words.txt`
    ];
    for (const path of paths) {
        try {
            const res = await fetch(`${path}?nocache=${Date.now()}`);
            if (res.ok) {
                const words = (await res.text()).split(/\s+/).filter(w => w);
                return words.sort(() => Math.random() - 0.5).slice(0, 25).join(" ");
            }
        } catch (e) { continue; }
    }
    return "The quick brown fox jumps over the lazy dog ".repeat(5).trim();
}

function renderText() {
    textDisplay.innerHTML = text.split('').map((c, i) => `<span id="char-${i}">${c}</span>`).join('');
}

function startGame() {
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";
    clearInterval(timer);
    clearGameState();

    loadWords(languageSelect.value).then(loadedText => {
        text = loadedText;
        renderText();
        userInput.value = "";
        time = 0;
        timeDisplay.textContent = "0";
        result.style.display = "none";
        userInput.disabled = false;
        userInput.focus();

        timer = setInterval(() => {
            time++;
            timeDisplay.textContent = time;
        }, 1000);
    }).finally(() => {
        startBtn.disabled = false;
        startBtn.textContent = "Start";
    });
}

userInput.addEventListener("input", () => {
    const val = userInput.value;
    let correct = 0;

    for (let i = 0; i < text.length; i++) {
        const span = document.getElementById(`char-${i}`);
        if (!span) continue;

        span.classList.remove("correct", "incorrect", "current");
        if (i < val.length) {
            if (val[i] === text[i]) {
                span.classList.add("correct");
                correct++;
            } else {
                span.classList.add("incorrect");
            }
        }
        if (i === val.length) span.classList.add("current");
    }

    const accuracy = val.length ? Math.round((correct / val.length) * 100) : 0;
    accuracyDisplay.textContent = accuracy;
    if (val === text) finishGame(correct, text.length);
});

function finishGame(correct, total) {
    clearInterval(timer);
    userInput.disabled = true;
    const words = text.trim().split(" ").length;
    const wpm = Math.round((words / (time / 60)) * 100) / 100;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;

    wpmDisplay.textContent = wpm;
    accuracyDisplay.textContent = accuracy;
    result.textContent = `Finished! WPM: ${wpm}, Accuracy: ${accuracy}%`;
    result.style.display = "block";

    const score = {
        username: usernameInput.value.trim().substring(0, 20) || playerName,
        wpm: Math.round(wpm),
        accuracy,
        timestamp: Date.now(),
        date: new Date().toLocaleString()
    };
    db.ref("leaderboard/mk").push(score);
    updateChart(wpm);
    updateLeaderboard();
    clearGameState();
}

function updateChart(wpm) {
    chart.data.labels.push(`Test ${chart.data.labels.length + 1}`);
    chart.data.datasets[0].data.push(wpm);
    if (chart.data.labels.length > 10) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

function updateLeaderboard() {
    db.ref("leaderboard/mk")
        .orderByChild("wpm")
        .limitToLast(10)
        .once("value")
        .then(snapshot => {
            const entries = [];
            snapshot.forEach(child => entries.push(child.val()));
            entries.reverse();
            renderLeaderboard(entries);
        })
        .catch(err => console.error("Leaderboard error:", err));
}

function renderLeaderboard(entries) {
    leaderboard.innerHTML = entries.map((entry, i) => `
        <div class="leaderboard-entry ${i < 3 ? `podium-${i + 1}` : ''}">
            <span class="rank">${i + 1}</span>
            <span class="name">${entry.username}</span>
            <span class="wpm">${entry.wpm}</span>
            <span class="accuracy">${entry.accuracy}%</span>
        </div>
    `).join('');
}

function clearGameState() {
    localStorage.removeItem('typingTestState');
}

document.addEventListener("DOMContentLoaded", () => {
    startBtn.addEventListener("click", startGame);
    usernameInput.value = playerName;
    initChart();
    updateLeaderboard();
});
