// Jira Integration utility functions for TestGenerator component
/**
 * Tests Jira connection and retrieves available projects
 * @param {Function} setIsLoadingJira - Function to set loading state
 * @param {Function} setJiraConfig - Function to set Jira configuration
 * @param {Function} setJiraProjects - Function to set Jira projects
 * @param {Function} setJiraConnectionActive - Function to set connection active state
 * @param {Function} setJiraStep - Function to set Jira step
 * @param {Function} setStatus - Function to set status message
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const testJiraConnection = async (
  setIsLoadingJira,
  setJiraConfig,
  setJiraProjects,
  setJiraConnectionActive,
  setJiraStep,
  setStatus,
  API_BASE_URL
) => {
  setIsLoadingJira(true);
  try {
    const response = await fetch(`${API_BASE_URL}/api/jira/test-connection`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      // Store the Jira base URL from backend response
      if (data.jiraBaseUrl) {
        setJiraConfig(prev => ({ ...prev, baseUrl: data.jiraBaseUrl }));
      }
      
      setJiraProjects(data.projects || []);
      setJiraConnectionActive(true);
      setJiraStep('select');
      setStatus({ type: 'success', message: 'Successfully connected to Jira!' });
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to connect to Jira' });
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

/**
 * Fetches Jira issues for the selected project and issue types
 * @param {Function} setIsLoadingJira - Function to set loading state
 * @param {Function} setAllJiraIssues - Function to set all Jira issues
 * @param {Function} setJiraPagination - Function to set pagination state
 * @param {Function} updateDisplayedIssues - Function to update displayed issues
 * @param {Function} setJiraCacheInfo - Function to set cache info
 * @param {Function} setJiraStep - Function to set Jira step
 * @param {Function} setStatus - Function to set status message
 * @param {Object} jiraConfig - Jira configuration object
 * @param {Object} jiraPagination - Pagination state
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const fetchJiraIssues = async (
  setIsLoadingJira,
  setAllJiraIssues,
  setJiraPagination,
  updateDisplayedIssues,
  setJiraCacheInfo,
  setJiraStep,
  setStatus,
  jiraConfig,
  jiraPagination,
  API_BASE_URL
) => {
  setIsLoadingJira(true);
  try {
    // Make API call - backend will handle caching automatically
    const response = await fetch(`${API_BASE_URL}/api/jira/fetch-issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: jiraConfig.projectKey,
        issueTypes: jiraConfig.issueTypes
      })
    });

    const data = await response.json();

    if (data.success) {
      const allIssues = data.issues || [];
      setAllJiraIssues(allIssues);
      
      setJiraPagination({
        currentPage: 1,
        itemsPerPage: 100,
        totalItems: allIssues.length
      });
      
      // Set the first page of issues to display
      updateDisplayedIssues(allIssues, 1);
      
      // Update cache info based on backend response
      setJiraCacheInfo({
        isCached: data.cached || false,
        lastFetched: new Date().toISOString(),
        projectKey: jiraConfig.projectKey,
        issueTypes: [...jiraConfig.issueTypes]
      });
      
      const message = data.cached 
        ? `Loaded ${allIssues.length} cached issues from Jira` 
        : `Fetched all ${allIssues.length} issues from Jira`;
      setStatus({ type: 'success', message });
      setJiraStep('import');
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to fetch Jira issues' });
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

/**
 * Updates the displayed issues based on pagination
 * @param {Array} allIssues - All available issues
 * @param {number} page - Current page number
 * @param {Object} jiraPagination - Pagination state
 * @param {Function} setJiraIssues - Function to set displayed issues
 * @returns {void}
 */
export const updateDisplayedIssues = (allIssues, page, jiraPagination, setJiraIssues) => {
  const startIndex = (page - 1) * jiraPagination.itemsPerPage;
  const endIndex = startIndex + jiraPagination.itemsPerPage;
  const pageIssues = allIssues.slice(startIndex, endIndex);
  setJiraIssues(pageIssues);
};

/**
 * Navigates to a specific page in the Jira issues pagination
 * @param {number} page - Page number to navigate to
 * @param {Object} jiraPagination - Pagination state
 * @param {Function} setJiraPagination - Function to set pagination state
 * @param {Function} updateDisplayedIssues - Function to update displayed issues
 * @param {Array} allJiraIssues - All available issues
 * @returns {void}
 */
