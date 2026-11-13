/** Example prompts shown on the landing page + new-project dialogs. */

export interface ExamplePrompt {
  emoji?: never;
  icon: "todo" | "portfolio" | "crm" | "game" | "store" | "blog";
  title: string;
  prompt: string;
}

export const EXAMPLE_PROMPTS: { title: string; prompt: string; icon: string }[] = [
  {
    icon: "todo",
    title: "Task board",
    prompt:
      "A gorgeous kanban task board with draggable cards across To do / Doing / Done columns, colored labels, due dates, quick add, search and localStorage persistence. Dark elegant design.",
  },
  {
    icon: "portfolio",
    title: "Portfolio site",
    prompt:
      "A stunning personal portfolio for a product designer: animated hero with big typography, project gallery with hover effects, about section, skills marquee and a contact form. Sleek dark aesthetic.",
  },
  {
    icon: "crm",
    title: "Sales dashboard",
    prompt:
      "A CRM dashboard with revenue stat cards, an animated area chart, recent deals table with statuses, a leads pipeline board and a top-products bar chart. Premium dark SaaS look.",
  },
  {
    icon: "game",
    title: "Memory game",
    prompt:
      "A polished memory card-matching game with emoji icons, flip animations, move counter, timer, difficulty levels, best-score saving and confetti when you win.",
  },
  {
    icon: "store",
    title: "Mini store",
    prompt:
      "A minimal e-commerce storefront for premium headphones: product grid with images, product quick-view modal, cart drawer with quantity controls and totals, and a fake checkout success screen.",
  },
  {
    icon: "blog",
    title: "Notes app",
    prompt:
      "A beautiful markdown notes app with a two-pane editor and live preview, tag filters, pinned notes, full-text search, dark UI and localStorage persistence.",
  },
];
