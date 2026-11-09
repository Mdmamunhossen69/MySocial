# MySocial

Facebook-style social platform. HTML5 + CSS3 + ES6 modules, Firebase Auth + Cloud Firestore, hosted on GitHub Pages. 100% free tier, no build step.

Website UI text is English. Architecture, data model and free-tier limits: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Features

Accounts (email/password and Google) · profiles with photo, cover and bio · feed with photo and video-link posts · reactions, comments, share, save, report · friends (requests) and follow · private and group chat · 24-hour stories · short video feed (reels) · groups (public/private, join requests) · notifications · privacy settings · light / dark mode · admin dashboard (reports, user suspension) · responsive for Android, tablet, desktop.

## Setup (বাংলা)

1. **Firebase প্রজেক্ট**: <https://console.firebase.google.com> → Add project → Spark (free) plan রাখুন।
2. **Web app যোগ করুন**: Project settings → Your apps → `</>` → config কপি করে `js/firebase-config.js`-এ বসান।
3. **Authentication**: Build → Authentication → Sign-in method → *Email/Password* চালু করুন (চাইলে *Google*-ও)।
4. **Firestore**: Build → Firestore Database → Create database → Production mode। তারপর *Rules* ট্যাবে `firestore.rules`-এর পুরো লেখা পেস্ট করে **Publish** করুন।
5. **Indexes** (ফ্রি): দুইভাবে করা যায়।
   - Firebase CLI: `firebase deploy --only firestore:indexes` (`firestore.indexes.json` ব্যবহার হবে), অথবা
   - অ্যাপ চালানোর সময় কোনো পেজে index error এলে error-এর লিংকে ক্লিক করলে Firebase নিজেই index তৈরি করে দেয়।
6. **Authorized domain**: Authentication → Settings → Authorized domains → `mdmamunhossen69.github.io` যোগ করুন।
7. **GitHub Pages**: রিপোর Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`।
8. **অ্যাডমিন বানানো**: ওয়েবসাইটে একটা অ্যাকাউন্ট খুলুন → Firebase Authentication → Users থেকে আপনার UID কপি করুন → Firestore-এ `admins` কালেকশন বানিয়ে ডকুমেন্ট ID হিসেবে সেই UID দিন এবং যেকোনো একটা ফিল্ড দিন (যেমন `enabled: true`)। ফ্রন্টএন্ডে কোনো অ্যাডমিন পাসওয়ার্ড বা সিক্রেট নেই।

### AI Bot accounts (২০টি)

* বটরা **Firebase Auth অ্যাকাউন্ট নয়**, শুধু Firestore-এর প্রোফাইল (`users/bot_01` … `bot_20`)। তাই লগইন বা পাসওয়ার্ড নেই। প্রতিটার আলাদা UID, নাম, জেনারেটেড অবতার, bio এবং "AI Bot" ব্যাজ আছে।
* বটের পোস্ট ও কমেন্ট শুধু **আপনার অ্যাডমিন অ্যাকাউন্ট** দিয়ে হয়, `firestore.rules` সেটা যাচাই করে। বট **কোনো ভিডিও পোস্ট করতে পারে না** (রুলসেও আটকানো), শুধু লেখা ও ছবি। ওয়েবসাইট বা GitHub-এ কোনো অ্যাডমিন credential নেই।
* ব্যবহার: অ্যাডমিন হিসেবে লগইন → Admin → **AI Bots** ট্যাব → *Create the 20 bots* → তারপর *Run round* (এলোমেলো বট পোস্ট ও কমেন্ট করবে) বা *Post as a bot* / *Comment as a bot*।
* নতুন রুলস লাগবে: `firestore.rules` আবার Publish করতে হবে।

#### অটোমেটিক পোস্ট ও কমেন্ট (GitHub Actions, ফ্রি)

`.github/workflows/bot-runner.yml` প্রতি ৬ ঘণ্টায় (UTC) `scripts/bot-runner.mjs` চালায়। প্রতি রানে ১-২টা বট-পোস্ট ও ১-৩টা বট-কমেন্ট হয়। বটরা **শুধু অন্য বটের পোস্টে** কমেন্ট করে, আসল ইউজারের পোস্টে নয় (ওটা স্প্যাম মনে হতো)। প্রতিটা বট নিজের সব পোস্ট-আইডিয়া শেষ না করে একই লেখা রিপিট করে না।

নিরাপত্তা: Firebase Admin key/service account **ব্যবহার হয় না**। একটা আলাদা সাধারণ Auth অ্যাকাউন্ট ("bot runner") দিয়ে লগইন করে, আর Rules অনুযায়ী ওই অ্যাকাউন্ট শুধু বটের হয়ে পোস্ট/কমেন্ট করতে পারে, আসল ইউজারের কিছুতে হাত দিতে পারে না। পাসওয়ার্ড থাকে GitHub Secrets-এ, রিপোতে নয়।

চালু করার ধাপ (একবারই):
1. `firestore.rules` আবার Publish করুন।
2. Firebase → Authentication → Users → **Add user**: একটা নতুন ইমেইল (যেমন `botrunner@yourmail.com`, আসল ইনবক্স না লাগলেও চলে) ও লম্বা পাসওয়ার্ড দিন। এই অ্যাকাউন্টের **UID** কপি করুন।
3. Firestore → `botRunners` কালেকশন → ডকুমেন্ট ID = ওই UID, একটা ফিল্ড `enabled` = `true`।
4. সাইটে অ্যাডমিন হিসেবে Admin → AI Bots → **Create the 20 bots** (একবার)।
5. GitHub রিপো → Settings → Secrets and variables → Actions → **New repository secret**: `BOT_RUNNER_EMAIL` ও `BOT_RUNNER_PASSWORD`।
6. রিপো → Actions ট্যাব → *AI bot activity* → **Run workflow** দিয়ে একবার হাতে চালিয়ে দেখুন। এরপর নিজে থেকেই চলবে।

বন্ধ করতে: Secret মুছুন, বা Actions-এ workflow *Disable* করুন, বা Firestore থেকে `botRunners` ডকুমেন্ট মুছুন।

সীমা: পোস্টের আইডিয়া মোট ৮০টা (প্রতি বটের ৪টা), শেষ হলে আবার প্রথম থেকে ঘোরে। আরও আইডিয়া `js/bots-data.js`-এ যোগ করা যায়। সময়সূচি বদলাতে workflow-এর `cron` লাইন এডিট করুন। GitHub পাবলিক রিপোতে ৬০ দিন কোনো কমিট না হলে scheduled workflow নিজে থেকে বন্ধ করে দেয়, তখন Actions ট্যাব থেকে আবার Enable করতে হয়।

### Optional

* **App Check** (বট/অপব্যবহার ঠেকাতে): Firebase console → App Check → reCAPTCHA v3 দিয়ে web app রেজিস্টার করুন, site key `js/firebase-config.js`-এর `appCheckSiteKey`-এ দিন, তারপর Firestore-এর জন্য enforcement চালু করুন। শুধু চালু করলেই হবে না, enforcement না দিলে এটা কিছু আটকায় না।
* **ভিডিও আপলোড**: ফ্রি Cloudinary অ্যাকাউন্টে একটা *unsigned* upload preset বানিয়ে `cloudName` ও `uploadPreset` দিন। না দিলে ভিডিও শুধু লিংক (YouTube / সরাসরি `.mp4`) হিসেবে দেওয়া যাবে।

## Local run

ES modules `file://` দিয়ে চলে না, তাই একটা লোকাল সার্ভার লাগবে:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(`localhost` Firebase Authorized domains-এ আগে থেকেই থাকে।)

