const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractFileContent, processDocumentSections, isImageFile, isExcelFile, isPowerPointFile, isVisioFile } = require('../utils/fileProcessor');
const { generateTestCases, refineTestCases, extractBusinessRequirements, isAzureOpenAIConfigured } = require('../services/openaiService');
const { convertToZephyrFormat, pushToZephyr, getProjects, getTestFolders, getMainFolders, getSubfolders, searchFolders, isZephyrConfigured, discoverTraceabilityEndpoints, addJiraTicketToCoverage } = require('../services/zephyrService');
const { testJiraConnection, getJiraProjects, getJiraIssues, importJiraIssues, isJiraConfigured } = require('../services/jiraService');
const { generateWordDocument } = require('../utils/docxGenerator');
const axios = require('axios'); // Added axios for the debug endpoint

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const mimeType = file.mimetype;
    const extension = path.extname(file.originalname).toLowerCase();
    
    // Check if file type is supported
    const isSupported = 
      mimeType === 'application/pdf' ||
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      mimeType === 'application/rtf' ||
      mimeType === 'application/vnd.oasis.opendocument.text' ||
      isImageFile(mimeType, extension) ||
      isExcelFile(mimeType, extension) ||
      isPowerPointFile(mimeType, extension) ||
      isVisioFile(mimeType, extension);

    if (isSupported) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only PDF, DOCX, DOC, TXT, MD, RTF, ODT, images (JPG, PNG, GIF, etc.), Excel (XLS, XLSX), PowerPoint (PPT, PPTX), and Visio (VSD, VSDX) files are allowed.`), false);
    }
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      azureOpenAI: isAzureOpenAIConfigured ? 'configured' : 'not configured',
      zephyrScale: isZephyrConfigured ? 'configured' : 'not configured'
    }
  });
});

// Get loading images endpoint
router.get('/loading-images', (req, res) => {
  try {
    const loadingImagesPath = path.join(__dirname, '../../frontend/public/images/loading');
    
    // Check if directory exists
    if (!fs.existsSync(loadingImagesPath)) {
      return res.json({
        success: true,
        images: [],
        message: 'No loading images directory found'
      });
    }
    
    // Read all files in the loading directory
    const files = fs.readdirSync(loadingImagesPath);
    
    // Filter for image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    // Create image steps with default titles
    const imageSteps = imageFiles.map((file, index) => {
      const stepTitles = [
        'Analyzing Requirements',
        'Creating Test Scenarios', 
        'Adding Edge Cases',
        'Generating Negative Tests',
        'Finalizing Test Cases',
        'Validating Test Coverage',
        'Optimizing Test Cases',
        'Preparing Test Suite'
      ];
      
      return {
        image: file,
        title: stepTitles[index] || `Step ${index + 1}`
      };
    });
    

    
    res.json({
      success: true,
      images: imageSteps,
      message: `Found ${imageFiles.length} loading images`
    });
    
  } catch (error) {
    console.error('Error scanning loading images:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan loading images',
      details: error.message
    });
  }
});

// Document analysis endpoint
router.post('/analyze-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        details: 'Please upload a document to analyze',
        suggestion: 'Select a file and try again'
      });
    }

    const content = await extractFileContent(req.file);
    

    
    if (!content || content.trim().length < 10) {
      return res.status(400).json({
        error: 'Unable to extract content',
        details: 'The uploaded file could not be processed or contains insufficient content',
        suggestion: 'Try uploading a different file with more readable content'
      });
    }

    res.json({
      success: true,
      content: content,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Document analyzed successfully'
    });

  } catch (error) {
    console.error('Error analyzing document:', error);
    
    let errorMessage = 'Failed to analyze document';
    let suggestion = 'Please try again with a different file';
    
    if (error.message.includes('Unsupported file type')) {
      errorMessage = 'Unsupported file type';
      suggestion = 'Please upload a supported file format';
    } else if (error.message.includes('Invalid file type')) {
      errorMessage = 'Invalid file type';
      suggestion = 'Please upload a supported file format';
    }
    
    res.status(400).json({
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Test generation endpoint
router.post('/generate-tests', async (req, res) => {
  try {
    const { content, context = '' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No content provided for test generation',
        suggestion: 'Please provide valid content to generate test cases'
      });
    }

    if (content.trim().length < 10) {
      return res.status(400).json({
        error: 'Insufficient content',
        details: 'The provided content is too short to generate meaningful test cases',
        suggestion: 'Please provide more detailed content for test generation'
      });
    }

    const generatedTests = await generateTestCases(content, context);

    res.json({
      success: true,
      content: generatedTests,
      metadata: {
        originalContentLength: content.length,
        generatedContentLength: generatedTests.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating tests:', error);
    
    let errorMessage = 'Failed to generate test cases';
    let suggestion = 'Please try again with valid content';
    let statusCode = 503;
    
    if (error.message.includes('Azure OpenAI is not configured')) {
      errorMessage = 'Test generation service unavailable';
      suggestion = 'Please configure Azure OpenAI credentials to generate test cases';
    } else if (error.message.includes('Content was filtered by Azure OpenAI safety filters')) {
      errorMessage = 'Content flagged by safety filters';
      suggestion = 'The document contains content that was flagged by AI safety filters. Please try uploading a different document or contact your administrator if you believe this is an error.';
      statusCode = 400;
    } else if (error.message.includes('No content received from Azure OpenAI')) {
      errorMessage = 'No response from AI service';
      suggestion = 'The AI service did not return any content. Please try again or contact support if the issue persists.';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Test refinement endpoint
router.post('/refine-tests', async (req, res) => {
  try {
    const { content, feedback, context = '' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No test content provided for refinement',
        suggestion: 'Please provide valid test content to refine'
      });
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        error: 'Missing feedback',
        details: 'No feedback provided for test refinement',
        suggestion: 'Please provide feedback to refine the test cases'
      });
    }

    const refinedTests = await refineTestCases(content, feedback, context);

    res.json({
      success: true,
      content: refinedTests,
      metadata: {
        originalContentLength: content.length,
        refinedContentLength: refinedTests.length,
        feedback: feedback,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error refining tests:', error);
    
    let errorMessage = 'Failed to refine test cases';
    let suggestion = 'Please try again with valid content and feedback';
    let statusCode = 503;
    
    if (error.message.includes('Azure OpenAI is not configured')) {
      errorMessage = 'Test refinement service unavailable';
      suggestion = 'Please configure Azure OpenAI credentials to refine test cases';
    } else if (error.message.includes('Content was filtered by Azure OpenAI safety filters')) {
      errorMessage = 'Content flagged by safety filters';
      suggestion = 'The test content contains material that was flagged by AI safety filters. Please try refining with different content or contact your administrator if you believe this is an error.';
      statusCode = 400;
    } else if (error.message.includes('No content received from Azure OpenAI')) {
      errorMessage = 'No response from AI service';
      suggestion = 'The AI service did not return any content. Please try again or contact support if the issue persists.';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Requirements extraction endpoint
router.post('/extract-requirements', async (req, res) => {
  try {
    const { content, context = '' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No content provided for requirements extraction',
        suggestion: 'Please provide valid content to extract requirements'
      });
    }

    if (content.trim().length < 50) {
      return res.status(400).json({
        error: 'Insufficient content',
        details: 'The provided content is too short to extract meaningful requirements',
        suggestion: 'Please provide more detailed content for requirements extraction'
      });
    }

    const extractedRequirements = await extractBusinessRequirements(content, context);

    res.json({
      success: true,
      content: extractedRequirements.content,
      message: extractedRequirements.message,
      metadata: {
        originalContentLength: content.length,
        extractedContentLength: extractedRequirements.content.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error extracting requirements:', error);
    
    let errorMessage = 'Failed to extract business requirements';
    let suggestion = 'Please try again with valid content';
    let statusCode = 503;
    
    if (error.message.includes('Azure OpenAI is not configured')) {
      errorMessage = 'Requirements extraction service unavailable';
      suggestion = 'Please configure Azure OpenAI credentials to extract requirements';
    } else if (error.message.includes('Content was filtered by Azure OpenAI safety filters')) {
      errorMessage = 'Content flagged by safety filters';
      suggestion = 'The document contains content that was flagged by AI safety filters. Please try uploading a different document or contact your administrator if you believe this is an error.';
      statusCode = 400;
    } else if (error.message.includes('context_length_exceeded') || error.message.includes('maximum context length')) {
      errorMessage = 'Document too large for processing';
      suggestion = 'The document is very large. The system will process the first portion. For complete analysis of large documents, consider splitting into smaller files or uploading sections separately.';
      statusCode = 400;
    } else if (error.message.includes('No content received from Azure OpenAI')) {
      errorMessage = 'No response from AI service';
      suggestion = 'The AI service did not return any content. Please try again or contact support if the issue persists.';
    }
    
    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Word document generation endpoint
router.post('/generate-word-doc', async (req, res) => {
  try {
    const { content, title = 'Business Requirements' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No content provided for Word document generation',
        suggestion: 'Please provide valid content to generate Word document'
      });
    }

    const docBuffer = await generateWordDocument(content, title);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`,
      'Content-Length': docBuffer.length
    });

    res.send(docBuffer);

  } catch (error) {
    console.error('Error generating Word document:', error);
    
    res.status(500).json({ 
      error: 'Failed to generate Word document',
      details: error.message,
      suggestion: 'Please try again with valid content'
    });
  }
});

