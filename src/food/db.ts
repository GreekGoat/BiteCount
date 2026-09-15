import type { Food, FoodCat, QuestionKey, Serving } from './types'

/*
 * Nutrition per 100 g (or 100 ml) as [kcal, protein, carbs, fat].
 * Values are typical figures from USDA FoodData Central and common South Asian
 * food composition tables, rounded. Cooked dishes assume normal home recipes;
 * the follow-up questions adjust for oil, bones, sugar and portion.
 */

type N = [kcal: number, p: number, c: number, f: number]

interface Def {
  id: string
  n: string
  e: string
  cat: FoodCat
  m: N
  sv: Serving[]
  d?: number
  a?: string
  q?: QuestionKey[]
  liquid?: boolean
}

const s = (label: string, g: number, ...keys: string[]): Serving => ({ label, g, keys })

// Shared serving sets
const BOWL = [s('small bowl', 150, 'bowl', 'katori', 'cup'), s('medium bowl', 250, 'bowl', 'katori', 'serving', 'portion'), s('large bowl', 350, 'bowl')]
const MEAT_BOWL = [...BOWL, s('piece with gravy', 90, 'piece', 'pc', 'boti', 'leg')]
const PLATE = [s('cup', 160, 'cup'), s('small plate', 180, 'plate'), s('plate', 280, 'plate', 'serving', 'portion'), s('large plate', 400, 'plate')]
const DISH_PLATE = [s('small plate', 200, 'plate', 'bowl'), s('plate', 300, 'plate', 'bowl', 'serving', 'portion'), s('large plate', 450, 'plate')]
const SPOON = [s('tsp', 5, 'tsp', 'teaspoon'), s('tbsp', 14, 'tbsp', 'tablespoon', 'spoon')]
const HANDFUL = [s('handful', 28, 'handful', 'serving'), s('cup', 140, 'cup')]
const GLASS = [s('glass', 250, 'glass', 'cup'), s('small glass', 180, 'small'), s('large glass', 400, 'large', 'bottle')]
const SLICE_PIZZA = [s('slice', 107, 'slice', 'piece', 'pc'), s('personal pizza (4 slices)', 300, 'personal', 'small'), s('medium pizza (8 slices)', 650, 'medium', 'whole', 'pizza')]
const COFFEE_SIZES = [s('small', 350, 'small', 'tall', 'cup'), s('medium', 470, 'medium', 'grande', 'regular'), s('large', 590, 'large', 'venti')]

const MEAT_CURRY: QuestionKey[] = ['style', 'ratio', 'bone', 'sides']
const CURRY: QuestionKey[] = ['style', 'sides']

