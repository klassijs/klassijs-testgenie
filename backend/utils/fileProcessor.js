const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const crypto = require('crypto');

// File processing cache to ensure consistency
const fileCache = new Map();
const CACHE_MAX_SIZE = 100; // Limit cache size to prevent memory issues

// File type detection
const isImageFile = (mimeType, extension) => {
  const imageMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', 'image/webp', 'image/svg+xml'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg'];
  return imageMimes.includes(mimeType) || imageExtensions.includes(extension.toLowerCase());
};

const isExcelFile = (mimeType, extension) => {
  const excelMimes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet'];
  const excelExtensions = ['.xls', '.xlsx', '.ods'];
  return excelMimes.includes(mimeType) || excelExtensions.includes(extension.toLowerCase());
};

const isPowerPointFile = (mimeType, extension) => {
  const pptMimes = ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation'];
  const pptExtensions = ['.ppt', '.pptx', '.odp'];
  return pptMimes.includes(mimeType) || pptExtensions.includes(extension.toLowerCase());
};

const isVisioFile = (mimeType, extension) => {
  const visioMimes = ['application/octet-stream']; // VSDX files often have this MIME type
  const visioExtensions = ['.vsd', '.vsdx'];
  return visioMimes.includes(mimeType) || visioExtensions.includes(extension.toLowerCase());
};

// Helper function to clean cache when it gets too large
function cleanCache() {
  if (fileCache.size > CACHE_MAX_SIZE) {
    const entries = Array.from(fileCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, Math.floor(CACHE_MAX_SIZE / 2));
    toRemove.forEach(([key]) => fileCache.delete(key));
  }
}

