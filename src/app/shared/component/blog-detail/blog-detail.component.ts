// src/app/component/blog-detail/blog-detail.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router'; // Import RouterModule
import { BlogService } from '../../services/blog.service'; // Adjust path
import { BlogPost } from '../../models/blog-post.model'; // Adjust path
import { Observable, switchMap, tap } from 'rxjs';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  // Use OnPush for better performance when inputs/observables change
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, // Needed for *ngIf, *ngFor, async pipe, date pipe
    RouterModule  // Needed for routerLink in related posts
  ],
  templateUrl: './blog-detail.component.html',
  styleUrls: ['./blog-detail.component.css']
})
export class BlogDetailComponent implements OnInit {
  post$: Observable<BlogPost | undefined> | undefined;
  relatedPosts$: Observable<BlogPost[]> | undefined;

  // Number of related posts to show
  private relatedPostsCount = 2;

  constructor(
    private route: ActivatedRoute,
    private blogService: BlogService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.post$ = this.route.paramMap.pipe(
      switchMap(params => {
        const slug = params.get('slug');
        if (!slug) {
          console.error('Blog slug not found in route parameters.');
          this.router.navigate(['/blog']); // Or to a 404 page
          return new Observable<BlogPost | undefined>(); // Return empty to prevent errors
        }

        // Fetch related posts when slug changes
        this.relatedPosts$ = this.blogService.getRelatedPosts(slug, this.relatedPostsCount);

        // Fetch the main post
        return this.blogService.getPostBySlug(slug);
      }),
      tap(post => {
        if (!post) {
          console.error('Blog post not found for the given slug.');
          this.router.navigate(['/blog']); // Or to a 404 page
        }
        // Optional: Scroll to top when post loads
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
    );
  }
}