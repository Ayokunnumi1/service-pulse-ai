import type { ProductCode } from "@/lib/constants";

/**
 * Fictional banks and organisational structures. No real bank's
 * organisational information is used.
 */

export interface SeedTeam {
  name: string;
  description: string;
  responsibilities: string[];
  products: ProductCode[];
}

export interface SeedDepartment {
  name: string;
  description: string;
  teams: SeedTeam[];
}

export interface SeedSystem {
  name: string;
  description: string;
  product: ProductCode | null;
  ownerTeam: string;
}

export interface SeedBranch {
  code: string;
  name: string;
  city: string;
  region: string;
}

export interface SeedBank {
  slug: string;
  name: string;
  brand: string;
  handle: string;
  description: string;
  departments: SeedDepartment[];
  products: ProductCode[];
  systems: SeedSystem[];
  branches: SeedBranch[];
}

export const KESTREL: SeedBank = {
  slug: "kestrel-trust",
  name: "Kestrel Trust Bank",
  brand: "Kestrel",
  handle: "@KestrelTrustNG",
  description: "Fictional tier-1 commercial bank with a large retail and digital customer base (demo data).",
  products: [
    "MOBILE_BANKING",
    "INTERNET_BANKING",
    "USSD_BANKING",
    "DEBIT_CARD",
    "CREDIT_CARD",
    "ATM",
    "SAVINGS_ACCOUNT",
    "CURRENT_ACCOUNT",
    "LOANS",
    "BRANCH_SERVICES",
  ],
  departments: [
    {
      name: "IT Department",
      description: "Technology engineering and operations.",
      teams: [
        {
          name: "Backend Team",
          description: "Core transaction services and integrations.",
          responsibilities: [
            "APIs",
            "transaction processing",
            "backend services",
            "integrations",
            "interbank transfer (NIP) integration",
            "core banking transaction posting",
          ],
          products: ["MOBILE_BANKING", "INTERNET_BANKING", "USSD_BANKING"],
        },
        {
          name: "Mobile Team",
          description: "Customer mobile banking applications.",
          responsibilities: [
            "Android application",
            "iOS application",
            "mobile UI",
            "mobile authentication",
            "device binding and biometric login",
          ],
          products: ["MOBILE_BANKING"],
        },
        {
          name: "Infrastructure Team",
          description: "Hosting, networks and platform reliability.",
          responsibilities: [
            "servers",
            "networking",
            "cloud infrastructure",
            "uptime",
            "ATM and branch network connectivity",
          ],
          products: [],
        },
        {
          name: "Security Team",
          description: "Information security and identity services.",
          responsibilities: [
            "fraud detection and monitoring",
            "OTP and token services",
            "identity and access security",
            "account compromise incident response",
          ],
          products: [],
        },
        {
          name: "Database Team",
          description: "Data platforms and core ledger databases.",
          responsibilities: [
            "databases",
            "core ledger database performance",
            "data replication",
            "end-of-day batch jobs",
          ],
          products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
        },
      ],
    },
    {
      name: "Operations Department",
      description: "Banking operations and payments back office.",
      teams: [
        {
          name: "Payments Operations",
          description: "Payment exceptions and settlement.",
          responsibilities: [
            "payment reconciliation",
            "transaction exceptions",
            "settlement operations",
            "failed transfer reversals",
          ],
          products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
        },
        {
          name: "Branch Operations",
          description: "Branch network service delivery.",
          responsibilities: ["branch staffing", "queue management", "teller operations", "branch service standards"],
          products: ["BRANCH_SERVICES"],
        },
        {
          name: "Reconciliation Team",
          description: "Account, card and ATM reconciliation.",
          responsibilities: [
            "account reconciliation",
            "ATM cash reconciliation",
            "dispense-error refunds",
            "general ledger balancing",
          ],
          products: ["ATM"],
        },
      ],
    },
    {
      name: "Customer Experience",
      description: "Customer-facing service and complaint handling.",
      teams: [
        {
          name: "Contact Centre",
          description: "Voice, email and social customer support.",
          responsibilities: ["customer communication", "complaints", "service recovery"],
          products: [],
        },
        {
          name: "Customer Resolution Team",
          description: "Escalated complaint resolution.",
          responsibilities: ["complaint escalations", "customer refund follow-up", "regulatory complaint reporting"],
          products: [],
        },
      ],
    },
    {
      name: "Card Services",
      description: "Card issuing and acquiring.",
      teams: [
        {
          name: "Card Operations",
          description: "Card lifecycle and ATM card transactions.",
          responsibilities: [
            "card issuance",
            "card activation",
            "card transaction issues",
            "ATM cash dispensing and card retention",
            "card disputes and chargebacks",
          ],
          products: ["DEBIT_CARD", "CREDIT_CARD", "ATM"],
        },
        {
          name: "POS Support Team",
          description: "Merchant POS and card payment acceptance.",
          responsibilities: ["POS terminals", "merchant acquiring", "card payment gateway and online card payments"],
          products: ["DEBIT_CARD", "CREDIT_CARD"],
        },
      ],
    },
    {
      name: "Digital Banking",
      description: "Digital channel product management.",
      teams: [
        {
          name: "Digital Channels Team",
          description: "USSD, internet and WhatsApp banking channels.",
          responsibilities: ["USSD channel", "internet banking", "WhatsApp banking", "digital channel performance"],
          products: ["USSD_BANKING", "INTERNET_BANKING"],
        },
      ],
    },
  ],
  systems: [
    {
      name: "Transaction Processing API",
      description: "Initiates and posts customer transfers.",
      product: "MOBILE_BANKING",
      ownerTeam: "Backend Team",
    },
    {
      name: "Interbank Transfer Gateway",
      description: "NIP integration for transfers to other banks.",
      product: "MOBILE_BANKING",
      ownerTeam: "Backend Team",
    },
    {
      name: "Mobile Banking App",
      description: "Android and iOS customer applications.",
      product: "MOBILE_BANKING",
      ownerTeam: "Mobile Team",
    },
    {
      name: "Authentication & OTP Service",
      description: "Login, OTP and device-binding service.",
      product: "MOBILE_BANKING",
      ownerTeam: "Security Team",
    },
    {
      name: "USSD Gateway",
      description: "USSD session handling with telcos.",
      product: "USSD_BANKING",
      ownerTeam: "Digital Channels Team",
    },
    {
      name: "Card Management System",
      description: "Card issuing, limits and status.",
      product: "DEBIT_CARD",
      ownerTeam: "Card Operations",
    },
    {
      name: "Card Payment Switch",
      description: "Authorises POS and online card payments.",
      product: "DEBIT_CARD",
      ownerTeam: "POS Support Team",
    },
    {
      name: "ATM Network Controller",
      description: "ATM fleet monitoring and connectivity.",
      product: "ATM",
      ownerTeam: "Infrastructure Team",
    },
    {
      name: "Core Banking Ledger",
      description: "Account balances and postings.",
      product: "CURRENT_ACCOUNT",
      ownerTeam: "Database Team",
    },
    {
      name: "Branch Queue Management System",
      description: "Ticketing and queue analytics in branches.",
      product: "BRANCH_SERVICES",
      ownerTeam: "Branch Operations",
    },
    {
      name: "Reconciliation Engine",
      description: "Matches switch, ledger and ATM records.",
      product: null,
      ownerTeam: "Reconciliation Team",
    },
  ],
  branches: [
    { code: "LAG-LEK", name: "Lekki Phase 1", city: "Lagos", region: "South West" },
    { code: "LAG-IKJ", name: "Ikeja GRA", city: "Lagos", region: "South West" },
    { code: "LAG-VIC", name: "Victoria Island", city: "Lagos", region: "South West" },
    { code: "LAG-YAB", name: "Yaba", city: "Lagos", region: "South West" },
    { code: "ABJ-WUS", name: "Wuse II", city: "Abuja", region: "North Central" },
    { code: "ABJ-GAR", name: "Garki", city: "Abuja", region: "North Central" },
    { code: "PHC-TAM", name: "Trans-Amadi", city: "Port Harcourt", region: "South South" },
    { code: "IBD-BOD", name: "Bodija", city: "Ibadan", region: "South West" },
    { code: "KAN-MAI", name: "Kano Main", city: "Kano", region: "North West" },
    { code: "ENU-OGR", name: "Ogui Road", city: "Enugu", region: "South East" },
    { code: "BEN-RNG", name: "Ring Road", city: "Benin City", region: "South South" },
    { code: "KAD-AHM", name: "Ahmadu Bello Way", city: "Kaduna", region: "North West" },
  ],
};

