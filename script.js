import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase
const supabaseUrl = 'https://lnxyjtpnvowbptbonzht.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxueHlqdHBudm93YnB0Ym9uemh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgwMjg2ODksImV4cCI6MjA0MzYwNDY4OX0.Aznwb14FQvRrOMlsVqzLReFSwuJ66HZ4Y_Tq0Dvm5Is';

const supabase = createClient(supabaseUrl, supabaseKey);

// DOM Elements
const cardsGrid = document.querySelector('.cards-grid');
const startBtn = document.getElementById('startBtn');
const balanceDisplay = document.getElementById('balance');
const messageDisplay = document.getElementById('message');
const countdownDisplay = document.getElementById('countdown');

// Game State Variables
let cards = ['🍎', '🍌', '🍓', '🍇', '🍒', '🍉', '🥝', '🍍'];
cards = [...cards, ...cards];
let firstCard = null;
let secondCard = null;
let lockBoard = false;
let matchedPairs = 0;
let userBalance = 0;
let attempts = 5;
let maxAttempts = 5;
let dailyResetTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let gameDetails = {};
let isGameWon = false;

// Shuffle Cards
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Initialize Game
async function initializeGame() {
    const userId = getUserIdFromParentApp();
    await loadGameDetails(userId);
    if (shouldResetDailyGame()) {
        resetDailyGame();
    }
    updateUI();
}

// Load Game Details from Supabase
async function loadGameDetails(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('game_details')
        .eq('telegram_id', userId)
        .single();

    if (error) {
        console.error('Error loading game details:', error);
        return;
    }

    if (data && data.game_details) {
        gameDetails = data.game_details;
        userBalance = gameDetails.balance || 0;
        attempts = gameDetails.attempts || maxAttempts;
    }
}

// Save Game Details to Supabase
async function saveGameDetails() {
    const userId = getUserIdFromParentApp();
    const updatedDetails = {
        balance: userBalance,
        attempts,
        matchedPairs,
        lastPlayed: new Date().toISOString(),
        isGameWon,
    };

    const { error } = await supabase
        .from('users')
        .update({ game_details: updatedDetails })
        .eq('telegram_id', userId);

    if (error) {
        console.error('Error saving game details:', error);
    }
}

// Check if Daily Game Should Reset
function shouldResetDailyGame() {
    const lastPlayed = new Date(gameDetails.lastPlayed || 0);
    const now = new Date();
    return now - lastPlayed >= dailyResetTime;
}

// Reset Daily Game
function resetDailyGame() {
    attempts = maxAttempts;
    matchedPairs = 0;
    isGameWon = false;
    gameDetails.lastPlayed = new Date().toISOString();
    cards = shuffle(cards); // Reset card positions
    saveGameDetails();
}

// Create Cards on the Grid
function createCards() {
    cardsGrid.innerHTML = '';
    cards = shuffle(cards);
    cards.forEach((value) => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-front">?</div>
                <div class="card-back">${value}</div>
            </div>
        `;
        cardsGrid.appendChild(card);

        card.addEventListener('click', () => flipCard(card, value));
    });
}

// Start the Game
function startGame() {
    if (attempts <= 0) {
        messageDisplay.innerText = 'No attempts left. Wait for the next reset!';
        showCountdown();
        return;
    }

    matchedPairs = 0;
    createCards();
    startBtn.style.display = 'none';
}

// Flip a Card
function flipCard(card, value) {
    if (lockBoard || card.classList.contains('flipped')) return;

    card.classList.add('flipped');
    if (!firstCard) {
        firstCard = { card, value };
    } else {
        secondCard = { card, value };
        checkMatch();
    }
}

// Check if Two Cards Match
function checkMatch() {
    if (firstCard.value === secondCard.value) {
        matchedPairs++;
        userBalance += calculateReward();
        updateUI();
        saveGameDetails();
        resetBoard();

        if (matchedPairs === cards.length / 2) {
            messageDisplay.innerText = 'Congratulations! You matched all the cards!';
            isGameWon = true;
            showCountdown();
        }
    } else {
        lockBoard = true;
        setTimeout(() => {
            firstCard.card.classList.remove('flipped');
            secondCard.card.classList.remove('flipped');
            resetBoard();
        }, 1000);
    }
}

// Calculate Reward Based on Matched Pairs
function calculateReward() {
    switch (matchedPairs) {
        case 1:
            return 200;
        case 2:
            return 1000;
        case 3:
            return 5000;
        case 4:
            attempts += 3;
            return 20000;
        case 5:
            return 50000;
        case 8:
            return 100000;
        default:
            return 0;
    }
}

// Reset Board After a Turn
function resetBoard() {
    [firstCard, secondCard] = [null, null];
    lockBoard = false;
}

// Update UI Elements
function updateUI() {
    balanceDisplay.innerText = userBalance;
    countdownDisplay.innerText = attempts > 0 ? `Attempts Left: ${attempts}` : 'No Attempts Left';
}

// Show Countdown Timer
function showCountdown() {
    const endTime = new Date(gameDetails.lastPlayed).getTime() + dailyResetTime;
    const interval = setInterval(() => {
        const now = new Date().getTime();
        const remainingTime = Math.max(0, endTime - now);
        if (remainingTime <= 0) {
            clearInterval(interval);
            resetDailyGame();
            updateUI();
        } else {
            countdownDisplay.innerText = `Next game in: ${formatTime(remainingTime)}`;
        }
    }, 1000);
}

// Format Time for Display
function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Get User ID from Parent App
function getUserIdFromParentApp() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('userId');
}

// Add Event Listeners
startBtn.addEventListener('click', startGame);

// Initialize Game on Page Load
document.addEventListener('DOMContentLoaded', initializeGame);
