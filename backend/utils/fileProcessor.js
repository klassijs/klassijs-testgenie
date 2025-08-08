const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

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

// Extract content from different file types
async function extractFileContent(file) {
  try {
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname;
    const extension = path.extname(originalName);

  

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
        

        return structuredContent.trim();
        
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

        return result.value;
        
      } catch (error) {
        console.error(`Error processing Word document: ${error.message}`);
        // Fallback to basic mammoth extraction
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
    } else if (isImageFile(mimeType, extension)) {
      return `[Image File: ${originalName}]\n\nThis is an image file that requires manual analysis or OCR processing to extract text content.`;
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
  
          return `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}`;
        } else {
          return `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that should be reviewed manually to create appropriate test cases based on the data relationships and business logic.`;
        }
      } catch (zipError) {

        return `# Excel Spreadsheet Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Excel file contains structured data that requires manual analysis to create appropriate test cases.`;
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
  
          return `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}`;
        } else {
          return `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that should be reviewed manually to create appropriate test cases based on the presentation content and flow.`;
        }
      } catch (zipError) {

        return `# PowerPoint Presentation Analysis\n\n## File: ${originalName}\n\n### Note:\nThis PowerPoint presentation contains visual elements that require manual analysis to create appropriate test cases.`;
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
          
          // Extract page information for business context
          const pageMatches = documentXml.match(/<Page[^>]*Name="([^"]*)"[^>]*>/g);
          if (pageMatches) {
            extractedContent += `\n\n## Business Process Pages:\n`;
            pageMatches.forEach((match, index) => {
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
        
        // Extract business requirements from all pages
        const pageFiles = Object.keys(zipContent.files).filter(file => 
          file.includes('visio/pages/') && file.endsWith('.xml')
        );
        

        
        for (const pageFile of pageFiles) {
          try {
            const pageXml = await zipContent.files[pageFile].async('string');
            
            // Extract business process elements and their relationships
            const businessElements = [];
            
            // Extract shapes that represent business processes, systems, or actors
            const shapeMatches = pageXml.match(/<Shape[^>]*>.*?<\/Shape>/gs);
            if (shapeMatches) {
              shapeMatches.forEach(shape => {
                // Extract shape text and properties
                const textMatches = shape.match(/<Text[^>]*>.*?<\/Text>/gs);
                const nameMatches = shape.match(/Name="([^"]*)"/);
                const typeMatches = shape.match(/Type="([^"]*)"/);
                
                if (textMatches || nameMatches) {
                  const shapeText = textMatches ? 
                    textMatches.map(text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).join(' ') :
                    (nameMatches ? nameMatches[1] : '');
                  
                  const shapeType = typeMatches ? typeMatches[1] : '';
                  
                  // Focus on business-relevant shapes
                  if (shapeText.length > 3 && 
                      !shapeText.match(/^(Shape|Text|Group|Container)/i) &&
                      !shapeText.match(/^[0-9\s]+$/)) {
                    
                    businessElements.push({
                      text: shapeText,
                      type: shapeType,
                      element: 'Business Process Component'
                    });
                  }
                }
              });
            }
            
            // Extract connections that represent business flows
            const connectionMatches = pageXml.match(/<Connect[^>]*>/g);
            if (connectionMatches) {
              connectionMatches.forEach(connection => {
                const fromMatches = connection.match(/FromSheet="([^"]*)"/);
                const toMatches = connection.match(/ToSheet="([^"]*)"/);
                
                if (fromMatches && toMatches) {
                  businessElements.push({
                    text: `Connection from ${fromMatches[1]} to ${toMatches[1]}`,
                    type: 'Connection',
                    element: 'Business Flow'
                  });
                }
              });
            }
            
            // Extract business requirements from the diagram elements
            if (businessElements.length > 0) {
              extractedContent += `\n\n### Business Requirements from Diagram:\n`;
              
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
              extractedContent += `\n#### Derived Business Requirements:\n`;
              
              // Create requirements based on process components
              processes.forEach((process, index) => {
                const requirementText = process.text.replace(/[^\w\s]/g, ' ').trim();
                if (requirementText.length > 5) {
                  extractedContent += `- The system should support ${requirementText.toLowerCase()}\n`;
                }
              });
              
              // Create requirements based on business flows
              flows.forEach((flow, index) => {
                const flowText = flow.text.replace(/[^\w\s]/g, ' ').trim();
                if (flowText.length > 10) {
                  extractedContent += `- The system should handle ${flowText.toLowerCase()}\n`;
                }
              });
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
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Extracted Content:\n${extractedContent.trim()}`;
  
          return result;
        } else {
          const result = `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file contains visual elements that require manual analysis. The diagram structure and relationships should be reviewed manually to create appropriate test cases.`;
  
          return result;
        }
      } catch (zipError) {

        return `# Visio Diagram Analysis\n\n## File: ${originalName}\n\n### Note:\nThis Visio diagram file requires manual analysis. Please review the diagram structure and create test cases based on the visual elements and relationships shown.`;
      }
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error(`Error extracting content from ${file.originalname}:`, error);
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
  isVisioFile
}; 