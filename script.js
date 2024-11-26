// Telegram WebApp Integration and Game Logic
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

// Telegram Initialization
async function fetchUserDataFromTelegram() {
    const telegramApp = window.Telegram.WebApp;
    telegramApp.ready();

    const userTelegramId = telegramApp.initDataUnsafe.user?.id;
    const userTelegramName = telegramApp.initDataUnsafe.user?.username;

    if (!userTelegramId || !userTelegramName) {
        throw new Error("Failed to fetch Telegram user data.");
    }

    // Verify user in database, register if not exists
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', userTelegramId)
        .maybeSingle(); 

    if (error) {
        console.error('Error fetching user data:', error);
        throw new Error('Failed to fetch user data');
    }

    if (data) {
        // Existing user
        gameDetails = { ...data.game_details };
        userBalance = data.balance || 0;
        attempts = data.game_details?.attempts || maxAttempts;
    } else {
        // Register new user
        await registerNewUser(userTelegramId, userTelegramName);
    }
}

// Register New User
async function registerNewUser(userTelegramId, userTelegramName) {
    const { error } = await supabase
        .from('users')
        .insert({
            telegram_id: userTelegramId,
            username: userTelegramName,
            balance: 0,
            game_details: {
                attempts: maxAttempts,
                lastPlayed: new Date().toISOString(),
                matchedPairs: 0,
            },
        });

    if (error) {
        console.error('Error registering new user:', error);
        throw new Error('Failed to register new user');
    }
}

// Update Game State in Database
async function updateGameStateInDatabase(updatedData) {
    const telegramApp = window.Telegram.WebApp;
    const userId = telegramApp.initDataUnsafe.user?.id;

    try {
        const { error } = await supabase
            .from('users')
            .update({ game_details: updatedData, balance: userBalance })
            .eq('telegram_id', userId);

        if (error) {
            console.error('Error updating game state in Supabase:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Unexpected error while updating game state:', err);
        return false;
    }
}

// Shuffle Cards
function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

// Initialize Game
async function initializeGame() {
    await fetchUserDataFromTelegram();
    if (shouldResetDailyGame()) {
        resetDailyGame();
    }
    updateUI();
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
    saveGameDetails();
}

// Save Game Details
function saveGameDetails() {
    gameDetails = {
        attempts,
        matchedPairs,
        lastPlayed: new Date().toISOString(),
    };
    updateGameStateInDatabase(gameDetails);
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
        messageDisplay.innerText = 'لا محاولات متبقية! انتظر حتى إعادة التعيين.';
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
        attempts--;
        saveGameDetails();
        updateUI();
        resetBoard();

        if (matchedPairs === cards.length / 2) {
            messageDisplay.innerText = 'تهانينا! قمت بمطابقة جميع الكروت!';
            isGameWon = true;
        }
    } else {
        lockBoard = true;
        attempts--;
        setTimeout(() => {
            firstCard.card.classList.remove('flipped');
            secondCard.card.classList.remove('flipped');
            resetBoard();
        }, 1000);
    }
    saveGameDetails();
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
    countdownDisplay.innerText = `محاولات متبقية: ${attempts}`;
}

// Add Event Listeners
startBtn.addEventListener('click', startGame);

// Initialize Game on Page Load
document.addEventListener('DOMContentLoaded', initializeGame);