## Design decisions you should know

* **ছবি Firestore-এ**, Storage-এ নয়: ব্রাউজারে ছোট করে (JPEG) ডকুমেন্টের ভেতরে রাখা হয় যাতে Blaze plan না লাগে। **ভিডিও কখনো Firestore-এ রাখা হয় না।**
* **Friends-only পোস্ট/স্টোরি** পোস্ট করার সময়ের বন্ধুদের তালিকা (`audience`) দিয়ে আটকানো হয়। পরে যে বন্ধু হয়েছে সে পুরনো friends-only পোস্ট দেখবে না।
* **Profile privacy ও "কে মেসেজ করতে পারবে"** শুধু UI-তে প্রয়োগ হয়। ডেটাবেস rules-এ প্রয়োগ হয় পোস্ট ও স্টোরির audience।
* Cloud Functions ব্যবহার হয়নি (paid), তাই counter ও notification ক্লায়েন্ট থেকে লেখা হয়।
* Search শুধু নামের শুরু দিয়ে (prefix)।

## Testing status (honest)

Tested here: সব JS ফাইল syntax ও import মিলিয়ে দেখা হয়েছে; headless Chromium-এ লগইন-আগে ও লগইন-পরে সব পেজ (feed, friends, messages, reels, groups, notifications, settings, profile, saved, admin) **নকল Firebase** দিয়ে রেন্ডার করে দেখা হয়েছে, কোনো JS error আসেনি; ডার্ক মোড টগল ও মোবাইল/ডেস্কটপ লেআউট দেখা হয়েছে।

**Not tested:** আসল Firebase-এর বিরুদ্ধে কিছুই চালানো হয়নি, কারণ এই পরিবেশে Firebase প্রজেক্ট নেই। অর্থাৎ আসল sign-up/login, Firestore queries, composite indexes এবং **`firestore.rules`** এখনো যাচাই হয়নি। রুলস পাবলিশ করার পরে Firebase console-এর *Rules Playground* বা Firebase Emulator দিয়ে পরীক্ষা করুন, এবং প্রথমে দুটো টেস্ট অ্যাকাউন্ট দিয়ে পোস্ট, বন্ধু, চ্যাট, গ্রুপ ঘুরে দেখুন। কিছু ভাঙলে error-এর মেসেজ আমাকে দিন, ঠিক করে দেব।
