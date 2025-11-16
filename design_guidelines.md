# Design Guidelines: Commercial Visits Management PWA

## Design Approach
**Mobile-First Material Design** - Following Material Design principles optimized for field sales professionals who need efficient data entry and quick access to information on smartphones. Reference modern mobile CRM applications like HubSpot Mobile and Salesforce Mobile for interaction patterns.

## Typography
- **Primary Font**: Inter (Google Fonts) for excellent mobile readability
- **Headings**: 
  - Page titles: text-xl/font-semibold (20px)
  - Section headers: text-lg/font-medium (18px)
  - Card titles: text-base/font-medium (16px)
- **Body**: text-sm (14px) for lists, text-base (16px) for forms
- **Labels**: text-xs/uppercase/tracking-wide for form labels

## Layout System
**Spacing Units**: Use Tailwind units of 2, 3, 4, 6, and 8
- Standard padding: p-4 for cards, p-3 for compact items
- Section spacing: space-y-4 between components, space-y-6 between major sections
- Bottom navigation height: h-16 with safe-area-inset-bottom

**Container Strategy**:
- Full-width mobile layouts with px-4 side margins
- Max container width: max-w-2xl (centered on tablets)
- Lists and cards: full-bleed to edges with internal padding

## Component Library

### Navigation
**Bottom Navigation Bar** (fixed, elevated):
- 4 icons: Dashboard, Gabinetes, Contactos, Visitas
- Icon size: 24px with 8px label text below
- Active state: filled icon + accent indicator
- Material Icons for navigation icons

### Cards & Lists
**Office/Contact Cards**:
- Elevated card (shadow-md) with rounded-lg corners
- Avatar/logo on left (48px circular)
- Title + metadata stacked on right
- Tap target: min-h-20
- Chevron right indicator for navigation

**Visit Cards**:
- Larger cards (min-h-24) with thumbnail preview if media exists
- Date badge in top-right corner
- Status indicators (completed, pending follow-up)
- Swipe-to-delete gesture support

### Forms & Inputs
**Search Bar** (prominent):
- Fixed at page top with sticky positioning
- Rounded-full design (rounded-3xl)
- Left search icon, right clear button
- Instant filtering as user types
- Autocomplete dropdown below

**Form Fields**:
- Floating labels (Material Design pattern)
- Touch-friendly height: h-12 minimum
- Clear visual focus states
- Helper text below in text-xs
- Error states with red accent and icon

**Upload Buttons**:
- Large touch targets (h-16+)
- Icon + label combinations
- Camera icon for photos, microphone for audio
- Progress indicators during upload
- Thumbnail previews after upload

### Action Buttons
**Primary CTAs**:
- Fixed floating action button (FAB) for "Nova Visita", "Criar Gabinete"
- Position: bottom-right with bottom navigation clearance (bottom-20)
- Size: 56px circular
- Plus icon centered

**Secondary Buttons**:
- Full-width on mobile: w-full h-12
- Rounded-lg corners
- Clear pressed states (scale slightly on tap)

### Data Display
**Dashboard Cards**:
- Grid layout: 2 columns (grid-cols-2 gap-3)
- Each metric card: aspect-square with centered content
- Large number (text-2xl/font-bold) above label (text-xs)

**Detail Screens**:
- Hero section with office/contact name and key info
- Tabbed interface for related data (Contactos, Visitas, Detalhes)
- Timeline view for visit history

**Visit Detail Page**:
- Photo/video gallery at top (if available)
- Audio player component (if available)
- Collapsible sections: Notas, AI Summary, Marcas Entregues
- Next visit date prominently displayed
- Share button for unique link

### Empty States
- Centered icon (64px) with descriptive text below
- "Criar Primeiro..." call-to-action button
- Friendly, encouraging copy in Portuguese

### Loading States
- Skeleton screens for lists (shimmer effect)
- Circular progress for actions
- Upload progress bars with percentage

## Mobile-Specific Patterns
- Pull-to-refresh on list pages
- Swipe gestures for card actions
- Native camera/gallery picker integration
- Voice input option for notes field
- Offline indicator banner when disconnected
- Toast notifications for success/error states (bottom position)

## PWA Features
- App icon: 512x512 branded icon
- Splash screen with app logo
- Status bar integration (matches header)
- Install prompt on first visit

## Animations
**Minimal & Purposeful**:
- Page transitions: simple slide (150ms)
- Card tap: subtle scale feedback (0.98)
- FAB: rotate plus icon on tap
- List items: staggered fade-in on load
- No decorative animations

## Performance Optimization
- Lazy load images in lists
- Virtual scrolling for long lists (100+ items)
- Debounced search (300ms)
- Optimistic UI updates
- Image compression on upload

**Key Design Principle**: Every interaction must feel instant and natural for field professionals using one hand while standing. Prioritize speed, clarity, and minimal cognitive load.