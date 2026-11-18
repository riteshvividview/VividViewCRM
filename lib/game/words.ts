/** Words for Draw and Guess: things that are fun and possible to draw. Lower case; guesses are compared without case or spaces. */
export const WORDS: string[] = [
  // animals
  "cat", "dog", "elephant", "giraffe", "penguin", "octopus", "snail", "turtle", "rabbit", "monkey", "lion", "zebra",
  "kangaroo", "owl", "shark", "whale", "dolphin", "crab", "spider", "butterfly", "bee", "snake", "frog", "duck",
  "chicken", "cow", "pig", "horse", "camel", "peacock", "parrot", "bat", "squirrel", "hedgehog", "jellyfish", "dinosaur",
  "unicorn", "dragon", "mosquito", "ant", "crocodile", "panda", "koala", "fox", "deer", "goat",
  // food
  "pizza", "burger", "samosa", "dosa", "biryani", "ice cream", "cake", "donut", "banana", "apple", "mango", "watermelon",
  "pineapple", "grapes", "carrot", "corn", "popcorn", "sandwich", "noodles", "egg", "cheese", "cookie", "chocolate",
  "lollipop", "coconut", "chilli", "onion", "tea", "coffee", "juice", "bread", "pancake", "taco", "sushi", "jalebi",
  // things
  "umbrella", "laptop", "phone", "keyboard", "mouse", "headphones", "camera", "clock", "alarm", "lamp", "candle",
  "chair", "table", "bed", "pillow", "sofa", "door", "window", "key", "lock", "scissors", "pencil", "eraser",
  "book", "backpack", "glasses", "hat", "shoe", "sock", "shirt", "tie", "watch", "ring", "crown", "balloon",
  "kite", "gift", "trophy", "medal", "guitar", "drum", "piano", "trumpet", "microphone", "television", "remote",
  "fan", "bucket", "broom", "toothbrush", "comb", "mirror", "bottle", "cup", "spoon", "fork", "knife", "plate",
  "magnet", "battery", "bulb", "rocket", "robot", "dice", "puzzle", "ladder", "hammer", "saw", "anchor", "compass",
  // places and nature
  "house", "castle", "tent", "bridge", "lighthouse", "pyramid", "temple", "island", "volcano", "mountain", "river",
  "beach", "desert", "forest", "waterfall", "cave", "rainbow", "cloud", "rain", "snowman", "sun", "moon", "star",
  "planet", "comet", "tree", "flower", "cactus", "leaf", "mushroom", "palm tree", "tornado", "lightning",
  // transport
  "car", "bus", "train", "bicycle", "scooter", "auto rickshaw", "truck", "airplane", "helicopter", "boat", "ship",
  "submarine", "tractor", "ambulance", "fire truck", "skateboard", "parachute", "hot air balloon",
  // actions and ideas
  "sleeping", "dancing", "swimming", "running", "cooking", "reading", "singing", "fishing", "juggling", "sneezing",
  "yawning", "crying", "laughing", "thinking", "flying", "selfie", "birthday", "wedding", "holiday", "picnic",
  // office and work
  "meeting", "deadline", "coffee break", "email", "calendar", "printer", "stapler", "whiteboard", "presentation",
  "spreadsheet", "chart", "folder", "paperclip", "sticky note", "bug", "wifi", "password", "cloud storage",
  "video call", "lunch box", "id card", "elevator", "office chair", "desk", "notebook", "marker",
  // sports and games
  "cricket", "football", "tennis", "badminton", "chess", "carrom", "bowling", "golf", "basketball", "boxing",
  "skipping rope", "yoga", "surfing", "skating", "archery",
  // characters and misc
  "ghost", "alien", "pirate", "ninja", "wizard", "mermaid", "superhero", "zombie", "vampire", "astronaut",
  "clown", "king", "queen", "chef", "doctor", "police", "farmer", "artist", "teacher", "detective",
  "treasure", "map", "footprint", "shadow", "heart", "smile", "eye", "nose", "ear", "hand", "tooth", "beard",
];

/** `count` different random words. */
export function pickWords(count: number, avoid: Set<string> = new Set()): string[] {
  const pool = WORDS.filter((w) => !avoid.has(w));
  const src = pool.length >= count ? pool : WORDS;
  const out = new Set<string>();
  while (out.size < count) out.add(src[Math.floor(Math.random() * src.length)]);
  return [...out];
}

/** Blanks for the word, with chosen letter positions shown. Spaces stay as gaps. */
export function maskWord(word: string, revealed: number[] = []): string[] {
  return [...word].map((ch, i) => (ch === " " ? " " : revealed.includes(i) ? ch : "_"));
}

export const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Letters that need changing, adding or removing to turn one word into the other. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * True when a guess is nearly the word ("you're very close"):
 * - a small typo: 1 letter off for short words, 2 for words of 6 letters or more;
 * - a plural or the word with a bit missing ("cats", "elephan");
 * - one part of a two-word answer ("fire" for "fire truck").
 */
export function isClose(guess: string, word: string): boolean {
  const a = normalise(guess), b = normalise(word);
  if (!a || a === b || a.length < 3) return false;
  if (distance(a, b) <= (b.length >= 6 ? 2 : 1)) return true;
  if (b.length >= 5 && (b.startsWith(a) || a.startsWith(b)) && Math.abs(a.length - b.length) <= 3) return true;
  const parts = word.toLowerCase().split(/\s+/).map(normalise).filter((p) => p.length >= 3);
  return parts.length > 1 && parts.some((p) => p === a || distance(p, a) <= 1);
}
