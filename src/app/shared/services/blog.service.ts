// src/app/services/blog.service.ts (or your path)
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BlogPost } from '../models/blog-post.model'; // Adjust path

@Injectable({
    providedIn: 'root'
})
export class BlogService {
    private blogDataUrl = 'assets/data/blog-posts.json';

    constructor(private http: HttpClient) { }

    // Helper to ensure posts are sorted consistently
    private sortPosts(posts: BlogPost[]): BlogPost[] {
        return posts.sort((a, b) =>
            new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
        );
    }

    getPosts(): Observable<BlogPost[]> {
        // Always return sorted posts from this base method
        return this.http.get<BlogPost[]>(this.blogDataUrl).pipe(
            map(posts => this.sortPosts(posts))
        );
    }

    getPostBySlug(slug: string): Observable<BlogPost | undefined> {
        return this.getPosts().pipe(
            map(posts => posts.find(post => post.slug === slug))
        );
    }

    // --- REVISED METHOD ---
    /**
     * Gets a specified number of the most recent posts, excluding the current one.
     * @param currentSlug The slug of the post currently being viewed (to exclude).
     * @param count The maximum number of related posts to return.
     */
    getRelatedPosts(currentSlug: string, count: number): Observable<BlogPost[]> {
        return this.getPosts().pipe(
            map(posts => { // 'posts' is the full, sorted list (newest first)

                // 1. Filter out the current post
                const eligibleRelatedPosts = posts.filter(post => post.slug !== currentSlug);

                // 2. Take the specified number (count) from the top of the filtered list
                return eligibleRelatedPosts.slice(0, count);
            })
        );
    }
    // --- END OF REVISED METHOD ---
}