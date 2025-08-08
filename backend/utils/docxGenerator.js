const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');

async function generateWordDocument(content, title = 'Business Requirements') {
  try {
    // Parse markdown content and convert to Word document structure
    const lines = content.split('\n');
    const docElements = [];
    let tableRows = null;
    
    // Add title
    docElements.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        spacing: {
          after: 400,
        },
      })
    );
    
    // Process each line
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line - add spacing
        docElements.push(
          new Paragraph({
            spacing: {
              after: 200,
            },
          })
        );
        continue;
      }
      
      // Check for markdown table headers
      if (trimmedLine.includes('| Requirement ID | Business Requirement | Acceptance Criteria |')) {
        docElements.push(
          new Paragraph({
            text: 'Business Requirements Table',
            heading: HeadingLevel.HEADING_2,
            spacing: {
              after: 300,
            },
          })
        );
        continue;
      }
      
      // Check for table separator line
      if (trimmedLine.includes('|----------------|----------------------|---------------------|')) {
        continue; // Skip separator line
      }
      
      // Check for table rows
      if (trimmedLine.includes('|') && trimmedLine.split('|').length > 3) {
        const columns = trimmedLine.split('|').map(col => col.trim()).filter(col => col);
        if (columns.length >= 3) {
          const [id, requirement, acceptanceCriteria] = columns;
          
          // Skip header-like rows
          if (id.toLowerCase().includes('requirement id') || id === '---') {
            continue;
          }
          
          // Add to table rows array for later processing
          if (!tableRows) {
            tableRows = [];
            // Add table header
            tableRows.push([
              'Requirement ID',
              'Business Requirement', 
              'Acceptance Criteria'
            ]);
          }
          
          tableRows.push([id, requirement, acceptanceCriteria]);
          continue;
        }
      }
      
      // Check for headers (lines starting with #)
      if (trimmedLine.startsWith('#')) {
        const level = trimmedLine.match(/^#+/)[0].length;
        const text = trimmedLine.replace(/^#+\s*/, '');
        
        let headingLevel;
        switch (level) {
          case 1:
            headingLevel = HeadingLevel.HEADING_1;
            break;
          case 2:
            headingLevel = HeadingLevel.HEADING_2;
            break;
          case 3:
            headingLevel = HeadingLevel.HEADING_3;
            break;
          default:
            headingLevel = HeadingLevel.HEADING_2;
        }
        
        docElements.push(
          new Paragraph({
            text: text,
            heading: headingLevel,
            spacing: {
              after: 300,
            },
          })
        );
        continue;
      }
      
      // Regular text
      docElements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              size: 24,
            }),
          ],
          spacing: {
            after: 200,
          },
        })
      );
    }
    
    // Add table if we have table rows
    if (tableRows && tableRows.length > 1) {
      const tableRowsElements = tableRows.map(row => {
        return new TableRow({
          children: row.map((cellText, index) => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText,
                      bold: index === 0, // Make header row bold
                      size: 24,
                    }),
                  ],
                }),
              ],
              width: {
                size: index === 0 ? 20 : (index === 1 ? 40 : 40), // ID: 20%, Requirement: 40%, Criteria: 40%
                type: WidthType.PERCENTAGE,
              },
            });
          }),
        });
      });
      
      docElements.push(
        new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          rows: tableRowsElements,
        })
      );
    }
    
    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docElements,
        },
      ],
    });
    
    // Generate the Word document buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;
    
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw new Error('Failed to generate Word document');
  }
}

module.exports = { generateWordDocument }; 