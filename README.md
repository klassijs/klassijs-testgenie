# 🚀 QA CHOMP!!! - AI-Powered Test Case Generator

An AI-powered test automation platform designed for enterprise-scale quality assurance. It transforms business requirements into accurate, executable Cucumber test cases, reducing manual effort and errors. With advanced content analysis and support for a wide range of document formats, it ensures consistent, reliable results across diverse inputs—streamlining QA workflows and accelerating delivery at scale.

## ✨ Key Features

### 🔍 **Universal Document Processing**
- **Multi-Format Support**: Word (.docx, .doc), PDF, Excel (.xlsx), PowerPoint (.pptx), Visio (.vsdx), Text files, and Images
- **Enhanced Visio Analysis**: Real XML parsing of flowcharts with shape and connector extraction
- **Deterministic Counting**: Same document always produces the same requirement count
- **Universal Business Extractor**: Consistent requirement detection across all file types
- **Quality-Based Selection**: Intelligent filtering to ensure high-quality requirements

### 🧠 **Intelligent AI Processing**
- **Azure OpenAI Integration**: Advanced GPT-4 powered requirement extraction and test generation
- **Chunked Processing**: Handles large documents with 3-pass extraction strategy
- **Adaptive Complexity Analysis**: Automatic cyclomatic complexity calculation for each requirement
- **Smart Pattern Recognition**: Identifies workflows, decision points, and business processes
- **Context-Aware Generation**: Domain-specific test case creation with proper Gherkin syntax

### 🔗 **Enterprise Integration**
- **Jira Cloud Integration**: Import requirements directly from Jira tickets with full traceability
- **Zephyr Scale Integration**: Push generated test cases to Zephyr Scale with organized folder structure
- **Automated Linking**: Seamless connection between Jira tickets and generated test cases
- **Project Management**: Comprehensive folder and test case organization

### 📊 **Advanced Analytics & Quality**
- **Cyclomatic Complexity Calculation**: Automatic complexity assessment using industry-standard formulas
- **Path Coverage Analysis**: Ensures complete test coverage of all execution paths
- **Quality Metrics**: Confidence scores, testability ratings, and adequacy assessments
- **Decision Point Mapping**: Identifies and tests all conditional branches
- **Workflow Analysis**: Comprehensive business process flow analysis

### 🎨 **Modern User Experience**
- **Responsive Design**: Beautiful, modern interface that works seamlessly on all devices
- **Custom Teal Theme**: Professional gradient header with integrated branding
- **Intuitive Workflow**: Streamlined user journey from upload to test generation
- **Real-time Feedback**: Live progress indicators and detailed analysis results
- **Clean Architecture**: Organized component structure for optimal user experience

## 🏗️ System Architecture

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend (React)  │◄──►│   Backend (Node.js)  │◄──►│  External Services  │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
│                           │                           │
├─ TestGenerator.js         ├─ Universal Extractor      ├─ Azure OpenAI GPT-4
├─ Requirements Table       ├─ Deterministic Counter    ├─ Jira Cloud API
├─ Zephyr Integration      ├─ Enhanced Visio Parser    ├─ Zephyr Scale API
├─ Header Component        ├─ Quality Selector         ├─ Document Processing
└─ Modern UI/UX           └─ Chunked AI Processing     └─ File Upload System
```

### **Processing Pipeline**
```
Document Upload → Content Extraction → Universal Analysis → Quality Selection
     ↓                    ↓                    ↓                ↓
Deterministic Count → AI Enhancement → Test Generation → Enterprise Integration
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (with pnpm package manager)
- **Azure OpenAI** account with GPT-4 deployment
- **Jira Cloud** instance (optional for Jira integration)
- **Zephyr Scale** instance (optional for test management)

### Installation

1. **Clone and Setup**
   ```bash
   git clone github.com/klassijs/klassijs-testgenie.git
   cd klassijs-testgenie
   pnpm install
   ```

2. **Environment Configuration**
   ```bash
   cp env.example .env
   ```

