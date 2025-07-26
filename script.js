const sudokuGrid = document.getElementById('sudoku-grid');
const newGameButton = document.getElementById('new-game-btn');
const resetButton = document.getElementById('reset-btn');
const checkButton = document.getElementById('check-btn');
const solveButton = document.getElementById('solve-btn');
const undoButton = document.getElementById('undo-btn');
const redoButton = document.getElementById('redo-btn');
// const notesModeButton = document.getElementById('notes-mode-btn'); // REMOVED: Notes Mode button
const hintButton = document.getElementById('hint-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
const errorMessage = document.getElementById('error-message');
const statusMessage = document.getElementById('status-message');
const timerDisplay = document.getElementById('timer');
const difficultyRatingDisplay = document.getElementById('difficulty-rating');
const numberInputPad = document.querySelector('.number-input-pad');
const winModal = new bootstrap.Modal(document.getElementById('winModal'));
const finalTimeDisplay = document.getElementById('final-time');
const playAgainBtn = document.getElementById('play-again-btn');

// Custom Puzzle elements
const puzzleInput = document.getElementById('puzzle-input');
const loadPuzzleButton = document.getElementById('load-puzzle-btn');
const getPuzzleStringButton = document.getElementById('get-puzzle-string-btn');
const puzzleStringOutput = document.getElementById('puzzle-string-output');

// New elements for game start/pause functionality
const startGameButton = document.getElementById('start-game-btn'); // New
const additionalControls = document.querySelector('.additional-controls'); // New
const numberInputPadContainer = document.querySelector('.number-input-pad'); // New
const startOverlay = document.getElementById('start-overlay'); // New

let currentBoard = []; // User's current input, including their numbers
let initialBoard = []; // The generated puzzle (fixed numbers), used for reset
let solvedBoard = [];  // The complete, solved board for validation/hints
let selectedCell = { row: -1, col: -1 };
let timerInterval;
let seconds = 0;
let gameStarted = false; // Initial state: game is not started
// let notesMode = false; // REMOVED: Notes Mode flag

// History for Undo/Redo
// Stores objects like: { row, col, oldValue, newValue, isPencilMarkChange }
let history = [];
let historyPointer = -1;

// Stores notes: { "row-col": [num1, num2, ...], ... } (user's pencil marks)
// let cellNotes = {}; // REMOVED: cellNotes for pencil marks

// Stores candidates: { "row-col": Set<num1, num2, ...>, ... } (auto-generated candidates for empty cells)
let cellCandidates = {}; // Kept for hint/solver logic, but not displayed to user directly

// Difficulty rating based on solving techniques
const SOLVER_TECHNIQUES = {
    NAKED_SINGLE: 1,
    HIDDEN_SINGLE: 2,
    NAKED_PAIR: 3,
    HIDDEN_PAIR: 4,
    // Add more advanced techniques here if implemented
    DEFAULT: 0
};
let puzzleSolverRating = SOLVER_TECHNIQUES.DEFAULT;


// --- Sudoku Generation and Solving Logic (Refined for Candidate Tracking) ---

// Function to generate a full valid Sudoku board
function generateFullBoard() {
    let board = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillBoard(board);
    return board;
}

// Backtracking algorithm to fill the board (creates a solvable board)
function fillBoard(board) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
                let numbers = shuffleArray([...Array(9).keys()].map(n => n + 1));
                for (let num of numbers) {
                    if (isValidPlacement(board, row, col, num)) {
                        board[row][col] = num;
                        if (fillBoard(board)) {
                            return true;
                        }
                        board[row][col] = 0; // Backtrack
                    }
                }
                return false;
            }
        }
    }
    return true;
}

// Checks if a number can be placed at a given position in a given board state
function isValidPlacement(board, row, col, num) {
    if (num === 0) return true; // 0 (empty) is always valid as a placeholder

    // Check row
    for (let x = 0; x < 9; x++) {
        if (board[row][x] === num && x !== col) return false;
    }
    // Check column
    for (let x = 0; x < 9; x++) {
        if (board[x][col] === num && x !== row) return false;
    }
    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[i + startRow][j + startCol] === num && (i + startRow !== row || j + startCol !== col)) return false;
        }
    }
    return true;
}

// Remove numbers to create the puzzle based on difficulty
function removeNumbers(board, difficulty) {
    let cellsToRemove;
    switch (difficulty) {
        case 'easy':
            cellsToRemove = 40;
            break;
        case 'medium':
            cellsToRemove = 50;
            break;
        case 'hard':
            cellsToRemove = 60;
            break;
        default:
            cellsToRemove = 40;
    }

    let positions = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            positions.push({ r, c });
        }
    }
    shuffleArray(positions);

    let count = 0;
    // Iterate through positions, removing numbers, and tracking the hardest technique needed to solve it
    // This is a simplified approach to puzzle rating. A true rating requires multiple solution attempts
    // using only specific techniques.
    puzzleSolverRating = SOLVER_TECHNIQUES.DEFAULT;

    while (count < cellsToRemove && positions.length > 0) {
        const { r, c } = positions.pop();
        if (board[r][c] !== 0) {
            let tempValue = board[r][c];
            board[r][c] = 0; // Temporarily remove

            let tempBoardCopy = JSON.parse(JSON.stringify(board));
            let solutionFound = false;
            let tempSolverRating = SOLVER_TECHNIQUES.DEFAULT;

            // Use a temporary solver to check solvability and estimate difficulty
            const tempSolution = JSON.parse(JSON.stringify(board));
            const currentPuzzleCandidates = calculateAllCandidates(tempSolution);

            // Attempt to solve using basic techniques first for rating
            if (applyNakedSingles(tempSolution, currentPuzzleCandidates) || applyHiddenSingles(tempSolution, currentPuzzleCandidates)) {
                tempSolverRating = Math.max(tempSolverRating, SOLVER_TECHNIQUES.NAKED_SINGLE); // If solved with easy, it's easy
                if (isBoardFull(tempSolution) && checkBoardForSolver(tempSolution, solvedBoard)) { // If fully solved by just singles
                    solutionFound = true;
                }
            }
            // If not solved by singles, try full backtracking (which implies higher difficulty)
            if (!solutionFound) {
                if (fillBoard(tempBoardCopy)) { // Use original fillBoard for full solve
                    solutionFound = true;
                    tempSolverRating = Math.max(tempSolverRating, SOLVER_TECHNIQUES.HIDDEN_PAIR); // Assuming backtracking implies harder techniques
                }
            }

            if (!solutionFound) { // If it becomes unsolvable, revert
                board[r][c] = tempValue;
            } else {
                count++;
                puzzleSolverRating = Math.max(puzzleSolverRating, tempSolverRating); // Update global rating
            }
        }
    }
}