const DEFS: Def[] = [
  // ── Curries & gravies ───────────────────────────────────────────────
  { id: 'chicken-curry', n: 'Chicken curry', e: '🍛', cat: 'curry', m: [150, 14, 4, 8.5], sv: MEAT_BOWL, d: 1, q: MEAT_CURRY, a: 'murgir jhol|murgir mangsho|murgi|chicken jhol|chicken masala|chicken gravy|chicken bhuna|murgh curry|chicken salan|desi chicken|chicken kosha|chicken kassa' },
  { id: 'butter-chicken', n: 'Butter chicken', e: '🍛', cat: 'curry', m: [190, 13, 6, 12.5], sv: MEAT_BOWL, d: 1, q: ['style', 'ratio', 'sides'], a: 'murgh makhani|chicken makhani|makhani chicken' },
  { id: 'chicken-tikka-masala', n: 'Chicken tikka masala', e: '🍛', cat: 'curry', m: [160, 13, 7, 9], sv: MEAT_BOWL, d: 1, q: ['style', 'ratio', 'sides'], a: 'tikka masala|ctm' },
  { id: 'chicken-korma', n: 'Chicken korma', e: '🍛', cat: 'curry', m: [200, 13, 7, 13.5], sv: MEAT_BOWL, d: 1, q: MEAT_CURRY, a: 'korma|murgh korma|chicken rezala|rezala|white chicken curry' },
  { id: 'chicken-roast', n: 'Chicken roast (Bengali style)', e: '🍗', cat: 'curry', m: [220, 17, 6, 14], sv: MEAT_BOWL, d: 3, q: ['style', 'bone', 'sides'], a: 'murgir roast|biye bari roast|wedding roast|chicken rost' },
  { id: 'beef-curry', n: 'Beef curry', e: '🥘', cat: 'curry', m: [190, 15, 4, 12.5], sv: MEAT_BOWL, d: 1, q: MEAT_CURRY, a: 'gorur mangsho|gorur gosht|beef bhuna|beef masala|beef salan|kala bhuna|beef kala bhuna|beef stew|beef rezala|gosht' },
  { id: 'mutton-curry', n: 'Mutton curry', e: '🥘', cat: 'curry', m: [180, 15, 4, 11.5], sv: MEAT_BOWL, d: 1, q: MEAT_CURRY, a: 'khasir mangsho|goat curry|lamb curry|mutton masala|rogan josh|mutton bhuna|lamb stew|goat meat' },
  { id: 'keema', n: 'Keema curry', e: '🥘', cat: 'curry', m: [210, 15, 5, 14.5], sv: BOWL, d: 0, q: ['style', 'sides'], a: 'qeema|kima|mince curry|keema matar|chicken keema|beef keema|kheema' },
  { id: 'nihari', n: 'Nihari', e: '🥘', cat: 'curry', m: [160, 12, 3, 11], sv: MEAT_BOWL, d: 1, q: ['style', 'bone', 'sides'], a: 'nehari|paya' },
  { id: 'haleem', n: 'Haleem', e: '🥣', cat: 'curry', m: [130, 8, 12, 5.5], sv: BOWL, d: 1, q: ['style'], a: 'halim|daleem|khichra' },
  { id: 'fish-curry', n: 'Fish curry', e: '🐟', cat: 'curry', m: [120, 12.5, 4, 6], sv: MEAT_BOWL, d: 3, q: ['style', 'bone', 'sides'], a: 'macher jhol|macher tarkari|maach|mach|rui curry|rohu curry|fish jhol|fish masala|macher kalia|fish bhuna|shorshe mach|mustard fish|fish stew' },
  { id: 'prawn-curry', n: 'Prawn curry', e: '🦐', cat: 'curry', m: [130, 13, 5, 6.5], sv: BOWL, d: 0, q: CURRY, a: 'chingri|chingri malaikari|malai prawn|shrimp curry|chingri bhuna|prawn masala' },
  { id: 'egg-curry', n: 'Egg curry', e: '🥚', cat: 'curry', m: [145, 8, 5, 10.5], sv: [s('egg with gravy', 130, 'egg', 'piece', 'pc'), s('2 eggs with gravy', 250, 'bowl', 'serving', 'portion'), s('3 eggs with gravy', 370)], d: 0, q: CURRY, a: 'dimer curry|dim curry|dim bhuna|dimer jhol|anda curry|egg masala|egg bhuna|anda masala' },
  { id: 'paneer-butter-masala', n: 'Paneer butter masala', e: '🧀', cat: 'curry', m: [250, 9, 8, 20], sv: BOWL, d: 0, q: CURRY, a: 'paneer makhani|shahi paneer|kadai paneer|paneer masala|paneer curry|matar paneer' },
  { id: 'palak-paneer', n: 'Palak paneer', e: '🥬', cat: 'curry', m: [170, 8, 6, 12.5], sv: BOWL, d: 0, q: CURRY, a: 'saag paneer|spinach paneer' },
  { id: 'veg-curry', n: 'Mixed vegetable curry', e: '🥕', cat: 'curry', m: [95, 2.5, 9, 5.5], sv: BOWL, d: 0, q: CURRY, a: 'sabzi|sabji|veg curry|labra|niramish|torkari|tarkari|mixed veg|vegetable curry|shobji|sobji|veg korma|ghonto' },
  { id: 'aloo-curry', n: 'Potato curry', e: '🥔', cat: 'curry', m: [110, 2, 14, 5], sv: BOWL, d: 0, q: CURRY, a: 'aloo curry|alu curry|aloo sabzi|alur dom|dum aloo|aloo bhaji|alu bhaji|aloo gobi|alu fulkopi' },
  { id: 'chana-masala', n: 'Chana masala', e: '🫘', cat: 'curry', m: [140, 6, 18, 5], sv: BOWL, d: 0, q: CURRY, a: 'chole|chhole|chickpea curry|chana curry|cholar ghugni|ghugni|boot bhuna' },
  { id: 'rajma', n: 'Rajma (kidney bean curry)', e: '🫘', cat: 'curry', m: [130, 6, 17, 4], sv: BOWL, d: 0, q: CURRY, a: 'kidney bean curry|rajma masala|rajma chawal|bean curry' },
  { id: 'thai-curry', n: 'Thai green / red curry', e: '🍲', cat: 'curry', m: [140, 9, 5, 9.5], sv: BOWL, d: 1, q: ['style', 'sides'], a: 'green curry|red curry|thai curry|massaman|panang curry|coconut curry' },
  { id: 'shak', n: 'Leafy greens stir-fry (shak)', e: '🥬', cat: 'veg', m: [70, 3, 6, 4], sv: BOWL, d: 0, q: ['style'], a: 'shak|shaak|saag|lal shak|pui shak|palong shak|data shak|spinach stir fry|greens|leafy greens|spinach' },
  { id: 'bhorta', n: 'Bhorta / mash', e: '🥔', cat: 'veg', m: [130, 2, 16, 6.5], sv: [s('scoop', 60, 'scoop', 'spoon', 'ball'), s('small bowl', 100, 'bowl', 'katori')], q: ['style'], a: 'aloo bhorta|alu bhorta|aloo chokha|begun bhorta|baingan bharta|shutki bhorta|mashed' },
  { id: 'begun-bhaja', n: 'Fried eggplant (begun bhaja)', e: '🍆', cat: 'veg', m: [150, 1.5, 9, 12], sv: [s('slice', 40, 'slice', 'piece', 'pc')], a: 'begun bhaja|brinjal fry|eggplant fry|baingan fry' },
  { id: 'bhindi', n: 'Okra fry (bhindi)', e: '🥒', cat: 'veg', m: [120, 2, 9, 9], sv: BOWL, q: ['style'], a: 'bhindi|bhindi masala|dherosh bhaji|dherosh|ladies finger|okra' },

  // ── Dal & lentils ──────────────────────────────────────────────────
  { id: 'dal', n: 'Dal (lentil curry)', e: '🥣', cat: 'dal', m: [105, 5.5, 13, 3.5], sv: [...BOWL, s('cup', 200, 'cup')], d: 0, q: CURRY, a: 'daal|dhal|dal tadka|dal fry|masoor dal|musur dal|moong dal|mug dal|toor dal|arhar dal|chana dal|lentil curry|lentil|lentils|pappu|patla dal|dal bhuna' },
  { id: 'dal-makhani', n: 'Dal makhani', e: '🥣', cat: 'dal', m: [150, 6, 14, 8], sv: BOWL, d: 0, q: CURRY, a: 'dal makhni|maa ki dal|black dal' },
  { id: 'sambar', n: 'Sambar', e: '🥣', cat: 'dal', m: [60, 2.8, 8, 2], sv: BOWL, d: 0, a: 'sambhar|saambar' },
  { id: 'khichdi', n: 'Khichdi / khichuri', e: '🍲', cat: 'rice', m: [120, 4.5, 18, 3.5], sv: PLATE, d: 1, q: ['style', 'ghee'], a: 'khichuri|kitchari|khichri|bhuna khichuri|pongal|dal khichdi' },
  { id: 'lentils-boiled', n: 'Lentils (boiled)', e: '🫘', cat: 'dal', m: [116, 9, 20, 0.4], sv: [s('cup', 198, 'cup'), s('half cup', 99, 'half')], a: 'boiled lentils|plain lentils' },
  { id: 'chickpeas', n: 'Chickpeas (boiled)', e: '🫘', cat: 'dal', m: [164, 8.9, 27.4, 2.6], sv: [s('cup', 164, 'cup'), s('half cup', 82, 'half')], a: 'kabuli chana|garbanzo|boiled chana|chana boiled|chickpea' },
  { id: 'beans', n: 'Beans (boiled)', e: '🫘', cat: 'dal', m: [127, 8.7, 22.8, 0.5], sv: [s('cup', 177, 'cup'), s('half cup', 88, 'half')], a: 'black beans|kidney beans|pinto beans|red beans' },
  { id: 'baked-beans', n: 'Baked beans', e: '🫘', cat: 'dal', m: [85, 4.7, 14, 0.4], sv: [s('half can', 200, 'can', 'half'), s('cup', 250, 'cup')], a: 'heinz beans|beans on toast' },

  // ── Rice & rice dishes ─────────────────────────────────────────────
  { id: 'white-rice', n: 'White rice', e: '🍚', cat: 'rice', m: [130, 2.7, 28.2, 0.3], sv: PLATE, d: 0, q: ['ghee'], a: 'rice|bhat|bhaat|chawal|chaval|plain rice|steamed rice|boiled rice|sada bhat|sticky rice|jasmine rice|cooked rice' },
  { id: 'brown-rice', n: 'Brown rice', e: '🍚', cat: 'rice', m: [112, 2.3, 23.5, 0.8], sv: PLATE, d: 0, q: ['ghee'], a: 'red rice|lal chal|whole grain rice' },
  { id: 'basmati-rice', n: 'Basmati rice', e: '🍚', cat: 'rice', m: [121, 3.5, 25.2, 0.4], sv: PLATE, d: 0, q: ['ghee'], a: 'basmati|jeera rice|zeera rice|kalijira|chinigura' },
  { id: 'fried-rice', n: 'Fried rice', e: '🍳', cat: 'rice', m: [174, 4.5, 26, 5.8], sv: DISH_PLATE, d: 1, q: ['style'], a: 'egg fried rice|chicken fried rice|chinese fried rice|veg fried rice|nasi goreng|thai fried rice|shrimp fried rice' },
  { id: 'chicken-biryani', n: 'Chicken biryani', e: '🍛', cat: 'rice', m: [180, 8.5, 20, 7], sv: DISH_PLATE, d: 1, q: ['style', 'bone'], a: 'biryani|biriyani|chicken biriyani|dum biryani|hyderabadi biryani|chicken dum biryani|murgh biryani' },
  { id: 'mutton-biryani', n: 'Kacchi / mutton biryani', e: '🍛', cat: 'rice', m: [210, 9, 20, 10.5], sv: DISH_PLATE, d: 1, q: ['style', 'bone'], a: 'kacchi|kacchi biryani|kachchi|mutton biriyani|beef biryani|lamb biryani|goat biryani|khashi biryani' },
  { id: 'veg-biryani', n: 'Vegetable biryani', e: '🍛', cat: 'rice', m: [150, 3.5, 22, 5.5], sv: DISH_PLATE, d: 1, q: ['style'], a: 'veg biryani|vegetable biriyani|paneer biryani' },
  { id: 'tehari', n: 'Tehari', e: '🍛', cat: 'rice', m: [190, 8, 21, 8], sv: DISH_PLATE, d: 1, q: ['style'], a: 'beef tehari|tehri|tahari' },
  { id: 'polao', n: 'Pulao / polao', e: '🍚', cat: 'rice', m: [160, 3, 25, 5.5], sv: PLATE, d: 1, q: ['style'], a: 'pulao|pilaf|pilau|polau|pulav|ghee rice|plain polao' },
  { id: 'morog-polao', n: 'Chicken pulao (morog polao)', e: '🍛', cat: 'rice', m: [185, 9, 20, 7.5], sv: DISH_PLATE, d: 1, q: ['style', 'bone'], a: 'morog polao|chicken polao|chicken pulao|yakhni pulao' },
  { id: 'bibimbap', n: 'Bibimbap', e: '🍲', cat: 'rice', m: [150, 6.5, 22, 4], sv: [s('bowl', 450, 'bowl', 'serving')], a: 'korean rice bowl' },
  { id: 'rice-bowl', n: 'Chicken rice bowl', e: '🥙', cat: 'rice', m: [150, 10, 18, 4], sv: [s('bowl', 450, 'bowl', 'serving'), s('large bowl', 600, 'large')], q: ['style'], a: 'rice bowl|burrito bowl|poke bowl|chipotle bowl|teriyaki bowl|chicken bowl|grain bowl' },
  { id: 'sushi-roll', n: 'Sushi roll', e: '🍣', cat: 'rice', m: [140, 4.5, 20, 4.5], sv: [s('piece', 30, 'piece', 'pc', 'roll piece'), s('roll (8 pieces)', 240, 'roll')], a: 'sushi|california roll|maki|uramaki|salmon roll|tuna roll|dragon roll' },
  { id: 'nigiri', n: 'Nigiri sushi', e: '🍣', cat: 'rice', m: [160, 8.5, 24, 3.5], sv: [s('piece', 35, 'piece', 'pc')], a: 'salmon nigiri|tuna nigiri|sashimi rice' },
  { id: 'risotto', n: 'Risotto', e: '🍚', cat: 'rice', m: [150, 4, 20, 6], sv: DISH_PLATE, d: 1, q: ['style'], a: 'mushroom risotto|chicken risotto' },

  // ── South Indian & breakfast staples ───────────────────────────────
  { id: 'idli', n: 'Idli', e: '🍘', cat: 'breakfast', m: [146, 4.5, 30, 0.6], sv: [s('idli', 40, 'piece', 'pc', 'idli')], a: 'idly|rice cake idli' },
  { id: 'dosa', n: 'Plain dosa', e: '🫓', cat: 'breakfast', m: [168, 3.9, 29, 3.7], sv: [s('dosa', 100, 'piece', 'pc', 'dosa')], a: 'dosai|sada dosa|paper dosa' },
  { id: 'masala-dosa', n: 'Masala dosa', e: '🫓', cat: 'breakfast', m: [180, 3.5, 26, 7], sv: [s('masala dosa', 220, 'piece', 'pc', 'dosa')], a: 'mysore masala dosa|ghee roast dosa' },
  { id: 'upma', n: 'Upma', e: '🥣', cat: 'breakfast', m: [130, 3, 18, 5], sv: [s('small bowl', 150, 'bowl'), s('bowl', 220, 'bowl', 'plate', 'serving')], d: 1, a: 'uppma|suji upma|rava upma' },
  { id: 'poha', n: 'Poha', e: '🥣', cat: 'breakfast', m: [158, 3, 25, 5], sv: [s('small bowl', 150, 'bowl'), s('plate', 220, 'plate', 'bowl', 'serving')], d: 1, a: 'aval|chira|chire|flattened rice|kanda poha' },
  { id: 'egg-paratha', n: 'Egg paratha / Mughlai', e: '🫓', cat: 'bread', m: [280, 10, 28, 14.5], sv: [s('piece', 150, 'piece', 'paratha', 'pc')], a: 'dim porota|mughlai paratha|mughlai porota|anda paratha|egg roll paratha|baida roti' },

  // ── Breads ─────────────────────────────────────────────────────────
  { id: 'roti', n: 'Roti / chapati', e: '🫓', cat: 'bread', m: [264, 9.6, 50, 3.7], sv: [s('roti', 40, 'roti', 'chapati', 'piece', 'pc'), s('large roti', 60, 'large')], q: ['spread'], a: 'chapati|chapatti|ruti|phulka|fulka|atta roti|tandoori roti|rooti|whole wheat roti' },
  { id: 'paratha', n: 'Paratha', e: '🫓', cat: 'bread', m: [326, 6.4, 45, 13], sv: [s('paratha', 80, 'paratha', 'piece', 'pc'), s('large paratha', 120, 'large')], q: ['spread'], a: 'porota|parota|porata|parotta|lachha paratha|laccha paratha|plain paratha|malabar parotta' },
  { id: 'aloo-paratha', n: 'Aloo paratha', e: '🫓', cat: 'bread', m: [247, 5.5, 33, 10.5], sv: [s('paratha', 130, 'paratha', 'piece', 'pc')], q: ['spread'], a: 'alu porota|stuffed paratha|aloo parantha|gobi paratha|paneer paratha' },
  { id: 'naan', n: 'Naan', e: '🫓', cat: 'bread', m: [290, 9, 50.5, 5.6], sv: [s('naan', 90, 'naan', 'piece', 'pc'), s('large naan', 130, 'large')], q: ['spread'], a: 'nan|plain naan|tandoori naan|kulcha' },
  { id: 'butter-naan', n: 'Butter / garlic naan', e: '🫓', cat: 'bread', m: [320, 8.5, 49, 10], sv: [s('naan', 95, 'naan', 'piece', 'pc'), s('large naan', 140, 'large')], a: 'garlic naan|butter nan|cheese naan|peshwari naan' },
  { id: 'puri', n: 'Puri / luchi', e: '🫓', cat: 'bread', m: [357, 7, 43, 17.5], sv: [s('puri', 28, 'puri', 'luchi', 'piece', 'pc')], a: 'poori|luchi|loochi|kochuri' },
  { id: 'bhatura', n: 'Bhatura', e: '🫓', cat: 'bread', m: [330, 7.5, 45, 13.5], sv: [s('bhatura', 80, 'piece', 'pc', 'bhatura')], a: 'bhature|chole bhature' },
  { id: 'white-bread', n: 'White bread', e: '🍞', cat: 'bread', m: [265, 9, 49, 3.2], sv: [s('slice', 28, 'slice', 'piece', 'toast')], q: ['spread'], a: 'bread|toast|sandwich bread|pauruti|pau ruti|white toast|sliced bread' },
  { id: 'brown-bread', n: 'Whole wheat bread', e: '🍞', cat: 'bread', m: [252, 12.5, 43, 3.5], sv: [s('slice', 32, 'slice', 'piece', 'toast')], q: ['spread'], a: 'brown bread|wholemeal bread|multigrain bread|whole grain bread|brown toast|sourdough' },
  { id: 'bun', n: 'Bun / pav', e: '🥯', cat: 'bread', m: [280, 9, 50, 4.5], sv: [s('bun', 60, 'bun', 'pav', 'roll', 'piece')], q: ['spread'], a: 'pav|dinner roll|bread roll|burger bun|hot dog bun' },
  { id: 'bagel', n: 'Bagel', e: '🥯', cat: 'bread', m: [257, 10, 50, 1.6], sv: [s('bagel', 100, 'bagel', 'piece')], q: ['spread'], a: 'plain bagel|everything bagel' },
  { id: 'croissant', n: 'Croissant', e: '🥐', cat: 'bread', m: [406, 8.2, 45.8, 21], sv: [s('croissant', 57, 'croissant', 'piece'), s('large croissant', 80, 'large')], q: ['spread'], a: 'butter croissant|chocolate croissant|pain au chocolat' },
  { id: 'tortilla', n: 'Tortilla / wrap', e: '🫓', cat: 'bread', m: [306, 8.5, 50, 8], sv: [s('wrap', 60, 'wrap', 'tortilla', 'piece')], a: 'flour tortilla|wrap bread|tortilla wrap' },
  { id: 'pita', n: 'Pita bread', e: '🫓', cat: 'bread', m: [275, 9.1, 55.7, 1.2], sv: [s('pita', 60, 'pita', 'piece')], a: 'pita|khubz|lebanese bread' },
  { id: 'garlic-bread', n: 'Garlic bread', e: '🥖', cat: 'bread', m: [350, 8, 43, 16], sv: [s('slice', 35, 'slice', 'piece', 'pc')], a: 'garlic toast|cheesy garlic bread' },

  // ── Noodles & pasta ────────────────────────────────────────────────
  { id: 'pasta', n: 'Pasta (plain, cooked)', e: '🍝', cat: 'noodles', m: [158, 5.8, 31, 0.9], sv: [s('cup', 140, 'cup'), s('plate', 250, 'plate', 'bowl', 'serving')], a: 'spaghetti|penne|macaroni|fusilli|plain pasta|boiled pasta|noodles plain' },
  { id: 'spaghetti-bolognese', n: 'Spaghetti bolognese', e: '🍝', cat: 'noodles', m: [140, 7, 17, 5], sv: [s('small plate', 250, 'plate', 'bowl'), s('plate', 350, 'plate', 'bowl', 'serving'), s('large plate', 450, 'large')], d: 1, q: ['style'], a: 'bolognese|spag bol|meat sauce pasta|pasta with meat sauce|meatball spaghetti' },
  { id: 'creamy-pasta', n: 'Creamy pasta (alfredo)', e: '🍝', cat: 'noodles', m: [190, 6, 20, 9.5], sv: [s('small plate', 250, 'plate', 'bowl'), s('plate', 350, 'plate', 'bowl', 'serving'), s('large plate', 450, 'large')], d: 1, q: ['style'], a: 'alfredo|white sauce pasta|carbonara|fettuccine alfredo|chicken alfredo|cheesy pasta' },
  { id: 'tomato-pasta', n: 'Tomato pasta', e: '🍝', cat: 'noodles', m: [130, 4.5, 21, 3.5], sv: [s('small plate', 250, 'plate', 'bowl'), s('plate', 350, 'plate', 'bowl', 'serving'), s('large plate', 450, 'large')], d: 1, q: ['style'], a: 'arrabbiata|arrabiata|marinara pasta|red sauce pasta|pomodoro|napoli pasta|pasta' },
  { id: 'mac-cheese', n: 'Mac and cheese', e: '🧀', cat: 'noodles', m: [164, 6.5, 19.5, 6.8], sv: [s('cup', 200, 'cup'), s('bowl', 300, 'bowl', 'serving')], a: 'mac n cheese|macaroni and cheese|macaroni cheese|mac & cheese' },
  { id: 'lasagna', n: 'Lasagna', e: '🍝', cat: 'noodles', m: [150, 8.6, 13, 7], sv: [s('piece', 250, 'piece', 'slice', 'square', 'serving')], a: 'lasagne|beef lasagna|chicken lasagna' },
  { id: 'instant-noodles', n: 'Instant noodles', e: '🍜', cat: 'noodles', m: [440, 9, 62, 17], sv: [s('pack', 75, 'pack', 'packet', 'cup', 'maggi'), s('large pack', 120, 'large')], a: 'maggi|cup noodles|indomie|mama noodles|top ramen|koka noodles|ramen noodles|nissin|shin ramyun' },
  { id: 'chow-mein', n: 'Chow mein / hakka noodles', e: '🍜', cat: 'noodles', m: [150, 7, 18, 5.5], sv: DISH_PLATE, d: 1, q: ['style'], a: 'chowmein|hakka noodles|chicken chow mein|lo mein|stir fry noodles|noodles|egg noodles|veg noodles|chicken noodles|thai noodles' },
  { id: 'pad-thai', n: 'Pad thai', e: '🍜', cat: 'noodles', m: [170, 7.5, 22, 6], sv: [s('plate', 350, 'plate', 'serving', 'bowl')], q: ['style'], a: 'phad thai|pad see ew' },
  { id: 'ramen', n: 'Ramen (restaurant bowl)', e: '🍜', cat: 'noodles', m: [80, 4, 9, 3.2], sv: [s('bowl', 650, 'bowl', 'serving')], a: 'tonkotsu ramen|shoyu ramen|miso ramen|ramen bowl|udon|laksa' },
  { id: 'pho', n: 'Pho', e: '🍜', cat: 'noodles', m: [55, 4, 6.5, 1.5], sv: [s('bowl', 700, 'bowl', 'serving'), s('small bowl', 500, 'small')], a: 'pho bo|beef pho|chicken pho|pho ga' },

  // ── Meat, fish & protein ───────────────────────────────────────────
  { id: 'chicken-breast', n: 'Grilled chicken breast', e: '🍗', cat: 'protein', m: [165, 31, 0, 3.6], sv: [s('100 g', 100), s('breast', 170, 'breast', 'fillet'), s('palm-sized piece', 120, 'piece', 'pc')], d: 1, q: ['method'], a: 'chicken breast|grilled chicken|boiled chicken|chicken fillet|chicken|baked chicken|chicken steak|air fried chicken' },
  { id: 'chicken-thigh', n: 'Chicken thigh / leg (cooked)', e: '🍗', cat: 'protein', m: [179, 24.8, 0, 8.2], sv: [s('thigh', 100, 'thigh', 'piece'), s('drumstick', 75, 'drumstick', 'leg')], q: ['method'], a: 'chicken leg|drumstick|chicken drumstick|chicken thighs|leg piece' },
  { id: 'roast-chicken', n: 'Roast / rotisserie chicken', e: '🍗', cat: 'protein', m: [190, 25, 0, 10], sv: [s('piece', 120, 'piece', 'pc'), s('quarter chicken', 250, 'quarter'), s('half chicken', 500, 'half')], a: 'rotisserie chicken|roasted chicken|whole chicken|grill chicken|chicken grill|peri peri chicken|nandos' },
  { id: 'fried-chicken', n: 'Fried chicken', e: '🍗', cat: 'protein', m: [260, 20, 9, 16], sv: [s('drumstick', 90, 'drumstick', 'leg'), s('thigh', 130, 'thigh'), s('breast piece', 160, 'breast'), s('wing', 50, 'wing'), s('piece', 110, 'piece', 'pc')], d: 4, a: 'kfc|crispy chicken|broast|chicken fry|fried chicken piece|chicken broast|southern fried chicken|popeyes' },
  { id: 'nuggets', n: 'Chicken nuggets', e: '🍗', cat: 'fastfood', m: [296, 15, 17, 18.5], sv: [s('nugget', 18, 'nugget', 'piece', 'pc'), s('tender / strip', 45, 'strip', 'tender')], a: 'nuggets|mcnuggets|chicken tenders|chicken strips|chicken popcorn|popcorn chicken|chicken fingers' },
  { id: 'wings', n: 'Chicken wings', e: '🍗', cat: 'protein', m: [260, 24, 1, 18], sv: [s('wing', 35, 'wing', 'piece', 'pc')], a: 'buffalo wings|hot wings|bbq wings|wings|spicy wings|honey wings' },
  { id: 'chicken-tikka', n: 'Chicken tikka / kebab', e: '🍢', cat: 'protein', m: [150, 25, 3, 4.5], sv: [s('piece', 30, 'piece', 'pc', 'boti'), s('portion (6 pieces)', 180, 'portion', 'plate', 'serving', 'skewer')], a: 'tikka|reshmi kebab|chicken kebab|chicken kabab|chicken boti|malai tikka|grilled chicken tikka|chicken skewer' },
  { id: 'tandoori-chicken', n: 'Tandoori chicken', e: '🍗', cat: 'protein', m: [160, 25, 2, 6], sv: [s('leg quarter', 180, 'leg', 'quarter', 'piece'), s('half chicken', 350, 'half')], a: 'tandoori|tangri kebab|chicken tandoori' },
  { id: 'seekh-kebab', n: 'Seekh / shami kebab', e: '🍢', cat: 'protein', m: [230, 17, 4, 16], sv: [s('kebab', 45, 'seekh', 'piece', 'skewer', 'pc', 'kebab')], a: 'sheek kebab|kabab|kofta|shami kebab|shami kabab|beef kebab|mutton kebab|galouti|chapli kebab|shikh kabab' },
  { id: 'shawarma', n: 'Chicken shawarma wrap', e: '🌯', cat: 'fastfood', m: [220, 12, 22, 9.5], sv: [s('wrap', 300, 'wrap', 'roll', 'piece'), s('plate', 400, 'plate')], q: ['extras'], a: 'shawarma|shwarma|doner|doner kebab|gyro|kathi roll|chicken roll|frankie|chicken wrap|beef shawarma' },
  { id: 'beef-steak', n: 'Beef steak', e: '🥩', cat: 'protein', m: [250, 26, 0, 16], sv: [s('100 g', 100), s('steak', 170, 'steak', 'piece'), s('large steak', 300, 'large')], d: 1, a: 'steak|sirloin|ribeye|rib eye|t bone|tenderloin|beef|grilled beef' },
  { id: 'ground-beef', n: 'Beef mince (cooked)', e: '🥩', cat: 'protein', m: [254, 25.8, 0, 16.5], sv: [s('100 g', 100), s('cup', 140, 'cup')], a: 'minced beef|ground beef|beef mince|mince|burger patty|beef patty' },
  { id: 'lamb-chops', n: 'Lamb chops', e: '🍖', cat: 'protein', m: [290, 25, 0, 21], sv: [s('chop', 50, 'chop', 'piece', 'pc')], a: 'mutton chops|lamb chop|grilled lamb|lamb' },
  { id: 'meatballs', n: 'Meatballs', e: '🧆', cat: 'protein', m: [220, 14, 7, 15], sv: [s('meatball', 30, 'meatball', 'ball', 'piece', 'pc')], a: 'kofta balls|beef meatballs|swedish meatballs' },
  { id: 'bacon', n: 'Bacon', e: '🥓', cat: 'protein', m: [541, 37, 1.4, 42], sv: [s('slice', 8, 'slice', 'strip', 'rasher', 'piece')], a: 'bacon strips|crispy bacon|beef bacon|turkey bacon' },
  { id: 'sausage', n: 'Sausage', e: '🌭', cat: 'protein', m: [300, 12, 2, 27], sv: [s('sausage', 45, 'sausage', 'link', 'piece', 'pc')], a: 'frankfurter|chicken sausage|beef sausage|pork sausage|hot dog sausage|salami|pepperoni slices' },
  { id: 'salmon', n: 'Salmon (cooked)', e: '🐟', cat: 'protein', m: [206, 22, 0, 12.3], sv: [s('fillet', 150, 'fillet', 'piece', 'steak'), s('100 g', 100)], q: ['method'], a: 'grilled salmon|baked salmon|salmon fillet|smoked salmon' },
  { id: 'tuna', n: 'Tuna (canned in water)', e: '🐟', cat: 'protein', m: [116, 25.5, 0, 0.8], sv: [s('can (drained)', 120, 'can', 'tin'), s('100 g', 100)], a: 'tuna|canned tuna|tuna chunks' },
  { id: 'fish-fry', n: 'Fish fry', e: '🐟', cat: 'protein', m: [200, 18, 4, 12.5], sv: [s('piece', 80, 'piece', 'pc', 'slice'), s('large piece', 130, 'large')], a: 'macher bhaja|mach bhaja|rui fry|fried fish|tilapia fry|pomfret fry|fish fingers|fish finger|koi mach|pangas fry' },
  { id: 'hilsa-fry', n: 'Hilsa (ilish)', e: '🐟', cat: 'protein', m: [300, 21, 2, 23], sv: [s('piece', 80, 'piece', 'pc')], q: ['bone'], a: 'ilish|ilish mach|hilsa|ilish bhaja|shorshe ilish|ilish paturi|hilsa fish' },
  { id: 'grilled-fish', n: 'Grilled / steamed fish', e: '🐟', cat: 'protein', m: [120, 22, 0, 3.5], sv: [s('fillet', 150, 'fillet', 'piece'), s('100 g', 100)], q: ['method', 'bone'], a: 'baked fish|steamed fish|rui|rohu|tilapia|pomfret|fish|boiled fish|cod|basa|rui mach|fish fillet' },
  { id: 'shrimp', n: 'Prawns / shrimp (cooked)', e: '🦐', cat: 'protein', m: [99, 24, 0.2, 0.3], sv: [s('100 g', 100), s('prawn', 15, 'prawn', 'shrimp', 'piece')], q: ['method'], a: 'shrimp|prawns|prawn|grilled prawns|garlic shrimp|chingri mach' },
  { id: 'tofu', n: 'Tofu', e: '🧊', cat: 'protein', m: [144, 17.3, 2.8, 8.7], sv: [s('100 g', 100), s('half block', 200, 'block', 'half')], q: ['method'], a: 'firm tofu|bean curd|silken tofu' },
  { id: 'paneer', n: 'Paneer', e: '🧀', cat: 'protein', m: [296, 18.3, 3.6, 23], sv: [s('cube', 15, 'cube', 'piece', 'pc'), s('100 g', 100), s('cup of cubes', 150, 'cup')], d: 1, q: ['method'], a: 'cottage cheese|chhena|chana cheese|panir' },
  { id: 'paneer-tikka', n: 'Paneer tikka', e: '🍢', cat: 'protein', m: [260, 16, 6, 19], sv: [s('piece', 30, 'piece', 'pc'), s('portion (6 pieces)', 180, 'portion', 'plate', 'serving')], d: 1, a: 'paneer kebab|tandoori paneer' },
  { id: 'soya-chunks', n: 'Soya chunks (cooked)', e: '🫘', cat: 'protein', m: [120, 17, 11, 0.5], sv: [s('cup', 150, 'cup'), s('100 g', 100)], q: ['style'], a: 'soya|nutrela|meal maker|soy chunks|soya bori|soybean chunks' },
  { id: 'falafel', n: 'Falafel', e: '🧆', cat: 'protein', m: [333, 13.3, 31.8, 17.8], sv: [s('falafel', 17, 'piece', 'ball', 'pc', 'falafel')], a: 'felafel|falafel balls' },
  { id: 'hummus', n: 'Hummus', e: '🫙', cat: 'condiment', m: [166, 7.9, 14.3, 9.6], sv: [s('tbsp', 15, 'tbsp', 'spoon'), s('quarter cup', 60, 'scoop', 'serving', 'cup')], d: 1, a: 'houmous|humus|chickpea dip' },

  // ── Eggs ───────────────────────────────────────────────────────────
  { id: 'egg', n: 'Egg', e: '🥚', cat: 'egg', m: [155, 12.6, 1.1, 10.6], sv: [s('egg', 50, 'egg', 'piece', 'pc', 'dim', 'anda'), s('large egg', 60, 'large')], q: ['method'], a: 'boiled egg|hard boiled egg|dim|anda|eggs|poached egg|dim sedho|deem|fried egg|dim bhaja|egg fry|sunny side up|half boil' },
  { id: 'omelette', n: 'Omelette', e: '🍳', cat: 'egg', m: [154, 10.6, 1.6, 11.7], sv: [s('1-egg omelette', 65, 'egg'), s('2-egg omelette', 120, 'omelette', 'omelet', 'piece'), s('3-egg omelette', 180)], d: 1, a: 'omelet|dim bhaji|masala omelette|cheese omelette|spanish omelette|dimer omelette|egg omelette' },
  { id: 'scrambled-eggs', n: 'Scrambled eggs', e: '🍳', cat: 'egg', m: [149, 10, 1.6, 11], sv: [s('1 egg', 60, 'egg'), s('2 eggs', 120, 'serving', 'plate'), s('3 eggs', 180)], d: 1, a: 'egg bhurji|anda bhurji|scrambled egg|dim bhurji|egg scramble' },
  { id: 'egg-white', n: 'Egg whites', e: '🥚', cat: 'egg', m: [52, 10.9, 0.7, 0.2], sv: [s('egg white', 33, 'white', 'egg', 'piece')], a: 'egg white|egg white omelette' },

  // ── Dairy ──────────────────────────────────────────────────────────
  { id: 'milk', n: 'Milk (whole)', e: '🥛', cat: 'dairy', m: [61, 3.2, 4.8, 3.3], sv: [s('glass', 250, 'glass'), s('cup', 240, 'cup', 'mug'), s('splash', 30, 'splash')], q: ['sugar'], liquid: true, a: 'full cream milk|doodh|dudh|whole milk|cow milk|warm milk|hot milk' },
  { id: 'milk-lowfat', n: 'Milk (low-fat)', e: '🥛', cat: 'dairy', m: [42, 3.4, 5, 1], sv: [s('glass', 250, 'glass'), s('cup', 240, 'cup', 'mug')], q: ['sugar'], liquid: true, a: 'skim milk|skimmed milk|toned milk|low fat milk|1% milk|2% milk|semi skimmed milk' },
  { id: 'oat-milk', n: 'Oat milk', e: '🥛', cat: 'dairy', m: [46, 1, 6.5, 1.5], sv: [s('glass', 250, 'glass'), s('cup', 240, 'cup')], liquid: true, a: 'oatly' },
  { id: 'almond-milk', n: 'Almond milk (unsweetened)', e: '🥛', cat: 'dairy', m: [15, 0.6, 0.3, 1.2], sv: [s('glass', 250, 'glass'), s('cup', 240, 'cup')], liquid: true, a: 'almond milk' },
  { id: 'soy-milk', n: 'Soy milk', e: '🥛', cat: 'dairy', m: [43, 3.3, 3, 1.8], sv: [s('glass', 250, 'glass'), s('cup', 240, 'cup')], liquid: true, a: 'soya milk|soymilk' },
  { id: 'yogurt', n: 'Yogurt (plain)', e: '🥣', cat: 'dairy', m: [61, 3.5, 4.7, 3.3], sv: [s('cup', 245, 'cup'), s('small bowl', 150, 'bowl', 'katori'), s('tbsp', 15, 'tbsp', 'spoon')], d: 1, q: ['sugar'], a: 'curd|doi|dahi|yoghurt|plain yogurt|tok doi|sour yogurt|natural yogurt' },
  { id: 'greek-yogurt', n: 'Greek yogurt', e: '🥣', cat: 'dairy', m: [73, 9.9, 3.9, 1.9], sv: [s('cup', 170, 'cup', 'tub', 'container'), s('small tub', 150, 'small')], a: 'greek yoghurt|hung curd|skyr|high protein yogurt' },
  { id: 'mishti-doi', n: 'Sweet yogurt (mishti doi)', e: '🍮', cat: 'dessert', m: [150, 3.5, 22, 5], sv: [s('small cup', 100, 'cup', 'bowl', 'small'), s('large cup', 200, 'large')], a: 'mishti doi|sweet curd|bogra doi|flavored yogurt|fruit yogurt|meethi dahi' },
  { id: 'cheese', n: 'Cheese (cheddar)', e: '🧀', cat: 'dairy', m: [403, 24.9, 1.3, 33], sv: [s('slice', 20, 'slice', 'piece'), s('cube', 15, 'cube'), s('30 g', 30)], a: 'cheddar|cheese slice|processed cheese|cheese' },
  { id: 'mozzarella', n: 'Mozzarella', e: '🧀', cat: 'dairy', m: [280, 22, 2, 20], sv: [s('30 g', 30, 'slice', 'piece'), s('ball', 125, 'ball')], a: 'mozzarella cheese|bocconcini|burrata' },
  { id: 'cream-cheese', n: 'Cream cheese', e: '🧀', cat: 'condiment', m: [342, 6, 4, 34], sv: [s('tbsp', 15, 'tbsp', 'spoon')], a: 'philadelphia|cheese spread' },

  // ── Fats, spreads & condiments ─────────────────────────────────────
  { id: 'butter', n: 'Butter', e: '🧈', cat: 'condiment', m: [717, 0.9, 0.1, 81], sv: SPOON, a: 'makhon|makhan|salted butter' },
  { id: 'ghee', n: 'Ghee', e: '🧈', cat: 'condiment', m: [900, 0, 0, 100], sv: SPOON, a: 'clarified butter|ghi|desi ghee' },
  { id: 'oil', n: 'Cooking oil', e: '🫒', cat: 'condiment', m: [884, 0, 0, 100], sv: [s('tsp', 4.5, 'tsp', 'teaspoon'), s('tbsp', 13.5, 'tbsp', 'tablespoon', 'spoon')], a: 'olive oil|mustard oil|sunflower oil|soybean oil|vegetable oil|coconut oil|tel|canola oil' },
  { id: 'mayo', n: 'Mayonnaise', e: '🫙', cat: 'condiment', m: [680, 1, 0.6, 75], sv: [s('tbsp', 14, 'tbsp', 'spoon'), s('tsp', 5, 'tsp')], a: 'mayo|garlic mayo|aioli|garlic sauce' },
  { id: 'ketchup', n: 'Ketchup', e: '🍅', cat: 'condiment', m: [101, 1, 25, 0.1], sv: [s('tbsp', 17, 'tbsp', 'spoon', 'packet')], a: 'tomato sauce|catsup|tomato ketchup' },
  { id: 'chutney', n: 'Chutney / sweet sauce', e: '🫙', cat: 'condiment', m: [120, 1, 28, 0.5], sv: [s('tbsp', 20, 'tbsp', 'spoon')], a: 'tamarind chutney|sweet chutney|bbq sauce|sweet chili sauce|tetul chutney|imli chutney|mango chutney|teriyaki sauce' },
  { id: 'peanut-butter', n: 'Peanut butter', e: '🥜', cat: 'condiment', m: [588, 25, 20, 50], sv: [s('tbsp', 16, 'tbsp', 'spoon'), s('tsp', 5, 'tsp')], a: 'pb|peanut spread|almond butter' },
  { id: 'honey', n: 'Honey', e: '🍯', cat: 'condiment', m: [304, 0.3, 82, 0], sv: [s('tsp', 7, 'tsp', 'teaspoon'), s('tbsp', 21, 'tbsp', 'spoon')], a: 'modhu|madhu|shahad|maple syrup|syrup' },
  { id: 'sugar', n: 'Sugar', e: '🍬', cat: 'condiment', m: [387, 0, 100, 0], sv: [s('tsp', 4, 'tsp', 'teaspoon', 'spoon', 'cube'), s('tbsp', 12, 'tbsp')], a: 'chini|cheeni|brown sugar|gur|jaggery' },
  { id: 'jam', n: 'Jam', e: '🍓', cat: 'condiment', m: [278, 0.4, 69, 0.1], sv: [s('tbsp', 20, 'tbsp', 'spoon'), s('tsp', 7, 'tsp')], a: 'jelly|marmalade|fruit jam' },
  { id: 'nutella', n: 'Nutella', e: '🍫', cat: 'condiment', m: [539, 6.3, 57.5, 31], sv: [s('tbsp', 19, 'tbsp', 'spoon')], a: 'chocolate spread|hazelnut spread' },
  { id: 'raita', n: 'Raita', e: '🥣', cat: 'condiment', m: [60, 2.8, 5, 3], sv: [s('small bowl', 100, 'bowl', 'katori', 'serving')], a: 'cucumber raita|boondi raita|tzatziki' },

  // ── Fruit ──────────────────────────────────────────────────────────
  { id: 'banana', n: 'Banana', e: '🍌', cat: 'fruit', m: [89, 1.1, 22.8, 0.3], sv: [s('small', 100, 'small'), s('medium', 118, 'banana', 'piece', 'medium'), s('large', 136, 'large')], d: 1, a: 'kola|kela|bananas' },
  { id: 'apple', n: 'Apple', e: '🍎', cat: 'fruit', m: [52, 0.3, 13.8, 0.2], sv: [s('small', 150, 'small'), s('medium', 182, 'apple', 'piece', 'medium'), s('large', 220, 'large')], d: 1, a: 'apel|green apple' },
  { id: 'orange', n: 'Orange', e: '🍊', cat: 'fruit', m: [47, 0.9, 11.8, 0.1], sv: [s('orange', 131, 'orange', 'piece')], a: 'komola|malta|tangerine|mandarin|kinnow|clementine' },
  { id: 'mango', n: 'Mango', e: '🥭', cat: 'fruit', m: [60, 0.8, 15, 0.4], sv: [s('cup sliced', 165, 'cup'), s('small mango', 150, 'small'), s('large mango', 300, 'mango', 'piece', 'large')], d: 1, a: 'aam|am|mangoes' },
  { id: 'grapes', n: 'Grapes', e: '🍇', cat: 'fruit', m: [69, 0.7, 18, 0.2], sv: [s('cup', 151, 'cup', 'bowl'), s('handful', 50, 'handful'), s('grape', 5, 'grape', 'piece')], a: 'angur|green grapes|black grapes' },
  { id: 'watermelon', n: 'Watermelon', e: '🍉', cat: 'fruit', m: [30, 0.6, 7.6, 0.2], sv: [s('cup', 152, 'cup', 'bowl'), s('slice', 280, 'slice', 'wedge', 'piece')], a: 'tormuj|tarbooz' },
  { id: 'papaya', n: 'Papaya', e: '🥭', cat: 'fruit', m: [43, 0.5, 10.8, 0.3], sv: [s('cup', 145, 'cup', 'bowl'), s('slice', 150, 'slice', 'piece')], a: 'pepe|papita' },
  { id: 'pineapple', n: 'Pineapple', e: '🍍', cat: 'fruit', m: [50, 0.5, 13.1, 0.1], sv: [s('cup', 165, 'cup', 'bowl'), s('slice', 85, 'slice', 'piece', 'ring')], a: 'anaros|anarosh' },
  { id: 'strawberries', n: 'Strawberries', e: '🍓', cat: 'fruit', m: [32, 0.7, 7.7, 0.3], sv: [s('cup', 150, 'cup', 'bowl'), s('berry', 12, 'berry', 'piece')], a: 'strawberry' },
  { id: 'blueberries', n: 'Blueberries', e: '🫐', cat: 'fruit', m: [57, 0.7, 14.5, 0.3], sv: [s('cup', 148, 'cup', 'bowl'), s('handful', 40, 'handful')], a: 'blueberry|berries|mixed berries' },
  { id: 'guava', n: 'Guava', e: '🍐', cat: 'fruit', m: [68, 2.6, 14.3, 1], sv: [s('guava', 100, 'guava', 'piece', 'medium')], a: 'peyara|amrood|amrud' },
  { id: 'dates', n: 'Dates', e: '🌴', cat: 'fruit', m: [282, 2.5, 75, 0.4], sv: [s('date', 8, 'date', 'piece', 'pc'), s('medjool date', 24, 'medjool')], a: 'khejur|khajur|medjool|ajwa' },
  { id: 'avocado', n: 'Avocado', e: '🥑', cat: 'fruit', m: [160, 2, 8.5, 14.7], sv: [s('half', 100, 'half'), s('whole', 200, 'avocado', 'piece', 'whole')], a: 'avo|guacamole' },
  { id: 'pomegranate', n: 'Pomegranate', e: '🍎', cat: 'fruit', m: [83, 1.7, 18.7, 1.2], sv: [s('cup of seeds', 174, 'cup'), s('whole', 280, 'piece', 'whole')], a: 'anar|dalim|bedana' },
  { id: 'lychee', n: 'Lychee', e: '🍒', cat: 'fruit', m: [66, 0.8, 16.5, 0.4], sv: [s('lychee', 10, 'piece', 'lychee', 'pc'), s('cup', 190, 'cup', 'bowl')], a: 'litchi|lichu|lichi' },
  { id: 'jackfruit', n: 'Jackfruit', e: '🍈', cat: 'fruit', m: [95, 1.7, 23, 0.6], sv: [s('cup', 165, 'cup', 'bowl'), s('pod', 30, 'pod', 'piece', 'koa')], a: 'kathal|kanthal|jack fruit' },
  { id: 'pear', n: 'Pear', e: '🍐', cat: 'fruit', m: [57, 0.4, 15.2, 0.1], sv: [s('pear', 178, 'pear', 'piece')], a: 'nashpati|nashpaati' },
  { id: 'kiwi', n: 'Kiwi', e: '🥝', cat: 'fruit', m: [61, 1.1, 14.7, 0.5], sv: [s('kiwi', 75, 'kiwi', 'piece')], a: 'kiwifruit' },
  { id: 'fruit-salad', n: 'Fruit salad', e: '🍱', cat: 'fruit', m: [50, 0.6, 12.5, 0.2], sv: [s('cup', 180, 'cup', 'bowl')], a: 'mixed fruit|fruit bowl|fruit chaat|cut fruit' },
  { id: 'raisins', n: 'Raisins', e: '🍇', cat: 'fruit', m: [299, 3.1, 79, 0.5], sv: [s('tbsp', 9, 'tbsp', 'spoon'), s('small box', 43, 'box', 'handful')], a: 'kishmish|kismis|sultanas' },
  { id: 'coconut', n: 'Coconut (fresh)', e: '🥥', cat: 'fruit', m: [354, 3.3, 15, 33.5], sv: [s('piece', 40, 'piece'), s('cup shredded', 80, 'cup')], a: 'narkel|nariyal|coconut meat' },

  // ── Vegetables & salads ────────────────────────────────────────────
  { id: 'green-salad', n: 'Green salad', e: '🥗', cat: 'salad', m: [20, 1.2, 3.5, 0.2], sv: [s('side bowl', 100, 'bowl', 'serving', 'side'), s('large bowl', 200, 'large', 'plate')], q: ['dressing'], a: 'salad|garden salad|side salad|cucumber salad|kachumber|tomato salad|mixed salad|shosha salad' },
  { id: 'caesar-salad', n: 'Caesar salad', e: '🥗', cat: 'salad', m: [190, 5, 7, 16], sv: [s('side', 150, 'side', 'small'), s('bowl', 300, 'bowl', 'serving', 'plate')], d: 1, a: 'caesar|ceasar salad' },
  { id: 'chicken-salad', n: 'Chicken salad', e: '🥗', cat: 'salad', m: [150, 12, 5, 9], sv: [s('bowl', 300, 'bowl', 'serving', 'plate')], q: ['dressing'], a: 'chicken caesar salad|grilled chicken salad|cobb salad|protein salad|tuna salad' },
  { id: 'greek-salad', n: 'Greek salad', e: '🥗', cat: 'salad', m: [105, 3, 5, 8.5], sv: [s('bowl', 250, 'bowl', 'serving', 'plate')], a: 'feta salad|mediterranean salad' },
  { id: 'cucumber', n: 'Cucumber', e: '🥒', cat: 'veg', m: [15, 0.7, 3.6, 0.1], sv: [s('cucumber', 300, 'cucumber', 'whole'), s('cup sliced', 104, 'cup')], d: 1, a: 'shosha|kheera|khira' },
  { id: 'tomato', n: 'Tomato', e: '🍅', cat: 'veg', m: [18, 0.9, 3.9, 0.2], sv: [s('tomato', 123, 'tomato', 'piece')], a: 'tomatoes|cherry tomatoes' },
  { id: 'carrot', n: 'Carrot', e: '🥕', cat: 'veg', m: [41, 0.9, 9.6, 0.2], sv: [s('carrot', 61, 'carrot', 'piece'), s('cup', 128, 'cup')], a: 'gajor|gajar|carrots|baby carrots' },
  { id: 'broccoli', n: 'Broccoli', e: '🥦', cat: 'veg', m: [35, 2.4, 7.2, 0.4], sv: [s('cup', 156, 'cup', 'bowl')], q: ['method'], a: 'steamed broccoli|cauliflower|fulkopi|gobi' },
  { id: 'potato', n: 'Potato (boiled / baked)', e: '🥔', cat: 'veg', m: [87, 1.9, 20.1, 0.1], sv: [s('medium potato', 173, 'potato', 'piece', 'medium'), s('small potato', 120, 'small'), s('cup', 156, 'cup')], q: ['method'], a: 'potato|alu|aloo|boiled potato|baked potato|jacket potato|roast potatoes|alu sedho' },
  { id: 'sweet-potato', n: 'Sweet potato', e: '🍠', cat: 'veg', m: [90, 2, 20.7, 0.2], sv: [s('medium', 150, 'piece', 'medium', 'potato')], q: ['method'], a: 'mishti alu|shakarkandi|yam' },
  { id: 'fries', n: 'French fries', e: '🍟', cat: 'fastfood', m: [312, 3.4, 41, 15], sv: [s('small', 80, 'small'), s('medium', 115, 'medium', 'portion', 'serving', 'regular'), s('large', 155, 'large')], d: 1, a: 'fries|chips|potato fries|finger chips|mcdonalds fries|wedges|potato wedges|curly fries' },
  { id: 'mashed-potatoes', n: 'Mashed potatoes', e: '🥔', cat: 'veg', m: [113, 2, 17, 4.2], sv: [s('cup', 210, 'cup', 'bowl', 'serving')], a: 'mash|mashed potato|potato mash' },
  { id: 'corn', n: 'Corn', e: '🌽', cat: 'veg', m: [96, 3.4, 19, 1.5], sv: [s('cob', 100, 'cob', 'ear', 'piece'), s('cup', 145, 'cup')], q: ['spread'], a: 'sweet corn|bhutta|butta|corn on the cob|sweetcorn|corn cup' },
  { id: 'peas', n: 'Green peas', e: '🫛', cat: 'veg', m: [81, 5.4, 14.5, 0.4], sv: [s('cup', 160, 'cup'), s('half cup', 80, 'half')], a: 'matar|motorshuti|peas' },
  { id: 'mushrooms', n: 'Sautéed mushrooms', e: '🍄', cat: 'veg', m: [60, 3.6, 4, 3.5], sv: [s('cup', 150, 'cup', 'bowl')], q: ['style'], a: 'mushroom|mushrooms|button mushrooms' },
  { id: 'stir-fry-veg', n: 'Stir-fried vegetables', e: '🥦', cat: 'veg', m: [70, 2.5, 7, 3.8], sv: [s('cup', 150, 'cup'), s('bowl', 200, 'bowl', 'serving', 'plate')], d: 1, q: ['style'], a: 'mixed vegetables|veggies|vegetable stir fry|veg bhaji|sauteed vegetables|chop suey|vegetables|mixed veg fry|sobji bhaji' },
  { id: 'kimchi', n: 'Kimchi', e: '🥬', cat: 'veg', m: [15, 1.1, 2.4, 0.5], sv: [s('side', 50, 'side', 'serving', 'bowl')], a: 'kimchee' },

  // ── Soups ──────────────────────────────────────────────────────────
  { id: 'chicken-soup', n: 'Chicken soup (clear)', e: '🍲', cat: 'soup', m: [45, 4, 4, 1.5], sv: [s('cup', 240, 'cup', 'mug'), s('bowl', 350, 'bowl', 'serving')], d: 1, a: 'chicken noodle soup|clear soup|chicken broth|chicken corn soup|hot and sour soup|wonton soup|bone broth|thai soup|tom yum|soup' },
  { id: 'cream-soup', n: 'Creamy soup', e: '🍲', cat: 'soup', m: [90, 2.5, 8, 5.5], sv: [s('cup', 240, 'cup', 'mug'), s('bowl', 350, 'bowl', 'serving')], d: 1, a: 'cream of mushroom|tomato soup|pumpkin soup|corn soup|cream of chicken|broccoli soup|potato soup' },
  { id: 'lentil-soup', n: 'Lentil soup', e: '🥣', cat: 'soup', m: [70, 4.5, 10, 1.5], sv: [s('cup', 240, 'cup', 'mug'), s('bowl', 350, 'bowl', 'serving')], d: 1, a: 'dal soup|shorba|mercimek|minestrone|vegetable soup' },

  // ── Snacks & street food ───────────────────────────────────────────
  { id: 'samosa', n: 'Samosa / singara', e: '🥟', cat: 'snack', m: [308, 5.5, 32, 17.5], sv: [s('samosa', 60, 'samosa', 'singara', 'piece', 'pc'), s('large samosa', 100, 'large')], a: 'singara|shingara|samucha|somucha|samsa|keema samosa|chicken samosa' },
  { id: 'pakora', n: 'Pakora / piyaju', e: '🧆', cat: 'snack', m: [280, 6, 26, 17], sv: [s('piece', 25, 'piece', 'pc', 'fritter'), s('plate (6 pieces)', 150, 'plate', 'serving')], a: 'pakoda|onion bhaji|piyaju|peyaju|beguni|fritters|bhajiya|chop|alur chop|vegetable chop|bora' },
  { id: 'jhalmuri', n: 'Jhalmuri / bhel puri', e: '🥡', cat: 'snack', m: [380, 8, 70, 8], sv: [s('cup', 30, 'cup'), s('bowl', 60, 'bowl', 'cone', 'serving')], d: 1, a: 'jhal muri|bhel puri|bhelpuri|muri|puffed rice|murmura|chanachur muri' },
  { id: 'chaat', n: 'Chaat / chotpoti', e: '🥗', cat: 'snack', m: [150, 6, 20, 5], sv: [s('plate', 200, 'plate', 'bowl', 'serving')], a: 'chotpoti|papri chaat|aloo chaat|samosa chaat|ragda' },
  { id: 'fuchka', n: 'Fuchka / pani puri', e: '🫧', cat: 'snack', m: [200, 4, 30, 7], sv: [s('piece', 15, 'piece', 'pc', 'puri'), s('plate (8 pieces)', 120, 'plate', 'serving')], a: 'phuchka|pani puri|golgappa|puchka|panipuri|gol gappa' },
  { id: 'chanachur', n: 'Chanachur / namkeen', e: '🥜', cat: 'snack', m: [520, 13, 45, 32], sv: [s('handful', 30, 'handful'), s('small pack', 50, 'pack', 'packet')], a: 'bombay mix|namkeen|bhujia|dalmoth|mixture|chevda|chanachur' },
  { id: 'chips', n: 'Potato chips', e: '🥔', cat: 'snack', m: [536, 7, 53, 34.5], sv: [s('small bag', 28, 'bag', 'pack', 'packet', 'small'), s('large bag', 70, 'large')], a: 'crisps|lays|pringles|doritos|kurkure|tortilla chips' },
  { id: 'popcorn', n: 'Popcorn (buttered)', e: '🍿', cat: 'snack', m: [500, 9, 58, 28], sv: [s('cup', 11, 'cup'), s('small tub', 45, 'small'), s('medium tub', 90, 'medium', 'tub')], d: 1, a: 'movie popcorn|butter popcorn|caramel popcorn|popcorn' },
  { id: 'popcorn-plain', n: 'Popcorn (air-popped)', e: '🍿', cat: 'snack', m: [387, 13, 78, 4.5], sv: [s('cup', 8, 'cup'), s('bowl', 30, 'bowl')], d: 1, a: 'air popped popcorn|plain popcorn' },
  { id: 'biscuits', n: 'Biscuits / crackers', e: '🍪', cat: 'snack', m: [440, 7, 76, 12], sv: [s('biscuit', 8, 'biscuit', 'piece', 'pc', 'cracker'), s('pack', 75, 'pack', 'packet')], a: 'marie biscuit|tea biscuit|digestive biscuit|crackers|bela biscuit|toast biscuit|rusk|cream crackers|parle g' },
  { id: 'cookie', n: 'Chocolate chip cookie', e: '🍪', cat: 'snack', m: [488, 5.4, 64, 24], sv: [s('cookie', 16, 'cookie', 'piece', 'pc'), s('large cookie', 50, 'large')], a: 'cookie|chocolate cookie|oreo|cookies|bakery cookie' },
  { id: 'milk-chocolate', n: 'Milk chocolate', e: '🍫', cat: 'snack', m: [535, 7.6, 59.4, 29.7], sv: [s('square', 6, 'square', 'piece'), s('bar', 45, 'bar'), s('large bar', 100, 'large')], d: 1, a: 'chocolate|dairy milk|kitkat|snickers|chocolate bar|mars bar|twix|cadbury' },
  { id: 'dark-chocolate', n: 'Dark chocolate', e: '🍫', cat: 'snack', m: [598, 7.8, 45.9, 42.6], sv: [s('square', 10, 'square', 'piece'), s('bar', 100, 'bar')], a: '70% chocolate|dark chocolate bar|cocoa chocolate' },
  { id: 'protein-bar', n: 'Protein bar', e: '🍫', cat: 'snack', m: [350, 33, 38, 10], sv: [s('bar', 60, 'bar', 'piece')], a: 'quest bar|protein cookie|energy bar' },
  { id: 'granola-bar', n: 'Granola / cereal bar', e: '🍫', cat: 'snack', m: [460, 8, 65, 18], sv: [s('bar', 40, 'bar', 'piece')], a: 'cereal bar|nature valley|muesli bar|oat bar|kind bar' },
  { id: 'almonds', n: 'Almonds', e: '🌰', cat: 'nuts', m: [579, 21.2, 21.6, 49.9], sv: [s('handful (~23)', 28, 'handful', 'serving'), s('almond', 1.2, 'almond', 'piece', 'nut')], a: 'badam|kath badam|almond' },
  { id: 'peanuts', n: 'Peanuts', e: '🥜', cat: 'nuts', m: [567, 25.8, 16.1, 49.2], sv: HANDFUL, a: 'chinabadam|china badam|groundnuts|moongphali|peanut|roasted peanuts' },
  { id: 'cashews', n: 'Cashews', e: '🥜', cat: 'nuts', m: [553, 18.2, 30.2, 43.9], sv: HANDFUL, a: 'kaju|cashew|kaju badam' },
  { id: 'walnuts', n: 'Walnuts', e: '🌰', cat: 'nuts', m: [654, 15.2, 13.7, 65.2], sv: HANDFUL, a: 'akhrot|walnut' },
  { id: 'mixed-nuts', n: 'Mixed nuts', e: '🥜', cat: 'nuts', m: [607, 20, 21, 54], sv: HANDFUL, a: 'trail mix|nuts|dry fruits|pistachios|pista' },
  { id: 'chia', n: 'Chia seeds', e: '🌱', cat: 'nuts', m: [486, 16.5, 42, 30.7], sv: [s('tbsp', 12, 'tbsp', 'spoon')], a: 'chia|flax seeds|flaxseed|seeds|pumpkin seeds|sunflower seeds' },

  // ── Fast food ──────────────────────────────────────────────────────
  { id: 'pizza', n: 'Cheese pizza', e: '🍕', cat: 'fastfood', m: [266, 11.4, 33, 10], sv: SLICE_PIZZA, q: ['crust'], a: 'pizza|margherita|veg pizza|vegetable pizza|cheese pizza slice' },
  { id: 'pizza-meat', n: 'Pepperoni / chicken pizza', e: '🍕', cat: 'fastfood', m: [298, 12.9, 33, 12.5], sv: SLICE_PIZZA, q: ['crust'], a: 'pepperoni|pepperoni pizza|meat pizza|chicken pizza|bbq chicken pizza|supreme pizza|meat lovers|dominos|pizza hut' },
  { id: 'burger', n: 'Beef burger', e: '🍔', cat: 'fastfood', m: [257, 14, 20, 13.5], sv: [s('burger', 220, 'burger', 'piece', 'regular'), s('double burger', 320, 'double'), s('small burger', 110, 'small', 'slider', 'junior')], q: ['extras'], a: 'cheeseburger|hamburger|big mac|whopper|quarter pounder|beef burger|smash burger|burger' },
  { id: 'chicken-burger', n: 'Chicken burger', e: '🍔', cat: 'fastfood', m: [245, 12, 24, 11], sv: [s('burger', 210, 'burger', 'piece', 'regular'), s('small burger', 130, 'small', 'junior')], q: ['extras'], a: 'zinger|crispy chicken burger|mcchicken|chicken zinger|chicken sandwich burger|grilled chicken burger|chicken cheese burger' },
  { id: 'hot-dog', n: 'Hot dog', e: '🌭', cat: 'fastfood', m: [250, 9.5, 23, 13.5], sv: [s('hot dog', 100, 'hot dog', 'hotdog', 'piece')], q: ['extras'], a: 'hotdog|corn dog' },
  { id: 'sandwich', n: 'Sandwich / sub', e: '🥪', cat: 'fastfood', m: [215, 13, 22, 8.5], sv: [s('sandwich', 200, 'sandwich', 'piece', 'sub'), s('half sandwich', 100, 'half'), s('footlong sub', 400, 'footlong')], q: ['extras'], a: 'chicken sandwich|sub|subway|club sandwich|tuna sandwich|egg sandwich|turkey sandwich|ham sandwich|panini|chicken sub' },
  { id: 'grilled-cheese', n: 'Grilled cheese sandwich', e: '🥪', cat: 'fastfood', m: [330, 12, 30, 18.5], sv: [s('sandwich', 120, 'sandwich', 'piece')], a: 'cheese toast|cheese sandwich|toastie|cheese melt' },
  { id: 'tacos', n: 'Tacos', e: '🌮', cat: 'fastfood', m: [210, 11, 18, 10], sv: [s('taco', 90, 'taco', 'piece', 'pc')], a: 'taco|chicken taco|beef taco|fish taco|quesadilla' },
  { id: 'burrito', n: 'Burrito', e: '🌯', cat: 'fastfood', m: [170, 9, 20, 6], sv: [s('burrito', 400, 'burrito', 'piece', 'wrap')], a: 'chicken burrito|beef burrito|bean burrito' },
  { id: 'nachos', n: 'Nachos with cheese', e: '🧀', cat: 'fastfood', m: [346, 9, 36, 19], sv: [s('small', 120, 'small'), s('plate', 200, 'plate', 'serving', 'portion')], d: 1, a: 'loaded nachos|nachos|nacho' },
  { id: 'momos', n: 'Momos / dumplings', e: '🥟', cat: 'fastfood', m: [190, 8, 22, 7.5], sv: [s('piece', 30, 'piece', 'pc', 'momo', 'dumpling'), s('plate (8 pieces)', 240, 'plate', 'serving')], q: ['method'], a: 'momo|dumplings|dim sum|dimsum|gyoza|wonton|jiaozi|dumpling|steamed momo' },
  { id: 'spring-roll', n: 'Spring roll', e: '🥢', cat: 'snack', m: [250, 5, 26, 14], sv: [s('roll', 60, 'roll', 'piece', 'pc')], a: 'egg roll|veg roll|spring rolls' },
  { id: 'sweet-sour-chicken', n: 'Sweet & sour chicken', e: '🥡', cat: 'fastfood', m: [230, 10, 26, 9.5], sv: [s('small plate', 150, 'small'), s('plate', 250, 'plate', 'serving', 'bowl')], d: 1, a: 'sweet and sour chicken|orange chicken|general tso|honey chicken|lemon chicken' },
  { id: 'chilli-chicken', n: 'Chilli chicken / Manchurian', e: '🥡', cat: 'fastfood', m: [210, 14, 10, 12.5], sv: [s('small plate', 150, 'small'), s('plate', 250, 'plate', 'serving', 'bowl')], d: 1, q: ['style'], a: 'chicken manchurian|chilli chicken|chili chicken|schezwan chicken|kung pao chicken|garlic chicken|dragon chicken|gobi manchurian' },
  { id: 'fish-and-chips', n: 'Fish and chips', e: '🐟', cat: 'fastfood', m: [200, 9, 20, 9.5], sv: [s('portion', 400, 'portion', 'plate', 'serving')], a: 'fish n chips|fish & chips' },

  // ── Breakfast ──────────────────────────────────────────────────────
  { id: 'oats', n: 'Oats (dry)', e: '🥣', cat: 'breakfast', m: [389, 16.9, 66, 6.9], sv: [s('half cup dry', 40, 'cup', 'serving', 'bowl'), s('tbsp', 5, 'tbsp', 'spoon')], a: 'oat|rolled oats|quaker oats|instant oats|oats dry' },
  { id: 'oatmeal', n: 'Oatmeal (cooked with water)', e: '🥣', cat: 'breakfast', m: [71, 2.5, 12, 1.5], sv: [s('bowl', 250, 'bowl', 'cup', 'serving')], q: ['sugar'], a: 'porridge|oat porridge|oats with water' },
  { id: 'oatmeal-milk', n: 'Oatmeal with milk', e: '🥣', cat: 'breakfast', m: [110, 4.5, 15.5, 3.5], sv: [s('bowl', 250, 'bowl', 'cup', 'serving')], q: ['sugar'], a: 'overnight oats|oats with milk|milk oats|milk porridge' },
  { id: 'cornflakes', n: 'Breakfast cereal (dry)', e: '🥣', cat: 'breakfast', m: [370, 7.5, 82, 2], sv: [s('bowl', 30, 'bowl', 'cup', 'serving'), s('large bowl', 50, 'large')], a: 'cereal|corn flakes|cornflakes|chocos|kelloggs|froot loops|cheerios|coco pops|special k' },
  { id: 'granola', n: 'Granola / muesli', e: '🥣', cat: 'breakfast', m: [430, 10, 64, 15], sv: [s('half cup', 55, 'cup', 'bowl', 'serving')], a: 'muesli|granola' },
  { id: 'pancakes', n: 'Pancakes', e: '🥞', cat: 'breakfast', m: [227, 6.4, 28, 9.7], sv: [s('pancake', 40, 'pancake', 'piece', 'pc'), s('stack of 3', 120, 'stack')], q: ['spread'], a: 'hotcakes|pancake|crepe|crepes' },
  { id: 'waffle', n: 'Waffle', e: '🧇', cat: 'breakfast', m: [291, 7.9, 33, 14.1], sv: [s('waffle', 75, 'waffle', 'piece')], q: ['spread'], a: 'waffles|belgian waffle' },
  { id: 'french-toast', n: 'French toast', e: '🍞', cat: 'breakfast', m: [229, 7.7, 25, 11], sv: [s('slice', 65, 'slice', 'piece')], q: ['spread'], a: 'eggy bread|bombay toast|egg toast|dim pauruti' },
  { id: 'hash-brown', n: 'Hash brown', e: '🥔', cat: 'breakfast', m: [265, 2.6, 30, 15], sv: [s('hash brown', 55, 'piece', 'patty')], a: 'hashbrown|hash browns' },
  { id: 'avocado-toast', n: 'Avocado toast', e: '🥑', cat: 'breakfast', m: [190, 4.5, 17, 12], sv: [s('slice', 110, 'slice', 'piece', 'toast')], a: 'avo toast|smashed avocado' },

  // ── Sweets & desserts ──────────────────────────────────────────────
  { id: 'rasgulla', n: 'Rasgulla / rosogolla', e: '🍡', cat: 'dessert', m: [186, 4.5, 36, 2.5], sv: [s('piece with syrup', 50, 'piece', 'pc', 'rasgulla')], a: 'rosogolla|roshogolla|rasagola|rosgolla|chomchom|cham cham|rajbhog|kalojam' },
  { id: 'gulab-jamun', n: 'Gulab jamun', e: '🍡', cat: 'dessert', m: [375, 5, 52, 16.5], sv: [s('piece', 40, 'piece', 'pc')], a: 'gulap jamun|kalo jam|pantua|jamun|lal mohan|ledikeni' },
  { id: 'sandesh', n: 'Sandesh / burfi', e: '🍬', cat: 'dessert', m: [330, 9, 45, 13], sv: [s('piece', 30, 'piece', 'pc')], a: 'shondesh|sondesh|kalakand|burfi|barfi|peda|mishti|sweets|mithai|kaju katli|laddu|ladoo' },
  { id: 'rasmalai', n: 'Rasmalai', e: '🍮', cat: 'dessert', m: [220, 6.5, 28, 9.5], sv: [s('piece with milk', 80, 'piece', 'pc')], a: 'roshmalai|ras malai|rosh malai' },
  { id: 'kheer', n: 'Kheer / payesh', e: '🍮', cat: 'dessert', m: [140, 4, 21, 4.5], sv: [s('small bowl', 120, 'bowl', 'katori'), s('bowl', 200, 'bowl', 'serving')], a: 'payesh|payes|rice pudding|firni|phirni|semai|shemai|sheer khurma|vermicelli|seviyan|shahi tukra' },
  { id: 'jalebi', n: 'Jalebi', e: '🍥', cat: 'dessert', m: [460, 3, 65, 21], sv: [s('piece', 20, 'piece', 'pc')], a: 'jilapi|jilipi|imarti|jalapi' },
  { id: 'halwa', n: 'Halwa', e: '🍮', cat: 'dessert', m: [350, 4, 45, 17.5], sv: [s('spoonful', 30, 'spoon', 'tbsp'), s('small bowl', 100, 'bowl', 'serving')], d: 1, a: 'suji halwa|sooji halwa|gajar halwa|halua|gajorer halua|sheera|kesari' },
  { id: 'pitha', n: 'Pitha', e: '🥮', cat: 'dessert', m: [250, 4, 45, 6], sv: [s('piece', 50, 'piece', 'pc')], a: 'puli pitha|bhapa pitha|patishapta|chitoi pitha|pua|malpua|nokshi pitha' },
  { id: 'ice-cream', n: 'Ice cream', e: '🍨', cat: 'dessert', m: [207, 3.5, 23.6, 11], sv: [s('scoop', 66, 'scoop', 'ball'), s('cup', 130, 'cup', 'bowl'), s('cone', 100, 'cone')], a: 'icecream|kulfi|gelato|softy|sundae|ice cream cone|cornetto|choc bar' },
  { id: 'cake', n: 'Cake', e: '🍰', cat: 'dessert', m: [371, 5, 50.7, 17], sv: [s('slice', 95, 'slice', 'piece', 'pc'), s('cupcake', 60, 'cupcake')], a: 'chocolate cake|sponge cake|birthday cake|black forest|red velvet|pastry|cupcake|fruit cake|tea cake|cake slice' },
  { id: 'cheesecake', n: 'Cheesecake', e: '🍰', cat: 'dessert', m: [321, 5.5, 25.5, 22.5], sv: [s('slice', 125, 'slice', 'piece')], a: 'new york cheesecake|baked cheesecake' },
  { id: 'brownie', n: 'Brownie', e: '🍫', cat: 'dessert', m: [466, 6, 50, 27], sv: [s('brownie', 56, 'piece', 'brownie', 'square')], a: 'chocolate brownie|fudge brownie|blondie' },
  { id: 'donut', n: 'Donut', e: '🍩', cat: 'dessert', m: [421, 6.2, 51, 22], sv: [s('donut', 60, 'donut', 'doughnut', 'piece')], a: 'doughnut|glazed donut|krispy kreme|dunkin' },
  { id: 'muffin', n: 'Muffin', e: '🧁', cat: 'dessert', m: [377, 4.5, 53, 16.5], sv: [s('muffin', 113, 'muffin', 'piece')], a: 'blueberry muffin|chocolate muffin|banana bread' },
  { id: 'pudding', n: 'Pudding / custard', e: '🍮', cat: 'dessert', m: [150, 4.5, 23, 4.5], sv: [s('cup', 120, 'cup', 'bowl', 'piece')], a: 'custard|caramel pudding|flan|bread pudding|creme caramel|falooda|trifle' },

  // ── Hot drinks ─────────────────────────────────────────────────────
  { id: 'tea', n: 'Tea', e: '🍵', cat: 'hotdrink', m: [1, 0, 0.3, 0], sv: [s('cup', 150, 'cup', 'cha', 'chai'), s('mug', 250, 'mug', 'large')], q: ['milk', 'sugar'], liquid: true, a: 'cha|chai|black tea|milk tea|doodh cha|dudh cha|masala chai|green tea|lemon tea|red tea|lal cha|karak chai|adha cha|ginger tea' },
  { id: 'coffee', n: 'Coffee', e: '☕', cat: 'hotdrink', m: [1, 0.1, 0, 0], sv: [s('cup', 240, 'cup'), s('mug', 350, 'mug', 'large'), s('espresso shot', 30, 'shot', 'espresso')], q: ['milk', 'sugar'], liquid: true, a: 'black coffee|americano|espresso|filter coffee|nescafe|instant coffee|drip coffee|long black|brewed coffee' },
  { id: 'latte', n: 'Latte', e: '☕', cat: 'hotdrink', m: [47, 2.6, 3.8, 2.4], sv: COFFEE_SIZES, d: 1, q: ['milkType', 'sugar'], liquid: true, a: 'cafe latte|flat white|cortado|iced latte|caffe latte|spanish latte|vanilla latte|caramel latte' },
  { id: 'cappuccino', n: 'Cappuccino', e: '☕', cat: 'hotdrink', m: [33, 1.8, 2.7, 1.7], sv: [s('small', 240, 'small', 'cup'), s('medium', 350, 'medium', 'regular'), s('large', 470, 'large')], d: 1, q: ['milkType', 'sugar'], liquid: true, a: 'capuccino|cappucino|macchiato' },
  { id: 'mocha', n: 'Mocha / hot chocolate', e: '☕', cat: 'hotdrink', m: [76, 2.8, 9.5, 3], sv: COFFEE_SIZES, d: 1, q: ['milkType'], liquid: true, a: 'cafe mocha|hot chocolate|hot cocoa|cocoa|white mocha|chocolate milk' },

  // ── Cold drinks ────────────────────────────────────────────────────
  { id: 'cold-coffee', n: 'Cold coffee / frappe', e: '🧋', cat: 'drink', m: [90, 2.5, 14, 2.8], sv: [s('glass', 300, 'glass', 'cup', 'regular'), s('large', 470, 'large')], liquid: true, a: 'frappuccino|iced coffee|frappe|coffee shake|iced mocha' },
  { id: 'milkshake', n: 'Milkshake', e: '🥤', cat: 'drink', m: [112, 3.5, 17, 3.4], sv: [s('glass', 300, 'glass', 'regular', 'cup'), s('large', 450, 'large')], liquid: true, a: 'shake|chocolate shake|strawberry shake|banana shake|oreo shake|mango shake|thick shake|bubble tea|boba' },
  { id: 'lassi', n: 'Sweet lassi', e: '🥛', cat: 'drink', m: [95, 3, 15, 2.5], sv: [s('glass', 250, 'glass', 'cup'), s('large glass', 400, 'large')], q: ['sweetness'], liquid: true, a: 'lassi|mango lassi|doi lassi|sweet yogurt drink' },
  { id: 'buttermilk', n: 'Buttermilk / borhani', e: '🥛', cat: 'drink', m: [40, 2, 5, 1.3], sv: [s('glass', 250, 'glass', 'cup')], liquid: true, a: 'borhani|chaas|mattha|ghol|salted lassi|ayran|matha' },
  { id: 'soda', n: 'Soft drink / soda', e: '🥤', cat: 'drink', m: [42, 0, 10.6, 0], sv: [s('can', 330, 'can'), s('glass', 250, 'glass', 'cup'), s('bottle (500 ml)', 500, 'bottle'), s('large bottle (1 L)', 1000, 'large')], liquid: true, a: 'coke|pepsi|sprite|7up|fanta|mountain dew|mojo|soft drink|cola|coca cola|soda|fizzy drink|clemon' },
  { id: 'diet-soda', n: 'Diet soda', e: '🥤', cat: 'drink', m: [0.4, 0, 0.1, 0], sv: [s('can', 330, 'can'), s('bottle (500 ml)', 500, 'bottle')], liquid: true, a: 'diet coke|coke zero|pepsi max|zero sugar|sugar free soda|diet pepsi' },
  { id: 'juice', n: 'Fruit juice', e: '🧃', cat: 'drink', m: [45, 0.7, 10.4, 0.2], sv: GLASS, q: ['sugar'], liquid: true, a: 'orange juice|apple juice|fresh juice|oj|mango juice|fruit juice|pineapple juice|watermelon juice|juice|frooto|pomegranate juice' },
  { id: 'smoothie', n: 'Smoothie', e: '🥤', cat: 'drink', m: [70, 1.5, 15, 0.6], sv: [s('glass', 300, 'glass', 'cup', 'regular'), s('large', 470, 'large')], liquid: true, a: 'fruit smoothie|banana smoothie|berry smoothie|green smoothie' },
  { id: 'lemonade', n: 'Lemonade / sherbet', e: '🍋', cat: 'drink', m: [40, 0, 10.5, 0], sv: [s('glass', 250, 'glass', 'cup')], liquid: true, a: 'nimbu pani|shikanji|lebur sherbet|sherbet|lemon juice|mint lemonade|lemon soda|rooh afza|tang' },
  { id: 'iced-tea', n: 'Iced tea (sweetened)', e: '🧊', cat: 'drink', m: [30, 0, 7.5, 0], sv: [s('glass', 300, 'glass', 'cup'), s('bottle', 500, 'bottle')], liquid: true, a: 'lipton ice tea|sweet tea|peach iced tea|ice tea' },
  { id: 'protein-shake', n: 'Protein shake (whey)', e: '💪', cat: 'drink', m: [400, 80, 10, 5], sv: [s('scoop', 30, 'scoop', 'shake', 'serving')], a: 'whey|protein powder|whey protein|protein|isolate|mass gainer' },
  { id: 'coconut-water', n: 'Coconut water', e: '🥥', cat: 'drink', m: [19, 0.7, 3.7, 0.2], sv: [s('glass', 250, 'glass'), s('coconut', 300, 'coconut', 'dab', 'daab')], liquid: true, a: 'daab|dab|daber pani|tender coconut|nariyal pani' },
  { id: 'sugarcane', n: 'Sugarcane juice', e: '🧃', cat: 'drink', m: [70, 0.2, 18, 0], sv: [s('glass', 250, 'glass', 'cup')], liquid: true, a: 'akher rosh|akh|ganne ka juice|ganna juice' },
  { id: 'energy-drink', n: 'Energy drink', e: '⚡', cat: 'drink', m: [45, 0, 11, 0], sv: [s('can', 250, 'can'), s('large can', 500, 'large')], liquid: true, a: 'red bull|monster|speed|sting|prime|gatorade|sports drink' },
  { id: 'beer', n: 'Beer', e: '🍺', cat: 'drink', m: [43, 0.5, 3.6, 0], sv: [s('can / bottle', 355, 'can', 'bottle', 'glass'), s('pint', 568, 'pint')], liquid: true, a: 'lager|ale|ipa|stout' },
  { id: 'wine', n: 'Wine', e: '🍷', cat: 'drink', m: [85, 0.1, 2.6, 0], sv: [s('glass', 150, 'glass'), s('bottle', 750, 'bottle')], liquid: true, a: 'red wine|white wine|rose|prosecco|champagne' },
  { id: 'spirits', n: 'Spirits (shot)', e: '🥃', cat: 'drink', m: [231, 0, 0, 0], sv: [s('shot', 44, 'shot', 'peg'), s('double', 88, 'double')], liquid: true, a: 'whiskey|whisky|vodka|rum|gin|tequila|brandy' },
  { id: 'water', n: 'Water', e: '💧', cat: 'drink', m: [0, 0, 0, 0], sv: [s('glass', 250, 'glass', 'cup'), s('bottle', 500, 'bottle'), s('large bottle', 1000, 'large', 'liter', 'litre')], liquid: true, a: 'pani|mineral water|sparkling water|plain water' },
]

function build(d: Def): Food {
  return {
    id: d.id,
    name: d.n,
    emoji: d.e,
    cat: d.cat,
    per100: { kcal: d.m[0], p: d.m[1], c: d.m[2], f: d.m[3] },
    servings: d.sv,
    def: d.d ?? 0,
    aliases: d.a ? d.a.split('|') : [],
    questions: d.q ?? [],
    liquid: d.liquid,
  }
}

export const FOODS: Food[] = DEFS.map(build)

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]))

export function getFood(id: string): Food | undefined {
  return FOOD_BY_ID[id]
}
