# KlassiJS AI - Intelligent Test Case Generator

A comprehensive AI-powered test automation platform that extracts business requirements and generates high-quality Cucumber test cases using Azure OpenAI. Built with React, Node.js, and modern web technologies.

## 🚀 Features

### **Core Functionality**
- 🤖 **AI-Powered Requirements Extraction**: Automatically extracts business requirements and acceptance criteria from documents
- 🧪 **Intelligent Test Generation**: Creates comprehensive Cucumber test cases in Gherkin syntax
- 📋 **Structured Requirements Table**: Displays extracted requirements in a professional Word-like table format
- 🔄 **Test Refinement**: Improve generated tests with AI-powered refinement
- 📁 **Multi-Format Document Support**: PDF, DOCX, TXT, MD, RTF, ODT, images, Excel, PowerPoint, and Visio files

### **Integrations**
- 🔗 **Jira Integration**: Import Epics, Stories, Tasks, and Bugs directly from Jira projects
- 📊 **Zephyr Scale Integration**: Push generated test cases directly to Zephyr Scale with hierarchical folder navigation
- 💾 **Export Options**: Download requirements as Word documents and test cases as .feature files

### **User Experience**
- 🎨 **Modern UI**: Beautiful, responsive interface with consistent button styling
- 🔍 **Smart Search**: Filter dropdowns for projects and folders
- 📂 **Hierarchical Navigation**: Tree-view folder navigation for Zephyr Scale
- ⚡ **Real-time Feedback**: Loading states, progress indicators, and status messages
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠️ Tech Stack

### **Frontend**
- **React 18** with modern hooks and functional components
- **Axios** for API communication
- **Lucide React** for beautiful icons
- **Modern CSS** with gradients, animations, and responsive design

### **Backend**
- **Node.js** with Express framework
- **Azure OpenAI** integration for AI-powered features
- **Multer** for file upload handling
- **Security**: Helmet, CORS, rate limiting
- **File Processing**: Support for multiple document formats

### **Package Management**
- **pnpm** for fast, efficient package management
- **Monorepo** structure with workspaces

## 📋 Prerequisites

- Node.js (v16 or higher)
- pnpm (recommended) or npm
- Azure OpenAI API access
- Jira credentials (optional, for Jira integration)
- Zephyr Scale credentials (optional, for Zephyr integration)

## 🚀 Quick Start

### 1. Install pnpm
```bash
npm install -g pnpm
```

### 2. Clone and Install
```bash
git clone <repository-url>
cd klassijs-AI
pnpm run install-all
```

### 3. Configure Environment
```bash
cp env.example .env
```

Edit `.env` with your credentials:

```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_MODEL=gpt-4

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Jira Integration (Optional)
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your-jira-api-token

# Zephyr Scale Integration (Optional)
ZEPHYR_BASE_URL=https://your-domain.zephyrscale.io
ZEPHYR_API_TOKEN=your-zephyr-api-token
ZEPHYR_PROJECT_KEY=your-project-key
```

### 4. Start the Application
```bash
# Development mode (both frontend and backend)
pnpm run dev

# Or start individually
pnpm run server    # Backend only
pnpm run client    # Frontend only
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📖 Usage Guide

### **1. Document Upload & Requirements Extraction**

1. **Upload Documents**: Drag and drop or select files (PDF, DOCX, TXT, etc.)
2. **Automatic Analysis**: The AI automatically extracts business requirements
3. **View Results**: Requirements are displayed in a professional table format
4. **Export Options**: 
   - Copy requirements to clipboard
   - Download as Word document (.docx)
   - Insert into test generator

### **2. Test Case Generation**

1. **Enter Content**: Use the main text area for requirements or user stories
2. **Add Context**: Optionally add domain-specific information in the Additional Context section
3. **Generate Tests**: Click "Generate Tests" to create Cucumber test cases
4. **View Results**: Tests are displayed in organized feature tabs
5. **Refine Tests**: Use the refinement feature to improve generated tests

### **3. Jira Integration**

1. **Connect to Jira**: Click "Import from Jira" and enter your credentials
2. **Select Project**: Choose from your Jira projects
3. **Select Issues**: Pick Epics, Stories, Tasks, or Bugs to import
4. **Generate Tests**: Convert Jira issues to Cucumber test cases

### **4. Zephyr Scale Integration**

1. **Configure Zephyr**: Set up your Zephyr Scale credentials
2. **Select Project**: Choose your Zephyr project
3. **Navigate Folders**: Use the hierarchical folder navigation
4. **Push Tests**: Send generated test cases directly to Zephyr Scale

## 📊 Example Outputs

### **Requirements Extraction**
```
| Requirement ID | Business Requirement | Acceptance Criteria |
|----------------|---------------------|-------------------|
| REQ-001 | User login functionality | Given the user is on the login page When the user enters valid credentials Then the user should be redirected to the dashboard |
| REQ-002 | Password reset capability | Given the user has forgotten their password When the user requests a reset Then the system shall send a secure reset link |
```

### **Generated Test Cases**
```gherkin
Feature: User Authentication
  As a user
  I want to log in to the system
  So that I can access my account

  Scenario: Successful login with valid credentials
    Given the user is on the login page
    When the user enters valid username and password
    And the user clicks the login button
    Then the user should be redirected to the dashboard
    And the user should see a welcome message

  Scenario: Failed login with invalid credentials
    Given the user is on the login page
    When the user enters invalid username and password
    And the user clicks the login button
    Then the system should display an error message
    And the user should remain on the login page
