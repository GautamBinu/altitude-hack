/**
 * What words and phrases mean for the "What are you in the mood for?" suggester.
 *
 * Each rule says: when the customer writes one of these phrases, prefer items with these tags (`want`)
 * and steer away from these (`avoid`). `because` is the end of the one-line reason ("..., for a rainy day").
 *
 * Phrases are lower case, with apostrophes dropped and hyphens turned into spaces, the same way the
 * customer's text is cleaned before matching. Longer phrases win over shorter ones, so "cold brew" is
 * read as a drink and "cold outside" as weather.
 *
 * The tags are the ones on menu items (see server/seed-mood.ts) plus a few worked out from the item:
 * hot, iced, caffeinated, caffeine-free, food, drink, coffee, tea, filter, smoothie, milkshake, quick, cheap.
 * "milk-free" is only on items that are plainly milk-free from their description (espresso, filter coffee, tea).
 */

export type Weights = Record<string, number>

export interface Rule {
  id: string
  words: string[]
  want?: Weights
  avoid?: Weights
  /**
   * What the phrase means when it is negated ("not too sweet"). Without this, a negated phrase turns its
   * `want` into a mild `avoid`, and a `situational` rule is ignored.
   */
  negated?: { want?: Weights; avoid?: Weights }
  /** Ends the one-line reason, for example "for a rainy day". Without one, the reason ends "as you asked". */
  because?: string
  /** Named in the reason when the phrase was negated and the item really lacks it: "not too sweet". */
  notAdjective?: string
  /** A situation, not a taste. "Not raining" tells us nothing, so a negated situational rule is ignored. */
  situational?: boolean
  /** The customer asked for what is popular, so rank by orders. */
  popular?: boolean
  /** Only items without caffeine will do. */
  caffeineFree?: boolean
  /**
   * How much this rule counts against the others. A taste the customer names ("sweet") counts fully; a
   * state or setting ("tired", "rainy") counts less, so "tired but I want something sweet" still gets sweet.
   */
  weight?: number
}