// Helper for solver: checks if currentBoard matches solvedBoard (used for internal solver validation)
function checkBoardForSolver(boardToCheck, solvedReferenceBoard) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (boardToCheck[r][c] !== solvedReferenceBoard[r][c]) {
                return false;
            }
        }
    }
    return true;
}


// --- Utility Functions ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function clearMessages() {
    errorMessage.textContent = '';
    statusMessage.textContent = '';
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    timerDisplay.innerHTML = `<i class="far fa-clock me-2"></i> ${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// --- Local Storage ---
function saveGame() {
    // Only save if a game is active or if it was explicitly started
    if (!gameStarted && !localStorage.getItem('sudokuMasterGame')) return;

    const gameState = {
        currentBoard: currentBoard,
        initialBoard: initialBoard,
        solvedBoard: solvedBoard,
        seconds: seconds,
        difficulty: document.querySelector('input[name="difficulty"]:checked')?.value || 'easy',
        // notesData: getNotesData(), // REMOVED: notesData
        selectedCell: selectedCell,
        history: history,
        historyPointer: historyPointer,
        darkMode: document.body.classList.contains('dark-mode'),
        puzzleSolverRating: puzzleSolverRating,
        gameStarted: gameStarted // Save gameStarted state
    };
    localStorage.setItem('sudokuMasterGame', JSON.stringify(gameState));
}

function loadGame() {
    const savedState = localStorage.getItem('sudokuMasterGame');
    if (savedState) {
        try {
            const gameState = JSON.parse(savedState);
            currentBoard = gameState.currentBoard;
            initialBoard = gameState.initialBoard;
            solvedBoard = gameState.solvedBoard;
            seconds = gameState.seconds || 0;
            selectedCell = gameState.selectedCell || { row: -1, col: -1 };
            // cellNotes = gameState.notesData || {}; // REMOVED: cellNotes loading
            history = gameState.history || [];
            historyPointer = gameState.historyPointer !== undefined ? gameState.historyPointer : -1;
            puzzleSolverRating = gameState.puzzleSolverRating || SOLVER_TECHNIQUES.DEFAULT;
            gameStarted = gameState.gameStarted !== undefined ? gameState.gameStarted : false; // Load gameStarted state

            const savedDifficulty = gameState.difficulty || 'easy';
            const difficultyRadio = document.getElementById(`difficulty${savedDifficulty.charAt(0).toUpperCase() + savedDifficulty.slice(1)}`);
            if (difficultyRadio) {
                difficultyRadio.checked = true;
            }

            if (gameState.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            renderBoard(currentBoard); // This will update visuals but not necessarily enable interaction
            updateDifficultyRatingDisplay();
            updateUndoRedoButtons();
            recalculateAllCandidates();
            
            // Crucial: Set game state based on loaded 'gameStarted'
            if (gameStarted) {
                startTimer();
                statusMessage.textContent = 'Game loaded!';
                toggleGameControls(true); // Enable controls
            } else {
                stopTimer(); // Ensure timer is stopped if not started
                statusMessage.textContent = 'Game loaded. Click Start Game to continue!';
                toggleGameControls(false); // Keep controls disabled
            }
            return true;
        } catch (e) {
            console.error("Error loading game from local storage:", e);
            localStorage.removeItem('sudokuMasterGame');
            return false;
        }
    }
    return false;
}

function clearSavedGame() {
    localStorage.removeItem('sudokuMasterGame');
}

// --- Game Initialization and UI Rendering ---

function initializeGame(difficulty, customPuzzleString = null) {
    clearMessages();
    stopTimer();
    seconds = 0;
    updateTimerDisplay();
    gameStarted = false; // Initially not started until user clicks Start/New Game
    history = [];
    historyPointer = -1;
    updateUndoRedoButtons();
    // notesMode = false; // REMOVED: notesMode
    // notesModeButton.classList.remove('active'); // REMOVED: notesMode button class
    removeConflictHighlights();
    // cellNotes = {}; // REMOVED: cellNotes
    cellCandidates = {}; // Clear candidates for new game
    puzzleSolverRating = SOLVER_TECHNIQUES.DEFAULT;

    // Reset selected cell on new game
    selectedCell = { row: -1, col: -1 };

    if (customPuzzleString) {
        const parsedPuzzle = parsePuzzleString(customPuzzleString);
        if (!parsedPuzzle) {
            errorMessage.textContent = 'Invalid puzzle string. Must be 81 digits (0-9).';
            renderBoard(Array.from({ length: 9 }, () => Array(9).fill(0))); // Render empty grid if invalid
            toggleGameControls(false); // Keep controls disabled for invalid puzzle
            return;
        }
        const initialConflicts = getConflicts(parsedPuzzle);
        if (initialConflicts.length > 0) {
            errorMessage.textContent = 'This puzzle has initial conflicts. Please correct them.';
            initialBoard = parsedPuzzle;
            currentBoard = JSON.parse(JSON.stringify(initialBoard));
            renderBoard(currentBoard);
            toggleGameControls(false); // Keep controls disabled for conflicting puzzle
            return;
        }

        initialBoard = parsedPuzzle;
        solvedBoard = JSON.parse(JSON.stringify(initialBoard));
        if (!fillBoard(solvedBoard)) {
            errorMessage.textContent = 'This custom puzzle has no solution or is invalid.';
            renderBoard(initialBoard); // Show the invalid puzzle
            toggleGameControls(false); // Keep controls disabled
            return;
        }
        currentBoard = JSON.parse(JSON.stringify(initialBoard));
        statusMessage.textContent = 'Custom puzzle loaded. Click Start Game to begin!';
        const tempSolverBoard = JSON.parse(JSON.stringify(initialBoard));
        puzzleSolverRating = estimatePuzzleDifficulty(tempSolverBoard);

    } else {
        solvedBoard = generateFullBoard();
        initialBoard = JSON.parse(JSON.stringify(solvedBoard));
        removeNumbers(initialBoard, difficulty);
        currentBoard = JSON.parse(JSON.stringify(initialBoard));
        statusMessage.textContent = 'Puzzle generated. Click Start Game to begin!';
    }

    renderBoard(currentBoard); // Render board, but it will be disabled by default
    updateDifficultyRatingDisplay();
    recalculateAllCandidates(); // Calculate candidates for the new puzzle
    clearSavedGame(); // Clear previous game save on new game
    toggleGameControls(false); // Ensure controls are initially disabled
}

function renderBoard(boardToRender) {
    sudokuGrid.innerHTML = '';
    // Grid itself will be enabled/disabled via a class on its parent
    // The overlay will handle visual feedback
    sudokuGrid.style.pointerEvents = 'auto'; // Reset pointer events on grid itself for overlay interaction

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.classList.add('sudoku-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;

            // Main value display
            const valueSpan = document.createElement('span');
            valueSpan.classList.add('cell-value');
            cell.appendChild(valueSpan);

            // Pencil marks display - KEPT IN HTML/CSS BUT NOT USED IN JS LOGIC
            const pencilMarksDiv = document.createElement('div');
            pencilMarksDiv.classList.add('pencil-marks');
            for (let i = 1; i <= 9; i++) {
                const markSpan = document.createElement('span');
                markSpan.classList.add('pencil-mark');
                pencilMarksDiv.appendChild(markSpan);
            }
            cell.appendChild(pencilMarksDiv);

            if (initialBoard[r][c] !== 0) {
                cell.classList.add('fixed-cell');
                // Even fixed cells need click listener for selection if game is not started,
                // but their values can't be changed. Interaction is controlled by overlay/gameStarted.
            }
            cell.addEventListener('click', handleCellClick); // All cells listen for clicks

            // --- ADDED CODE FOR PROGRAMMATIC BORDER CLASSES ---
            // Apply thick right border
            if ((c + 1) % 3 === 0 && c !== 8) { // If it's the 3rd, 6th column, but not the very last column
                cell.classList.add('block-border-right');
            }
            // Apply thick bottom border
            if ((r + 1) % 3 === 0 && r !== 8) { // If it's the 3rd, 6th row, but not the very last row
                cell.classList.add('block-border-bottom');
            }
            // Apply thick top border (for cells in rows 4 or 7, which are the start of a new 3x3 block row)
            if (r === 3 || r === 6) {
                cell.classList.add('block-border-top');
            }
            // Apply thick left border (for cells in columns 4 or 7, which are the start of a new 3x3 block column)
            if (c === 3 || c === 6) {
                cell.classList.add('block-border-left');
            }
            // --- END ADDED CODE ---

            sudokuGrid.appendChild(cell);
        }
    }
    // Append the overlay after all cells are added to ensure it's on top
    sudokuGrid.appendChild(startOverlay);
    updateCellDisplay(); // Ensure visual state is accurate after render
    highlightSelectedCell(); // Apply initial highlights
}

function updateCellDisplay() {
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');
    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const valueSpan = cell.querySelector('.cell-value');
        const pencilMarksDiv = cell.querySelector('.pencil-marks'); // Still exists in HTML, but not used

        // Clear all previous content and visual state related to values/notes
        valueSpan.textContent = '';
        cell.classList.remove('conflict', 'error-check');
        // Clear pencil marks (even though not used, good to reset)
        Array.from(pencilMarksDiv.children).forEach(mark => mark.textContent = '');

        if (initialBoard[r][c] !== 0) {
            // Fixed cell (from the initial puzzle)
            valueSpan.textContent = initialBoard[r][c];
            cell.classList.add('fixed-cell');
        } else if (currentBoard[r][c] !== 0) {
            // User-entered value
            valueSpan.textContent = currentBoard[r][c];
            cell.classList.remove('fixed-cell');
        } else {
            // Empty cell - no pencil marks displayed in this version
            cell.classList.remove('fixed-cell');
            // The pencilMarksDiv will remain empty
        }
    });
    // Re-apply selection and group/same-number highlights
    highlightSelectedCell();
    // Re-check for real-time conflicts after any display update
    highlightConflictingCells();
}

// Generates the number input pad buttons (1-9 and Clear)
function createNumberInputPad() {
    numberInputPad.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
        const button = document.createElement('button');
        button.classList.add('btn', 'btn-primary', 'me-2');
        button.textContent = i;
        button.addEventListener('click', () => handleNumberInput(i));
        numberInputPad.appendChild(button);
    }
    const clearButton = document.createElement('button');
    clearButton.classList.add('btn', 'btn-secondary');
    clearButton.innerHTML = '<i class="fas fa-eraser me-1"></i>Clear';
    clearButton.addEventListener('click', () => handleNumberInput(0)); // 0 signifies clear
    numberInputPad.appendChild(clearButton);
}

// Function to toggle the visibility and interactivity of game controls
function toggleGameControls(enabled) {
    // Buttons in game-controls
    startGameButton.style.display = enabled ? 'none' : 'inline-block';
    newGameButton.style.display = enabled ? 'inline-block' : 'none';
    resetButton.style.display = enabled ? 'inline-block' : 'none';
    checkButton.style.display = enabled ? 'inline-block' : 'none';
    solveButton.style.display = enabled ? 'inline-block' : 'none';

    // Additional controls and number input pad
    additionalControls.style.display = enabled ? 'flex' : 'none';
    numberInputPadContainer.style.display = enabled ? 'flex' : 'none';

    // Sudoku grid interaction
    if (enabled) {
        sudokuGrid.classList.remove('disabled-grid');
        sudokuGrid.style.pointerEvents = 'auto'; // Enable interactions
        startOverlay.style.display = 'none'; // Hide overlay
    } else {
        sudokuGrid.classList.add('disabled-grid');
        sudokuGrid.style.pointerEvents = 'none'; // Disable interactions (overlay covers it)
        startOverlay.style.display = 'flex'; // Show overlay
    }
    
    // Disable difficulty radios when game is active to prevent mid-game difficulty change
    difficultyRadios.forEach(radio => radio.disabled = enabled);

    // Always keep dark mode and custom puzzle section visible
    darkModeToggle.style.display = 'inline-block';

    // Update undo/redo buttons state based on gameStarted
    updateUndoRedoButtons();
}

// --- Event Handlers ---

function handleCellClick(event) {
    // Only allow cell interaction if the game has started
    if (!gameStarted) {
        errorMessage.textContent = "Click 'Start Game' to begin interacting with the puzzle.";
        return;
    }

    const cell = event.target.closest('.sudoku-cell');
    if (!cell) return;

    selectedCell.row = parseInt(cell.dataset.row);
    selectedCell.col = parseInt(cell.dataset.col);
    highlightSelectedCell();
    clearMessages(); // Clear any previous messages
}

function handleNumberInput(num) {
    if (!gameStarted) {
        errorMessage.textContent = "Click 'Start Game' to input numbers.";
        return;
    }

    if (selectedCell.row === -1 || selectedCell.col === -1) {
        errorMessage.textContent = 'Please select a cell first.';
        return;
    }

    const r = selectedCell.row;
    const c = selectedCell.col;

    // Fixed cells cannot be changed
    if (initialBoard[r][c] !== 0) {
        errorMessage.textContent = 'This is a fixed number and cannot be changed.';
        return;
    }

    // Handle main value input
    const oldValue = currentBoard[r][c];
    const newValue = num;

    if (oldValue !== newValue) {
        addHistory(r, c, oldValue, newValue, false); // False for main value change
        currentBoard[r][c] = newValue;

        // If a value is entered, clear any notes for that cell (even though notes aren't user-facing)
        // setNotesForCell(r, c, []); // REMOVED: No user notes

        // Update candidates for affected cells
        recalculateAffectedCandidates(r, c, newValue);
        updateCellDisplay(); // This will also trigger conflict highlighting
        clearMessages();

        // Check for conflicts immediately after placing the number
        const conflicts = getConflicts(currentBoard);
        if (conflicts.length === 0 && isBoardFull(currentBoard)) {
            // Only check for win if no conflicts and board is full
            if (checkBoard(currentBoard)) {
                handleWinGame();
            }
        }
        saveGame();
    }
}

// Keyboard input handling (1-9, Arrow keys, Backspace, Delete)
document.addEventListener('keydown', (event) => {
    if (!gameStarted) return; // Only allow keyboard input if game has started
    if (selectedCell.row === -1 || selectedCell.col === -1) return;

    const currentRow = selectedCell.row;
    const currentCol = selectedCell.col;
    let newRow = currentRow;
    let newCol = currentCol;

    if (event.key >= '1' && event.key <= '9') {
        handleNumberInput(parseInt(event.key));
        event.preventDefault(); // Prevent default browser action (e.g., scrolling)
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
        handleNumberInput(0); // 0 for clear
        event.preventDefault();
    }
    // REMOVED: 'n' or 'N' key for notes mode
    else {
        switch (event.key) {
            case 'ArrowUp':
                newRow = Math.max(0, currentRow - 1);
                break;
            case 'ArrowDown':
                newRow = Math.min(8, currentRow + 1);
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, currentCol - 1);
                break;
            case 'ArrowRight':
                newCol = Math.min(8, currentCol + 1);
                break;
            default:
                return; // Don't prevent default for other keys
        }

        if (newRow !== currentRow || newCol !== currentCol) {
            selectedCell = { row: newRow, col: newCol };
            const newCellElement = sudokuGrid.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            if (newCellElement) {
                newCellElement.click(); // Simulate click to trigger selection and highlights
            }
        }
        event.preventDefault(); // Prevent default browser behavior for arrow keys etc.
    }
});


// --- Highlight Logic ---
function highlightSelectedCell() {
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');
    cells.forEach(cell => {
        cell.classList.remove('selected', 'highlight-group', 'highlight-same');
    });

    if (selectedCell.row === -1 || selectedCell.col === -1) return;

    const selectedRow = selectedCell.row;
    const selectedCol = selectedCell.col;
    const selectedValue = currentBoard[selectedRow][selectedCol];

    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        // Highlight selected cell
        if (r === selectedRow && c === selectedCol) {
            cell.classList.add('selected');
        }

        // Highlight row, column, and 3x3 block
        const boxRowStart = Math.floor(selectedRow / 3) * 3;
        const boxColStart = Math.floor(selectedCol / 3) * 3;
        const inSameBlock = (Math.floor(r / 3) * 3 === boxRowStart && Math.floor(c / 3) * 3 === boxColStart);

        if (r === selectedRow || c === selectedCol || inSameBlock) {
            cell.classList.add('highlight-group');
        }

        // Highlight cells with the same value (if selected cell has a value)
        if (selectedValue !== 0 && currentBoard[r][c] === selectedValue) {
            cell.classList.add('highlight-same');
        }
    });
}

// --- Conflict Highlighting ---
function getConflicts(board) {
    const conflicts = new Set(); // Stores "row-col" strings of conflicting cells

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const value = board[r][c];
            if (value === 0) continue; // Skip empty cells

            // Check row
            for (let x = 0; x < 9; x++) {
                if (x !== c && board[r][x] === value) {
                    conflicts.add(`${r}-${c}`);
                    conflicts.add(`${r}-${x}`); // Also add the conflicting cell itself
                }
            }

            // Check column
            for (let x = 0; x < 9; x++) {
                if (x !== r && board[x][c] === value) {
                    conflicts.add(`${r}-${c}`);
                    conflicts.add(`${x}-${c}`);
                }
            }

            // Check 3x3 box
            const startRow = Math.floor(r / 3) * 3;
            const startCol = Math.floor(c / 3) * 3;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    const boxR = startRow + i;
                    const boxC = startCol + j;
                    if ((boxR !== r || boxC !== c) && board[boxR][boxC] === value) {
                        conflicts.add(`${r}-${c}`);
                        conflicts.add(`${boxR}-${boxC}`);
                    }
                }
            }
        }
    }
    return Array.from(conflicts).map(coord => { // Convert back to {row, col} objects
        const [r, c] = coord.split('-').map(Number);
        return { row: r, col: c };
    });
}

function highlightConflicts(conflicts) {
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');
    cells.forEach(cell => {
        cell.classList.remove('conflict'); // Clear all previous conflict highlights
        cell.classList.remove('error-check'); // Also clear any previous 'check' errors
    });

    conflicts.forEach(conflict => {
        const cellElement = sudokuGrid.querySelector(`[data-row="${conflict.row}"][data-col="${conflict.col}"]`);
        if (cellElement) {
            cellElement.classList.add('conflict');
        }
    });
}

function removeConflictHighlights() {
    const cells = sudokuGrid.querySelectorAll('.sudoku-cell');
    cells.forEach(cell => {
        cell.classList.remove('conflict');
        cell.classList.remove('error-check');
    });
}

function highlightConflictingCells() {
    const conflicts = getConflicts(currentBoard);
    highlightConflicts(conflicts);
}


// --- Pencil Mark Management (User's Notes) ---
// REMOVED: getNotesForCell, setNotesForCell, getNotesData


// --- Candidate List Management (Auto-Generated) ---

// Initializes candidates for all empty cells on the board
function recalculateAllCandidates() {
    cellCandidates = {}; // Clear previous candidates
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0) {
                const possible = getPossibleCandidates(currentBoard, r, c);
                if (possible.length > 0) {
                    cellCandidates[`${r}-${c}`] = new Set(possible);
                }
            }
        }
    }
}

// Gets possible candidates for a single empty cell
function getPossibleCandidates(board, r, c) {
    const possible = [];
    for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(board, r, c, num)) {
            possible.push(num);
        }
    }
    return possible;
}

// Recalculates candidates for cells affected by a change at (row, col)
function recalculateAffectedCandidates(row, col, value) {
    // If a value was placed (not cleared), remove it from candidates in affected units
    if (value !== 0) {
        const numToRemove = value;
        // Affects cells in the same row
        for (let c = 0; c < 9; c++) {
            if (currentBoard[row][c] === 0 && cellCandidates[`${row}-${c}`]) {
                cellCandidates[`${row}-${c}`].delete(numToRemove);
            }
        }
        // Affects cells in the same column
        for (let r = 0; r < 9; r++) {
            if (currentBoard[r][col] === 0 && cellCandidates[`${r}-${col}`]) {
                cellCandidates[`${r}-${col}`].delete(numToRemove);
            }
        }
        // Affects cells in the same 3x3 block
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const r_block = startRow + i;
                const c_block = startCol + j;
                if (currentBoard[r_block][c_block] === 0 && cellCandidates[`${r_block}-${c_block}`]) {
                    cellCandidates[`${r_block}-${c_block}`].delete(numToRemove);
                }
            }
        }
        // No candidates for the cell that just got a value
        delete cellCandidates[`${row}-${col}`];
    } else {
        // If a value was cleared (cell became 0), recalculate candidates for affected cells
        recalculateAllCandidates(); // Simpler than targeted updates for clearing
    }
}


// --- History (Undo/Redo) ---
function addHistory(row, col, oldValue, newValue, isPencilMarkChange) {
    // If we've undone moves and now make a new move, truncate history
    if (historyPointer < history.length - 1) {
        history = history.slice(0, historyPointer + 1);
    }

    history.push({ row, col, oldValue, newValue, isPencilMarkChange });
    historyPointer = history.length - 1;
    updateUndoRedoButtons();
}

function undo() {
    if (historyPointer < 0 || !gameStarted) return; // Only undo if game started

    const lastMove = history[historyPointer];
    const { row, col, oldValue, isPencilMarkChange } = lastMove;

    // isPencilMarkChange will always be false in this version
    currentBoard[row][col] = oldValue;
    
    recalculateAllCandidates(); // Recalculate candidates on undo
    updateCellDisplay();
    historyPointer--;
    updateUndoRedoButtons();
    saveGame();
}

function redo() {
    if (historyPointer >= history.length - 1 || !gameStarted) return; // Only redo if game started

    historyPointer++;
    const nextMove = history[historyPointer];
    const { row, col, newValue, isPencilMarkChange } = nextMove;

    // isPencilMarkChange will always be false in this version
    currentBoard[row][col] = newValue;
    
    recalculateAllCandidates(); // Recalculate candidates on redo
    updateCellDisplay();
    updateUndoRedoButtons();
    saveGame();
}

function updateUndoRedoButtons() {
    undoButton.disabled = historyPointer < 0 || !gameStarted;
    redoButton.disabled = historyPointer >= history.length - 1 || !gameStarted;
}

// --- Custom Puzzle Input ---
function parsePuzzleString(puzzleString) {
    const cleanString = puzzleString.replace(/[^0-9]/g, ''); // Remove non-digits
    if (cleanString.length !== 81) {
        return null;
    }
    const board = [];
    for (let r = 0; r < 9; r++) {
        board.push([]);
        for (let c = 0; c < 9; c++) {
            board[r].push(parseInt(cleanString[r * 9 + c]));
        }
    }
    return board;
}

function getBoardAsString(board) {
    let puzzleString = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            puzzleString += board[r][c].toString();
        }
    }
    return puzzleString;
}

// --- Difficulty Rating Estimation ---
// This is a simplified estimation based on techniques applied by a basic solver.
function estimatePuzzleDifficulty(board) {
    let tempBoard = JSON.parse(JSON.stringify(board));
    let currentRating = SOLVER_TECHNIQUES.DEFAULT;

    // We'll iterate and try to apply techniques until no more changes or solved
    let changed;
    do {
        changed = false;
        const initialEmptyCells = countEmptyCells(tempBoard);

        // Calculate candidates for current state
        const candidates = calculateAllCandidates(tempBoard);

        // Try Naked Singles
        const nakedSinglesApplied = applyNakedSingles(tempBoard, candidates);
        if (nakedSinglesApplied) {
            changed = true;
            currentRating = Math.max(currentRating, SOLVER_TECHNIQUES.NAKED_SINGLE);
            // Re-calculate candidates after placing values
            recalculateAllCandidatesForSolver(tempBoard, candidates);
        }

        // Try Hidden Singles (requires updated candidates)
        if (!changed && !isBoardFull(tempBoard)) { // Only if Naked Singles didn't change anything
            const hiddenSinglesApplied = applyHiddenSingles(tempBoard, candidates);
            if (hiddenSinglesApplied) {
                changed = true;
                currentRating = Math.max(currentRating, SOLVER_TECHNIQUES.HIDDEN_SINGLE);
                // Re-calculate candidates after placing values
                recalculateAllCandidatesForSolver(tempBoard, candidates);
            }
        }
        // You could add Naked Pairs/Triples here for higher rating, but it gets complex quickly.
        // For now, if it requires more than singles, it's considered harder than easy.

        if (countEmptyCells(tempBoard) < initialEmptyCells) { // If any technique placed numbers
            changed = true;
        }

    } while (changed && !isBoardFull(tempBoard));

    // If board still not full after basic techniques, it's harder
    if (!isBoardFull(tempBoard)) {
        currentRating = Math.max(currentRating, SOLVER_TECHNIQUES.NAKED_PAIR); // Assume it needs pair/triple or deeper logic
    }

    let ratingText = '';
    switch (currentRating) {
        case SOLVER_TECHNIQUES.NAKED_SINGLE:
            ratingText = 'Easy';
            break;
        case SOLVER_TECHNIQUES.HIDDEN_SINGLE:
            ratingText = 'Medium';
            break;
        case SOLVER_TECHNIQUES.NAKED_PAIR: // and higher
            ratingText = 'Hard';
            break;
        default:
            ratingText = 'Unknown';
    }
    return ratingText;
}

function updateDifficultyRatingDisplay() {
    difficultyRatingDisplay.textContent = `Difficulty: ${puzzleSolverRating}`;
}

// --- AI Solver/Hint Techniques ---

// Calculates candidates for all empty cells in a given board state for the solver
function calculateAllCandidates(board) {
    const candidates = {};
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                candidates[`${r}-${c}`] = new Set(getPossibleCandidates(board, r, c));
            }
        }
    }
    return candidates;
}
// Specific version for solver context as it might mutate the board
function recalculateAllCandidatesForSolver(board, candidates) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const possible = getPossibleCandidates(board, r, c);
                candidates[`${r}-${c}`] = new Set(possible);
            } else {
                delete candidates[`${r}-${c}`]; // No candidates for filled cells
            }
        }
    }
}

// Naked Single: A cell has only one possible candidate
function applyNakedSingles(board, candidates) {
    let changed = false;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const cellKey = `${r}-${c}`;
                const cellPossibles = candidates[cellKey];
                if (cellPossibles && cellPossibles.size === 1) {
                    const value = Array.from(cellPossibles)[0];
                    board[r][c] = value;
                    changed = true;
                }
            }
        }
    }
    return changed;
}

// Hidden Single: A number is a candidate for only one cell in a row, column, or block
function applyHiddenSingles(board, candidates) {
    let changed = false;

    // Check rows
    for (let r = 0; r < 9; r++) {
        for (let num = 1; num <= 9; num++) {
            let numOccurrences = 0;
            let lastCol = -1;
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === num) { // Number already placed
                    numOccurrences = 2; // Mark as found, so not a hidden single
                    break;
                }
                if (board[r][c] === 0 && candidates[`${r}-${c}`] && candidates[`${r}-${c}`].has(num)) {
                    numOccurrences++;
                    lastCol = c;
                }
            }
            if (numOccurrences === 1 && board[r][lastCol] === 0) {
                board[r][lastCol] = num;
                changed = true;
            }
        }
    }

    // Check columns
    for (let c = 0; c < 9; c++) {
        for (let num = 1; num <= 9; num++) {
            let numOccurrences = 0;
            let lastRow = -1;
            for (let r = 0; r < 9; r++) {
                if (board[r][c] === num) {
                    numOccurrences = 2;
                    break;
                }
                if (board[r][c] === 0 && candidates[`${r}-${c}`] && candidates[`${r}-${c}`].has(num)) {
                    numOccurrences++;
                    lastRow = r;
                }
            }
            if (numOccurrences === 1 && board[lastRow][c] === 0) {
                board[lastRow][c] = num;
                changed = true;
            }
        }
    }

    // Check blocks
    for (let br = 0; br < 3; br++) {
        for (let bc = 0; bc < 3; bc++) {
            const startRow = br * 3;
            const startCol = bc * 3;
            for (let num = 1; num <= 9; num++) {
                let numOccurrences = 0;
                let lastR = -1;
                let lastC = -1;
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const cellR = startRow + r;
                        const cellC = startCol + c;
                        if (board[cellR][cellC] === num) {
                            numOccurrences = 2;
                            break;
                        }
                        if (board[cellR][cellC] === 0 && candidates[`${cellR}-${cellC}`] && candidates[`${cellR}-${cellC}`].has(num)) {
                            numOccurrences++;
                            lastR = cellR;
                            lastC = cellC;
                        }
                    }
                    if (numOccurrences === 2) break;
                }
                if (numOccurrences === 1 && board[lastR][lastC] === 0) {
                    board[lastR][lastC] = num;
                    changed = true;
                }
            }
        }
    }
    return changed;
}

function countEmptyCells(board) {
    let count = 0;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                count++;
            }
        }
    }
    return count;
}


// --- Game Action Functions ---

function startGame() {
    clearMessages();
    startTimer();
    gameStarted = true; // Mark game as started
    statusMessage.textContent = 'Game in progress...';
    toggleGameControls(true); // Enable controls and grid interaction
    saveGame();
}

function handleNewGame() {
    const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
    initializeGame(selectedDifficulty);
    // After initializing, it's still in the "ready to start" state
    statusMessage.textContent = 'New game generated. Click Start Game to begin!';
    toggleGameControls(false); // Ensure controls are off after new puzzle generation
    selectedCell = { row: -1, col: -1 }; // Deselect any cell
    highlightSelectedCell();
}

function handleResetGame() {
    clearMessages();
    stopTimer();
    seconds = 0;
    updateTimerDisplay();
    gameStarted = true; // Still active after reset
    history = [];
    historyPointer = -1;
    updateUndoRedoButtons();
    // cellNotes = {}; // REMOVED: Clear user notes
    removeConflictHighlights();
    puzzleSolverRating = SOLVER_TECHNIQUES.DEFAULT; // Reset rating

    currentBoard = JSON.parse(JSON.stringify(initialBoard));
    renderBoard(currentBoard);
    recalculateAllCandidates(); // Recalculate candidates for the reset puzzle
    updateDifficultyRatingDisplay();
    startTimer(); // Restart timer
    statusMessage.textContent = 'Game reset!';
    saveGame();
    toggleGameControls(true); // Ensure controls are enabled
}

function handleCheckGame() {
    if (!gameStarted) {
        errorMessage.textContent = "Start the game to check your progress.";
        return;
    }
    clearMessages();
    removeConflictHighlights(); // Clear any existing real-time conflict highlights

    let incorrectCells = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cellElement = sudokuGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);

            const currentValue = currentBoard[r][c];
            if (currentValue === 0) continue; // Only check filled cells

            // Check if user's entry is different from solved board
            if (currentValue !== solvedBoard[r][c]) {
                incorrectCells.push({ r, c });
                cellElement.classList.add('error-check'); // Mark as incorrect based on solution
            }
        }
    }

    if (incorrectCells.length > 0) {
        errorMessage.textContent = `You have ${incorrectCells.length} incorrect entries. Please check the highlighted cells.`;
    } else if (isBoardFull(currentBoard) && checkBoard(currentBoard)) {
        handleWinGame();
    } else {
        statusMessage.textContent = 'No errors found so far. Keep going!';
    }
}

function handleSolveGame() {
    clearMessages();
    // Allow solving if game isn't started but board has content (e.g. custom puzzle validation)
    if (!gameStarted && isBoardFull(initialBoard) && getConflicts(initialBoard).length === 0) {
        // This is a custom loaded puzzle that wasn't started, but can be solved
    } else if (!gameStarted) { // If it's a generated puzzle not yet started
        errorMessage.textContent = "Click 'Start Game' first, or 'New Game' to generate a puzzle.";
        return;
    }

    stopTimer();
    currentBoard = JSON.parse(JSON.stringify(solvedBoard)); // Set user board to solved state
    renderBoard(currentBoard); // Re-render with solved board
    statusMessage.textContent = 'Sudoku solved!';
    gameStarted = false; // Game is no longer active
    sudokuGrid.style.pointerEvents = 'none'; // Disable input after solving
    removeConflictHighlights();
    clearSavedGame(); // No need to save a solved game
    toggleGameControls(false); // Disable controls after solve
}

function handleHint() {
    if (!gameStarted) {
        errorMessage.textContent = "Start a game to get a hint!";
        return;
    }

    let emptyCells = [];
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (currentBoard[r][c] === 0) {
                emptyCells.push({ r, c });
            }
        }
    }

    if (emptyCells.length === 0) {
        errorMessage.textContent = "Board is already full. No hints needed!";
        return;
    }

    shuffleArray(emptyCells); // Shuffle empty cells to pick a random one
    const { r, c } = emptyCells[0]; // Pick the first (random) empty cell
    const correctValue = solvedBoard[r][c]; // Get the correct value from the solved board

    // Apply the hint
    addHistory(r, c, currentBoard[r][c], correctValue, false);
    currentBoard[r][c] = correctValue;
    // setNotesForCell(r, c, []); // REMOVED: Clear notes
    recalculateAffectedCandidates(r, c, correctValue); // Update candidates

    // Update UI and messages
    updateCellDisplay();
    statusMessage.innerHTML = `Hint: Placed ${correctValue} at (${r + 1}, ${c + 1}).`;
    saveGame();

    // Check for win condition after hint
    if (isBoardFull(currentBoard) && checkBoard(currentBoard)) {
        handleWinGame();
    }
}


function handleWinGame() {
    statusMessage.textContent = 'Congratulations! You solved the Sudoku!';
    stopTimer();
    gameStarted = false; // Game is no longer active
    sudokuGrid.style.pointerEvents = 'none'; // Disable further input
    finalTimeDisplay.textContent = timerDisplay.textContent.split(' ')[1]; // Extract time
    winModal.show();
    clearSavedGame(); // Game is won, clear save
    toggleGameControls(false); // Disable controls after win
}

// Check if the current board is full
function isBoardFull(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                return false;
            }
        }
    }
    return true;
}

// Check if the current board is valid (matches the solved board)
function checkBoard(boardToCheck) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (boardToCheck[r][c] !== solvedBoard[r][c]) {
                return false;
            }
        }
    }
    return true;
}

// --- Dark Mode Toggle ---
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    saveGame(); // Save preference
}


// --- Event Listeners ---
// No longer automatically starts a game on load. User clicks "Start Game" or "New Game".
startGameButton.addEventListener('click', startGame); // New listener
newGameButton.addEventListener('click', handleNewGame); // Still exists to generate a new puzzle

resetButton.addEventListener('click', handleResetGame);
checkButton.addEventListener('click', handleCheckGame);
solveButton.addEventListener('click', handleSolveGame);
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
hintButton.addEventListener('click', handleHint);
darkModeToggle.addEventListener('click', toggleDarkMode); // New listener for dark mode

// REMOVED notesModeButton event listener
/* notesModeButton.addEventListener('click', () => {
    if (!gameStarted) {
        errorMessage.textContent = "Start the game to use Notes Mode.";
        return;
    }
    notesMode = !notesMode;
    notesModeButton.classList.toggle('active', notesMode);
    statusMessage.textContent = notesMode ? 'Notes Mode ON' : 'Notes Mode OFF';
    selectedCell = { row: -1, col: -1 }; // Deselect on mode change
    highlightSelectedCell();
}); */

playAgainBtn.addEventListener('click', () => {
    winModal.hide();
    handleNewGame(); // Generate new puzzle
    toggleGameControls(false); // Make sure it's in the "ready to start" state
});

difficultyRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        handleNewGame(); // Generate new puzzle based on difficulty
    });
});

loadPuzzleButton.addEventListener('click', () => {
    const puzzleStr = puzzleInput.value.trim();
    if (puzzleStr) {
        initializeGame(null, puzzleStr); // Use null for difficulty, indicate custom puzzle
    } else {
        errorMessage.textContent = 'Please enter a puzzle string.';
    }
});

getPuzzleStringButton.addEventListener('click', () => {
    const currentPuzzleString = getBoardAsString(initialBoard);
    puzzleStringOutput.textContent = currentPuzzleString;
    statusMessage.textContent = 'Puzzle string generated. Copy it manually.';
    // For automatic copy (requires user interaction in some browsers for security reasons):
    // navigator.clipboard.writeText(currentPuzzleString).then(() => {
    //      statusMessage.textContent = 'Puzzle string copied to clipboard!';
    // }).catch(err => {
    //      console.error('Failed to copy text: ', err);
    //      statusMessage.textContent = 'Failed to copy to clipboard. Please copy manually.';
    // });
});


// Initial setup: Load game if available, otherwise initialize to a paused state.
// The game will not start automatically.
createNumberInputPad(); // Create number buttons on load

if (!loadGame()) {
    initializeGame('easy'); // Generates a puzzle but leaves gameStarted as false
}

// After load or initial generation, ensure controls are in the correct state
toggleGameControls(gameStarted); // This will show/hide the start button and overlay correctly
