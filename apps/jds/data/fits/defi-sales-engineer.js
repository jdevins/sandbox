// First fit: maps the corpus (../profile.js, ../ai-practice.js) against a real
// job description. strength is an honest signal, not a sales number:
//   direct  — the corpus shows this exact thing, done
//   strong  — clearly evidenced, different wording/context
//   partial — some evidence, but inferred or incomplete
//   gap     — no real evidence; naming it beats papering over it
//
// Critical context this fit turns on: the employer is defi Solutions — Jeremy's
// current employer (see profile.js roles.defi-solutions). This is an internal
// move, not an outside pitch. That's why several items score higher than an
// external candidate's ever could: "comprehensive understanding of defi's
// solutions" isn't aspirational here, it's the current job.

export const fit = {
  id: 'defi-sales-engineer-2026',
  roleTitle: 'Sales Engineer',
  employer: 'defi Solutions',
  isInternal: true,
  internalNote:
    'Same company as the current Lead Integration Engineer role. Reframes the entire pitch from "trust my resume" to "you can verify this in-house" — and means product/domain knowledge outstrips what any external candidate could bring.',

  sections: [
    {
      section: 'Essential responsibilities',
      items: [
        {
          requirement: "Demo defi's lending solution to prospects — workflow-based, live",
          strength: 'direct',
          evidence: ['role:defi-solutions', 'role:desertmicro'],
          note: 'Already SME on the actual product being demoed, not just demo technique.',
        },
        {
          requirement: 'Configure / customize demo environments',
          strength: 'strong',
          evidence: ['role:desertmicro', 'engagementBreadth:Stakeholder engagement', 'capability:systems-fluency'],
          note: 'SME for trade-show and onsite/remote demos for 4+ years (DesertMicro) — conducting demos at that scope for that long entails staging, setup, and planning, not just presenting. Not a literal "configured demo environments" quote, but a well-grounded inference from owning the demo role itself.',
        },
        {
          requirement: 'Maintain demo data integrity, build historical trends/reporting',
          strength: 'partial',
          evidence: ['engagementBreadth:Data warehousing & BI'],
          note: 'Real BI/reporting skill, but not demo-environment-specific.',
        },
        {
          requirement: 'Create architectures, demo solutions, solve problems live with lenders',
          strength: 'direct',
          evidence: ['role:defi-solutions', 'thesis:judgment-layer'],
        },
        {
          requirement: 'Articulate value proposition to attract/engage/retain prospects',
          strength: 'gap',
          evidence: [],
          note: 'All value-prop work to date is internal/BA-facing, not an external sales pitch. The one responsibility with no direct precedent — name it, don’t paper over it.',
        },
        {
          requirement: 'Collaborate cross-functionally with sales, client services, product, dev',
          strength: 'direct',
          evidence: ['role:defi-solutions'],
          note: 'defi role is literally described as "technical liaison...to executive leadership, vendor partners, and sales teams" — the JD’s own language, already true today.',
        },
        {
          requirement: 'Support Sales Enablement training initiatives',
          strength: 'strong',
          evidence: ['role:brinks', 'role:desertmicro', 'role:system-innovators'],
        },
        {
          requirement: 'Participate in industry trade shows',
          strength: 'direct',
          evidence: ['role:desertmicro'],
        },
        {
          requirement: "Serve as SME proposing/presenting defi's Solutions",
          strength: 'direct',
          evidence: ['role:defi-solutions'],
        },
        {
          requirement: 'Conversant in both business and technical aspects',
          strength: 'direct',
          evidence: ['thesis:judgment-layer', 'capability:systems-fluency', 'capability:field-presence', 'capability:delivery-judgment'],
          note: 'This is the whole positioning, not one bullet among many.',
        },
        {
          requirement: "Comprehensive understanding of defi's solutions",
          strength: 'direct',
          evidence: ['role:defi-solutions'],
          note: 'Uniquely strong — the incumbent integration engineer, not an outsider studying up.',
        },
        {
          requirement: 'Partner with Product Management on trends/roadmap',
          strength: 'strong',
          evidence: ['role:defi-solutions', 'role:system-innovators'],
        },
        {
          requirement: 'Document business-level requirements for enhancement requests',
          strength: 'direct',
          evidence: ['engagementBreadth:Documentation authored'],
        },
        {
          requirement: 'Respond to inbound RFP/RFI inquiries',
          strength: 'direct',
          evidence: ['role:desertmicro', 'engagementBreadth:Documentation authored'],
          note: 'Corroborated by two independent source documents, not one bullet inflated to look bigger.',
        },
        {
          requirement: 'Develop client-specific solutions with sales personnel',
          strength: 'strong',
          evidence: ['role:defi-solutions', 'role:system-innovators'],
        },
        {
          requirement: 'Success measured by deals won',
          strength: 'gap',
          evidence: ['win:si-bookings'],
          note: 'No quota-carrying or deal-attributed role on record. Closest proxy is $1.5–2.5M in annual bookings led as PM — delivery leadership, not sales origination. Don’t conflate the two.',
        },
      ],
    },
    {
      section: 'Required qualifications',
      items: [
        {
          requirement: "Minimum 2 years' industry experience",
          strength: 'direct',
          evidence: ['role:defi-solutions'],
          note: '10+ years total, ~4 already at defi specifically. Requirement exceeded, not just met.',
        },
        {
          requirement: "Bachelor's degree or equivalent experience",
          strength: 'direct',
          evidence: ['education'],
          note: 'B.S. Technical Project Management (Honors) + A.S. Computer/Electronic Engineering (Valedictorian).',
        },
      ],
    },
    {
      section: 'Preferred qualifications',
      items: [
        { requirement: 'MS Office Suite', strength: 'gap', evidence: [], note: 'Unstated in any source doc — assumed baseline, not worth defending or claiming.' },
        {
          requirement: 'SQL scripting',
          strength: 'strong',
          evidence: ['role:system-innovators'],
          note: '"Direct SQL" data communications analysis; SSRS/SQL Server in earlier resumes.',
        },
        {
          requirement: 'JavaScript or similar scripting exposure',
          strength: 'partial',
          evidence: [],
          note: 'Only "PHP/JS coding basics" from the 2018 resume — thin and dated. Don’t oversell this one.',
        },
        {
          requirement: 'Foundational cloud knowledge',
          strength: 'direct',
          evidence: ['role:defi-solutions', 'role:system-innovators', 'certification:aws-ccp', 'certification:azure-ai-900'],
          note: 'AWS + Azure hands-on across almost every role. Certs exist but are unverified-expiry — verify before citing as current.',
        },
        {
          requirement: 'SOAP/REST APIs with XML/JSON',
          strength: 'direct',
          evidence: ['capability:systems-fluency', 'role:defi-solutions', 'role:system-innovators'],
        },
        {
          requirement: 'SaaS experience',
          strength: 'direct',
          evidence: ['role:desertmicro', 'role:navusoft'],
        },
      ],
    },
    {
      section: 'Additional eligibility',
      items: [
        {
          requirement: 'Communication with executives and stakeholders across market segments',
          strength: 'direct',
          evidence: ['win:kent-inovah-launch', 'role:defi-solutions'],
        },
        {
          requirement: 'Comfortable in a high-growth, fast-paced sales environment',
          strength: 'partial',
          evidence: ['role:navusoft', 'role:system-innovators'],
          note: 'Fast-paced delivery, yes — concurrent enterprise projects, a startup build from zero. Fast-paced sales-cycle specifically is a different rhythm and is unproven.',
        },
        {
          requirement: 'Grasp new technology concepts quickly, think creatively',
          strength: 'strong',
          evidence: ['identity:voice'],
        },
        {
          requirement: 'Understanding of middleware and integration technology',
          strength: 'direct',
          evidence: ['role:defi-solutions', 'role:system-innovators', 'capability:systems-fluency'],
          note: 'The single strongest qualification on the list — it’s the job title.',
        },
        {
          requirement: 'Passionate about people and technology',
          strength: 'strong',
          evidence: ['identity:voice', 'identity:personalNote'],
        },
        {
          requirement: 'Demonstrated consultative skills',
          strength: 'strong',
          evidence: ['engagementBreadth:Strategic advisory'],
        },
        {
          requirement: 'Foundational ability to tell a compelling story',
          strength: 'strong',
          evidence: ['identity:voice', 'win:kent-inovah-launch'],
          note: 'This project is itself an instance of the claim.',
        },
        {
          requirement: 'Collaborative',
          strength: 'direct',
          evidence: ['role:defi-solutions'],
        },
      ],
    },
  ],
};

// Tally for a scannable scorecard — computed, not hand-maintained, so it can
// never drift from the items above.
export function fitTally(f = fit) {
  const counts = { direct: 0, strong: 0, partial: 0, gap: 0 };
  for (const s of f.sections) for (const i of s.items) counts[i.strength]++;
  return counts;
}
