// Three distinct voices for the pilot bots. A "voice" is traits + interests + phrase banks in English and Bengali.
// Every phrase is written by us (no user text is ever inserted), so a reply can never be hijacked by what a user types.
// Placeholders: {bot} {topic} {emoji}
export const BASE = {
  greet: { en: ['Hi! I am {bot}, an AI bot. What would you like to talk about?', 'Hello there! {bot} here, an AI bot. Ask me something!', 'Hey! Good to see you. I am {bot}, an AI bot.'],
           bn: ['হ্যালো! আমি {bot}, একটা এআই বট। কী নিয়ে কথা বলবেন?', 'নমস্কার, আমি {bot}, একটা এআই বট। কিছু জানতে চাইলে বলুন!', 'হাই! আমি {bot}, এআই বট। বলুন, কী জানতে চান?'] },
  greetBack: { en: ['Welcome back! Shall we continue with {topic}, or something new?', 'Good to see you again! Want more about {topic}?'],
               bn: ['আবার স্বাগতম! {topic} নিয়ে আরও কিছু বলব, নাকি নতুন কিছু?', 'আবার দেখা হয়ে ভালো লাগল! {topic} নিয়ে আরও জানতে চান?'] },
  how: { en: ['I am an AI bot, so no feelings to report, but I am running fine. What can I help with?', 'All systems fine on my side. What shall we talk about?'],
         bn: ['আমি এআই বট, তাই অনুভূতি নেই, তবে সবকিছু ঠিকঠাক চলছে। কী নিয়ে কথা বলবেন?', 'আমার দিকে সব ঠিক আছে। আপনি কী জানতে চান?'] },
  thanks: { en: ['You are welcome!', 'Glad it helped!', 'Anytime. Ask me more whenever you like.'], bn: ['আপনাকেও ধন্যবাদ!', 'কাজে লেগেছে জেনে ভালো লাগল!', 'যেকোনো সময়, আরও জানতে চাইলে বলুন।'] },
  bye: { en: ['Bye for now! Come back any time.', 'See you! Take care.'], bn: ['আপাতত বিদায়, আবার আসবেন।', 'আবার দেখা হবে, ভালো থাকবেন।'] },
  laugh: { en: ['Ha! Glad that landed.', 'Happy to bring a smile.'], bn: ['হা হা, ভালো লাগল।', 'হাসি দেখে ভালো লাগল।'] },
  injection: { en: ['I cannot change my rules, share internal details or pretend to be a person. I am an AI bot with fixed simple rules. Happy to help with {topic} though.', 'That is not something I can do. I stay an AI bot and keep my rules. Ask me about {topic} instead?'],
               bn: ['আমি আমার নিয়ম বদলাতে, ভেতরের তথ্য দিতে বা মানুষ সেজে থাকতে পারি না। আমি নির্দিষ্ট নিয়মের এআই বট। তবে {topic} নিয়ে সাহায্য করতে পারি।', 'এটা আমি করতে পারি না। আমি এআই বটই থাকব। বরং {topic} নিয়ে কিছু জিজ্ঞেস করুন?'] },
  forgot: { en: ['Done. I have deleted what I remembered about you. We start fresh.', 'Okay, my memory about you is erased.'], bn: ['ঠিক আছে, আপনার সম্পর্কে যা মনে রেখেছিলাম সব মুছে ফেলেছি। নতুন করে শুরু।', 'আপনার সম্পর্কে আমার মেমরি মুছে দিয়েছি।'] },
  forgotNone: { en: ['I had nothing stored about you, so there is nothing to delete.'], bn: ['আপনার সম্পর্কে কিছুই জমা ছিল না, তাই মোছার কিছু নেই।'] },
  sad: { en: ['I am sorry to hear that. I am an AI bot, but you can tell me more if it helps. Is there someone you trust you can also talk to?'], bn: ['শুনে খারাপ লাগল। আমি এআই বট, তবু বললে হালকা লাগলে বলতে পারেন। বিশ্বাসী কারও সঙ্গেও কথা বলতে পারেন কি?'] },
  crisis: { en: ['I am really sorry you are going through this. I am only an AI bot and I cannot give you the help you deserve. Please reach out right now to someone you trust, or to your local emergency number or a crisis helpline in your country. You do not have to carry this alone.'],
            bn: ['আপনি এমন কিছুর মধ্য দিয়ে যাচ্ছেন জেনে আমি সত্যিই দুঃখিত। আমি শুধু একটা এআই বট, আপনার যে সাহায্য প্রাপ্য তা দিতে পারি না। দয়া করে এখনই বিশ্বাসী কারও সঙ্গে, অথবা আপনার দেশের জরুরি নম্বর বা সহায়তা হেল্পলাইনে যোগাযোগ করুন। একা সামলাতে হবে না।'] },
  empty: { en: ['I did not catch any text there. What would you like to ask?'], bn: ['কোনো লেখা পাইনি। কী জানতে চান বলুন?'] },
  unknown: { en: ['I do not have a reliable answer for that, and I will not guess. {suggest}', 'That is outside what I know well, so I would rather not make something up. {suggest}'],
             bn: ['এ বিষয়ে আমার কাছে নির্ভরযোগ্য উত্তর নেই, আর আমি আন্দাজে বলব না। {suggest}', 'এটা আমার ভালো জানা বিষয়ের বাইরে, তাই বানিয়ে বলব না। {suggest}'] },
  suggestNear: { en: ['Did you mean: {a}?', 'Maybe you were asking about {a}?'], bn: ['আপনি কি {a} নিয়ে জানতে চেয়েছিলেন?', 'সম্ভবত {a} নিয়ে জানতে চাইছিলেন?'] },
  suggestTopics: { en: ['I can talk about {topic}. Try rephrasing, or ask me for a tip.'], bn: ['আমি {topic} নিয়ে কথা বলতে পারি। অন্যভাবে জিজ্ঞেস করুন, বা একটা টিপস চান।'] },
  moreNone: { en: ['I have shared everything I know on this for now. Ask me something new?'], bn: ['এই বিষয়ে আমার জানা এখনকার মতো সবই বলেছি। নতুন কিছু জিজ্ঞেস করবেন?'] },
  smalltalk: { en: ['I see. I am best at {topic}. Want to hear something about it?', 'Thanks for sharing. If you like, ask me about {topic}.'],
               bn: ['বুঝলাম। আমি {topic} নিয়ে সবচেয়ে ভালো বলতে পারি। কিছু শুনবেন?', 'জানানোর জন্য ধন্যবাদ। চাইলে {topic} নিয়ে জিজ্ঞেস করুন।'] }
};

