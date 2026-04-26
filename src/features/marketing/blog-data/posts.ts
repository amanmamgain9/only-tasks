// app/blog/_data/posts.ts
import { adhdEmotionsArticle } from './articles/adhd-emotions';
import { morningRoutineArticle } from './articles/morning-routine';
import { productivityTipsArticle } from './articles/productivity-tips';
import { internalControlArticle } from './articles/internal-control';
import { quietConfidenceArticle } from './articles/quite-confidence';
import { method7533Article } from './articles/75-33-method';
import { sleepResetArticle } from './articles/sleep-reset';
import { traumaProductivityArticle } from './articles/trauma-productivity';
import { stopHealingArticle } from './articles/stop-healing';
import { planningMillionaireArticle } from './articles/planning-millionaire';
import { planningSecretsMillionairesArticle } from './articles/planning-secrets-millionaires';

// Type definition for blog posts
export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  author: string;
  authorRole: string;
  image: string;
  tags: string[];
  content?: string;
};

// Single source of truth for all blog posts - stored as an array for easy iteration
export const blogPosts: BlogPost[] = [
  planningSecretsMillionairesArticle, // New article at the top (most recent)
  planningMillionaireArticle,
  stopHealingArticle,
  traumaProductivityArticle,
  sleepResetArticle,
  method7533Article,
  quietConfidenceArticle,
  internalControlArticle,
  adhdEmotionsArticle,
  morningRoutineArticle,
  productivityTipsArticle,
];

// Create a Map for O(1) lookup by slug
const blogPostsMap = new Map(blogPosts.map(post => [post.slug, post]));

// Function to get all blog posts for listing
export function getBlogPosts(): BlogPost[] {
  return [...blogPosts]; // Return a copy to prevent mutation
}

// Function to get all blog slugs
export function getAllBlogSlugs(): string[] {
  return blogPosts.map(post => post.slug);
}

// Function to get a single blog post by slug with O(1) lookup
export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPostsMap.get(slug);
}