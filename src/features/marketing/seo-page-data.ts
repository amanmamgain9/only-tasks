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
    slug: "smart-pomodoro-timer",
    name: "Smart Pomodoro Timer",
    title: "Smart Pomodoro Timer: Focus Sessions Without Leaving Your Task System",
    description:
      "Plan focused sessions from the same workspace where tasks, date views, and keyboard navigation already live.",
    image: "/media/plan-my-workday/pmwd-screenshots/full_keyboard_mobile.png",
    benefits: [
      "Keep timing beside the task system you are already using",
      "Reduce context switching between timer and task manager",
      "Use shorter or longer work blocks based on the type of work",
      "Return to the task tree when the session ends",
    ],
    details:
      "The rebuilt Plan My Workday keeps focus timing inside the same workspace as the task tree, date views, and keyboard navigation. The timer is part of the app people can use today, without claiming a separate automation layer.",
    howItWorks: [
      {
        title: "Open the workspace",
        description: "Start from the same place you manage projects, nested tasks, and date-focused views.",
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
      "Use Plan My Workday to create flexible, structured task plans that can adapt when focus or priorities shift.",
    image: "/media/plan-my-workday/og-image.png",
    challenges: [
      "Large tasks become hard to start without visible smaller steps",
      "Rigid task systems break when the day changes",
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
        "It gives me enough structure to start without forcing my whole day into a brittle plan.",
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
      "Plan My Workday is narrower by design: projects, nested tasks, date views, and keyboard-first navigation for getting through the workday.",
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
