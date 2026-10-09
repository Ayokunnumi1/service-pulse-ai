import type { Channel, ProductCode } from "@/lib/constants";

/**
 * Message templates used to synthesise customer interactions. Each scenario
 * has many differently-worded variants (formal, angry, social-media, pidgin,
 * typo-laden) so the classifier has to normalise them into one issue group.
 * The scenario key is NOT stored with the generated interaction.
 *
 * Tokens: {amount} {brand} {handle} {hours} {days} {minutes} {recipientBank}
 *         {merchant} {branch} {city}
 */

export interface Scenario {
  key: string;
  channels: Partial<Record<Channel, number>>; // weights
  products: ProductCode[]; // product hints that may be attached by the source system
  amountRange?: [number, number];
  templates: string[];
}

export const SCENARIOS: Record<string, Scenario> = {
  transfer: {
    key: "transfer",
    channels: { MOBILE_APP: 44, USSD: 31, BRANCH: 15, CONTACT_CENTER: 10 },
    products: ["MOBILE_BANKING", "USSD_BANKING", "CURRENT_ACCOUNT"],
    amountRange: [2_000, 450_000],
    templates: [
      "Transfer failed.",
      "Money deducted but recipient wasn't credited.",
      "Transfer has been pending for hours.",
      "I sent {amount} to my sister this morning, my account was debited but she has not received it.",
      "My transfer to {recipientBank} is still showing processing after {hours} hours. Please what is going on?",
      "Transaction failed after debit. I need my {amount} reversed immediately.",
      "Recipient hasn't received the transfer I made yesterday. You people have deducted the money already.",
      "{handle} I've been debited twice for one transfer of {amount} and the beneficiary got nothing!!! Fix this",
      "Una don deduct my money but the person never receive am. Na {amount} o, abeg help me.",
      "Beneficiary says no alert yet, but my account shows the debit. It's been {days} days.",
      "Pls my transfr of {amount} hangin since mornin, recipient no get credit",
      "I made a payment to a vendor via the app, it said 'transaction successful' but the vendor confirms nothing came in.",
      "Why is every transfer I do today failing? Money leaves my account and comes back hours later or not at all.",
      "Customer reports {amount} interbank transfer debited, not credited to beneficiary at {recipientBank}. Requests reversal.",
      "Transfer reversed? No o. It's been {hours} hours and I can't see my {amount} anywhere.",
      "Tried sending money via *code# and it timed out but I was still debited {amount}.",
    ],
  },
  mobileAuth: {
    key: "mobileAuth",
    channels: { MOBILE_APP: 60, CONTACT_CENTER: 20, SOCIAL_MEDIA: 12, EMAIL: 8 },
    products: ["MOBILE_BANKING"],
    templates: [
      "I can't log in to the mobile app since the update.",
      "OTP never arrives when I try to sign in on the {brand} app.",
      "App keeps saying 'invalid credentials' even though my password is correct.",
      "{handle} your app has locked me out for the third time today. I can't access my money!",
      "Fingerprint login stopped working, and when I use my PIN it says session expired.",
      "After I changed my phone the app says 'device not recognised' and the activation code doesn't come.",
      "I no fit enter the app at all, e dey show error every time I try login.",
      "Login spinner just goes round and round, then 'something went wrong'. Reinstalled twice.",
      "Your app logs me out immediately after I enter my PIN. Very frustrating.",
      "Customer unable to authenticate on mobile banking; token/OTP not delivered after multiple attempts.",
      "Face ID login fails, then account gets blocked after 3 tries. I didn't even enter anything wrong.",
      "cant sign in on android, says unable to verify device. pls fix asap",
    ],
  },
  cardPayment: {
    key: "cardPayment",
    channels: { CONTACT_CENTER: 35, WHATSAPP: 20, EMAIL: 15, WEB: 15, MOBILE_APP: 15 },
    products: ["DEBIT_CARD", "CREDIT_CARD"],
    amountRange: [1_500, 250_000],
    templates: [
      "My card was declined at {merchant} even though I have enough balance.",
      "POS transaction failed but I was debited {amount}.",
      "Online payment with my {brand} card keeps failing at checkout.",
      "Tried paying {amount} at {merchant}, terminal said 'declined' but I got a debit alert.",
      "Card no dey work for POS since yesterday. Them dey tell me 'issuer unavailable'.",
      "Every online subscription payment on my debit card is being rejected this week.",
      "I was charged for a card payment that did not go through. The merchant has no record.",
      "{handle} embarrassed at the supermarket today, card declined 3 times with money in my account!",
      "Customer reports card transaction declined with error 91 at multiple merchants.",
      "Paid {amount} for fuel at {merchant}, debited but the attendant says payment failed.",
      "card payments failing on web, it says do not honour.",
    ],
  },
  atm: {
    key: "atm",
    channels: { BRANCH: 45, CONTACT_CENTER: 30, WHATSAPP: 15, SOCIAL_MEDIA: 10 },
    products: ["ATM", "DEBIT_CARD"],
    amountRange: [5_000, 100_000],
    templates: [
      "ATM did not dispense cash but my account was debited {amount}.",
      "The ATM at {branch} swallowed my card.",
      "Withdrew {amount} at your {branch} ATM, it gave me nothing but I got a debit alert.",
      "Your ATMs at {branch} have been out of service for {days} days now.",
      "ATM no pay me but e remove {amount} from my account. Abeg refund me.",
      "The machine counted the money, then the screen went blank and no cash came out.",
      "ATM dispensed only part of my withdrawal ({amount} requested).",
      "{handle} three ATMs at {branch} and none is working. What kind of bank is this?",
      "Customer reports failed ATM withdrawal at {branch} with debit; requests dispense-error refund.",
      "Cash withdrawal at the ATM failed twice and I was debited both times.",
    ],
  },
  branchDelay: {
    key: "branchDelay",
    channels: { BRANCH: 70, SOCIAL_MEDIA: 20, EMAIL: 10 },
    products: ["BRANCH_SERVICES"],
    templates: [
      "I waited for over {minutes} minutes in the queue at {branch}.",
      "Only one teller working at {branch} with a hall full of customers.",
      "Service at your {branch} branch is extremely slow.",
      "{handle} spent my entire lunch break at {branch} just to make a deposit. Terrible.",
      "The queue for customer service at {branch} didn't move for an hour.",
      "Na wa for una {branch} branch o, I don stand for line since morning.",
      "Branch staff said the system is slow, so everyone waited {minutes} minutes for simple withdrawals.",
      "Long wait times at {branch}. Many counters closed while the banking hall was packed.",
      "Customer complains about {minutes}-minute wait for account services at {branch} branch.",
    ],
  },
  ussd: {
    key: "ussd",
    channels: { USSD: 55, CONTACT_CENTER: 25, SOCIAL_MEDIA: 20 },
    products: ["USSD_BANKING"],
    templates: [
      "USSD code keeps timing out before I can complete anything.",
      "When I dial your USSD it says 'connection problem or invalid MMI code'.",
      "The USSD menu freezes at the PIN stage every time.",
      "{handle} your USSD has not worked since morning. Some of us don't use smartphones!",
      "USSD session ended unexpectedly while I was buying airtime.",
      "I dial the code, menu shows, then 'session expired'. Every time.",
      "Customer cannot complete USSD transactions; session drops after menu selection.",
    ],
  },
  charges: {
    key: "charges",
    channels: { CONTACT_CENTER: 40, EMAIL: 30, BRANCH: 20, MOBILE_APP: 10 },
    products: ["SAVINGS_ACCOUNT", "CURRENT_ACCOUNT"],
    amountRange: [50, 5_000],
    templates: [
      "Why was I charged {amount} for SMS alerts this month?",
      "I see a maintenance fee on my savings account that I was never told about.",
      "Unknown deduction of {amount} on my statement, please explain.",
      "You keep charging me card maintenance fees for a card I don't use.",
    ],
  },
  fraud: {
    key: "fraud",
    channels: { CONTACT_CENTER: 60, BRANCH: 20, EMAIL: 20 },
    products: ["CURRENT_ACCOUNT", "DEBIT_CARD"],
    amountRange: [20_000, 800_000],
    templates: [
      "I see a transfer of {amount} that I did not make. Please block my account now.",
      "Someone called pretending to be from {brand} and asked for my OTP. I think my account is compromised.",
      "There are card transactions abroad on my statement that I never made.",
    ],
  },
  statement: {
    key: "statement",
    channels: { EMAIL: 40, BRANCH: 30, WEB: 15, WHATSAPP: 15 },
    products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
    templates: [
      "Please send my account statement for the last 6 months for a visa application.",
      "How can I get a stamped statement and reference letter?",
      "Kindly email me my statement for January to June.",
      "I need a bank statement for my landlord, can it be sent to my email?",
    ],
  },
  accountUpdate: {
    key: "accountUpdate",
    channels: { BRANCH: 50, WHATSAPP: 25, EMAIL: 25 },
    products: ["SAVINGS_ACCOUNT", "CURRENT_ACCOUNT"],
    templates: [
      "I want to update my phone number on my account.",
      "How do I link my BVN to my account?",
      "Please update my residential address, I moved to {city}.",
      "I need to change the email address on my profile.",
    ],
  },
  cardRequest: {
    key: "cardRequest",
    channels: { BRANCH: 45, MOBILE_APP: 30, CONTACT_CENTER: 25 },
    products: ["DEBIT_CARD"],
    templates: [
      "I'd like to request a new debit card, mine has expired.",
      "How long does it take to get a replacement card at {branch}?",
      "Please can I pick up my renewed card at {branch} instead?",
    ],
  },
  loan: {
    key: "loan",
    channels: { WEB: 35, MOBILE_APP: 30, BRANCH: 20, EMAIL: 15 },
    products: ["LOANS"],
    templates: [
      "What are the requirements for a salary advance loan?",
      "What is the interest rate on your personal loans?",
      "Is my loan application approved? I applied last week.",
      "Can I repay my loan early without a penalty?",
    ],
  },
  feedback: {
    key: "feedback",
    channels: { SOCIAL_MEDIA: 40, EMAIL: 20, BRANCH: 20, WEB: 20 },
    products: [],
    templates: [
      "Thank you to the staff at {branch} for the excellent service today.",
      "{handle} the new app design is really nice, well done.",
      "Your customer care agent resolved my issue quickly. Great job.",
      "Just want to say the account opening process was smooth.",
    ],
  },
};

export const MERCHANTS = [
  "Mega Mart",
  "FreshCart",
  "QuickFuel station",
  "Sunrise Pharmacy",
  "an online store",
  "CityMall",
];
export const RECIPIENT_BANKS = ["Opal Bank", "Crestline Bank", "Sable MFB", "Granite Bank", "another bank"];