```

## 🔧 API Endpoints

### **Core Endpoints**
- `GET /api/health` - Health check
- `POST /api/analyze-document` - Document analysis
- `POST /api/extract-requirements` - Requirements extraction
- `POST /api/generate-tests` - Test generation
- `POST /api/refine-tests` - Test refinement
- `POST /api/generate-word-doc` - Word document export

### **Jira Integration**
- `POST /api/jira/test-connection` - Test Jira connection
- `POST /api/jira/fetch-issues` - Fetch Jira issues
- `POST /api/jira/import-issues` - Import Jira issues

### **Zephyr Scale Integration**
- `GET /api/zephyr-projects` - Fetch Zephyr projects
- `GET /api/zephyr-folders/:projectKey` - Fetch all folders
- `GET /api/zephyr-main-folders/:projectKey` - Fetch main folders
- `GET /api/zephyr-subfolders/:projectKey/:parentFolderId` - Fetch subfolders
- `GET /api/zephyr-search-folders/:projectKey` - Search folders
- `POST /api/zephyr-push` - Push test cases to Zephyr

## 📁 Project Structure

```
klassijs-AI/
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Header.js       # Application header
│   │   │   ├── TestGenerator.js # Main application component
│   │   │   └── TestOutput.js   # Test display component
│   │   ├── App.js              # Main app component
│   │   └── App.css             # Global styles
│   └── package.json
├── backend/                     # Node.js backend
│   ├── index.js                # Express server
│   ├── routes/
│   │   └── api.js              # API routes
│   ├── services/
│   │   ├── openaiService.js    # Azure OpenAI integration
│   │   ├── jiraService.js      # Jira integration
│   │   └── zephyrService.js    # Zephyr Scale integration
│   ├── utils/
│   │   └── fileProcessor.js    # File processing utilities
│   └── package.json
├── package.json                 # Root package.json
├── pnpm-workspace.yaml         # pnpm workspace definition
├── env.example                 # Environment variables template
└── README.md                   # This file
```

## 🔒 Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS**: Secure cross-origin request handling
- **Helmet**: Security headers for Express
- **Input Validation**: Comprehensive server-side validation
- **Error Handling**: Robust error handling and logging
- **Environment Variables**: Secure credential management

## 🛠️ Development

### **Adding New Features**

1. **Backend**: Add new endpoints in `backend/routes/api.js`
2. **Frontend**: Create new components in `frontend/src/components/`
3. **Styling**: Update `frontend/src/App.css` for new styles

### **Testing**
```bash
# Frontend tests
pnpm run test

# Backend tests (when implemented)
pnpm --filter @klassijs-ai/backend run test
```

### **Building**
```bash
# Build frontend for production
pnpm run build

# Build all packages
pnpm run build:all
```

## 🔧 Troubleshooting

### **Common Issues**

1. **Azure OpenAI Connection Error**
   - Verify API key and endpoint in `.env`
   - Check Azure OpenAI resource status

2. **Port Conflicts**
   - Change PORT in `.env` if 5000 is in use
   - Frontend runs on port 3000 by default

3. **CORS Issues**
   - Ensure backend is running on correct port
   - Check FRONTEND_URL in `.env`

4. **File Upload Issues**
   - Check file size limits (5MB default)
   - Verify supported file formats

5. **Integration Issues**
   - Verify Jira/Zephyr credentials
   - Check network connectivity

### **Debug Mode**
```bash
# Backend with debug logging
DEBUG=* pnpm run server

# Frontend with React DevTools
pnpm run client
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details -- © 2025 [Larry Goddard](https://www.linkedin.com/in/larryg)
