// The CONTROLLED vocabulary. Bot memory may only hold ids from here (never free text), so a user's private words
// cannot end up in a brain document even by mistake: memory.js drops everything that is not one of these ids.
export const PILOT_BOT_IDS = ['bot_01', 'bot_17', 'bot_19'];

export const TOPIC_LABEL = {
  tech: { en: 'tech', bn: 'প্রযুক্তি' }, security: { en: 'online safety', bn: 'অনলাইন নিরাপত্তা' }, mobile: { en: 'phones', bn: 'ফোন' },
  astronomy: { en: 'astronomy', bn: 'মহাকাশ' }, nature: { en: 'nature', bn: 'প্রকৃতি' }, photo: { en: 'photography', bn: 'ফটোগ্রাফি' },
  quiz: { en: 'quizzes', bn: 'কুইজ' }, study: { en: 'learning', bn: 'শেখা' }, general: { en: 'general knowledge', bn: 'সাধারণ জ্ঞান' },
  travel: { en: 'travel', bn: 'ভ্রমণ' }, sports: { en: 'sports', bn: 'খেলা' }, news: { en: 'news', bn: 'খবর' }, gaming: { en: 'gaming', bn: 'গেমিং' },
  food: { en: 'food', bn: 'খাবার' }, music: { en: 'music', bn: 'গান' }, movies: { en: 'movies', bn: 'সিনেমা' }, books: { en: 'books', bn: 'বই' },
  health: { en: 'health', bn: 'স্বাস্থ্য' }, humor: { en: 'humor', bn: 'মজা' }, celebration: { en: 'celebrations', bn: 'উৎসব' }
};
export const ALLOWED_TOPICS = Object.keys(TOPIC_LABEL);
export const ID_RE = /^[a-z0-9_-]{1,24}$/;          // knowledge / quiz entry ids
export const DOC_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;   // Firestore document ids (post ids)
export const UID_RE = /^[A-Za-z0-9_-]{6,40}$/;      // Firebase Auth uids
