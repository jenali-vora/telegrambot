// src/app/shared/services/tawk-to-chat.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

declare var Tawk_API: any;

@Injectable({
    providedIn: 'root'
})
export class TawkToChatService {
    private renderer: Renderer2;
    private scriptLoaded = false;

    // Your actual IDs are correctly set here
    private readonly PROPERTY_ID = '6842c9cf861db019088d7a47';
    private readonly WIDGET_ID = '1it2e8kt7';

    private readonly TAWK_SRC = `https://embed.tawk.to/${this.PROPERTY_ID}/${this.WIDGET_ID}`;

    constructor(rendererFactory: RendererFactory2) {
        this.renderer = rendererFactory.createRenderer(null, null);
    }

    public loadScript(): void {
        console.log('TawkToChatService: loadScript() called.');
        if (this.scriptLoaded) {
            console.log('Tawk.to script already loaded or initialization in progress.');
            return;
        }

        // CORRECTED AND SIMPLIFIED CHECK:
        // Simply ensure the IDs (which are readonly and initialized) are not effectively empty.
        // Given they are readonly and initialized with non-empty strings, this check
        // is more of a safeguard for future changes or if they were loaded dynamically.
        // For current setup, this check will always pass.
        if (!this.PROPERTY_ID || !this.WIDGET_ID) {
            console.error('Tawk.to Property ID or Widget ID is missing. This should not happen with readonly initialized values.');
            return;
        }

        this.scriptLoaded = true;

        const tawkApiScript = this.renderer.createElement('script');
        this.renderer.setProperty(tawkApiScript, 'type', 'text/javascript');
        this.renderer.setProperty(tawkApiScript, 'innerHTML', `
          var Tawk_API = Tawk_API || {};
          var Tawk_LoadStart = new Date();
          (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='${this.TAWK_SRC}';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
          })();
        `);

        this.renderer.appendChild(document.body, tawkApiScript);
        console.log('Tawk.to script injection initiated with URL:', this.TAWK_SRC);
    }

    // ... (rest of your service methods: setVisitor, waitForTawkApi, etc.)
    // Make sure they are also using Tawk_API correctly as in previous examples.
    public setVisitor(name: string, email: string): void {
        this.waitForTawkApi(() => {
            if (Tawk_API && typeof Tawk_API.setAttributes === 'function') {
                Tawk_API.setAttributes({ name, email }, (error: any) => {
                    if (error) { console.error('Tawk_API.setAttributes error:', error); }
                    else { console.log('Tawk_API: Visitor attributes set.'); }
                });
            } else {
                console.warn('Tawk_API.setAttributes function not available.');
            }
        });
    }

    public showWidget(): void {
        this.waitForTawkApi(() => {
            if (Tawk_API && typeof Tawk_API.showWidget === 'function') {
                Tawk_API.showWidget();
                console.log('Tawk_API: showWidget called.');
            } else {
                 console.warn('Tawk_API.showWidget function not available.');
            }
        });
    }

     public hideWidget(): void {
        this.waitForTawkApi(() => {
            if (Tawk_API && typeof Tawk_API.hideWidget === 'function') {
                Tawk_API.hideWidget();
                 console.log('Tawk_API: hideWidget called.');
            } else {
                console.warn('Tawk_API.hideWidget function not available.');
            }
        });
    }

    public maximize(): void {
        this.waitForTawkApi(() => {
            if (Tawk_API && typeof Tawk_API.maximize === 'function') {
                Tawk_API.maximize();
                console.log('Tawk_API: maximize called.');
            } else {
                 console.warn('Tawk_API.maximize function not available.');
            }
        });
    }

    public minimize(): void {
        this.waitForTawkApi(() => {
            if (Tawk_API && typeof Tawk_API.minimize === 'function') {
                Tawk_API.minimize();
                console.log('Tawk_API: minimize called.');
            } else {
                console.warn('Tawk_API.minimize function not available.');
            }
        });
    }


    private waitForTawkApi(callback: () => void, retries = 20, delay = 500): void {
        if (typeof Tawk_API !== 'undefined' && typeof Tawk_API.getStatus === 'function') {
            // Check if the API object itself and a key method (like getStatus) exist
            // console.log('Tawk_API found, checking status...'); // Can be verbose
            // Tawk_API.onStatusChange might be more robust if just checking status isn't enough
            if (Tawk_API.getStatus() !== 'offline' || Tawk_API.isChatMaximized && Tawk_API.isChatMaximized()) { // Ensure isChatMaximized is also checked if it exists
                // console.log('Tawk_API ready, executing callback.'); // Can be verbose
                callback();
            } else if (retries > 0) {
                //  console.log(`Tawk_API not ready (status: ${Tawk_API.getStatus()}), retrying... (${retries} left)`); // Can be verbose
                setTimeout(() => this.waitForTawkApi(callback, retries - 1, delay), delay);
            } else {
                console.warn('Tawk_API did not become ready (status remained offline or other) after multiple retries.');
            }
        } else if (retries > 0) {
            // console.log(`Tawk_API not defined, retrying... (${retries} left)`); // Can be verbose
            setTimeout(() => this.waitForTawkApi(callback, retries - 1, delay), delay);
        } else {
            console.warn('Tawk_API did not become available (was undefined) after multiple retries.');
        }
    }
}