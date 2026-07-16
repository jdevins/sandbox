// Full corpus for Jeremy D. Stiffler — the single source of truth.
//
// This file is never trimmed or reframed for a specific pitch; that happens in
// data/pitches/*.js, which select and emphasize a subset of this corpus. Keep
// every fact here even if no current pitch uses it — future pitches draw from
// the same well.
//
// Versioning: this file is tracked in git, so `git log` / `git blame` is the
// revision history. Each section below carries a `source` array pointing at
// the original file(s) in the career-development directory it was extracted
// from, so a future refinement pass can go straight to the relevant document
// instead of re-reading the whole corpus.

export const corpus = {
  sourceDirectory:
    'C:\\Users\\jdevi\\OneDrive\\Personal Items\\Career Development\\Me MDS',
  scannedAt: '2026-07-15',
  filesScanned: [
    'Applications.md',
    'Azure  - AI Fundamentals.md (empty)',
    'Business Analyst Experiences.md',
    'Business Analyst Skills.md',
    'Cover Letter - General.md',
    'Cover Letter - Improvement.md',
    'Jeremy D. Stiffler Resume - 2018 - Skills Based.md',
    'Jeremy D. Stiffler Resume - 2021 - USAA.md',
    'Jeremy D. Stiffler Resume.md',
    'Jeremy Devin Stiffler-ScrumAlliance_CSM_Certificate.md',
    'Jeremy Stiffler - Business Analyst Experiences.md',
    'Jeremy Stiffler - Cover Letter NFCU.md',
    'Jeremy Stiffler - Reference Letter.md',
    'Jeremy Stiffler - Variety Experiences.md',
    'PMI Certfication.md',
    'References.md',
    'Resume - Jeremy D. Stiffler PMP - 2024v1 .md (not yet read)',
    'Resume - Jeremy D. Stiffler PMP - 2025v1 -ERP.md',
    'Resume - Jeremy D. Stiffler PMP - 2025v1 -LexNex.md',
    'Resume - Jeremy D. Stiffler PMP - 2025v1 -NFCU.md',
    'Resume - Jeremy D. Stiffler PMP - 2025v1 .md',
    'Resume - Jeremy D. Stiffler PMP - 2025v1.md (duplicate filename, not yet read)',
    'Resume - Jeremy D. Stiffler PMP- 2022v9 .md',
  ],
  omitted: [
    {
      what: '"Entire team got released, I saved the project" anecdote',
      why: 'No specifics captured yet — teaser only in Cover Letter - General.md. Excluded from wins until detail is supplied.',
      source: ['Cover Letter - General.md'],
    },
    {
      what: 'Named reference contacts (phone/email)',
      why: 'References.md contains third-party PII — deliberately excluded from any public-facing page. See references[].',
      source: ['References.md'],
    },
  ],
};

export const identity = {
  name: 'Jeremy D. Stiffler',
  contact: {
    email: 'jdevinstiffler@gmail.com',
    phone: '904.514.8724',
  },
  personalNote:
    'Proud son of a US Navy Master Chief (Ret.) and a US Navy Senior Chief (Ret.) — Mom was the master chief.',
  voice:
    'Dry, self-aware, quietly confident. Cracks a joke about being ATS-scanned, signs off cover letters with "good luck (to us both)." Not corporate-sanitized — preserve this in copywriting.',
  source: [
    'Jeremy D. Stiffler Resume.md',
    'Cover Letter - General.md',
    'Jeremy D. Stiffler Resume - 2018 - Skills Based.md',
  ],
};

export const thesis = {
  id: 'judgment-layer',
  statement:
    'AI multiplies options; judgment decides which one survives contact with real systems and real consequences.',
};

export const education = [
  {
    degree: 'B.S. Technical Project Management',
    honors: 'w/Honors',
    school: 'ITT Technical Institute',
    year: 2007,
  },
  {
    degree: 'A.S. Computer and Electronic Engineering',
    honors: 'Valedictorian',
    school: 'ITT Technical Institute',
    year: 2003,
  },
];