export const goToPage = (page, jiraPagination, setJiraPagination, updateDisplayedIssues, allJiraIssues) => {
  if (page < 1 || page > Math.ceil(jiraPagination.totalItems / jiraPagination.itemsPerPage)) {
    return;
  }
  
  setJiraPagination(prev => ({ ...prev, currentPage: page }));
  updateDisplayedIssues(allJiraIssues, page, jiraPagination, () => {});
};

/**
 * Clears Jira cache for the current project
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setJiraCacheInfo - Function to set cache info
 * @param {Object} jiraConfig - Jira configuration object
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const clearJiraCache = async (setStatus, setJiraCacheInfo, jiraConfig, API_BASE_URL) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/jira/clear-cache`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectKey: jiraConfig.projectKey,
        issueTypes: jiraConfig.issueTypes
      })
    });

    const data = await response.json();

    if (data.success) {
      setStatus({ type: 'success', message: data.message });
      setJiraCacheInfo({
        isCached: false,
        lastFetched: null,
        projectKey: null,
        issueTypes: []
      });
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to clear cache' });
    }
  } catch (error) {
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to clear cache' 
    });
  }
};

/**
 * Checks if Jira data needs to be refetched based on configuration changes
 * @param {Object} jiraCacheInfo - Cache information
 * @param {Object} jiraConfig - Jira configuration object
 * @returns {boolean} - Whether data should be refetched
 */
export const shouldRefetch = (jiraCacheInfo, jiraConfig) => {
  return jiraCacheInfo.projectKey !== jiraConfig.projectKey || 
         JSON.stringify(jiraCacheInfo.issueTypes.sort()) !== JSON.stringify(jiraConfig.issueTypes.sort());
};

/**
 * Imports selected Jira issues and processes them through AI requirements extraction
 * @param {Function} setIsLoadingJira - Function to set loading state
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setCurrentDocumentName - Function to set current document name
 * @param {Function} setExtractedRequirements - Function to set extracted requirements
 * @param {Function} setRequirementsSource - Function to set requirements source
 * @param {Function} parseRequirementsTable - Function to parse requirements table
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {Function} setJiraTicketInfo - Function to set Jira ticket info
 * @param {Function} setJiraTicketPrefix - Function to set Jira ticket prefix
 * @param {Function} setShowJiraImport - Function to set show Jira import modal
 * @param {Function} setJiraStep - Function to set Jira step
 * @param {Function} setJiraConfig - Function to set Jira configuration
 * @param {Object} jiraConfig - Jira configuration object
 * @param {string} requirementsSource - Requirements source
 * @param {string} jiraTicketPrefix - Jira ticket prefix
 * @param {Object} jiraTicketInfo - Jira ticket information
 * @param {Array} featureTabs - Current feature tabs
 * @param {string} API_BASE_URL - Base URL for API calls
 * @returns {Promise<void>}
 */
