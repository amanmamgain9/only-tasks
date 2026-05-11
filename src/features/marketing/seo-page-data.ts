export type MarketingFeature = {
  slug: string;
  name: string;
  title: string;
  description: string;
  image: string;
  benefits: string[];
  details: string;
  howItWorks: Array<{
    title: string;
    description: string;
  }>;
  testimonial: {
    quote: string;
    author: string;
    role: string;
  };
};

export type MarketingUseCase = {
  slug: string;
  name: string;
  title: string;
  description: string;
  image: string;
  challenges: string[];
  benefits: string[];
  features: Array<{
    title: string;
    description: string;
  }>;
  testimonial: {
    quote: string;
    author: string;
    role: string;
  };
  faqQuestions: Array<{
    question: string;
    answer: string;
  }>;
};

export type MarketingAlternative = {
  slug: string;
  name: string;
  title: string;
  description: string;
  category: string;
  userProblem: string;
  alternativeSolution: string;
  planMyWorkdaySolution: string;
  features: Array<{
    feature: string;
    alternative: string;
    planMyWorkday: string;
  }>;
  pricing: {
    alternative: string;
    planMyWorkday: string;
  };
};

export const marketingFeatures: MarketingFeature[] = [
  {
    slug: "energy-flow-optimization",
    name: "Energy Flow Optimization",
    title: "Energy Flow Optimization: Schedule Tasks Based on Your Natural Energy Patterns",
    description:
      "Plan My Workday helps you place demanding work during stronger focus windows and keep lighter tasks for lower-energy parts of the day.",
    image: "/media/plan-my-workday/pmwd-screenshots/full_keyboard_desktop.png",
    benefits: [
      "Match high-focus tasks with better energy windows",
      "Reduce burnout by planning breaks and lighter work intentionally",
      "Build a workday around your real attention patterns instead of a rigid template",
      "Keep task planning fast with keyboard-first navigation",
    ],
    details:
      "Energy Flow Optimization is the scheduling idea behind Plan My Workday: your day should account for focus, transition cost, and recovery. The rebuilt app keeps this grounded in a fast task tree, due-date views, and a workspace that makes reshaping the day cheap.",
    howItWorks: [
      {
        title: "Capture the work",
        description: "Add nested tasks quickly without leaving the keyboard-first workspace.",
      },
      {
        title: "Schedule around focus",
        description: "Use today, tomorrow, and this-week views to place work where it realistically belongs.",
      },
      {
        title: "Adjust without friction",
        description: "Move through projects, task roots, and date views without rebuilding the plan from scratch.",
      },
    ],
    testimonial: {
      quote:
        "The task tree lets me keep the messy structure of a real workday, then narrow focus when I need to execute.",
      author: "Plan My Workday user",
      role: "Independent operator",
    },
  },
  {
    slug: "smart-pomodoro-timer",
    name: "Smart Pomodoro Timer",
    title: "Smart Pomodoro Timer: Focus Sessions Without Leaving Your Task System",
    description:
      "Plan focused sessions from the same workspace where tasks, schedules, and keyboard navigation already live.",
    image: "/media/plan-my-workday/pmwd-screenshots/full_keyboard_mobile.png",
    benefits: [
      "Keep timing connected to the task you are actually doing",
      "Reduce context switching between timer and task manager",
      "Use shorter or longer work blocks based on the type of work",
      "Return to the task tree when the session ends",
    ],
    details:
      "The old Plan My Workday positioning included focus timing as part of the workday flow. In the focused migration, timer messaging stays part of the public feature set while the core app keeps the task tree and scheduling foundation stable.",
    howItWorks: [
      {
        title: "Choose the task",
        description: "Start from a task or project context rather than a separate timer-only workflow.",
      },
      {
        title: "Work in a clear block",
        description: "Use the planned block to reduce decision fatigue and keep attention on one unit of work.",
      },
      {
        title: "Return to the plan",
        description: "After the session, continue from the same workspace instead of switching tools.",
      },
    ],
    testimonial: {
      quote: "The value is not just the timer. It is having focus work tied to the plan I already trust.",
      author: "Plan My Workday user",
      role: "Software builder",
    },
  },
];