export const HARBOURLINE: SeedBank = {
  slug: "harbourline",
  name: "Harbourline Bank",
  brand: "Harbourline",
  handle: "@HarbourlineBank",
  description: "Fictional mid-sized retail bank with a USSD-heavy customer base (demo data).",
  products: [
    "MOBILE_BANKING",
    "USSD_BANKING",
    "DEBIT_CARD",
    "ATM",
    "SAVINGS_ACCOUNT",
    "CURRENT_ACCOUNT",
    "BRANCH_SERVICES",
  ],
  departments: [
    {
      name: "Technology",
      description: "All engineering functions.",
      teams: [
        {
          name: "Core Banking Team",
          description: "Core banking platform and transfers.",
          responsibilities: [
            "core banking platform",
            "transaction processing",
            "interbank transfers",
            "APIs and integrations",
          ],
          products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT", "MOBILE_BANKING"],
        },
        {
          name: "Digital Team",
          description: "Mobile and USSD channels.",
          responsibilities: ["mobile app", "USSD channel and telco integration", "login and authentication"],
          products: ["MOBILE_BANKING", "USSD_BANKING"],
        },
        {
          name: "Infrastructure & Networks",
          description: "Servers, network and ATM connectivity.",
          responsibilities: ["servers", "networks", "ATM connectivity", "uptime monitoring"],
          products: [],
        },
      ],
    },
    {
      name: "Operations",
      description: "Back-office operations.",
      teams: [
        {
          name: "Settlement & Reconciliation",
          description: "Settlement, reversals and reconciliation.",
          responsibilities: ["settlement", "reconciliation", "failed transaction reversals", "ATM cash reconciliation"],
          products: ["CURRENT_ACCOUNT", "SAVINGS_ACCOUNT"],
        },
      ],
    },
    {
      name: "Cards & Payments",
      description: "Cards and merchant payments.",
      teams: [
        {
          name: "Cards Unit",
          description: "Card issuing, POS and ATM dispense issues.",
          responsibilities: [
            "card issuance",
            "card transaction issues",
            "POS and online card payments",
            "ATM dispense errors",
          ],
          products: ["DEBIT_CARD", "ATM"],
        },
      ],
    },
    {
      name: "Customer Service",
      description: "Customer support.",
      teams: [
        {
          name: "Customer Care",
          description: "Customer support desk.",
          responsibilities: ["customer communication", "complaints handling", "service recovery"],
          products: [],
        },
      ],
    },
  ],
  systems: [
    {
      name: "Core Banking Platform",
      description: "Accounts and postings.",
      product: "CURRENT_ACCOUNT",
      ownerTeam: "Core Banking Team",
    },
    {
      name: "USSD Platform",
      description: "USSD menus and telco sessions.",
      product: "USSD_BANKING",
      ownerTeam: "Digital Team",
    },
    { name: "Mobile App", description: "Customer mobile app.", product: "MOBILE_BANKING", ownerTeam: "Digital Team" },
    { name: "Card Switch", description: "Card authorisation switch.", product: "DEBIT_CARD", ownerTeam: "Cards Unit" },
  ],
  branches: [
    { code: "HB-MAR", name: "Marina", city: "Lagos", region: "South West" },
    { code: "HB-SUR", name: "Surulere", city: "Lagos", region: "South West" },
    { code: "HB-MAI", name: "Maitama", city: "Abuja", region: "North Central" },
    { code: "HB-PHG", name: "Port Harcourt GRA", city: "Port Harcourt", region: "South South" },
    { code: "HB-DUG", name: "Dugbe", city: "Ibadan", region: "South West" },
    { code: "HB-OWR", name: "Wetheral Road", city: "Owerri", region: "South East" },
  ],
};

export const SEED_BANKS: SeedBank[] = [KESTREL, HARBOURLINE];
