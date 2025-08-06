# AI-Powered Test Automation Platform

A modern React + Node.js application that integrates with Azure OpenAI to generate high-quality Cucumber test cases in Gherkin syntax from user requirements, user stories, or any content.

## Features

- 🤖 **AI-Powered Test Generation**: Uses Azure OpenAI to analyze content and generate comprehensive Cucumber test cases
- 🎨 **Modern UI**: Beautiful, responsive React interface with real-time feedback
- 📝 **Test Refinement**: Ability to refine generated tests based on feedback
- 💾 **Export Options**: Copy to clipboard or download as .feature files
- 🔒 **Secure**: Built with security best practices including rate limiting and CORS
- ⚡ **Real-time**: Instant test generation with loading states and error handling
- 🏗️ **Clean Architecture**: Separated frontend and backend for better maintainability

## Tech Stack

### Backend
- **Node.js** with Express
- **Azure OpenAI** integration
- **Security**: Helmet, CORS, Rate Limiting
- **Environment**: dotenv for configuration

### Frontend
- **React** with modern hooks
- **Axios** for API communication
- **Lucide React** for icons
- **React Syntax Highlighter** for code display
- **Modern CSS** with gradients and animations

### Package Management
- **pnpm** for fast, efficient package management
- **Monorepo** structure with workspaces

## Prerequisites

- Node.js (v16 or higher)
- pnpm (recommended) or npm
- Azure OpenAI API access

## Setup Instructions

### 1. Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

### 2. Clone and Install Dependencies

```bash
git clone <repository-url>
cd genAiQaTool
pnpm run install-all
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

Edit `.env` with your Azure OpenAI credentials:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_MODEL=gpt-4

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend Configuration (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Start the Application

#### Development Mode (Both Frontend and Backend)
```bash
pnpm run dev
```

#### Individual Services
```bash
# Backend only
pnpm run server

# Frontend only
pnpm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Usage

### 1. Generate Test Cases

1. Enter your requirements, user stories, or any content in the main text area
2. Optionally add additional context for better results
3. Click "Generate Tests" to create Cucumber test cases
4. The AI will analyze your input and generate comprehensive Gherkin scenarios

### 2. Refine Test Cases

1. After generating tests, you can provide feedback in the refinement section
2. Enter specific changes or improvements you'd like to see
3. Click "Refine Tests" to get updated test cases

### 3. Export Options

- **Copy to Clipboard**: Click the copy button to copy tests to clipboard
- **Download**: Click the download button to save as a .feature file

## Example Input

```
The user should be able to log in with valid credentials and be redirected to the dashboard.
```

## Example Output

```gherkin
Feature: User Login
  As a user
  I want to log in to the system
  So that I can access my dashboard

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters valid username and password
    And the user clicks the login button
    Then the user should be redirected to the dashboard
    And the user should see a welcome message
```

## API Endpoints

### Health Check
- `GET /api/health` - Check server status

### Generate Tests
- `POST /api/generate-tests`
  - Body: `{ "content": "string", "context": "string" }`
  - Returns: Generated Cucumber test cases

### Refine Tests
- `POST /api/refine-tests`
  - Body: `{ "originalTests": "string", "feedback": "string" }`
  - Returns: Refined test cases

## Project Structure

```
genAiQaTool/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Header.js
│   │   │   ├── TestGenerator.js
│   │   │   └── TestOutput.js
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── backend/               # Node.js backend
│   ├── index.js          # Express server with OpenAI integration
│   └── package.json
├── package.json          # Root package.json with workspaces
├── pnpm-workspace.yaml   # pnpm workspace definition
├── env.example           # Environment variables template
├── .npmrc                # pnpm configuration
└── README.md            # This file
```

## Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS**: Configured for secure cross-origin requests
- **Helmet**: Security headers for Express
- **Input Validation**: Server-side validation for all inputs
- **Error Handling**: Comprehensive error handling and logging

## Development

### Adding New Features

1. **Backend**: Add new endpoints in `backend/index.js`
2. **Frontend**: Create new components in `frontend/src/components/`
3. **Styling**: Update `frontend/src/App.css` for new styles

### Testing

```bash
# Frontend tests
pnpm run test

# Backend tests (when implemented)
pnpm --filter @gen-ai-qa-tool/backend run test
```

### Building

```bash
# Build frontend for production
pnpm run build

# Build all packages
pnpm run build:all
```

## Troubleshooting

### Common Issues

1. **Azure OpenAI Connection Error**
   - Verify your API key and endpoint in `.env`
   - Check if your Azure OpenAI resource is active

2. **Port Conflicts**
   - Change PORT in `.env` if 5000 is in use
   - Frontend runs on port 3000 by default

3. **CORS Issues**
   - Ensure backend is running on the correct port
   - Check FRONTEND_URL in `.env` matches your frontend URL

4. **pnpm Issues**
   - Make sure pnpm is installed: `npm install -g pnpm`
   - Clear cache if needed: `pnpm store prune`

5. **Workspace Issues**
   - Run `pnpm install` from root directory
   - Check workspace configuration in pnpm-workspace.yaml

### Debug Mode

```bash
# Backend with debug logging
DEBUG=* pnpm run server

# Frontend with React DevTools
pnpm run client
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Create an issue in the repository

---

**Built with ❤️ for Test Automation Architects** 