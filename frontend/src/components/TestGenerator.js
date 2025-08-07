import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Copy, Download, RefreshCw, AlertCircle, CheckCircle, TestTube, Upload, FileText, X, ExternalLink, XCircle, Trash2, Edit, Zap } from 'lucide-react';
import axios from 'axios';
import TestOutput from './TestOutput';

const TestGenerator = () => {
  // File input reference
  const fileInputRef = useRef(null);
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [generatedTests, setGeneratedTests] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [activeTab, setActiveTab] = useState(0);
  const [featureTabs, setFeatureTabs] = useState([]);
  const [editableFeatures, setEditableFeatures] = useState({});
  const [editingFeatures, setEditingFeatures] = useState({});
  // Zephyr Scale configuration state
  const [showZephyrConfig, setShowZephyrConfig] = useState(false);
  const [zephyrConfig, setZephyrConfig] = useState({
    projectKey: '',
    testCaseName: '',
    folderId: '',
    status: 'Draft',
    isAutomatable: 'None'
  });
  const [zephyrProjects, setZephyrProjects] = useState([]);
  const [zephyrFolders, setZephyrFolders] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [folderSearch, setFolderSearch] = useState('');
  
  // Zephyr push progress state
  const [showZephyrProgress, setShowZephyrProgress] = useState(false);
  const [zephyrProgress, setZephyrProgress] = useState({
    current: 0,
    total: 0,
    message: '',
    status: 'idle' // idle, pushing, success, error
  });
  
  // Track which tabs have been pushed to Zephyr
  const [pushedTabs, setPushedTabs] = useState(new Set());
  
  // Track Zephyr test case IDs for each tab (array of IDs since each scenario = 1 test case)
  const [zephyrTestCaseIds, setZephyrTestCaseIds] = useState({});

  // Jira import state
  const [showJiraImport, setShowJiraImport] = useState(false);
  const [jiraConfig, setJiraConfig] = useState({
    projectKey: '',
    issueTypes: [],
    selectedIssues: []
  });
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraIssues, setJiraIssues] = useState([]);
  const [isLoadingJira, setIsLoadingJira] = useState(false);
  const [jiraStep, setJiraStep] = useState('connect'); // connect, select, import
  const [showJiraProjectDropdown, setShowJiraProjectDropdown] = useState(false);

  // API base URL - can be configured via environment variable
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Jira import functions
  const testJiraConnection = async () => {
    setIsLoadingJira(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/jira/test-connection`);

      if (response.data.success) {
        setJiraProjects(response.data.projects || []);
        setJiraStep('select');
        setStatus({ type: 'success', message: 'Successfully connected to Jira!' });
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Failed to connect to Jira' });
      }
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to connect to Jira. Please check your environment configuration.' 
      });
    } finally {
      setIsLoadingJira(false);
    }
  };

  const fetchJiraIssues = async () => {
    setIsLoadingJira(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/jira/fetch-issues`, {
        projectKey: jiraConfig.projectKey,
        issueTypes: jiraConfig.issueTypes
      });

      if (response.data.success) {
        setJiraIssues(response.data.issues || []);
        setJiraStep('import');
        setStatus({ type: 'success', message: `Found ${response.data.issues.length} issues in Jira` });
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Failed to fetch Jira issues' });
      }
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch Jira issues' 
      });
    } finally {
      setIsLoadingJira(false);
    }
  };

  const importJiraIssues = async () => {
    setIsLoadingJira(true);
    try {
      console.log('Frontend: Sending import request with selectedIssues:', jiraConfig.selectedIssues);
      
      const response = await axios.post(`${API_BASE_URL}/api/jira/import-issues`, {
        selectedIssues: jiraConfig.selectedIssues
      });

      console.log('Frontend: Import response:', response.data);

      if (response.data.success) {
        // Convert imported issues to feature tabs
        const importedFeatures = response.data.features.map((feature, index) => ({
          title: feature.title,
          content: feature.content,
          id: `jira-import-${index}`
        }));

        setFeatureTabs(importedFeatures);
        setEditableFeatures({});
        setEditingFeatures({});
        setActiveTab(0);
        setShowJiraImport(false);
        setStatus({ type: 'success', message: `Successfully imported ${importedFeatures.length} test cases from Jira!` });
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Failed to import Jira issues' });
      }
    } catch (error) {
      console.error('Frontend: Import error:', error.response?.data);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to import Jira issues' 
      });
    } finally {
      setIsLoadingJira(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFolderDropdown && !event.target.closest('.folder-dropdown-container')) {
        setShowFolderDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFolderDropdown]);

  // File upload handlers
  const processFile = useCallback(async (fileObj) => {
    setIsProcessing(true);
    setProcessingFile(fileObj.name);
    setStatus({ type: 'info', message: `Processing ${fileObj.name}...` });

    try {
      const formData = new FormData();
      // Handle both file and file.file cases
      const fileToUpload = fileObj.file || fileObj;
      formData.append('file', fileToUpload);

      const response = await axios.post(`${API_BASE_URL}/api/analyze-document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const sections = processDocumentSections(response.data.content, fileObj.name);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileObj.id 
              ? { ...f, status: 'completed', content: response.data.content, sections: sections }
              : f
          )
        );
        
        // Create feature tabs from sections immediately
        if (sections.length > 0) {
          const newFeatures = sections.map(section => ({
            title: section.title,
            content: section.content,
            originalContent: section.content
          }));
          
          // Add new features to existing tabs
          setFeatureTabs(prev => {
            const updatedTabs = [...prev, ...newFeatures];
            return updatedTabs;
          });
          
          // Initialize editable features for new sections
          setEditableFeatures(prev => {
            const editableFeaturesObj = {};
            newFeatures.forEach((feature, index) => {
              const globalIndex = (prev?.length || 0) + index;
              editableFeaturesObj[globalIndex] = feature.content;
            });
            return { ...prev, ...editableFeaturesObj };
          });
          
          setStatus({ type: 'success', message: `Successfully processed ${fileObj.name} and created ${sections.length} features!` });
        } else {
          setStatus({ type: 'success', message: `Successfully processed ${fileObj.name}!` });
        }
      } else {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileObj.id 
              ? { ...f, status: 'failed', error: response.data.error }
              : f
          )
        );
        setStatus({ type: 'error', message: `Failed to process ${fileObj.name}: ${response.data.error}` });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'failed', error: error.message }
            : f
        )
      );
      setStatus({ type: 'error', message: `Failed to process ${fileObj.name}: ${error.message}` });
    } finally {
      setIsProcessing(false);
      setProcessingFile(null);
    }
  }, [API_BASE_URL, context]);

  // Function to process document content into sections
  const processDocumentSections = (content, fileName) => {
    const lines = content.split('\n');
    
    const sections = [];
    let currentSection = '';
    let currentSectionTitle = '';

    // Enhanced section detection patterns
    const sectionPatterns = [
      /^#+\s+(.+)$/, // Markdown headers
      /^(.+):\s*$/, // Lines ending with colon
      /^(.+)\s*[-–—]\s*$/, // Lines with dashes
      /^(.+)\s*[=]{3,}$/, // Lines with equals signs
      /^(.+)\s*[-]{3,}$/, // Lines with dashes
      /^[A-Z][A-Z\s]+$/, // ALL CAPS lines (potential headers)
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/, // Title Case lines
      /^[0-9]+\.\s+(.+)$/, // Numbered sections
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*[-–—]\s*$/, // Title with dashes
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*[:]\s*$/, // Title with colon
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line is a section header
      let isHeader = false;
      let headerText = '';
      
      for (const pattern of sectionPatterns) {
        const match = line.match(pattern);
        if (match && line.length > 3 && line.length < 100) { // Reasonable header length
          isHeader = true;
          headerText = match[1] || line;
          break;
        }
      }
      
      // Additional checks for potential headers
      if (!isHeader && line.length > 5 && line.length < 80) {
        // Check for lines that might be headers based on context
        const nextLine = lines[i + 1]?.trim() || '';
        const prevLine = lines[i - 1]?.trim() || '';
        
        // If line is followed by empty line or different content, it might be a header
        if ((nextLine === '' || nextLine.startsWith('  ') || nextLine.startsWith('\t')) && 
            (prevLine === '' || prevLine.endsWith('.') || prevLine.endsWith(':'))) {
          isHeader = true;
          headerText = line;
        }
      }
      
      if (isHeader) {
        // Save previous section if exists
        if (currentSection.trim()) {
          sections.push({
            title: currentSectionTitle || `Feature ${sections.length + 1}`,
            content: currentSection.trim()
          });
        }
        
        // Start new section
        currentSectionTitle = headerText;
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }
    
    // Add the last section
    if (currentSection.trim()) {
      sections.push({
        title: currentSectionTitle || `Feature ${sections.length + 1}`,
        content: currentSection.trim()
      });
    }
    
    // If we still have no sections, try to split by content blocks
    if (sections.length <= 1 && content.length > 500) {
      
      const contentBlocks = content.split(/\n\s*\n\s*\n/); // Split by multiple newlines
      
      if (contentBlocks.length > 1) {
        sections.length = 0; // Clear existing sections
        contentBlocks.forEach((block, index) => {
          if (block.trim().length > 50) { // Only add blocks with substantial content
            const blockLines = block.trim().split('\n');
            const firstLine = blockLines[0]?.trim() || '';
            const title = firstLine.length < 100 ? firstLine : `Feature ${index + 1}`;
            
            sections.push({
              title: title,
              content: block.trim()
            });
          }
        });
      }
    }
    
    // If still not enough sections, try more aggressive splitting
    if (sections.length <= 3 && content.length > 1000) {
      // Try splitting by any line that looks like it could be a section header
      const aggressiveBlocks = content.split(/\n\s*\n/); // Split by double newlines
      
      if (aggressiveBlocks.length > sections.length) {
        sections.length = 0; // Clear existing sections
        aggressiveBlocks.forEach((block, index) => {
          if (block.trim().length > 30) { // Lower threshold for more sections
            const blockLines = block.trim().split('\n');
            const firstLine = blockLines[0]?.trim() || '';
            
            // Try to find a good title from the first few lines
            let title = `Feature ${index + 1}`;
            for (let i = 0; i < Math.min(3, blockLines.length); i++) {
              const line = blockLines[i].trim();
              if (line.length > 3 && line.length < 80 && 
                  (line.match(/^[A-Z]/) || line.match(/^[0-9]+\./))) {
                title = line;
                break;
              }
            }
            
            sections.push({
              title: title,
              content: block.trim()
            });
          }
        });
      }
    }
    
    return sections;
  };

  const handleFileUpload = useCallback((event) => {
    // Extract files from the event
    const files = event.target.files;
    
    if (!files || files.length === 0) return;

    // Handle both FileList and single file cases
    const fileArray = files instanceof FileList ? Array.from(files) : [files];

    const newFiles = fileArray.map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      file: file,
      status: 'uploading'
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Process each file
    newFiles.forEach(fileObj => {
      // Set status to processing
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'processing' }
            : f
        )
      );
      
      // Process the file - pass the file object directly
      processFile(fileObj);
    });
  }, [processFile]);

  const removeFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    // Create a mock event object for handleFileUpload
    const mockEvent = { target: { files: files } };
    handleFileUpload(mockEvent);
  }, [handleFileUpload]);

  const generateTests = async () => {
    // Check if we have feature tabs (analyzed sections)
    if (featureTabs.length === 0) {
      setStatus({ type: 'error', message: 'No analyzed sections available. Please upload and analyze documents first.' });
      return;
    }
    
    setIsLoading(true);
    setIsGenerating(true);
    setStatus(null);
    
    try {
      let allTests = '';
      const generatedFeatures = [];
      
      // Generate tests for each feature tab
      for (const feature of featureTabs) {
        // Skip features with insufficient content
        if (feature.content.length < 100) {
          continue;
        }
        
        // Prepare enhanced content with more context
        const enhancedContent = `Section: ${feature.title}\n\n${feature.content}`;
        
        const response = await axios.post(`${API_BASE_URL}/api/generate-tests`, { 
          content: enhancedContent, 
          context: context 
        });
        
        if (response.data.success) {
          const featureTitle = feature.title;
          const featureContent = response.data.content;
          generatedFeatures.push({
            title: featureTitle,
            content: featureContent,
            originalContent: feature.content
          });
          allTests += `\n\n# ${feature.title}\n`;
          allTests += response.data.content;
        }
      }
      
      if (generatedFeatures.length > 0) {
        setGeneratedTests(allTests.trim());
        setFeatureTabs(generatedFeatures);
        setActiveTab(0);
        // Initialize editable features
        const editableFeaturesObj = {};
        generatedFeatures.forEach((feature, index) => {
          editableFeaturesObj[index] = feature.content;
        });
        setEditableFeatures(editableFeaturesObj);
        setShowModal(true);
        setStatus({ type: 'success', message: `Generated ${generatedFeatures.length} feature files from document sections!` });
      } else {
        setStatus({ type: 'error', message: 'Failed to generate test cases from document sections' });
      }
    } catch (error) {
      let errorMessage = 'Failed to generate test cases';
      let suggestion = 'Please try again';
      
      if (error.response) {
        const errorData = error.response.data;
        errorMessage = errorData.error || errorMessage;
        suggestion = errorData.suggestion || suggestion;
      } else if (error.request) {
        errorMessage = 'Network error - unable to connect to server';
        suggestion = 'Please check your connection and try again';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setStatus({ type: 'error', message: `${errorMessage}. ${suggestion}` });
    } finally { 
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  const refineTests = async () => {
    if (!generatedTests || !generatedTests.trim()) {
      setStatus({ type: 'error', message: 'No test cases available to refine' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: 'info', message: 'Refining test cases...' });

    try {
      const currentFeature = featureTabs[activeTab];
      const currentContent = editableFeatures[activeTab] || currentFeature.content;
      
      const response = await axios.post(`${API_BASE_URL}/api/refine-tests`, {
        content: currentContent,
        feedback: 'Please improve the test cases based on best practices',
        context: context
      });

      if (response.data.success) {
        // Update the specific feature
        const updatedFeatures = [...featureTabs];
        updatedFeatures[activeTab] = {
          ...updatedFeatures[activeTab],
          content: response.data.content
        };
        setFeatureTabs(updatedFeatures);
        
        // Update editable features
        setEditableFeatures(prev => ({
          ...prev,
          [activeTab]: response.data.content
        }));
        
        // Update overall generated tests
        const allTests = updatedFeatures.map(f => f.content).join('\n\n');
        setGeneratedTests(allTests);
        
        setStatus({ type: 'success', message: `Refined test cases for "${currentFeature.title}"!` });
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Failed to refine test cases' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to refine test cases. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setContent('');
    setContext('');
    setGeneratedTests('');

    setUploadedFiles([]);
    setShowModal(false);

    setActiveTab(0);
    setFeatureTabs([]);
    setEditableFeatures({});
    setEditingFeatures({});
    setStatus(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get current content (edited or original)




  // Fetch Zephyr Scale projects
  const fetchZephyrProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await axios.get(`${API_BASE_URL}/api/zephyr-projects`);
      if (response.data.success) {
        setZephyrProjects(response.data.projects);
      }
    } catch (error) {
      console.error('Error fetching Zephyr projects:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch Zephyr Scale projects' 
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch Zephyr Scale folders for selected project
  const fetchZephyrFolders = async (projectKey) => {
    if (!projectKey) {
      setZephyrFolders([]);
      return;
    }

    try {
      setLoadingFolders(true);
      const response = await axios.get(`${API_BASE_URL}/api/zephyr-folders/${projectKey}`);
      if (response.data.success) {
        setZephyrFolders(response.data.folders);
      }
    } catch (error) {
      console.error('Error fetching Zephyr folders:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch Zephyr Scale folders' 
      });
    } finally {
      setLoadingFolders(false);
    }
  };

  // Handle project selection
  const handleProjectChange = (projectKey) => {
    setZephyrConfig(prev => ({
      ...prev,
      projectKey: projectKey,
      folderId: '' // Reset folder when project changes
    }));
    fetchZephyrFolders(projectKey);
  };

  // Updated pushToZephyr function
  const pushToZephyr = async (content, featureName = 'Test Feature', projectKey = '', testCaseName = '', folderId = '', status = 'Draft', isAutomatable = 'None', testCaseId = null) => {
    try {
      // Parse content to count scenarios
      const lines = content.split('\n');
      const scenarios = [];
      let currentScenario = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
          if (currentScenario) {
            scenarios.push(currentScenario);
          }
          currentScenario = line.replace('Scenario:', '').replace('Scenario Outline:', '').trim();
        }
      }
      if (currentScenario) {
        scenarios.push(currentScenario);
      }
      
      const totalScenarios = Math.max(scenarios.length, 1);
      
      // Initialize progress
      setZephyrProgress({
        current: 0,
        total: totalScenarios,
        message: 'Preparing to push test cases...',
        status: 'pushing'
      });
      setShowZephyrProgress(true);
      
      // Real-time progress updates
      const updateProgress = (current, message) => {
        setZephyrProgress(prev => ({
          ...prev,
          current,
          message
        }));
      };
      
      // Start with connection phase
      updateProgress(0, 'Connecting to Zephyr Scale...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Parse and prepare phase
      updateProgress(0, 'Preparing test cases...');
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Start the actual push
      updateProgress(0, 'Creating test cases in Zephyr Scale...');
      
      // Create a progress interval to show activity during the API call
      const progressInterval = setInterval(() => {
        setZephyrProgress(prev => {
          if (prev.current < totalScenarios) {
            return {
              ...prev,
              current: Math.min(prev.current + 1, totalScenarios - 1),
              message: `Creating test case ${Math.min(prev.current + 1, totalScenarios)} of ${totalScenarios}...`
            };
          }
          return prev;
        });
      }, 800); // Update every 800ms
      
      const response = await axios.post(`${API_BASE_URL}/api/push-to-zephyr`, {
        content: content,
        featureName: featureName,
        projectKey: projectKey,
        testCaseName: testCaseName,
        folderId: folderId || null,
        status: status,
        isAutomatable: isAutomatable,
        testCaseId: testCaseId
      });

      // Clear the progress interval
      clearInterval(progressInterval);

      if (response.data.success) {
        updateProgress(totalScenarios, 'Successfully pushed all test cases!');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setZephyrProgress(prev => ({
          ...prev,
          status: 'success'
        }));
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        setShowZephyrProgress(false);
        
        return response.data;
      } else {
        throw new Error('Push failed');
      }
    } catch (error) {
      console.error('Error pushing to Zephyr Scale:', error);
      
      setZephyrProgress(prev => ({
        ...prev,
        status: 'error',
        message: error.response?.data?.error || 'Failed to push to Zephyr Scale'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowZephyrProgress(false);
      
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to push to Zephyr Scale. Please try again.' 
      });
      return null;
    }
  };

  // Load projects and refresh folders when Zephyr config modal opens
  useEffect(() => {
    if (showZephyrConfig) {
      // Reset test case name to empty when modal opens
      setZephyrConfig(prev => ({ ...prev, testCaseName: '' }));
      
      if (zephyrProjects.length === 0) {
        fetchZephyrProjects();
      }
      // Refresh folders if a project is already selected
      if (zephyrConfig.projectKey) {
        fetchZephyrFolders(zephyrConfig.projectKey);
      }
    }
  }, [showZephyrConfig]);

  // Rotate through test generation images
  useEffect(() => {
    if (isGenerating) {
      const images = document.querySelectorAll('.test-image');
      let currentImage = 0;
      
      const rotateImages = () => {
        // Remove active class from all images
        images.forEach(img => img.classList.remove('active'));
        
        // Add active class to current image
        images[currentImage].classList.add('active');
        
        // Move to next image
        currentImage = (currentImage + 1) % images.length;
      };
      
      // Rotate images every 2 seconds (matching progress bar animation)
      const interval = setInterval(rotateImages, 2000);
      
      // Start with first image
      rotateImages();
      
      return () => clearInterval(interval);
    }
  }, [isGenerating]);

  // Auto-generate image elements based on available images
  const [loadingImages, setLoadingImages] = useState([]);
  
  useEffect(() => {
    const fetchLoadingImages = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/loading-images`);
        if (response.data.success) {
          setLoadingImages(response.data.images);
        } else {
          // Fallback to static images if API fails
          const fallbackImages = [
            { image: "the-documentation-that-shapes-them.png", title: "Analyzing Requirements" },
            { image: "Google's Updated Spam Policy - Repeated_.jpeg", title: "Creating Test Scenarios" },
            { image: "Paperwork Robot Stock Illustrations_.png", title: "Adding Edge Cases" },
            { image: "A robot eating a stack of pancakes with_.png", title: "Generating Negative Tests" }
          ];
          setLoadingImages(fallbackImages);
        }
      } catch (error) {
        // Fallback to static images if API fails
        const fallbackImages = [
          { image: "the-documentation-that-shapes-them.png", title: "Analyzing Requirements" },
          { image: "Google's Updated Spam Policy - Repeated_.jpeg", title: "Creating Test Scenarios" },
          { image: "Paperwork Robot Stock Illustrations_.png", title: "Adding Edge Cases" },
          { image: "A robot eating a stack of pancakes with_.png", title: "Generating Negative Tests" }
        ];
        setLoadingImages(fallbackImages);
      }
    };
    
    fetchLoadingImages();
  }, [API_BASE_URL]);

  return (
    <div className="container">
      {/* Status Message */}
      {status && (
        <div className={`status ${status.type}`}>
          {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {status.message}
        </div>
      )}

      {/* Test Generation Loading Overlay */}
      {isGenerating && (
        <div className="test-generation-overlay">
          <div className="test-generation-modal">
            <div className="test-generation-content">
              <div className="test-generation-icon">
                <Zap size={48} />
              </div>
              <h3>Generating Test Cases</h3>
              <div className="test-generation-spinner">
                <div className="spinner large"></div>
              </div>
              <div className="test-generation-images">
                <div className="image-container">
                  {loadingImages.map((imageStep, index) => (
                    <div 
                      key={index}
                      className={`test-image ${index === 0 ? 'active' : ''}`} 
                      data-image={index + 1}
                    >
                      <img 
                        src={`/images/loading/${imageStep.image}`} 
                        alt={imageStep.title} 
                        className="loading-image" 
                      />
                      <span>{imageStep.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p>Analyzing document content and creating comprehensive test scenarios...</p>
              <div className="test-generation-progress">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <span>Processing sections and generating edge cases...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Section */}
      <div className="card">
        <h2 className="card-title">
          <Upload className="icon" />
          Upload Documents
        </h2>
        <p className="card-description">
          Upload documents to analyze and generate test cases. Each section will become a separate feature file.
        </p>
        
        <div 
          className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.rtf,.odt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp,.svg,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.vsd,.vsdx"
            style={{ display: 'none' }}
          />
          
          {isProcessing ? (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <p className="processing-text">
                Processing {processingFile}...
              </p>
              <p className="processing-hint">
                Analyzing document content and extracting sections...
              </p>
            </div>
          ) : (
            <>
              <Upload size={48} className="upload-icon" />
              <p className="upload-hint">
                Drag and drop files here, or <button 
                  className="link-button" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  click to browse
                </button>
              </p>
              <p className="upload-formats">
                Supported formats: PDF, DOCX, DOC, TXT, MD, RTF, ODT, Images (JPG, PNG, GIF, etc.), Excel (XLS, XLSX), PowerPoint (PPT, PPTX), Visio (VSD, VSDX)
              </p>
            </>
          )}
        </div>

        {/* Import from Jira Section */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#2d3748' }}>
            📋 Alternative: Import from Jira
          </h3>
          <p style={{ marginBottom: '1rem', color: '#4a5568', fontSize: '0.9rem' }}>
            Don't have documents? Import test cases directly from your Jira issues.
          </p>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              setShowJiraImport(true);
              setJiraStep('connect');
              setJiraConfig({
                projectKey: '',
                issueTypes: [],
                selectedIssues: []
              });
            }}
            title="Import test cases from Jira"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
          >
            <Download size={18} />
            Import from Jira
          </button>
        </div>

        {/* Document Analysis Results */}
        {featureTabs.length > 0 && (
          <div className="analysis-results">
            <h3>📋 Document Analysis Results</h3>
            <div className="sections-list">
              {featureTabs.map((feature, index) => (
                <div key={index} className="section-item">
                  <div className="section-header">
                    <h4><FileText size={16} /> {feature.title}</h4>
                    <span className="section-count">
                      {feature.content.split('\n').filter(line => line.trim().startsWith('Scenario:')).length} scenarios
                    </span>
                  </div>
                  <div className="section-preview">
                    {feature.content.split('\n').slice(0, 5).join('\n')}
                    {feature.content.split('\n').length > 5 && '...'}
                  </div>
                </div>
              ))}
            </div>
            <div className="analysis-actions">
              <button 
                className="btn btn-secondary"
                onClick={generateTests}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <div className="spinner small"></div>
                    <span>Generating Test Cases...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    Generate Test Cases
                  </>
                )}
              </button>

            </div>
          </div>
        )}

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="file-list">
            <h3>Uploaded Files</h3>
            {uploadedFiles.map((file) => (
              <div key={file.id} className={`file-item ${file.status}`}>
                <div className="file-info">
                  <div className="file-header">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  
                  {file.status === 'uploading' && (
                    <div className="file-status">
                      <div className="spinner small"></div>
                      <span>Uploading...</span>
                    </div>
                  )}
                  
                  {file.status === 'processing' && (
                    <div className="file-status">
                      <div className="spinner small"></div>
                      <span>Processing...</span>
                    </div>
                  )}
                  
                  {file.status === 'completed' && (
                    <div className="file-status success">
                      <CheckCircle size={16} />
                      <span>Processed successfully</span>
                    </div>
                  )}
                  
                  {file.status === 'failed' && (
                    <div className="file-status error">
                      <XCircle size={16} />
                      <span>Failed: {file.error}</span>
                    </div>
                  )}
                </div>
                
                <div className="file-actions">
                  {file.status === 'completed' && (
                    <>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => removeFile(file.id)}
                        title="Remove file"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  {file.status === 'failed' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => removeFile(file.id)}
                      title="Remove file"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="card">
        <h2 className="card-title">
          <Sparkles size={24} />
          Generate Cucumber Test Cases
        </h2>
        
        <div className="form-group">
          <label className="form-label">Requirements / User Story / Content</label>
          <textarea
            className="form-textarea"
            placeholder="Enter your requirements, user stories, or any content you want to convert to Cucumber test cases... (Content from uploaded documents will be automatically added here)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Additional Context (Optional)</label>
          <textarea
            className="form-textarea"
            placeholder="Add any additional context, domain-specific information, or constraints..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-4">
          <button
            className="btn btn-primary"
            onClick={generateTests}
            disabled={isLoading || (!content.trim() && uploadedFiles.length === 0)}
          >
            {isLoading ? (
              <>
                <div className="loading"></div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Generate Tests
              </>
            )}
          </button>
          
          <button
            className="btn btn-secondary"
            onClick={clearAll}
            disabled={isLoading}
          >
            Clear All
          </button>
          
          {/* Temporary test button */}
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (generatedTests && generatedTests.trim()) {
                setShowModal(true);
              } else {
                setStatus({ type: 'error', message: 'No test cases available to display. Please generate tests first.' });
              }
            }}
            disabled={isLoading || !generatedTests || !generatedTests.trim()}
          >
            Test Display
          </button>
        </div>
      </div>

      {/* Instructions */}
      {/* Empty State */}
      {!generatedTests && (
        <div className="card">
          <h3 className="card-title">How to Use</h3>
          <div className="text-center">
            <p className="mb-2">
              Upload documents (PDF, DOCX, TXT, etc.) or enter your requirements in the text area above. 
              The AI will analyze your documents and generate comprehensive Cucumber test cases in Gherkin syntax.
            </p>
          </div>
        </div>
      )}

      {/* Test Cases Modal */}
      {showModal && generatedTests && generatedTests.trim() && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <TestTube size={24} />
                Generated Test Cases
              </h2>
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    const currentFeature = featureTabs[activeTab];
                    const isCurrentlyEditing = editingFeatures[activeTab];
                    
                    if (isCurrentlyEditing) {
                      // Save changes for current feature
                      const updatedFeatures = [...featureTabs];
                      updatedFeatures[activeTab] = {
                        ...updatedFeatures[activeTab],
                        content: editableFeatures[activeTab]
                      };
                      setFeatureTabs(updatedFeatures);
                      setEditingFeatures(prev => ({ ...prev, [activeTab]: false }));
                      setStatus({ type: 'success', message: `Updated "${currentFeature.title}"!` });
                    } else {
                      // Start editing current feature
                      setEditingFeatures(prev => ({ ...prev, [activeTab]: true }));
                    }
                  }}
                  disabled={pushedTabs.has(activeTab)}
                  title={pushedTabs.has(activeTab) ? "Cannot edit after pushing to Zephyr" : (editingFeatures[activeTab] ? "Save changes" : "Edit current feature")}
                >
                  {editingFeatures[activeTab] ? "Save" : "Edit"}
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={refineTests}
                  disabled={isLoading || pushedTabs.has(activeTab)}
                  title={pushedTabs.has(activeTab) ? "Cannot refine after pushing to Zephyr" : "Refine and improve the current feature"}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="icon spinning" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="icon" />
                      Refine
                    </>
                  )}
                </button>
                <button 
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Feature Tabs */}
            {featureTabs.length > 1 && (
              <div className="feature-tabs">
                {featureTabs.map((feature, index) => (
                  <button
                    key={index}
                    className={`tab-button ${activeTab === index ? 'active' : ''} ${pushedTabs.has(index) ? 'pushed' : ''}`}
                    onClick={() => setActiveTab(index)}
                  >
                    {feature.title}
                  </button>
                ))}
              </div>
            )}

            {/* Feature Content */}
            {featureTabs.length > 0 && (
              <div className="feature-content">
                {editingFeatures[activeTab] && !pushedTabs.has(activeTab) ? (
                  <textarea
                    value={editableFeatures[activeTab] || ''}
                    onChange={(e) => setEditableFeatures(prev => ({
                      ...prev,
                      [activeTab]: e.target.value
                    }))}
                    className="test-editor"
                    placeholder="Edit your test cases here..."
                  />
                ) : (
                  <>
                    {pushedTabs.has(activeTab) && (
                      <div style={{ 
                        padding: '12px', 
                        backgroundColor: '#f0f9ff', 
                        border: '1px solid #0ea5e9', 
                        borderRadius: '6px', 
                        marginBottom: '12px',
                        fontSize: '14px',
                        color: '#0369a1'
                      }}>
                        ✅ This test case has been pushed to Zephyr Scale. Any changes must be made directly in Zephyr.
                      </div>
                    )}
                    <TestOutput content={editableFeatures[activeTab] || featureTabs[activeTab]?.content || ''} />
                  </>
                )}
              </div>
            )}

            {/* Export Actions */}
            <div className="modal-footer">
              <div className="export-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const currentContent = editableFeatures[activeTab] || featureTabs[activeTab]?.content || '';
                    const currentFeature = featureTabs[activeTab];
                    const blob = new Blob([currentContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentFeature?.title || 'test-cases'}.feature`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setStatus({ type: 'success', message: `Downloaded ${currentFeature?.title || 'test cases'}` });
                  }}
                  title="Download current feature as .feature file"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const currentContent = editableFeatures[activeTab] || featureTabs[activeTab]?.content || '';
                    navigator.clipboard.writeText(currentContent);
                    setStatus({ type: 'success', message: 'Copied to clipboard!' });
                  }}
                  title="Copy current feature to clipboard"
                >
                  <Copy size={16} />
                  Copy
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const currentFeature = featureTabs[activeTab];
                    setZephyrConfig({
                      projectKey: '',
                      testCaseName: currentFeature?.title || 'Test Feature',
                      folderId: '',
                      status: 'Draft',
                      isAutomatable: 'None'
                    });
                    setShowZephyrConfig(true);
                  }}
                  disabled={pushedTabs.has(activeTab)}
                  title={pushedTabs.has(activeTab) ? "Already pushed to Zephyr - use Zephyr to make changes" : "Push current feature directly to Zephyr Scale"}
                >
                  <ExternalLink size={16} />
                  {pushedTabs.has(activeTab) ? "Already Pushed" : "Push to Zephyr"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zephyr Scale Configuration Modal */}
      {showZephyrConfig && (
        <div className="modal-overlay" onClick={() => setShowZephyrConfig(false)}>
          <div className="modal-content zephyr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Push to Zephyr Scale</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowZephyrConfig(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="projectKey">Project *</label>
                <select
                  id="projectKey"
                  value={zephyrConfig.projectKey}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  required
                  disabled={loadingProjects}
                >
                  <option value="">Select a project...</option>
                  {zephyrProjects.map((project) => (
                    <option key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </option>
                  ))}
                </select>
                {loadingProjects && <small>Loading projects...</small>}
                <small>Choose the project where you want to create the test case</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="folderId">Test Folder</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }} className="folder-dropdown-container">
                    <input
                      type="text"
                      placeholder="Click to select folder..."
                      value={zephyrConfig.folderId ? zephyrFolders.find(f => f.id === zephyrConfig.folderId)?.name || '' : ''}
                      onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                      readOnly
                      style={{ 
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    />
                    {showFolderDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        zIndex: 9999,
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        marginTop: '2px'
                      }}>
                        <div style={{
                          padding: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: '#f9fafb',
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          Select a folder ({zephyrFolders.length} available)
                        </div>
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          <div
                            style={{
                              padding: '0.5rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f3f4f6',
                              backgroundColor: zephyrConfig.folderId === '' ? '#e3f2fd' : 'transparent'
                            }}
                            onClick={() => {
                              setZephyrConfig(prev => ({ ...prev, folderId: '' }));
                              setShowFolderDropdown(false);
                            }}
                          >
                            No folder (optional)
                          </div>
                          {zephyrFolders.map((folder) => (
                            <div
                              key={folder.id}
                              style={{
                                padding: '0.5rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: zephyrConfig.folderId === folder.id ? '#e3f2fd' : 'transparent'
                              }}
                              onClick={() => {
                                setZephyrConfig(prev => ({ ...prev, folderId: folder.id }));
                                setShowFolderDropdown(false);
                              }}
                            >
                              {folder.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => zephyrConfig.projectKey && fetchZephyrFolders(zephyrConfig.projectKey)}
                    disabled={!zephyrConfig.projectKey || loadingFolders}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Refresh folders"
                  >
                    🔄
                  </button>
                </div>
                {loadingFolders && <small>Loading folders...</small>}
                <small>Choose a folder to organize your test case (optional). Click the refresh button to update the list.</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="testCaseName">Test Case Name</label>
                <input
                  type="text"
                  id="testCaseName"
                  value={zephyrConfig.testCaseName}
                  onChange={(e) => setZephyrConfig(prev => ({
                    ...prev,
                    testCaseName: e.target.value
                  }))}
                  placeholder="Enter test case name"
                />
                <small>Leave empty to use feature name</small>
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    value={zephyrConfig.status}
                    onChange={(e) => setZephyrConfig(prev => ({
                      ...prev,
                      status: e.target.value
                    }))}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Deprecated">Deprecated</option>
                    <option value="Approved">Approved</option>
                  </select>
                  <small>Select the status for this test case</small>
                </div>
                
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="isAutomatable">Is Automatable</label>
                  <select
                    id="isAutomatable"
                    value={zephyrConfig.isAutomatable}
                    onChange={(e) => setZephyrConfig(prev => ({
                      ...prev,
                      isAutomatable: e.target.value
                    }))}
                  >
                    <option value="None">None</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                  <small>Indicates if this test case is automatable</small>
                </div>
              </div>
              
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowZephyrConfig(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!zephyrConfig.projectKey.trim()) {
                      setStatus({ type: 'error', message: 'Project is required' });
                      return;
                    }
                    
                    const currentContent = editableFeatures[activeTab] || featureTabs[activeTab]?.content || '';
                    const currentFeature = featureTabs[activeTab];
                    
                    const result = await pushToZephyr(
                      currentContent,
                      currentFeature?.title || 'Test Feature',
                      zephyrConfig.projectKey,
                      zephyrConfig.testCaseName,
                      zephyrConfig.folderId,
                      zephyrConfig.status,
                      zephyrConfig.isAutomatable,
                      zephyrTestCaseIds[activeTab] || null
                    );
                    
                    if (result) {
                      // Add current tab to pushed tabs and store test case IDs
                      setPushedTabs(prev => new Set([...prev, activeTab]));
                      setZephyrTestCaseIds(prev => ({
                        ...prev,
                        [activeTab]: result.zephyrTestCaseIds || [result.zephyrTestCaseId]
                      }));
                      setStatus({ 
                        type: 'success', 
                        message: `Successfully ${zephyrTestCaseIds[activeTab] ? 'updated' : 'pushed'} to Zephyr Scale! ${result.zephyrTestCaseIds ? `${result.zephyrTestCaseIds.length} test cases` : 'Test Case ID: ' + result.zephyrTestCaseId}` 
                      });
                      setShowZephyrConfig(false);
                    }
                  }}
                  disabled={!zephyrConfig.projectKey.trim()}
                >
                  Push to Zephyr Scale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zephyr Scale Push Progress Modal */}
      {showZephyrProgress && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Pushing to Zephyr Scale</h3>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                {zephyrProgress.status === 'pushing' && (
                  <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 20px' }}></div>
                )}
                {zephyrProgress.status === 'success' && (
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
                )}
                {zephyrProgress.status === 'error' && (
                  <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
                )}
                
                <h4 style={{ marginBottom: '10px', color: '#2d3748' }}>
                  {zephyrProgress.status === 'success' ? 'Success!' : 
                   zephyrProgress.status === 'error' ? 'Error' : 
                   'Pushing Test Cases'}
                </h4>
                
                <p style={{ color: '#4a5568', marginBottom: '20px' }}>
                  {zephyrProgress.message}
                </p>
                
                {zephyrProgress.status === 'pushing' && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: '#e2e8f0', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(zephyrProgress.current / zephyrProgress.total) * 100}%`,
                        height: '100%',
                        backgroundColor: '#667eea',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <small style={{ color: '#718096' }}>
                      {zephyrProgress.current} of {zephyrProgress.total} test cases
                    </small>
                  </div>
                )}
              </div>
            </div>
            
            {zephyrProgress.status === 'error' && (
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowZephyrProgress(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jira Import Modal */}
      {showJiraImport && (
        <div className="modal-overlay" onClick={() => setShowJiraImport(false)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import from Jira</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowJiraImport(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Step 1: Connect to Jira */}
              {jiraStep === 'connect' && (
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#2d3748' }}>Step 1: Connect to Jira</h4>
                  <p style={{ marginBottom: '1.5rem', color: '#4a5568', fontSize: '0.9rem' }}>
                    Using your configured Jira credentials from environment variables.
                  </p>
                  
                  <div className="modal-footer">
                    <button
                      className="btn btn-primary"
                      onClick={testJiraConnection}
                      disabled={isLoadingJira}
                    >
                      {isLoadingJira ? (
                        <>
                          <div className="spinner small"></div>
                          <span>Connecting...</span>
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Select Project and Issues */}
              {jiraStep === 'select' && (
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#2d3748' }}>Step 2: Select Project and Issues</h4>
                  
                  <div className="form-group">
                    <label htmlFor="jiraProject">Project *</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ flex: 1, position: 'relative' }} className="jira-project-dropdown-container">
                        <input
                          type="text"
                          placeholder={jiraProjects.length === 0 ? 'Loading projects...' : 'Click to select project...'}
                          value={jiraConfig.projectKey ? jiraProjects.find(p => p.key === jiraConfig.projectKey)?.name || '' : ''}
                          onClick={() => setShowJiraProjectDropdown(!showJiraProjectDropdown)}
                          readOnly
                          disabled={jiraProjects.length === 0}
                          style={{ 
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer'
                          }}
                        />
                        {showJiraProjectDropdown && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.375rem',
                            maxHeight: '300px',
                            overflowY: 'auto',
                            zIndex: 9999,
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            marginTop: '2px'
                          }}>
                            <div style={{
                              padding: '0.5rem',
                              borderBottom: '1px solid #e5e7eb',
                              backgroundColor: '#f9fafb',
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}>
                              Select a project ({jiraProjects.length} available)
                            </div>
                            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                              {jiraProjects.map((project) => (
                                <div
                                  key={project.key}
                                  style={{
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f3f4f6',
                                    backgroundColor: jiraConfig.projectKey === project.key ? '#e3f2fd' : 'transparent'
                                  }}
                                  onClick={() => {
                                    setJiraConfig(prev => ({ ...prev, projectKey: project.key }));
                                    setShowJiraProjectDropdown(false);
                                  }}
                                >
                                  {project.name} ({project.key})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {jiraProjects.length === 0 && <small>Loading projects...</small>}
                    <small>Choose the project containing your test cases</small>
                  </div>
                  
                  <div className="form-group">
                    <label>Issue Types</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {['Story', 'Bug', 'Task', 'Epic'].map((type) => (
                        <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="checkbox"
                            checked={jiraConfig.issueTypes.includes(type)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setJiraConfig(prev => ({ 
                                  ...prev, 
                                  issueTypes: [...prev.issueTypes, type] 
                                }));
                              } else {
                                setJiraConfig(prev => ({ 
                                  ...prev, 
                                  issueTypes: prev.issueTypes.filter(t => t !== type) 
                                }));
                              }
                            }}
                          />
                          {type}
                        </label>
                      ))}
                    </div>
                    <small>Select which issue types to import</small>
                  </div>
                  
                  <div className="modal-footer">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setJiraStep('connect')}
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={fetchJiraIssues}
                      disabled={isLoadingJira || !jiraConfig.projectKey || jiraConfig.issueTypes.length === 0}
                    >
                      {isLoadingJira ? (
                        <>
                          <div className="spinner small"></div>
                          <span>Fetching Issues...</span>
                        </>
                      ) : (
                        'Fetch Issues'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Select Issues to Import */}
              {jiraStep === 'import' && (
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#2d3748' }}>Step 3: Select Issues to Import</h4>
                  
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                    {jiraIssues.map((issue) => (
                      <label key={issue.key} style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '8px', 
                        padding: '8px', 
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={jiraConfig.selectedIssues.includes(issue.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setJiraConfig(prev => ({ 
                                ...prev, 
                                selectedIssues: [...prev.selectedIssues, issue.key] 
                              }));
                            } else {
                              setJiraConfig(prev => ({ 
                                ...prev, 
                                selectedIssues: prev.selectedIssues.filter(k => k !== issue.key) 
                              }));
                            }
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#2d3748' }}>
                            {issue.key}: {issue.summary}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '4px' }}>
                            {typeof issue.description === 'string' ? issue.description.substring(0, 100) + '...' : 'No description available'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#4a5568' }}>
                    Selected: {jiraConfig.selectedIssues.length} of {jiraIssues.length} issues
                  </div>
                  
                  <div className="modal-footer">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setJiraStep('select')}
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={importJiraIssues}
                      disabled={isLoadingJira || jiraConfig.selectedIssues.length === 0}
                    >
                      {isLoadingJira ? (
                        <>
                          <div className="spinner small"></div>
                          <span>Importing...</span>
                        </>
                      ) : (
                        `Import ${jiraConfig.selectedIssues.length} Issues`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestGenerator; 