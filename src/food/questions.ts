import type { Food, Question, QuestionKey } from './types'

export const QUESTIONS: Record<QuestionKey, Question> = {
  style: {
    key: 'style',
    title: 'How was it cooked?',
    subtitle: 'Oil and ghee change calories the most.',
    def: 'typical',
    options: [
      { id: 'light', label: 'Light oil', hint: 'Home-style, easy on oil', emoji: '🌿', mod: { per100: { f: -3 } }, match: ['light', 'less oil', 'low oil', 'homemade', 'home made', 'home cooked', 'healthy', 'diet', 'air fried', 'airfried'] },
      { id: 'typical', label: 'Typical', hint: 'Normal home cooking', emoji: '🍳' },
      { id: 'rich', label: 'Oily / restaurant', hint: 'Oil pooling on top', emoji: '🫗', mod: { per100: { f: 5, c: 1 } }, match: ['restaurant', 'oily', 'rich', 'dhaba', 'takeaway', 'take away', 'takeout', 'hotel', 'wedding', 'biye bari', 'extra oil'] },
      { id: 'creamy', label: 'Extra rich & creamy', hint: 'Cream, butter or nuts', emoji: '🧈', mod: { per100: { f: 8, c: 2, p: 0.5 } }, match: ['creamy', 'cream', 'malai', 'buttery', 'extra butter', 'extra ghee'] },
    ],
  },
  ratio: {
    key: 'ratio',
    title: 'Meat or gravy?',
    subtitle: 'What filled most of the bowl?',
    def: 'balanced',
    options: [
      { id: 'meat', label: 'Mostly meat', emoji: '🍖', mod: { per100: { p: 4, f: 1 } }, match: ['mostly meat', 'more meat', 'dry', 'bhuna', 'less gravy'] },
      { id: 'balanced', label: 'Half and half', emoji: '⚖️' },
      { id: 'gravy', label: 'Mostly gravy', emoji: '🥣', mod: { per100: { p: -5, c: 1, f: 1 } }, match: ['mostly gravy', 'more gravy', 'jhol', 'watery', 'extra gravy'] },
    ],
  },
  bone: {
    key: 'bone',
    title: 'Were there bones?',
    subtitle: 'Bones weigh a lot but add no calories.',
    def: 'boneless',
    options: [
      { id: 'boneless', label: 'Boneless', emoji: '🥩', match: ['boneless', 'no bone', 'fillet'] },
      { id: 'bone', label: 'With bones', hint: 'The portion included bones', emoji: '🦴', mod: { mult: 0.8 }, match: ['bone', 'bones', 'bone in', 'with bone', 'leg piece', 'kata'] },
    ],
  },
  method: {
    key: 'method',
    title: 'How was it prepared?',
    def: 'plain',
    options: [
      { id: 'plain', label: 'Grilled / boiled / baked', emoji: '🔥', match: ['grilled', 'boiled', 'baked', 'steamed', 'roasted', 'poached', 'air fried', 'sedho', 'raw'] },
      { id: 'panfried', label: 'Pan-fried', hint: 'A little oil in the pan', emoji: '🍳', mod: { per100: { f: 5 } }, match: ['pan fried', 'pan-fried', 'sauteed', 'sautéed', 'fried egg', 'bhaja', 'fry', 'fried', 'sunny side'] },
      { id: 'deepfried', label: 'Deep-fried / battered', hint: 'Crispy coating', emoji: '🍤', mod: { per100: { f: 12, c: 8 } }, match: ['deep fried', 'deep-fried', 'battered', 'crispy', 'breaded', 'tempura'] },
    ],
  },
  milk: {
    key: 'milk',
    title: 'Any milk in it?',
    def: 'black',
    options: [
      { id: 'black', label: 'No milk', emoji: '🫖', match: ['black', 'green', 'lemon', 'red tea', 'lal cha', 'herbal', 'no milk', 'without milk', 'americano', 'espresso', 'ginger'] },
      { id: 'splash', label: 'A splash', hint: '~30 ml', emoji: '💧', mod: { each: { kcal: 18, p: 1, c: 1.4, f: 1 } }, match: ['splash', 'little milk', 'dash of milk'] },
      { id: 'regular', label: 'Milky', hint: 'Classic milk tea / white coffee', emoji: '🥛', mod: { each: { kcal: 37, p: 1.9, c: 2.9, f: 2 } }, match: ['milk', 'milky', 'doodh', 'dudh', 'white', 'karak', 'masala chai', 'milk tea'] },
      { id: 'condensed', label: 'Condensed milk', hint: '~1 tbsp', emoji: '🥫', mod: { each: { kcal: 65, p: 1.6, c: 11, f: 1.7 } }, match: ['condensed', 'condensed milk', 'dhaka tea', 'tong'] },
      { id: 'creamer', label: 'Creamer / whitener', emoji: '🥄', mod: { each: { kcal: 22, c: 2.2, f: 1.4 } }, match: ['creamer', 'whitener', 'coffee mate'] },
      { id: 'oat', label: 'Plant milk', hint: 'Oat, soy or almond', emoji: '🌾', mod: { each: { kcal: 20, p: 0.5, c: 2.8, f: 0.8 } }, match: ['oat milk', 'soy milk', 'almond milk', 'plant milk'] },
    ],
  },
  milkType: {
    key: 'milkType',
    title: 'Which milk?',
    def: 'whole',
    options: [
      { id: 'whole', label: 'Whole milk', emoji: '🥛', match: ['whole milk', 'full cream'] },
      { id: 'lowfat', label: 'Low-fat / 2%', emoji: '🥛', mod: { per100: { f: -0.9 } }, match: ['2%', 'low fat', 'lowfat', 'semi skimmed'] },
      { id: 'skim', label: 'Skim', emoji: '🥛', mod: { per100: { f: -2, p: 0.2 } }, match: ['skim', 'skimmed', 'nonfat', 'non fat'] },
      { id: 'oat', label: 'Oat', emoji: '🌾', mod: { per100: { p: -1.7, c: 2, f: -0.8 } }, match: ['oat', 'oat milk'] },
      { id: 'almond', label: 'Almond', emoji: '🌰', mod: { per100: { p: -2, c: -2.5, f: -1 } }, match: ['almond', 'almond milk'] },
      { id: 'soy', label: 'Soy', emoji: '🫘', mod: { per100: { c: -1, f: -0.8 } }, match: ['soy', 'soya'] },
    ],
  },
  sugar: {
    key: 'sugar',
    title: 'Any sugar?',
    subtitle: 'Per cup or glass.',
    def: 'none',
    options: [
      { id: 'none', label: 'No sugar', emoji: '🚫', match: ['no sugar', 'without sugar', 'sugar free', 'sugarless', 'unsweetened', 'chini chara', 'sweetener', 'stevia'] },
      { id: 'tsp1', label: '1 tsp', emoji: '🍬', mod: { each: { c: 4 } }, match: ['1 sugar', 'one sugar', 'sugar', 'sweet', 'a little sugar'] },
      { id: 'tsp2', label: '2 tsp', emoji: '🍬', mod: { each: { c: 8 } }, match: ['2 sugar', 'two sugar', '2 tsp sugar', '2 spoon sugar'] },
      { id: 'tsp3', label: '3+ tsp', emoji: '🍭', mod: { each: { c: 12 } }, match: ['3 sugar', 'three sugar', 'extra sugar', 'very sweet'] },
    ],
  },
  spread: {
    key: 'spread',
    title: 'Anything on it?',
    subtitle: 'Per piece. Pick all that apply.',
    multi: true,
    options: [
      { id: 'butter', label: 'Butter', hint: '1 tsp', emoji: '🧈', mod: { each: { kcal: 36, f: 4.1 } }, match: ['butter', 'buttered', 'makhon'] },
      { id: 'ghee', label: 'Ghee', hint: '1 tsp', emoji: '✨', mod: { each: { f: 5 } }, match: ['ghee', 'ghi'] },
      { id: 'oil', label: 'Brushed with oil', emoji: '🫒', mod: { each: { f: 2.5 } }, match: ['oil', 'oily'] },
      { id: 'jam', label: 'Jam', hint: '1 tbsp', emoji: '🍓', mod: { each: { kcal: 56, c: 14 } }, match: ['jam', 'jelly', 'marmalade'] },
      { id: 'honey', label: 'Honey / syrup', hint: '1 tbsp', emoji: '🍯', mod: { each: { kcal: 64, c: 17 } }, match: ['honey', 'syrup', 'maple'] },
      { id: 'pb', label: 'Peanut butter', hint: '1 tbsp', emoji: '🥜', mod: { each: { kcal: 94, p: 4, c: 3, f: 8 } }, match: ['peanut butter', 'pb'] },
      { id: 'nutella', label: 'Nutella', hint: '1 tbsp', emoji: '🍫', mod: { each: { kcal: 102, p: 1.2, c: 11, f: 6 } }, match: ['nutella', 'chocolate spread'] },
      { id: 'creamcheese', label: 'Cream cheese', hint: '1 tbsp', emoji: '🧀', mod: { each: { kcal: 51, p: 0.9, c: 0.6, f: 5.1 } }, match: ['cream cheese'] },
    ],
  },
  ghee: {
    key: 'ghee',
    title: 'Ghee or butter on top?',
    def: 'plain',
    options: [
      { id: 'plain', label: 'Plain', emoji: '🍚', match: ['plain', 'no ghee'] },
      { id: 'tsp', label: 'A spoon', hint: '~1 tsp ghee / butter', emoji: '✨', mod: { each: { f: 5 } }, match: ['ghee', 'butter', 'ghi'] },
      { id: 'tbsp', label: 'Generous', hint: '~1 tbsp', emoji: '🧈', mod: { each: { f: 13 } }, match: ['extra ghee', 'lots of ghee'] },
    ],
  },
  dressing: {
    key: 'dressing',
    title: 'Dressing?',
    def: 'none',
    options: [
      { id: 'none', label: 'None', emoji: '🥬', match: ['no dressing', 'plain'] },
      { id: 'vinaigrette', label: 'Light vinaigrette', hint: '1 tbsp', emoji: '🍋', mod: { each: { f: 5, c: 1 } }, match: ['vinaigrette', 'lemon', 'balsamic', 'dressing'] },
      { id: 'creamy', label: 'Creamy', hint: 'Ranch, Caesar, mayo · 2 tbsp', emoji: '🥛', mod: { each: { f: 15, c: 2, p: 0.5 } }, match: ['ranch', 'mayo', 'creamy', 'thousand island', 'caesar dressing'] },
      { id: 'oliveoil', label: 'Olive oil', hint: '1 tbsp', emoji: '🫒', mod: { each: { f: 13.5 } }, match: ['olive oil', 'oil'] },
    ],
  },
  extras: {
    key: 'extras',
    title: 'Any extras?',
    subtitle: 'Pick all that apply.',
    multi: true,
    options: [
      { id: 'cheese', label: 'Extra cheese', emoji: '🧀', mod: { each: { kcal: 70, p: 4, c: 0.5, f: 5.5 } }, match: ['cheese', 'extra cheese', 'cheesy'] },
      { id: 'mayo', label: 'Mayo / garlic sauce', emoji: '🫙', mod: { each: { kcal: 90, f: 10 } }, match: ['mayo', 'mayonnaise', 'garlic sauce', 'aioli'] },
      { id: 'bacon', label: 'Bacon', emoji: '🥓', mod: { each: { kcal: 86, p: 6, f: 6.7 } }, match: ['bacon'] },
      { id: 'egg', label: 'Fried egg', emoji: '🍳', mod: { each: { kcal: 90, p: 6.3, c: 0.4, f: 7 } }, match: ['egg', 'fried egg'] },
      { id: 'avocado', label: 'Avocado', emoji: '🥑', mod: { each: { kcal: 80, p: 1, c: 4, f: 7 } }, match: ['avocado', 'avo', 'guacamole'] },
      { id: 'sauce', label: 'Ketchup / BBQ sauce', emoji: '🍅', mod: { each: { kcal: 20, c: 5 } }, match: ['ketchup', 'bbq', 'sauce'] },
    ],
  },
  crust: {
    key: 'crust',
    title: 'What crust?',
    def: 'regular',
    options: [
      { id: 'thin', label: 'Thin crust', emoji: '🫓', mod: { mult: 0.85 }, match: ['thin', 'thin crust'] },
      { id: 'regular', label: 'Regular', emoji: '🍕' },
      { id: 'thick', label: 'Thick / pan', emoji: '🍞', mod: { mult: 1.2 }, match: ['thick', 'pan', 'deep dish', 'deep pan'] },
      { id: 'stuffed', label: 'Stuffed crust', emoji: '🧀', mod: { mult: 1.35 }, match: ['stuffed', 'cheese burst', 'stuffed crust'] },
    ],
  },
  sweetness: {
    key: 'sweetness',
    title: 'How sweet was it?',
    def: 'typical',
    options: [
      { id: 'less', label: 'Less sweet', emoji: '🙂', mod: { per100: { c: -4 } }, match: ['less sweet', 'less sugar', 'low sugar'] },
      { id: 'typical', label: 'Typical', emoji: '😋' },
      { id: 'very', label: 'Very sweet', emoji: '🍭', mod: { per100: { c: 8 } }, match: ['very sweet', 'extra sweet', 'extra sugar'] },
    ],
  },
  sides: {
    key: 'sides',
    title: 'What did you have it with?',
    subtitle: 'I will add these too. Pick all that apply.',
    multi: true,
    options: [
      { id: 'rice', label: 'Rice', emoji: '🍚', addFood: { id: 'white-rice', serving: 1 }, match: ['rice', 'bhat', 'bhaat', 'chawal'] },
      { id: 'roti', label: 'Roti', emoji: '🫓', addFood: { id: 'roti', qty: 2 }, match: ['roti', 'rotis', 'chapati', 'ruti'] },
      { id: 'naan', label: 'Naan', emoji: '🫓', addFood: { id: 'naan' }, match: ['naan', 'nan'] },
      { id: 'paratha', label: 'Paratha', emoji: '🫓', addFood: { id: 'paratha' }, match: ['paratha', 'porota', 'parota'] },
      { id: 'polao', label: 'Pulao', emoji: '🍛', addFood: { id: 'polao', serving: 1 }, match: ['pulao', 'polao', 'pilaf'] },
      { id: 'puri', label: 'Puri / luchi', emoji: '🫓', addFood: { id: 'puri', qty: 3 }, match: ['puri', 'luchi', 'poori'] },
    ],
  },
}

/** The questions to ask for a food, in order. Items added as sides only confirm their portion. */
export function questionsFor(food: Food, asSide = false): Question[] {
  if (asSide) return []
  return food.questions.map((k) => QUESTIONS[k])
}