// Zephyr Scale Export endpoint
router.post('/export-zephyr', async (req, res) => {
  try {
    const { content, featureName = 'Test Feature' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No test content provided for export',
        suggestion: 'Please provide valid test content to export'
      });
    }

    const zephyrContent = convertToZephyrFormat(content, featureName);

    res.json({
      success: true,
      zephyrContent: zephyrContent,
      metadata: {
        originalContentLength: content.length,
        zephyrContentLength: zephyrContent.length,
        featureName: featureName,
        exportFormat: 'Zephyr Scale BDD-Gherkin Script',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error exporting to Zephyr Scale:', error);
    
    res.status(500).json({ 
      error: 'Failed to export to Zephyr Scale format',
      details: error.message,
      suggestion: 'Please try again with valid test content'
    });
  }
});

// Get Zephyr Scale projects
router.get('/zephyr-projects', async (req, res) => {
  try {
    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable project listing'
      });
    }

    const projects = await getProjects();

    res.json({
      success: true,
      projects: projects,
      metadata: {
        count: projects.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching Zephyr Scale projects:', error);
    
    let errorMessage = 'Failed to fetch projects from Zephyr Scale';
    let suggestion = 'Please check your Zephyr Scale credentials and try again';
    
    if (error.response) {
      // Zephyr Scale API error
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});



// Get Zephyr Scale test folders for a project
router.get('/zephyr-folders/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;

    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable folder listing'
      });
    }

    if (!projectKey) {
      return res.status(400).json({
        error: 'Missing project key',
        details: 'Project key is required to fetch test folders',
        suggestion: 'Please provide a valid project key'
      });
    }

    const folders = await getTestFolders(projectKey);

    res.json({
      success: true,
      folders: folders,
      projectKey: projectKey,
      metadata: {
        count: folders.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching Zephyr Scale folders:', error);
    
    let errorMessage = 'Failed to fetch folders from Zephyr Scale';
    let suggestion = 'Please check your Zephyr Scale credentials and try again';
    
    if (error.response) {
      // Zephyr Scale API error
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Get main folders (top-level folders) for a project
router.get('/zephyr-main-folders/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;

    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable folder listing'
      });
    }

    if (!projectKey) {
      return res.status(400).json({
        error: 'Missing project key',
        details: 'Project key is required to fetch main folders',
        suggestion: 'Please provide a valid project key'
      });
    }

    const mainFolders = await getMainFolders(projectKey);

    res.json({
      success: true,
      folders: mainFolders,
      projectKey: projectKey,
      metadata: {
        count: mainFolders.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching Zephyr Scale main folders:', error);
    
    let errorMessage = 'Failed to fetch main folders from Zephyr Scale';
    let suggestion = 'Please check your Zephyr Scale credentials and try again';
    
    if (error.response) {
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Get subfolders for a specific parent folder
router.get('/zephyr-subfolders/:projectKey/:parentFolderId', async (req, res) => {
  try {
    const { projectKey, parentFolderId } = req.params;

    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable folder listing'
      });
    }

    if (!projectKey) {
      return res.status(400).json({
        error: 'Missing project key',
        details: 'Project key is required to fetch subfolders',
        suggestion: 'Please provide a valid project key'
      });
    }

    if (!parentFolderId) {
      return res.status(400).json({
        error: 'Missing parent folder ID',
        details: 'Parent folder ID is required to fetch subfolders',
        suggestion: 'Please provide a valid parent folder ID'
      });
    }

    const subfolders = await getSubfolders(projectKey, parentFolderId);

    res.json({
      success: true,
      folders: subfolders,
      projectKey: projectKey,
      parentFolderId: parentFolderId,
      metadata: {
        count: subfolders.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching Zephyr Scale subfolders:', error);
    
    let errorMessage = 'Failed to fetch subfolders from Zephyr Scale';
    let suggestion = 'Please check your Zephyr Scale credentials and try again';
    
    if (error.response) {
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Search folders across all levels
router.get('/zephyr-search-folders/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;
    const { searchTerm } = req.query;

    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable folder search'
      });
    }

    if (!projectKey) {
      return res.status(400).json({
        error: 'Missing project key',
        details: 'Project key is required to search folders',
        suggestion: 'Please provide a valid project key'
      });
    }

    if (!searchTerm) {
      return res.status(400).json({
        error: 'Missing search term',
        details: 'Search term is required to search folders',
        suggestion: 'Please provide a search term'
      });
    }

    const searchResults = await searchFolders(projectKey, searchTerm);

    res.json({
      success: true,
      folders: searchResults,
      projectKey: projectKey,
      searchTerm: searchTerm,
      metadata: {
        count: searchResults.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error searching Zephyr Scale folders:', error);
    
    let errorMessage = 'Failed to search folders from Zephyr Scale';
    let suggestion = 'Please check your Zephyr Scale credentials and try again';
    
    if (error.response) {
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Zephyr Scale Direct Push endpoint
router.post('/push-to-zephyr', async (req, res) => {
  try {
    const { content, featureName = 'Test Feature', projectKey, testCaseName, folderId, status = 'Draft', isAutomatable = 'None', testCaseIds = null, jiraTicketKey = null, jiraBaseUrl = null } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        error: 'Missing content',
        details: 'No test content provided for push',
        suggestion: 'Please provide valid test content to push to Zephyr Scale'
      });
    }

    if (!isZephyrConfigured) {
      return res.status(503).json({
        error: 'Zephyr Scale integration not configured',
        details: 'Missing Zephyr Scale credentials. Please configure ZEPHYR_BASE_URL, ZEPHYR_API_TOKEN, and ZEPHYR_PROJECT_KEY in your .env file.',
        suggestion: 'Set up Zephyr Scale credentials to enable direct push functionality'
      });
    }

    const response = await pushToZephyr(content, featureName, projectKey, testCaseName, folderId, status, isAutomatable, testCaseIds, jiraTicketKey, jiraBaseUrl);

    if (!response.success) {
      return res.status(400).json({
        error: 'Failed to push to Zephyr Scale',
        details: response.error,
        suggestion: 'Please try again with valid test content'
      });
    }

    // Extract test case key from the response structure
    let testCaseKey = null;
    let testCaseId = null;
    
    if (response.createdTestCases && response.createdTestCases.length > 0) {
      testCaseKey = response.createdTestCases[0].key;
      testCaseId = response.createdTestCases[0].id;
    } else if (response.zephyrTestCaseId) {
      testCaseKey = response.zephyrTestCaseId;
    }

    // Get folder details for response
    let folderName = null;
    if (folderId) {
      try {
        const folderResponse = await axios.get(`${process.env.ZEPHYR_BASE_URL}/folders/${folderId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        folderName = folderResponse.data.name;
      } catch (error) {
        console.error('Error fetching folder details:', error.message);
      }
    }

    res.json({
      success: true,
      message: `Test case "${testCaseName}" pushed to Zephyr Scale successfully!`,
      testCaseKey: testCaseKey || 'Unknown',
      testCaseId: testCaseId || 'Unknown',
      folderName: folderName,
      jiraTraceability: response.jiraTraceability || null
    });

  } catch (error) {
    console.error('Error pushing to Zephyr Scale:', error);
    
    let errorMessage = 'Failed to push to Zephyr Scale';
    let suggestion = 'Please try again with valid test content';
    
    if (error.response) {
      // Zephyr Scale API error
      errorMessage = `Zephyr Scale API Error: ${error.response.status}`;
      suggestion = 'Please check your Zephyr Scale credentials and project configuration';
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error connecting to Zephyr Scale';
      suggestion = 'Please check your Zephyr Scale URL and network connection';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message,
      suggestion: suggestion
    });
  }
});

// Discover available Zephyr Scale traceability endpoints
router.get('/zephyr/discover-endpoints/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;
    
    if (!projectKey) {
      return res.status(400).json({ error: 'Project key is required' });
    }

    const result = await discoverTraceabilityEndpoints(projectKey);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Endpoint discovery completed',
        projectKey,
        endpoints: result.endpoints
      });
    } else {
      res.status(500).json({
        error: 'Failed to discover endpoints',
        details: result.error
      });
    }

  } catch (error) {
    console.error('Error discovering Zephyr endpoints:', error);
    res.status(500).json({ 
      error: 'Failed to discover endpoints',
      details: error.message
    });
  }
});

// Test Zephyr Scale traceability endpoints
router.get('/zephyr/test-endpoints/:projectKey', async (req, res) => {
  try {
    const { projectKey } = req.params;
    
    if (!projectKey) {
      return res.status(400).json({ error: 'Project key is required' });
    }

    console.log('🔍 Testing available endpoints for project:', projectKey);
    
    // Test common endpoint patterns
    const testEndpoints = [
      { name: 'testcases', url: `${process.env.ZEPHYR_BASE_URL}/testcases`, method: 'GET' },
      { name: 'folders', url: `${process.env.ZEPHYR_BASE_URL}/folders`, method: 'GET' },
      { name: 'coverage', url: `${process.env.ZEPHYR_BASE_URL}/coverage`, method: 'GET' },
      { name: 'traceability', url: `${process.env.ZEPHYR_BASE_URL}/traceability`, method: 'GET' },
      { name: 'issues', url: `${process.env.ZEPHYR_BASE_URL}/issues`, method: 'GET' },
      { name: 'links', url: `${process.env.ZEPHYR_BASE_URL}/links`, method: 'GET' },
      { name: 'weblinks', url: `${process.env.ZEPHYR_BASE_URL}/weblinks`, method: 'GET' },
      { name: 'comments', url: `${process.env.ZEPHYR_BASE_URL}/comments`, method: 'GET' }
    ];
    
    const results = [];
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: endpoint.url,
          headers: {
            'Authorization': `Bearer ${process.env.ZEPHYR_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: { projectKey, maxResults: 1 }
        });
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: response.status,
          available: true,
          data: response.data
        });
        
      } catch (error) {
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          status: error.response?.status,
          available: false,
          error: error.response?.data?.message || error.message
        });
      }
    }
    
    console.log('🔍 Endpoint test results:', results);
    
    res.json({
      success: true,
      message: 'Endpoint discovery completed',
      projectKey,
      results
    });

  } catch (error) {
    console.error('Error testing Zephyr endpoints:', error);
    res.status(500).json({ 
      error: 'Failed to test endpoints',
      details: error.message
    });
  }
});

// Jira Import endpoints

// Test Jira connection
router.post('/jira/test-connection', async (req, res) => {
  try {
    const result = await testJiraConnection();

    if (result.success) {
      // Get projects after successful connection
      const projectsResult = await getJiraProjects();
      
      res.json({
        success: true,
        message: result.message,
        user: result.user,
        projects: projectsResult.success ? projectsResult.projects : [],
        jiraBaseUrl: process.env.JIRA_BASE_URL // Pass Jira base URL to frontend
      });
    } else {
      res.status(400).json({
        error: 'Jira connection failed',
        details: result.error,
        suggestion: 'Please check your Jira environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)'
      });
    }

  } catch (error) {
    console.error('Error testing Jira connection:', error);
    res.status(500).json({ 
      error: 'Failed to test Jira connection',
      details: error.message,
      suggestion: 'Please check your network connection and try again'
    });
  }
});

// Fetch Jira issues
router.post('/jira/fetch-issues', async (req, res) => {
  try {
    const { projectKey, issueTypes } = req.body;

    if (!projectKey || !issueTypes || issueTypes.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Project key and issue types are required',
        suggestion: 'Please provide project key and select issue types'
      });
    }

    const result = await getJiraIssues(projectKey, issueTypes);

    if (result.success) {
      res.json({
        success: true,
        issues: result.issues,
        message: `Found ${result.issues.length} issues in project ${projectKey}`
      });
    } else {
      res.status(400).json({
        error: 'Failed to fetch Jira issues',
        details: result.error,
        suggestion: 'Please check your project key and issue types'
      });
    }

  } catch (error) {
    console.error('Error fetching Jira issues:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Jira issues',
      details: error.message,
      suggestion: 'Please check your network connection and try again'
    });
  }
});

// Import Jira issues
router.post('/jira/import-issues', async (req, res) => {
  try {
    const { selectedIssues } = req.body;
    
    if (!selectedIssues || selectedIssues.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Selected issues are required',
        suggestion: 'Please select issues to import'
      });
    }

    const result = await importJiraIssues(selectedIssues);

    if (result.success) {
      res.json({
        success: true,
        features: result.features,
        message: result.message
      });
    } else {
      res.status(400).json({
        error: 'Failed to import Jira issues',
        details: result.error,
        suggestion: 'Please check your selected issues and try again'
      });
    }

  } catch (error) {
    console.error('Error importing Jira issues:', error);
    res.status(500).json({ 
      error: 'Failed to import Jira issues',
      details: error.message,
      suggestion: 'Please check your network connection and try again'
    });
  }
});

module.exports = router; 