// Helper function to count business elements deterministically
function countBusinessElementsDeterministically(content) {
  const lines = content.split('\n');
  let businessElements = [];
  let currentSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Track sections for context
    if (line.startsWith('##') || line.startsWith('###')) {
      currentSection = line.replace(/^#+\s*/, '');
      continue;
    }
    
    // Count business processes and systems
    if (line.startsWith('Business Process:') || line.startsWith('Business Process Component:')) {
      const processName = line.replace(/^Business Process:?\s*/, '').trim();
      if (processName.length > 3) {
        businessElements.push({
          type: 'Business Process',
          text: processName,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
    
    // Count system requirements
    if (line.startsWith('The system should support') || line.startsWith('The system should handle')) {
      const requirement = line.replace(/^The system should (support|handle)\s*/, '').trim();
      if (requirement.length > 5) {
        businessElements.push({
          type: 'System Requirement',
          text: requirement,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
    
    // Count decision points
    if (line.startsWith('Decision Point:') || line.includes('Decision Point')) {
      const decision = line.replace(/^Decision Point:?\s*/, '').trim();
      if (decision.length > 3) {
        businessElements.push({
          type: 'Decision Point',
          text: decision,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
    
    // Count process steps
    if (line.startsWith('Process Step:') || line.includes('Process Step')) {
      const step = line.replace(/^Process Step:?\s*/, '').trim();
      if (step.length > 3) {
        businessElements.push({
          type: 'Process Step',
          text: step,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
    
    // Count business flows
    if (line.startsWith('Business Flow:') || line.includes('Business Flow')) {
      const flow = line.replace(/^Business Flow:?\s*/, '').trim();
      if (flow.length > 5) {
        businessElements.push({
          type: 'Business Flow',
          text: flow,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
    
    // Count user actions (lines starting with dash and containing user-related terms)
    if (line.startsWith('-') && (
      line.toLowerCase().includes('user') ||
      line.toLowerCase().includes('customer') ||
      line.toLowerCase().includes('login') ||
      line.toLowerCase().includes('register') ||
      line.toLowerCase().includes('submit') ||
      line.toLowerCase().includes('view') ||
      line.toLowerCase().includes('create') ||
      line.toLowerCase().includes('update') ||
      line.toLowerCase().includes('delete')
    )) {
      const action = line.replace(/^-\s*/, '').trim();
      if (action.length > 5) {
        businessElements.push({
          type: 'User Action',
          text: action,
          lineNumber: i + 1,
          section: currentSection
        });
      }
    }
  }
  
  // Remove duplicates while preserving order
  const uniqueElements = [];
  const seenTexts = new Set();
  
  for (const element of businessElements) {
    const normalizedText = element.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seenTexts.has(normalizedText)) {
      seenTexts.add(normalizedText);
      uniqueElements.push(element);
    }
  }
  
  // Sort by line number for consistent ordering
  uniqueElements.sort((a, b) => a.lineNumber - b.lineNumber);
  
  return {
    count: uniqueElements.length,
    elements: uniqueElements,
    breakdown: {
      processes: uniqueElements.filter(e => e.type === 'Business Process').length,
      requirements: uniqueElements.filter(e => e.type === 'System Requirement').length,
      decisions: uniqueElements.filter(e => e.type === 'Decision Point').length,
      steps: uniqueElements.filter(e => e.type === 'Process Step').length,
      flows: uniqueElements.filter(e => e.type === 'Business Flow').length,
      userActions: uniqueElements.filter(e => e.type === 'User Action').length
    }
  };
}

// Helper function to create deterministic content hash
function createDeterministicHash(buffer, fileName) {
  // Create a hash that considers both content and filename for better uniqueness
  const contentHash = crypto.createHash('md5').update(buffer).digest('hex');
  const nameHash = crypto.createHash('md5').update(fileName).digest('hex');
  return `${contentHash.substring(0, 8)}-${nameHash.substring(0, 8)}`;
}

// Extract content from different file types
async function extractFileContent(file) {
  try {
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    const extension = path.extname(originalName);

    // Create deterministic file hash for caching
    const fileHash = createDeterministicHash(buffer, originalName);
    
    // Check cache first for consistency
    if (fileCache.has(fileHash)) {
      const cached = fileCache.get(fileHash);
      console.log(`📋 Using cached content for ${originalName} (hash: ${fileHash})`);
      return cached.content;
    }

    // Handle different file types
    if (mimeType === 'application/pdf') {
  
      
      try {
        const pdfData = await pdfParse(buffer);
        let extractedContent = pdfData.text;
        
        // Enhanced PDF processing to extract more structured content
        const lines = extractedContent.split('\n');
        let structuredContent = '';
        let currentSection = '';
        let inTable = false;
        let tableContent = '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Detect headers and sections
          if (line.match(/^[A-Z][A-Z\s]+$/) || line.match(/^[0-9]+\.\s+[A-Z]/) || line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s*$/)) {
            if (currentSection) {
              structuredContent += `\n\n## ${currentSection}\n`;
            }
            currentSection = line;
            structuredContent += `\n\n# ${line}\n`;
          }
          // Detect tables (lines with multiple spaces or tabs)
          else if (line.includes('  ') && line.split(/\s{2,}/).length > 2) {
            if (!inTable) {
              inTable = true;
              tableContent = '';
            }
            tableContent += line + '\n';
          }
          // Detect diagrams and charts (lines with special characters)
          else if (line.includes('┌') || line.includes('├') || line.includes('└') || line.includes('│') || 
                   line.includes('─') || line.includes('┐') || line.includes('┤') || line.includes('┘')) {
            structuredContent += `\n\n### Diagram/Chart Content:\n${line}\n`;
          }
          // Detect flow diagrams (lines with arrows)
          else if (line.includes('→') || line.includes('←') || line.includes('↑') || line.includes('↓') ||
                   line.includes('->') || line.includes('<-') || line.includes('=>') || line.includes('<=')) {
            structuredContent += `\n\n### Flow Diagram:\n${line}\n`;
          }
          else {
            if (inTable) {
              structuredContent += `\n\n### Table Content:\n${tableContent}\n`;
              inTable = false;
              tableContent = '';
            }
            structuredContent += line + '\n';
          }
        }
        
        if (inTable) {
          structuredContent += `\n\n### Table Content:\n${tableContent}\n`;
        }
        
        const result = structuredContent.trim();
        
        // Use deterministic counting for business elements
        const businessElementCount = countBusinessElementsDeterministically(result);
        
        const enhancedResult = `${result}\n\n### Business Element Analysis:\n- **Total Business Elements**: ${businessElementCount.count}\n- **Business Processes**: ${businessElementCount.breakdown.processes}\n- **System Requirements**: ${businessElementCount.breakdown.requirements}\n- **Decision Points**: ${businessElementCount.breakdown.decisions}\n- **Process Steps**: ${businessElementCount.breakdown.steps}\n- **Business Flows**: ${businessElementCount.breakdown.flows}\n- **User Actions**: ${businessElementCount.breakdown.userActions}\n\n### Deterministic Count:\nThis analysis identified **${businessElementCount.count} business requirements** based on actual content analysis.`;
        
        // Cache the result for consistency
        fileCache.set(fileHash, {
          content: enhancedResult,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: businessElementCount.count,
          businessElements: businessElementCount,
          deterministicCount: true
        });
        
        // Clean cache if needed
        cleanCache();
        
        console.log(`📋 Cached PDF content for ${originalName} (hash: ${fileHash}, deterministic count: ${businessElementCount.count})`);
        
        return enhancedResult;
        
      } catch (error) {
        console.error(`Error processing PDF: ${error.message}`);
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      }
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      return buffer.toString('utf-8');
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
               mimeType === 'application/msword' ||
               mimeType === 'application/rtf' ||
               mimeType === 'application/vnd.oasis.opendocument.text') {
      
  
      
      // Enhanced Word document processing for complex content including flow diagrams
      try {
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // For .docx files, extract from XML structure to get embedded content
          const JSZip = require('jszip');
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(buffer);
          
          let extractedContent = '';
          
          // Extract main document content
          if (zipContent.files['word/document.xml']) {
            const documentXml = await zipContent.files['word/document.xml'].async('string');
            const textContent = documentXml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (textContent.length > 10) {
              extractedContent += `\n\nMain Document Content:\n${textContent}`;
            }
          }
          
          // Extract embedded objects and diagrams
          const embeddedFiles = Object.keys(zipContent.files).filter(file => 
            file.includes('word/embeddings/') || 
            file.includes('word/media/') ||
            file.includes('word/drawings/')
          );
          
  
          
          for (const embeddedFile of embeddedFiles) {
            try {
              const embeddedContent = await zipContent.files[embeddedFile].async('string');
              const textContent = embeddedContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (textContent.length > 10) {
                extractedContent += `\n\nEmbedded Content (${embeddedFile}):\n${textContent}`;
              }
            } catch (error) {

            }
          }
          
          // Extract headers and footers
          const headerFiles = Object.keys(zipContent.files).filter(file => file.includes('word/header'));
          const footerFiles = Object.keys(zipContent.files).filter(file => file.includes('word/footer'));
          
          for (const headerFile of headerFiles) {
            try {
              const headerContent = await zipContent.files[headerFile].async('string');
              const textContent = headerContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
              if (textContent.length > 10) {
                extractedContent += `\n\nHeader Content:\n${textContent}`;
              }
            } catch (error) {
  
            }
          }
          
          if (extractedContent.trim()) {
    
            return extractedContent.trim();
          }
        }
        
        // Fallback to mammoth for other Word formats
        const result = await mammoth.extractRawText({ buffer });
        
        const extractedContent = result.value;
        
        // Use deterministic counting for business elements
        const businessElementCount = countBusinessElementsDeterministically(extractedContent);
        
        const enhancedContent = `${extractedContent}\n\n### Business Element Analysis:\n- **Total Business Elements**: ${businessElementCount.count}\n- **Business Processes**: ${businessElementCount.breakdown.processes}\n- **System Requirements**: ${businessElementCount.breakdown.requirements}\n- **Decision Points**: ${businessElementCount.breakdown.decisions}\n- **Process Steps**: ${businessElementCount.breakdown.steps}\n- **Business Flows**: ${businessElementCount.breakdown.flows}\n- **User Actions**: ${businessElementCount.breakdown.userActions}\n\n### Deterministic Count:\nThis analysis identified **${businessElementCount.count} business requirements** based on actual content analysis.`;
        
        // Cache the result for consistency
        fileCache.set(fileHash, {
          content: enhancedContent,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: businessElementCount.count,
          businessElements: businessElementCount,
          deterministicCount: true
        });
        
        // Clean cache if needed
        cleanCache();
        
        console.log(`📋 Cached Word content for ${originalName} (hash: ${fileHash}, deterministic count: ${businessElementCount.count})`);
        
        return enhancedContent;
        
      } catch (error) {
        console.error(`Error processing Word document: ${error.message}`);
        // Fallback to basic mammoth extraction
        const result = await mammoth.extractRawText({ buffer });
        
        const extractedContent = result.value;
        
        // Cache the fallback result for consistency
        fileCache.set(fileHash, {
          content: extractedContent,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: extractedContent.split('\n').length,
          fallback: true
        });
        
        console.log(`📋 Cached Word fallback content for ${originalName} (hash: ${fileHash}, lines: ${extractedContent.split('\n').length})`);
        
        return extractedContent;
      }
    } else if (isImageFile(mimeType, extension)) {
      const result = `[Image File: ${originalName}]\n\nThis is an image file that requires manual analysis or OCR processing to extract text content.`;
      
      // Cache image file results for consistency
      fileCache.set(fileHash, {
        content: result,
        timestamp: Date.now(),
        fileSize: buffer.length,
        elementCount: 0,
        type: 'image'
      });
      
      console.log(`📋 Cached image file result for ${originalName} (hash: ${fileHash})`);
      
      return result;
    } else if (isExcelFile(mimeType, extension)) {
  
      
      try {
        const JSZip = require('jszip');
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract workbook structure and sheet names
        if (zipContent.files['xl/workbook.xml']) {
          const workbookXml = await zipContent.files['xl/workbook.xml'].async('string');
          const sheetMatches = workbookXml.match(/<sheet[^>]*name="([^"]*)"[^>]*>/g);
          if (sheetMatches) {
            extractedContent += `\n\n## Workbook Structure:\n`;
            sheetMatches.forEach((match, index) => {
              const nameMatch = match.match(/name="([^"]*)"/);
              if (nameMatch) {
                extractedContent += `Sheet ${index + 1}: ${nameMatch[1]}\n`;
              }
            });
          }
        }
        
        // Extract all worksheets
        const worksheetFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('xl/worksheets/sheet') && file.endsWith('.xml')
        );
        

        
        for (const worksheetFile of worksheetFiles) {
          try {
            const worksheetXml = await zipContent.files[worksheetFile].async('string');
            
            extractedContent += `\n\n### Worksheet: ${worksheetFile}\n`;
            
            // Extract only meaningful text content (headers, labels, business logic)
            const textMatches = worksheetXml.match(/<t>(.*?)<\/t>/g);
            if (textMatches) {
              const meaningfulTexts = textMatches
                .map(text => text.replace(/<\/?t>/g, '').trim())
                .filter(text => text.length > 2 && !text.match(/^[0-9]+$/)); // Filter out numbers and very short text
              
              if (meaningfulTexts.length > 0) {
                extractedContent += `\n#### Business Content:\n`;
                meaningfulTexts.forEach(text => {
                  extractedContent += `- ${text}\n`;
                });
              }
            }
            
            // Extract sheet structure info (column headers, row headers)
            const headerMatches = worksheetXml.match(/<c[^>]*r="[A-Z]+1"[^>]*>.*?<v>(.*?)<\/v>.*?<\/c>/gs);
            if (headerMatches) {
              const headers = headerMatches
                .map(header => header.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
                .filter(header => header.length > 0);
              
              if (headers.length > 0) {
                extractedContent += `\n#### Column Headers:\n`;
                headers.forEach(header => {
                  extractedContent += `- ${header}\n`;
                });
              }
            }
          } catch (error) {

          }
        }
        
        // Extract charts and embedded objects
        const chartFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('xl/charts/') || file.includes('xl/drawings/')
        );
        
        if (chartFiles.length > 0) {
          extractedContent += `\n\n### Charts and Diagrams:\n`;
          chartFiles.forEach(chartFile => {
            extractedContent += `- ${chartFile}\n`;
          });
        }
        
        // Extract shared strings (for better text extraction)
        if (zipContent.files['xl/sharedStrings.xml']) {
          const sharedStringsXml = await zipContent.files['xl/sharedStrings.xml'].async('string');
          const stringMatches = sharedStringsXml.match(/<t>(.*?)<\/t>/g);
          if (stringMatches) {
            extractedContent += `\n\n### Text Content:\n`;
            stringMatches.forEach(stringMatch => {
              const stringText = stringMatch.replace(/<\/?t>/g, '').trim();
              if (stringText.length > 0) {
                extractedContent += `${stringText} `;
              }
            });
          }
        }
        
        if (extractedContent.trim()) {
          // Use deterministic counting for business elements
          const businessElementCount = countBusinessElementsDeterministically(extractedContent);
          
          const result = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Business Element Analysis:\n- **Total Business Elements**: ${businessElementCount.count}\n- **Business Processes**: ${businessElementCount.breakdown.processes}\n- **System Requirements**: ${businessElementCount.breakdown.requirements}\n- **Decision Points**: ${businessElementCount.breakdown.decisions}\n- **Process Steps**: ${businessElementCount.breakdown.steps}\n- **Business Flows**: ${businessElementCount.breakdown.flows}\n- **User Actions**: ${businessElementCount.breakdown.userActions}\n\n### Deterministic Count:\nThis analysis identified **${businessElementCount.count} business requirements** based on actual content analysis.`;
          
          // Cache the result for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: businessElementCount.count,
            businessElements: businessElementCount,
            deterministicCount: true
          });
          
          // Clean cache if needed
          cleanCache();
          
          console.log(`📋 Cached Excel content for ${originalName} (hash: ${fileHash}, deterministic count: ${businessElementCount.count})`);
          
          return result;
        } else {
          const result = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that should be reviewed manually to create appropriate test cases based on the data relationships and business logic.`;
          
          // Cache empty results for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: 0,
            deterministicCount: true
          });
          
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing Excel file ${originalName}:`, zipError);
        
        const errorResult = `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that requires manual analysis to create appropriate test cases.`;
        
        // Cache error results to prevent repeated failures
        fileCache.set(fileHash, {
          content: errorResult,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: 0,
          error: true
        });
        
        return errorResult;
      }
    } else if (isPowerPointFile(mimeType, extension)) {
  
      
      try {
        const JSZip = require('jszip');
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract presentation structure
        if (zipContent.files['ppt/presentation.xml']) {
          const presentationXml = await zipContent.files['ppt/presentation.xml'].async('string');
          const slideMatches = presentationXml.match(/<sldId[^>]*id="([^"]*)"[^>]*rid="([^"]*)"[^>]*>/g);
          if (slideMatches) {
            extractedContent += `\n\n## Presentation Structure:\n`;
            extractedContent += `Found ${slideMatches.length} slides in presentation\n`;
          }
        }
        
        // Extract all slides
        const slideFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/slides/slide') && file.endsWith('.xml')
        );
        

        
        for (let i = 0; i < slideFiles.length; i++) {
          const slideFile = slideFiles[i];
          try {
            const slideXml = await zipContent.files[slideFile].async('string');
            
            extractedContent += `\n\n### Slide ${i + 1}:\n`;
            
            // Extract slide text content
            const textMatches = slideXml.match(/<a:t>(.*?)<\/a:t>/g);
            if (textMatches) {
              extractedContent += `\n#### Text Content:\n`;
              textMatches.forEach(textMatch => {
                const textContent = textMatch.replace(/<\/?a:t>/g, '').trim();
                if (textContent.length > 0) {
                  extractedContent += `- ${textContent}\n`;
                }
              });
            }
            
            // Extract shapes and diagrams
            const shapeMatches = slideXml.match(/<p:sp[^>]*>.*?<\/p:sp>/gs);
            if (shapeMatches) {
              extractedContent += `\n#### Shapes and Diagrams:\n`;
              shapeMatches.forEach(shape => {
                const shapeText = shape.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (shapeText.length > 10) {
                  extractedContent += `- Shape: ${shapeText}\n`;
                }
              });
            }
            
            // Extract animations and transitions
            const animationMatches = slideXml.match(/<p:anim[^>]*>.*?<\/p:anim>/gs);
            if (animationMatches) {
              extractedContent += `\n#### Animations:\n`;
              animationMatches.forEach(animation => {
                const animationText = animation.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (animationText.length > 5) {
                  extractedContent += `- Animation: ${animationText}\n`;
                }
              });
            }
            
          } catch (error) {

          }
        }
        
        // Extract embedded media and objects
        const mediaFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/media/') || file.includes('ppt/embeddings/')
        );
        
        if (mediaFiles.length > 0) {
          extractedContent += `\n\n### Embedded Media:\n`;
          mediaFiles.forEach(mediaFile => {
            extractedContent += `- ${mediaFile}\n`;
          });
        }
        
        // Extract slide masters for layout information
        const masterFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('ppt/slideMasters/')
        );
        
        if (masterFiles.length > 0) {
          extractedContent += `\n\n### Slide Layouts:\n`;
          masterFiles.forEach(masterFile => {
            extractedContent += `- ${masterFile}\n`;
          });
        }
        
        if (extractedContent.trim()) {
          // Use deterministic counting for business elements
          const businessElementCount = countBusinessElementsDeterministically(extractedContent);
          
          const result = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Business Element Analysis:\n- **Total Business Elements**: ${businessElementCount.count}\n- **Business Processes**: ${businessElementCount.breakdown.processes}\n- **System Requirements**: ${businessElementCount.breakdown.requirements}\n- **Decision Points**: ${businessElementCount.breakdown.decisions}\n- **Process Steps**: ${businessElementCount.breakdown.steps}\n- **Business Flows**: ${businessElementCount.breakdown.flows}\n- **User Actions**: ${businessElementCount.breakdown.userActions}\n\n### Deterministic Count:\nThis analysis identified **${businessElementCount.count} business requirements** based on actual content analysis.`;
          
          // Cache the result for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: businessElementCount.count,
            businessElements: businessElementCount,
            deterministicCount: true
          });
          
          // Clean cache if needed
          cleanCache();
          
          console.log(`📋 Cached PowerPoint content for ${originalName} (hash: ${fileHash}, deterministic count: ${businessElementCount.count})`);
          
          return result;
        } else {
          const result = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that should be reviewed manually to create appropriate test cases based on the presentation content and flow.`;
          
          // Cache empty results for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: 0,
            deterministicCount: true
          });
          
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing PowerPoint file ${originalName}:`, zipError);
        
        const errorResult = `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that require manual analysis to create appropriate test cases.`;
        
        // Cache error results to prevent repeated failures
        fileCache.set(fileHash, {
          content: errorResult,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: 0,
          error: true
        });
        
        return errorResult;
      }
    } else if (isVisioFile(mimeType, extension)) {
      try {
        // VSDX files are essentially ZIP files containing XML
        const JSZip = require('jszip');
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        
        let extractedContent = '';
        
        // Extract business requirements from diagram structure
        if (zipContent.files['visio/document.xml']) {
          const documentXml = await zipContent.files['visio/document.xml'].async('string');
          
          // Extract page information for business context with deterministic ordering
          const pageMatches = documentXml.match(/<Page[^>]*Name="([^"]*)"[^>]*>/g);
          if (pageMatches) {
            extractedContent += `\n\n## Business Process Pages:\n`;
            // Sort page matches for consistency
            const sortedPageMatches = pageMatches.sort();
            sortedPageMatches.forEach((match, index) => {
              const nameMatch = match.match(/Name="([^"]*)"/);
              if (nameMatch) {
                const pageName = nameMatch[1];
                // Filter out technical page names and focus on business process names
                if (!pageName.match(/^(Page|Sheet|Background|Layer)/i)) {
                  extractedContent += `Business Process: ${pageName}\n`;
                }
              }
            });
          }
        }
        
        // Extract business requirements from all pages with deterministic ordering
        const pageFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('visio/pages/') && file.endsWith('.xml')
        ).sort(); // Sort for consistency
        
        // Enhanced flowchart analysis
        let totalShapes = 0;
        let totalConnections = 0;
        let decisionPoints = 0;
        let processSteps = 0;
        let startPoints = 0;
        let endPoints = 0;
        
        for (const pageFile of pageFiles) {
          try {
            const pageXml = await zipContent.files[pageFile].async('string');
            
            // Extract business process elements and their relationships
            const businessElements = [];
            
            // Enhanced shape analysis for flowchart elements with deterministic processing
            const shapeMatches = pageXml.match(/<Shape[^>]*>.*?<\/Shape>/gs);
            if (shapeMatches) {
              totalShapes += shapeMatches.length;
              
              // Sort shapes by their position in the XML for consistency
              const sortedShapes = shapeMatches.sort((a, b) => {
                const aPos = pageXml.indexOf(a);
                const bPos = pageXml.indexOf(b);
                return aPos - bPos;
              });
              
              sortedShapes.forEach((shape, index) => {
                // Extract shape text and properties
                const textMatches = shape.match(/<Text[^>]*>.*?<\/Text>/gs);
                const nameMatches = shape.match(/Name="([^"]*)"/);
                const typeMatches = shape.match(/Type="([^"]*)"/);
                const masterMatches = shape.match(/Master="([^"]*)"/);
                
                if (textMatches || nameMatches) {
                  const shapeText = textMatches ? 
                    textMatches.map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ') :
                    (nameMatches ? nameMatches[1] : '');
                  
                  const shapeType = typeMatches ? typeMatches[1] : '';
                  const masterType = masterMatches ? masterMatches[1] : '';
                  
                  // Enhanced flowchart element classification
                  let elementType = 'Business Process Component';
                  let flowchartRole = 'process';
                  
                  // Detect decision points (diamonds, gateways)
                  if (shapeText.toLowerCase().includes('decision') || 
                      shapeText.toLowerCase().includes('gateway') ||
                      shapeText.toLowerCase().includes('if') ||
                      shapeText.toLowerCase().includes('condition') ||
                      masterType.toLowerCase().includes('diamond') ||
                      masterType.toLowerCase().includes('gateway')) {
                    elementType = 'Decision Point';
                    flowchartRole = 'decision';
                    decisionPoints++;
                  }
                  // Detect start/end points
                  else if (shapeText.toLowerCase().includes('start') ||
                           shapeText.toLowerCase().includes('begin') ||
                           masterType.toLowerCase().includes('start')) {
                    elementType = 'Start Point';
                    flowchartRole = 'start';
                    startPoints++;
                  }
                  else if (shapeText.toLowerCase().includes('end') ||
                           shapeText.toLowerCase().includes('finish') ||
                           shapeText.toLowerCase().includes('stop') ||
                           masterType.toLowerCase().includes('end')) {
                    elementType = 'End Point';
                    flowchartRole = 'end';
                    endPoints++;
                  }
                  // Detect process steps
                  else if (shapeText.toLowerCase().includes('process') ||
                           shapeText.toLowerCase().includes('step') ||
                           shapeText.toLowerCase().includes('task') ||
                           masterType.toLowerCase().includes('rectangle')) {
                    elementType = 'Process Step';
                    flowchartRole = 'process';
                    processSteps++;
                  }
                  
                  // Focus on business-relevant shapes
                  if (shapeText.length > 3 && 
                      !shapeText.match(/^(Shape|Text|Group|Container)/i) &&
                      !shapeText.match(/^[0-9\s]+$/)) {
                    
                    businessElements.push({
                      text: shapeText,
                      type: shapeType,
                      master: masterType,
                      element: elementType,
                      flowchartRole: flowchartRole,
                      position: index + 1, // Use consistent index-based positioning
                      xmlPosition: pageXml.indexOf(shape) // Store XML position for deterministic ordering
                    });
                  }
                }
              });
            }
            
            // Enhanced connection analysis for business flows
            const connectionMatches = pageXml.match(/<Connect[^>]*>/g);
            if (connectionMatches) {
              totalConnections += connectionMatches.length;
              
              connectionMatches.forEach((connection, index) => {
                const fromMatches = connection.match(/FromSheet="([^"]*)"/);
                const toMatches = connection.match(/ToSheet="([^"]*)"/);
                const fromPartMatches = connection.match(/FromPart="([^"]*)"/);
                const toPartMatches = connection.match(/ToPart="([^"]*)"/);
                
                if (fromMatches && toMatches) {
                  // Find the connected elements to understand the flow
                  const fromElement = businessElements.find(el => el.position.toString() === fromMatches[1]);
                  const toElement = businessElements.find(el => el.position.toString() === toMatches[1]);
                  
                  let flowType = 'Standard Flow';
                  let flowDescription = `Flow from ${fromElement ? fromElement.text : fromMatches[1]} to ${toElement ? toElement.text : toMatches[1]}`;
                  
                  // Enhanced flow classification
                  if (fromElement && toElement) {
                    if (fromElement.flowchartRole === 'decision' && toElement.flowchartRole === 'process') {
                      flowType = 'Decision Flow';
                      flowDescription = `Decision "${fromElement.text}" leads to process "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'process' && toElement.flowchartRole === 'decision') {
                      flowType = 'Process to Decision';
                      flowDescription = `Process "${fromElement.text}" leads to decision "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'start' && toElement.flowchartRole === 'process') {
                      flowType = 'Start Flow';
                      flowDescription = `Start point leads to process "${toElement.text}"`;
                    } else if (fromElement.flowchartRole === 'process' && toElement.flowchartRole === 'end') {
                      flowType = 'End Flow';
                      flowDescription = `Process "${fromElement.text}" leads to end point`;
                    }
                  }
                  
                  businessElements.push({
                    text: flowDescription,
                    type: 'Connection',
                    element: 'Business Flow',
                    flowType: flowType,
                    fromElement: fromElement ? fromElement.text : fromMatches[1],
                    toElement: toElement ? toElement.text : toMatches[1],
                    position: businessElements.length + 1
                  });
                }
              });
            }
            
            // Extract business requirements from the diagram elements with deterministic ordering
            if (businessElements.length > 0) {
              extractedContent += `\n\n### Business Requirements from Diagram:\n`;
              
              // Sort business elements by XML position for consistent ordering
              businessElements.sort((a, b) => (a.xmlPosition || 0) - (b.xmlPosition || 0));
              
              // Group by element type for better organization
              const processes = businessElements.filter(el => el.element === 'Business Process Component');
              const flows = businessElements.filter(el => el.element === 'Business Flow');
              
              if (processes.length > 0) {
                extractedContent += `\n#### Business Processes and Systems:\n`;
                processes.forEach(process => {
                  extractedContent += `- ${process.text}\n`;
                });
              }
              
              if (flows.length > 0) {
                extractedContent += `\n#### Business Flows and Relationships:\n`;
                flows.forEach(flow => {
                  extractedContent += `- ${flow.text}\n`;
                });
              }
              
              // Generate business requirements based on the diagram structure
              extractedContent += `\n\n#### Derived Business Requirements:\n`;
              
              // Create requirements based on process components with consistent ordering
              processes.forEach((process, index) => {
                const requirementText = process.text.replace(/[^\w\s]/g, ' ').trim();
                if (requirementText.length > 5) {
                  extractedContent += `- The system should support ${requirementText.toLowerCase()}\n`;
                }
              });
              
              // Create requirements based on business flows with consistent ordering
              flows.forEach((flow, index) => {
                const flowText = flow.text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (flowText.length > 10) {
                  extractedContent += `- The system should handle ${flowText.toLowerCase()}\n`;
                }
              });
              
              // Enhanced flowchart analysis summary
              extractedContent += `\n#### Flowchart Analysis Summary:\n`;
              extractedContent += `- **Total Elements**: ${totalShapes} shapes, ${totalConnections} connections\n`;
              extractedContent += `- **Process Steps**: ${processSteps} identified\n`;
              extractedContent += `- **Decision Points**: ${decisionPoints} identified\n`;
              extractedContent += `- **Start Points**: ${startPoints} identified\n`;
              extractedContent += `- **End Points**: ${endPoints} identified\n`;
              
              // Flow complexity assessment
              if (decisionPoints > 5) {
                extractedContent += `- **Complexity**: High - Multiple decision paths detected\n`;
              } else if (decisionPoints > 2) {
                extractedContent += `- **Complexity**: Medium - Several decision points\n`;
              } else {
                extractedContent += `- **Complexity**: Low - Linear process flow\n`;
              }
              
              // Flow validation
              if (startPoints === 0) {
                extractedContent += `- **⚠️ Warning**: No start point detected\n`;
              }
              if (endPoints === 0) {
                extractedContent += `- **⚠️ Warning**: No end point detected\n`;
              }
              if (decisionPoints > 0 && processSteps < decisionPoints) {
                extractedContent += `- **⚠️ Warning**: More decisions than process steps - review flow logic\n`;
              }
            }
            
          } catch (error) {

          }
        }
        
        // Extract any embedded text or notes that might contain business requirements
        const embeddedFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('embeddings/') || file.includes('media/') || file.includes('word/')
        );
        
        if (embeddedFiles.length > 0) {
          extractedContent += `\n\n### Additional Business Context:\n`;
          for (const embeddedFile of embeddedFiles) {
            try {
              const embeddedContent = await zipContent.files[embeddedFile].async('string');
              // Extract meaningful text from embedded content
              const textMatches = embeddedContent.match(/<Text[^>]*>.*?<\/Text>/gs);
              if (textMatches) {
                const meaningfulTexts = textMatches
                  .map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
                  .filter(text => text.length > 10 && !text.match(/^[0-9\s]+$/));
                
                if (meaningfulTexts.length > 0) {
                  meaningfulTexts.forEach(text => {
                    extractedContent += `- ${text}\n`;
                  });
                }
              }
            } catch (error) {
              // Skip embedded files that can't be read as text
            }
          }
        }
        
        if (extractedContent.trim()) {
          // Use deterministic counting for business elements
          const businessElementCount = countBusinessElementsDeterministically(extractedContent);
          
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}\n\n### Business Element Analysis:\n- **Total Business Elements**: ${businessElementCount.count}\n- **Business Processes**: ${businessElementCount.breakdown.processes}\n- **System Requirements**: ${businessElementCount.breakdown.requirements}\n- **Decision Points**: ${businessElementCount.breakdown.decisions}\n- **Process Steps**: ${businessElementCount.breakdown.steps}\n- **Business Flows**: ${businessElementCount.breakdown.flows}\n- **User Actions**: ${businessElementCount.breakdown.userActions}\n\n### Deterministic Count:\nThis analysis identified **${businessElementCount.count} business requirements** based on actual content analysis.`;
          
          // Cache the result for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: businessElementCount.count,
            businessElements: businessElementCount,
            deterministicCount: true
          });
          
          // Clean cache if needed
          cleanCache();
          
          console.log(`📋 Cached Visio content for ${originalName} (hash: ${fileHash}, deterministic count: ${businessElementCount.count})`);
          
          return result;
        } else {
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file contains visual elements that require manual analysis. The diagram structure and relationships should be reviewed manually to create appropriate test cases.`;
          
          // Cache even empty results for consistency
          fileCache.set(fileHash, {
            content: result,
            timestamp: Date.now(),
            fileSize: buffer.length,
            elementCount: 0,
            deterministicCount: true
          });
          
          return result;
        }
      } catch (zipError) {
        console.error(`Error processing Visio file ${originalName}:`, zipError);
        
        const errorResult = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file requires manual analysis. Please review the diagram structure and create test cases based on the visual elements and relationships shown.`;
        
        // Cache error results to prevent repeated failures
        fileCache.set(fileHash, {
          content: errorResult,
          timestamp: Date.now(),
          fileSize: buffer.length,
          elementCount: 0,
          error: true
        });
        
        return errorResult;
      }
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`Error extracting content from ${file.originalname}:`, error);
    
    // Cache error results to prevent repeated failures
    if (fileHash) {
      const errorResult = `# File Processing Error\n\n## File: ${originalName}\n\n### Error:\nFailed to extract content: ${error.message}`;
      
      fileCache.set(fileHash, {
        content: errorResult,
        timestamp: Date.now(),
        fileSize: buffer ? buffer.length : 0,
        elementCount: 0,
        error: true,
        errorMessage: error.message
      });
    }
    
    throw new Error(`Failed to extract content from ${file.originalname}: ${error.message}`);
  }
}

