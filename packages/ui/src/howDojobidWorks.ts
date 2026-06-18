export type HowDojobidWorksStep = {
  title: string;
  body: string;
};

export type HowDojobidWorksSection = {
  heading: string;
  steps: HowDojobidWorksStep[];
};

export const HOW_DOJOBID_WORKS = {
  title: 'How DOJOBID works',
  intro:
    'Homeowners post jobs. Contractors bid. When a bid is accepted, the job is awarded and work can begin.',
  homeowner: {
    heading: 'For homeowners',
    steps: [
      {
        title: 'Post a job',
        body: 'Describe the work, set a budget range, and mark the general area on the map. Your exact address stays private until you hire someone.',
      },
      {
        title: 'Receive bids',
        body: 'Contractors near you submit offers with a price and a short message.',
      },
      {
        title: 'Compare and message',
        body: 'Review bids on your job page. Message contractors to ask questions before you decide.',
      },
      {
        title: 'Accept a bid',
        body: 'Choose one contractor. The job is awarded, your full address is shared with them, and other bids are closed.',
      },
      {
        title: 'Complete and review',
        body: 'When the work is finished, leave a review to help other homeowners.',
      },
    ],
  },
  contractor: {
    heading: 'For contractors',
    steps: [
      {
        title: 'Find jobs',
        body: 'Search open jobs in your area by trade type and distance from your location or profile address.',
      },
      {
        title: 'Place a bid',
        body: 'Submit your price and a short pitch on the job detail page.',
      },
      {
        title: 'Get notified',
        body: 'If a homeowner accepts your bid, you will see it in Activity and can message them right away.',
      },
      {
        title: 'Do the work',
        body: 'The exact job address unlocks once your bid is accepted.',
      },
      {
        title: 'Build your reputation',
        body: 'Earn reviews from homeowners after completed jobs.',
      },
    ],
  },
  messaging: {
    title: 'Messaging',
    body: 'After a bid is accepted, both parties can chat on the job page with text and photos until the work is done.',
  },
} as const satisfies {
  title: string;
  intro: string;
  homeowner: HowDojobidWorksSection;
  contractor: HowDojobidWorksSection;
  messaging: HowDojobidWorksStep;
};
