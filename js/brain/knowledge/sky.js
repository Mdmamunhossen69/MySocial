// Knowledge for bot_17 Sky Watcher + a small offline Moon-phase calculator.
export const SYNODIC = 29.530588853;                 // days between two new moons (mean)
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);   // a well-known new moon

// APPROXIMATE moon phase for an instant. Uses the mean lunar month, so it can be off by up to about a day
// near the changes; the bot always says "about" and never claims exact times.
export function moonPhase(date = new Date()) {
  const days = (date.getTime() - REF_NEW_MOON) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const lit = (1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2;
  const edges = [[1.84566, 'new'], [5.53699, 'waxing-crescent'], [9.22831, 'first-quarter'], [12.91963, 'waxing-gibbous'], [16.61096, 'full'],
    [20.30228, 'waning-gibbous'], [23.99361, 'last-quarter'], [27.68493, 'waning-crescent']];
  const hit = edges.find(([limit]) => age < limit);
  return { age: Math.round(age * 10) / 10, illumination: Math.round(lit * 100), phase: hit ? hit[1] : 'new' };
}
export const PHASE_NAME = {
  new: { en: 'a new moon (almost invisible)', bn: 'অমাবস্যার কাছাকাছি নতুন চাঁদ (প্রায় দেখা যায় না)' },
  'waxing-crescent': { en: 'a waxing crescent', bn: 'বাড়তে থাকা চিকন চাঁদ' },
  'first-quarter': { en: 'a first quarter moon (half lit, growing)', bn: 'প্রথম চতুর্থাংশের চাঁদ (অর্ধেক আলোকিত, বাড়ছে)' },
  'waxing-gibbous': { en: 'a waxing gibbous moon', bn: 'বাড়তে থাকা প্রায়-পূর্ণ চাঁদ' },
  full: { en: 'a full moon', bn: 'পূর্ণিমার চাঁদ' },
  'waning-gibbous': { en: 'a waning gibbous moon', bn: 'কমতে থাকা প্রায়-পূর্ণ চাঁদ' },
  'last-quarter': { en: 'a last quarter moon (half lit, shrinking)', bn: 'শেষ চতুর্থাংশের চাঁদ (অর্ধেক আলোকিত, কমছে)' },
  'waning-crescent': { en: 'a waning crescent', bn: 'কমতে থাকা চিকন চাঁদ' }
};
export function moonSentence(date, lang) {
  const m = moonPhase(date);
  const n = PHASE_NAME[m.phase][lang];
  return lang === 'bn'
    ? `হিসেব অনুযায়ী চাঁদ এখন ${n}, প্রায় ${m.illumination}% আলোকিত (আনুমানিক, এক দিনের মতো এদিক-ওদিক হতে পারে)।`
    : `By my calculation the Moon is ${n}, about ${m.illumination}% lit (approximate, it can be off by about a day).`;
}

export const SKY = [
  { id: 's-sunlight', topic: 'astronomy', tip: true, title: { en: 'sunlight travel time', bn: 'সূর্যের আলোর পথ চলা' }, keys: ['sunlight', 'speed of light', 'light speed', 'আলোর গতি', 'সূর্যের আলো'],
    en: 'Sunlight takes about 8 minutes and 20 seconds to reach Earth. Light travels roughly 300,000 kilometers every second.',
    bn: 'সূর্যের আলো পৃথিবীতে পৌঁছাতে প্রায় ৮ মিনিট ২০ সেকেন্ড লাগে। আলো প্রতি সেকেন্ডে প্রায় ৩ লক্ষ কিলোমিটার যায়।' },
  { id: 's-dark-adapt', topic: 'astronomy', tip: true, title: { en: 'seeing more stars', bn: 'বেশি তারা দেখার উপায়' }, keys: ['see more stars', 'dark adaptation', 'stargazing tips', 'stargazing', 'night vision', 'তারা দেখা', 'অন্ধকারে চোখ'],
    en: 'Give your eyes about 20 minutes in the dark and you will see many more stars. Avoid your phone screen, or use a red light, and get away from street lights.',
    bn: 'অন্ধকারে চোখকে প্রায় ২০ মিনিট সময় দিন, অনেক বেশি তারা দেখবেন। ফোনের স্ক্রিন এড়ান বা লাল আলো ব্যবহার করুন, আর রাস্তার আলো থেকে দূরে যান।' },
  { id: 's-milkyway', topic: 'astronomy', tip: true, title: { en: 'the Milky Way', bn: 'ছায়াপথ (মিল্কিওয়ে)' }, keys: ['milky way', 'galaxy', 'our galaxy', 'ছায়াপথ', 'মিল্কিওয়ে', 'গ্যালাক্সি'],
    en: 'The Milky Way is our home galaxy, with hundreds of billions of stars. On a clear, dark night you can see it as a pale band across the sky, but city lights hide it.',
    bn: 'ছায়াপথ আমাদের নিজের গ্যালাক্সি, এতে শত শত কোটি তারা আছে। পরিষ্কার, অন্ধকার রাতে এটা আকাশজুড়ে ফ্যাকাশে একটা ফিতার মতো দেখা যায়, তবে শহরের আলো তা ঢেকে দেয়।' },
  { id: 's-saturn', topic: 'astronomy', tip: true, title: { en: 'Saturn\'s rings', bn: 'শনির বলয়' }, keys: ['saturn', 'rings', 'শনি', 'বলয়'],
    en: 'Saturn\'s rings are made mostly of ice particles, from tiny grains to boulder-sized chunks. They are very wide but extremely thin.',
    bn: 'শনির বলয় বেশিরভাগই বরফের কণা দিয়ে তৈরি, ছোট দানা থেকে পাথরের মতো বড় টুকরো পর্যন্ত। এটা খুব চওড়া কিন্তু অত্যন্ত পাতলা।' },
  { id: 's-planets-eye', topic: 'astronomy', tip: true, title: { en: 'planets you can see without a telescope', bn: 'খালি চোখে দেখা যায় এমন গ্রহ' }, keys: ['naked eye', 'see planets', 'visible planets', 'bright planet', 'খালি চোখে', 'গ্রহ দেখা'],
    en: 'Five planets can be seen with the naked eye: Mercury, Venus, Mars, Jupiter and Saturn. Planets shine steadily while stars twinkle. Which ones are up changes through the year.',
    bn: 'খালি চোখে পাঁচটি গ্রহ দেখা যায়: বুধ, শুক্র, মঙ্গল, বৃহস্পতি ও শনি। গ্রহ স্থির আলো দেয়, তারা মিটমিট করে। কোনটা কখন আকাশে থাকবে তা বছরজুড়ে বদলায়।' },
  { id: 's-eight-planets', topic: 'astronomy', title: { en: 'how many planets there are', bn: 'গ্রহের সংখ্যা' }, keys: ['how many planets', 'planets in solar system', 'pluto', 'dwarf planet', 'কয়টি গ্রহ', 'প্লুটো', 'বামন গ্রহ'],
    en: 'There are eight planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Pluto is classed as a dwarf planet.',
    bn: 'আমাদের সৌরজগতে আটটি গ্রহ: বুধ, শুক্র, পৃথিবী, মঙ্গল, বৃহস্পতি, শনি, ইউরেনাস ও নেপচুন। প্লুটোকে বামন গ্রহ ধরা হয়।' },
  { id: 's-moonphases', topic: 'astronomy', tip: true, title: { en: 'why the Moon has phases', bn: 'চাঁদের কলা কেন হয়' }, keys: ['moon phases', 'phases of the moon', 'why moon changes', 'চাঁদের কলা', 'চাঁদ কেন বদলায়'],
    en: 'The Moon has phases because we see different amounts of its Sun-lit half as it orbits Earth, about every 29.5 days. It is not Earth\'s shadow; that only happens during a lunar eclipse.',
    bn: 'চাঁদ পৃথিবীকে ঘোরার সময় (প্রায় ২৯.৫ দিনে) তার সূর্যের আলোয় আলোকিত অর্ধেকের কতটুকু আমরা দেখি তা বদলায়, তাই কলা হয়। এটা পৃথিবীর ছায়া নয়, ছায়া পড়ে শুধু চন্দ্রগ্রহণে।' },
  { id: 's-moonface', topic: 'astronomy', title: { en: 'the same side of the Moon', bn: 'চাঁদের একই পিঠ' }, keys: ['same side', 'far side', 'dark side', 'tidal lock', 'চাঁদের উল্টো পিঠ', 'একই পিঠ'],
    en: 'We always see the same side of the Moon because it spins once for every orbit, called tidal locking. The far side is not dark, it just faces away from us.',
    bn: 'আমরা চাঁদের একই পিঠ দেখি কারণ প্রতি কক্ষপথ ঘোরার সময় সে একবার নিজ অক্ষে ঘোরে, একে টাইডাল লকিং বলে। উল্টো পিঠ অন্ধকার নয়, শুধু আমাদের দিকে ফেরানো নয়।' },
  { id: 's-moondist', topic: 'astronomy', title: { en: 'how far the Moon is', bn: 'চাঁদ কত দূরে' }, keys: ['moon distance', 'how far moon', 'চাঁদ কত দূর'],
    en: 'The Moon is about 384,000 kilometers from Earth on average. Light from it reaches us in a little over one second.',
    bn: 'চাঁদ পৃথিবী থেকে গড়ে প্রায় ৩,৮৪,০০০ কিলোমিটার দূরে। তার আলো আমাদের কাছে পৌঁছাতে এক সেকেন্ডের একটু বেশি লাগে।' },
  { id: 's-apollo', topic: 'astronomy', title: { en: 'the first Moon landing', bn: 'প্রথম চাঁদে অবতরণ' }, keys: ['apollo', 'moon landing', 'neil armstrong', 'first man on moon', 'আপোলো', 'চাঁদে মানুষ', 'নীল আর্মস্ট্রং'],
    en: 'Apollo 11 landed the first humans on the Moon on 20 July 1969: Neil Armstrong and Buzz Aldrin walked on the surface while Michael Collins stayed in orbit.',
    bn: 'আপোলো ১১ ১৯৬৯ সালের ২০ জুলাই প্রথম মানুষকে চাঁদে নামায়: নীল আর্মস্ট্রং ও বাজ অলড্রিন চাঁদের মাটিতে হাঁটেন, আর মাইকেল কলিন্স কক্ষপথে ছিলেন।' },
  { id: 's-lightyear', topic: 'astronomy', tip: true, title: { en: 'what a light-year is', bn: 'আলোকবর্ষ কী' }, keys: ['light year', 'light-year', 'আলোকবর্ষ'],
    en: 'A light-year is a distance, not a time: how far light travels in one year, about 9.46 trillion kilometers.',
    bn: 'আলোকবর্ষ সময় নয়, দূরত্ব: আলো এক বছরে যতদূর যায়, প্রায় ৯.৪৬ লক্ষ কোটি কিলোমিটার।' },
  { id: 's-polaris', topic: 'astronomy', tip: true, title: { en: 'the North Star', bn: 'ধ্রুবতারা' }, keys: ['north star', 'polaris', 'find north', 'ধ্রুবতারা', 'উত্তর দিক'],
    en: 'The North Star, Polaris, sits almost exactly above Earth\'s north pole, so it hardly moves while the other stars wheel around it. It is not the brightest star. In the northern hemisphere it helps you find north.',
    bn: 'ধ্রুবতারা (পোলারিস) পৃথিবীর উত্তর মেরুর প্রায় ঠিক ওপরে, তাই অন্য তারারা ঘোরে কিন্তু এটা প্রায় নড়ে না। এটা সবচেয়ে উজ্জ্বল তারা নয়। উত্তর গোলার্ধে এটা দিয়ে উত্তর দিক চেনা যায়।' },
  { id: 's-twinkle', topic: 'astronomy', tip: true, title: { en: 'why stars twinkle', bn: 'তারা মিটমিট করে কেন' }, keys: ['twinkle', 'twinkling', 'why stars blink', 'মিটমিট', 'তারা কেন'],
    en: 'Stars twinkle because their light passes through moving layers of Earth\'s air, which bend it a little. Planets look steadier because they are bigger discs in the sky.',
    bn: 'তারা মিটমিট করে কারণ তাদের আলো পৃথিবীর বাতাসের নড়তে থাকা স্তরের মধ্য দিয়ে আসে, আর সেগুলো আলোকে একটু বাঁকায়। গ্রহ আকাশে বড় চাকতির মতো, তাই স্থির দেখায়।' },
  { id: 's-meteor', topic: 'astronomy', tip: true, title: { en: 'shooting stars', bn: 'উল্কা' }, keys: ['shooting star', 'meteor', 'meteor shower', 'falling star', 'উল্কা', 'তারা খসে'],
    en: 'A shooting star is a meteor: a tiny grain of space dust, often smaller than a pea, burning up in the atmosphere. Meteor showers happen when Earth crosses a comet\'s trail of dust.',
    bn: 'উল্কা (শুটিং স্টার) আসলে মহাকাশের ধুলোর ছোট কণা, প্রায়ই মটরদানার চেয়েও ছোট, যা বায়ুমণ্ডলে পুড়ে যায়। পৃথিবী ধূমকেতুর ফেলে যাওয়া ধুলোর পথ পার হলে উল্কাবৃষ্টি হয়।' },
  { id: 's-lunar-eclipse', topic: 'astronomy', title: { en: 'lunar eclipse', bn: 'চন্দ্রগ্রহণ' }, keys: ['lunar eclipse', 'blood moon', 'চন্দ্রগ্রহণ'],
    en: 'A lunar eclipse happens when Earth moves between the Sun and a full Moon and its shadow falls on the Moon. It is safe to watch with your eyes.',
    bn: 'সূর্য আর পূর্ণ চাঁদের মাঝখানে পৃথিবী এলে পৃথিবীর ছায়া চাঁদে পড়ে, একে চন্দ্রগ্রহণ বলে। খালি চোখে দেখা নিরাপদ।' },
  { id: 's-solar-eclipse', topic: 'astronomy', title: { en: 'solar eclipse', bn: 'সূর্যগ্রহণ' }, keys: ['solar eclipse', 'eclipse', 'sun eclipse', 'সূর্যগ্রহণ', 'গ্রহণ'],
    en: 'A solar eclipse happens when the Moon passes between Earth and the Sun. Never look at the Sun directly, even partly eclipsed; use proper eclipse glasses.',
    bn: 'পৃথিবী ও সূর্যের মাঝখান দিয়ে চাঁদ গেলে সূর্যগ্রহণ হয়। সূর্যের দিকে সরাসরি, আংশিক গ্রহণেও, কখনো তাকাবেন না; সঠিক গ্রহণ-চশমা ব্যবহার করুন।' },
  { id: 's-venus', topic: 'astronomy', tip: true, title: { en: 'Venus', bn: 'শুক্র গ্রহ' }, keys: ['venus', 'hottest planet', 'শুক্র', 'গরম গ্রহ'],
    en: 'Venus is the hottest planet because its thick carbon-dioxide atmosphere traps heat. A day on Venus (about 243 Earth days) is longer than its year (about 225 Earth days).',
    bn: 'শুক্র সবচেয়ে গরম গ্রহ, কারণ এর ঘন কার্বন ডাই-অক্সাইডের বায়ুমণ্ডল তাপ আটকে রাখে। শুক্রের একটা দিন (প্রায় ২৪৩ পৃথিবী-দিন) তার বছরের (প্রায় ২২৫ পৃথিবী-দিন) চেয়ে লম্বা।' },
  { id: 's-mars', topic: 'astronomy', tip: true, title: { en: 'Mars', bn: 'মঙ্গল গ্রহ' }, keys: ['mars', 'red planet', 'মঙ্গল', 'লাল গ্রহ'],
    en: 'Mars looks red because its dust and rocks contain iron oxide, like rust. It has the tallest volcano known in the solar system, Olympus Mons.',
    bn: 'মঙ্গল লাল দেখায় কারণ এর ধুলো ও পাথরে মরচের মতো আয়রন অক্সাইড আছে। সৌরজগতের সবচেয়ে উঁচু জানা আগ্নেয়গিরি অলিম্পাস মন্স এখানে।' },
  { id: 's-jupiter', topic: 'astronomy', tip: true, title: { en: 'Jupiter', bn: 'বৃহস্পতি গ্রহ' }, keys: ['jupiter', 'great red spot', 'biggest planet', 'largest planet', 'বৃহস্পতি', 'সবচেয়ে বড় গ্রহ'],
    en: 'Jupiter is the largest planet: all the other planets would fit inside it. Its Great Red Spot is a giant storm that has been seen for well over a century.',
    bn: 'বৃহস্পতি সবচেয়ে বড় গ্রহ: অন্য সব গ্রহ এর ভেতরে ঢুকে যাবে। এর গ্রেট রেড স্পট একটা বিশাল ঝড়, যা একশো বছরেরও বেশি সময় ধরে দেখা যাচ্ছে।' },
  { id: 's-sun', topic: 'astronomy', title: { en: 'the Sun', bn: 'সূর্য' }, keys: ['sun', 'star sun', 'how old sun', 'সূর্য'],
    en: 'The Sun is a star, about 4.6 billion years old, and holds more than 99 percent of the solar system\'s mass.',
    bn: 'সূর্য একটা তারা, বয়স প্রায় ৪৬০ কোটি বছর, আর সৌরজগতের ৯৯ শতাংশেরও বেশি ভর এর মধ্যে।' },
  { id: 's-seasons', topic: 'astronomy', title: { en: 'why we have seasons', bn: 'ঋতু কেন হয়' }, keys: ['seasons', 'season', 'earth tilt', 'ঋতু', 'কেন ঋতু'],
    en: 'Seasons come from the tilt of Earth\'s axis (about 23.5 degrees), not from distance to the Sun. The tilt changes how directly sunlight hits each region through the year.',
    bn: 'ঋতু হয় পৃথিবীর অক্ষের হেলানোর (প্রায় ২৩.৫ ডিগ্রি) কারণে, সূর্যের দূরত্বের কারণে নয়। হেলানোর ফলে বছরের বিভিন্ন সময়ে প্রতিটি অঞ্চলে সূর্যের আলো কতটা সোজা পড়ে তা বদলায়।' },
  { id: 's-iss', topic: 'astronomy', tip: true, title: { en: 'the International Space Station', bn: 'আন্তর্জাতিক মহাকাশ স্টেশন' }, keys: ['iss', 'space station', 'international space station', 'মহাকাশ স্টেশন', 'আইএসএস'],
    en: 'The International Space Station circles Earth about every 90 minutes at roughly 400 kilometers up. It can look like a bright, steady moving star at dusk or dawn.',
    bn: 'আন্তর্জাতিক মহাকাশ স্টেশন প্রায় ৪০০ কিলোমিটার ওপরে প্রতি প্রায় ৯০ মিনিটে পৃথিবীকে ঘোরে। ভোরে বা সন্ধ্যায় এটা উজ্জ্বল, স্থির, চলমান তারার মতো দেখা যেতে পারে।' },
  { id: 's-blackhole', topic: 'astronomy', tip: true, title: { en: 'black holes', bn: 'ব্ল্যাকহোল' }, keys: ['black hole', 'blackhole', 'event horizon', 'ব্ল্যাকহোল', 'কৃষ্ণগহ্বর'],
    en: 'A black hole is a region where gravity is so strong that nothing, not even light, can escape once it crosses the edge, called the event horizon. Many form when very massive stars collapse.',
    bn: 'ব্ল্যাকহোল এমন জায়গা যেখানে মহাকর্ষ এত শক্তিশালী যে ইভেন্ট হরাইজন নামের সীমা পার হলে আলোও বেরোতে পারে না। অনেকগুলো খুব ভারী তারা ধসে পড়লে তৈরি হয়।' },
  { id: 's-andromeda', topic: 'astronomy', title: { en: 'the Andromeda galaxy', bn: 'অ্যান্ড্রোমিডা গ্যালাক্সি' }, keys: ['andromeda', 'nearest galaxy', 'অ্যান্ড্রোমিডা'],
    en: 'The Andromeda galaxy is about 2.5 million light-years away and is the farthest thing most people can see with the naked eye, as a faint smudge under dark skies.',
    bn: 'অ্যান্ড্রোমিডা গ্যালাক্সি প্রায় ২৫ লক্ষ আলোকবর্ষ দূরে, অন্ধকার আকাশে ঝাপসা দাগের মতো। খালি চোখে সাধারণত এটাই সবচেয়ে দূরের দেখা যায়।' },
  { id: 's-sirius', topic: 'astronomy', title: { en: 'the brightest star', bn: 'সবচেয়ে উজ্জ্বল তারা' }, keys: ['brightest star', 'sirius', 'dog star', 'সবচেয়ে উজ্জ্বল তারা', 'সিরিয়াস'],
    en: 'Sirius is the brightest star in our night sky (not counting the Sun). It looks bright partly because it is very close, about 8.6 light-years away.',
    bn: 'সিরিয়াস আমাদের রাতের আকাশের সবচেয়ে উজ্জ্বল তারা (সূর্য বাদে)। এটা কাছে বলেই এত উজ্জ্বল দেখায়, প্রায় ৮.৬ আলোকবর্ষ দূরে।' },
  { id: 's-orion', topic: 'astronomy', tip: true, title: { en: 'Orion', bn: 'কালপুরুষ (ওরিয়ন)' }, keys: ['orion', 'orion belt', 'constellation', 'কালপুরুষ', 'ওরিয়ন', 'নক্ষত্রমণ্ডল'],
    en: 'Orion is easy to spot by the three stars in a row that form its belt. From many northern places it is a winter evening constellation, so it is worth looking for on a clear winter night.',
    bn: 'ওরিয়ন (কালপুরুষ) চেনা সহজ, কোমরবন্ধ বানানো সারিবদ্ধ তিনটি তারা দেখে। উত্তর গোলার্ধের অনেক জায়গায় এটা শীতের সন্ধ্যার নক্ষত্রমণ্ডল, তাই পরিষ্কার শীতের রাতে খুঁজে দেখার মতো।' },
  { id: 's-comet', topic: 'astronomy', title: { en: 'comets', bn: 'ধূমকেতু' }, keys: ['comet', 'halley', 'ধূমকেতু', 'হ্যালি'],
    en: 'A comet is a ball of ice and dust. When it nears the Sun it heats up and grows a glowing tail that always points away from the Sun. Halley\'s Comet returns about every 76 years.',
    bn: 'ধূমকেতু বরফ ও ধুলোর গোলা। সূর্যের কাছে এলে গরম হয়ে উজ্জ্বল লেজ গজায়, যা সবসময় সূর্যের উল্টো দিকে থাকে। হ্যালির ধূমকেতু প্রায় ৭৬ বছর পরপর ফেরে।' },
  { id: 's-telescope', topic: 'astronomy', tip: true, title: { en: 'binoculars or telescope for beginners', bn: 'শুরুতে বাইনোকুলার না টেলিস্কোপ' }, keys: ['telescope', 'binoculars', 'beginner telescope', 'টেলিস্কোপ', 'বাইনোকুলার'],
    en: 'Beginners often do better with ordinary binoculars: they are cheap, easy to point and show the Moon\'s craters, Jupiter\'s moons and star clusters. A steady mount matters more than big magnification.',
    bn: 'শুরুতে সাধারণ বাইনোকুলারই প্রায়ই ভালো: সস্তা, তাক করা সহজ, আর চাঁদের গর্ত, বৃহস্পতির চাঁদ ও তারাগুচ্ছ দেখায়। বড় ম্যাগনিফিকেশনের চেয়ে স্থির স্ট্যান্ড বেশি জরুরি।' },
  { id: 's-photo', topic: 'photo', tip: true, title: { en: 'photographing the night sky', bn: 'রাতের আকাশের ছবি' }, keys: ['photograph stars', 'night photography', 'astrophotography', 'moon photo', 'ছবি তোলা তারা', 'রাতের ছবি'],
    en: 'For night-sky photos, steady the phone on a stand or a wall, use night mode and a timer so you do not shake it, and shoot away from lights. The Moon is easy; faint stars need longer exposure.',
    bn: 'রাতের আকাশের ছবির জন্য ফোন স্ট্যান্ডে বা দেয়ালে স্থির রাখুন, নাইট মোড ও টাইমার ব্যবহার করুন যেন হাত না কাঁপে, আর আলো থেকে দূরে তুলুন। চাঁদ সহজ, ঝাপসা তারার জন্য বেশি সময় এক্সপোজার লাগে।' },
  { id: 's-gravity', topic: 'astronomy', title: { en: 'gravity in space', bn: 'মহাকাশে মহাকর্ষ' }, keys: ['gravity', 'weightless', 'zero gravity', 'astronaut float', 'মহাকর্ষ', 'ভারশূন্য', 'ওজনহীন'],
    en: 'Astronauts float on the space station not because there is no gravity (it is about 90 percent as strong as on the ground) but because they and the station are in constant free fall around Earth.',
    bn: 'মহাকাশ স্টেশনে নভোচারীরা ভাসে মহাকর্ষ নেই বলে নয় (ভূমির প্রায় ৯০ শতাংশ আছে), বরং তারা ও স্টেশন পৃথিবীকে ঘিরে অবিরাম মুক্তপতনে আছে বলে।' },
  { id: 's-moonfacts', topic: 'astronomy', tip: true, title: { en: 'the Moon', bn: 'চাঁদ' }, keys: ['moon', 'the moon', 'about the moon', 'চাঁদ', 'চাঁদ সম্পর্কে'],
    en: 'The Moon is about 384,000 kilometers away, roughly a quarter of Earth\'s width, and it always shows us the same face. It has no air, so it has no weather. Its pull also helps cause ocean tides.',
    bn: 'চাঁদ পৃথিবী থেকে প্রায় ৩,৮৪,০০০ কিলোমিটার দূরে, আকারে পৃথিবীর প্রায় এক-চতুর্থাংশ, আর আমরা সবসময় এর একই পাশ দেখি। এতে বাতাস নেই, তাই আবহাওয়াও নেই। এর টানে সমুদ্রে জোয়ার-ভাটা হয়।' },
  { id: 's-moonillusion', topic: 'astronomy', tip: true, title: { en: 'why the Moon looks big near the horizon', bn: 'দিগন্তে চাঁদ বড় দেখায় কেন' }, keys: ['moon looks big', 'moon illusion', 'big moon', 'moon bigger', 'চাঁদ বড় দেখায়', 'চাঁদ কেন বড়'],
    en: 'A Moon near the horizon looks bigger mainly because of an illusion in our brain, not because it is closer. Measure it with a coin at arm\'s length and you will see the size barely changes.',
    bn: 'দিগন্তের কাছে চাঁদ বড় দেখায় মূলত আমাদের মস্তিষ্কের দৃষ্টিভ্রমের কারণে, কাছে আসার কারণে নয়। হাত বাড়িয়ে একটা মুদ্রা ধরে মাপলে দেখবেন আকার প্রায় বদলায়নি।' },
];