export const RULES: Rule[] = [
  // ---- Weather and temperature ----
  {
    id: 'rainy',
    words: ['rain', 'rainy', 'raining', 'drizzle', 'gloomy', 'grey day', 'gray day', 'overcast', 'stormy', 'storm', 'monsoon'],
    want: { hot: 2.5, cozy: 2, creamy: 0.8 },
    because: 'for a rainy day',
    situational: true,
    weight: 0.7,
  },
  {
    id: 'cold-weather',
    words: ['chilly', 'freezing', 'cold out', 'cold outside', 'cold weather', 'cold day', 'its cold', 'so cold', 'winter', 'brr', 'cool weather', 'frosty morning', 'nippy'],
    want: { hot: 3, cozy: 2 },
    because: 'to warm you up',
    situational: true,
    weight: 0.8,
  },
  {
    id: 'hot-weather',
    words: [
      'its hot', 'so hot', 'too hot', 'very hot', 'really hot', 'super hot', 'hot out', 'hot outside', 'hot day', 'hot weather',
      'boiling', 'sweltering', 'scorching', 'summer', 'sunny', 'humid', 'sticky', 'heatwave', 'heat', 'warm out', 'beach',
    ],
    want: { iced: 3, refreshing: 2 },
    because: 'for a hot day',
    situational: true,
    weight: 0.8,
  },
  {
    id: 'cold-brew',
    words: ['cold brew', 'cold brews', 'coldbrew', 'slow drip'],
    want: { iced: 3.5, coffee: 2.5, smooth: 1 },
  },
  {
    id: 'iced',
    words: ['iced', 'ice', 'over ice', 'on ice', 'cold drink', 'chilled', 'something cold', 'icy', 'frozen', 'ice cold', 'cold'],
    want: { iced: 3.5 },
  },
  {
    id: 'hot',
    words: ['hot', 'warm', 'warming', 'steaming', 'toasty', 'piping hot', 'something hot', 'hot drink'],
    want: { hot: 3.5 },
  },

  // ---- Energy and time of day ----
  {
    id: 'tired',
    words: [
      'tired', 'sleepy', 'exhausted', 'drained', 'groggy', 'wiped', 'knackered', 'fatigued', 'low energy', 'no energy', 'zombie',
      'drowsy', 'sluggish', 'burnt out', 'burned out', 'shattered', 'cant keep my eyes open', 'barely awake', 'half asleep',
    ],
    want: { energising: 1.5, caffeinated: 3.5 },
    because: 'to get you going',
    weight: 0.8,
  },
  {
    id: 'energy',
    words: [
      'energy', 'energised', 'energized', 'energise', 'energising', 'wake up', 'wake me up', 'pick me up', 'boost', 'kick', 'buzz',
      'caffeine', 'caffeinated', 'jolt', 'alert', 'awake', 'focus', 'focused', 'productive', 'concentrate', 'all nighter', 'cram', 'cramming',
    ],
    want: { energising: 3, caffeinated: 1.5 },
    because: 'for a proper boost',
  },
  {
    id: 'study',
    words: [
      'study', 'studying', 'exam', 'exams', 'finals', 'midterm', 'midterms', 'assignment', 'deadline', 'library', 'revision',
      'homework', 'lecture', 'lectures', 'class', 'project', 'hackathon', 'coding', 'work', 'working', 'essay', 'thesis',
    ],
    want: { energising: 2.5, caffeinated: 1.5, strong: 1 },
    because: 'for a long study session',
    weight: 0.8,
  },
  {
    id: 'morning',
    words: ['morning', 'early', 'first thing', 'start my day', 'start the day', 'sunrise', 'wake up call'],
    want: { energising: 2, caffeinated: 1.5, classic: 1 },
    because: 'to start the day',
    situational: true,
    weight: 0.7,
  },
  {
    id: 'afternoon',
    words: ['afternoon', 'slump', 'post lunch', 'after lunch', 'mid afternoon', 'afternoon slump', 'afternoon dip'],
    want: { energising: 2, refreshing: 1.5, caffeinated: 1 },
    because: 'for the afternoon dip',
    situational: true,
    weight: 0.7,
  },
  {
    id: 'no-caffeine',
    words: [
      'decaf', 'caffeine free', 'no caffeine', 'without caffeine', 'non caffeinated', 'no coffee', 'cant sleep', 'before bed',
      'bedtime', 'trouble sleeping', 'avoid caffeine', 'off caffeine', 'cut out caffeine', 'sensitive to caffeine', 'caffeine sensitive',
      'dont want caffeine', 'dont want any caffeine',
    ],
    want: { 'caffeine-free': 3, calming: 1 },
    because: 'with no caffeine',
    caffeineFree: true,
    situational: true,
  },
  {
    id: 'less-caffeine',
    words: ['less caffeine', 'low caffeine', 'little caffeine', 'gentle on caffeine', 'not too much caffeine', 'half caf'],
    want: { mild: 2.5, 'caffeine-free': 1.5 },
    because: 'to go easy on the caffeine',
  },
  {
    id: 'night',
    words: ['night', 'tonight', 'evening', 'late at night', 'after dinner', 'late'],
    want: { 'caffeine-free': 1.2, calming: 1.5, cozy: 1 },
    because: 'for the evening',
    situational: true,
    weight: 0.7,
  },

  // ---- Feelings ----
  {
    id: 'stressed',
    words: ['stressed', 'stress', 'anxious', 'anxiety', 'nervous', 'overwhelmed', 'tense', 'worried', 'frazzled', 'on edge', 'panicking'],
    want: { calming: 3, 'caffeine-free': 1.5, cozy: 1.5 },
    avoid: { strong: 1.5 },
    because: 'to help you settle',
    situational: true,
    weight: 0.8,
  },
  {
    id: 'calm',
    words: ['calm', 'relax', 'relaxed', 'relaxing', 'chill', 'unwind', 'peaceful', 'quiet', 'gentle', 'soothing', 'mellow', 'slow down', 'switch off'],
    want: { calming: 3, cozy: 1.5, mild: 1 },
    because: 'for something gentle',
  },
  {
    id: 'low',
    words: [
      'sad', 'lonely', 'homesick', 'upset', 'rough day', 'bad day', 'tough day', 'hard day', 'long day', 'feeling low', 'feeling down',
      'feel down', 'feel low', 'miss home', 'down in the dumps', 'heartbroken', 'need a hug', 'crying', 'having a day',
    ],
    want: { cozy: 3, indulgent: 2, sweet: 1.5, chocolatey: 1, hot: 0.5 },
    because: 'for a rough day',
    situational: true,
    weight: 0.8,
  },
  {
    id: 'cozy',
    words: ['cozy', 'cosy', 'comfort', 'comforting', 'snug', 'hug in a mug', 'homey', 'nostalgic', 'warm and cozy', 'curl up'],
    want: { cozy: 3, hot: 1.5, creamy: 1 },
    because: 'for something comforting',
  },
  {
    id: 'celebrate',
    words: [
      'celebrate', 'celebrating', 'celebration', 'birthday', 'happy', 'treat', 'treat myself', 'reward', 'deserve', 'congrats',
      'graduation', 'passed', 'good news', 'party', 'yay', 'spoil myself', 'spoil', 'splurge', 'indulgent', 'indulge', 'decadent',
    ],
    want: { indulgent: 3, sweet: 2, dessert: 1.5, fancy: 1 },
    because: 'for a treat',
    situational: true,
  },
  {
    id: 'different',
    words: ['something new', 'something different', 'try something new', 'adventurous', 'unusual', 'unique', 'fancy', 'special', 'impress', 'interesting', 'experiment'],
    want: { fancy: 3, floral: 1, nutty: 1 },
  },
  {
    id: 'popular',
    words: [
      'popular', 'bestseller', 'best seller', 'best selling', 'favourite', 'favorite', 'recommend', 'recommendation', 'whats good',
      'what do you recommend', 'what should i get', 'what should i order', 'dunno', 'idk', 'not sure', 'anything', 'whatever', 'surprise me', 'you choose', 'you pick', 'your pick',
    ],
    popular: true,
  },

  // ---- Taste ----
  {
    id: 'sweet',
    words: ['sweet', 'sugary', 'candy', 'sugar', 'sweet tooth', 'sweeter', 'sweetness', 'sweets'],
    want: { sweet: 3.5 },
    negated: { avoid: { sweet: 3.5 }, want: { bitter: 1.5, light: 1 } },
    notAdjective: 'not too sweet',
  },
  {
    id: 'not-sweet',
    words: ['unsweetened', 'sugar free', 'low sugar', 'barely sweet', 'not sweet', 'no sugar', 'less sugar', 'less sweet'],
    want: { bitter: 1.5, light: 1 },
    avoid: { sweet: 3 },
    because: 'without the sugar rush',
  },
  {
    id: 'dessert',
    words: ['dessert', 'desserts', 'pudding', 'ice cream', 'icecream', 'after dinner treat', 'cake'],
    want: { dessert: 3, sweet: 1.5, indulgent: 1 },
  },
  {
    id: 'creamy',
    words: ['creamy', 'milky', 'smooth', 'velvety', 'silky', 'foamy', 'frothy', 'creamier'],
    want: { creamy: 3, smooth: 1.5 },
    negated: { avoid: { creamy: 3 }, want: { light: 1 } },
    notAdjective: 'not creamy',
  },
  {
    id: 'no-milk',
    words: ['no milk', 'without milk', 'black coffee', 'milk free', 'dairy free', 'no dairy', 'without dairy'],
    want: { 'milk-free': 3 },
    avoid: { creamy: 3, rich: 1.5 },
    because: 'with no milk in it',
  },
  {
    id: 'heavy',
    words: ['heavy', 'rich', 'thick', 'filling', 'stodgy', 'dense', 'hearty'],
    want: { rich: 2, filling: 2 },
    negated: { avoid: { rich: 2, filling: 2, indulgent: 1 }, want: { light: 1.2 } },
    notAdjective: 'not heavy',
  },
  {
    id: 'light',
    words: ['light', 'lightweight', 'easy', 'delicate', 'subtle', 'airy', 'low calorie', 'low cal', 'not too much'],
    want: { light: 3 },
    avoid: { rich: 1.5, filling: 1 },
    because: 'for something light',
  },
  {
    id: 'strong',
    words: ['strong', 'bold', 'intense', 'black', 'bitter', 'punchy', 'double', 'potent', 'hardcore', 'no nonsense', 'a hit', 'robust', 'dark roast'],
    want: { strong: 3, bitter: 1.5, energising: 0.5 },
    negated: { avoid: { strong: 2.5, bitter: 1 }, want: { mild: 2.5 } },
    notAdjective: 'not too strong',
  },
  {
    id: 'mild',
    words: ['mild', 'weak', 'weaker', 'easy drinking', 'not too strong', 'soft'],
    want: { mild: 3, smooth: 1 },
    avoid: { strong: 1.5 },
    because: 'for an easy sip',
  },
  {
    id: 'classic',
    words: ['classic', 'traditional', 'simple', 'plain', 'regular', 'normal', 'usual', 'standard', 'basic', 'original', 'proper coffee', 'just coffee', 'plain coffee', 'no frills'],
    want: { classic: 3 },
    because: 'if you want the real thing',
  },
  {
    id: 'fruity',
    words: ['fruit', 'fruity', 'fruits', 'berry', 'berries', 'citrus', 'lemon', 'lime', 'passionfruit', 'pineapple', 'banana', 'mango', 'strawberry', 'juice', 'juicy'],
    want: { fruity: 3 },
  },
  {
    id: 'tropical',
    words: ['tropical', 'island', 'holiday', 'vacation', 'coconut', 'colada'],
    want: { tropical: 3, refreshing: 1 },
  },
  {
    id: 'tart',
    words: ['tart', 'tangy', 'sour', 'zesty', 'zingy', 'tang'],
    want: { tart: 3, refreshing: 1 },
  },
  {
    id: 'floral',
    words: ['floral', 'flowers', 'flower', 'rose', 'lavender', 'saffron', 'perfume', 'aromatic', 'fragrant'],
    want: { floral: 3, fancy: 0.8 },
  },
  {
    id: 'nutty',
    words: ['nutty', 'nuts', 'nut', 'pistachio', 'peanut', 'hazelnut', 'peanut butter'],
    want: { nutty: 3 },
  },
  {
    id: 'chocolate',
    words: ['chocolate', 'chocolatey', 'cocoa', 'nutella', 'choc', 'mocha', 'cacao', 'chocolaty'],
    want: { chocolatey: 3, sweet: 1 },
  },
  {
    id: 'caramel',
    words: ['caramel', 'toffee', 'butterscotch', 'dulce de leche'],
    want: { caramel: 3, sweet: 1 },
  },

  // ---- Body and diet ----
  {
    id: 'refreshing',
    words: ['refresh', 'refreshing', 'refreshed', 'thirsty', 'quench', 'cooling', 'cool down', 'cool off', 'revive', 'crisp', 'fresh'],
    want: { refreshing: 3, iced: 1 },
    because: 'to cool you down',
  },
  {
    id: 'healthy',
    words: ['healthy', 'health', 'clean', 'natural', 'detox', 'wholesome', 'vitamins', 'nutritious', 'green', 'guilt free', 'diet', 'fitness', 'wellness', 'good for me'],
    want: { healthy: 3, fruity: 1 },
    because: 'for something good for you',
  },
  {
    id: 'gym',
    words: ['gym', 'workout', 'post workout', 'after the gym', 'training', 'protein', 'gains', 'muscle', 'after my run', 'after a run', 'runner', 'marathon', 'sports'],
    want: { protein: 3, healthy: 1.5, filling: 1.5 },
    because: 'after a workout',
  },
  {
    id: 'hungry',
    words: [
      'hungry', 'starving', 'famished', 'snack', 'bite', 'eat', 'food', 'meal', 'breakfast', 'brunch', 'lunch', 'sandwich', 'muffin',
      'croissant', 'bakery', 'something to eat', 'peckish', 'munchies',
    ],
    want: { food: 3, filling: 2 },
    because: 'if you are hungry',
  },
  {
    id: 'savoury',
    words: ['savoury', 'savory', 'salty', 'cheesy', 'not sweet food'],
    want: { savoury: 3, food: 2 },
  },

  // ---- Drink types ----
  { id: 'coffee', words: ['coffee', 'espresso', 'latte', 'cappuccino', 'flat white', 'brew', 'java', 'americano', 'macchiato'], want: { coffee: 2 } },
  { id: 'filter', words: ['filter', 'pour over', 'v60', 'chemex', 'aeropress', 'drip', 'manual brew', 'single origin'], want: { filter: 3 } },
  { id: 'tea', words: ['tea', 'herbal', 'infusion', 'tisane', 'rooibos', 'hibiscus', 'green tea', 'black tea'], want: { tea: 3 } },
  { id: 'smoothie', words: ['smoothie', 'smoothies', 'blend', 'blended', 'acai'], want: { smoothie: 3 } },
  { id: 'milkshake', words: ['milkshake', 'milkshakes', 'shake', 'shakes', 'thick shake'], want: { milkshake: 3 } },

  // ---- Practical ----
  {
    id: 'quick',
    words: [
      'quick', 'fast', 'in a hurry', 'hurry', 'rush', 'running late', 'running late for class', 'late for class', 'on the go', 'grab and go', 'quickly', 'no time',
      'short on time', 'before class', 'between classes', 'asap',
    ],
    want: { quick: 3 },
    because: 'since you are short on time',
  },
  {
    id: 'cheap',
    words: ['cheap', 'cheaper', 'budget', 'affordable', 'broke', 'student budget', 'save money', 'inexpensive', 'bargain', 'low cost'],
    want: { cheap: 3 },
    because: 'to keep the bill low',
  },
]

