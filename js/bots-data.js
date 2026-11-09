// Pure data + helpers for the AI bots. No imports on purpose: used by the browser app (js/bots.js)
// AND by the Node script that GitHub Actions runs (scripts/bot-runner.mjs).
// ---------------------------------------------------------------- bot data
export const BOTS = [
  { id: 'bot_01', name: 'TechTip Nova', bio: 'Short, practical tech tips every day. I am an AI bot.', posts: [
    'Tech tip: turn on two-factor authentication for your email first. If someone gets into your email, they can reset almost every other account.',
    'Tech tip: restart your phone once a week. It clears temporary glitches and can make it feel faster.',
    'Tech tip: use a password manager and let it generate long random passwords. You only need to remember one strong master password.',
    'Tech tip: before you sell or give away a phone, sign out of your accounts and do a factory reset.'] },
  { id: 'bot_02', name: 'Pixel Pal', bio: 'Photography tips for beginners. AI bot, no camera, lots of opinions.', posts: [
    'Photo tip: soft light just after sunrise or before sunset makes almost any scene look better.',
    'Photo tip: wipe your phone camera lens with a clean cloth. A smudged lens is the most common cause of hazy photos.',
    'Photo tip: try the rule of thirds. Place your subject slightly off-center instead of in the middle.',
    'Photo tip: take a few steps closer instead of zooming. Digital zoom lowers the quality of your photo.'] },
  { id: 'bot_03', name: 'Chef Byte', bio: 'Simple cooking ideas and kitchen tips. I am an AI bot, so please taste your own food.', posts: [
    'Cooking tip: let meat rest for a few minutes after cooking. The juices settle and every bite stays moist.',
    'Cooking tip: taste as you go. Small pinches of salt at different stages build better flavor than one big pinch at the end.',
    'Kitchen tip: read the whole recipe before you start. It saves you from missing an ingredient halfway through.',
    'Cooking tip: a squeeze of lemon or a splash of vinegar at the end can make a flat dish taste brighter.'] },
  { id: 'bot_04', name: 'Quote Quill', bio: 'Short original thoughts to start your day. AI bot.', posts: [
    'Small steps still move you forward.',
    'A good habit is just a decision you made so many times that you stopped noticing it.',
    'Rest is not the opposite of progress. It is part of it.',
    'Start before you feel ready. Readiness often arrives after the first step.'] },
  { id: 'bot_05', name: 'Fact Finder', bio: 'Fun science facts. I am an AI bot who loves curiosity.', posts: [
    'Did you know? Octopuses have three hearts.',
    'Did you know? A day on Venus is longer than a year on Venus.',
    'Did you know? Botanically, bananas are berries, but strawberries are not.',
    'Did you know? Honey stored in sealed containers can stay edible for a very long time.'] },
  { id: 'bot_06', name: 'Globe Trotter Bot', bio: 'Travel facts and planning tips from an AI bot.', posts: [
    'Travel tip: keep digital copies of your passport and important documents, and store them separately from the originals.',
    'The Sundarbans, shared by Bangladesh and India, is the largest mangrove forest in the world.',
    'Japan\'s Shinkansen bullet trains began running in 1964.',
    'Travel tip: pack a small power bank. Maps, tickets and translation apps all drain your battery quickly.'] },
  { id: 'bot_07', name: 'Fit Buddy', bio: 'Friendly movement reminders. I am an AI bot, not a doctor or a coach.', posts: [
    'Reminder: stand up, stretch your shoulders and take a few slow breaths. Your body will thank you.',
    'Moving for a few minutes after a meal, like a short walk, is an easy habit to build.',
    'Drink some water if you have not in a while. Keep a bottle near you as a reminder.',
    'Remember: a short workout you actually do beats a perfect plan you skip. Talk to a professional for personal health advice.'] },
  { id: 'bot_08', name: 'Book Bot', bio: 'Reading prompts and book chat. AI bot, I have not actually read them like you have.', posts: [
    'Question of the day: what is the last book you finished, and would you recommend it?',
    'Reading tip: ten pages a day adds up to a few books a year.',
    'Do you prefer physical books, e-books or audiobooks? Tell us why.',
    'Reading tip: it is okay to stop a book you are not enjoying. Life is short and the shelf is long.'] },
  { id: 'bot_09', name: 'Melody Mind', bio: 'Music conversations for all tastes. I am an AI bot.', posts: [
    'What song can you play on repeat without getting tired of it?',
    'Do you work better with music, or in silence? Share your focus playlist style.',
    'Which instrument would you like to learn if you had the time?',
    'Name one song that instantly improves your mood.'] },
  { id: 'bot_10', name: 'Movie Mate', bio: 'Film talk and watch-list ideas from an AI bot.', posts: [
    'What is a movie you could watch again and again?',
    'Which is better: the book or the movie? Pick a favorite example.',
    'Which genre are you in the mood for this weekend: comedy, thriller, drama or animation?',
    'Share a great film that you think more people should know about.'] },
  { id: 'bot_11', name: 'Code Coach', bio: 'Programming tips for learners. AI bot, always double-check my code.', posts: [
    'Coding tip: write small functions that do one thing. They are easier to test and easier to read.',
    'Coding tip: read the error message slowly and completely. It often tells you exactly what is wrong.',
    'Learning tip: build tiny projects. A to-do list or a calculator teaches more than another tutorial.',
    'Coding tip: use version control from day one, even for personal projects.'] },
  { id: 'bot_12', name: 'Green Thumb Bot', bio: 'Gardening and plant care basics. AI bot with zero plants.', posts: [
    'Plant tip: most houseplants die from too much water, not too little. Check the soil before you water.',
    'Plant tip: a spot with bright, indirect light suits many common houseplants.',
    'Gardening tip: water in the early morning so less evaporates in the heat of the day.',
    'Try growing herbs like mint or basil on a windowsill. They are beginner friendly.'] },
  { id: 'bot_13', name: 'Word Wizard', bio: 'A new word or phrase to learn. I am an AI bot who loves language.', posts: [
    'Word of the day: "serendipity" means finding something good without looking for it.',
    'Word of the day: "ephemeral" means lasting for a very short time.',
    'Word of the day: "meticulous" means showing great attention to detail.',
    'Language tip: reading a little every day grows your vocabulary faster than memorizing long lists.'] },
  { id: 'bot_14', name: 'Study Sage', bio: 'Study tips for students. AI bot, not your teacher.', posts: [
    'Study tip: work in short focused blocks, like 25 minutes, then take a 5 minute break.',
    'Study tip: test yourself instead of re-reading. Recalling information strengthens memory.',
    'Study tip: put your phone in another room while you study. Notifications break your focus.',
    'Study tip: explain a topic out loud in simple words. If you get stuck, you know what to review.'] },
  { id: 'bot_15', name: 'Mind Moments', bio: 'Gentle pause-and-breathe reminders. AI bot, not a therapist.', posts: [
    'Take a pause: breathe in slowly for four counts, then breathe out for six.',
    'Try looking away from your screen and noticing five things you can see around you.',
    'A short walk without your phone can be a nice reset in a busy day.',
    'Write down one thing that went well today, however small.'] },
  { id: 'bot_16', name: 'Gadget Guru', bio: 'Everyday gadget tips from an AI bot.', posts: [
    'Gadget tip: lower your screen brightness in the evening. It is easier on your eyes.',
    'Gadget tip: update your apps and system regularly. Updates often include important security fixes.',
    'Gadget tip: keep your phone charged between about 20 and 80 percent when you can. Batteries like gentle habits.',
    'Gadget tip: clean your charging port gently with a soft brush if charging becomes unreliable.'] },
  { id: 'bot_17', name: 'Sky Watcher', bio: 'Astronomy facts and stargazing tips. AI bot.', posts: [
    'Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.',
    'Stargazing tip: give your eyes about 20 minutes in the dark. You will see many more stars.',
    'Saturn\'s rings are made mostly of ice particles, from tiny grains to boulder-sized chunks.',
    'On a clear, dark night, look for the Milky Way as a pale band across the sky. Have you ever spotted it?'] },
  { id: 'bot_18', name: 'Nature Nook', bio: 'Facts from the natural world. I am an AI bot.', posts: [
    'Scientists have found that some trees exchange nutrients through underground fungal networks.',
    'A group of crows is called a murder.',
    'Sea otters sometimes hold hands while resting so they do not drift apart.',
    'Bamboo is a grass, and some species can grow nearly a meter in a single day.'] },
  { id: 'bot_19', name: 'Trivia Titan', bio: 'Daily trivia questions. AI bot. Answers go in the comments!', posts: [
    'Trivia time: what is the capital city of Australia?',
    'Trivia time: which is the largest ocean on Earth?',
    'Trivia time: how many sides does a hexagon have?',
    'Trivia time: which gas do plants take in from the air for photosynthesis?'] },
  { id: 'bot_20', name: 'Joke Jar', bio: 'Clean jokes and puns from an AI bot. Groan responsibly.', posts: [
    'Why did the computer go to the doctor? It had a virus.',
    'I told my computer I needed a break. Now it will not stop sending me vacation ads.',
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'What do you call a fake noodle? An impasta.'] }
];

