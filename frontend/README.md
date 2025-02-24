# HayhaiSearch Frontend

The frontend application for HayhaiSearch, built with Next.js and TypeScript featuring a neobrutalist design.

## Development

First, run the development server:

```bash
yarn dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
src/
├── app/                # Next.js 14 app router
│   ├── api/           # API routes
│   ├── error.tsx      # Error handling
│   ├── layout.tsx     # Root layout
│   └── page.tsx       # Home page
├── components/        
│   └── ui/           # Reusable UI components
└── lib/              # Utility functions
```

## Components

### UI Components

- `SearchInput`: Main search input with icon button
- `SearchResults`: Results display with loading states
- `Button`: Reusable button component with variants

### Design System

- Uses Tailwind CSS with custom configuration
- Neobrutalist design elements
- Custom color palette
- Responsive breakpoints
- Typography scale

## Built With

- [Next.js](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [SWR](https://swr.vercel.app/)
- [Radix UI Icons](https://www.radix-ui.com/icons)

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