/** Words that say "not". They flip a rule that follows them within the same clause. */
export const NEGATORS = new Set(['not', 'no', 'without', 'less', 'nothing', 'never', 'isnt', 'dont', 'arent', 'wont', 'nor', 'hardly', 'barely', 'zero', 'avoid'])

/** Small words that can sit between "not" and the word it negates: "not too sweet", "dont really want anything heavy". */
export const FILLERS = new Set(['too', 'very', 'so', 'that', 'really', 'overly', 'a', 'bit', 'little', 'much', 'as', 'quite', 'super', 'particularly', 'the', 'any', 'of', 'kind', 'sort', 'want', 'need', 'like', 'something', 'anything', 'thing'])

/** Where a negation stops: punctuation and these linking words. */
export const BREAKERS = new Set(['but', 'and', 'or', 'then', 'yet', 'plus', 'though', 'however', 'although', 'also', 'with'])

/** Words that never help find an item by name or description. */
export const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'you', 'your', 'are', 'was', 'its', 'have', 'has', 'had', 'but', 'not', 'need', 'want', 'like',
  'something', 'anything', 'some', 'any', 'can', 'could', 'would', 'should', 'please', 'give', 'get', 'got', 'make', 'feel', 'feeling', 'today',
  'really', 'very', 'too', 'bit', 'little', 'just', 'much', 'more', 'less', 'from', 'about', 'into', 'out', 'off', 'one', 'now', 'right', 'good',
  'drink', 'coffee', 'iced', 'hot', 'cold', 'cup', 'milk', 'bowl', 'day', 'ive', 'im', 'ill', 'dont', 'cant', 'wont', 'isnt',
  'when', 'where', 'how', 'who', 'why', 'because', 'since', 'been', 'being', 'does', 'did', 'doing', 'then', 'than', 'them', 'they', 'there', 'here',
  'morning', 'afternoon', 'evening', 'night', 'tonight', 'again', 'still', 'only', 'also', 'maybe', 'perhaps', 'kind', 'sort', 'type', 'way', 'let',
])

