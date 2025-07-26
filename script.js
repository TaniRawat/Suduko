const sudokuGrid = document.getElementById('sudoku-grid');
const easyButton = document.getElementById('easy');
const mediumButton = document.getElementById('medium');
const hardButton = document.getElementById('hard');
const solveButton = document.getElementById('solve');
const errorMessage = document.createElement('div');
errorMessage.style.color = 'red';
errorMessage.style.marginTop = '10px';
document.body.appendChild(errorMessage);

let board = [];

// Function to generate a Sudoku board based on difficulty
function generateBoard(difficulty) {
    // Clear the current board
    board = Array.from({ length: 9 }, () => Array(9).fill(0));
    fillBoard(board);
    removeNumbers(board, difficulty);
    renderBoard(board);
}

// Simple function to fill the board with numbers
function fillBoard(board) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (board[row][col] === 0) {
                let numbers = [...Array(9).keys()].map(n => n + 1);
                shuffleArray(numbers);
                for (let num of numbers) {
                    if (isValid(board, row, col, num)) {
                        board[row][col] = num;
                        if (fillBoard(board)) return true;
                        board[row][col] = 0; // backtrack
                    }
                }
                return false; // no valid number found
            }
        }
    }
    return true;
}

// Function to remove numbers based on difficulty
function removeNumbers(board, difficulty) {
    let removeCount;
    switch (difficulty) {
        case 'easy':
            removeCount = 30;
            break;
        case 'medium':
            removeCount = 40;
            break;
        case 'hard':
            removeCount = 50;
            break;
    }

    while (removeCount > 0) {
        const row = Math.floor(Math.random() * 9);
        const col = Math.floor(Math.random() * 9);
        if (board[row][col] !== 0) {
            board[row][col] = 0;
            removeCount--;
        }
    }
}

// Function to check if a number can be placed in a cell
function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
        if (board[row][i] === num || board[i][col] === num) return false;
    }
    const boxRowStart = Math.floor(row / 3) * 3;
    const boxColStart = Math.floor(col / 3) * 3;
    for (let i = boxRowStart; i < boxRowStart + 3; i++) {
        for (let j = boxColStart; j < boxColStart + 3; j++) {
            if (board[i][j] === num) return false;
        }
    }
    return true;
}

// Function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to render the board in the HTML
function renderBoard(board) {
    sudokuGrid.innerHTML = '';
    board.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
            const cell = document.createElement('input');
            cell.classList.add('box');
            cell.type = 'number';
            cell.min = 1;
            cell.max = 9;
            cell.value = value !== 0 ? value : '';
            cell.addEventListener('change', () => {
                const enteredValue = parseInt(cell.value, 10);
                if (isValid(board, rowIndex, colIndex, enteredValue)) {
                    board[rowIndex][colIndex] = enteredValue;
                    errorMessage.textContent = ''; // Clear error message
                } else {
                    errorMessage.textContent = 'Invalid number! Please enter a valid number.';
                    cell.value = ''; 
                                        // Clear the input if the number is invalid
                                        board[rowIndex][colIndex] = 0; // Reset the board value
                                    }
                                });
                                sudokuGrid.appendChild(cell);
                            });
                        });
                    }
                    
                    // Function to solve the Sudoku board
                    function solveBoard() {
                        const solvedBoard = JSON.parse(JSON.stringify(board)); // Create a copy of the board
                        if (fillBoard(solvedBoard)) {
                            renderBoard(solvedBoard);
                        } else {
                            alert('No solution exists!');
                        }
                    }
                    
                    // Event listeners for the buttons
                    easyButton.addEventListener('click', () => {
                        generateBoard('easy');
                        errorMessage.textContent = ''; // Clear any error messages
                    });
                    mediumButton.addEventListener('click', () => {
                        generateBoard('medium');
                        errorMessage.textContent = ''; // Clear any error messages
                    });
                    hardButton.addEventListener('click', () => {
                        generateBoard('hard');
                        errorMessage.textContent = ''; // Clear any error messages
                    });
                    solveButton.addEventListener('click', solveBoard);
                    
                    // Generate an initial board
                    generateBoard('easy');