// Process document sections
function processDocumentSections(content, fileName) {
  const sections = [];
  const lines = content.split('\n');
  let currentSection = '';
  let currentSectionTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#') || line.startsWith('##') || line.startsWith('###')) {
      // Save previous section if exists
      if (currentSection.trim()) {
        sections.push({
          title: currentSectionTitle || `Section ${sections.length + 1}`,
          content: currentSection.trim()
        });
      }
      
      // Start new section
      currentSectionTitle = line.replace(/^#+\s*/, '');
      currentSection = line + '\n';
    } else {
      currentSection += line + '\n';
    }
  }
  
  // Add the last section
  if (currentSection.trim()) {
    sections.push({
      title: currentSectionTitle || `Section ${sections.length + 1}`,
      content: currentSection.trim()
    });
  }
  
  // If no sections found, create a single section
  if (sections.length === 0) {
    sections.push({
      title: `Content from ${fileName}`,
      content: content.trim()
    });
  }
  
  return sections;
}

module.exports = {
  extractFileContent,
  processDocumentSections,
  isImageFile,
  isExcelFile,
  isPowerPointFile,
  isVisioFile,
  // Deterministic counting function
  countBusinessElementsDeterministically,
  // Cache management functions
  getCacheStatus: () => ({
    size: fileCache.size,
    maxSize: CACHE_MAX_SIZE,
    entries: Array.from(fileCache.entries()).map(([hash, data]) => ({
      hash,
      fileName: data.fileName || 'unknown',
      timestamp: data.timestamp,
      fileSize: data.fileSize,
      elementCount: data.elementCount,
      hasError: data.error || false,
      deterministicCount: data.deterministicCount || false,
      businessElements: data.businessElements || null
    }))
  }),
  clearCache: () => {
    fileCache.clear();
    console.log('🗑️ File processing cache cleared');
    return { message: 'Cache cleared successfully' };
  },
  cleanCache
}; 