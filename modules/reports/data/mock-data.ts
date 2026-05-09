// Centralised mock data for all report pages

export const MONTHLY_REVENUE = [
  { month: "Oct", actual: 3.8, target: 4.5, deals: 9 },
  { month: "Nov", actual: 4.6, target: 4.5, deals: 11 },
  { month: "Dec", actual: 3.2, target: 5.0, deals: 8 },
  { month: "Jan", actual: 5.4, target: 5.0, deals: 13 },
  { month: "Feb", actual: 6.1, target: 5.5, deals: 15 },
  { month: "Mar", actual: 5.8, target: 6.0, deals: 14 },
  { month: "Apr", actual: 7.2, target: 6.0, deals: 18 },
  { month: "May", actual: 4.8, target: 6.5, deals: 12 },
];

export const QUARTERLY_REVENUE = [
  { quarter: "Q1 FY25", actual: 11.6, target: 14.0 },
  { quarter: "Q2 FY25", actual: 17.1, target: 17.5 },
  { quarter: "Q3 FY25", actual: 19.8, target: 18.0 },
  { quarter: "Q4 FY25", actual: 12.0, target: 13.0 },
];

export const PIPELINE_FUNNEL = [
  { stage: "New Leads",     count: 284, value: 48.2, conversion: 100 },
  { stage: "Qualified",     count: 186, value: 38.4, conversion: 65.5 },
  { stage: "Proposal",      count: 112, value: 27.6, conversion: 60.2 },
  { stage: "Negotiation",   count: 64,  value: 19.8, conversion: 57.1 },
  { stage: "Closed Won",    count: 38,  value: 12.4, conversion: 59.4 },
];

export const STAGE_AVG_DAYS = [
  { stage: "New → Qualified",      days: 4.2 },
  { stage: "Qualified → Proposal", days: 8.7 },
  { stage: "Proposal → Negotiation", days: 11.3 },
  { stage: "Negotiation → Close",  days: 6.9 },
];

export const LEAD_SOURCES = [
  { source: "Google Ads",    leads: 84, converted: 18, cpl: 1333, revenue: 6.2 },
  { source: "LinkedIn",      leads: 42, converted: 12, cpl: 1143, revenue: 3.8 },
  { source: "Organic SEO",   leads: 56, converted: 14, cpl: 393,  revenue: 4.1 },
  { source: "Referral",      leads: 38, converted: 16, cpl: 0,    revenue: 5.2 },
  { source: "Instagram",     leads: 31, converted: 6,  cpl: 1742, revenue: 1.9 },
  { source: "Facebook",      leads: 19, converted: 4,  cpl: 1842, revenue: 1.2 },
  { source: "Cold Outreach", leads: 28, converted: 8,  cpl: 250,  revenue: 2.8 },
  { source: "Affiliate",     leads: 38, converted: 9,  cpl: 737,  revenue: 3.2 },
];

export const REP_REVENUE = [
  { name: "Alex Kumar",   actual: 8.4, target: 10.0 },
  { name: "Meera Joshi",  actual: 7.8, target: 9.0 },
  { name: "Priya Singh",  actual: 6.2, target: 8.0 },
  { name: "Arjun Sharma", actual: 5.8, target: 8.0 },
  { name: "Sam Tiwari",   actual: 4.8, target: 7.0 },
  { name: "Rahul Nair",   actual: 4.1, target: 6.0 },
  { name: "Sanjay Patel", actual: 3.6, target: 6.0 },
  { name: "Divya Menon",  actual: 2.9, target: 5.0 },
];

export const ACTIVITY_BY_REP = [
  { name: "Alex Kumar",   calls: 142, emails: 310, meetings: 28, demos: 18 },
  { name: "Priya Singh",  calls: 128, emails: 245, meetings: 22, demos: 14 },
  { name: "Meera Joshi",  calls: 135, emails: 290, meetings: 25, demos: 16 },
  { name: "Arjun Sharma", calls: 118, emails: 224, meetings: 20, demos: 12 },
  { name: "Sam Tiwari",   calls: 104, emails: 198, meetings: 17, demos: 10 },
  { name: "Rahul Nair",   calls: 98,  emails: 188, meetings: 15, demos: 9 },
  { name: "Sanjay Patel", calls: 89,  emails: 167, meetings: 12, demos: 7 },
  { name: "Divya Menon",  calls: 76,  emails: 142, meetings: 10, demos: 6 },
];

