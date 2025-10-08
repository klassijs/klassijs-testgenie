// UI State Management utility functions for TestGenerator component
// These functions were extracted from TestGenerator.js to improve code organization

/**
 * Handles clicks outside dropdown elements to close them
 * @param {Event} event - The click event
 * @param {boolean} showFolderDropdown - Whether folder dropdown is shown
 * @param {boolean} showProjectDropdown - Whether project dropdown is shown
 * @param {Function} setShowFolderDropdown - Function to set folder dropdown state
 * @param {Function} setShowProjectDropdown - Function to set project dropdown state
 */
export const handleClickOutside = (event, showFolderDropdown, showProjectDropdown, setShowFolderDropdown, setShowProjectDropdown) => {
  if (showFolderDropdown && !event.target.closest('.folder-dropdown-container')) {
    setShowFolderDropdown(false);
  }
  if (showProjectDropdown && !event.target.closest('.project-dropdown-container')) {
    setShowProjectDropdown(false);
  }
};

/**
 * Clears all application state
 * @param {Object} setters - Object containing all setter functions
 * @param {Function} clearPushedStateCache - Function to clear pushed state cache
 */
export const clearAll = (setters, clearPushedStateCache) => {
  const {
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
    setJiraIssueTypes,
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
  } = setters;

  // Clear main content and state
  setContent('');
  setContext('');
  setGeneratedTests('');
  setExtractedRequirements('');
  setUploadedFiles([]);
  setCurrentDocumentName(null);
  setShowModal(false);
  setActiveTab(0);
  setFeatureTabs([]);
  setEditableFeatures({});
  setEditingFeatures({});
  setStatus(null);
  
  // Clear selection state
  setSelectedRequirements(new Set());
  setIsSelectAllChecked(false);
  setShowDeleteConfirmation(false);
  
  // Clear cache management state
  setSelectedCaches(new Set());
  setIsSelectAllCachesChecked(false);
  setShowCacheModal(false);
  setShowCacheDeleteConfirmation(false);
  
  // Clear Jira-related content but keep connection active
  setRequirementsSource('');
  setJiraTicketPrefix('');
  setJiraTicketInfo({});
  // Keep jiraConnectionActive as is - don't reset connection
  setJiraIssueTypes([]);
  setShowJiraImport(false);
  setJiraConfig({
    baseUrl: '',
    projectKey: '',
    issueTypes: [],
    selectedIssues: []
  });
  // Don't clear projects and issues if connection is active - keep them for step 2
  if (!jiraConnectionActive) {
    setJiraProjects([]);
    setJiraIssues([]);
  }
  setIsLoadingJira(false);
  setJiraStep('connect');
  setShowJiraProjectDropdown(false);
  setJiraProjectSearch('');
  
  // Clear Zephyr-related state
  setShowZephyrConfig(false);
  setZephyrConfig({
    projectKey: '',
    folderId: null,
    testCaseName: '',
    status: 'Draft',
    isAutomatable: 'None'
  });
  setZephyrProjects([]);
  setZephyrFolders([]);
  setLoadingProjects(false);
  setLoadingFolders(false);
  setShowFolderDropdown(false);
  setFolderSearch('');
  setShowProjectDropdown(false);
  setProjectSearch('');
  setFolderNavigation({
    currentLevel: 'main',
    parentFolderId: null,
    parentFolderName: '',
    breadcrumb: []
  });
  setSearchMode(false);
  setExpandedFolders(new Set());
  setShowZephyrProgress(false);
  setZephyrProgress({
    current: 0,
    total: 0,
    message: '',
    isComplete: false
  });
  // Clear pushed state and cache
  clearPushedStateCache();
  
  // Clear processing states
  setIsLoading(false);
  setIsGenerating(false);
  setIsProcessing(false);
  setProcessingFile(null);
  
  // Clear any other state that might hold residue
  setLoadingImages([]);
  setImagesLoaded(false);
  
  console.log('🧹 Clear All: All state has been completely reset');
};

/**
 * Toggles folder expansion state
 * @param {string} folderId - The folder ID to toggle
 * @param {Set} expandedFolders - Current set of expanded folders
 * @param {Function} setExpandedFolders - Function to set expanded folders state
 */
