// File Upload and Processing utility functions for TestGenerator component
/**
 * Processes uploaded files and extracts requirements
 * @param {Object} fileObj - File object to process
 * @param {Function} setIsProcessing - Function to set processing state
 * @param {Function} setProcessingFile - Function to set processing file
 * @param {Function} setCurrentDocumentName - Function to set current document name
 * @param {Function} setStatus - Function to set status message
 * @param {Function} setUploadedFiles - Function to set uploaded files
 * @param {Function} setExtractedRequirements - Function to set extracted requirements
 * @param {Function} setRequirementsSource - Function to set requirements source
 * @param {Function} setJiraTicketPrefix - Function to set JIRA ticket prefix
 * @param {Function} setJiraTicketInfo - Function to set JIRA ticket info
 * @param {Function} setFeatureTabs - Function to set feature tabs
 * @param {Function} setEditableFeatures - Function to set editable features
 * @param {string} API_BASE_URL - Base URL for API calls
 * @param {string} context - Context for processing
 * @param {Function} parseRequirementsTable - Function to parse requirements table
 * @returns {Promise<void>}
 */
export const processFile = async (
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
) => {
  setIsProcessing(true);
  setProcessingFile(fileObj.name);
  setCurrentDocumentName(fileObj.name);
  setStatus({ type: 'info', message: `Processing ${fileObj.name}...` });

  try {
    const formData = new FormData();
    // Handle both file and file.file cases
    const fileToUpload = fileObj.file || fileObj;
    formData.append('file', fileToUpload);

    const response = await fetch(`${API_BASE_URL}/api/analyze-document`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'completed', content: data.content }
            : f
        )
      );
      
      // Automatically extract requirements from the document content
      try {
        const requirementsResponse = await fetch(`${API_BASE_URL}/api/extract-requirements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: data.content, 
            context: context,
            documentName: fileObj.name
          })
        });
        
        const requirementsData = await requirementsResponse.json();
        
        if (requirementsData.success) {
          setExtractedRequirements(requirementsData.content);
          
          // Set requirements source for uploaded documents
          setRequirementsSource('upload');
          setJiraTicketPrefix(''); // Clear any Jira ticket prefix
          setJiraTicketInfo({}); // Clear any Jira ticket info
          
          // Create feature tabs from extracted requirements
          const requirementsContent = requirementsData.content;
          
          // Parse the requirements table to extract individual requirements
          const requirements = parseRequirementsTable(requirementsContent, 'upload', '', {}, setJiraTicketPrefix, setJiraTicketInfo);
                
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
          console.error('🔍 Frontend: Requirements extraction failed - success=false');
          setStatus({ type: 'error', message: `Failed to extract requirements from ${fileObj.name}. The document was processed but no requirements could be extracted.` });
        }
      } catch (requirementsError) {
        console.error('🔍 Frontend: Requirements extraction error:', requirementsError);
        setStatus({ type: 'error', message: `Failed to extract requirements from ${fileObj.name}: ${requirementsError.message}` });
      }
    } else {
      setUploadedFiles(prev => 
        prev.map(f => 
          f.id === fileObj.id 
            ? { ...f, status: 'failed', error: data.error }
            : f
        )
      );
      setStatus({ type: 'error', message: `Failed to process ${fileObj.name}: ${data.error}` });
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
};

/**
 * Handles file upload events
 * @param {Event} event - File upload event
 * @param {Function} setUploadedFiles - Function to set uploaded files
 * @param {Function} processFile - Function to process files
 * @returns {void}
 */
export const handleFileUpload = (event, setUploadedFiles, processFile) => {
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
};

/**
 * Removes a file from the uploaded files list
 * @param {string} fileId - ID of the file to remove
 * @param {Function} setUploadedFiles - Function to set uploaded files
 * @returns {void}
 */
export const removeFile = (fileId, setUploadedFiles) => {
  setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
};

/**
 * Handles drag over events
 * @param {Event} e - Drag over event
 * @param {Function} setIsDragOver - Function to set drag over state
 * @returns {void}
 */
export const handleDragOver = (e, setIsDragOver) => {
  e.preventDefault();
  setIsDragOver(true);
};

/**
 * Handles drag leave events
 * @param {Event} e - Drag leave event
 * @param {Function} setIsDragOver - Function to set drag over state
 * @returns {void}
 */
export const handleDragLeave = (e, setIsDragOver) => {
  e.preventDefault();
  setIsDragOver(false);
};

/**
 * Handles drop events
 * @param {Event} e - Drop event
 * @param {Function} setIsDragOver - Function to set drag over state
 * @param {Function} handleFileUpload - Function to handle file upload
 * @returns {void}
 */
export const handleDrop = (e, setIsDragOver, handleFileUpload) => {
  e.preventDefault();
  setIsDragOver(false);
  const files = e.dataTransfer.files;
  // Create a mock event object for handleFileUpload
  const mockEvent = { target: { files: files } };
  handleFileUpload(mockEvent);
};
