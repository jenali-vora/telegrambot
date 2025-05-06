// src/app/shared/models/blog-post.model.ts
export interface BlogPost {
    id: number;
    slug: string;
    title: string;
    author: string;
    publishDate: string; // Or Date
    featuredImageUrl: string;
    excerpt: string;
    contentHtml: string;
    // Add other fields if needed (e.g., content for detail view)
}