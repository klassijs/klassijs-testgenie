import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Copy, Download, RefreshCw, AlertCircle, CheckCircle, TestTube, Upload, FileText, X, ExternalLink, XCircle, Trash2, Edit, Zap, GitBranch } from 'lucide-react';
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
  const [showJiraProjectDropdown, setShowJiraProjectDropdown] = useState(false);
  const [jiraProjectSearch, setJiraProjectSearch] = useState('');

  // API base URL - can be configured via environment variable
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // Function to parse requirements table and extract individual requirements
  const parseRequirementsTable = (requirementsContent) => {
    console.log('🔍 parseRequirementsTable called with:', requirementsContent);
    console.log('🔍 Content length:', requirementsContent.length);
    console.log('🔍 Content preview (first 500 chars):', requirementsContent.substring(0, 500));
    
    const requirements = [];
    const lines = requirementsContent.split('\n');
    console.log('🔍 Split lines:', lines);
    console.log('🔍 Number of lines:', lines.length);
    
    let inTable = false;
    let tableLines = [];
    
    // Find the table section - look for the header (more flexible detection)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // More flexible header detection - check for key words in the right order
      if (line.includes('|') && 
          line.toLowerCase().includes('requirement id') && 
          line.toLowerCase().includes('business requirement') && 
          line.toLowerCase().includes('acceptance criteria')) {
        inTable = true;
        console.log('🔍 Found table header at line:', i, 'Content:', line);
        continue;
      }
      
      if (inTable) {
        // Skip separator lines (lines with just dashes and pipes)
        if (line.trim().match(/^[\s\-|]+$/)) {
          console.log('🔍 Skipping separator line:', line);
          continue;
        }
        
        // If we hit a completely empty line, check if there are more requirements below
        if (line.trim() === '') {
          console.log('🔍 Found empty line at line:', i);
          // Look ahead a few lines to see if there are more requirements
          let hasMoreRequirements = false;
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const nextLine = lines[j];
            if (nextLine.includes('|') && nextLine.split('|').filter(col => col.trim()).length >= 3) {
              hasMoreRequirements = true;
              console.log('🔍 Found more requirements ahead at line:', j);
              break;
            }
          }
          
          if (!hasMoreRequirements) {
            console.log('🔍 No more requirements found, ending table parsing');
            break; // End of table
          }
        }
        
        // Add any line that contains table data
        if (line.includes('|')) {
          tableLines.push(line);
          console.log('🔍 Added table line:', line);
        }
      }
    }
    
    console.log('🔍 Total table lines found:', tableLines.length);
    console.log('🔍 ALL table lines:', tableLines);
    
    // Parse table rows
    let requirementCounter = 0; // Use a separate counter for requirement IDs
    
    for (let i = 0; i < tableLines.length; i++) {
      const line = tableLines[i];
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      console.log(`🔍 [ROW ${i}] Parsing line:`, line);
      console.log(`🔍 [ROW ${i}] Columns:`, columns);
      
      if (columns.length >= 3) {
        const [id, requirement, acceptanceCriteria] = columns;
        
        // Skip header row and separator rows (more flexible detection)
        if (id.toLowerCase().includes('requirement id') || 
            id.toLowerCase().includes('business requirement') ||
            id.toLowerCase().includes('acceptance criteria') ||
            id === '---' ||
            id.includes('---') ||
            requirement.includes('---') ||
            acceptanceCriteria.includes('---') ||
            id === '' ||
            requirement === '' ||
            acceptanceCriteria === '') {
          console.log(`🔍 [ROW ${i}] SKIPPING invalid row:`, { id, requirement, acceptanceCriteria });
          continue;
        }
        
        // Generate requirement ID based on source
        let generatedId;
        if (requirementsSource === 'jira' && jiraTicketPrefix) {
          // For Jira: use ticket prefix + sequential number
          requirementCounter++; // Increment counter for each valid requirement
          generatedId = `${jiraTicketPrefix}-${String(requirementCounter).padStart(3, '0')}`;
        } else {
          // For uploaded documents: use BR prefix
          requirementCounter++; // Increment counter for each valid requirement
          generatedId = `BR-${String(requirementCounter).padStart(3, '0')}`;
        }
        
        console.log(`🔍 [ROW ${i}] ADDING requirement:`, { 
          originalId: id, 
          generatedId: generatedId, 
          requirement: requirement.substring(0, 50) + '...', 
          acceptanceCriteria: acceptanceCriteria.substring(0, 50) + '...',
          source: requirementsSource,
          rowIndex: i,
          requirementCounter: requirementCounter
        });
        
        requirements.push({
          id: generatedId,
          requirement: requirement,
          acceptanceCriteria: acceptanceCriteria,
          complexity: columns[3] || 'CC: 1, Paths: 1'
        });
      } else {
        console.log(`🔍 [ROW ${i}] SKIPPING - insufficient columns:`, columns);
      }
    }
    
    console.log('🔍 Final requirements parsed:', requirements.map(r => ({ id: r.id, req: r.requirement.substring(0, 30) + '...' })));
    return requirements;
  };





  // Jira import functions
  const testJiraConnection = async () => {
    setIsLoadingJira(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/jira/test-connection`);

      if (response.data.success) {
        // Store the Jira base URL from backend response
        if (response.data.jiraBaseUrl) {
          setJiraConfig(prev => ({ ...prev, baseUrl: response.data.jiraBaseUrl }));
        }
        
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
    setStatus({ type: 'info', message: 'Importing Jira tickets and processing through AI requirements extraction...' });
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/jira/import-issues`, {
        selectedIssues: jiraConfig.selectedIssues
      });

      if (response.data.success) {
        // Combine all Jira content into one document for requirements extraction
        const combinedJiraContent = response.data.features.map(feature => 
          `Jira Ticket: ${feature.title}\n\n${feature.content}`
        ).join('\n\n---\n\n');
        
        // Extract requirements from the combined Jira content using the same AI processing
        setStatus({ type: 'info', message: 'Processing Jira content through AI requirements extraction...' });
        
        try {
          const requirementsResponse = await axios.post(`${API_BASE_URL}/api/extract-requirements`, { 
            content: combinedJiraContent, 
            context: `Jira tickets: ${response.data.features.map(f => f.title).join(', ')}`,
            enableLogging: false // Disable logging for Jira imports to reduce console noise
          });
          
          if (requirementsResponse.data.success) {
            // Set the extracted requirements table (same as uploaded documents)
            setExtractedRequirements(requirementsResponse.data.content);
            
            // Set requirements source and extract Jira ticket prefix
            setRequirementsSource('jira');
            
            // Extract Jira ticket prefix from the first ticket
            const firstTicket = response.data.features[0];
            if (firstTicket && firstTicket.title && firstTicket.title.includes(':')) {
              const ticketKey = firstTicket.title.split(':')[0].trim();
              setJiraTicketPrefix(ticketKey);
              console.log('🔍 Set Jira ticket prefix:', ticketKey);
            }
            
            // Parse the requirements table to extract individual requirements
            const requirementsContent = requirementsResponse.data.content;
            const requirements = parseRequirementsTable(requirementsContent);
            
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
              const jiraTicketInfo = {};
              const ticketKey = response.data.features[0]?.title?.split(':')[0]?.trim() || 'JIRA';
              
              // Get the current length of existing feature tabs
              const currentTabsLength = featureTabs.length;
              
              // Set Jira ticket info for all the new feature tabs we just created
              newFeatures.forEach((feature, index) => {
                const globalIndex = currentTabsLength + index;
                jiraTicketInfo[globalIndex] = {
                  ticketKey: ticketKey,
                  jiraBaseUrl: jiraConfig.baseUrl
                };
              });
              setJiraTicketInfo(jiraTicketInfo);
              
              console.log('🔍 Closing Jira import modal...');
              console.log('🔍 Current showJiraImport state:', showJiraImport);
              
              // Force close the modal by resetting all related state
              setShowJiraImport(false);
              setJiraStep('connect'); // Reset Jira import flow
              setJiraConfig(prev => ({ ...prev, selectedIssues: [] })); // Clear selected issues
              
              console.log('🔍 After setShowJiraImport(false), state should be:', false);
              
              // Force a complete state reset to ensure modal closes
              setTimeout(() => {
                console.log('🔍 Forcing complete modal state reset...');
                console.log('🔍 Number of modal overlays found:', document.querySelectorAll('.modal-overlay').length);
                
                setShowJiraImport(false);
                setJiraStep('connect');
                
                // Force close any remaining modal elements via DOM manipulation
                const modalOverlays = document.querySelectorAll('.modal-overlay');
                modalOverlays.forEach((overlay, index) => {
                  console.log(`🔍 Modal overlay ${index}:`, overlay);
                  if (overlay.closest('[data-modal="jira-import"]')) {
                    console.log('🔍 Hiding modal overlay via DOM manipulation');
                    overlay.style.display = 'none';
                  }
                });
                
                // Additional check - force the modal to close
                console.log('🔍 Final check - showJiraImport should be false');
              }, 50);
              
              // Additional aggressive approach - multiple attempts
              setTimeout(() => {
                console.log('🔍 Second attempt to close modal...');
                setShowJiraImport(false);
                
                // Force hide all modal overlays
                document.querySelectorAll('.modal-overlay').forEach(overlay => {
                  overlay.style.display = 'none';
                });
              }, 200);
              
              setTimeout(() => {
                console.log('🔍 Third attempt to close modal...');
                setShowJiraImport(false);
                
                // Last resort - remove modal from DOM
                const jiraModal = document.querySelector('[data-modal="jira-import"]');
                if (jiraModal) {
                  console.log('🔍 Removing modal from DOM as last resort');
                  jiraModal.remove();
                }
              }, 500);
              
              setStatus({ type: 'success', message: `Successfully imported ${response.data.features.length} Jira tickets, extracted ${requirements.length} requirements, and created feature tabs! You can now edit the requirements if needed, then click "Insert Requirements" to add them to the test generator.` });
              
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
              setStatus({ type: 'success', message: `Successfully imported ${response.data.features.length} Jira tickets and extracted requirements!` });
            }
          } else {
            setStatus({ type: 'error', message: 'Failed to extract requirements from Jira tickets' });
          }
        } catch (requirementsError) {
          console.error('Error extracting requirements from Jira tickets:', requirementsError);
          setStatus({ type: 'error', message: 'Failed to process Jira tickets through AI requirements extraction' });
        }
      } else {
        setStatus({ type: 'error', message: response.data.error || 'Failed to import Jira issues' });
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFolderDropdown && !event.target.closest('.folder-dropdown-container')) {
        setShowFolderDropdown(false);
      }
      if (showProjectDropdown && !event.target.closest('.project-dropdown-container')) {
        setShowProjectDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFolderDropdown, showProjectDropdown]);

  // Process uploaded file content
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

        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === fileObj.id 
              ? { ...f, status: 'completed', content: response.data.content }
              : f
          )
        );
        
        // Automatically extract requirements from the document content
        let requirementsResponse = null;
        try {
          requirementsResponse = await axios.post(`${API_BASE_URL}/api/extract-requirements`, { 
            content: response.data.content, 
            context: context 
          });
          
          if (requirementsResponse.data.success) {
            setExtractedRequirements(requirementsResponse.data.content);
            
            // Set requirements source for uploaded documents
            setRequirementsSource('upload');
            setJiraTicketPrefix(''); // Clear any Jira ticket prefix
            
            // Create feature tabs from extracted requirements
            const requirementsContent = requirementsResponse.data.content;
            
            // Parse the requirements table to extract individual requirements
            const requirements = parseRequirementsTable(requirementsContent);
            
            if (requirements.length > 0) {
              const newFeatures = requirements.map((req, index) => ({
                title: req.id || `REQ-${String(index + 1).padStart(3, '0')}`,
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
              
              setStatus({ type: 'success', message: `Successfully processed ${fileObj.name}, extracted ${requirements.length} requirements, and created feature tabs! You can now edit the requirements if needed.` });
            } else {
              setStatus({ type: 'success', message: `Successfully processed ${fileObj.name} and extracted requirements!` });
            }
          } else {
            setStatus({ type: 'success', message: `Successfully processed ${fileObj.name} and extracted requirements!` });
          }
        } catch (requirementsError) {
          setStatus({ type: 'success', message: `Successfully processed ${fileObj.name} and extracted requirements!` });
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

  const handleFileUpload = useCallback((event) => {
    // Extract files from the event
    const files = event.target.files;
    
    if (!files || files.length === 0) return;

    // Handle both FileList and single file cases
    const fileArray = files instanceof FileList ? Array.from(files) : [files];



    // Process each file
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

  // Remove the separate extractRequirements function - it will be integrated into document processing

  const generateTests = async () => {
    // Check if we have content to generate tests from
    if (!content.trim()) {
      setStatus({ type: 'error', message: 'No content in the text area. Please insert requirements or enter content first.' });
      return;
    }
    
    setIsLoading(true);
    setIsGenerating(true);
    setStatus(null);
    
    try {
      // Parse requirements from the content
      const requirements = parseRequirementsTable(content);
      
      if (requirements.length === 0) {
        setStatus({ type: 'error', message: 'No requirements found in the content. Please ensure you have a requirements table with Requirement ID, Business Requirement, and Acceptance Criteria columns.' });
        return;
      }
      
      // Generate tests for each requirement
      const generatedFeatures = [];
      
      for (const req of requirements) {
        const testContent = `REQUIREMENT TO TEST:
Requirement ID: ${req.id}
Business Requirement: ${req.requirement}
Acceptance Criteria: ${req.acceptanceCriteria}

GENERATE TEST SCENARIOS SPECIFIC TO THIS REQUIREMENT ONLY.

IMPORTANT: 
1. Feature line must start with # in this format:
   # Feature: [Feature Name]

2. Each scenario title must include the requirement ID in this format:
   Scenario: ${req.id}: [Scenario Description]

3. PATH COVERAGE REQUIREMENTS:
   - Analyze the complexity from the requirements table
   - Create test scenarios that cover EVERY identified execution path
   - For each decision point, create separate test scenarios
   - Ensure all branches and conditions are tested
   - The number of test scenarios should match or exceed the "Paths" count from complexity analysis

4. If the requirement contains workflow steps, decision points, or conditional logic:
   - Calculate the cyclomatic complexity
   - Ensure test coverage for all decision paths
   - Include scenarios for each branch/condition
   - Add a comment showing: # Cyclomatic Complexity: [number]
   - Add comment: # Test Coverage: [X] of [Y] paths covered

Example:
# Feature: junior school
Scenario: ${req.id}: Successfully entering valid data into the "Need More Information" section

# If workflow detected:
# Cyclomatic Complexity: 5
# Decision Points: 3 (user role, data validation, approval flow)
# Test Coverage: All 5 paths covered

# CRITICAL: Generate enough test scenarios to cover ALL identified paths from the complexity analysis`;
        
        const response = await axios.post(`${API_BASE_URL}/api/generate-tests`, { 
          content: testContent, 
          context: context 
        });
        
        if (response.data.success) {
          // Create a descriptive title that includes requirement ID and summary
          const requirementSummary = req.requirement.length > 50 
            ? req.requirement.substring(0, 50) + '...' 
            : req.requirement;
          
          const scenarioTitle = `${req.id}: ${requirementSummary}`;
          
          generatedFeatures.push({
            title: scenarioTitle,
            content: response.data.content,
            requirement: req.requirement,
            acceptanceCriteria: req.acceptanceCriteria,
            requirementId: req.id // Store the requirement ID separately for reference
          });
        } else {
          console.error(`Failed to generate tests for ${req.id}`);
        }
      }
      
      if (generatedFeatures.length > 0) {
        // Set the feature tabs
        setFeatureTabs(generatedFeatures);
        setActiveTab(0);
        
        // Set editable features
        const editableFeaturesObj = {};
        generatedFeatures.forEach((feature, index) => {
          editableFeaturesObj[index] = feature.content;
        });
        setEditableFeatures(editableFeaturesObj);
        
        // Set overall generated tests (combined)
        const allTests = generatedFeatures.map(f => f.content).join('\n\n');
        setGeneratedTests(allTests);
        
        setShowModal(true);
        setStatus({ type: 'success', message: `Generated test cases for ${generatedFeatures.length} requirements!` });
      } else {
        setStatus({ type: 'error', message: 'Failed to generate test cases for any requirements' });
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
    setExtractedRequirements('');
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

  // Fetch all folders and organize them hierarchically
  const fetchAllFolders = async (projectKey) => {
    if (!projectKey) {
      setZephyrFolders([]);
      return;
    }

    try {
      setLoadingFolders(true);
      const response = await axios.get(`${API_BASE_URL}/api/zephyr-folders/${projectKey}`);
      if (response.data.success) {
        console.log('All folders fetched:', response.data.folders);
        setZephyrFolders(response.data.folders);
        setFolderNavigation({
          currentLevel: 'main',
          parentFolderId: null,
          parentFolderName: '',
          breadcrumb: []
        });
        setSearchMode(false);
      }
    } catch (error) {
      console.error('Error fetching all folders:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to fetch folders' 
      });
    } finally {
      setLoadingFolders(false);
    }
  };



  // Build folder tree structure
  const buildFolderTree = (folders) => {
    const folderMap = new Map();
    const rootFolders = [];
    
    // Create a map of all folders
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] });
    });
    
    // Build the tree structure
    folders.forEach(folder => {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(folderMap.get(folder.id));
      } else {
        rootFolders.push(folderMap.get(folder.id));
      }
    });
    
    return rootFolders;
  };

  // Toggle folder expansion
  const toggleFolderExpansion = (folderId) => {
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

  // Search folders across all levels
  const searchFolders = async (projectKey, searchTerm) => {
    if (!projectKey || !searchTerm.trim()) return;
    
    try {
      setLoadingFolders(true);
      const response = await axios.get(`${API_BASE_URL}/api/zephyr-search-folders/${projectKey}?searchTerm=${encodeURIComponent(searchTerm.trim())}`);
      if (response.data.success) {
        setZephyrFolders(response.data.folders);
        setFolderNavigation(prev => ({
          ...prev,
          currentLevel: 'search'
        }));
        setSearchMode(true);
      }
    } catch (error) {
      console.error('Error searching folders:', error);
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to search folders' 
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
    fetchAllFolders(projectKey); // Fetch all folders to show hierarchy
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
        testCaseId: testCaseId,
        // Add Jira ticket information for traceability if this feature came from Jira
        jiraTicketKey: jiraTicketInfo[activeTab]?.ticketKey || null,
        jiraBaseUrl: jiraTicketInfo[activeTab]?.jiraBaseUrl || null
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
        
        // Show success message
        setStatus({ 
          type: 'success', 
          message: `Test case "${activeTab}" pushed to Zephyr Scale successfully!${
            response.data.jiraTraceability && response.data.jiraTraceability.success ? 
              ` Jira ticket linked for traceability.` : 
              ''
          }` 
        });
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

  const handleInsertRequirements = () => {
    // Format requirements nicely before inserting (remove markdown syntax)
    const formattedRequirements = formatRequirementsForInsertion(extractedRequirements);
    setContent(formattedRequirements);
    setStatus({ type: 'info', message: 'Requirements loaded for test generation. Click "Generate Tests" to create test cases.' });
  };

  // Helper function to format requirements for insertion (remove markdown, format nicely)
  const formatRequirementsForInsertion = (markdownContent) => {
    const lines = markdownContent.split('\n');
    let formattedContent = 'Business Requirements:\n\n';
    
    // First, find and include the header row
    let headerRow = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 3 && parts[0].toLowerCase().includes('requirement id')) {
          headerRow = line;
          break;
        }
      }
    }
    
    // Add header row if found
    if (headerRow) {
      formattedContent += headerRow + '\n';
      // Add separator line
      const headerParts = headerRow.split('|').map(p => p.trim()).filter(p => p);
      const separatorLine = '|' + headerParts.map(() => '---').join('|') + '|';
      formattedContent += separatorLine + '\n';
    }
    
    // Add data rows
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(p => p);
        if (parts.length >= 3 && !parts[0].includes('---') && !parts[0].toLowerCase().includes('requirement id')) {
          formattedContent += line + '\n';
        }
      }
    }
    
    return formattedContent.trim();
  };

  // New function to format requirements with generated IDs for insertion
  const formatRequirementsForInsertionWithGeneratedIds = (requirements) => {
    let formattedContent = 'Business Requirements:\n\n';
    
    // Add header row for reference
    formattedContent += '| Requirement ID | Business Requirement | Acceptance Criteria | Complexity |\n';
    formattedContent += '|---|---|---|---|\n';
    
    // Add data rows with generated IDs
    requirements.forEach(req => {
      formattedContent += `| ${req.id} | ${req.requirement} | ${req.acceptanceCriteria} | ${req.complexity || 'CC: 1, Paths: 1'} |\n`;
    });
    
    // Add the actual requirement content for test generation
    formattedContent += '\n\nRequirements for Test Generation:\n\n';
    requirements.forEach(req => {
      formattedContent += `Requirement ID: ${req.id}\n`;
      formattedContent += `Business Requirement: ${req.requirement}\n`;
      formattedContent += `Acceptance Criteria: ${req.acceptanceCriteria}\n`;
      formattedContent += `Complexity: ${req.complexity || 'CC: 1, Paths: 1'}\n`;
      formattedContent += '\n';
    });
    
    return formattedContent.trim();
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(extractedRequirements);
    setStatus({ type: 'success', message: 'Requirements copied to clipboard!' });
  };

  const handleDownloadContent = async () => {
    try {
      // Generate Word document using backend API
      const response = await axios.post(`${API_BASE_URL}/api/generate-word-doc`, {
        content: extractedRequirements,
        title: 'Business Requirements'
      }, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'business-requirements.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Requirements downloaded as Word document!' });
    } catch (error) {
      console.error('Error generating Word document:', error);
      setStatus({ type: 'error', message: 'Failed to generate Word document. Please try again.' });
    }
  };

  // Function to validate complexity values and show warnings
  const validateComplexityValues = (requirements) => {
    const warnings = [];
    
    requirements.forEach((req, index) => {
      const complexity = req.complexity || '';
      
      // Check if complexity follows the expected format
      const complexityMatch = complexity.match(/CC:\s*(\d+),\s*Decision Points:\s*(\d+),\s*Activities:\s*(\d+),\s*Paths:\s*(\d+)/);
      
      if (!complexityMatch) {
        warnings.push(`Requirement ${req.id}: Invalid complexity format. Expected: "CC: X, Decision Points: Y, Activities: Z, Paths: W"`);
        return;
      }
      
      const [, cc, decisionPoints, activities, paths] = complexityMatch.map(Number);
      
      // Validate the formula: CC = E - N + 2P (where E=edges, N=nodes, P=components)
      // For individual requirements, estimate edges and nodes
      const estimatedEdges = decisionPoints + 1; // At least one flow per decision point
      const estimatedNodes = decisionPoints + activities + 1; // Include start/end events
      const estimatedComponents = 1; // Single workflow component
      const calculatedCC = estimatedEdges - estimatedNodes + (2 * estimatedComponents);
      
      if (Math.abs(cc - calculatedCC) > 2) { // Allow some variance for estimation
        warnings.push(`Requirement ${req.id}: Complexity may be inaccurate. Estimated CC: ${calculatedCC} (E:${estimatedEdges} - N:${estimatedNodes} + 2P:${estimatedComponents}), got: ${cc}`);
      }
      
      // Check for reasonable values
      if (cc > 50) {
        warnings.push(`Requirement ${req.id}: Extremely high complexity (${cc}). Consider breaking down this requirement.`);
      }
      
      if (decisionPoints > 100) {
        warnings.push(`Requirement ${req.id}: Very high decision points (${decisionPoints}). Consider simplifying the logic.`);
      }
      
      // Check if paths make sense
      if (paths < cc) {
        warnings.push(`Requirement ${req.id}: Number of paths (${paths}) should typically be >= cyclomatic complexity (${cc})`);
      }
    });
    
    return warnings;
  };

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
                    onClick={() => removeFile(file.id)}
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
              setJiraStep('connect');
              setJiraConfig({
                projectKey: '',
                issueTypes: [],
                selectedIssues: [],
                baseUrl: '' // Will be set from backend response
              });
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
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Requirement ID</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Business Requirement</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Acceptance Criteria</th>
                    <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left', fontWeight: 'bold' }}>Complexity</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Parse markdown table into proper table rows with generated IDs
                    const requirements = parseRequirementsTable(extractedRequirements);
                    
                    return requirements.map((req, index) => (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }}>
                        <td style={{ padding: '12px', border: '1px solid #dee2e6', fontWeight: 'bold' }}>
                          <textarea
                            defaultValue={req.id}
                            onBlur={(e) => {
                              // Only update when user finishes editing (onBlur)
                              const newReqs = [...requirements];
                              newReqs[index].id = e.target.value;
                              const newContent = newReqs.map(r => `| ${r.id} | ${r.requirement} | ${r.acceptanceCriteria} | ${r.complexity || 'CC: 1, Paths: 1'} |`).join('\n');
                              setExtractedRequirements(newContent);
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
                            defaultValue={req.requirement}
                            onBlur={(e) => {
                              // Only update when user finishes editing (onBlur)
                              const newReqs = [...requirements];
                              newReqs[index].requirement = e.target.value;
                              const newContent = newReqs.map(r => `| ${r.id} | ${r.requirement} | ${r.acceptanceCriteria} | ${r.complexity || 'CC: 1, Paths: 1'} |`).join('\n');
                              setExtractedRequirements(newContent);
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
                            defaultValue={req.acceptanceCriteria}
                            onBlur={(e) => {
                              // Only update when user finishes editing (onBlur)
                              const newReqs = [...requirements];
                              newReqs[index].acceptanceCriteria = e.target.value;
                              const newContent = newReqs.map(r => `| ${r.id} | ${r.requirement} | ${r.acceptanceCriteria} | ${r.complexity || 'CC: 1, Paths: 1'} |`).join('\n');
                              setExtractedRequirements(newContent);
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
                            defaultValue={req.complexity || 'CC: 1, Paths: 1'}
                            onBlur={(e) => {
                              // Only update when user finishes editing (onBlur)
                              const newReqs = [...requirements];
                              newReqs[index].complexity = e.target.value;
                              const newContent = newReqs.map(r => `| ${r.id} | ${r.requirement} | ${r.acceptanceCriteria} | ${r.complexity || 'CC: 1, Paths: 1'} |`).join('\n');
                              setExtractedRequirements(newContent);
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
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            
            {/* Simple action buttons */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  // Get the parsed requirements with generated IDs
                  console.log('🔍 Insert Requirements clicked - extractedRequirements:', extractedRequirements.substring(0, 200));
                  const requirements = parseRequirementsTable(extractedRequirements);
                  console.log('🔍 Parsed requirements count:', requirements.length);
                  
                  // Validate complexity values and show warnings
                  const complexityWarnings = validateComplexityValues(requirements);
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
                  const formattedContent = formatRequirementsForInsertionWithGeneratedIds(requirements);
                  setContent(formattedContent);
                }}
              >
                Insert Requirements
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => navigator.clipboard.writeText(extractedRequirements)}
              >
                Copy
              </button>
              <button 
                className="btn btn-secondary"
                onClick={handleDownloadContent}
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

        <div className="flex gap-4">
          <button
            className="btn btn-primary"
            onClick={generateTests}
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
            onClick={clearAll}
            disabled={isLoading}
          >
            Clear All
          </button>
          
          {/* Temporary test button */}
          <button
            className="btn btn-primary"
            onClick={() => {
              if (generatedTests && generatedTests.trim()) {
                setShowModal(true);
              } else {
                setStatus({ type: 'error', message: 'No test cases available to display. Please generate tests first.' });
              }
            }}
            disabled={isLoading || !generatedTests || !generatedTests.trim()}
          >
            View Generated Test
          </button>
        </div>
      </div>



      {/* Instructions */}
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
      {showModal && (generatedTests && generatedTests.trim() || featureTabs.length > 0) && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                <TestTube size={24} />
                {generatedTests && generatedTests.trim() ? 'Generated Test Cases' : 'Test Cases'}
              </h2>
              <div className="modal-actions">
                <button 
                  className="btn btn-info"
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
                  </button>
                ))}
              </div>
            )}

            {/* Feature Content */}
            {featureTabs.length > 0 && (
              <div className="feature-content">
                {/* Debug info for imported features */}
                {console.log('🔍 Feature Tabs Debug:', {
                  featureTabsLength: featureTabs.length,
                  activeTab: activeTab,
                  currentFeature: featureTabs[activeTab],
                  editableFeatures: editableFeatures,
                  currentEditableContent: editableFeatures[activeTab]
                })}
                
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
                    
                    {/* Debug info for TestOutput */}
                    {console.log('🔍 TestOutput Debug:', {
                      editableContent: editableFeatures[activeTab],
                      featureContent: featureTabs[activeTab]?.content,
                      finalContent: editableFeatures[activeTab] || featureTabs[activeTab]?.content || '',
                      hasContent: !!(editableFeatures[activeTab] || featureTabs[activeTab]?.content)
                    })}
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
                          (project.name && project.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
                          (project.key && project.key.toLowerCase().includes(projectSearch.toLowerCase()))
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
                            handleProjectChange('');
                            setShowProjectDropdown(false);
                            setProjectSearch(''); // Clear search when option is selected
                          }}
                        >
                          Select a project...
                        </div>
                        {zephyrProjects
                          .filter(project => 
                            (project.name && project.name.toLowerCase().includes(projectSearch.toLowerCase())) ||
                            (project.key && project.key.toLowerCase().includes(projectSearch.toLowerCase()))
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
                                handleProjectChange(project.key);
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
                                  fetchAllFolders(zephyrConfig.projectKey);
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
                                searchFolders(zephyrConfig.projectKey, e.target.value);
                              } else if (folderNavigation.currentLevel === 'search') {
                                // Return to previous level when search is cleared
                                if (folderNavigation.currentLevel === 'subfolder') {
                                  // Return to subfolder view
                                  const subfolders = zephyrFolders.filter(folder => 
                                    folder.parentId === folderNavigation.parentFolderId
                                  );
                                  setZephyrFolders(subfolders);
                                } else {
                                  fetchAllFolders(zephyrConfig.projectKey);
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
                                fetchAllFolders(zephyrConfig.projectKey);
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
                                              toggleFolderExpansion(folder.id);
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
                              return renderFolderTree(folderTree);
                            }
                          })()}
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
            console.log('🔍 Modal overlay clicked, closing modal...');
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
                        'Jira Connect'
                      )}
                    </button>
                    
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

      {/* Requirements Editor Modal */}

      
    </div>
  );
};

export default TestGenerator; 