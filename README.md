# Safe School Project Workspace

This project is organized into two main parts:

- **`frontend/`**: Client-side UI, React components, pages, styles, assets, and frontend logic built with React & Vite.
- **`backend/`**: Workspace reserved for server-side logic, APIs, and backend services.

## Project Structure

```
.
├── frontend/           # React + Vite client-side application
│   ├── src/            # Source code (Components, Pages, Services, Hooks, Contexts)
│   ├── public/         # Public static assets
│   ├── package.json    # Frontend dependencies and scripts
│   └── vite.config.js  # Vite configuration
├── backend/            # Empty workspace reserved for future backend development
│   └── .gitkeep
├── package.json        # Workspace scripts runner
├── README.md           # Project documentation
└── .gitignore          # Git ignore file
```

## Getting Started

### Frontend Development

To run the frontend client application:

```bash
# Run from root directory
npm run dev

# Or run directly inside the frontend folder
cd frontend
npm run dev
```

### Build Frontend

```bash
# Build production bundle
npm run build
```
