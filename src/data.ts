import { ActivityLog, MenuItem, Script } from './types';

export const initialMenuItems: MenuItem[] = [
  {
    id: 'menu-1',
    name: 'Signature Wagyu Burger',
    description: "Chef's specialty beef patty, smoked cheddar, house truffle mayo, homemade brioche bun, paired with Hand-Cut Fries.",
    category: 'Main',
    price: 28,
    isSpecial: true,
    status: 'active',
  },
  {
    id: 'menu-2',
    name: 'Truffle Arancini',
    description: 'Set of 4 crispy risotto balls stuffed with black truffle shavings, aged parmigiano, and melting mozzarella core.',
    category: 'Appetizer',
    price: 16,
    isSpecial: false,
    status: 'active',
  },
  {
    id: 'menu-3',
    name: 'Spiced Old Fashioned',
    description: 'Premium Kentucky bourbon, custom aromatic spice bitters, orange peel, and applewood smoke infusion.',
    category: 'Drink',
    price: 14,
    isSpecial: true,
    status: 'inactive',
  },
  {
    id: 'menu-4',
    name: 'Lobster Mac & Cheese',
    description: 'Fresh Maine lobster claws, gruyere & white cheddar cream sauce, toasted garlic panko crumb topping.',
    category: 'Main',
    price: 34,
    isSpecial: false,
    status: 'active',
  },
  {
    id: 'menu-5',
    name: 'Burrata & Tomato',
    description: 'Creamy Italian burrata, heirloom cherry tomatoes, cold-pressed basil olive oil, aged balsamico glaze.',
    category: 'Appetizer',
    price: 19.5,
    isSpecial: false,
    status: 'active',
  },
  {
    id: 'menu-6',
    name: 'Warm Matcha Lava Cake',
    description: 'Rich molten Uji matcha cake, premium Madagascar vanilla bean gelato, toasted black sesame crumble.',
    category: 'Dessert',
    price: 12,
    isSpecial: false,
    status: 'active',
  },
];

export const initialActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    type: 'reservation',
    title: 'Reservation Confirmed',
    detail: 'Table for 4 - Today 7:00 PM',
    time: '2 mins ago',
    duration: '2:14',
    status: 'SUCCESS',
  },
  {
    id: 'log-2',
    type: 'inquiry',
    title: 'Inquiry: Vegan Options',
    detail: 'AI Assistant Answered Gluten/Vegan questions',
    time: '12 mins ago',
    duration: '0:45',
    status: 'HANDLED',
  },
  {
    id: 'log-3',
    type: 'change',
    title: 'Reservation Change',
    detail: 'Update reservation time to 8:30 PM',
    time: '24 mins ago',
    duration: '1:30',
    status: 'HANDLED',
  },
  {
    id: 'log-4',
    type: 'takeout',
    title: 'Takeout Order',
    detail: 'Order #9842 - Paid & Dispatched to Kitchen',
    time: '45 mins ago',
    duration: '3:20',
    status: 'SUCCESS',
  },
  {
    id: 'log-5',
    type: 'general',
    title: 'General Question',
    detail: 'Customer asked about nearby parking options',
    time: '1 hour ago',
    duration: '0:28',
    status: 'HANDLED',
  },
];

export const initialScripts: Script[] = [
  {
    id: 'script-1',
    title: 'Reservation Intake',
    description: 'Handles incoming calls for table bookings, including party size, time, and special requests.',
    category: 'STANDARD',
    text: `[AI]: "Thank you for calling Bistro Prime. My name is Jamie, your virtual assistant. How can I help you today?"

[Wait for User Response]

[AI]: "I'd be happy to help with that reservation. For what date and time would you like to join us?"

[If Date/Time Available]

[AI]: "Perfect, I have a table available at that time. Would you like me to note any special occasions or dietary requirements for your party?"

[Finalizing]

[AI]: "Excellent. I've booked that for you. You'll receive a confirmation SMS shortly. We look forward to seeing you at Bistro Prime!"`,
    avatarText: 'FR',
    lastUpdated: 'Updated Oct 12',
    stats: {
      successRate: '94.2%',
      avgDuration: '1:24',
      intentAccuracy: '98%',
    },
  },
  {
    id: 'script-2',
    title: 'Order Inquiry',
    description: 'Explains menu items, checks availability, and addresses dietary restrictions.',
    category: 'DYNAMIC',
    text: `[AI]: "Hi there! Thanks for calling Bistro. Are you curious about a specific menu item, or would you like me to guide you through our specials?"

[Wait for User's Question]

[AI]: "Our Signature Wagyu Burger is made from A5 grade beef with truffle mayo. We can certainly swap the brioche for a gluten-free bun if you'd like! Our kitchen is very careful."

[Finalizing]

[AI]: "I've added those items to your basket, or I can transfer you to our live checkout agent if you're ready!"`,
    avatarText: 'PR',
    lastUpdated: 'Updated Oct 08',
    stats: {
      successRate: '88.5%',
      avgDuration: '1:45',
      intentAccuracy: '94%',
    },
  },
  {
    id: 'script-3',
    title: 'Special Offer Drive',
    description: 'Promotional script focused on the Weekend Brunch special and 20% group discount.',
    category: 'CAMPAIGN',
    text: `[AI]: "Hello from Bistro AI! We are running our special Weekend Bottomless Mimosa Brunch event. Groups of 5 or more get a 20% flat discount!"

[Wait for Customer Interest]

[AI]: "Would you like me to secure a table for your group this Saturday or Sunday morning? We still have slots around 11:00 AM."`,
    avatarText: 'CH',
    lastUpdated: 'Updated Oct 05',
    stats: {
      successRate: '91.0%',
      avgDuration: '1:10',
      intentAccuracy: '92%',
    },
  },
  {
    id: 'script-4',
    title: 'Cancellation Logic',
    description: 'Deals with booking modifications and policy enforcement for late cancellations.',
    category: 'INTERNAL',
    text: `[AI]: "Hello. I understand you need to modify or cancel your booking. Let me check the reservation rules under your name."

[Review Rules]

[AI]: "Please note cancellations within 2 hours of booking are subject to a nominal retainer fee. Would you prefer to reschedule for free instead?"`,
    avatarText: 'ST',
    lastUpdated: 'Updated Sep 28',
    stats: {
      successRate: '85.4%',
      avgDuration: '2:15',
      intentAccuracy: '95%',
    },
  },
];