/** Category slugs and the traits every item in them has. */
export const CATEGORY_TRAITS: Record<string, string[]> = {
  'espresso-bar': ['coffee'],
  'manual-bar': ['coffee', 'filter'],
  tea: ['tea'],
  smoothies: ['smoothie'],
  'real-milkshakes': ['milkshake'],
}

/** Words that describe an item as a small adjective in the reason line. Tags not listed here are never named. */
export const ADJECTIVES: Record<string, string> = {
  hot: 'hot',
  iced: 'iced',
  sweet: 'sweet',
  creamy: 'creamy',
  strong: 'strong',
  bitter: 'bold',
  fruity: 'fruity',
  floral: 'floral',
  nutty: 'nutty',
  chocolatey: 'chocolatey',
  caramel: 'caramel',
  light: 'light',
  rich: 'rich',
  smooth: 'smooth',
  mild: 'mild',
  cozy: 'comforting',
  refreshing: 'refreshing',
  healthy: 'healthy',
  filling: 'filling',
  classic: 'classic',
  fancy: 'a little different',
  energising: 'energising',
  calming: 'calming',
  indulgent: 'indulgent',
  tropical: 'tropical',
  tart: 'tart',
  dessert: 'dessert-like',
  savoury: 'savoury',
  buttery: 'buttery',
}

/** A drink is quick when it takes this long or less to make. */
export const QUICK_PREP_SECONDS = 100
/** A drink is cheap when it costs this much or less (fils). */
export const CHEAP_PRICE_FILS = 2200