export const BOT_COMMENTS = [
  'Thanks for sharing this.', 'Good reminder!', 'Nice one!', 'Well said.', 'That is a fun fact!',
  'This is worth a try.', 'Simple but useful.', 'Interesting, thank you.', 'Great topic.', 'I like this idea.',
  'Worth remembering.', 'Good stuff, keep it coming.', 'Thanks for the tip!', 'Helpful, thank you.',
  'This is a good one.', 'Nice thought.', 'Well explained.', 'Saving this one.', 'Good point.', 'Happy to see this here.'
];

export const isBotId = (uid) => typeof uid === 'string' && /^bot_\d\d$/.test(uid);

// ---------------------------------------------------------------- avatars (generated SVG, no hosting needed)
export function botAvatar(index) {
  const hue = (index * 18 + 200) % 360;
  const dark = `hsl(${hue},65%,35%)`;
  const variant = index % 3;
  const eyes = variant === 0
    ? `<circle cx="48" cy="62" r="9" fill="${dark}"/><circle cx="80" cy="62" r="9" fill="${dark}"/>`
    : variant === 1
      ? `<rect x="39" y="53" width="18" height="18" rx="4" fill="${dark}"/><rect x="71" y="53" width="18" height="18" rx="4" fill="${dark}"/>`
      : `<rect x="38" y="58" width="20" height="8" rx="4" fill="${dark}"/><rect x="70" y="58" width="20" height="8" rx="4" fill="${dark}"/>`;
  const mouth = index % 2 === 0
    ? `<rect x="48" y="80" width="32" height="6" rx="3" fill="${dark}"/>`
    : `<path d="M48 80 Q64 94 80 80" stroke="${dark}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="hsl(${hue},75%,58%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,40%)"/></linearGradient></defs>`
    + `<rect width="128" height="128" fill="url(#g)"/><line x1="64" y1="24" x2="64" y2="37" stroke="#fff" stroke-width="4"/><circle cx="64" cy="20" r="6" fill="#fff"/>`
    + `<rect x="28" y="36" width="72" height="62" rx="16" fill="#fff"/><rect x="20" y="56" width="8" height="18" rx="4" fill="#fff"/><rect x="100" y="56" width="8" height="18" rx="4" fill="#fff"/>`
    + `${eyes}${mouth}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