3. **Start the Application**
   ```bash
   # Option 1: Start both frontend and backend together
   pnpm dev
   
   # Option 2: Start individually
   # Backend (Terminal 1)
   pnpm server
   
   # Frontend (Terminal 2)  
   pnpm client
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📖 Complete Usage Guide

### 1. **Document Upload & Analysis**

#### **Supported File Types**
- **Documents**: Word (.docx, .doc), PDF, Text (.txt, .md)
- **Spreadsheets**: Excel (.xlsx, .xls)
- **Presentations**: PowerPoint (.pptx, .ppt)
- **Diagrams**: Visio (.vsdx) with enhanced flowchart analysis
- **Images**: PNG, JPG, GIF (filename-based analysis)

#### **Upload Process**
1. Navigate to the "Upload Document" section
2. Select your file(s) - multiple files supported
3. The system automatically:
   - Extracts content using file-specific processors
   - Runs deterministic business element counting
   - Applies quality-based selection for optimal requirements
   - Calculates cyclomatic complexity for each requirement
   - Provides detailed analysis breakdown

### 2. **Requirements Management**

#### **Automatic Extraction Features**
- **Universal Business Extractor**: Consistent requirement detection across all file types
- **Quality Scoring**: Each requirement gets confidence and testability scores
- **Complexity Analysis**: Automatic cyclomatic complexity calculation
- **Smart Filtering**: Removes technical noise and non-business content
- **Deterministic Results**: Same file always produces identical requirement counts

#### **Manual Review & Editing**
- Edit extracted requirements directly in the interface
- Add custom requirements manually
- Adjust complexity ratings if needed
- Remove irrelevant requirements

### 3. **Jira Integration Workflow**

#### **Import Features**
- **Bulk Import**: Select multiple tickets at once
- **Filtered Search**: Search by project, assignee, status, etc.
- **AI Enhancement**: Jira descriptions processed through AI for requirement extraction
- **Automatic Prefixing**: Requirements prefixed with Jira ticket keys (e.g., "PROJ-123:")
- **Metadata Preservation**: Maintains links to original Jira tickets

### 4. **Test Case Generation**

#### **AI-Powered Generation**
1. **Content Input**: Use extracted requirements or enter manually
2. **Context Addition**: Provide domain-specific information for better test quality
3. **Generate**: Click "Generate Test Cases" to start AI processing
4. **Review Results**: Comprehensive test cases generated with:
   - Proper Gherkin syntax (Given/When/Then)
   - Positive test scenarios
   - Negative test scenarios  
   - Edge case scenarios
   - Path coverage analysis
   - Complexity-based test depth

### 5. **Zephyr Scale Integration**

#### **Push Process**
1. **Pre-Push Review**: Review generated test cases before pushing
2. **Folder Organization**: Organize test cases in logical folder structures
3. **Batch Upload**: Push multiple test cases simultaneously
4. **Traceability Maintenance**: Automatic linking to source Jira tickets (if applicable)
5. **Status Tracking**: Monitor upload progress and success rates


## 📊 Understanding Complexity Analysis

### **Cyclomatic Complexity Formula**
For workflow-based requirements:
```
CC = E - N + 2P
```
Where:
- **E** = Edges (transitions between elements)
- **N** = Nodes (decision points + activities + events)  
- **P** = Components (typically 1 for single workflow)

For simple requirements:
```
CC = Decision Points + 1
```

### **Complexity Levels & Test Strategy**
- **CC 1-3 (Simple)**: Basic functionality, minimal branching
  - 2-3 test scenarios per requirement
  - Focus on happy path and basic error handling
- **CC 4-10 (Moderate)**: Some conditional logic
  - 4-6 test scenarios per requirement
  - Include boundary conditions and alternative flows
- **CC 11-20 (Complex)**: Multiple decision paths
  - 7-12 test scenarios per requirement
  - Comprehensive path coverage and edge cases
- **CC 21+ (Very Complex)**: Consider requirement refactoring
  - 15+ test scenarios may be needed
  - Focus on risk-based testing prioritization

### **Quality Metrics**
- **Confidence Score**: AI's confidence in requirement extraction (0-100%)
- **Testability Score**: How easily the requirement can be tested (0-100%)
- **Business Value**: Relevance to business objectives (High/Medium/Low)
- **Implementation Complexity**: Development effort estimation


## 🔍 API Documentation

### **Requirements Extraction**
```http
POST /api/extract-requirements
Content-Type: multipart/form-data

