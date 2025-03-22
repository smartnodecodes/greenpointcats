"use client";

import { useState, useEffect, useRef, CSSProperties } from "react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { cn } from "~/lib/utils";

import { Loader2, Sparkles, MoveHorizontal, Undo, RotateCcw, Info } from "lucide-react";

// Cat type definition
type Cat = {
  id: string;
  name: string;
  image: string;
  primaryColor: string;
  secondaryColor?: string;
};

// Number of boxes per stack
const MAX_STACK_SIZE = 4;

// Animation duration in ms
const ANIMATION_DURATION = 400;

// Position type for CSS
const POSITION_ABSOLUTE = 'absolute' as const;

// Difficulty levels
type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_CONFIG = {
  easy: {
    cats: 4,
    stacks: 6, // 4 cats + 2 empty
    emptyStacks: 2,
    breakupProbability: 0.1, // Very low chance of breaking up same-cat groups
  },
  medium: {
    cats: 6,
    stacks: 8, // 6 cats + 2 empty
    emptyStacks: 2,
    breakupProbability: 0.3, // Lower probability to make it easier
  },
  hard: {
    cats: 8,
    stacks: 10, // 8 cats + 2 empty
    emptyStacks: 2,
    breakupProbability: 0.5, // Medium chance of breaking up same-cat groups
  }
};

type CatBox = {
  id: string;
  cat: Cat;
  isMoving?: boolean;
  targetStack?: number;
};

type Stack = CatBox[];

interface CatSortProps {
  onComplete?: () => void;
  className?: string;
  initialDifficulty?: Difficulty;
}

