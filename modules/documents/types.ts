export type BlockType =
  | "paragraph" | "h1" | "h2" | "h3"
  | "bullet" | "numbered" | "todo"
  | "code" | "quote" | "callout"
  | "divider" | "image" | "table";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  language?: string;
  emoji?: string;
  imageUrl?: string;
  imageAlt?: string;
}

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
  owner_id: string | null;
  workspace_id: string | null;
  is_template: boolean;
  template_type: string | null;
  created_at: string;
  updated_at: string;
  icon?: string;
}

export const DOCUMENT_TEMPLATES: Omit<Document, "id" | "owner_id" | "workspace_id" | "created_at" | "updated_at">[] = [
  {
    title: "Meeting Notes",
    icon: "FileText",
    is_template: true,
    template_type: "meeting_notes",
    blocks: [
      { id: "1", type: "h1", content: "Meeting Notes" },
      { id: "2", type: "paragraph", content: "Date: " },
      { id: "3", type: "paragraph", content: "Attendees: " },
      { id: "4", type: "h2", content: "Agenda" },
      { id: "5", type: "bullet", content: "" },
      { id: "6", type: "h2", content: "Discussion" },
      { id: "7", type: "paragraph", content: "" },
      { id: "8", type: "h2", content: "Action Items" },
      { id: "9", type: "todo", content: "", checked: false },
    ],
  },
  {
    title: "Deal Brief",
    icon: "Handshake",
    is_template: true,
    template_type: "deal_brief",
    blocks: [
      { id: "1", type: "h1", content: "Deal Brief" },
      { id: "2", type: "callout", content: "Summary of the opportunity" },
      { id: "3", type: "h2", content: "Company Overview" },
      { id: "4", type: "paragraph", content: "" },
      { id: "5", type: "h2", content: "Key Stakeholders" },
      { id: "6", type: "bullet", content: "" },
      { id: "7", type: "h2", content: "Requirements" },
      { id: "8", type: "bullet", content: "" },
      { id: "9", type: "h2", content: "Next Steps" },
      { id: "10", type: "todo", content: "", checked: false },
    ],
  },
  {
    title: "Proposal",
    icon: "File",
    is_template: true,
    template_type: "proposal",
    blocks: [
      { id: "1", type: "h1", content: "Proposal" },
      { id: "2", type: "paragraph", content: "Prepared for: " },
      { id: "3", type: "divider", content: "" },
      { id: "4", type: "h2", content: "Executive Summary" },
      { id: "5", type: "paragraph", content: "" },
      { id: "6", type: "h2", content: "Scope of Work" },
      { id: "7", type: "bullet", content: "" },
      { id: "8", type: "h2", content: "Pricing" },
      { id: "9", type: "paragraph", content: "" },
      { id: "10", type: "h2", content: "Timeline" },
      { id: "11", type: "paragraph", content: "" },
    ],
  },
  {
    title: "Onboarding Checklist",
    icon: "ListChecks",
    is_template: true,
    template_type: "onboarding",
    blocks: [
      { id: "1", type: "h1", content: "Onboarding Checklist" },
      { id: "2", type: "callout", content: "Complete all tasks before the onboarding call" },
      { id: "3", type: "h2", content: "Before Day 1" },
      { id: "4", type: "todo", content: "Send welcome email", checked: false },
      { id: "5", type: "todo", content: "Set up accounts", checked: false },
      { id: "6", type: "h2", content: "Week 1" },
      { id: "7", type: "todo", content: "Intro call with account manager", checked: false },
      { id: "8", type: "todo", content: "Product demo", checked: false },
      { id: "9", type: "todo", content: "Data migration", checked: false },
    ],
  },
];
