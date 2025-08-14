# 🚀 AI Test Automation Platform

A comprehensive, AI-powered test automation platform that integrates with Jira, Zephyr Scale, and supports both document uploads and workflow analysis. Generate comprehensive test cases with automatic cyclomatic complexity calculation and path coverage analysis.

## ✨ Features

### 🔍 **Smart Requirements Extraction**
- **Document Analysis**: Upload Word, PDF, or text documents for automatic requirements extraction
- **AI-Powered Processing**: Uses Azure OpenAI to intelligently parse business requirements
- **Workflow Detection**: Automatically identifies workflows, decision points, and business processes
- **Complexity Calculation**: Calculates cyclomatic complexity for each requirement

### 🧠 **Intelligent Test Generation**
- **Path-Based Coverage**: Generates test scenarios that cover every identified execution path
- **Gherkin Syntax**: Creates Cucumber test cases in proper Given/When/Then format
- **Comprehensive Testing**: Includes positive, negative, and edge case scenarios
- **Workflow Testing**: Specialized test generation for business process workflows

### 🔗 **Enterprise Integration**
- **Jira Integration**: Import requirements directly from Jira tickets
- **Zephyr Scale**: Push generated test cases to Zephyr Scale with full traceability
- **Folder Management**: Organize test cases in Zephyr Scale folders
- **Jira Traceability**: Automatic linking of test cases to Jira tickets