// Activity heatmap: day x hour (Mon-Fri, 8am-6pm)
export const ACTIVITY_HEATMAP = (() => {
  const days = ["Mon","Tue","Wed","Thu","Fri"];
  const hours = Array.from({ length: 11 }, (_, i) => `${i + 8}:00`);
  const seed = [
    [2,3,5,8,7,9,12,8,6,4,2],
    [3,5,8,11,14,12,9,7,5,3,1],
    [1,4,6,9,13,11,8,6,4,2,1],
    [2,3,7,10,12,15,11,8,5,3,2],
    [1,2,4,7,9,8,6,4,3,2,1],
  ];
  return days.map((day, di) => ({ day, ...Object.fromEntries(hours.map((h, hi) => [h, seed[di][hi]])) }));
})();

export const CAMPAIGN_ROI = [
  { name: "Google Ads",    budget: 1.5, spent: 1.12, leads: 84, revenue: 6.2, roi: 453 },
  { name: "LinkedIn",      budget: 0.8, spent: 0.48, leads: 42, revenue: 3.8, roi: 692 },
  { name: "SEO Blogs",     budget: 0.3, spent: 0.22, leads: 56, revenue: 4.1, roi: 1764 },
  { name: "Instagram",     budget: 0.6, spent: 0.54, leads: 31, revenue: 1.9, roi: 252 },
  { name: "Facebook",      budget: 0.7, spent: 0.35, leads: 19, revenue: 1.2, roi: 243 },
  { name: "PR Articles",   budget: 0.45,spent: 0.45, leads: 28, revenue: 2.8, roi: 522 },
  { name: "Outdoor Ads",   budget: 1.2, spent: 1.2,  leads: 15, revenue: 1.6, roi: 33 },
  { name: "Affiliate",     budget: 0.5, spent: 0.28, leads: 38, revenue: 3.2, roi: 1043 },
];

export const TERRITORY_REVENUE = [
  { city: "Hyderabad", revenue: 19.7, pipeline: 8.3, deals: 38, win_rate: 42 },
  { city: "Mumbai",    revenue: 14.3, pipeline: 6.7, deals: 29, win_rate: 39 },
  { city: "Bangalore", revenue: 12.8, pipeline: 5.9, deals: 25, win_rate: 44 },
  { city: "Delhi NCR", revenue: 10.4, pipeline: 7.2, deals: 22, win_rate: 36 },
  { city: "Gurugram",  revenue: 7.6,  pipeline: 4.1, deals: 16, win_rate: 38 },
  { city: "Chennai",   revenue: 6.2,  pipeline: 3.8, deals: 12, win_rate: 35 },
  { city: "Pune",      revenue: 4.9,  pipeline: 2.6, deals: 9,  win_rate: 31 },
];

export const LOSS_REASONS = [
  { reason: "Price too high",        count: 28, pct: 34 },
  { reason: "Chose competitor",      count: 22, pct: 27 },
  { reason: "No budget",             count: 14, pct: 17 },
  { reason: "No decision made",      count: 9,  pct: 11 },
  { reason: "Missing feature",       count: 6,  pct: 7 },
  { reason: "Poor timing",           count: 3,  pct: 4 },
];

export const COMPETITORS = [
  { name: "Salesforce",  mentions: 18, win_vs: 6,  loss_vs: 12 },
  { name: "HubSpot",     mentions: 14, win_vs: 8,  loss_vs: 6 },
  { name: "Zoho CRM",    mentions: 9,  win_vs: 7,  loss_vs: 2 },
  { name: "Pipedrive",   mentions: 6,  win_vs: 5,  loss_vs: 1 },
  { name: "Freshsales",  mentions: 4,  win_vs: 3,  loss_vs: 1 },
];

export const WON_VS_LOST = [
  { month: "Oct", won: 9,  lost: 8  },
  { month: "Nov", won: 11, lost: 7  },
  { month: "Dec", won: 8,  lost: 10 },
  { month: "Jan", won: 13, lost: 6  },
  { month: "Feb", won: 15, lost: 8  },
  { month: "Mar", won: 14, lost: 9  },
  { month: "Apr", won: 18, lost: 7  },
  { month: "May", won: 12, lost: 5  },
];
