const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractFileContent, processDocumentSections, isImageFile, isExcelFile, isPowerPointFile, isVisioFile } = require('../utils/fileProcessor');
const { generateTestCases, refineTestCases, extractBusinessRequirements, isAzureOpenAIConfigured } = require('../services/openaiService');
const { convertToZephyrFormat, pushToZephyr, getProjects, getTestFolders, getMainFolders, getSubfolders, searchFolders, isZephyrConfigured, discoverTraceabilityEndpoints, addJiraTicketToCoverage } = require('../services/zephyrService');
const { testJiraConnection, getJiraProjects, getJiraIssues, importJiraIssues, isJiraConfigured } = require('../services/jiraService');
const { generateWordDocument } = require('../utils/docxGenerator');
const { validateRequirementsQuality } = require('../utils/workflowAnalyzer');
const CacheManager = require('../utils/cacheManager');
const axios = require('axios'); // Added axios for the debug endpoint

const router = express.Router();

// Initialize cache manager
const cacheManager = new CacheManager();

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

    // First check for document-based cache (edited versions)
    const hasDocumentCache = await cacheManager.hasDocumentCachedResults(req.file.originalname, 'analysis');
    
    if (hasDocumentCache) {
      const startTime = Date.now();
      const documentCachedResults = await cacheManager.getDocumentCachedResults(req.file.originalname, 'analysis');
      if (documentCachedResults) {
        const cacheHitTime = Date.now() - startTime;
        return res.json({
          success: true,
          content: documentCachedResults.content,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          message: 'Document analyzed successfully (from edited cache)',
          cacheInfo: documentCachedResults._cacheInfo
        });
      }
    }

    // Fallback to hash-based cache
    const fileHash = cacheManager.generateFileHash(req.file.buffer);

    // Check if we have cached results
    const hasCached = await cacheManager.hasCachedResults(fileHash, req.file.originalname);
    
    const startTime = Date.now();
    const cachedResults = await cacheManager.getCachedResults(fileHash, req.file.originalname);
    if (cachedResults) {
      const cacheHitTime = Date.now() - startTime;
      return res.json({
        success: true,
        content: cachedResults.content,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        message: 'Document analyzed successfully (from cache)',
        cacheInfo: cachedResults._cacheInfo
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

    // Prepare results for caching
    const analysisResults = {
      content: content,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      processedAt: new Date().toISOString()
    };

    // Store results in cache (both hash-based and document-based)
    await cacheManager.storeCachedResults(fileHash, analysisResults, req.file.originalname);
    await cacheManager.storeDocumentCachedResults(req.file.originalname, 'analysis', analysisResults);

    res.json({
      success: true,
      content: content,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      message: 'Document analyzed successfully',
      cacheInfo: {
        hit: false,
        cached: true,
        hash: fileHash.substring(0, 8) + '...'
      }
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
    const { content, context = '', documentName = null } = req.body;

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

    // First check for document-based cache (edited versions)
    // Only use document-based cache if this appears to be full document content, not individual requirements
    // Individual requirements should use hash-based cache to ensure unique content per requirement
    if (documentName && !content.includes('REQUIREMENT TO TEST:')) {
      const hasDocumentCache = await cacheManager.hasDocumentCachedResults(documentName, 'tests');
      
      if (hasDocumentCache) {
        const documentCachedResults = await cacheManager.getDocumentCachedResults(documentName, 'tests');
        if (documentCachedResults) {
          return res.json({
            success: true,
            content: documentCachedResults.content,
            metadata: {
              originalContentLength: content.length,
              generatedContentLength: documentCachedResults.content.length,
              timestamp: new Date().toISOString(),
              fromCache: true,
              cacheType: 'document-based'
            },
            cacheInfo: documentCachedResults._cacheInfo
          });
        }
      }
    }

    // Fallback to hash-based cache
    const contentHash = cacheManager.generateContentHash(content, context);

    // Check if we have cached test results
    const cachedTestResults = await cacheManager.getCachedTestResults(contentHash, documentName);
    if (cachedTestResults) {
      return res.json({
        success: true,
        content: cachedTestResults.content,
        metadata: {
          originalContentLength: content.length,
          generatedContentLength: cachedTestResults.content.length,
          timestamp: new Date().toISOString(),
          fromCache: true
        },
        cacheInfo: cachedTestResults._cacheInfo
      });
    }
 
    const generatedTests = await generateTestCases(content, context);

    // Prepare test results for caching
    const testResults = {
      content: generatedTests,
      originalContentLength: content.length,
      generatedContentLength: generatedTests.length,
      context: context,
      processedAt: new Date().toISOString()
    };

    // Store test results in cache (both hash-based and document-based)
    await cacheManager.storeCachedTestResults(contentHash, testResults, content, documentName);
    // Only store in document-based cache if this is full document content, not individual requirements
    if (documentName && !content.includes('REQUIREMENT TO TEST:')) {
      await cacheManager.storeDocumentCachedResults(documentName, 'tests', testResults);
    }

    res.json({
      success: true,
      content: generatedTests,
      metadata: {
        originalContentLength: content.length,
        generatedContentLength: generatedTests.length,
        timestamp: new Date().toISOString(),
        fromCache: false
      },
      cacheInfo: {
        hit: false,
        cached: true,
        hash: contentHash.substring(0, 8) + '...'
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
    } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
      errorMessage = 'Rate limit exceeded';
      suggestion = 'Too many requests to the AI service. Please wait a few minutes and try again. The system will automatically retry with delays.';
      statusCode = 429;
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
    const { content, context = '', documentName = null } = req.body;

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

    // First check for document-based cache (edited versions)
    if (documentName) {
      const hasDocumentCache = await cacheManager.hasDocumentCachedResults(documentName, 'requirements');
      
      if (hasDocumentCache) {
        const documentCachedResults = await cacheManager.getDocumentCachedResults(documentName, 'requirements');
        if (documentCachedResults) {
          return res.json({
            success: true,
            content: documentCachedResults.content,
            message: 'Requirements extracted successfully (from edited cache)',
            metadata: {
              originalContentLength: content.length,
              extractedContentLength: documentCachedResults.content.length,
              timestamp: new Date().toISOString(),
              fromCache: true,
              cacheType: 'document-based'
            },
            cacheInfo: documentCachedResults._cacheInfo
          });
        }
      }
    }

    // Fallback to hash-based cache
    const contentHash = cacheManager.generateContentHash(content, context);

    // Check if we have cached requirements results
    const cachedRequirements = await cacheManager.getCachedTestResults(contentHash, documentName);
    if (cachedRequirements) {
      return res.json({
        success: true,
        content: cachedRequirements.content,
        message: cachedRequirements.message || 'Requirements extracted successfully (from cache)',
        metadata: {
          originalContentLength: content.length,
          extractedContentLength: cachedRequirements.content.length,
          timestamp: new Date().toISOString(),
          fromCache: true,
          cacheType: 'hash-based'
        },
        cacheInfo: cachedRequirements._cacheInfo
      });
    }

    const { enableLogging = true } = req.body;
    const extractedRequirements = await extractBusinessRequirements(content, context, enableLogging);

    // Prepare requirements results for caching
    const requirementsResults = {
      content: extractedRequirements.content,
      message: extractedRequirements.message,
      originalContentLength: content.length,
      extractedContentLength: extractedRequirements.content.length,
      context: context,
      enableLogging: enableLogging,
      processedAt: new Date().toISOString()
    };

    // Store requirements results in cache (both hash-based and document-based)
    await cacheManager.storeCachedTestResults(contentHash, requirementsResults, content, documentName);
    if (documentName) {
      await cacheManager.storeDocumentCachedResults(documentName, 'requirements', requirementsResults);
    }

    res.json({
      success: true,
      content: extractedRequirements.content,
      message: extractedRequirements.message,
      metadata: {
        originalContentLength: content.length,
        extractedContentLength: extractedRequirements.content.length,
        timestamp: new Date().toISOString(),
        fromCache: false
      },
      cacheInfo: {
        hit: false,
        cached: true,
        hash: contentHash.substring(0, 8) + '...'
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
    } else if (error.message.includes('429') || error.message.includes('Too many requests')) {
      errorMessage = 'Rate limit exceeded';
      suggestion = 'Too many requests to the AI service. Please wait a few minutes and try again. The system will automatically retry with delays.';
      statusCode = 429;
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
    const { content, featureName = 'Test Feature', projectKey, testCaseName, folderId, status = 'Draft', isAutomatable = 'None', jiraTicketKey = null, jiraBaseUrl = null } = req.body;

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

    const response = await pushToZephyr(content, featureName, projectKey, testCaseName, folderId, status, isAutomatable, jiraTicketKey, jiraBaseUrl);

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
        total: result.total,
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

// Clear Jira issues cache
router.delete('/jira/clear-cache', async (req, res) => {
  try {
    const { projectKey, issueTypes } = req.body;
    
    if (!projectKey || !issueTypes || issueTypes.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Project key and issue types are required',
        suggestion: 'Please provide project key and issue types to clear specific cache'
      });
    }

    const documentName = `jira-${projectKey}-${issueTypes.sort().join('-')}`;
    
    try {
      const results = await cacheManager.deleteMultipleDocuments([documentName]);
      if (results.deletedCount > 0) {
        res.json({
          success: true,
          message: `Cleared cache for project ${projectKey} with issue types: ${issueTypes.join(', ')}`
        });
      } else {
        res.json({
          success: true,
          message: `No cache found for project ${projectKey} with issue types: ${issueTypes.join(', ')}`
        });
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to clear cache',
        details: error.message
      });
    }

  } catch (error) {
    console.error('Error clearing Jira cache:', error);
    res.status(500).json({ 
      error: 'Failed to clear Jira cache',
      details: error.message
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


// Requirements validation endpoint
router.post('/validate-requirements', async (req, res) => {
  try {
    const { requirements } = req.body;
    
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid requirements',
        details: 'Requirements array is required and must not be empty',
        suggestion: 'Please provide a valid array of requirements to validate'
      });
    }

    // Validate requirements using the workflow analyzer
    const validation = validateRequirementsQuality(requirements);

    res.json({
      success: true,
      validation: validation,
      message: `Requirements validation completed. Overall score: ${validation.overallScore}%`
    });

  } catch (error) {
    console.error('Error validating requirements:', error);
    res.status(500).json({ 
      error: 'Failed to validate requirements',
      details: error.message,
      suggestion: 'Please check your requirements format and try again'
    });
  }
});

// Deterministic business element analysis endpoint
router.post('/analyze-business-elements', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid content',
        details: 'Content string is required',
        suggestion: 'Please provide the content to analyze'
      });
    }

    // Analyze content deterministically
          const { extractBusinessRequirements: universalExtract } = require('../utils/universalBusinessExtractor');
      const analysis = universalExtract(content, {
        minLineLength: 20,
        maxLineLength: 500,
        enableStrictMode: false,
        includeLowPriority: true
      });

    res.json({
      success: true,
      analysis: analysis,
      message: `Business element analysis completed. Found ${analysis.count} business elements.`,
      recommendation: `Based on this analysis, you should expect approximately ${analysis.count} business requirements to be generated.`
    });

  } catch (error) {
    console.error('Error analyzing business elements:', error);
    res.status(500).json({ 
      error: 'Failed to analyze business elements',
      details: error.message,
      suggestion: 'Please check your content format and try again'
    });
  }
});

// Cache management endpoints
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = await cacheManager.getCacheStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get cache statistics',
      details: error.message
    });
  }
});