// status: 'historical' = earned but currently lapsed as of corpus.scannedAt.
// Do not render as "active" on any pitch without re-verifying expiry.
export const certifications = [
  {
    name: 'Project Management Professional (PMP)',
    issuer: 'PMI',
    granted: '2022-08-25',
    expired: '2025-08-25',
    status: 'historical',
    source: ['PMI Certfication.md'],
  },
  {
    name: 'Certified ScrumMaster (CSM)',
    issuer: 'Scrum Alliance',
    granted: '2022-07-28',
    expired: '2024-07-28',
    status: 'historical',
    source: ['Jeremy Devin Stiffler-ScrumAlliance_CSM_Certificate.md'],
  },
  {
    name: 'AWS Certified Cloud Practitioner',
    code: 'CLF-C01',
    status: 'unverified-expiry',
    source: ['Resume - Jeremy D. Stiffler PMP - 2025v1 .md'],
  },
  {
    name: 'Microsoft Azure AI Fundamentals',
    code: 'AI-900',
    status: 'unverified-expiry',
    source: ['Resume - Jeremy D. Stiffler PMP - 2025v1 .md'],
  },
];

// Reverse chronological. `tags` support filtering by pitch (e.g. sales-engineer
// evidence, integration depth, leadership). `public` gates whether a role's
// raw text is safe to show as-is; all are currently public at the summary level.
export const roles = [
  {
    id: 'defi-solutions',
    title: 'Lead Integration Engineer',
    org: 'defi Solutions',
    start: '2022-08',
    end: null,
    current: true,
    summary:
      'Design and deployment of strategic enterprise loan origination integrations to vendor platforms. Azure/AWS mix, REST/SOAP messaging, .NET C# services tier, microservices, Azure Blob + SQL managed instances. Designed AI-driven solutions for loan documentation validation, internal KBA generation, and API observability.',
    highlights: [
      'Technical liaison and trusted partner to executive leadership, vendor partners, and sales teams for high-value analysis and insights to ecosystem integrations.',
      'SME for KYC, OFAC, AML, fraud processing and due diligence; rules-based screening for consumer, business, and financial-institution verification.',
      'Compliance surface: GLBA, DPPA, FCRA.',
      'Point of contact for Lexis Nexis vendor relations and client engagements.',
      'SME for document management systems, eSign, and AI-based classification/data extraction.',
      'Serves as Product Manager, Project Manager, and Business Analyst where necessary.',
      'Led Agile transformation initiatives.',
      'Works directly with vendors to define, scope, test, and maintain integration solutions.',
      'Evaluates and consults on new and updated vendor partnerships and integrations.',
      'Partners with the Revenue team on reconciliation.',
      'Regular client-facing work delivering clarity on expectations and deliverables.',
      'Channels feedback, ideas, and concepts surfaced in sales demos directly into product development.',
    ],
    tags: ['integration', 'fintech', 'compliance', 'ai', 'sales-liaison'],
    source: [
      'Resume - Jeremy D. Stiffler PMP - 2025v1 .md',
      'Resume - Jeremy D. Stiffler PMP - 2025v1 -ERP.md',
      'Resume - Jeremy D. Stiffler PMP - 2025v1 -LexNex.md',
      'Resume - Jeremy D. Stiffler PMP- 2022v9 .md',
    ],
    // Current systems/vendor ecosystem at defi — provided directly by Jeremy
    // in conversation, not sourced from the career-development directory.
    // This is live, present-tense depth, not résumé material, which is why it
    // carries its own asOf/source rather than reusing the role's source list.
    platformEcosystem: {
      asOf: '2026-07-15',
      source: ['provided directly by Jeremy, 2026-07-15'],
      groups: [
        { group: 'Core Platform', items: ['OriginationsAPI', 'Servicing AAE', 'Servicing AWR'] },
        { group: 'Direct Lending Workflows', items: ['CarletonCarCalcs', 'CarletonCalcs', 'CarletonDocs', 'CarletonCompliance', 'eOriginal', 'Boarding AML'] },
        { group: 'Portal Integrations', items: ['RouteOne', 'DealerTrack', 'DDS'] },
        { group: 'KYC & Risk — Lexis Nexis', items: ['ConsumerInstantID', 'BusinessInstantID', 'FraudPoint', 'RiskView', 'DDP orchestration platform', 'Emailage', 'Phone Intelligence', 'Fraud Intelligence', 'Bridger'] },
        { group: 'KYC & Risk — other vendors', items: ['Point Predictive', 'Equifax products'] },
        { group: 'Guidebooks', items: ['JDPower', 'BlackBook'] },
        { group: 'Funding', items: ['Booking', 'defiDOCS', 'InformedIQ'] },
      ],
      // Not folded into `groups` above — don't want "current" and "pending/new"
      // silently blurred together the way the certifications section learned
      // the hard way to keep expired vs. active distinct.
      pending: [
        { item: 'Docusign', note: 'Not yet live — flagged "soon?" by Jeremy. Don\'t present as current.' },
        { item: 'Chrome', note: 'New guidebook addition, recently adopted.' },
      ],
    },
    // Internal sales-demo contributions at defi — provided directly by Jeremy
    // (2026-07-15). This is the pitch's power move: the CSO likely does NOT
    // know Jeremy already prepped integrations and demo readiness behind the
    // sales team's recent named wins. Contribution is support, not sales
    // ownership — represent it exactly as given: prepped integration use cases,
    // features, and ensured readiness. Do not imply he closed or led the sale.
    internalDemoWork: {
      asOf: '2026-07-15',
      source: ['provided directly by Jeremy, 2026-07-15'],
      contribution:
        'Prepped features and integrations, built integration use cases, and ensured demo readiness for the sales team.',
      prospects: [
        // "Navy" as given; near-certainly Navy Federal Credit Union — corroborated
        // by the NFCU cover letter and Applications.md already in the corpus.
        { name: 'Navy Federal', asGiven: 'Navy' },
        { name: 'Landmark', asGiven: 'Landmark' },
        { name: 'M&T Bank', asGiven: 'M&T Bank' },
        { name: 'PenFed', asGiven: 'PenFed' },
      ],
    },
    // Vendor breadth + named client-facing work at defi — provided directly by
    // Jeremy in conversation (2026-07-16). `clients` was mid-dictation when the
    // message was interrupted — treat it as partial, not exhaustive, until a
    // follow-up round confirms the rest of the list.
    clientVendorWork: {
      asOf: '2026-07-16',
      source: ['provided directly by Jeremy, 2026-07-16'],
      tradeShowCadence: '4–5 trade shows a year — live demos on the floor, environment prep, and prospect handoffs.',
      vendorPoc: 'Point of contact for numerous vendors; runs product/feature evaluations and scoping for new and updated integrations.',
      keyVendors: ['Carleton', 'Lexis Nexis', 'Equifax', 'Guidebooks', 'Informed'],
      clients: [
        'Stellantis', 'Nissan', 'Ally', 'Porsche', 'Ferrari', 'BOA',
        'TD Bank', 'VW', 'VW Canada', 'Porsche Canada', 'Toyota Canada', 'Hyundai Capital', 'Mazda',
      ],
      clientsPartial: true,
      // Feature-demo attribution (distinct from the client-facing list above).
      featureDemoClients: ['Toyota', 'Ally', 'Nissan', 'Stellantis'],
    },
  },
  {
    id: 'navusoft',
    title: 'Director of Implementation Services',
    org: 'Navusoft',
    start: '2021-02',
    end: '2021-10',
    current: false,
    note: 'Startup, pre-funding — role and company folded when anticipated funding never materialized.',
    summary:
      'Built an implementation department from scratch inside a CRM startup: delivery lifecycle process, billable/non-billable tracking, KPIs for utilization, early Agile Scrum adoption.',
    highlights: [
      'Established billable/non-billable activity tracking and management.',
      'Developed KPIs for measuring utilization and resource allocation.',
      'Implemented project planning tools and processes from zero.',
    ],
    tags: ['0-to-1', 'process-design', 'resilience'],
    source: ['Resume - Jeremy D. Stiffler PMP - 2025v1 .md'],
  },
  {
    id: 'system-innovators',
    title: 'Senior Project Manager',
    org: 'System Innovators (subsidiary of Harris Computer)',
    start: '2016-12',
    end: '2021-02',
    current: false,
    summary:
      'iPaaS-style platform and integrations for municipal government, consolidating and normalizing revenue streams across departments for the 50 largest US cities/counties.',
    highlights: [
      'Led project bookings of $1.5M–$2.5M in Professional Services annually.',
      'Led the flagship 3-server app migration to AWS cloud.',
      'Designed high-complexity ERP, CRM, ETL, and data warehousing integrations for major cities/counties.',
      'Designed and delivered PCI-DSS compliant payment integrations: hosted pay pages, payment gateways, EMV pin pads.',
      'Coached and trained new PMs, Business Analysts, and Technical Analysts.',
      'Product Owner for org-wide tech roadmap: AWS lift-and-shift, client portal, knowledge repositories.',
    ],
    tags: ['integration', 'government', 'scale', 'payments', 'leadership'],
    source: [
      'Resume - Jeremy D. Stiffler PMP - 2025v1 .md',
      'Resume - Jeremy D. Stiffler PMP- 2022v9 .md',
    ],
  },
  {
    id: 'desertmicro',
    title: 'Senior Business Analyst / SME',
    org: 'DesertMicro',
    start: '2012-05',
    end: '2016-12',
    current: false,
    note: '70% travel. This is the direct Sales Engineer precedent — same duties, different title.',
    summary:
      'Travel-heavy onsite delivery role: implementation, training, rollouts, and SME for sales trade shows and demos in the Waste & Recycling software space.',
    highlights: [
      'SME for sales trade shows and demos.',
      'Supported presales demonstrations, trade shows, and vendor bid/RFP responses as product SME.',
      'Launched company-first in-field Sales CRM (logistics, contracting, payments).',
      'Implemented company-first cloud-hosted multi-instance SaaS product.',
      'Unofficial Product Manager for multiple software packages — UX/UI, backlog, testing, delivery.',
      'Led client workshops to shape feature development and outreach.',
    ],
    tags: ['sales-engineer-precedent', 'demos', 'trade-shows', 'rfp', 'field-presence'],
    source: [
      'Resume - Jeremy D. Stiffler PMP - 2025v1 .md',
      'Jeremy D. Stiffler Resume - 2018 - Skills Based.md',
      'Jeremy D. Stiffler Resume.md',
    ],
  },
  {
    id: 'fisher-communications',
    title: 'Technology Implementation',
    org: 'Fisher Communications Group',
    start: '2010',
    end: '2012',
    current: false,
    summary:
      'Change order evaluation and processing, vendor relations, new technology implementation, safety compliance, business case reporting.',
    highlights: [],
    tags: ['vendor-relations', 'compliance'],
    source: ['Jeremy D. Stiffler Resume - 2018 - Skills Based.md'],
  },
  {
    id: 'brinks',
    title: 'Technical Trainer III',
    org: "Brink's Home Security",
    start: '2005',
    end: '2008',
    current: false,
    summary:
      'Planned and executed training regimens for incoming technicians: skills assessments, activity scheduling, progress reporting. 40% travel.',
    highlights: [],
    tags: ['training', 'field-presence'],
    source: ['Jeremy D. Stiffler Resume - 2018 - Skills Based.md'],
  },
];

