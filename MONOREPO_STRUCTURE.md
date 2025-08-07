# Clean Architecture Structure

This document outlines the clean architecture for the AI-Powered Test Automation Platform.

## Architecture Overview

The project has been restructured into a clean separation of frontend and backend for better maintainability, scalability, and development experience.

## Directory Structure

```
klassijs-AI/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Header.js
│   │   │   ├── TestGenerator.js
│   │   │   └── TestOutput.js
│   │   ├── App.js
│   │   └── App.css
│   ├── public/            # Static assets
│   ├── package.json       # Frontend dependencies
│   └── pnpm-lock.yaml
├── backend/               # Node.js backend API
│   ├── index.js          # Express server
│   ├── package.json      # Backend dependencies
│   └── pnpm-lock.yaml
├── package.json           # Root workspace configuration
├── pnpm-workspace.yaml   # pnpm workspace definition
├── pnpm-lock.yaml        # Root lock file
├── .npmrc                 # pnpm configuration
├── env.example            # Environment template
├── quick-start.sh         # Setup script
└── README.md             # Main documentation
```

## Package Details

### Root Package (`package.json`)
- **Purpose**: Workspace coordination and shared scripts
- **Scripts**: Development, build, and test commands for all packages
- **Dependencies**: Only development tools like `concurrently`

### Frontend Package (`frontend/`)
- **Name**: `@klassijs-ai/frontend`
- **Purpose**: React application for the UI
- **Port**: 3000 (default)
- **Dependencies**: React, Axios, Lucide React, React Syntax Highlighter
- **Scripts**: `start`, `build`, `test`, `eject`

### Backend Package (`backend/`)
- **Name**: `@klassijs-ai/backend`
- **Purpose**: Express API server with Azure OpenAI integration
- **Port**: 5000 (default)
- **Dependencies**: Express, OpenAI, Helmet, CORS, Rate Limiting
- **Scripts**: `start`, `dev`, `test`

## Benefits of Clean Architecture

### 1. **Separation of Concerns**
- Frontend and backend are completely independent
- Each package has its own dependencies and configuration
- Clear boundaries between client and server code

### 2. **Development Experience**
- Independent development of frontend and backend
- Shared tooling and configuration
- Easy to add new services (e.g., admin panel, mobile app)

### 3. **Deployment Flexibility**
- Can deploy frontend and backend separately
- Different deployment strategies for each package
- Independent versioning and releases

### 4. **Team Collaboration**
- Different teams can work on different packages
- Clear ownership and responsibility
- Reduced merge conflicts

### 5. **Scalability**
- Easy to add new services (e.g., admin panel, mobile app)
- Shared dependencies and utilities
- Consistent development environment

## Package Management

### pnpm Workspaces
- Uses `pnpm-workspace.yaml` for workspace definition
- Shared lock file for consistent dependencies
- Efficient disk usage through symlinks
- Parallel installation and updates

### Commands
```bash
# Install all dependencies
pnpm install

# Run specific package
pnpm --filter @klassijs-ai/frontend run start
pnpm --filter @klassijs-ai/backend run dev

# Run from root (convenience)
pnpm run dev        # Both frontend and backend
pnpm run server     # Backend only
pnpm run client     # Frontend only
```

## Communication Between Packages

### API Communication
- Frontend makes HTTP requests to backend API
- CORS configured for secure cross-origin requests
- Environment variables for API URL configuration

### Environment Configuration
```env
# Backend (.env)
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_ENDPOINT=your_endpoint
FRONTEND_URL=http://localhost:3000

# Frontend (REACT_APP_*)
REACT_APP_API_URL=http://localhost:5000
```

## Development Workflow

### 1. **Setup**
```bash
./quick-start.sh
```

### 2. **Development**
```bash
# Both frontend and backend
pnpm run dev

# Individual services
pnpm run server
pnpm run client
```

### 3. **Building**
```bash
# Build frontend
pnpm run build

# Build all packages
pnpm run build:all
```

### 4. **Testing**
```bash
# Frontend tests
pnpm run test

# Backend tests (when implemented)
pnpm --filter @klassijs-ai/backend run test
```

## Adding New Services

### 1. Create Service Directory
```bash
mkdir new-service
cd new-service
```

### 2. Initialize Package
```bash
pnpm init
```

### 3. Add to Workspace
Update `pnpm-workspace.yaml`:
```yaml
packages:
  - 'frontend'
  - 'backend'
  - 'new-service'
```

### 4. Add Scripts to Root
```json
{
  "scripts": {
    "new-service": "pnpm --filter @klassijs-ai/new-service run dev"
  }
}
```

## Deployment Considerations

### Frontend Deployment
- Build with `pnpm run build`
- Serve static files from `frontend/build/`
- Configure API URL for production

### Backend Deployment
- Deploy `backend/` directory
- Set environment variables
- Configure CORS for production frontend URL

### Environment Variables
- Backend: Use `.env` file or deployment platform variables
- Frontend: Use `REACT_APP_*` prefix for build-time variables

## Troubleshooting

### Common Issues

1. **Package Not Found**
   ```bash
   pnpm install
   ```

2. **Workspace Issues**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. **CORS Issues**
   - Check `FRONTEND_URL` in backend `.env`
   - Verify frontend is running on correct port

4. **API Connection Issues**
   - Check `REACT_APP_API_URL` in frontend
   - Verify backend is running and accessible
