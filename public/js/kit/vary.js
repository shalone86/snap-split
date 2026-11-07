// Variety for spoken prompts, so kids don't hear the exact same line over and over.
//   vary("push", ["Push them together!", "Slide them together!"]) → a random one, never the same twice in a row.
//   leadIn() → "How about this one?", "Let's try this one!" … for the start of each new question.

const last = new Map();

export function vary(key, options) {
  if (!options?.length) return "";
  if (options.length === 1) return options[0];
  let i;
  do i = Math.floor(Math.random() * options.length);
  while (i === last.get(key));
  last.set(key, i);
  return options[i];
}

export const LEAD_INS = [
  "Let's try this one!",
  "How about this one?",
  "Here's another one!",
  "Ready for the next one?",
  "Give this one a try!",
  "Ooh, try this one!",
  "Here comes a new one!",
  "Your turn again!",
  "Let's do another!",
  "Can you solve this one?",
];
export const leadIn = () => vary("lead-in", LEAD_INS);

export const PRAISE = ["Yes!", "You got it!", "Great job!", "That's right!", "Awesome!", "Super!", "Nice work!", "Wonderful!", "Way to go!", "Perfect!"];
export const praise = () => vary("praise", PRAISE);

export const TRY_AGAIN = ["Not quite. Try again!", "Almost! Give it another try.", "Hmm, not that one. Try again!", "So close! Look again.", "Oops! Let's try once more."];
export const tryAgain = () => vary("try-again", TRY_AGAIN);