// public: true = safe to render the summary as-is. publicQuote: false = the
// underlying fact is usable, but do not attribute it to a named third party
// on a public/shareable page (see references[]).
export const wins = [
  {
    id: 'kent-inovah-launch',
    title: 'City of Kent — iNovah Cashier launch',
    summary:
      'Delivered a complex enterprise POS/cashiering system integration on time and within budget. Traveled on-site for launch day and relayed critical issues back to the team in real time as they surfaced.',
    proofType: 'third-party reference letter',
    public: true,
    publicQuote: false,
    tags: ['judgment', 'crisis-response', 'delivery'],
    source: ['Jeremy Stiffler - Reference Letter.md'],
  },
  {
    id: 'si-bookings',
    title: '$1.5M–$2.5M annual professional services bookings',
    summary:
      'Led project bookings in that range annually at System Innovators across concurrent enterprise finance and integration engagements.',
    public: true,
    tags: ['scale', 'revenue'],
    source: ['Resume - Jeremy D. Stiffler PMP- 2022v9 .md'],
  },
  {
    id: 'flagship-cloud-migration',
    title: 'Flagship app to AWS',
    summary:
      'Led the migration of the flagship 3-server application into AWS cloud.',
    public: true,
    tags: ['cloud', 'modernization'],
    source: ['Resume - Jeremy D. Stiffler PMP- 2022v9 .md'],
  },
  {
    id: 'first-field-sales-crm',
    title: 'First in-field Sales CRM launch',
    summary:
      'Launched DesertMicro’s first field-deployed Sales CRM covering logistics, contracting, and payments — and its first cloud-hosted multi-instance SaaS product.',
    public: true,
    tags: ['0-to-1', 'sales-tooling'],
    source: ['Jeremy D. Stiffler Resume - 2018 - Skills Based.md'],
  },
];

