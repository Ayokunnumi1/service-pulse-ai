import type { Channel } from "@/lib/constants";

/**
 * Held-out evaluation set. These messages were written separately from the
 * seed templates and were NOT used to build the keyword rules or the
 * prompts. They describe the same underlying problems in new ways —
 * indirect descriptions, Nigerian Pidgin, sarcasm, typos, agent notes and
 * social-media shorthand — so they measure how well each classifier
 * normalises unseen phrasing. Labels are the expected issue group.
 */
export interface ChallengeItem {
  id: string;
  channel: Channel;
  message: string;
  expected: string;
}

export const CHALLENGE_SET: ChallengeItem[] = [
  // TRANSFER_PROCESSING_FAILURE
  {
    id: "t1",
    channel: "WHATSAPP",
    expected: "TRANSFER_PROCESSING_FAILURE",
    message:
      "My landlord is still waiting for the rent I paid him on Monday. Your app said done, he says he sees nothing.",
  },
  {
    id: "t2",
    channel: "SOCIAL_MEDIA",
    expected: "TRANSFER_PROCESSING_FAILURE",
    message:
      "So money just disappears now? Left my account at 9am, never landed in my brother's account. Great banking 👏",
  },
  {
    id: "t3",
    channel: "CONTACT_CENTER",
    expected: "TRANSFER_PROCESSING_FAILURE",
    message:
      "Caller states outward NIP payment of ₦75,000 shows successful on her side but beneficiary bank has no record. Requests trace.",
  },
  {
    id: "t4",
    channel: "MOBILE_APP",
    expected: "TRANSFER_PROCESSING_FAILURE",
    message: "abeg the 20k wey i send since yesterday, the guy never see am. my balance don reduce sha",
  },
  {
    id: "t5",
    channel: "EMAIL",
    expected: "TRANSFER_PROCESSING_FAILURE",
    message:
      "Kindly look into a payment to my supplier which has been 'in progress' since Friday. The goods are being held until it arrives.",
  },

  // MOBILE_APP_AUTHENTICATION
  {
    id: "a1",
    channel: "MOBILE_APP",
    expected: "MOBILE_APP_AUTHENTICATION",
    message: "Every time I put my password it takes me back to the welcome screen. Can't get past sign in at all.",
  },
  {
    id: "a2",
    channel: "SOCIAL_MEDIA",
    expected: "MOBILE_APP_AUTHENTICATION",
    message: "Been waiting 40 mins for the 6-digit code to get into my account. SMS never shows up. Useless.",
  },
  {
    id: "a3",
    channel: "CONTACT_CENTER",
    expected: "MOBILE_APP_AUTHENTICATION",
    message:
      "Customer locked out of mobile banking after face ID failed repeatedly; reset attempted, verification code not delivered.",
  },
  {
    id: "a4",
    channel: "WHATSAPP",
    expected: "MOBILE_APP_AUTHENTICATION",
    message: "I just buy new phone, the app no gree recognise me again. E dey ask for code wey no dey come.",
  },
  {
    id: "a5",
    channel: "EMAIL",
    expected: "MOBILE_APP_AUTHENTICATION",
    message:
      "I can open the app but it rejects my PIN as wrong, even though it works on USSD. Please help me get access back.",
  },

  // CARD_PAYMENT_FAILURE
  {
    id: "c1",
    channel: "SOCIAL_MEDIA",
    expected: "CARD_PAYMENT_FAILURE",
    message: "Standing at the supermarket till with a full trolley and your card keeps getting rejected. Embarrassing.",
  },
  {
    id: "c2",
    channel: "MOBILE_APP",
    expected: "CARD_PAYMENT_FAILURE",
    message:
      "Tried to pay for my Netflix and an online course, both said transaction declined by issuer. There is money in the account.",
  },
  {
    id: "c3",
    channel: "CONTACT_CENTER",
    expected: "CARD_PAYMENT_FAILURE",
    message:
      "Customer reports POS terminal showed 'issuer or switch inoperative' at pharmacy; funds deducted, merchant received no value.",
  },
  {
    id: "c4",
    channel: "WHATSAPP",
    expected: "CARD_PAYMENT_FAILURE",
    message: "The POS man say my card no go through but alert don enter. Na wa.",
  },
  {
    id: "c5",
    channel: "WEB",
    expected: "CARD_PAYMENT_FAILURE",
    message: "Checkout on an airline website fails at the 3D secure step with my debit card every time.",
  },

  // ATM_WITHDRAWAL_FAILURE
  {
    id: "m1",
    channel: "BRANCH",
    expected: "ATM_WITHDRAWAL_FAILURE",
    message: "The machine outside counted the notes, made the noise, and gave me nothing. My account was charged.",
  },
  {
    id: "m2",
    channel: "SOCIAL_MEDIA",
    expected: "ATM_WITHDRAWAL_FAILURE",
    message:
      "Third cash machine of yours today that says 'temporarily unable to dispense'. Where am I supposed to get cash?",
  },
  {
    id: "m3",
    channel: "CONTACT_CENTER",
    expected: "ATM_WITHDRAWAL_FAILURE",
    message: "Customer withdrew ₦40,000, terminal released ₦20,000 only. Requests refund of balance.",
  },
  {
    id: "m4",
    channel: "WHATSAPP",
    expected: "ATM_WITHDRAWAL_FAILURE",
    message: "The ATM swallow my card for Ikeja and e no bring money. Wetin I go do now?",
  },
  {
    id: "m5",
    channel: "EMAIL",
    expected: "ATM_WITHDRAWAL_FAILURE",
    message:
      "Please reverse a debit of ₦10,000 from last night; the cash point displayed an error and no money came out.",
  },

  // BRANCH_SERVICE_DELAY
  {
    id: "b1",
    channel: "BRANCH",
    expected: "BRANCH_SERVICE_DELAY",
    message: "I came in at opening time to deposit a cheque and I'm still standing here after lunch.",
  },
  {
    id: "b2",
    channel: "SOCIAL_MEDIA",
    expected: "BRANCH_SERVICE_DELAY",
    message: "One teller serving the entire banking hall at your Wuse office. The rest are on 'break'. Pathetic.",
  },
  {
    id: "b3",
    channel: "WEB",
    expected: "BRANCH_SERVICE_DELAY",
    message: "Waited almost three hours just to update a signature card. There should be a faster way.",
  },
  {
    id: "b4",
    channel: "WHATSAPP",
    expected: "BRANCH_SERVICE_DELAY",
    message: "Una branch for Aba too slow. People don stand for hours, nobody dey attend to us.",
  },
  {
    id: "b5",
    channel: "EMAIL",
    expected: "BRANCH_SERVICE_DELAY",
    message: "The queue to see customer service at the Marina branch went outside the door this morning.",
  },

  // USSD_SERVICE_FAILURE
  {
    id: "u1",
    channel: "CONTACT_CENTER",
    expected: "USSD_SERVICE_FAILURE",
    message:
      "Customer dials the short code and gets 'MMI code invalid'. Has no smartphone; cannot buy airtime or transfer.",
  },
  {
    id: "u2",
    channel: "SOCIAL_MEDIA",
    expected: "USSD_SERVICE_FAILURE",
    message: "Your star-code banking just spins then says 'connection problem'. Some of us rely on it in the village.",
  },
  {
    id: "u3",
    channel: "USSD",
    expected: "USSD_SERVICE_FAILURE",
    message: "The menu comes up but after I put PIN it says session ended. Every time.",
  },
  {
    id: "u4",
    channel: "WHATSAPP",
    expected: "USSD_SERVICE_FAILURE",
    message: "The code wey I dey dial for my small phone no dey work since morning.",
  },
  {
    id: "u5",
    channel: "BRANCH",
    expected: "USSD_SERVICE_FAILURE",
    message: "My mother uses the dial-code service on her basic phone and it hasn't responded for two days.",
  },

  // UNAUTHORISED_CHARGES
  {
    id: "f1",
    channel: "EMAIL",
    expected: "UNAUTHORISED_CHARGES",
    message: "Why was I charged ₦1,075 'card maintenance' this month when I don't even have an active card?",
  },
  {
    id: "f2",
    channel: "SOCIAL_MEDIA",
    expected: "UNAUTHORISED_CHARGES",
    message: "Small small deductions every week with no explanation. SMS fee, stamp duty, what next? Breathing fee?",
  },
  {
    id: "f3",
    channel: "CONTACT_CENTER",
    expected: "UNAUTHORISED_CHARGES",
    message: "Customer disputes monthly account maintenance charge applied to a savings account he believes is exempt.",
  },
  {
    id: "f4",
    channel: "WHATSAPP",
    expected: "UNAUTHORISED_CHARGES",
    message: "Una dey cut money from my account anyhow. Which kind charge be this?",
  },
  {
    id: "f5",
    channel: "WEB",
    expected: "UNAUTHORISED_CHARGES",
    message: "I see a ₦50 fee on every single alert. Nobody told me SMS alerts would cost this much.",
  },

  // SUSPECTED_FRAUD
  {
    id: "x1",
    channel: "CONTACT_CENTER",
    expected: "SUSPECTED_FRAUD",
    message:
      "Customer received a call from someone claiming to be bank staff asking for her card PIN to 'upgrade' her account.",
  },
  {
    id: "x2",
    channel: "MOBILE_APP",
    expected: "SUSPECTED_FRAUD",
    message: "There are three transfers to an account I don't know at 2am. I was asleep. Please freeze everything.",
  },
  {
    id: "x3",
    channel: "SOCIAL_MEDIA",
    expected: "SUSPECTED_FRAUD",
    message: "Got a text saying my BVN is suspended with a link to 'reactivate'. Is this you? Looks fake.",
  },
  {
    id: "x4",
    channel: "WHATSAPP",
    expected: "SUSPECTED_FRAUD",
    message: "Somebody don enter my account, dem withdraw money wey I no know about.",
  },
  {
    id: "x5",
    channel: "EMAIL",
    expected: "SUSPECTED_FRAUD",
    message: "My card was used for purchases in another country while it was in my wallet in Lagos.",
  },

  // ACCOUNT_STATEMENT_REQUEST
  {
    id: "s1",
    channel: "EMAIL",
    expected: "ACCOUNT_STATEMENT_REQUEST",
    message: "Please send me my transaction history for January to June, I need it for a visa application.",
  },
  {
    id: "s2",
    channel: "WEB",
    expected: "ACCOUNT_STATEMENT_REQUEST",
    message: "How do I get a stamped six-month bank record for my landlord?",
  },
  {
    id: "s3",
    channel: "BRANCH",
    expected: "ACCOUNT_STATEMENT_REQUEST",
    message: "I need a letter confirming my account and its balance for the embassy.",
  },
  {
    id: "s4",
    channel: "WHATSAPP",
    expected: "ACCOUNT_STATEMENT_REQUEST",
    message: "Abeg send my account history for last 3 months to my email.",
  },
  {
    id: "s5",
    channel: "CONTACT_CENTER",
    expected: "ACCOUNT_STATEMENT_REQUEST",
    message: "Customer requests 12 months of statements for a mortgage application.",
  },

  // ACCOUNT_UPDATE_REQUEST
  {
    id: "k1",
    channel: "BRANCH",
    expected: "ACCOUNT_UPDATE_REQUEST",
    message: "I moved house last month and want my new address on the account.",
  },
  {
    id: "k2",
    channel: "EMAIL",
    expected: "ACCOUNT_UPDATE_REQUEST",
    message: "I lost my old SIM. Please link my account to my new number so I can get alerts.",
  },
  {
    id: "k3",
    channel: "CONTACT_CENTER",
    expected: "ACCOUNT_UPDATE_REQUEST",
    message: "Customer got married and wishes to change surname on account records.",
  },
  {
    id: "k4",
    channel: "WHATSAPP",
    expected: "ACCOUNT_UPDATE_REQUEST",
    message: "I wan add my NIN to my account, wetin I need bring?",
  },
  {
    id: "k5",
    channel: "WEB",
    expected: "ACCOUNT_UPDATE_REQUEST",
    message: "My account was restricted for incomplete KYC. How do I upload my ID and utility bill?",
  },

  // CARD_REQUEST
  {
    id: "r1",
    channel: "BRANCH",
    expected: "CARD_REQUEST",
    message: "My card expires next month. When will the new one be ready?",
  },
  {
    id: "r2",
    channel: "MOBILE_APP",
    expected: "CARD_REQUEST",
    message: "I'd like a dollar card for online subscriptions. How do I apply?",
  },
  {
    id: "r3",
    channel: "WHATSAPP",
    expected: "CARD_REQUEST",
    message: "My card don spoil, e don crack for middle. I need another one.",
  },
  {
    id: "r4",
    channel: "EMAIL",
    expected: "CARD_REQUEST",
    message: "Please issue a replacement — my wallet was stolen yesterday and I have already blocked the old one.",
  },
  {
    id: "r5",
    channel: "CONTACT_CENTER",
    expected: "CARD_REQUEST",
    message: "Customer enquiring about status of new debit card requested two weeks ago at Ikeja branch.",
  },

  // LOAN_ENQUIRY
  {
    id: "l1",
    channel: "WEB",
    expected: "LOAN_ENQUIRY",
    message: "What's the interest on the quick credit you offer salary earners, and how fast is approval?",
  },
  {
    id: "l2",
    channel: "WHATSAPP",
    expected: "LOAN_ENQUIRY",
    message: "Una dey give small business loan? I wan expand my shop.",
  },
  {
    id: "l3",
    channel: "EMAIL",
    expected: "LOAN_ENQUIRY",
    message: "Can I pay off my car financing early without a penalty?",
  },
  {
    id: "l4",
    channel: "MOBILE_APP",
    expected: "LOAN_ENQUIRY",
    message: "I applied for credit in the app a week ago, it still says under review.",
  },
  {
    id: "l5",
    channel: "BRANCH",
    expected: "LOAN_ENQUIRY",
    message: "What documents do I need to borrow against my fixed deposit?",
  },

  // GENERAL_FEEDBACK
  {
    id: "g1",
    channel: "SOCIAL_MEDIA",
    expected: "GENERAL_FEEDBACK",
    message: "Shout out to the lady at the Ikoyi customer desk, she sorted me out in five minutes. 10/10.",
  },
  {
    id: "g2",
    channel: "EMAIL",
    expected: "GENERAL_FEEDBACK",
    message: "Just a suggestion: it would be nice to have weekend opening hours at bigger branches.",
  },
  {
    id: "g3",
    channel: "WEB",
    expected: "GENERAL_FEEDBACK",
    message: "The new dark mode in the app is lovely. Keep it up.",
  },
  {
    id: "g4",
    channel: "WHATSAPP",
    expected: "GENERAL_FEEDBACK",
    message: "Una do well o, the app don better pass before.",
  },
  {
    id: "g5",
    channel: "BRANCH",
    expected: "GENERAL_FEEDBACK",
    message: "The banking hall is much cleaner and better organised since the renovation. Well done.",
  },
];