export function CatSort({ onComplete, className, initialDifficulty = 'medium' }: CatSortProps) {
  const [stacks, setStacks] = useState<Stack[]>([]);
  const [selectedStackIndex, setSelectedStackIndex] = useState<number | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isLost, setIsLost] = useState(false);
  const [moves, setMoves] = useState<{ from: number, to: number, count: number }[]>([]);
  const [animatingBoxes, setAnimatingBoxes] = useState<{ id: string, fromStack: number, toStack: number }[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [activeCats, setActiveCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);

  // Reference to stack elements for position calculation
  const stackRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Create placeholder cats to use
  const placeholderCats: Cat[] = Array(8).fill(null).map((_, i) => ({
    id: `cat-${i}`,
    name: [`Whiskers`, `Mittens`, `Fluffy`, `Shadow`, `Luna`, `Oliver`, `Leo`, `Bella`][i],
    image: `https://placecats.com/64/${64 + i}`, // Slight variation in each cat image
    primaryColor: ["#f39c12", "#3498db", "#2ecc71", "#9b59b6", "#e74c3c", "#1abc9c", "#f1c40f", "#34495e"][i],
    secondaryColor: ["#e67e22", "#2980b9", "#27ae60", "#8e44ad", "#c0392b", "#16a085", "#f39c12", "#2c3e50"][i],
  }));

  // Update configuration when difficulty changes or cats are loaded
  useEffect(() => {
    if (loading) return;
    
    const config = DIFFICULTY_CONFIG[difficulty];
    
    // Use placeholder cats directly instead of trying to map over empty array
    const availableCats = placeholderCats;
    
    // Shuffle and randomly select cats for this game
    const shuffledCats = shuffleArray(availableCats);
    const gameCats = shuffledCats.slice(0, config.cats);
    
    setActiveCats(gameCats);
    
    // Initialize game with new settings
    initializeGame(gameCats, config);
    
    // Initialize stack refs array
    stackRefs.current = Array(config.stacks).fill(null);
  }, [difficulty, loading]);

  // Helper function to shuffle an array (Fisher-Yates algorithm)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize the game with a solvable but challenging configuration
  const initializeGame = (availableCats: Cat[] = activeCats, config = DIFFICULTY_CONFIG[difficulty]) => {
    if (!availableCats.length) return;

    // Create boxes (4 of each cat)
    const allBoxes: CatBox[] = [];
    availableCats.forEach(cat => {
      for (let i = 0; i < MAX_STACK_SIZE; i++) {
        allBoxes.push({
          id: `${cat.id}-${i}`,
          cat: cat
        });
      }
    });

    // Thoroughly shuffle all boxes
    const shuffledBoxes = [...allBoxes].sort(() => Math.random() - 0.5);

    // Create stacks
    const newStacks: Stack[] = [];

    // Calculate boxes per stack (excluding empty stacks)
    const filledStacks = config.stacks - config.emptyStacks;

    // Ensure even distribution - no stack should have more than MAX_STACK_SIZE boxes
    // This is crucial for solvability
    const boxesPerStack = Math.min(MAX_STACK_SIZE, Math.ceil(allBoxes.length / filledStacks));

    // For easier gameplay, we'll create some pre-matched patterns based on difficulty
    const preMatchedPairs = difficulty === 'easy' ? 4 : (difficulty === 'medium' ? 3 : 2);

    // Group some boxes of the same cat for easier starting patterns
    const organizedBoxes: CatBox[] = [];
    const remainingBoxes: CatBox[] = [...shuffledBoxes];

    // Create some pairs/triplets of the same cat to make it easier
    for (let i = 0; i < preMatchedPairs && remainingBoxes.length > 0; i++) {
      // Find boxes of the same cat
      const boxIndex = Math.floor(Math.random() * remainingBoxes.length);
      const catId = remainingBoxes[boxIndex].cat.id;

      // Find all boxes of this cat
      const samecatBoxes = remainingBoxes.filter(box => box.cat.id === catId);

      // Take 2-3 of them if available
      const pairSize = Math.min(3, samecatBoxes.length);
      const selectedBoxes = samecatBoxes.slice(0, pairSize);

      // Add them to organized boxes
      organizedBoxes.push(...selectedBoxes);

      // Remove from remaining boxes
      selectedBoxes.forEach(box => {
        const idx = remainingBoxes.findIndex(b => b.id === box.id);
        if (idx !== -1) remainingBoxes.splice(idx, 1);
      });
    }

    // Mix organized boxes with remaining shuffled boxes
    const mixedBoxes = [...organizedBoxes, ...remainingBoxes];

    // First attempt: Create filled stacks ensuring no stack has more than MAX_STACK_SIZE boxes
    for (let i = 0; i < filledStacks; i++) {
      const stack: Stack = [];
      for (let j = 0; j < boxesPerStack; j++) {
        const boxIndex = i * boxesPerStack + j;
        if (boxIndex < mixedBoxes.length) {
          stack.push(mixedBoxes[boxIndex]);
        }
      }
      newStacks.push(stack);
    }

    // Check if there are any leftover boxes and distribute them evenly
    // This handles cases where the last stack didn't get all its boxes
    const leftoverBoxes = mixedBoxes.slice(filledStacks * boxesPerStack);
    let stackIndex = 0;

    while (leftoverBoxes.length > 0 && stackIndex < filledStacks) {
      // Only add if the stack isn't already full
      if (newStacks[stackIndex].length < MAX_STACK_SIZE) {
        newStacks[stackIndex].push(leftoverBoxes.shift()!);
      }
      stackIndex = (stackIndex + 1) % filledStacks;
    }

    // Add empty stacks for maneuvering
    for (let i = 0; i < config.emptyStacks; i++) {
      newStacks.push([]);
    }

    // To make the puzzle challenging based on difficulty:

    // For easy mode, try to create a few more patterns of same-cat boxes together
    if (difficulty === 'easy') {
      // Group same-cat boxes together within stacks
      for (let i = 0; i < filledStacks; i++) {
        // Sort each stack based on cat to group them
        if (Math.random() < 0.7) { // 70% chance to create cat groupings
          newStacks[i].sort((a, b) => a.cat.id.localeCompare(b.cat.id));
        }
      }
    }

    // 1. Ensure no stack starts with 4 of the same cat for medium/hard
    if (difficulty !== 'easy') {
      for (let i = 0; i < filledStacks; i++) {
        // Shuffle each stack first
        newStacks[i] = newStacks[i].sort(() => Math.random() - 0.5);

        // Check if we accidentally created a full stack of the same cat
        if (newStacks[i].length > 0) {
          const allSamecat = newStacks[i].every(box => box.cat.id === newStacks[i][0].cat.id);

          // If so, swap a random box with another stack
          if (allSamecat && newStacks[i].length === MAX_STACK_SIZE) {
            const randomStackIndex = (i + 1 + Math.floor(Math.random() * (filledStacks - 1))) % filledStacks;
            const randomBoxIndex = Math.floor(Math.random() * newStacks[randomStackIndex].length);

            // Swap boxes
            const temp = newStacks[i][0];
            newStacks[i][0] = newStacks[randomStackIndex][randomBoxIndex];
            newStacks[randomStackIndex][randomBoxIndex] = temp;
          }
        }
      }
    }

    // 2. Break up consecutive same-cat boxes based on difficulty
    for (let i = 0; i < filledStacks; i++) {
      for (let j = 1; j < newStacks[i].length; j++) {
        // If we find consecutive same-cat boxes, maybe break them up
        if (newStacks[i][j].cat.id === newStacks[i][j - 1].cat.id &&
          Math.random() < config.breakupProbability) {

          // Find a different stack to swap with
          const randomStackIndex = (i + 1 + Math.floor(Math.random() * (filledStacks - 1))) % filledStacks;
          if (newStacks[randomStackIndex].length > 0) {
            const randomBoxIndex = Math.floor(Math.random() * newStacks[randomStackIndex].length);

            // Swap boxes
            const temp = newStacks[i][j];
            newStacks[i][j] = newStacks[randomStackIndex][randomBoxIndex];
            newStacks[randomStackIndex][randomBoxIndex] = temp;
          }
        }
      }
    }

    // Verify puzzle solvability by ensuring:
    // 1. No stack has more than MAX_STACK_SIZE boxes
    // 2. The number of boxes of each cat is at most MAX_STACK_SIZE

    // Count boxes of each cat
    const catCounts: Record<string, number> = {};
    let oversizedStacks = false;

    // Check stack sizes and count cats
    newStacks.forEach(stack => {
      if (stack.length > MAX_STACK_SIZE) {
        oversizedStacks = true;
      }

      stack.forEach(box => {
        if (!catCounts[box.cat.id]) {
          catCounts[box.cat.id] = 0;
        }
        catCounts[box.cat.id]++;
      });
    });

    // Check if any cat has more than MAX_STACK_SIZE boxes
    const tooManyBoxesOfOnecat = Object.values(catCounts).some(count => count > MAX_STACK_SIZE);

    // If either check fails, regenerate the puzzle
    if (oversizedStacks || tooManyBoxesOfOnecat) {
      console.log("Generated an invalid puzzle. Regenerating...");
      return initializeGame(availableCats, config); // Recursively try again
    }

    setStacks(newStacks);
    setSelectedStackIndex(null);
    setMoveCount(0);
    setIsComplete(false);
    setIsLost(false);
    setMoves([]);
    setAnimatingBoxes([]);
    setIsAnimating(false);
  };

  // Get all matching boxes from the top of a stack
  const getMatchingTopBoxes = (stack: Stack): Stack => {
    if (stack.length === 0) return [];

    const topBox = stack[0]; // Now the top box is at index 0
    const matchingGroup: Stack = [topBox];

    // Check boxes from top to bottom for matches
    for (let i = 1; i < stack.length; i++) {
      if (stack[i].cat.id === topBox.cat.id) {
        matchingGroup.push(stack[i]);
      } else {
        break; // Stop when we find a non-matching cat
      }
    }

    return matchingGroup;
  };

  // Check if the game is complete (each stack has only one cat or is empty)
  const checkCompletion = (currentStacks: Stack[]) => {
    // First check: each non-empty stack must have only one cat
    const eachStackValid = currentStacks.every(stack => {
      if (stack.length === 0) return true; // Empty stacks are fine

      // Check if all boxes in this stack are the same cat
      const firstcatId = stack[0].cat.id;
      return stack.every(box => box.cat.id === firstcatId);
    });

    // If basic check fails, no need to continue
    if (!eachStackValid) {
      setIsComplete(false);
      return false;
    }

    // Second check: each cat should be in exactly one stack with MAX_STACK_SIZE boxes
    const catMap: Record<string, number> = {};

    // Count boxes of each cat in play
    activeCats.forEach(cat => {
      catMap[cat.id] = 0;
    });

    // Count how many boxes of each cat exist in the stacks
    currentStacks.forEach(stack => {
      if (stack.length > 0) {
        const stackcatId = stack[0].cat.id;
        // Only count if it's a valid cat in our game
        if (catMap[stackcatId] !== undefined) {
          // If we already found a stack with this cat and it was complete,
          // this means the cat is split across multiple stacks
          if (catMap[stackcatId] === MAX_STACK_SIZE) {
            // cat appears in multiple stacks, which means it's not properly sorted
            catMap[stackcatId] = -1; // Mark as invalid
          } else {
            catMap[stackcatId] = stack.length;
          }
        }
      }
    });

    // Check if each cat has exactly MAX_STACK_SIZE boxes in a single stack
    const allcatsComplete = Object.values(catMap).every(count => count === MAX_STACK_SIZE);

    // The puzzle is complete only if both conditions are met
    const complete = eachStackValid && allcatsComplete;

    setIsComplete(complete);
    if (complete && onComplete) {
      onComplete();
    }

    return complete;
  };

  // Check if there are any valid moves available
  const checkForValidMoves = (currentStacks: Stack[]) => {
    // If any stack is empty, moves are possible
    if (currentStacks.some(stack => stack.length === 0)) {
      return true;
    }

    // Check each source stack
    for (let fromStackIndex = 0; fromStackIndex < currentStacks.length; fromStackIndex++) {
      const sourceStack = currentStacks[fromStackIndex];
      if (sourceStack.length === 0) continue;

      // Get matching boxes from the top of this stack
      const matchingBoxes = getMatchingTopBoxes(sourceStack);

      // Check each potential destination stack
      for (let toStackIndex = 0; toStackIndex < currentStacks.length; toStackIndex++) {
        if (fromStackIndex === toStackIndex) continue;

        const destStack = currentStacks[toStackIndex];

        // Check if we can move to this stack
        if (destStack.length + matchingBoxes.length <= MAX_STACK_SIZE) {
          // If destination is empty, move is valid
          if (destStack.length === 0) {
            return true;
          }

          // If destination has same cat on top, move is valid
          if (destStack[0].cat.id === matchingBoxes[0].cat.id) {
            return true;
          }
        }
      }
    }

    // No valid moves found
    return false;
  };

  // Animate boxes moving between stacks
  const animateBoxMovement = (boxIds: string[], fromStackIndex: number, toStackIndex: number) => {
    setIsAnimating(true);

    // Mark which boxes are animating
    const animBoxes = boxIds.map(id => ({
      id,
      fromStack: fromStackIndex,
      toStack: toStackIndex
    }));

    setAnimatingBoxes(animBoxes);

    // After animation completes, update the actual stacks
    setTimeout(() => {
      // Copy current stacks
      const newStacks = [...stacks];

      // Get the group of matching boxes from the top of the source stack
      const sourceStack = newStacks[fromStackIndex];
      const matchingBoxes = getMatchingTopBoxes(sourceStack);

      // Remove them from source
      newStacks[fromStackIndex] = sourceStack.slice(matchingBoxes.length);

      // Add to destination (at the beginning for top-down stacking)
      newStacks[toStackIndex] = [...matchingBoxes, ...newStacks[toStackIndex]];

      // Update state
      setStacks(newStacks);
      setAnimatingBoxes([]);
      setIsAnimating(false);

      // Check completion
      const isGameComplete = checkCompletion(newStacks);

      // If not complete, check if there are any valid moves
      if (!isGameComplete) {
        const hasValidMoves = checkForValidMoves(newStacks);
        if (!hasValidMoves) {
          setIsLost(true);
        }
      }
    }, ANIMATION_DURATION);
  };

  // Handle stack click
  const handleStackClick = (stackIndex: number) => {
    if (isComplete || isLost || isAnimating) return;

    // If no stack is selected, select this one (if it has boxes)
    if (selectedStackIndex === null) {
      if (stacks[stackIndex].length > 0) {
        setSelectedStackIndex(stackIndex);
      }
    }
    // If a stack is already selected (including this one), try to move boxes
    else {
      const fromStackIndex = selectedStackIndex;

      // Can't move to the same stack
      if (fromStackIndex === stackIndex) {
        setSelectedStackIndex(null);
        return;
      }

      // Get the group of matching boxes from the top of the source stack
      const sourceStack = stacks[fromStackIndex];
      const matchingBoxes = getMatchingTopBoxes(sourceStack);

      // Determine if we can place these boxes on the destination stack
      const destinationStack = stacks[stackIndex];

      // Check if there's room in the destination stack
      if (destinationStack.length + matchingBoxes.length <= MAX_STACK_SIZE) {
        // If destination is not empty, check if the top box cat matches
        if (destinationStack.length > 0) {
          const destTopBox = destinationStack[0]; // Top box is now at index 0
          // Can only place matching cats on top of matching cats
          if (destTopBox.cat.id !== matchingBoxes[0].cat.id && destinationStack.length > 0) {
            setSelectedStackIndex(null);
            return;
          }
        }

        // Increment move count
        setMoveCount(prev => prev + 1);

        // Record the move
        setMoves([...moves, {
          from: fromStackIndex,
          to: stackIndex,
          count: matchingBoxes.length
        }]);

        // Get the box IDs for animation
        const boxIds = matchingBoxes.map(box => box.id);

        // Start animation
        animateBoxMovement(boxIds, fromStackIndex, stackIndex);

        // Clear selection
        setSelectedStackIndex(null);
      } else {
        // Not enough room
        setSelectedStackIndex(null);
      }
    }
  };

  // Undo the last move
  const undoMove = () => {
    if (moves.length === 0 || isComplete || isAnimating) return;

    const lastMove = moves[moves.length - 1];

    // Get the boxes that need to move back
    const boxesToMoveBack = stacks[lastMove.to].slice(0, lastMove.count);
    const boxIds = boxesToMoveBack.map(box => box.id);

    // Animation will handle the actual stack update
    animateBoxMovement(boxIds, lastMove.to, lastMove.from);

    // Update move count and history
    setMoveCount(prev => prev - 1);
    setMoves(moves.slice(0, -1));
    setIsComplete(false);
    setIsLost(false); // Undo should clear the lost state
  };

  // Calculate position for animating boxes
  const getAnimatingBoxStyle = (boxId: string): CSSProperties => {
    const animBox = animatingBoxes.find(box => box.id === boxId);
    if (!animBox) return {};

    const fromStackEl = stackRefs.current[animBox.fromStack];
    const toStackEl = stackRefs.current[animBox.toStack];

    if (!fromStackEl || !toStackEl) return {};

    const fromRect = fromStackEl.getBoundingClientRect();
    const toRect = toStackEl.getBoundingClientRect();

    // Calculate the distance between stacks for animation
    const dx = toRect.left - fromRect.left;
    const dy = toRect.top - fromRect.top;

    return {
      transform: `translate(${dx}px, ${dy}px)`,
      zIndex: 50,
      position: POSITION_ABSOLUTE,
    };
  };

  // Set the difficulty level
  const handleSetDifficulty = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
  };

  // Get a background color for a cat box
  const getCatBoxStyle = (cat: Cat): CSSProperties => {
    return {
      backgroundColor: cat.primaryColor || "#f0f0f0",
      borderColor: cat.secondaryColor || "#d0d0d0",
    };
  };

  // Reset button handler
  const handleReset = () => {
    if (isAnimating) return;
    
    const config = DIFFICULTY_CONFIG[difficulty];
    // Use placeholder cats
    const shuffledCats = shuffleArray(placeholderCats);
    const newCats = shuffledCats.slice(0, config.cats);
    setActiveCats(newCats);
    initializeGame(newCats);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <Loader2 className="h-10 w-10 animate-spin" />
    </div>;
  }

  return (
    <div className={cn("flex flex-col items-center gap-2 p-4", className)}>

      <h3 className="text-lg font-semibold mb-6">While you&apos;re here, try solving this puzzle!</h3>
      <p className="text-sm text-muted-foreground mb-8">
        These cats are all mixed up! Help sort them into their proper groups!
      </p>


      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-yellow-500" />
        <h3 className="text-xl font-semibold">Cat Sort</h3>
        <Sparkles className="h-5 w-5 text-yellow-500" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>Sort cats into separate stacks. Cats of the same kind move as a group. Click a stack to select it, then click another stack to move them.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="text-sm text-gray-500 mr-1">Difficulty:</div>
        <Button
          variant={difficulty === 'easy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSetDifficulty('easy')}
          className="text-xs h-7 px-2"
          disabled={isAnimating}
        >
          Easy
        </Button>
        <Button
          variant={difficulty === 'medium' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSetDifficulty('medium')}
          className="text-xs h-7 px-2"
          disabled={isAnimating}
        >
          Medium
        </Button>
        <Button
          variant={difficulty === 'hard' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSetDifficulty('hard')}
          className="text-xs h-7 px-2"
          disabled={isAnimating}
        >
          Hard
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-3 max-w-3xl">
        {stacks.map((stack, stackIndex) => {
          // Calculate matching boxes at the top
          const matchingBoxes = selectedStackIndex === stackIndex
            ? getMatchingTopBoxes(stack)
            : [];

          return (
            <div
              key={`stack-${stackIndex}`}
              ref={(el) => { stackRefs.current[stackIndex] = el; }}
              className={cn(
                "relative w-14 h-64 border-2 border-gray-300 rounded-lg flex flex-col items-center justify-end p-1 transition-all cursor-pointer",
                selectedStackIndex === stackIndex && "border-indigo-500 border-dashed ring-2 ring-indigo-300",
                isLost && "border-red-300",
                isComplete && "border-green-300",
                stack.length === 0 && "bg-gray-50"
              )}
              onClick={() => handleStackClick(stackIndex)}
            >
              {/* Boxes are now stacked from top to bottom */}
              {stack.map((box, boxIndex) => {
                const isPartOfMatchingGroup = selectedStackIndex === stackIndex &&
                  matchingBoxes.some(matchBox => matchBox.id === box.id);

                const isAnimating = animatingBoxes.some(animBox => animBox.id === box.id);

                return (
                  <div
                    key={box.id}
                    className={cn(
                      "w-12 h-12 rounded mb-1 flex items-center justify-center border-2",
                      "transition-all duration-400",
                      isPartOfMatchingGroup && "ring-2 ring-white scale-105 z-10",
                      isLost && "opacity-80"
                    )}
                    style={{
                      ...getCatBoxStyle(box.cat),
                      ...(isAnimating ? getAnimatingBoxStyle(box.id) : {})
                    }}
                  >
                    {/* Cat image */}
                    <img
                      src={box.cat.image}
                      alt={box.cat.name}
                      width={32}
                      height={32}
                      className="object-contain rounded-full"
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 items-center mt-4">
        <div className="flex justify-between w-full gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={undoMove}
            disabled={moves.length === 0 || (isComplete && !isLost) || isAnimating}
            className="flex items-center gap-1"
          >
            <Undo className="h-3 w-3" />
            Undo
          </Button>

          <Badge variant="outline" className="px-2 py-1">
            Moves: {moveCount}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isAnimating}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>

        {isComplete && (
          <div className="text-center mt-4 animate-fade-in">
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-400 px-3 py-1 text-sm">
              🎉 Puzzle Solved in {moveCount} moves!
            </Badge>
          </div>
        )}

        {isLost && (
          <div className="text-center mt-4 animate-fade-in">
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-400 px-3 py-1 text-sm">
              😕 No more moves available! Try again.
            </Badge>
          </div>
        )}

        {selectedStackIndex !== null && (
          <div className="text-center mt-2 text-sm text-gray-500 flex items-center gap-1">
            <MoveHorizontal className="h-3 w-3" />
            Click on another stack to move the matching cats
          </div>
        )}
      </div>

      {/* Add CSS animations using dangerouslySetInnerHTML instead of style jsx */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes moveBox {
            0% { transform: translateX(0) translateY(0); }
            100% { transform: translateX(var(--tx)) translateY(var(--ty)); }
          }
        `
      }} />
    </div>
  );
} 