### 📊 **Advanced Analytics**
- **Cyclomatic Complexity**: Automatic calculation of code/workflow complexity
- **Path Coverage Analysis**: Ensures complete test coverage of all execution paths
- **Decision Point Mapping**: Identifies and tests all decision branches
- **Quality Metrics**: Provides coverage percentages and adequacy scores

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   External      │
│   (React)       │◄──►│   (Node.js)      │◄──►│   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
│                        │                        │
├─ Test Generator        ├─ OpenAI Service        ├─ Azure OpenAI
├─ Requirements Table    ├─ Jira Service          ├─ Jira Cloud
├─ Zephyr Integration   ├─ Zephyr Service        ├─ Zephyr Scale
└─ Workflow Analysis    └─ Workflow Analyzer     └─ File Uploads
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- pnpm
- Azure OpenAI API credentials
- Jira Cloud instance (optional)
- Zephyr Scale instance (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd klassijs-AI
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Azure OpenAI
   OPENAI_URL=https://your-resource.openai.azure.com
   OPENAI_DEVELOPMENT_ID=your-deployment-id
   OPENAI_API_VERSION=2024-02-15-preview
   OPENAI_API_KEY=your-api-key
   
   # Jira (optional)
   JIRA_BASE_URL=https://your-domain.atlassian.net
   JIRA_EMAIL=your-email@domain.com
   JIRA_API_TOKEN=your-api-token
   
   # Zephyr Scale (optional)
   ZEPHYR_BASE_URL=https://your-instance.zephyrscale.io
   ZEPHYR_API_TOKEN=your-api-token
   ZEPHYR_PROJECT_KEY=your-project-key
   ```

4. **Start the application**
   ```bash
   # Start backend
   cd backend
   pnpm start
   
   # Start frontend (in new terminal)
   cd frontend
   pnpm start
   ```

## 📖 Usage Guide

### 1. **Requirements Extraction**

#### **From Documents**
1. Navigate to the "Upload Document" section
2. Upload your Word, PDF, or text document
3. The system automatically:
   - Extracts business requirements
   - Calculates cyclomatic complexity
   - Identifies workflows and decision points
4. Review and edit the extracted requirements table
5. Click "Insert Requirements" to add to the test generator

#### **From Jira**
1. Click "Import from Jira"
2. Connect to your Jira instance
3. Select projects and issue types
4. Choose specific tickets to import
5. The system processes tickets through AI requirements extraction
6. Requirements are automatically organized with Jira ticket prefixes

### 2. **Test Generation**

1. **Insert Requirements**: Use the extracted requirements or manually enter them
2. **Add Context**: Provide additional domain-specific information
3. **Generate Tests**: Click "Generate Test Cases"
4. **Review Results**: The system generates:
   - Feature files with proper Gherkin syntax
   - Test scenarios for every execution path
   - Positive, negative, and edge case scenarios
   - Path coverage analysis

### 3. **Zephyr Scale Integration**

1. **Configure Zephyr**: Set project key, folder, and test case settings
2. **Push Tests**: Send generated test cases to Zephyr Scale
3. **Traceability**: Automatic linking to Jira tickets (if imported from Jira)
4. **Organization**: Test cases are properly organized in specified folders

## 🔧 Configuration

### **Azure OpenAI Setup**
```bash
# Get your Azure OpenAI credentials from Azure Portal
# Configure in .env file
OPENAI_URL=https://your-resource.openai.azure.com
OPENAI_DEVELOPMENT_ID=your-deployment-id
OPENAI_API_VERSION=2024-02-15-preview
OPENAI_API_KEY=your-api-key
```

### **Jira Integration**
```bash
# Generate API token from Atlassian
# https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@domain.com
JIRA_API_TOKEN=your-api-token
```

### **Zephyr Scale Setup**
```bash
# Get API token from Zephyr Scale
# Configure project and folder structure
ZEPHYR_BASE_URL=https://your-instance.zephyrscale.io
ZEPHYR_API_TOKEN=your-api-token
ZEPHYR_PROJECT_KEY=your-project-key
```

## 📊 Understanding Complexity Analysis

### **Cyclomatic Complexity Formula**
```
CC = Decision Points - Activities + 2
```

### **Complexity Levels**
- **CC 1-3**: Simple (basic functionality)
- **CC 4-10**: Moderate (some decision logic)
- **CC 11-20**: Complex (multiple decision paths)
- **CC 21+**: Very Complex (consider refactoring)

### **Path Coverage**
- **Decision Points**: Gateways, conditional flows, branches
- **Activities**: Tasks, user tasks, service tasks
- **Paths**: Estimated execution paths through the workflow
- **Coverage**: Percentage of paths covered by test scenarios

## 🧪 Testing

### **Run Backend Tests**
```bash
cd backend
node test-workflow-analyzer.js
```

### **Test Workflow Analysis**
```bash
cd backend
node test-workflow-analyzer.js
```

Expected output:
```
🔍 Testing Workflow Analyzer...

📊 Basic Workflow Analysis:
{
  "decisionPoints": 17,
  "activities": 29,
  "complexityLevel": "moderate"
}

🧠 Smart Categorization Examples:
Login requirement: CC: 1, Decision Points: 0, Activities: 1, Paths: 1
Workflow process: CC: 6, Decision Points: 9, Activities: 15, Paths: 6
```

## 📁 Project Structure

```
klassijs-AI/
├── backend/                 # Backend services
│   ├── services/           # Core business logic
│   │   ├── openaiService.js    # AI test generation
│   │   ├── jiraService.js      # Jira integration
│   │   └── zephyrService.js    # Zephyr Scale integration
│   ├── utils/              # Utility functions
│   │   ├── workflowAnalyzer.js # Complexity analysis
│   │   └── docxGenerator.js    # Document generation
│   └── routes/             # API endpoints
│       └── api.js          # Main API routes
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── TestGenerator.js    # Main test generation UI
│   │   │   ├── Header.js           # Application header
│   │   │   └── TestOutput.js       # Test case display
│   │   └── App.js          # Main application
│   └── public/             # Static assets
└── docs/                   # Documentation
```

## 🔍 API Endpoints

### **Requirements Extraction**
```http
POST /api/extract-requirements
Content-Type: application/json

{
  "content": "document content",
  "context": "additional context"
}
```

### **Test Generation**
```http
POST /api/generate-tests
Content-Type: application/json

{
  "content": "requirements content",
  "context": "domain context"
}
```

### **Jira Integration**
```http
POST /api/jira/test-connection
POST /api/jira/fetch-issues
POST /api/jira/import-issues
```

### **Zephyr Scale**
```http
POST /api/zephyr/push
GET /api/zephyr/projects
GET /api/zephyr/folders
```

## 🚨 Troubleshooting

### **Common Issues**

#### **Azure OpenAI Not Working**
```bash
# Check environment variables
echo $OPENAI_URL
echo $OPENAI_API_KEY

# Verify API endpoint
curl -H "api-key: $OPENAI_API_KEY" \
     "$OPENAI_URL/openai/deployments/$OPENAI_DEVELOPMENT_ID/chat/completions?api-version=$OPENAI_API_VERSION"
```

#### **Jira Connection Failed**
```bash
# Verify credentials
echo $JIRA_BASE_URL
echo $JIRA_EMAIL
echo $JIRA_API_TOKEN

# Test connection manually
curl -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
     "$JIRA_BASE_URL/rest/api/3/myself"
```

#### **Zephyr Scale Issues**
```bash
# Check configuration
echo $ZEPHYR_BASE_URL
echo $ZEPHYR_API_TOKEN

# Test API access
curl -H "Authorization: Bearer $ZEPHYR_API_TOKEN" \
     "$ZEPHYR_BASE_URL/projects"
```

### **Logs and Debugging**
```bash
# Backend logs
cd backend
pnpm start

# Frontend logs
cd frontend
pnpm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Setup**
```bash
# Install development dependencies
pnpm install --dev

# Run linting
pnpm lint

# Run tests
pnpm test

# Build for production
pnpm build
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Azure OpenAI** for AI-powered test generation
- **Jira Cloud** for requirements management integration
- **Zephyr Scale** for test case management
- **React** for the frontend framework
- **Node.js** for the backend runtime

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)

---

**Built with ❤️ for Quality Assurance Teams**

*Transform your testing workflow with AI-powered automation and intelligent complexity analysis.*
