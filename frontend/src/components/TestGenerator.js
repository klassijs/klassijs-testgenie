import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Copy, Download, RefreshCw, AlertCircle, CheckCircle, TestTube, Upload, X, ExternalLink, Edit, Zap } from 'lucide-react';

import axios from 'axios';
import TestOutput from './TestOutput';
import { 
  parseRequirementsTable, 
  validateTestCoverage, 
  formatFileSize, 
  buildFolderTree, 
  formatRequirementsForInsertionWithGeneratedIds, 
  handleDownloadContent, 
  validateComplexityValues 
} from '../utils/testGeneratorUtils';
import {
  handleClickOutside,
  clearAll,
  toggleFolderExpansion,
  handleProjectChange,
  handleSelectRequirement,
  handleSelectAll,
  handleDeleteSelected,
  confirmDeleteSelected,
  clearSelection,
  handleSelectCache,
  handleSelectAllCaches,
  handleDeleteSelectedCaches,
  confirmDeleteSelectedCaches,
  openCacheModal
} from '../utils/uiStateUtils';
import {
  savePushedStateToCache,
  loadPushedStateFromCache,
  loadJiraPushedStates,
  clearPushedStateCache,
  fetchCacheList
} from '../utils/cacheUtils';
import {
  processFile,
  handleFileUpload,
  removeFile,
  handleDragOver,
  handleDragLeave,
  handleDrop
} from '../utils/fileUploadUtils';
import {
  generateTests,
  refineTests
} from '../utils/requirementsTestUtils';
import {
  testJiraConnection,
  fetchJiraIssues,
  updateDisplayedIssues,
  goToPage,
  clearJiraCache,
  shouldRefetch,
  importJiraIssues
} from '../utils/jiraUtils';
import {
  fetchZephyrProjects,
  fetchZephyrFolders,
  fetchAllFolders,
  searchFolders,
  pushToZephyr
} from '../utils/zephyrUtils';
import {
  rotateImages,
  loadImages
} from '../utils/renderUtils';

// Configure axios with longer timeout for long-running operations
axios.defaults.timeout = 300000; // 5 minutes