export const marketingUseCases: MarketingUseCase[] = [
  {
    slug: "adhd",
    name: "ADHD Warriors",
    title: "Plan My Workday for ADHD: Productivity That Works With Your Brain",
    description:
      "Use Plan My Workday to create flexible, structured task plans that can adapt when focus, energy, or priorities shift.",
    image: "/media/plan-my-workday/og-image.png",
    challenges: [
      "Large tasks become hard to start without visible smaller steps",
      "Rigid calendars break when the day changes",
      "Switching between tools adds friction and delay",
      "Priorities are easier to lose when everything looks equally urgent",
    ],
    benefits: [
      "Nested task trees make big work easier to decompose",
      "Today, tomorrow, and this-week views keep planning concrete",
      "Keyboard navigation reduces click friction",
      "Project and task root views help narrow attention",
    ],
    features: [
      {
        title: "Nested task breakdown",
        description: "Turn fuzzy work into parent tasks, subtasks, and focused task roots.",
      },
      {
        title: "Date-based planning",
        description: "Move between all tasks, today, tomorrow, and this week without losing context.",
      },
      {
        title: "Keyboard-first workspace",
        description: "Navigate the task system with less mouse movement and fewer context breaks.",
      },
    ],
    testimonial: {
      quote:
        "It gives me enough structure to start without forcing my whole day into a brittle schedule.",
      author: "Plan My Workday user",
      role: "Designer with ADHD",
    },
    faqQuestions: [
      {
        question: "How is Plan My Workday different from a normal task manager for ADHD?",
        answer:
          "Plan My Workday focuses on fast task capture, nested breakdown, date views, and keyboard-first movement so reshaping the plan takes less effort.",
      },
      {
        question: "Can I use it when my day changes?",
        answer:
          "Yes. The workspace is built around fast re-planning: switch views, open a project, make a task the root, and keep working from there.",
      },
    ],
  },
];

export const marketingAlternatives: MarketingAlternative[] = [
  {
    slug: "notion",
    name: "Notion",
    title: "Plan My Workday vs Notion",
    description: "See how Plan My Workday compares to Notion for daily task planning and focused execution.",
    category: "All-in-one Workspace",
    userProblem:
      "You want a daily plan that is fast to capture, easy to reshape, and focused on execution instead of database setup.",
    alternativeSolution:
      "Notion gives you a broad workspace where you can build documents, databases, task boards, and templates. It is flexible, but the planning system is something you usually have to design and maintain yourself.",
    planMyWorkdaySolution:
      "Plan My Workday is narrower by design: projects, nested tasks, scheduling views, and keyboard-first navigation for getting through the workday.",
    features: [
      {
        feature: "Core focus",
        alternative: "All-in-one docs, databases, wikis, and tasks",
        planMyWorkday: "Daily task planning and focused execution",
      },
      {
        feature: "Setup time",
        alternative: "Powerful, but usually requires template or database setup",
        planMyWorkday: "Ready around projects, task trees, and date views",
      },
      {
        feature: "Task breakdown",
        alternative: "Possible through databases and nested pages",
        planMyWorkday: "Native nested task tree",
      },
      {
        feature: "Navigation",
        alternative: "Flexible workspace navigation",
        planMyWorkday: "Keyboard-first workspace navigation",
      },
    ],
    pricing: {
      alternative: "$8-$15/month depending on plan",
      planMyWorkday: "Focused SaaS pricing",
    },
  },
];

export function getMarketingFeature(slug: string) {
  return marketingFeatures.find((feature) => feature.slug === slug);
}

export function getMarketingUseCase(slug: string) {
  return marketingUseCases.find((useCase) => useCase.slug === slug);
}

export function getMarketingAlternative(slug: string) {
  return marketingAlternatives.find((alternative) => alternative.slug === slug);
}
