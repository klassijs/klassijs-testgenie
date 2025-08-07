const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractFileContent, processDocumentSections, isImageFile, isExcelFile, isPowerPointFile, isVisioFile } = require('../utils/fileProcessor');
const { generateTestCases, refineTestCases, isAzureOpenAIConfigured } = require('../services/openaiService');
const { convertToZephyrFormat, pushToZephyr, getProjects, getTestFolders, isZephyrConfigured } = require('../services/zephyrService');
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
      console.log(`File accepted: ${file.originalname} (MIME: ${mimeType}, Ext: ${extension})`);
      cb(null, true);
    } else {
      console.log(`File rejected: ${file.originalname} (MIME: ${mimeType}, Ext: ${extension})`);
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
    
    console.log(`Found ${imageFiles.length} loading images:`, imageFiles);
    
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
    
    console.log(`Document analysis result for ${req.file.originalname}:`, {
      contentLength: content.length,
      contentPreview: content.substring(0, 300) + '...'
    });
    
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

// Debug endpoint to test Zephyr Scale connectivity
router.get('/zephyr-debug', async (req, res) => {
  try {
    console.log('=== ZEPHYR DEBUG ENDPOINT CALLED ===');
    console.log('Testing Zephyr Scale API connectivity...');
    
    // Test projects endpoint
    console.log('Testing /projects endpoint...');
    const projectsResponse = await axios.get(`${ZEPHYR_BASE_URL}/projects`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Projects response:', JSON.stringify(projectsResponse.data, null, 2));
    
    // Test folders endpoint for QAE project
    console.log('Testing /folders endpoint for QAE project...');
    const foldersResponse = await axios.get(`${ZEPHYR_BASE_URL}/folders`, {
      headers: {
        'Authorization': `Bearer ${ZEPHYR_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        projectKey: 'QAE'
      }
    });
    console.log('Folders response:', JSON.stringify(foldersResponse.data, null, 2));
    
    res.json({
      success: true,
      message: 'Zephyr Scale API connectivity test completed',
      projects: projectsResponse.data,
      folders: foldersResponse.data,
      qaeFolders: await getTestFolders('QAE'),
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Zephyr debug error:', error);
    res.status(500).json({
      error: 'Zephyr Scale API connectivity test failed',
      details: error.message,
      response: error.response?.data
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

// Zephyr Scale Direct Push endpoint
router.post('/push-to-zephyr', async (req, res) => {
  try {
    const { content, featureName = 'Test Feature', projectKey, testCaseName, folderId, status = 'Draft', isAutomatable = 'None' } = req.body;

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

    const result = await pushToZephyr(content, featureName, projectKey, testCaseName, folderId, status, isAutomatable);

    res.json(result);

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

module.exports = router; 