# Form data with file upload
file: [document file]
context: "additional domain context"
```

**Response:**
```json
{
  "success": true,
  "requirements": [
    {
      "id": "BR-001",
      "text": "The system shall support user authentication",
      "complexity": 3,
      "confidence": 95,
      "testability": 90,
      "category": "authentication"
    }
  ],
  "analysis": {
    "totalElements": 25,
    "qualityScore": 87,
    "processingTime": "2.3s"
  }
}
```

### **Test Case Generation**
```http
POST /api/generate-tests
Content-Type: application/json

{
  "requirements": [
    {
      "id": "BR-001", 
      "text": "User authentication requirement",
      "complexity": 3
    }
  ],
  "context": "E-commerce platform",
  "options": {
    "includeNegativeTests": true,
    "includeEdgeCases": true,
    "testDepth": "comprehensive"
  }
}
```

### **Jira Integration Endpoints**
```http
POST /api/jira/test-connection    # Test Jira credentials
GET  /api/jira/projects          # List available projects  
POST /api/jira/search-issues     # Search for specific issues
POST /api/jira/import-issues     # Import selected issues
```

### **Zephyr Scale Endpoints**
```http
POST /api/zephyr/test-connection # Test Zephyr credentials
GET  /api/zephyr/projects        # List available projects
GET  /api/zephyr/folders         # List project folders
POST /api/zephyr/push-tests      # Push test cases to Zephyr
```

## 🚨 Troubleshooting Guide

### **Common Issues & Solutions**

**Common Solutions:**
- Verify deployment name matches exactly (case-sensitive)
- Ensure API key has proper permissions
- Check if deployment is in the same region as resource
- Verify API version is supported

**Supported Formats:**
- PDF: Version 1.4+ recommended
- Word: .docx preferred over .doc
- Excel: .xlsx with data in first sheet
- Visio: .vsdx with flowchart content

**Common Solutions:**
- Regenerate API token if expired
- Verify email matches Atlassian account exactly
- Check project permissions for your account
- Ensure Jira instance URL is correct

#### **Memory and Performance Issues**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Monitor memory usage
node --inspect backend/index.js
```

**Optimization Tips:**
- Process large documents in smaller chunks
- Clear browser cache regularly
- Use latest Node.js LTS version
- Consider upgrading Azure OpenAI tier for better performance

### **Debug Mode**
Enable detailed logging by setting:
```env
NODE_ENV=development
DEBUG=klassijs:*
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### **Development Setup**
```bash
# Fork and clone the repository
git clone https://github.com/klassijs/klassijs-testgenie.git
cd klassijs-testgenie

# Install dependencies
pnpm install

# Create feature branch
git checkout -b feature/your-feature-name

# Start development servers
pnpm dev
```

### **Code Standards**
- **JavaScript**: ES6+ with async/await patterns
- **React**: Functional components with hooks
- **Styling**: CSS modules with responsive design
- **API**: RESTful endpoints with proper error handling
- **Testing**: Jest for unit tests

### **Pull Request Process**
1. Create feature branch from `develop`
2. Implement changes with proper documentation
3. Add tests for new functionality
4. Update README if needed
5. Submit PR with detailed description
6. Ensure all CI checks pass

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 👥 Team & Acknowledgments

### **Creator**
- **Larry Goddard** - [LinkedIn](https://linkedin.com/in/larryg) | [YouTube](https://youtube.com/@LarryG_01)

### **Contributors**
- **Carlos Bermejo** - [GitHub](https://github.com/carlosbermejop)
- **Arthur East** - [GitHub](https://github.com/arthureast)

### **Technology Stack**
- **Frontend**: React, Modern CSS, Responsive Design
- **Backend**: Node.js, Express, Multer for file uploads
- **AI**: Azure OpenAI GPT-4 with advanced prompt engineering
- **Integrations**: Jira Cloud API, Zephyr Scale API
- **Document Processing**: pdf-parse, mammoth, jszip for multi-format support

## 📞 Support & Community

- **GitHub Issues**: [Report bugs and request features](https://github.com/klassijs/klassijs-testgenie/issues)
- **YouTube Channel**: [Video tutorials and demos](https://youtube.com/@LarryG_01)

---

**🎯 Transform your testing workflow with AI-powered automation, enterprise-grade integrations, and intelligent requirement analysis.**