export const toggleFolderExpansion = (folderId, expandedFolders, setExpandedFolders) => {
  setExpandedFolders(prev => {
    const newSet = new Set(prev);
    if (newSet.has(folderId)) {
      newSet.delete(folderId);
    } else {
      newSet.add(folderId);
    }
    return newSet;
  });
};

/**
 * Handles project change in Zephyr configuration
 * @param {string} projectKey - The selected project key
 * @param {Function} setZephyrConfig - Function to set Zephyr config
 * @param {Function} fetchAllFoldersWrapper - Function to fetch all folders
 */
export const handleProjectChange = (projectKey, setZephyrConfig, fetchAllFoldersWrapper) => {
  setZephyrConfig(prev => ({
    ...prev,
    projectKey: projectKey,
    folderId: '' // Reset folder when project changes
  }));
  fetchAllFoldersWrapper(projectKey); // Fetch all folders to show hierarchy
};

/**
 * Handles requirement selection toggle
 * @param {string} requirementId - The requirement ID to toggle
 * @param {Set} selectedRequirements - Current set of selected requirements
 * @param {Function} setSelectedRequirements - Function to set selected requirements state
 */
export const handleSelectRequirement = (requirementId, selectedRequirements, setSelectedRequirements) => {
  setSelectedRequirements(prev => {
    const newSet = new Set(prev);
    if (newSet.has(requirementId)) {
      newSet.delete(requirementId);
    } else {
      newSet.add(requirementId);
    }
    return newSet;
  });
};

/**
 * Handles select all requirements toggle
 * @param {boolean} isSelectAllChecked - Whether all requirements are currently selected
 * @param {Array} editableRequirements - Array of editable requirements
 * @param {Function} setSelectedRequirements - Function to set selected requirements state
 * @param {Function} setIsSelectAllChecked - Function to set select all state
 */
export const handleSelectAll = (isSelectAllChecked, editableRequirements, setSelectedRequirements, setIsSelectAllChecked) => {
  if (isSelectAllChecked) {
    setSelectedRequirements(new Set());
    setIsSelectAllChecked(false);
  } else {
    const allIds = new Set(editableRequirements.map(r => r.id));
    setSelectedRequirements(allIds);
    setIsSelectAllChecked(true);
  }
};

/**
 * Handles delete selected requirements action
 * @param {Function} setShowDeleteConfirmation - Function to show delete confirmation
 */
export const handleDeleteSelected = (setShowDeleteConfirmation) => {
  setShowDeleteConfirmation(true);
};

/**
 * Confirms and executes deletion of selected requirements
 * @param {Array} editableRequirements - Array of editable requirements
 * @param {Set} selectedRequirements - Set of selected requirement IDs
 * @param {Function} setEditableRequirements - Function to set editable requirements
 * @param {Function} setSelectedRequirements - Function to set selected requirements state
 * @param {Function} setIsSelectAllChecked - Function to set select all state
 * @param {Function} setShowDeleteConfirmation - Function to hide delete confirmation
 * @param {Function} setHasUnsavedChanges - Function to set unsaved changes state
 * @param {Function} setStatus - Function to set status message
 */
export const confirmDeleteSelected = async (
  editableRequirements, 
  selectedRequirements, 
  setEditableRequirements, 
  setSelectedRequirements, 
  setIsSelectAllChecked, 
  setShowDeleteConfirmation, 
  setHasUnsavedChanges, 
  setStatus
) => {
  try {
    const updatedRequirements = editableRequirements.filter(r => !selectedRequirements.has(r.id));
    setEditableRequirements(updatedRequirements);
    setSelectedRequirements(new Set());
    setIsSelectAllChecked(false);
    setShowDeleteConfirmation(false);
    setHasUnsavedChanges(true);
    
    setStatus({ type: 'success', message: `Deleted ${selectedRequirements.size} requirement(s)!` });
  } catch (error) {
    console.error('Error deleting requirements:', error);
    setStatus({ type: 'error', message: 'Failed to delete requirements!' });
  }
};

/**
 * Clears current selection
 * @param {Function} setSelectedRequirements - Function to set selected requirements state
 * @param {Function} setIsSelectAllChecked - Function to set select all state
 */
export const clearSelection = (setSelectedRequirements, setIsSelectAllChecked) => {
  setSelectedRequirements(new Set());
  setIsSelectAllChecked(false);
};

