// Question bank for bot_19 Trivia Titan. Every answer is a stable, well-known fact.
// accept: lower-case words/phrases; an answer is correct when it contains ANY of them (as a word for ASCII, as text for Bengali).
// fun: an optional one-line extra shown with the answer.
const Q = (id, cat, qe, qb, ae, ab, accept, fe, fb) => ({ id, cat, q: { en: qe, bn: qb }, a: { en: ae, bn: ab }, accept, fun: fe ? { en: fe, bn: fb } : null });
export const TRIVIA = [
  Q('q-aus', 'geography', 'What is the capital city of Australia?', 'অস্ট্রেলিয়ার রাজধানী শহর কোনটি?', 'Canberra', 'ক্যানবেরা', ['canberra', 'ক্যানবেরা'], 'Many people guess Sydney, but Canberra was built as a compromise capital.', 'অনেকে সিডনি ভাবেন, কিন্তু ক্যানবেরা আপস-রাজধানী হিসেবে বানানো হয়েছিল।'),
  Q('q-ocean', 'geography', 'Which is the largest ocean on Earth?', 'পৃথিবীর বৃহত্তম মহাসাগর কোনটি?', 'The Pacific Ocean', 'প্রশান্ত মহাসাগর', ['pacific', 'প্রশান্ত'], 'It covers about a third of the planet\'s surface.', 'এটা পৃথিবীর পৃষ্ঠের প্রায় এক-তৃতীয়াংশ জুড়ে।'),
  Q('q-hex', 'math', 'How many sides does a hexagon have?', 'ষড়ভুজের কয়টি বাহু?', 'Six', 'ছয়টি', ['six', '6', 'ছয়', '৬'], 'Honeycomb cells are hexagons.', 'মৌচাকের ঘরগুলো ষড়ভুজ।'),
  Q('q-co2', 'science', 'Which gas do plants take in from the air for photosynthesis?', 'সালোকসংশ্লেষণের জন্য উদ্ভিদ বাতাস থেকে কোন গ্যাস নেয়?', 'Carbon dioxide', 'কার্বন ডাই-অক্সাইড', ['carbon dioxide', 'co2', 'co 2', 'কার্বন ডাই', 'কার্বন-ডাই'], 'They release oxygen in return.', 'বদলে তারা অক্সিজেন ছাড়ে।'),
  Q('q-dhaka', 'bangladesh', 'What is the capital of Bangladesh?', 'বাংলাদেশের রাজধানী কী?', 'Dhaka', 'ঢাকা', ['dhaka', 'dacca', 'ঢাকা'], null, null),
  Q('q-flower', 'bangladesh', 'What is the national flower of Bangladesh?', 'বাংলাদেশের জাতীয় ফুল কী?', 'The water lily (Shapla)', 'শাপলা', ['shapla', 'water lily', 'waterlily', 'শাপলা'], null, null),
  Q('q-tiger', 'bangladesh', 'Which animal is the national animal of Bangladesh?', 'বাংলাদেশের জাতীয় পশু কোনটি?', 'The Royal Bengal Tiger', 'রয়েল বেঙ্গল টাইগার', ['tiger', 'বাঘ', 'টাইগার'], 'The Sundarbans are its home.', 'সুন্দরবন এর বাসস্থান।'),
  Q('q-1971', 'bangladesh', 'In which year did Bangladesh win its independence?', 'বাংলাদেশ কত সালে স্বাধীনতা অর্জন করে?', '1971', '১৯৭১', ['1971', '১৯৭১'], null, null),
  Q('q-feb21', 'bangladesh', 'Which date is International Mother Language Day, linked to the Bengali Language Movement?', 'বাংলা ভাষা আন্দোলনের সঙ্গে জড়িত আন্তর্জাতিক মাতৃভাষা দিবস কত তারিখ?', '21 February', '২১ ফেব্রুয়ারি', ['21 february', 'february 21', '21 feb', '২১ ফেব্রুয়ারি', '২১শে ফেব্রুয়ারি', 'একুশে ফেব্রুয়ারি'], null, null),
  Q('q-sundarbans', 'bangladesh', 'Which famous mangrove forest is shared by Bangladesh and India?', 'বাংলাদেশ ও ভারতের মধ্যে বিস্তৃত বিখ্যাত ম্যানগ্রোভ বন কোনটি?', 'The Sundarbans', 'সুন্দরবন', ['sundarban', 'sundarbans', 'সুন্দরবন'], null, null),
  Q('q-coxs', 'bangladesh', 'Which Bangladeshi town is known for one of the world\'s longest natural sea beaches?', 'বিশ্বের অন্যতম দীর্ঘ প্রাকৃতিক সমুদ্রসৈকতের জন্য বিখ্যাত বাংলাদেশের শহর কোনটি?', 'Cox\'s Bazar', 'কক্সবাজার', ['cox', 'coxs', 'cox\'s', 'কক্সবাজার', 'কক্স'], null, null),
  Q('q-jupiter', 'space', 'Which is the largest planet in our solar system?', 'সৌরজগতের বৃহত্তম গ্রহ কোনটি?', 'Jupiter', 'বৃহস্পতি', ['jupiter', 'বৃহস্পতি'], null, null),
  Q('q-mars', 'space', 'Which planet is known as the Red Planet?', 'কোন গ্রহকে লাল গ্রহ বলা হয়?', 'Mars', 'মঙ্গল', ['mars', 'মঙ্গল'], 'Its red color comes from iron oxide.', 'এর লাল রং আয়রন অক্সাইডের জন্য।'),
  Q('q-moon', 'space', 'What is Earth\'s only natural satellite?', 'পৃথিবীর একমাত্র প্রাকৃতিক উপগ্রহ কী?', 'The Moon', 'চাঁদ', ['moon', 'চাঁদ'], null, null),
  Q('q-closest', 'space', 'Which planet is closest to the Sun?', 'সূর্যের সবচেয়ে কাছের গ্রহ কোনটি?', 'Mercury', 'বুধ', ['mercury', 'বুধ'], null, null),
  Q('q-h2o', 'science', 'What is the common name for H2O?', 'H2O-র সাধারণ নাম কী?', 'Water', 'পানি', ['water', 'পানি', 'জল'], null, null),
  Q('q-gold', 'science', 'What is the chemical symbol for gold?', 'সোনার রাসায়নিক প্রতীক কী?', 'Au', 'Au (অরাম)', ['au'], 'It comes from the Latin word "aurum".', 'এটা ল্যাটিন "aurum" শব্দ থেকে।'),
  Q('q-diamond', 'science', 'What is the hardest natural substance?', 'প্রাকৃতিক সবচেয়ে কঠিন পদার্থ কোনটি?', 'Diamond', 'হীরা', ['diamond', 'হীরা', 'হীরক'], null, null),
  Q('q-bones', 'science', 'How many bones does an adult human body have?', 'প্রাপ্তবয়স্ক মানুষের শরীরে কয়টি হাড় থাকে?', '206', '২০৬টি', ['206', '২০৬'], 'Babies are born with more, which fuse as they grow.', 'শিশুরা আরও বেশি নিয়ে জন্মায়, বড় হতে হতে কিছু জোড়া লাগে।'),
  Q('q-nitrogen', 'science', 'Which gas makes up most of Earth\'s air?', 'পৃথিবীর বাতাসের সিংহভাগ কোন গ্যাস?', 'Nitrogen (about 78 percent)', 'নাইট্রোজেন (প্রায় ৭৮ শতাংশ)', ['nitrogen', 'নাইট্রোজেন'], null, null),
  Q('q-heart', 'science', 'Which organ pumps blood around the body?', 'কোন অঙ্গ শরীরে রক্ত পাম্প করে?', 'The heart', 'হৃৎপিণ্ড', ['heart', 'হৃৎপিণ্ড', 'হার্ট', 'হৃদপিণ্ড'], null, null),
  Q('q-boil', 'science', 'At sea level, at what temperature in Celsius does water boil?', 'সমুদ্রপৃষ্ঠে পানি কত ডিগ্রি সেলসিয়াসে ফোটে?', '100 degrees Celsius', '১০০ ডিগ্রি সেলসিয়াস', ['100', '১০০', 'hundred'], null, null),
  Q('q-octopus', 'animals', 'How many hearts does an octopus have?', 'অক্টোপাসের কয়টি হৃৎপিণ্ড?', 'Three', 'তিনটি', ['three', '3', 'তিন', '৩'], null, null),
  Q('q-whale', 'animals', 'What is the largest animal on Earth?', 'পৃথিবীর সবচেয়ে বড় প্রাণী কোনটি?', 'The blue whale', 'নীল তিমি', ['blue whale', 'whale', 'তিমি'], null, null),
  Q('q-cheetah', 'animals', 'Which is the fastest land animal?', 'স্থলের দ্রুততম প্রাণী কোনটি?', 'The cheetah', 'চিতা', ['cheetah', 'চিতা'], null, null),
  Q('q-spider', 'animals', 'How many legs does a spider have?', 'মাকড়সার কয়টি পা?', 'Eight', 'আটটি', ['eight', '8', 'আট', '৮'], null, null),
  Q('q-continents', 'geography', 'How many continents are there?', 'মহাদেশ কয়টি?', 'Seven', 'সাতটি', ['seven', '7', 'সাত', '৭'], null, null),
  Q('q-everest', 'geography', 'What is the highest mountain above sea level?', 'সমুদ্রপৃষ্ঠ থেকে সবচেয়ে উঁচু পর্বত কোনটি?', 'Mount Everest', 'মাউন্ট এভারেস্ট', ['everest', 'এভারেস্ট'], null, null),
  Q('q-japan', 'geography', 'What is the capital of Japan?', 'জাপানের রাজধানী কী?', 'Tokyo', 'টোকিও', ['tokyo', 'টোকিও', 'টোকিয়ো'], null, null),
  Q('q-canada', 'geography', 'What is the capital of Canada?', 'কানাডার রাজধানী কী?', 'Ottawa', 'অটোয়া', ['ottawa', 'অটোয়া', 'ওটাওয়া'], null, null),
  Q('q-russia', 'geography', 'Which is the largest country by area?', 'আয়তনে বৃহত্তম দেশ কোনটি?', 'Russia', 'রাশিয়া', ['russia', 'রাশিয়া'], null, null),
  Q('q-sahara', 'geography', 'The Sahara is the world\'s largest hot desert. On which continent is it?', 'সাহারা বিশ্বের বৃহত্তম উষ্ণ মরুভূমি। এটি কোন মহাদেশে?', 'Africa', 'আফ্রিকা', ['africa', 'আফ্রিকা'], null, null),
  Q('q-rainbow', 'science', 'How many colors are traditionally counted in a rainbow?', 'রামধনুতে প্রচলিতভাবে কয়টি রং গণা হয়?', 'Seven', 'সাতটি', ['seven', '7', 'সাত', '৭'], null, null),
  Q('q-shakes', 'culture', 'Who wrote the play "Romeo and Juliet"?', '"রোমিও অ্যান্ড জুলিয়েট" নাটকটি কে লিখেছেন?', 'William Shakespeare', 'উইলিয়াম শেক্সপিয়র', ['shakespeare', 'শেক্সপিয়র', 'শেক্সপীয়র'], null, null),
  Q('q-tagore', 'culture', 'Who wrote the song "Amar Shonar Bangla", the national anthem of Bangladesh?', 'বাংলাদেশের জাতীয় সংগীত "আমার সোনার বাংলা" কে লিখেছেন?', 'Rabindranath Tagore', 'রবীন্দ্রনাথ ঠাকুর', ['tagore', 'rabindranath', 'রবীন্দ্রনাথ', 'রবীন্দ্র'], 'He won the Nobel Prize in Literature in 1913.', 'তিনি ১৯১৩ সালে সাহিত্যে নোবেল পুরস্কার পান।'),
  Q('q-yen', 'culture', 'What is the currency of Japan?', 'জাপানের মুদ্রার নাম কী?', 'The yen', 'ইয়েন', ['yen', 'ইয়েন'], null, null),
  Q('q-prime', 'math', 'What is the smallest prime number?', 'ক্ষুদ্রতম মৌলিক সংখ্যা কত?', 'Two', '২', ['two', '2', 'দুই', '২'], 'It is also the only even prime.', 'এটাই একমাত্র জোড় মৌলিক সংখ্যা।'),
  Q('q-144', 'math', 'What is the square root of 144?', '১৪৪-এর বর্গমূল কত?', '12', '১২', ['12', '১২', 'twelve', 'বারো'], null, null),
  Q('q-leap', 'math', 'How many days are there in a leap year?', 'অধিবর্ষে কত দিন থাকে?', '366', '৩৬৬', ['366', '৩৬৬'], null, null),
  Q('q-triangle', 'math', 'How many degrees do the angles of a triangle add up to?', 'ত্রিভুজের তিন কোণের সমষ্টি কত ডিগ্রি?', '180 degrees', '১৮০ ডিগ্রি', ['180', '১৮০'], null, null),
  Q('q-binary', 'tech', 'Binary uses only two digits. Which are they?', 'বাইনারিতে মাত্র দুটি অঙ্ক ব্যবহার হয়। সেগুলো কী?', '0 and 1', '০ আর ১', ['0 and 1', '1 and 0', '0 1', '০ ও ১', '০ আর ১', '০ এবং ১', 'zero and one', 'zero one'], null, null),
  Q('q-html', 'tech', 'What does the "HT" in HTML stand for?', 'HTML-এর "HT" কিসের সংক্ষেপ?', 'HyperText', 'হাইপারটেক্সট', ['hypertext', 'hyper text', 'হাইপারটেক্সট', 'হাইপার টেক্সট'], null, null),
  Q('q-football', 'sports', 'How many players from one team are on the field in a football (soccer) match?', 'ফুটবল ম্যাচে এক দলের কয়জন খেলোয়াড় মাঠে থাকে?', 'Eleven', 'এগারো জন', ['eleven', '11', 'এগারো', '১১'], null, null),
  Q('q-olympic', 'sports', 'How many rings are in the Olympic symbol?', 'অলিম্পিক প্রতীকে কয়টি বৃত্ত?', 'Five', 'পাঁচটি', ['five', '5', 'পাঁচ', '৫'], null, null),
  Q('q-chess', 'sports', 'How many pieces does each player start with in chess?', 'দাবায় প্রতিটি খেলোয়াড় কয়টি ঘুঁটি নিয়ে শুরু করে?', 'Sixteen', 'ষোলোটি', ['sixteen', '16', 'ষোল', '১৬'], null, null)
];
export const TRIVIA_BY_ID = new Map(TRIVIA.map((q) => [q.id, q]));
export const TRIVIA_CATS = ['geography', 'bangladesh', 'science', 'space', 'animals', 'math', 'tech', 'sports', 'culture'];

// Is `text` a correct answer to `q`? Short ASCII accept-words must match whole words ("6" must not match "16").
export function checkAnswer(q, text) {
  const t = ` ${String(text || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s.+\-']/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  return q.accept.some((w) => {
    if (/^[\x00-\x7f]+$/.test(w)) return t.includes(` ${w} `) || (w.length > 4 && t.includes(w));
    return t.includes(w);
  });
}
