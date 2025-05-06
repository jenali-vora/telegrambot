import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule

// --- Interfaces for Data Structure ---
interface Plan {
  id: string;             // e.g., 'free', 'premium', 'team', 'enterprise'
  name: string;           // Display Name: "Free", "Premium", etc.
  buttonText: string;
  buttonStyle: 'btn-outline-primary' | 'btn-primary'; // Use your button style classes
  highlightClass?: string; // Optional class for highlighting a column
}

interface FeatureValue {
  text?: string;          // For text values like "5 GB", "Customized"
  isCheck?: boolean;      // True for checkmark, false for cross mark, undefined for text
}

interface Feature {
  id: string;             // Unique ID for the feature row
  name: string;           // Display name: "Number of users", etc.
  isHeading?: boolean;    // True if this is a section heading like "Features overview"
  // Use a Map for easy lookup by plan ID. Alternatively, an object { [planId: string]: FeatureValue }
  values: Map<string, FeatureValue>;
}

@Component({
  selector: 'app-comparison-table',
  standalone: true,          // Use standalone component approach
  imports: [CommonModule], // Import CommonModule HERE for *ngFor, *ngIf etc.
  templateUrl: './comparison-table.component.html',
  styleUrls: ['./comparison-table.component.css']
})
export class ComparisonTableComponent {

  // --- Data Definition ---

  plans: Plan[] = [
    { id: 'free', name: 'Free', buttonText: 'Send files', buttonStyle: 'btn-outline-primary' },
    { id: 'premium', name: 'Premium', buttonText: 'Register', buttonStyle: 'btn-primary' },
    { id: 'team', name: 'Team', buttonText: 'Register', buttonStyle: 'btn-primary', highlightClass: 'highlight-col' }, // Example highlight
    { id: 'enterprise', name: 'Enterprise', buttonText: 'Contact us', buttonStyle: 'btn-outline-primary' },
  ];

  features: Feature[] = [
    // --- Section Heading ---
    { id: 'overview_heading', name: 'Features overview', isHeading: true, values: new Map() },
    // --- Regular Features ---
    {
      id: 'users', name: 'Number of users', values: new Map([
        ['free', { text: '1' }],
        ['premium', { text: '1' }],
        ['team', { text: '10' }],
        ['enterprise', { text: 'Customized' }]
      ])
    },
    {
      id: 'max_size', name: 'Max. size per transfer', values: new Map([
        ['free', { text: '5 GB' }],
        ['premium', { text: '250 GB' }],
        ['team', { text: '500 GB' }],
        ['enterprise', { text: 'Customized' }]
      ])
    },
    {
      id: 'availability', name: 'File availability', values: new Map([
        ['free', { text: '7 days' }],
        ['premium', { text: 'Up to 365 days' }],
        ['team', { text: 'Up to 365 days' }],
        ['enterprise', { text: 'Customized' }]
      ])
    },
    {
      id: 'max_storage', name: 'Max. storage', values: new Map([
        ['free', { text: 'No storage' }],
        ['premium', { text: '500 GB' }],
        ['team', { text: '2000 GB shared' }],
        ['enterprise', { text: 'Customized' }]
      ])
    },
    {
      id: 'max_recipients', name: 'Max. recipients per transfer', values: new Map([
        // Assuming Free doesn't have this or it's limited (using false for cross)
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'tracking', name: 'Follow-up and tracking of downloads', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'history', name: 'Transfer manager and history', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'transfer_custom', name: 'Transfer customization', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'reception', name: 'File reception (push, widget)', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'address_book', name: 'Address book', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    {
      id: 'contact_groups', name: 'Contact groups', values: new Map([
        ['free', { isCheck: false }],
        ['premium', { isCheck: true }],
        ['team', { isCheck: true }],
        ['enterprise', { isCheck: true }]
      ])
    },
    // --- Another Section Heading ---
    { id: 'sharing_heading', name: 'Transfer and sharing', isHeading: true, values: new Map() },
    // --- Add more features following the same structure ---

  ];

  constructor() { }

  // Helper function to get value for a plan, prevents template errors if map/value is missing
  getFeatureValue(feature: Feature, planId: string): FeatureValue | undefined {
    return feature.values?.get(planId);
  }
}