const TestGenerator = () => {
  // API base URL - can be configured via environment variable
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // File input reference
  const fileInputRef = useRef(null);
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [generatedTests, setGeneratedTests] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  const [currentDocumentName, setCurrentDocumentName] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [extractedRequirements, setExtractedRequirements] = useState('');
  const [requirementsSource, setRequirementsSource] = useState(''); // 'jira' or 'upload'
  const [jiraTicketPrefix, setJiraTicketPrefix] = useState(''); // Store Jira ticket prefix

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
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  
  // Hierarchical folder navigation state
  const [folderNavigation, setFolderNavigation] = useState({
    currentLevel: 'main', // 'main', 'subfolder', 'search'
    parentFolderId: null,
    parentFolderName: '',
    breadcrumb: []
  });
  const [searchMode, setSearchMode] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
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

  // Track Jira ticket information for imported features
  const [jiraTicketInfo, setJiraTicketInfo] = useState({});

  
  // Load pushed state from cache when document changes
  useEffect(() => {
    if (currentDocumentName) {
      loadPushedStateFromCache(currentDocumentName, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL);
    }
  }, [currentDocumentName, API_BASE_URL]);

  // Load pushed state from cache when Jira issues are imported
  useEffect(() => {
    if (featureTabs.length > 0 && requirementsSource === 'jira') {
      // loadJiraPushedStates function moved to utils/cacheUtils.js
      loadJiraPushedStates(featureTabs, jiraTicketInfo, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL);
    }
  }, [featureTabs, requirementsSource, jiraTicketInfo, API_BASE_URL]);

  // Save pushed state to cache whenever it changes (for uploaded documents only)
  useEffect(() => {
    if ((pushedTabs.size > 0 || Object.keys(zephyrTestCaseIds).length > 0) && 
        currentDocumentName && 
        requirementsSource !== 'jira') {
      savePushedStateToCache(pushedTabs, zephyrTestCaseIds, currentDocumentName, jiraTicketInfo, API_BASE_URL);
    }
  }, [pushedTabs, zephyrTestCaseIds, currentDocumentName, requirementsSource, jiraTicketInfo, API_BASE_URL]);

  // clearPushedStateCache function moved to utils/cacheUtils.js
  const clearPushedStateCacheWrapper = () => {
    clearPushedStateCache(requirementsSource, featureTabs, jiraTicketInfo, currentDocumentName, setPushedTabs, setZephyrTestCaseIds, setJiraTicketInfo, API_BASE_URL);
  };

  // Jira import state
  const [showJiraImport, setShowJiraImport] = useState(false);
  const [jiraConfig, setJiraConfig] = useState({
    projectKey: '',
    issueTypes: [],
    selectedIssues: [],
    baseUrl: '' // Will be set from backend response
  });
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraIssues, setJiraIssues] = useState([]);
  const [isLoadingJira, setIsLoadingJira] = useState(false);
  const [jiraStep, setJiraStep] = useState('connect'); // connect, select, import
  const [jiraConnectionActive, setJiraConnectionActive] = useState(false);
  // const [jiraIssueTypes, setJiraIssueTypes] = useState([]);
  const [showJiraProjectDropdown, setShowJiraProjectDropdown] = useState(false);
  const [jiraProjectSearch, setJiraProjectSearch] = useState('');
  const [jiraPagination, setJiraPagination] = useState({
    currentPage: 1,
    itemsPerPage: 100,
    totalItems: 0
  });
  const [allJiraIssues, setAllJiraIssues] = useState([]);
  // const [fetchAllJiraIssues, setFetchAllJiraIssues] = useState(false);
  const [jiraCacheInfo, setJiraCacheInfo] = useState({
    isCached: false,
    lastFetched: null,
    projectKey: null,
    issueTypes: []
  });

  // Wrapper functions for Jira integration functions
  const testJiraConnectionWrapper = () => {
    testJiraConnection(
      setIsLoadingJira,
      setJiraConfig,
      setJiraProjects,
      setJiraConnectionActive,
      setJiraStep,
      setStatus,
      API_BASE_URL
    );
  };

  const fetchJiraIssuesWrapper = () => {
    fetchJiraIssues(
      setIsLoadingJira,
      setAllJiraIssues,
      setJiraPagination,
      (allIssues, page) => updateDisplayedIssues(allIssues, page, jiraPagination, setJiraIssues),
      setJiraCacheInfo,
      setJiraStep,
      setStatus,
      jiraConfig,
      jiraPagination,
      API_BASE_URL
    );
  };

  const updateDisplayedIssuesWrapper = (allIssues, page) => {
    updateDisplayedIssues(allIssues, page, jiraPagination, setJiraIssues);
  };

  const goToPageWrapper = (page) => {
    goToPage(page, jiraPagination, setJiraPagination, updateDisplayedIssuesWrapper, allJiraIssues);
  };

  const clearJiraCacheWrapper = () => {
    clearJiraCache(setStatus, setJiraCacheInfo, jiraConfig, API_BASE_URL);
  };

  const shouldRefetchWrapper = () => {
    return shouldRefetch(jiraCacheInfo, jiraConfig);
  };

  const importJiraIssuesWrapper = () => {
    importJiraIssues(
      setIsLoadingJira,
      setStatus,
      setCurrentDocumentName,
      setExtractedRequirements,
      setRequirementsSource,
      parseRequirementsTable,
      setFeatureTabs,
      setEditableFeatures,
      setJiraTicketInfo,
      setJiraTicketPrefix,
      setShowJiraImport,
      setJiraStep,
      setJiraConfig,
      jiraConfig,
      requirementsSource,
      jiraTicketPrefix,
      jiraTicketInfo,
      featureTabs,
      API_BASE_URL
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (event) => handleClickOutside(event, showFolderDropdown, showProjectDropdown, setShowFolderDropdown, setShowProjectDropdown);

    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [showFolderDropdown, showProjectDropdown, setShowFolderDropdown, setShowProjectDropdown]);

  // Wrapper functions for requirements and test generation functions
  const processFileWrapper = (fileObj) => {
    processFile(
      fileObj,
      setIsProcessing,
      setProcessingFile,
      setCurrentDocumentName,
      setStatus,
      setUploadedFiles,
      setExtractedRequirements,
      setRequirementsSource,
      setJiraTicketPrefix,
      setJiraTicketInfo,
      setFeatureTabs,
      setEditableFeatures,
      API_BASE_URL,
      context,
      parseRequirementsTable
    );
  };

  const handleFileUploadWrapper = (event) => {
    handleFileUpload(event, setUploadedFiles, processFileWrapper);
  };

  const removeFileWrapper = (fileId) => {
    removeFile(fileId, setUploadedFiles);
  };

  const handleDragOverWrapper = (e) => {
    handleDragOver(e, setIsDragOver);
  };

  const handleDragLeaveWrapper = (e) => {
    handleDragLeave(e, setIsDragOver);
  };

  const handleDropWrapper = (e) => {
    handleDrop(e, setIsDragOver, handleFileUploadWrapper);
  };

  const generateTestsWrapper = () => {
    generateTests(
      content,
      setStatus,
      setIsLoading,
      setIsGenerating,
      parseRequirementsTable,
      validateTestCoverage,
      setRequirementsSource,
      setJiraTicketPrefix,
      setJiraTicketInfo,
      setFeatureTabs,
      setActiveTab,
      setEditableFeatures,
      setGeneratedTests,
      setExtractedRequirements,
      setContent,
      setShowModal,
      requirementsSource,
      jiraTicketPrefix,
      jiraTicketInfo,
      context,
      currentDocumentName,
      API_BASE_URL
    );
  };

  const refineTestsWrapper = () => {
    refineTests(
      generatedTests,
      setStatus,
      setIsLoading,
      featureTabs,
      activeTab,
      editableFeatures,
      setFeatureTabs,
      setEditableFeatures,
      setGeneratedTests,
      context,
      API_BASE_URL
    );
  };

  // clearAll function moved to utils/uiStateUtils.js
  const clearAllWrapper = () => {
    const setters = {
      setContent,
      setContext,
      setGeneratedTests,
      setExtractedRequirements,
      setUploadedFiles,
      setCurrentDocumentName,
      setShowModal,
      setActiveTab,
      setFeatureTabs,
      setEditableFeatures,
      setEditingFeatures,
      setStatus,
      setSelectedRequirements,
      setIsSelectAllChecked,
      setShowDeleteConfirmation,
      setSelectedCaches,
      setIsSelectAllCachesChecked,
      setShowCacheModal,
      setShowCacheDeleteConfirmation,
      setRequirementsSource,
      setJiraTicketPrefix,
      setJiraTicketInfo,
      // setJiraIssueTypes,
      setShowJiraImport,
      setJiraConfig,
      setJiraProjects,
      setJiraIssues,
      setIsLoadingJira,
      setJiraStep,
      setShowJiraProjectDropdown,
      setJiraProjectSearch,
      setShowZephyrConfig,
      setZephyrConfig,
      setZephyrProjects,
      setZephyrFolders,
      setLoadingProjects,
      setLoadingFolders,
      setShowFolderDropdown,
      setFolderSearch,
      setShowProjectDropdown,
      setProjectSearch,
      setFolderNavigation,
      setSearchMode,
      setExpandedFolders,
      setShowZephyrProgress,
      setZephyrProgress,
      setIsLoading,
      setIsGenerating,
      setIsProcessing,
      setProcessingFile,
      setLoadingImages,
      setImagesLoaded,
      jiraConnectionActive
    };
    clearAll(setters, clearPushedStateCacheWrapper);
  };

  
  // Wrapper functions for Zephyr Scale integration functions
  const fetchZephyrProjectsWrapper = useCallback(() => {
    fetchZephyrProjects(setLoadingProjects, setZephyrProjects, setStatus, API_BASE_URL);
  }, [API_BASE_URL]);

  const fetchZephyrFoldersWrapper = useCallback((projectKey) => {
    fetchZephyrFolders(projectKey, setZephyrFolders, setLoadingFolders, setStatus, API_BASE_URL);
  }, [API_BASE_URL]);

  const fetchAllFoldersWrapper = (projectKey) => {
    fetchAllFolders(projectKey, setZephyrFolders, setLoadingFolders, setFolderNavigation, setSearchMode, setStatus, API_BASE_URL);
  };

  const searchFoldersWrapper = (projectKey, searchTerm) => {
    searchFolders(projectKey, searchTerm, setZephyrFolders, setLoadingFolders, setFolderNavigation, setSearchMode, setStatus, API_BASE_URL);
  };

  const pushToZephyrWrapper = (content, featureName, projectKey, testCaseName, folderId, status, isAutomatable, testCaseId) => {
    return pushToZephyr(
      content,
      featureName,
      projectKey,
      testCaseName,
      folderId,
      status,
      isAutomatable,
      testCaseId,
      setZephyrProgress,
      setShowZephyrProgress,
      setStatus,
      setPushedTabs,
      setZephyrTestCaseIds,
      savePushedStateToCache,
      jiraTicketInfo,
      activeTab,
      currentDocumentName,
      API_BASE_URL
    );
  };

  // Load projects when Zephyr config modal opens
  useEffect(() => {
    if (showZephyrConfig && zephyrProjects.length === 0) {
      fetchZephyrProjectsWrapper();
    }
  }, [showZephyrConfig, zephyrProjects.length, fetchZephyrProjectsWrapper]);

  // Refresh folders when project key changes
  useEffect(() => {
    if (zephyrConfig.projectKey && zephyrConfig.projectKey.trim() !== '') {
      fetchZephyrFoldersWrapper(zephyrConfig.projectKey);
    }
  }, [zephyrConfig.projectKey, fetchZephyrFoldersWrapper]);

  // Auto-generate image elements based on available images
  const [loadingImages, setLoadingImages] = useState([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [editableRequirements, setEditableRequirements] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedRequirements, setSelectedRequirements] = useState(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showClearAllConfirmation, setShowClearAllConfirmation] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [cacheList, setCacheList] = useState([]);
  const [selectedCaches, setSelectedCaches] = useState(new Set());
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isSelectAllCachesChecked, setIsSelectAllCachesChecked] = useState(false);
  const [showCacheDeleteConfirmation, setShowCacheDeleteConfirmation] = useState(false);
  
  const fetchCacheListWrapper = () => {
    fetchCacheList(setIsLoadingCache, setCacheList, setStatus, API_BASE_URL);
  };

  // Rotate through test generation images with improved reliability
  useEffect(() => {
    // Only proceed if we're generating, have images, and images are loaded
    if (!isGenerating || !loadingImages || loadingImages.length === 0 || !imagesLoaded) {
      return;
    }
    
    let isMounted = true;
    // Start rotation immediately
    const cleanup = rotateImages(currentImage, isMounted, setCurrentImage, isGenerating, 5);
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (cleanup) {
        cleanup();
      }
    };
  }, [isGenerating, loadingImages, imagesLoaded]);
  
  useEffect(() => {
    // loadImages function moved to utils/renderUtils.js
    loadImages(setImagesLoaded, setLoadingImages, API_BASE_URL);
  }, [API_BASE_URL]);
  
  // Initialize editable requirements when extractedRequirements changes
  useEffect(() => {
    if (extractedRequirements) {
      const requirements = parseRequirementsTable(extractedRequirements, requirementsSource, jiraTicketPrefix, jiraTicketInfo, setJiraTicketPrefix, setJiraTicketInfo);
      setEditableRequirements(requirements);
      setHasUnsavedChanges(false);
    }
  }, [extractedRequirements, jiraTicketInfo, jiraTicketPrefix, requirementsSource]);
  
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
                  {loadingImages && loadingImages.length > 0 ? (
                    <>
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
                            onLoad={() => {
                              // Image loaded successfully
                            }}
                            onError={(e) => {
                              // Image failed to load
                            }}
                          />
                          <span>{imageStep.title}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="test-image active">
                      <div className="loading-placeholder">
                        <span>Loading...</span>
                      </div>
                    </div>
                  )}
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
          onDragOver={handleDragOverWrapper}
          onDragLeave={handleDragLeaveWrapper}
          onDrop={handleDropWrapper}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUploadWrapper}
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.rtf,.odt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp,.svg,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.vsd,.vsdx"
            style={{ display: 'none' }}
          />
          
          {isProcessing ? (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <h4 style={{ color: '#2d3748', marginBottom: '0.5rem' }}>
                  📄 Document Analysis in Progress
                </h4>
                <p className="processing-text" style={{ color: '#4a5568', marginBottom: '0.5rem' }}>
                  Analyzing: {processingFile}
                </p>
                <div style={{ 
                  background: '#f7fafc', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0',
                  marginTop: '1rem'
                }}>
                  <h5 style={{ color: '#2d3748', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    🔍 What's happening:
                  </h5>
                  <ul style={{ 
                    color: '#4a5568', 
                    fontSize: '0.85rem', 
                    margin: '0', 
                    paddingLeft: '1.5rem',
                    lineHeight: '1.5'
                  }}>
                    <li>Extracting text content from document</li>
                    <li>Identifying business requirements and acceptance criteria</li>
                    <li>Structuring requirements in table format</li>
                    <li>Preparing for test case generation</li>
                  </ul>
                </div>
              </div>
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

        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📄 Uploaded Files
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {uploadedFiles.map((file) => (
                <div key={file.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#2d3748' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#718096' }}>
                      ({formatFileSize(file.size)})
                    </span>
                    {file.status === 'processing' && (
                      <span style={{ fontSize: '0.8rem', color: '#3182ce' }}>
                        ⏳ Processing...
                      </span>
                    )}
                    {file.status === 'completed' && (
                      <span style={{ fontSize: '0.8rem', color: '#38a169' }}>
                        ✅ Completed
                      </span>
                    )}
                    {file.status === 'failed' && (
                      <span style={{ fontSize: '0.8rem', color: '#e53e3e' }}>
                        ❌ Failed
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeFileWrapper(file.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e53e3e',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import from Jira Section */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/jira-icon.svg" alt="Jira" style={{ width: '18px', height: '18px' }} />
            Import from Jira
          </h3>
          <p style={{ marginBottom: '1rem', color: '#4a5568', fontSize: '0.9rem' }}>
            Import Epics, Stories, Tasks and Bugs directly from your Jira Projects.
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setShowJiraImport(true);
              // If connection is active, go directly to project selection
              if (jiraConnectionActive) {
                setJiraStep('select');
                // If projects are empty, refetch them
                if (jiraProjects.length === 0) {
                  axios.get(`${API_BASE_URL}/api/jira/projects`)
                    .then(response => {
                      if (response.data.success) {
                        setJiraProjects(response.data.projects || []);
                        if (response.data.jiraBaseUrl) {
                          setJiraConfig(prev => ({ ...prev, baseUrl: response.data.jiraBaseUrl }));
                        }
                      }
                    })
                    .catch(error => {
                      console.error('Error fetching Jira projects:', error);
                      setStatus({ type: 'error', message: 'Failed to fetch Jira projects' });
                    });
                }
              } else {
                setJiraStep('connect');
                setJiraConfig({
                  projectKey: '',
                  issueTypes: [],
                  selectedIssues: [],
                  baseUrl: '' // Will be set from backend response
                });
              }
            }}
            title="Import test cases from Jira"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <img src="/jira-icon.svg" alt="Jira" style={{ width: '18px', height: '18px' }} />
            Import from Jira
          </button>
        </div>

        {/* Extracted Business Requirements Section */}
        {extractedRequirements && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#2d3748' }}>
              Extracted Business Requirements
              {hasUnsavedChanges && (
                <span style={{ 
                  marginLeft: '10px', 
                  fontSize: '0.8rem', 
                  color: '#f59e0b', 
                  fontWeight: 'normal',
                  backgroundColor: '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid #fbbf24'
                }}>
                  ⚠️ Unsaved Changes
                </span>
              )}
            </h3>
            
            {/* Proper table display - not markdown */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1rem',
              overflow: 'auto',
              maxHeight: '500px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px'
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center', fontWeight: 'bold', width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={isSelectAllChecked}
                        onChange={() => handleSelectAll(isSelectAllChecked, editableRequirements, setSelectedRequirements, setIsSelectAllChecked)}
                        style={{ transform: 'scale(1.2)' }}
                        title="Select All"
                      />
                    </th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Requirement ID</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Business Requirement</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Acceptance Criteria</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Complexity</th>
                  </tr>
                </thead>
                <tbody>
                  {editableRequirements && editableRequirements.length > 0 ? (
                    editableRequirements.map((req, index) => (
                    <tr key={index} style={{ 
                      backgroundColor: selectedRequirements.has(req.id) 
                        ? '#e3f2fd' 
                        : index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                      border: selectedRequirements.has(req.id) ? '2px solid #2196f3' : 'none'
                    }}>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedRequirements.has(req.id)}
                          onChange={() => handleSelectRequirement(req.id, selectedRequirements, setSelectedRequirements)}
                          style={{ transform: 'scale(1.2)' }}
                          title="Select this requirement"
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                        <textarea
                          value={req.id}
                          onChange={(e) => {
                            const newReqs = [...editableRequirements];
                            newReqs[index].id = e.target.value;
                            setEditableRequirements(newReqs);
                            setHasUnsavedChanges(true);
                          }}
                          style={{ 
                            width: '100%', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            resize: 'vertical',
                            minHeight: '40px',
                            fontFamily: 'inherit',
                            fontWeight: 'bold'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                        <textarea
                          value={req.requirement}
                          onChange={(e) => {
                            const newReqs = [...editableRequirements];
                            newReqs[index].requirement = e.target.value;
                            setEditableRequirements(newReqs);
                            setHasUnsavedChanges(true);
                          }}
                          style={{ 
                            width: '100%', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            resize: 'vertical',
                            minHeight: '80px',
                            fontFamily: 'inherit'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                        <textarea
                          value={req.acceptanceCriteria}
                          onChange={(e) => {
                            const newReqs = [...editableRequirements];
                            newReqs[index].acceptanceCriteria = e.target.value;
                            setEditableRequirements(newReqs);
                            setHasUnsavedChanges(true);
                          }}
                          style={{ 
                            width: '100%', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            resize: 'vertical',
                            minHeight: '80px',
                            fontFamily: 'inherit'
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                        <textarea
                          value={req.complexity || 'CC: 1, Paths: 1'}
                          onChange={(e) => {
                            const newReqs = [...editableRequirements];
                            newReqs[index].complexity = e.target.value;
                            setEditableRequirements(newReqs);
                            setHasUnsavedChanges(true);
                          }}
                          style={{ 
                            width: '100%', 
                            border: 'none', 
                            outline: 'none', 
                            background: 'transparent',
                            resize: 'vertical',
                            minHeight: '40px',
                            fontFamily: 'inherit',
                            fontSize: '12px'
                          }}
                          placeholder="CC: 1, Paths: 1"
                        />
                      </td>
                    </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                        {editableRequirements === null ? 'Loading requirements...' : 'No requirements found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Selection controls */}
            {editableRequirements && editableRequirements.length > 0 && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '12px', 
                backgroundColor: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 'bold', color: '#495057' }}>
                    {selectedRequirements.size} of {editableRequirements.length} selected
                  </span>
                  {selectedRequirements.size > 0 && (
                    <button
                      onClick={() => clearSelection(setSelectedRequirements, setIsSelectAllChecked)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleDeleteSelected(setShowDeleteConfirmation)}
                    disabled={selectedRequirements.size === 0}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: selectedRequirements.size === 0 ? '#6c757d' : '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: selectedRequirements.size === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title={selectedRequirements.size === 0 ? 'Select requirements to delete' : `Delete ${selectedRequirements.size} selected requirement(s)`}
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              </div>
            )}
            
            {/* Simple action buttons */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                style={{
                  backgroundColor: '#3b82f6',
                  borderColor: '#3b82f6',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#2563eb';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#3b82f6';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                }}
                onClick={() => {
                 
                  // Validate complexity values and show warnings
                  const complexityWarnings = validateComplexityValues(editableRequirements);
                  if (complexityWarnings.length > 0) {
                    console.warn('⚠️ Complexity Validation Warnings:', complexityWarnings);
                    setStatus({ 
                      type: 'warning', 
                      message: `Requirements inserted! ${complexityWarnings.length} complexity warnings found. Check console for details.` 
                    });
                  } else {
                    setStatus({ type: 'success', message: 'Requirements inserted with headers and generated IDs! You can now generate test cases.' });
                  }
                  
                  // Format requirements properly with headers and generated IDs for insertion
                  const formattedContent = formatRequirementsForInsertionWithGeneratedIds(editableRequirements);
                  setContent(formattedContent);
                }}
              >
                Insert Requirements
              </button>
              <button 
                className="btn btn-secondary"
                disabled={!hasUnsavedChanges}
                style={{
                  backgroundColor: hasUnsavedChanges ? '#10b981' : '#9ca3af',
                  borderColor: hasUnsavedChanges ? '#10b981' : '#9ca3af',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: hasUnsavedChanges ? '0 2px 4px rgba(16, 185, 129, 0.2)' : 'none',
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  opacity: hasUnsavedChanges ? 1 : 0.6
                }}
                onMouseEnter={(e) => {
                  if (hasUnsavedChanges) {
                    e.target.style.backgroundColor = '#059669';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasUnsavedChanges) {
                    e.target.style.backgroundColor = '#10b981';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                  }
                }}
                onClick={async () => {
                  try {
                    // Sync editable requirements back to extractedRequirements with proper markdown table format
                    const tableHeader = '| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |';
                    const tableSeparator = '|---|---|---|---|';
                    const tableRows = editableRequirements.map(r => `| ${r.id} | ${r.requirement} | ${r.acceptanceCriteria} | ${r.complexity || 'CC: 1, Paths: 1'} |`).join('\n');
                    const newContent = `${tableHeader}\n${tableSeparator}\n${tableRows}`;
                    
                    setExtractedRequirements(newContent);
                    setHasUnsavedChanges(false);
                    
                    // Save edited requirements to cache if we have a current document
                    if (currentDocumentName) {
                      try {
                        await axios.post(`${API_BASE_URL}/api/save-edited-requirements`, {
                          documentName: currentDocumentName,
                          requirements: newContent
                        });
                        setStatus({ type: 'success', message: 'Changes saved successfully and cached!' });
                      } catch (error) {
                        console.error('Failed to save to cache:', error);
                        setStatus({ type: 'success', message: 'Changes saved locally!' });
                      }
                    } else {
                      setStatus({ type: 'success', message: 'Changes saved successfully!' });
                    }
                  } catch (error) {
                    console.error('Error saving changes:', error);
                    setStatus({ type: 'error', message: 'Failed to save changes!' });
                  }
                }}
              >
                Save Changes
              </button>
              <button 
                className="btn btn-secondary"
                disabled={!hasUnsavedChanges}
                style={{
                  backgroundColor: hasUnsavedChanges ? '#f59e0b' : '#9ca3af',
                  borderColor: hasUnsavedChanges ? '#f59e0b' : '#9ca3af',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: hasUnsavedChanges ? '0 2px 4px rgba(245, 158, 11, 0.2)' : 'none',
                  cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
                  opacity: hasUnsavedChanges ? 1 : 0.6
                }}
                onMouseEnter={(e) => {
                  if (hasUnsavedChanges) {
                    e.target.style.backgroundColor = '#d97706';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasUnsavedChanges) {
                    e.target.style.backgroundColor = '#f59e0b';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                  }
                }}
                onClick={() => {
                  // Reset to original requirements
                  const requirements = parseRequirementsTable(extractedRequirements, requirementsSource, jiraTicketPrefix, jiraTicketInfo, setJiraTicketPrefix, setJiraTicketInfo);
                  setEditableRequirements(requirements);
                  setHasUnsavedChanges(false);
                  setStatus({ type: 'info', message: 'Changes reset to original requirements.' });
                }}
              >
                Reset Changes
              </button>
              
              <button 
                className="btn btn-secondary"
                style={{
                  backgroundColor: '#06b6d4',
                  borderColor: '#06b6d4',
                  color: 'white',
                  fontWeight: '600',
                  transition: 'all 0.2s ease-in-out',
                  boxShadow: '0 2px 4px rgba(6, 182, 212, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#0891b2';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(6, 182, 212, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#06b6d4';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(6, 182, 212, 0.2)';
                }}
                onClick={async () => {
                  if (editableRequirements.length === 0) {
                    setStatus({ type: 'warning', message: 'No requirements to validate. Please extract requirements first.' });
                    return;
                  }
                  
                  try {
                    const response = await axios.post(`${API_BASE_URL}/api/validate-requirements`, {
                      requirements: editableRequirements
                    });
                    
                    if (response.data.success) {
                      const validation = response.data.validation;
                      const score = validation.overallScore;
                      // const color = score >= 90 ? '#10b981' : score >= 80 ? '#f59e0b' : '#ef4444';
                      
                      setStatus({ 
                        type: 'success', 
                        message: `Requirements Quality Score: ${score}% - ${validation.recommendations[0]}` 
                      });
                      
                      // Show detailed validation results
                    }
                  } catch (error) {
                    console.error('Error validating requirements:', error);
                    setStatus({ 
                      type: 'error', 
                      message: 'Failed to validate requirements. Please try again.' 
                    });
                  }
                }}
              >
                Validate Quality
              </button>
              <button 
                className="btn btn-secondary"
                style={{
                  backgroundColor: '#6b7280',
                  borderColor: '#6b7280',
                  color: 'white',
                  fontWeight: '600'
                }}
                onClick={() => navigator.clipboard.writeText(extractedRequirements)}
              >
                Copy
              </button>
              <button 
                className="btn btn-secondary"
                style={{
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  color: 'white',
                  fontWeight: '600'
                }}
                onClick={() => handleDownloadContent(extractedRequirements, API_BASE_URL)}
              >
                Download
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Input Section */}
      <div className="card">
        <h2 className="card-title">
          <Sparkles size={24} />
          Generate Cucumber Test Cases
        </h2>
        
        {/* Requirements Section */}
        <div className="form-group">
          <label className="form-label">Requirements / User Story / Content</label>
          <textarea
            className="form-textarea"
            placeholder="Enter your requirements, user stories, or any content you want to convert to Cucumber test cases... You can also upload a file above."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
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

        <div className="flex gap-4" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              className="btn btn-primary"
              onClick={generateTestsWrapper}
              disabled={isLoading || !content.trim()}
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
              className="btn btn-danger"
              onClick={() => setShowClearAllConfirmation(true)}
              disabled={isLoading}
            >
              Clear All
            </button>
            
            <button
              className="btn btn-primary"
              onClick={() => {
                if (featureTabs.length > 0) {
                  // Clear requirements, generated test content, and the test generation textarea content
                  setExtractedRequirements('');
                  setGeneratedTests('');
                  setContent('');
                  setShowModal(true);
                } else {
                  setStatus({ type: 'error', message: 'No test cases available to display. Please generate tests first.' });
                }
              }}
              disabled={isLoading || featureTabs.length === 0}
            >
              View Generated Test
            </button>
          </div>
          
          <button
            className="btn btn-secondary"
            style={{
              backgroundColor: '#dc3545',
              borderColor: '#dc3545',
              color: 'white',
              fontWeight: '600'
            }}
            onClick={() => openCacheModal(setShowCacheModal, fetchCacheListWrapper)}
            title="Manage cached documents"
          >
            🗑️ Delete Cache
          </button>
        </div>
      </div>



      
      {/* Empty State */}
      {!generatedTests && !extractedRequirements && (
        <div className="card">
          <h3 className="card-title">How to Use</h3>
          <div className="text-center">
            <p className="mb-2">
              Upload documents (PDF, DOCX, TXT, etc.) or enter your requirements in the text area above. 
              The AI will automatically extract business requirements and generate comprehensive Cucumber test cases in Gherkin syntax.
            </p>
          </div>
        </div>
      )}

      {/* Test Cases Modal */}
      {showModal && ((generatedTests && generatedTests.trim()) || featureTabs.length > 0) && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <TestTube size={24} />
                {generatedTests && generatedTests.trim() ? 'Generated Test Cases' : 'Test Cases'}
              </h2>
              
              {/* Coverage Summary */}
              {featureTabs.length > 0 && featureTabs[0].coverage && (
                <div className="coverage-summary">
                  <div className="coverage-stats">
                    <span className="stat-item">
                      <strong>Total Scenarios:</strong> {featureTabs.reduce((sum, f) => sum + (f.coverage?.scenarioCount || 0), 0)}
                    </span>
                    <span className="stat-item">
                      <strong>Expected Paths:</strong> {featureTabs.reduce((sum, f) => sum + (f.coverage?.expectedPaths || 0), 0)}
                    </span>
                    <span className="stat-item">
                      <strong>Coverage:</strong> 
                      <span className={`coverage-percentage ${featureTabs.reduce((sum, f) => sum + (f.coverage?.coveragePercentage || 0), 0) >= 100 ? 'good' : 'warning'}`}>
                        {Math.round(featureTabs.reduce((sum, f) => sum + (f.coverage?.coveragePercentage || 0), 0) / featureTabs.length)}%
                      </span>
                    </span>
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button 
                  className="btn btn-info"
                  onClick={async () => {
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
                      
                      // Save edited tests to cache if we have a current document
                      if (currentDocumentName) {
                        try {
                          // Combine all test content
                          const allTestContent = updatedFeatures.map(f => f.content).join('\n\n');
                          await axios.post(`${API_BASE_URL}/api/save-edited-tests`, {
                            documentName: currentDocumentName,
                            tests: allTestContent
                          });
                          setStatus({ type: 'success', message: `Updated "${currentFeature.title}" and saved to cache!` });
                        } catch (error) {
                          console.error('Failed to save tests to cache:', error);
                          setStatus({ type: 'success', message: `Updated "${currentFeature.title}"!` });
                        }
                      } else {
                        setStatus({ type: 'success', message: `Updated "${currentFeature.title}"!` });
                      }
                    } else {
                      // Start editing current feature
                      setEditingFeatures(prev => ({ ...prev, [activeTab]: true }));
                    }
                  }}
                  disabled={pushedTabs.has(activeTab)}
                  title={pushedTabs.has(activeTab) ? "Cannot edit after pushing to Zephyr" : (editingFeatures[activeTab] ? "Save changes" : "Edit current feature")}
                >
                  {editingFeatures[activeTab] ? (
                    <>
                      <CheckCircle size={16} />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit size={16} />
                      Edit
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-warning"
                  onClick={refineTestsWrapper}
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
                    <div className="tab-content">
                      <span className="tab-title">{feature.title}</span>
                      
                      {/* Coverage Information */}
                      {feature.coverage && (
                        <div className="coverage-info">
                          <span 
                            className={`coverage-badge ${feature.coverage.isAdequateCoverage ? 'good' : 'warning'}`}
                            title={`${feature.coverage.scenarioCount} scenarios, ${feature.coverage.expectedPaths} expected paths (${feature.coverage.coveragePercentage}% coverage)`}
                          >
                            {feature.coverage.scenarioCount}/{feature.coverage.expectedPaths}
                          </span>
                          {!feature.coverage.isAdequateCoverage && (
                            <span className="coverage-warning" title={`Missing: ${feature.coverage.missingTestTypes.join(', ')}`}>
                              ⚠️
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Jira Ticket Info */}
                      {jiraTicketInfo[index] && (
                        <span 
                          title={`Jira Ticket: ${jiraTicketInfo[index].ticketKey}`}
                          style={{
                            marginLeft: '8px',
                            fontSize: '0.7rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontWeight: 'normal'
                          }}
                        >
                          🔗
                        </span>
                      )}
                    </div>
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
                  className="btn btn-success"
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
                  className="btn btn-info"
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
                  className="btn btn-primary"
                  onClick={() => {
                    // const currentFeature = featureTabs[activeTab];
                    setZephyrConfig({
                      projectKey: '',
                      testCaseName: '',
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
                <div style={{ position: 'relative' }} className="project-dropdown-container">
                  <input
                    type="text"
                    placeholder="Click to select project..."
                    value={zephyrConfig.projectKey ? (() => {
                      const project = zephyrProjects.find(p => p.key === zephyrConfig.projectKey);
                      return project && project.name ? `${project.name} (${zephyrConfig.projectKey})` : zephyrConfig.projectKey;
                    })() : ''}
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    readOnly
                    required
                    disabled={loadingProjects}
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
                  {showProjectDropdown && (
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
                        Select a project ({zephyrProjects.filter(project => 
                          ((project.name && project.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
                           (project.key && project.key.toLowerCase().includes(projectSearch.toLowerCase())))
                        ).length} available)
                      </div>
                      <div style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb'
                      }}>
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={projectSearch}
                          onChange={(e) => setProjectSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            backgroundColor: '#ffffff'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                        <div
                          style={{
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: zephyrConfig.projectKey === '' ? '#e3f2fd' : 'transparent'
                          }}
                          onClick={() => {
                            handleProjectChange('', setZephyrConfig, fetchAllFoldersWrapper);
                            setShowProjectDropdown(false);
                            setProjectSearch(''); // Clear search when option is selected
                          }}
                        >
                          Select a project...
                        </div>
                        {zephyrProjects
                          .filter(project => 
                            ((project.name && project.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
                             (project.key && project.key.toLowerCase().includes(projectSearch.toLowerCase())))
                          )
                          .map((project) => (
                            <div
                              key={project.key}
                              style={{
                                padding: '0.5rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: zephyrConfig.projectKey === project.key ? '#e3f2fd' : 'transparent'
                              }}
                              onClick={() => {
                                handleProjectChange(project.key, setZephyrConfig, fetchAllFoldersWrapper);
                                setShowProjectDropdown(false);
                                setProjectSearch(''); // Clear search when project is selected
                              }}
                            >
                              {project.name} ({project.key})
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
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
                        {/* Breadcrumb Navigation */}
                        {folderNavigation.breadcrumb.length > 0 && (
                          <div style={{
                            padding: '0.5rem',
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: '#f0f9ff',
                            fontSize: '0.75rem',
                            color: '#0369a1'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              <span
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => {
                                  fetchAllFoldersWrapper(zephyrConfig.projectKey);
                                  setFolderSearch('');
                                }}
                              >
                                📁 Main Folders
                              </span>
                              {folderNavigation.breadcrumb.map((crumb, index) => (
                                <span key={crumb.id}>
                                  <span style={{ margin: '0 4px', color: '#6b7280' }}>›</span>
                                  <span
                                    style={{ 
                                      cursor: 'pointer', 
                                      textDecoration: index === folderNavigation.breadcrumb.length - 1 ? 'none' : 'underline',
                                      fontWeight: index === folderNavigation.breadcrumb.length - 1 ? 'bold' : 'normal'
                                    }}
                                    onClick={() => {
                                      if (index < folderNavigation.breadcrumb.length - 1) {
                                        // Navigate to this breadcrumb level
                                        const targetBreadcrumb = folderNavigation.breadcrumb[index];
                                        const newBreadcrumb = folderNavigation.breadcrumb.slice(0, index + 1);
                                        setFolderNavigation(prev => ({
                                          ...prev,
                                          currentLevel: 'subfolder',
                                          parentFolderId: targetBreadcrumb.id,
                                          parentFolderName: targetBreadcrumb.name,
                                          breadcrumb: newBreadcrumb
                                        }));
                                        // Navigate to the selected breadcrumb level
                                        const targetFolders = zephyrFolders.filter(folder => 
                                          folder.parentId === targetBreadcrumb.id
                                        );
                                        setZephyrFolders(targetFolders);
                                      }
                                    }}
                                  >
                                    📂 {crumb.name}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Header with current level info */}
                        <div style={{
                          padding: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: '#f9fafb',
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          {searchMode ? (
                            `🔍 Search Results (${zephyrFolders.filter(folder => 
                              folder.name.toLowerCase().includes(folderSearch.toLowerCase()) ||
                              String(folder.id).toLowerCase().includes(folderSearch.toLowerCase())
                            ).length} found)`
                          ) : (
                            `📁 All Folders (${zephyrFolders.filter(folder => 
                              folder.name.toLowerCase().includes(folderSearch.toLowerCase()) ||
                              String(folder.id).toLowerCase().includes(folderSearch.toLowerCase())
                            ).length} available)`
                          )}
                        </div>

                        {/* Search and Navigation Controls */}
                        <div style={{
                          padding: '0.5rem',
                          borderBottom: '1px solid #e5e7eb',
                          backgroundColor: '#f9fafb',
                          display: 'flex',
                          gap: '8px'
                        }}>
                          <input
                            type="text"
                            placeholder="Search folders..."
                            value={folderSearch}
                            onChange={(e) => {
                              setFolderSearch(e.target.value);
                              if (e.target.value.trim()) {
                                searchFoldersWrapper(zephyrConfig.projectKey, e.target.value);
                              } else if (folderNavigation.currentLevel === 'search') {
                                // Return to previous level when search is cleared
                                if (folderNavigation.currentLevel === 'subfolder') {
                                  // Return to subfolder view
                                  const subfolders = zephyrFolders.filter(folder => 
                                    folder.parentId === folderNavigation.parentFolderId
                                  );
                                  setZephyrFolders(subfolders);
                                } else {
                                  fetchAllFoldersWrapper(zephyrConfig.projectKey);
                                }
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#ffffff'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {folderNavigation.currentLevel === 'subfolder' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchAllFoldersWrapper(zephyrConfig.projectKey);
                                setFolderSearch('');
                              }}
                              style={{
                                padding: '0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#ffffff',
                                cursor: 'pointer'
                              }}
                              title="Back to main folders"
                            >
                              ← Back
                            </button>
                          )}
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
                              setFolderSearch('');
                              setSearchMode(false);
                              setFolderNavigation({
                                currentLevel: 'main',
                                parentFolderId: null,
                                parentFolderName: '',
                                breadcrumb: []
                              });
                            }}
                          >
                            No folder (optional)
                          </div>
                          {(() => {
                            const renderFolderTree = (folders, level = 0) => {
                              return folders.map((folder) => {
                                const hasChildren = folder.children && folder.children.length > 0;
                                const isExpanded = expandedFolders.has(folder.id);
                                
                                return (
                                  <div key={folder.id}>
                                    <div
                                      style={{
                                        padding: '0.5rem',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #f3f4f6',
                                        backgroundColor: zephyrConfig.folderId === folder.id ? '#e3f2fd' : 'transparent',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        paddingLeft: `${0.5 + (level * 1.5)}rem`
                                      }}
                                      onClick={() => {
                                        if (searchMode) {
                                          // In search mode, select the folder
                                          setZephyrConfig(prev => ({ ...prev, folderId: folder.id }));
                                          setShowFolderDropdown(false);
                                          setFolderSearch('');
                                          setSearchMode(false);
                                          setFolderNavigation({
                                            currentLevel: 'main',
                                            parentFolderId: null,
                                            parentFolderName: '',
                                            breadcrumb: []
                                          });
                                        } else {
                                          // Select this folder
                                          setZephyrConfig(prev => ({ ...prev, folderId: folder.id }));
                                          setShowFolderDropdown(false);
                                          setFolderSearch('');
                                        }
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {hasChildren && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleFolderExpansion(folder.id, expandedFolders, setExpandedFolders);
                                            }}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '2px',
                                              fontSize: '0.75rem',
                                              color: '#6b7280'
                                            }}
                                            title={isExpanded ? 'Collapse' : 'Expand'}
                                          >
                                            {isExpanded ? '▼' : '▶'}
                                          </button>
                                        )}
                                        {!hasChildren && level > 0 && (
                                          <span style={{ width: '12px' }}></span>
                                        )}
                                        <span>{folder.name}</span>
                                      </div>
                                      {hasChildren && (
                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>📁</span>
                                        </div>
                                      )}
                                    </div>
                                    {hasChildren && isExpanded && (
                                      <div>
                                        {renderFolderTree(folder.children, level + 1)}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            };

                            if (searchMode) {
                              const filteredFolders = zephyrFolders.filter(folder => 
                                folder.name.toLowerCase().includes(folderSearch.toLowerCase()) ||
                                String(folder.id).toLowerCase().includes(folderSearch.toLowerCase())
                              );
                              return filteredFolders.map((folder) => (
                                <div
                                  key={folder.id}
                                  style={{
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f3f4f6',
                                    backgroundColor: zephyrConfig.folderId === folder.id ? '#e3f2fd' : 'transparent',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                  onClick={() => {
                                    setZephyrConfig(prev => ({ ...prev, folderId: folder.id }));
                                    setShowFolderDropdown(false);
                                    setFolderSearch('');
                                    setSearchMode(false);
                                    setFolderNavigation({
                                      currentLevel: 'main',
                                      parentFolderId: null,
                                      parentFolderName: '',
                                      breadcrumb: []
                                    });
                                  }}
                                >
                                  <span>{folder.name}</span>
                                </div>
                              ));
                            } else {
                              const folderTree = buildFolderTree(zephyrFolders);
                              return renderFolderTree(folderTree, 0);
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => zephyrConfig.projectKey && fetchZephyrFoldersWrapper(zephyrConfig.projectKey)}
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
                <label htmlFor="testCaseName">Test Case Name (optional)</label>
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
                  className="btn btn-danger"
                  onClick={() => setShowZephyrConfig(false)}
                >
                  <X size={16} />
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
                    
                    const result = await pushToZephyrWrapper(
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
                      const newPushedTabs = new Set([...pushedTabs, activeTab]);
                      const newTestCaseIds = {
                        ...zephyrTestCaseIds,
                        [activeTab]: result.zephyrTestCaseIds || [result.zephyrTestCaseId]
                      };
                      
                      setPushedTabs(newPushedTabs);
                      setZephyrTestCaseIds(newTestCaseIds);
                      
                      // Save pushed state to cache
                      if (requirementsSource === 'jira' && jiraTicketInfo[activeTab]?.ticketKey) {
                        // For Jira issues, save pushed state using the Jira ticket key with "jira-" prefix
                        const issuePushedTabs = new Set([0]); // Map to index 0 for the issue
                        const issueTestCaseIds = { 0: result.zephyrTestCaseIds || [result.zephyrTestCaseId] };
                        const jiraDocumentName = `jira-${jiraTicketInfo[activeTab].ticketKey}`;
                        savePushedStateToCache(issuePushedTabs, issueTestCaseIds, jiraDocumentName, jiraTicketInfo, API_BASE_URL);
                      } else if (currentDocumentName) {
                        // For uploaded documents, save normally
                        savePushedStateToCache(newPushedTabs, newTestCaseIds, currentDocumentName, jiraTicketInfo, API_BASE_URL);
                      }
                      
                      setStatus({ 
                        type: 'success', 
                        message: `Successfully ${zephyrTestCaseIds[activeTab] ? 'updated' : 'pushed'} to Zephyr Scale! ${result.zephyrTestCaseIds ? `${result.zephyrTestCaseIds.length} test cases` : 'Test Case ID: ' + result.zephyrTestCaseId}${jiraTicketInfo[activeTab] ? ` | Jira ticket ${jiraTicketInfo[activeTab].ticketKey} automatically added to coverage` : ''}` 
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
        <div 
          className="modal-overlay" 
          data-modal="jira-import" 
          onClick={() => {
            setShowJiraImport(false);
          }}
          style={{ zIndex: 1000 }}
        >
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
                  
                  <div className="form-group">
                    <label htmlFor="jiraBaseUrl">Jira Base URL *</label>
                    <input
                      type="url"
                      id="jiraBaseUrl"
                      placeholder="Will be configured automatically from backend"
                      value={jiraConfig.baseUrl}
                      onChange={(e) => setJiraConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem'
                      }}
                      readOnly
                      disabled
                    />
                    <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                      This URL is automatically configured from your backend environment variables.
                      <br />
                      <strong>Current:</strong> {jiraConfig.baseUrl || 'Not configured yet'}
                    </small>
                  </div>
                  
                  <div className="modal-footer">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowJiraImport(false)}
                        style={{ marginRight: 'auto' }}
                      >
                        Close
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={testJiraConnectionWrapper}
                        disabled={isLoadingJira}
                      >
                        {isLoadingJira ? (
                          <>
                            <div className="spinner small"></div>
                            <span>Connecting...</span>
                          </>
                        ) : (
                          'Connect to Jira'
                        )}
                      </button>
                    </div>
                    
                    {jiraConfig.baseUrl && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '8px', 
                        backgroundColor: '#d1fae5', 
                        border: '1px solid #10b981', 
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: '#065f46'
                      }}>
                        ✅ Jira Base URL configured: {jiraConfig.baseUrl}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Select Project and Issues */}
              {jiraStep === 'select' && (
                <div>
                  <h4 style={{ marginBottom: '1rem', color: '#2d3748' }}>Step 2: Select Project and Issues</h4>
                  
                  {/* Connection Status */}
                  {jiraConnectionActive && (
                    <div style={{ 
                      background: '#f0f9ff', 
                      border: '1px solid #0ea5e9', 
                      borderRadius: '6px', 
                      padding: '12px', 
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          backgroundColor: '#10b981' 
                        }}></div>
                        <span style={{ color: '#0c4a6e', fontSize: '0.9rem', fontWeight: '500' }}>
                          Connected to {jiraConfig.baseUrl}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setJiraConnectionActive(false);
                          setJiraStep('connect');
                          setJiraConfig({
                            projectKey: '',
                            issueTypes: [],
                            selectedIssues: [],
                            baseUrl: ''
                          });
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid #0ea5e9',
                          color: '#0ea5e9',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Change Connection
                      </button>
                    </div>
                  )}
                  
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
                              <div style={{ marginBottom: '0.5rem' }}>
                                <input
                                  type="text"
                                  placeholder="Type to search projects..."
                                  value={jiraProjectSearch}
                                  onChange={(e) => setJiraProjectSearch(e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.75rem',
                                    backgroundColor: 'white'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {(() => {
                                  const filteredProjects = jiraProjects.filter(project => 
                                    project.name.toLowerCase().includes(jiraProjectSearch.toLowerCase()) ||
                                    project.key.toLowerCase().includes(jiraProjectSearch.toLowerCase())
                                  );
                                  return `Showing ${filteredProjects.length} of ${jiraProjects.length} projects`;
                                })()}
                              </div>
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {jiraProjects
                                .filter(project => 
                                  project.name.toLowerCase().includes(jiraProjectSearch.toLowerCase()) ||
                                  project.key.toLowerCase().includes(jiraProjectSearch.toLowerCase())
                                )
                                .map((project) => (
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
                                      setJiraProjectSearch(''); // Clear search when selecting
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
                        {['Epic', 'Story', 'Task', 'Bug'].map((type) => (
                          <label key={type} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            opacity: !jiraConfig.projectKey ? 0.5 : 1,
                            cursor: !jiraConfig.projectKey ? 'not-allowed' : 'pointer'
                          }}>
                            <input
                              type="checkbox"
                              checked={jiraConfig.issueTypes.includes(type)}
                              disabled={!jiraConfig.projectKey}
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowJiraImport(false)}
                        style={{ marginRight: 'auto' }}
                      >
                        Close
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={fetchJiraIssuesWrapper}
                        disabled={isLoadingJira || !jiraConfig.projectKey || jiraConfig.issueTypes.length === 0}
                      >
                        {isLoadingJira ? (
                          <>
                            <div className="spinner small"></div>
                            <span>Fetching...</span>
                          </>
                        ) : (
                          jiraCacheInfo.isCached && !shouldRefetchWrapper() ? 'Refresh' : 'Fetch'
                        )}
                      </button>
                      
                      {jiraCacheInfo.isCached && !shouldRefetchWrapper() && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={clearJiraCacheWrapper}
                          disabled={isLoadingJira}
                          title="Clear cache and force fresh fetch"
                        >
                          Clear Cache
                        </button>
                      )}
                    </div>
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
                  
                  {/* Cache Status and Pagination Controls */}
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0'
                  }}>
                    {/* Cache Status */}
                    {jiraCacheInfo.isCached && !shouldRefetchWrapper() && (
                      <div style={{ 
                        marginBottom: '8px', 
                        padding: '8px', 
                        backgroundColor: '#e6fffa', 
                        borderRadius: '4px',
                        border: '1px solid #81e6d9'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#234e52', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📦</span>
                          <span>Cached data from {jiraCacheInfo.lastFetched ? new Date(jiraCacheInfo.lastFetched).toLocaleTimeString() : 'recently'}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Pagination Controls */}
                    {(() => {
                      
                      return jiraPagination.totalItems > jiraPagination.itemsPerPage;
                    })() && (
                      <>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                            Showing {((jiraPagination.currentPage - 1) * jiraPagination.itemsPerPage) + 1}-{Math.min(jiraPagination.currentPage * jiraPagination.itemsPerPage, jiraPagination.totalItems)} of {jiraPagination.totalItems} issues
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => goToPageWrapper(jiraPagination.currentPage - 1)}
                              disabled={isLoadingJira || jiraPagination.currentPage <= 1}
                            >
                              Previous
                            </button>
                            <span style={{ 
                              padding: '6px 12px', 
                              fontSize: '0.9rem', 
                              color: '#4a5568',
                              alignSelf: 'center'
                            }}>
                              Page {jiraPagination.currentPage}
                            </span>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => goToPageWrapper(jiraPagination.currentPage + 1)}
                              disabled={isLoadingJira || jiraPagination.currentPage >= Math.ceil(jiraPagination.totalItems / jiraPagination.itemsPerPage)}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '12px', fontSize: '0.9rem', color: '#4a5568' }}>
                    Selected: {jiraConfig.selectedIssues.length} of {jiraIssues.length} issues
                  </div>
                  
                  <div className="modal-footer">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowJiraImport(false)}
                        style={{ marginRight: 'auto' }}
                      >
                        Close
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setJiraStep('select')}
                      >
                        Back
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={importJiraIssuesWrapper}
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirements Editor Modal */}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545' }}>
              🗑️ Delete Requirements
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#495057' }}>
              Are you sure you want to delete <strong>{selectedRequirements.size}</strong> selected requirement(s)?
            </p>
            <div style={{ marginBottom: '16px' }}>
              <strong>Requirements to be deleted:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', maxHeight: '150px', overflowY: 'auto' }}>
                {Array.from(selectedRequirements).map(reqId => {
                  const req = editableRequirements.find(r => r.id === reqId);
                  return (
                    <li key={reqId} style={{ marginBottom: '4px', fontSize: '14px' }}>
                      <strong>{reqId}:</strong> {req?.requirement?.substring(0, 50)}{req?.requirement?.length > 50 ? '...' : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#6c757d', fontSize: '14px' }}>
              This action cannot be undone. The requirements will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteSelected(editableRequirements, selectedRequirements, setEditableRequirements, setSelectedRequirements, setIsSelectAllChecked, setShowDeleteConfirmation, setHasUnsavedChanges, setStatus)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Delete {selectedRequirements.size} Requirement(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cache Delete Confirmation Dialog */}
      {showCacheDeleteConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545' }}>
              🗑️ Delete Cached Documents
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#495057' }}>
              Are you sure you want to delete <strong>{selectedCaches.size}</strong> selected document(s) from cache?
            </p>
            <div style={{ marginBottom: '16px' }}>
              <strong>Documents to be deleted:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: '20px', maxHeight: '150px', overflowY: 'auto' }}>
                {Array.from(selectedCaches).map(docName => {
                  const doc = cacheList.find(d => d.name === docName);
                  return (
                    <li key={docName} style={{ marginBottom: '4px', fontSize: '14px' }}>
                      <strong>{docName}</strong>
                      {doc && (
                        <span style={{ color: '#666', marginLeft: '8px' }}>
                          ({doc.requirementsCount} requirements, {doc.dateCached && doc.dateCached !== 'Unknown' ? new Date(doc.dateCached).toLocaleDateString() : 'Unknown date'})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p style={{ margin: '0 0 20px 0', color: '#6c757d', fontSize: '14px' }}>
              This action cannot be undone. The documents and all their cached data will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCacheDeleteConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteSelectedCaches(selectedCaches, currentDocumentName, API_BASE_URL, setStatus, clearAllWrapper, fetchCacheListWrapper, setSelectedCaches, setIsSelectAllCachesChecked, setShowCacheDeleteConfirmation)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Delete {selectedCaches.size} Document(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      {showClearAllConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#dc3545' }}>
              🧹 Clear All Data
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#495057' }}>
              Are you sure you want to clear all data? This will remove:
            </p>
            <ul style={{ margin: '0 0 20px 0', paddingLeft: '20px', color: '#495057' }}>
              <li>All uploaded files and extracted requirements</li>
              <li>Generated test cases and feature tabs</li>
              <li>Jira imported data (connection will be preserved)</li>
              <li>Zephyr configuration and pushed state</li>
              <li>All form inputs and selections</li>
            </ul>
            <p style={{ margin: '0 0 20px 0', color: '#6c757d', fontSize: '14px' }}>
              <strong>This action cannot be undone.</strong> You will need to start over from the beginning.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClearAllConfirmation(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAllWrapper();
                  setShowClearAllConfirmation(false);
                  setStatus({ type: 'info', message: 'All data has been cleared. You can now start fresh.' });
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cache Management Modal */}
      {showCacheModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#dc3545' }}>
                🗑️ Cache Management
              </h3>
              <button
                onClick={() => setShowCacheModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            {/* Cache List */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              border: '1px solid #dee2e6', 
              borderRadius: '6px',
              marginBottom: '20px'
            }}>
              {isLoadingCache ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Loading cache list...
                </div>
              ) : cacheList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No cached documents found
                </div>
              ) : (
                <div>
                  {/* Header with Select All */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #dee2e6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <input
                      type="checkbox"
                      checked={isSelectAllCachesChecked}
                      onChange={() => handleSelectAllCaches(isSelectAllCachesChecked, cacheList, setSelectedCaches, setIsSelectAllCachesChecked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                    <span style={{ fontWeight: 'bold' }}>Select All</span>
                    <span style={{ marginLeft: 'auto', color: '#666' }}>
                      {selectedCaches.size} of {cacheList.length} selected
                    </span>
                  </div>

                  {/* Document List */}
                  {cacheList.map((doc, index) => (
                    <div
                      key={doc.name}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid #dee2e6',
                        backgroundColor: selectedCaches.has(doc.name) ? '#e3f2fd' : 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCaches.has(doc.name)}
                        onChange={() => handleSelectCache(doc.name, selectedCaches, setSelectedCaches)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666', display: 'flex', gap: '16px' }}>
                          <span>📅 {doc.dateCached && doc.dateCached !== 'Unknown' ? new Date(doc.dateCached).toLocaleDateString() : 'Unknown date'}</span>
                          <span>📋 {doc.requirementsCount} requirements</span>
                          <span>
                            {doc.hasAnalysis && '📄'} 
                            {doc.hasRequirements && '📋'} 
                            {doc.hasTests && '🧪'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowCacheModal(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={fetchCacheListWrapper}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>
              <button
                onClick={() => handleDeleteSelectedCaches(selectedCaches, setShowCacheDeleteConfirmation)}
                disabled={selectedCaches.size === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: selectedCaches.size === 0 ? '#6c757d' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedCaches.size === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Delete Selected ({selectedCaches.size})
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default TestGenerator; 