// Third-party references exist but are held back from public rendering by
// decision (2026-07-15) — contact info is PII, and named quotes need
// individual consent. Use `references available on request` on any public
// pitch instead of rendering this list.
export const references = {
  publicDisplay: 'available-on-request',
  count: 5,
  source: ['References.md'],
};

export const capabilities = [
  {
    id: 'systems-fluency',
    label: 'Technical Systems Fluency',
    evidence: [
      'REST/SOAP integrations, .NET C# services, microservices',
      'Azure + AWS cloud (Blob storage, SQL managed instances)',
      'KYC/OFAC/AML rules engines, GLBA/DPPA/FCRA compliance surface',
      'PCI-DSS payment integrations: hosted pay pages, gateways, EMV pin pads',
      'ERP/CRM/ETL and data warehousing design',
    ],
    source: ['defi-solutions', 'system-innovators'],
  },
  {
    id: 'field-presence',
    label: 'Field & Stakeholder Presence',
    evidence: [
      'SME for sales trade shows and product demos',
      'Vendor bid / RFP responses as product SME',
      'On-site crisis response during a live system launch',
      'Client workshops, onsite training and onboarding delivery',
    ],
    source: ['desertmicro', 'system-innovators', 'brinks'],
  },
  {
    id: 'delivery-judgment',
    label: 'Program & Delivery Judgment',
    evidence: [
      'PM/BA track record across govt, fintech, and startup environments',
      '$1.5M–$2.5M annual bookings led',
      'Built an implementation function from zero at a startup',
      'Coached and trained incoming PMs and analysts',
    ],
    source: ['system-innovators', 'navusoft', 'defi-solutions'],
  },
];