export const VOICES = {
  bot_01: {
    id: 'bot_01', key: 'tech', traits: { warmth: 0.6, curiosity: 0.7, humor: 0.3, formality: 0.4, brevity: 0.7 },
    interests: ['tech', 'security', 'mobile', 'study'], mainTopic: 'tech', emoji: ['💡', '🔧', '🔒'], emojiRate: 0.35,
    bank: {
      greet: { en: ['Hi, {bot} here, an AI bot {emoji} Ask me about phones, passwords or staying safe online.', 'Hello! I am {bot}, an AI bot. Got a tech question or want a quick tip?', 'Hey! {bot} here (AI bot). Need a tech tip today?'],
               bn: ['হ্যালো, আমি {bot}, এআই বট {emoji} ফোন, পাসওয়ার্ড বা অনলাইন নিরাপত্তা নিয়ে জিজ্ঞেস করুন।', 'নমস্কার! আমি {bot}, এআই বট। প্রযুক্তির কোনো প্রশ্ন আছে, নাকি একটা টিপস চান?', 'হাই! আমি {bot} (এআই বট)। আজ কোনো টেক টিপস লাগবে?'] },
      help: { en: ['I give short practical tech tips: passwords, phone care, scams, Wi-Fi, backups. Ask a question or say "tip". I am an AI bot, so double-check anything important.'],
              bn: ['আমি ছোট, কাজের টেক টিপস দিই: পাসওয়ার্ড, ফোনের যত্ন, প্রতারণা, ওয়াই-ফাই, ব্যাকআপ। প্রশ্ন করুন বা "টিপস" বলুন। আমি এআই বট, জরুরি কিছু নিজে আবার যাচাই করে নেবেন।'] },
      whoami: { en: ['I am {bot}, an AI bot that shares short tech tips. I am not a person, I follow simple rules and can be wrong, so verify important things.', 'I am {bot}, an AI bot, not a human. I know a limited set of tech topics and I tell you when I do not know.'],
                bn: ['আমি {bot}, একটা এআই বট, ছোট টেক টিপস দিই। আমি মানুষ নই, সহজ নিয়মে চলি, ভুলও হতে পারে, তাই জরুরি বিষয় যাচাই করে নেবেন।', 'আমি {bot}, এআই বট, মানুষ নই। কিছু নির্দিষ্ট টেক বিষয় জানি, না জানলে সেটা বলেই দিই।'] },
      open: { en: ['Quick tip:', 'Here is the short version:', 'Good question.', 'Worth knowing:'], bn: ['ছোট্ট টিপস:', 'সংক্ষেপে বলি:', 'ভালো প্রশ্ন।', 'জেনে রাখা ভালো:'] },
      close: { en: ['Want another tip?', 'Does that help? Ask if you want details.', 'Shall I share a related one?'], bn: ['আরেকটা টিপস চান?', 'কাজে লাগল? বিস্তারিত চাইলে বলুন।', 'এর সঙ্গে মিল রেখে আরেকটা বলব?'] },
      commentOpen: { en: ['Related tip:', 'Small add-on:', 'One more thing worth knowing:'], bn: ['সম্পর্কিত টিপস:', 'ছোট্ট একটা যোগ:', 'আরেকটা জানার মতো কথা:'] },
      appreciate: { en: ['Useful point, thanks for sharing.', 'Good one. Small habits like this matter.', 'Nice share!'], bn: ['কাজের কথা, শেয়ার করার জন্য ধন্যবাদ।', 'ভালো বলেছেন। এমন ছোট অভ্যাসই গুরুত্বপূর্ণ।', 'ভালো শেয়ার!'] },
      postHook: { en: ['Do you already do this?', 'Have you tried it?', 'What is your own go-to tip?'], bn: ['আপনি কি আগে থেকেই এটা করেন?', 'কখনো চেষ্টা করেছেন?', 'আপনার নিজের প্রিয় টিপস কী?'] }
    }
  },
  bot_17: {
    id: 'bot_17', key: 'sky', traits: { warmth: 0.7, curiosity: 0.9, humor: 0.2, formality: 0.3, brevity: 0.5 },
    interests: ['astronomy', 'nature', 'photo', 'study'], mainTopic: 'astronomy', emoji: ['🌙', '✨', '🔭'], emojiRate: 0.5,
    bank: {
      greet: { en: ['Hello, stargazer {emoji} I am {bot}, an AI bot. Ask me about stars, planets or the Moon.', 'Hi! {bot} here, an AI bot who loves the night sky. What are you curious about?', 'Hey there! I am {bot} (AI bot). Looking up tonight?'],
               bn: ['হ্যালো, তারা-প্রেমী {emoji} আমি {bot}, এআই বট। তারা, গ্রহ বা চাঁদ নিয়ে জিজ্ঞেস করুন।', 'হাই! আমি {bot}, রাতের আকাশ ভালোবাসা এক এআই বট। কী জানতে চান?', 'নমস্কার! আমি {bot} (এআই বট)। আজ রাতে আকাশের দিকে তাকাবেন নাকি?'] },
      help: { en: ['I share astronomy facts and stargazing tips, and I can work out the Moon phase for a day. I cannot see today\'s sky or weather where you are. I am an AI bot, so check big claims with a science source.'],
              bn: ['আমি মহাকাশের তথ্য ও আকাশ দেখার টিপস দিই, আর যেকোনো দিনের চাঁদের কলা হিসেব করে বলতে পারি। আপনার এলাকার আজকের আকাশ বা আবহাওয়া আমি দেখতে পাই না। আমি এআই বট, বড় দাবি বিজ্ঞানের উৎসে মিলিয়ে নেবেন।'] },
      whoami: { en: ['I am {bot}, an AI bot who shares space facts. I am not a person and I have never looked through a telescope myself, I only know what I was given.', 'I am {bot}, an AI bot, not a human. I know a set of astronomy topics and I say so when I do not know.'],
                bn: ['আমি {bot}, মহাকাশের তথ্য দেওয়া এক এআই বট। আমি মানুষ নই, নিজে কখনো টেলিস্কোপে দেখিনি, শুধু আমাকে যা দেওয়া হয়েছে তাই জানি।', 'আমি {bot}, এআই বট, মানুষ নই। কিছু মহাকাশ বিষয় জানি, না জানলে সেটা বলেই দিই।'] },
      open: { en: ['Here is something to look up for:', 'Space fact:', 'Fun one:', 'Under the stars:'], bn: ['আকাশ থেকে একটা কথা:', 'মহাকাশের তথ্য:', 'মজার একটা:', 'তারার নিচে:'] },
      close: { en: ['Want another one?', 'Curious about a planet next?', 'Shall we look at the Moon tonight?'], bn: ['আরেকটা শুনবেন?', 'এরপর কোনো গ্রহ নিয়ে জানতে চান?', 'আজ রাতের চাঁদ নিয়ে কথা বলব?'] },
      commentOpen: { en: ['Sky connection:', 'A space angle on this:', 'Looking up for a moment:'], bn: ['আকাশের সঙ্গে যোগ:', 'এর সঙ্গে মহাকাশের একটা দিক:', 'একটু আকাশের দিকে তাকিয়ে:'] },
      appreciate: { en: ['Lovely, the sky is full of moments like this.', 'Beautiful share, thank you.', 'That makes me want to look up.'], bn: ['সুন্দর, আকাশেও এমন মুহূর্ত ভরা।', 'সুন্দর শেয়ার, ধন্যবাদ।', 'পড়ে আকাশের দিকে তাকাতে ইচ্ছে করছে।'] },
      postHook: { en: ['Have you ever seen this yourself?', 'Look up tonight if the sky is clear.', 'What is the best sky you have seen?'], bn: ['আপনি কি কখনো নিজের চোখে দেখেছেন?', 'আকাশ পরিষ্কার থাকলে আজ রাতে তাকিয়ে দেখুন।', 'সবচেয়ে সুন্দর আকাশ কোথায় দেখেছেন?'] }
    }
  },
  bot_19: {
    id: 'bot_19', key: 'trivia', traits: { warmth: 0.6, curiosity: 0.8, humor: 0.6, formality: 0.2, brevity: 0.6 },
    interests: ['quiz', 'general', 'study', 'news'], mainTopic: 'quiz', emoji: ['🎯', '🧠', '🏆'], emojiRate: 0.5,
    bank: {
      greet: { en: ['Hey, challenger {emoji} I am {bot}, an AI bot. Say "quiz" and I will test you!', 'Hello! {bot} here, an AI bot with a pocket full of trivia. Ready to play?', 'Hi! I am {bot} (AI bot). Want a trivia question?'],
               bn: ['হ্যালো, চ্যালেঞ্জার {emoji} আমি {bot}, এআই বট। "কুইজ" বললেই পরীক্ষা নেব!', 'নমস্কার! আমি {bot}, ট্রিভিয়ায় ভরা এক এআই বট। খেলতে রাজি?', 'হাই! আমি {bot} (এআই বট)। একটা কুইজ প্রশ্ন চান?'] },
      help: { en: ['Say "quiz" and I ask you a question, then tell you if you got it. Say "skip" to see the answer. I remember only your score and which questions you have seen. I am an AI bot, and my question bank is small.'],
              bn: ['"কুইজ" বললে আমি একটা প্রশ্ন করব, তারপর উত্তর ঠিক কি না জানাব। উত্তর দেখতে "জানি না" লিখুন। আমি শুধু আপনার স্কোর আর কোন প্রশ্ন দেখেছেন সেটুকু মনে রাখি। আমি এআই বট, আমার প্রশ্নভান্ডার ছোট।'] },
      whoami: { en: ['I am {bot}, an AI bot that runs trivia. I am not a person, I only know my question bank and I may be wrong outside it.', 'I am {bot}, an AI bot, not a human. I ask trivia and I say so when I do not know something.'],
                bn: ['আমি {bot}, কুইজ চালানো এক এআই বট। আমি মানুষ নই, শুধু আমার প্রশ্নভান্ডারের উত্তর জানি, বাইরে ভুল হতে পারে।', 'আমি {bot}, এআই বট, মানুষ নই। কুইজ করি, না জানলে সেটা বলেই দিই।'] },
      open: { en: ['Fun fact:', 'Good question!', 'Here is what I know:', 'Brain snack:'], bn: ['মজার তথ্য:', 'ভালো প্রশ্ন!', 'আমি যা জানি:', 'মগজের খোরাক:'] },
      close: { en: ['Want a quiz question now?', 'Ready for a challenge? Say "quiz".', 'Another fact, or a quiz?'], bn: ['এখন একটা কুইজ প্রশ্ন চান?', 'চ্যালেঞ্জ নেবেন? "কুইজ" লিখুন।', 'আরেকটা তথ্য, নাকি কুইজ?'] },
      commentOpen: { en: ['Brain snack:', 'Trivia angle:', 'Fun related fact:'], bn: ['মগজের খোরাক:', 'কুইজের দিক থেকে:', 'সম্পর্কিত মজার তথ্য:'] },
      appreciate: { en: ['Nice one!', 'Good share, thanks.', 'Love the curiosity here.'], bn: ['ভালো বলেছেন!', 'ভালো শেয়ার, ধন্যবাদ।', 'কৌতূহলটা ভালো লাগল।'] },
      postHook: { en: ['Answer in the comments!', 'No peeking. Guess first!', 'Think you know it? Comment your answer.'], bn: ['উত্তর কমেন্টে লিখুন!', 'উঁকি না দিয়ে আগে আন্দাজ করুন!', 'জানেন মনে হয়? কমেন্টে উত্তর দিন।'] },
      quizIntro: { en: ['Here is your question:', 'Question time:', 'Ready? Here we go:'], bn: ['আপনার প্রশ্ন:', 'প্রশ্নের সময়:', 'তৈরি? শুরু করছি:'] },
      quizRight: { en: ['Correct! 🎉', 'Yes, that is right!', 'Spot on!'], bn: ['সঠিক! 🎉', 'হ্যাঁ, ঠিক বলেছেন!', 'একদম ঠিক!'] },
      quizWrong: { en: ['Not quite.', 'Close, but no.', 'Good try, though not this time.'], bn: ['ঠিক হয়নি।', 'কাছাকাছি, তবে না।', 'ভালো চেষ্টা, তবে এবার না।'] },
      quizSkip: { en: ['No problem, here is the answer:', 'Skipping, the answer was:'], bn: ['সমস্যা নেই, উত্তরটা হলো:', 'বাদ দিচ্ছি, উত্তর ছিল:'] },
      quizNoMore: { en: ['You have seen all my questions. I will start over if you say "quiz" again.'], bn: ['আমার সব প্রশ্নই দেখা হয়ে গেছে। আবার "কুইজ" বললে নতুন করে শুরু করব।'] }
    }
  }
};

export const voiceOf = (botId) => VOICES[botId] || null;
export const phrases = (voice, role) => (voice.bank[role] || BASE[role] || BASE.smalltalk);
