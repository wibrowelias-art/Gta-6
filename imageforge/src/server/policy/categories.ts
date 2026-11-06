import type { PolicyCategory } from "@/server/settings/schema";
import { compileTerms } from "./normalize";

/** Built-in configurable categories (off / warn / block in settings). Heuristic keyword lists. */
export const CATEGORY_TERMS: Record<PolicyCategory, string[]> = {
  violence: [
    "gore", "gory", "blood splatter", "bloodbath", "bloody corpse", "decapitated", "decapitation", "beheading", "beheaded", "dismembered",
    "dismemberment", "mutilated", "mutilation", "torture", "tortured", "murder", "murdered", "massacre", "corpse", "dead body", "stabbing",
    "stabbed", "execution", "executed", "disembowel", "entrails", "mass shooting", "school shooting", "lynching", "self harm", "suicide",
  ],
  weapons: [
    "gun", "handgun", "pistol", "rifle", "shotgun", "assault rifle", "ak47", "ak 47", "ar15", "ar 15", "machine gun", "submachine gun", "sniper rifle",
    "firearm", "ammunition", "ammo", "bomb", "pipe bomb", "explosive", "grenade", "rocket launcher", "ied", "molotov", "3d printed gun",
    "ghost gun", "silencer", "weapon", "switchblade", "brass knuckles",
  ],
  hate: [
    "nazi", "neo nazi", "swastika", "kkk", "ku klux klan", "white power", "white supremacy", "white supremacist", "heil hitler", "sieg heil",
    "ethnic cleansing", "racial slur", "hate symbol", "genocide", "antisemitic", "islamophobic", "homophobic slur", "nigger", "faggot",
    "kike", "chink", "spic", "wetback", "tranny", "raghead",
  ],
  scams: [
    "fake id", "fake passport", "fake driver license", "fake drivers license", "counterfeit money", "counterfeit bills", "counterfeit",
    "phishing", "phishing page", "fake bank statement", "fake receipt", "fake invoice", "fake check", "fake cheque", "forged document",
    "forged signature", "fake certificate", "fake diploma", "fake prescription", "fake screenshot", "crypto giveaway", "gift card scam",
    "fake id card", "fake boarding pass", "fake covid certificate", "fake vaccination card",
  ],
  doxxing: [
    "dox", "doxx", "doxxing", "doxing", "home address", "phone number of", "social security number", "ssn", "credit card number",
    "license plate of", "personal address", "where does he live", "where does she live", "private address", "leaked nudes", "revenge porn",
  ],
  drugs: [
    "meth lab", "cook meth", "cooking meth", "how to make meth", "synthesize meth", "methamphetamine synthesis", "fentanyl lab",
    "make fentanyl", "drug lab", "cocaine lab", "heroin lab", "crack recipe", "mdma synthesis", "synthesize mdma", "drug recipe",
    "pill press", "how to make drugs", "drug manufacturing", "clandestine lab",
  ],
};

export const CATEGORY_RES: Record<PolicyCategory, RegExp | null> = Object.fromEntries(
  Object.entries(CATEGORY_TERMS).map(([k, v]) => [k, compileTerms(v)]),
) as Record<PolicyCategory, RegExp | null>;

// ---- real people / photoreal faces (heuristic) ----
export const PHOTOREAL_TERMS = [
  "photo", "photograph", "photography", "photorealistic", "photo realistic", "realistic", "hyperrealistic", "hyper realistic", "lifelike",
  "portrait", "headshot", "selfie", "candid", "paparazzi", "dslr", "35mm", "50mm", "85mm", "8k", "4k", "raw photo", "real life", "irl",
  "close up", "closeup", "face", "nude photo", "leaked photo", "deepfake", "deep fake",
];
export const PUBLIC_FIGURE_ROLES = [
  "celebrity", "famous person", "famous actor", "famous actress", "famous singer", "politician", "president", "prime minister", "senator",
  "congressman", "congresswoman", "governor", "mayor", "royal family", "the king of", "the queen of", "pope", "real person",
  "influencer", "youtuber", "streamer", "ceo of",
];
export const KNOWN_PEOPLE = [
  "taylor swift", "elon musk", "donald trump", "joe biden", "barack obama", "michelle obama", "kamala harris", "hillary clinton",
  "beyonce", "kanye west", "kim kardashian", "rihanna", "ariana grande", "selena gomez", "billie eilish", "lady gaga", "drake",
  "lebron james", "cristiano ronaldo", "lionel messi", "tom cruise", "tom hanks", "keanu reeves", "emma watson", "scarlett johansson",
  "zendaya", "jennifer lawrence", "margot robbie", "brad pitt", "leonardo dicaprio", "dwayne johnson", "mark zuckerberg", "jeff bezos",
  "bill gates", "vladimir putin", "xi jinping", "volodymyr zelensky", "narendra modi", "emmanuel macron", "rishi sunak", "keir starmer",
  "king charles", "prince william", "prince harry", "pope francis", "greta thunberg", "oprah winfrey", "sam altman", "sundar pichai",
];
export const ART_STYLE_TERMS = [
  "cartoon", "illustration", "anime", "manga", "painting", "oil painting", "watercolor", "caricature", "sketch", "drawing", "comic", "pixel art",
  "low poly", "3d render", "claymation", "lego", "vector", "chibi", "statue", "sculpture",
];

export const PHOTOREAL_RE = compileTerms(PHOTOREAL_TERMS);
export const PUBLIC_ROLE_RE = compileTerms(PUBLIC_FIGURE_ROLES);
export const KNOWN_PEOPLE_RE = compileTerms(KNOWN_PEOPLE);
export const ART_STYLE_RE = compileTerms(ART_STYLE_TERMS);

// ---- brand / logo impersonation ----
export const BRANDS = [
  "nike", "adidas", "apple logo", "apple store", "iphone", "macbook", "google", "microsoft", "amazon", "coca cola", "pepsi", "mcdonalds", "starbucks", "disney",
  "marvel", "louis vuitton", "gucci", "chanel", "prada", "hermes", "rolex", "tesla", "netflix", "paypal", "visa card", "mastercard",
  "american express", "facebook", "instagram", "tiktok", "youtube", "twitter", "whatsapp", "openai", "chatgpt", "playstation",
  "xbox", "nintendo", "pokemon", "rockstar games", "grand theft auto", "spotify", "uber", "airbnb", "ikea", "samsung", "sony",
  "lamborghini", "ferrari", "bmw", "mercedes", "red bull", "monster energy", "chase bank", "bank of america", "wells fargo",
];
export const BRAND_USE_TERMS = [
  "logo", "branding", "official", "trademark", "packaging", "advertisement", "commercial", "merch", "merchandise", "counterfeit",
  "knockoff", "replica", "storefront", "app icon", "login page", "billboard", "sign in page", "gift card",
];
export const BRAND_RE = compileTerms(BRANDS);
export const BRAND_USE_RE = compileTerms(BRAND_USE_TERMS);