router.delete('/cache/clear', async (req, res) => {
  try {
    await cacheManager.clearCache();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

router.delete('/cache/remove/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    await cacheManager.removeCachedFile(hash);
    res.json({
      success: true,
      message: `Cached file ${hash.substring(0, 8)}... removed successfully`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to remove cached file',
      details: error.message
    });
  }
});

// List all cached documents endpoint
router.get('/cache/list', async (req, res) => {
  try {
    const documents = await cacheManager.listCachedDocuments();
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list cached documents',
      details: error.message
    });
  }
});

// Delete multiple cached documents endpoint
router.delete('/cache/delete-multiple', async (req, res) => {
  try {
    const { documentNames } = req.body;
    
    if (!documentNames || !Array.isArray(documentNames) || documentNames.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid document names',
        details: 'Document names array is required'
      });
    }

    const results = await cacheManager.deleteMultipleDocuments(documentNames);
    
    // Check if any deletions failed
    if (results.failedCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Failed to delete ${results.failedCount} document(s)`,
        details: results.failedDocuments,
        results: results
      });
    }
    
    res.json({
      success: true,
      message: `Successfully deleted ${results.deletedCount} document(s)`,
      results: results
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete documents',
      details: error.message
    });
  }
});

// Save edited requirements endpoint
router.post('/save-edited-requirements', async (req, res) => {
  try {
    const { documentName, requirements } = req.body;

    if (!documentName || !requirements) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Document name and requirements content are required'
      });
    }

    // Store edited requirements in document-based cache
    await cacheManager.storeDocumentCachedResults(documentName, 'requirements', {
      content: requirements,
      originalContentLength: requirements.length,
      extractedContentLength: requirements.length,
      context: 'edited_by_user',
      processedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Edited requirements saved successfully',
      metadata: {
        documentName,
        contentLength: requirements.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error saving edited requirements:', error);
    res.status(500).json({
      error: 'Failed to save edited requirements',
      details: error.message
    });
  }
});

// Save edited tests endpoint
router.post('/save-edited-tests', async (req, res) => {
  try {
    const { documentName, tests } = req.body;

    if (!documentName || !tests) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Document name and tests content are required'
      });
    }

    // Store edited tests in document-based cache
    await cacheManager.storeDocumentCachedResults(documentName, 'tests', {
      content: tests,
      originalContentLength: tests.length,
      generatedContentLength: tests.length,
      context: 'edited_by_user',
      processedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Edited tests saved successfully',
      metadata: {
        documentName,
        contentLength: tests.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error saving edited tests:', error);
    res.status(500).json({
      error: 'Failed to save edited tests',
      details: error.message
    });
  }
});

// Pushed state cache endpoints

// Get pushed state for a document
router.get('/pushed-state/:documentName', async (req, res) => {
  try {
    const { documentName } = req.params;

    if (!documentName) {
      return res.status(400).json({
        error: 'Missing document name',
        details: 'Document name is required'
      });
    }

    const pushedState = await cacheManager.getPushedState(documentName);

    if (pushedState) {
      res.json({
        success: true,
        pushedState: pushedState,
        message: 'Pushed state retrieved successfully'
      });
    } else {
      res.json({
        success: true,
        pushedState: null,
        message: 'No pushed state found for this document'
      });
    }

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get pushed state',
      details: error.message
    });
  }
});

// Save pushed state for a document
router.post('/pushed-state/:documentName', async (req, res) => {
  try {
    const { documentName } = req.params;
    const { pushedTabs, zephyrTestCaseIds, jiraTicketInfo } = req.body;

    if (!documentName) {
      return res.status(400).json({
        error: 'Missing document name',
        details: 'Document name is required'
      });
    }

    const pushedState = {
      pushedTabs: pushedTabs || [],
      zephyrTestCaseIds: zephyrTestCaseIds || {},
      jiraTicketInfo: jiraTicketInfo || {},
      timestamp: new Date().toISOString()
    };

    await cacheManager.storePushedState(documentName, pushedState);

    res.json({
      success: true,
      message: 'Pushed state saved successfully',
      metadata: {
        documentName,
        pushedTabsCount: pushedTabs?.length || 0,
        testCaseIdsCount: Object.keys(zephyrTestCaseIds || {}).length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error saving pushed state:', error);
    res.status(500).json({
      error: 'Failed to save pushed state',
      details: error.message
    });
  }
});

// Clear pushed state for a document
router.delete('/pushed-state/:documentName', async (req, res) => {
  try {
    const { documentName } = req.params;

    if (!documentName) {
      return res.status(400).json({
        error: 'Missing document name',
        details: 'Document name is required'
      });
    }

    await cacheManager.clearPushedState(documentName);

    res.json({
      success: true,
      message: 'Pushed state cleared successfully',
      metadata: {
        documentName,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error clearing pushed state:', error);
    res.status(500).json({
      error: 'Failed to clear pushed state',
      details: error.message
    });
  }
});

// Get all pushed states
router.get('/pushed-states', async (req, res) => {
  try {
    const allPushedStates = await cacheManager.getAllPushedStates();

    res.json({
      success: true,
      pushedStates: allPushedStates,
      message: `Found ${allPushedStates.length} documents with pushed state`,
      metadata: {
        count: allPushedStates.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting all pushed states:', error);
    res.status(500).json({
      error: 'Failed to get pushed states',
      details: error.message
    });
  }
});

module.exports = router; 