/**
 * Handles cache selection toggle
 * @param {string} cacheName - The cache name to toggle
 * @param {Set} selectedCaches - Current set of selected caches
 * @param {Function} setSelectedCaches - Function to set selected caches state
 */
export const handleSelectCache = (cacheName, selectedCaches, setSelectedCaches) => {
  setSelectedCaches(prev => {
    const newSet = new Set(prev);
    if (newSet.has(cacheName)) {
      newSet.delete(cacheName);
    } else {
      newSet.add(cacheName);
    }
    return newSet;
  });
};

/**
 * Handles select all caches toggle
 * @param {boolean} isSelectAllCachesChecked - Whether all caches are currently selected
 * @param {Array} cacheList - Array of cache documents
 * @param {Function} setSelectedCaches - Function to set selected caches state
 * @param {Function} setIsSelectAllCachesChecked - Function to set select all caches state
 */
export const handleSelectAllCaches = (isSelectAllCachesChecked, cacheList, setSelectedCaches, setIsSelectAllCachesChecked) => {
  if (isSelectAllCachesChecked) {
    setSelectedCaches(new Set());
    setIsSelectAllCachesChecked(false);
  } else {
    const allNames = new Set(cacheList.map(doc => doc.name));
    setSelectedCaches(allNames);
    setIsSelectAllCachesChecked(true);
  }
};

/**
 * Handles delete selected caches action
 * @param {Set} selectedCaches - Set of selected cache names
 * @param {Function} setShowCacheDeleteConfirmation - Function to show cache delete confirmation
 */
export const handleDeleteSelectedCaches = (selectedCaches, setShowCacheDeleteConfirmation) => {
  if (selectedCaches.size === 0) return;
  setShowCacheDeleteConfirmation(true);
};

/**
 * Confirms and executes deletion of selected caches
 * @param {Set} selectedCaches - Set of selected cache names
 * @param {string} currentDocumentName - Current document name
 * @param {string} API_BASE_URL - Base URL for API calls
 * @param {Function} setStatus - Function to set status message
 * @param {Function} clearAll - Function to clear all state
 * @param {Function} fetchCacheList - Function to fetch cache list
 * @param {Function} setSelectedCaches - Function to set selected caches state
 * @param {Function} setIsSelectAllCachesChecked - Function to set select all caches state
 * @param {Function} setShowCacheDeleteConfirmation - Function to hide cache delete confirmation
 */
export const confirmDeleteSelectedCaches = async (
  selectedCaches,
  currentDocumentName,
  API_BASE_URL,
  setStatus,
  clearAll,
  fetchCacheList,
  setSelectedCaches,
  setIsSelectAllCachesChecked,
  setShowCacheDeleteConfirmation
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/cache/delete-multiple`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentNames: Array.from(selectedCaches) })
    });

    const data = await response.json();

    if (data.success) {
      // Check if current document was deleted
      const currentDocDeleted = selectedCaches.has(currentDocumentName);
      
      if (currentDocDeleted) {
        // Clear UI and show message
        setStatus({ 
          type: 'info', 
          message: `Current document "${currentDocumentName}" was deleted from cache. UI has been cleared.` 
        });
        clearAll();
      } else {
        setStatus({ 
          type: 'success', 
          message: `Successfully deleted ${data.results.deletedCount} document(s) from cache` 
        });
      }

      // Refresh cache list
      await fetchCacheList();
      setSelectedCaches(new Set());
      setIsSelectAllCachesChecked(false);
      setShowCacheDeleteConfirmation(false);
    } else {
      setStatus({ type: 'error', message: 'Failed to delete selected documents' });
      setShowCacheDeleteConfirmation(false);
    }
  } catch (error) {
    console.error('Error deleting cache documents:', error);
    setStatus({ type: 'error', message: 'Failed to delete selected documents' });
    setShowCacheDeleteConfirmation(false);
  }
};

/**
 * Opens cache management modal
 * @param {Function} setShowCacheModal - Function to show cache modal
 * @param {Function} fetchCacheList - Function to fetch cache list
 */
export const openCacheModal = async (setShowCacheModal, fetchCacheList) => {
  setShowCacheModal(true);
  await fetchCacheList();
};
