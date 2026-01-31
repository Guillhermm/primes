# Primes

A puzzle game inspired by the classic 2048, reimagined with prime numbers and custom merge rules, built using HTML, CSS, and vanilla JavaScript.

The project focuses on algorithmic logic, grid-based movement, dynamic number generation, animations, and mobile-friendly interactions rather than traditional arithmetic merging.

**Live demo:** https://codepen.io/guillhermm/pen/jErLeva

![Primes Game preview](./preview.png)

## Behavior

- The game is played on a 4×4 grid generated in HTML and managed via JavaScript.
- Tiles spawn with prime numbers (2 or 3) and slide in four directions using keyboard or swipe input.
- Tiles may merge in groups of **2 or 3 consecutive tiles**.
- A merge is only valid if the sum is either a prime number or in case it does not exceed the current **Next** target prime.
- Prime numbers beyond the initial predefined list are generated dynamically at runtime.
- Tile colors are assigned by tier and scale visually as primes grow.
- Font size adapts automatically to fit large prime values inside tiles.
- Smooth animations are used for tile movement, spawning, and merging.
- The game tracks current score and best score, highest prime achieved and best prime, and total moves.
- A medal system (bronze, silver, gold) reflects player progress based on the highest prime reached.
- Game state is automatically persisted using `localStorage`, allowing sessions to resume after a page refresh.
- A rules/info modal explains gameplay mechanics using paginated sections.
- Mobile swipe gestures are fully supported, with native pull-to-refresh disabled while interacting with the board.

## Notes

- This is a strategy-focused number puzzle rather than a traditional arithmetic game.
- Merging rules are intentionally restrictive, encouraging players to think ahead and plan moves carefully instead of merging freely. The challenge comes from managing prime growth, board space, and merge opportunities.
- The project is implemented entirely with vanilla technologies, prioritizing clarity, performance, and maintainability without external libraries or frameworks.