export const importJiraIssues = async (
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
) => {
  setIsLoadingJira(true);
  setStatus({ type: 'info', message: 'Importing Jira tickets and processing through AI requirements extraction...' });
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/jira/import-issues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        selectedIssues: jiraConfig.selectedIssues
      })
    });

    const data = await response.json();

    if (data.success) {
      // Combine all Jira content into one document for requirements extraction
      const combinedJiraContent = data.features.map(feature => 
        `Jira Ticket: ${feature.title}\n\n${feature.content}`
      ).join('\n\n---\n\n');
      
      // Extract requirements from the combined Jira content using the same AI processing
      setStatus({ type: 'info', message: 'Processing Jira content through AI requirements extraction...' });
      
      try {
        // Create individual ticket cache entries so we can track which bug/story/epic each test belongs to
        const firstTicket = data.features[0];
        const ticketKey = firstTicket?.ticketKey || (firstTicket?.title?.split(':')[0]?.trim()) || 'UNKNOWN';
        const issueType = firstTicket?.issueType || 'Bug'; // Default to Bug if not specified
        const jiraDocumentName = `jira-${ticketKey}-${issueType}`; // Individual ticket cache: jira-QAE-60-Bug
        
        // Set current document name for individual ticket caching
        setCurrentDocumentName(jiraDocumentName);
        
        const requirementsResponse = await fetch(`${API_BASE_URL}/api/extract-requirements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: combinedJiraContent, 
            context: `Jira tickets: ${data.features.map(f => f.title).join(', ')}`,
            documentName: jiraDocumentName, // Create individual ticket cache entries for traceability
            enableLogging: false // Disable logging for Jira imports to reduce console noise
          })
        });

        const requirementsData = await requirementsResponse.json();
        
        if (requirementsData.success) {
          // Set the extracted requirements table (same as uploaded documents)
          setExtractedRequirements(requirementsData.content);
          
          // Set requirements source
          setRequirementsSource('jira');
          
          // Parse the requirements table to extract individual requirements
          const requirementsContent = requirementsData.content;
          const requirements = parseRequirementsTable(requirementsContent, requirementsSource, jiraTicketPrefix, jiraTicketInfo, setJiraTicketPrefix, setJiraTicketInfo);
          
          if (requirements.length > 0) {
            // Create feature tabs from extracted requirements (same as uploaded documents)
            const newFeatures = requirements.map((req, index) => ({
              title: req.id || `JIRA-${String(index + 1).padStart(3, '0')}`,
              content: `Requirement: ${req.requirement}\n\nAcceptance Criteria: ${req.acceptanceCriteria}`,
              originalContent: req.requirement
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
            
            // Store Jira ticket info for traceability - set for ALL new feature tabs
            // Merge with existing jiraTicketInfo instead of overwriting
            const newJiraTicketInfo = { ...jiraTicketInfo };
            
            // Get the actual ticket key from the feature data (preferred) or extract from title
            const firstFeature = data.features[0];
            const ticketKey = firstFeature?.ticketKey || firstFeature?.title?.split(':')[0]?.trim() || 'JIRA';
            
            // Get the current length of existing feature tabs
            const currentTabsLength = featureTabs.length;
            
            // Set Jira ticket info for all the new feature tabs we just created
            newFeatures.forEach((feature, index) => {
              const globalIndex = currentTabsLength + index;
              // Use the ticket key from the corresponding feature if available
              const featureTicketKey = data.features[index]?.ticketKey || ticketKey;
              newJiraTicketInfo[globalIndex] = {
                ticketKey: featureTicketKey,
                jiraBaseUrl: jiraConfig.baseUrl
              };
            });
            setJiraTicketInfo(newJiraTicketInfo);
            
            // Set the Jira ticket prefix for consistency (use full ticket key)
            setJiraTicketPrefix(ticketKey);
            
            // Close the modal after successful import so user can see the requirements
            setShowJiraImport(false);
            setJiraStep('connect'); // Reset to initial step for next time
            setJiraConfig(prev => ({ ...prev, selectedIssues: [] })); // Clear selected issues
            
            setStatus({ type: 'success', message: `Successfully imported ${data.features.length} Jira tickets, extracted ${requirements.length} requirements, and created feature tabs! You can now edit the requirements if needed, then click "Insert Requirements" to add them to the test generator.` });
            
            // Ensure the requirements table is visible
            if (requirements.length > 0) {
              // Scroll to the requirements section to make it visible
              setTimeout(() => {
                const requirementsSection = document.querySelector('.requirements-section');
                if (requirementsSection) {
                  requirementsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 200);
            }
          } else {
            setStatus({ type: 'success', message: `Successfully imported ${data.features.length} Jira tickets and extracted requirements!` });
          }
        } else {
          setStatus({ type: 'error', message: 'Failed to extract requirements from Jira tickets' });
        }
      } catch (requirementsError) {
        console.error('Error extracting requirements from Jira tickets:', requirementsError);
        setStatus({ type: 'error', message: 'Failed to process Jira tickets through AI requirements extraction' });
      }
    } else {
      setStatus({ type: 'error', message: data.error || 'Failed to import Jira issues' });
    }
  } catch (error) {
    setStatus({ 
      type: 'error', 
      message: error.response?.data?.error || 'Failed to import Jira issues' 
    });
  } finally {
    setIsLoadingJira(false);
  }
};