// Category-level breadth, deliberately not tied to a specific role or employer.
// Source: the three near-duplicate BA-experience essays (Business Analyst
// Experiences.md, its Jeremy Stiffler-titled twin, and Business Analyst
// Skills.md / "Business Analyst History"), which describe themselves as
// summaries of range, not a per-engagement log. evidenceLevel: 'thematic'
// marks that distinction explicitly — unlike roles[] and wins[], these items
// are not individually traceable to a dated engagement. The abstraction is
// the point: it's a view of range that a role-by-role list can't show.
export const engagementBreadth = {
  evidenceLevel: 'thematic',
  source: [
    'Business Analyst Experiences.md',
    'Jeremy Stiffler - Business Analyst Experiences.md',
    'Business Analyst Skills.md',
  ],
  categories: [
    {
      category: 'Project types led or impacted',
      items: [
        'Professional services (billable, fixed-cost, hybrid milestone billing)',
        'Research & development (market research, wireframes, POCs, A/B testing)',
        'Modernization (cloud migrations, desktop-to-web, system upgrades)',
        'System integrations (REST, SOAP, stored procedures, ODBC, flat file)',
        'Sales (trade shows, demos, vendor relationship management)',
        'Data warehousing & BI (mapping, validation, dashboards)',
        'eCommerce & payment integrations',
        'Point of sale (EMV, receipting, cash management)',
        'Finance/ERP (AR, AP, general ledger)',
        'Customer engagement tooling (email, SMS, IVR, notifications)',
        'Transportation, logistics & warehouse (mobile, GPS/RFID/barcode, DOT compliance)',
        'Process improvement (Six Sigma, Lean, Agile)',
      ],
    },
    {
      category: 'Documentation authored',
      items: [
        'Business requirements documents',
        'Functional & technical specifications',
        'RFP responses',
        'Requirements traceability matrices',
        'User stories & use cases',
        'Test cases (manual & automated)',
        'Turnover / closeout documentation',
        'User guides & training materials',
        'Knowledge base articles',
      ],
    },
    {
      category: 'Change management',
      items: [
        'ERP replacement programs',
        'M&A restructuring assessments',
        'Information-silo removal / knowledge sharing',
        'DEI assessments and recommendations',
      ],
    },
    {
      category: 'Stakeholder engagement',
      items: [
        'Needs elicitation & requirements gathering',
        'Gap analysis',
        'Testing initiative guidance',
        'Onsite/remote sales demonstrations and training workshops',
      ],
    },
    {
      category: 'Strategic advisory',
      items: [
        'New product/feature design brainstorming, mock-ups, proof of concepts',
        'Advocating for diverse perspectives / voice of customer',
        'Resource planning & forecasting',
        'SDLC process improvement (release velocity, quality)',
        'Peer reviews & interviewing for fit',
        'Training & onboarding process delivery',
        'Communications planning',
      ],
    },
  ],
};

export const verticals = [
  { label: 'Government (B2G)', detail: 'Cities, counties, municipalities — Baltimore, Maui, Long Beach, San Diego County, Cook County, US Navy contractor', source: ['Jeremy Stiffler - Variety Experiences.md'] },
  { label: 'Financial services / fintech', detail: 'Loan origination, KYC/AML/fraud, compliance-driven integrations', source: ['defi-solutions'] },
  { label: 'Payments / POS', detail: 'PCI-DSS, EMV, hosted pay pages, gateways', source: ['system-innovators'] },
  { label: 'SaaS / software vendors', detail: 'Waste & recycling, CRM, field service', source: ['desertmicro', 'navusoft'] },
  { label: 'Transportation & logistics', detail: 'Mobile field-service apps, GPS/RFID/barcode hardware integrations, DOT compliance', source: ['Jeremy Stiffler - Variety Experiences.md'] },
];
